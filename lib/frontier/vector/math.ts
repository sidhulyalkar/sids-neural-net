export const FRONTIER_VECTOR_DIMENSION = 384;
export const FRONTIER_INTEREST_HALF_LIFE_DAYS = 7;
const DAY_MS = 86_400_000;

export function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  let index = 0;

  // Four-wide unrolling keeps the hot path friendly to modern JIT SIMD/vector
  // lowering without requiring a second numerical runtime on the main thread.
  for (; index + 3 < length; index += 4) {
    const l0 = left[index]; const r0 = right[index];
    const l1 = left[index + 1]; const r1 = right[index + 1];
    const l2 = left[index + 2]; const r2 = right[index + 2];
    const l3 = left[index + 3]; const r3 = right[index + 3];
    dot += l0 * r0 + l1 * r1 + l2 * r2 + l3 * r3;
    leftNorm += l0 * l0 + l1 * l1 + l2 * l2 + l3 * l3;
    rightNorm += r0 * r0 + r1 * r1 + r2 * r2 + r3 * r3;
  }
  for (; index < length; index += 1) {
    const l = left[index];
    const r = right[index];
    dot += l * r;
    leftNorm += l * l;
    rightNorm += r * r;
  }
  const denominator = Math.sqrt(leftNorm * rightNorm);
  return denominator > 1e-12 ? Math.max(-1, Math.min(1, dot / denominator)) : 0;
}

export function normalizeVector(input: Float32Array): Float32Array {
  let normSq = 0;
  for (let index = 0; index < input.length; index += 1) normSq += input[index] * input[index];
  const norm = Math.sqrt(normSq);
  if (norm <= 1e-12) return new Float32Array(input.length);
  const output = new Float32Array(input.length);
  const inverse = 1 / norm;
  for (let index = 0; index < input.length; index += 1) output[index] = input[index] * inverse;
  return output;
}

export function timeDecayFactor(
  previousAt: number,
  now = Date.now(),
  halfLifeDays = FRONTIER_INTEREST_HALF_LIFE_DAYS
): number {
  if (!Number.isFinite(previousAt) || previousAt <= 0 || now <= previousAt) return 1;
  const ageDays = (now - previousAt) / DAY_MS;
  return Math.pow(0.5, ageDays / Math.max(0.01, halfLifeDays));
}

export type FrontierInterestState = {
  vector: Float32Array;
  mass: number;
  updatedAt: number;
};

export function updateInterestEwma(
  current: FrontierInterestState | undefined,
  itemVector: Float32Array,
  signal: number,
  now = Date.now(),
  halfLifeDays = FRONTIER_INTEREST_HALF_LIFE_DAYS
): FrontierInterestState {
  const normalizedItem = normalizeVector(itemVector);
  const evidence = Math.min(2.5, Math.max(0.02, Math.abs(signal)));
  const direction = signal >= 0 ? 1 : -1;

  if (!current || current.vector.length !== normalizedItem.length) {
    const initial = new Float32Array(normalizedItem.length);
    for (let index = 0; index < initial.length; index += 1) initial[index] = normalizedItem[index] * direction;
    return { vector: normalizeVector(initial), mass: evidence, updatedAt: now };
  }

  const decay = timeDecayFactor(current.updatedAt, now, halfLifeDays);
  const decayedMass = Math.max(0.02, current.mass * decay);
  // EWMA alpha grows with evidence but recent accumulated evidence still has
  // inertia. Seven-day mass decay gradually re-opens the profile to new tastes.
  const alpha = Math.min(0.86, evidence / (decayedMass + evidence));
  const output = new Float32Array(current.vector.length);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = current.vector[index] * (1 - alpha) + normalizedItem[index] * direction * alpha;
  }
  return {
    vector: normalizeVector(output),
    mass: Math.min(32, decayedMass + evidence),
    updatedAt: now,
  };
}
