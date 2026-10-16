export type Pca3Result = {
  positions: Float32Array;
  components: Float32Array;
  mean: Float32Array;
  explained: Float32Array;
};

function dot(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  let index = 0;
  for (; index + 3 < length; index += 4) {
    sum += a[index] * b[index]
      + a[index + 1] * b[index + 1]
      + a[index + 2] * b[index + 2]
      + a[index + 3] * b[index + 3];
  }
  for (; index < length; index += 1) sum += a[index] * b[index];
  return sum;
}

function normalizeInPlace(vector: Float32Array): number {
  const norm = Math.sqrt(Math.max(0, dot(vector, vector)));
  if (norm <= 1e-12) return 0;
  const inverse = 1 / norm;
  for (let index = 0; index < vector.length; index += 1) vector[index] *= inverse;
  return norm;
}

function seededValue(index: number, component: number): number {
  let value = Math.imul(index + 11, 0x9e3779b1) ^ Math.imul(component + 31, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return ((value >>> 0) / 0xffffffff) * 2 - 1;
}

function orthogonalize(vector: Float32Array, components: Float32Array[], passes = 2): void {
  for (let pass = 0; pass < passes; pass += 1) {
    for (const component of components) {
      const projection = dot(vector, component);
      for (let index = 0; index < vector.length; index += 1) {
        vector[index] -= projection * component[index];
      }
    }
  }
}

/** Matrix-free multiply by covariance X^T X / n for centered row-major data. */
function covarianceMultiply(
  centered: Float32Array,
  rows: number,
  dimensions: number,
  vector: Float32Array,
  output: Float32Array
): void {
  output.fill(0);
  for (let row = 0; row < rows; row += 1) {
    const offset = row * dimensions;
    let projection = 0;
    let index = 0;
    for (; index + 3 < dimensions; index += 4) {
      projection += centered[offset + index] * vector[index]
        + centered[offset + index + 1] * vector[index + 1]
        + centered[offset + index + 2] * vector[index + 2]
        + centered[offset + index + 3] * vector[index + 3];
    }
    for (; index < dimensions; index += 1) projection += centered[offset + index] * vector[index];
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      output[dimension] += centered[offset + dimension] * projection;
    }
  }
  const inverseRows = 1 / Math.max(1, rows);
  for (let index = 0; index < dimensions; index += 1) output[index] *= inverseRows;
}

function quantileAbsolute(values: Float32Array, axis: number, quantile = 0.96): number {
  const output: number[] = [];
  for (let index = axis; index < values.length; index += 3) output.push(Math.abs(values[index]));
  output.sort((a, b) => a - b);
  return output[Math.min(output.length - 1, Math.floor(output.length * quantile))] ?? 1;
}

/**
 * Deterministic matrix-free power iteration. For 1,000 x 384 vectors and three
 * components this avoids constructing a 384x384 covariance matrix and keeps the
 * work worker-friendly (~rows * dims * components * iterations).
 */
export function randomizedPca3(
  vectors: Float32Array[],
  options: { iterations?: number; dimensions?: number } = {}
): Pca3Result {
  const rows = vectors.length;
  const dimensions = options.dimensions ?? vectors[0]?.length ?? 0;
  const iterations = Math.max(3, Math.min(16, options.iterations ?? 8));
  if (!rows || dimensions < 1) {
    return {
      positions: new Float32Array(),
      components: new Float32Array(),
      mean: new Float32Array(dimensions),
      explained: new Float32Array(3),
    };
  }

  const mean = new Float32Array(dimensions);
  for (const vector of vectors) {
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      mean[dimension] += (vector[dimension] ?? 0) / rows;
    }
  }

  const centered = new Float32Array(rows * dimensions);
  let totalVariance = 0;
  for (let row = 0; row < rows; row += 1) {
    const vector = vectors[row];
    const offset = row * dimensions;
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      const value = (vector[dimension] ?? 0) - mean[dimension];
      centered[offset + dimension] = value;
      totalVariance += value * value;
    }
  }
  totalVariance /= Math.max(1, rows);

  const componentList: Float32Array[] = [];
  const explained = new Float32Array(3);
  const scratch = new Float32Array(dimensions);

  for (let componentIndex = 0; componentIndex < 3; componentIndex += 1) {
    const component = new Float32Array(dimensions);
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      component[dimension] = seededValue(dimension, componentIndex);
    }
    orthogonalize(component, componentList);
    if (!normalizeInPlace(component)) {
      if (componentIndex < dimensions) component[componentIndex] = 1;
    }

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      covarianceMultiply(centered, rows, dimensions, component, scratch);
      orthogonalize(scratch, componentList);
      if (!normalizeInPlace(scratch)) break;
      component.set(scratch);
    }

    covarianceMultiply(centered, rows, dimensions, component, scratch);
    const eigenvalue = Math.max(0, dot(component, scratch));
    explained[componentIndex] = totalVariance > 1e-12 ? eigenvalue / totalVariance : 0;
    componentList.push(component);
  }

  const positions = new Float32Array(rows * 3);
  for (let row = 0; row < rows; row += 1) {
    const offset = row * dimensions;
    for (let componentIndex = 0; componentIndex < 3; componentIndex += 1) {
      const component = componentList[componentIndex];
      let value = 0;
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        value += centered[offset + dimension] * component[dimension];
      }
      positions[row * 3 + componentIndex] = value;
    }
  }

  // Robust axis scaling avoids one outlier flattening the remaining manifold.
  for (let axis = 0; axis < 3; axis += 1) {
    const scale = Math.max(1e-6, quantileAbsolute(positions, axis));
    for (let index = axis; index < positions.length; index += 3) {
      positions[index] = Math.max(-1.15, Math.min(1.15, positions[index] / scale));
    }
  }

  const components = new Float32Array(3 * dimensions);
  for (let componentIndex = 0; componentIndex < componentList.length; componentIndex += 1) {
    components.set(componentList[componentIndex], componentIndex * dimensions);
  }

  return { positions, components, mean, explained };
}
