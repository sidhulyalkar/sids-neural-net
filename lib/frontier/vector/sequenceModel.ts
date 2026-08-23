import { FRONTIER_VECTOR_DIMENSION, normalizeVector } from './math';

export const FRONTIER_SEQUENCE_DIMENSION = 64;
export const FRONTIER_SEQUENCE_DECAY = 0.85;
const INPUT_GAIN = 0.38;
const IDLE_DECAY_STEP_MS = 2 * 60 * 60_000;
const CONTEXT_RESET_MS = 12 * 60 * 60_000;

export type FrontierSequenceState = {
  state: Float32Array;
  target: Float32Array;
  updatedAt: number;
  /** Number of interactions in the current momentum context, not lifetime history. */
  interactions: number;
};

function projectionSign(inputIndex: number, latentIndex: number): number {
  let value = Math.imul(inputIndex + 1, 0x45d9f3b) ^ Math.imul(latentIndex + 17, 0x27d4eb2d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value & 1) === 0 ? 1 : -1;
}

/**
 * Implicit Achlioptas-style random projection B without storing a 64x384 matrix.
 * The deterministic signs make the model stable across browser sessions.
 */
export function projectEmbeddingToSequence(
  vector: Float32Array,
  latentDimension = FRONTIER_SEQUENCE_DIMENSION
): Float32Array {
  const output = new Float32Array(latentDimension);
  const scale = 1 / Math.sqrt(Math.max(1, vector.length));
  for (let latent = 0; latent < latentDimension; latent += 1) {
    let sum = 0;
    for (let input = 0; input < vector.length; input += 1) {
      sum += projectionSign(input, latent) * vector[input];
    }
    output[latent] = sum * scale;
  }
  return output;
}

/** C ~= B^T maps the recurrent context state back into embedding space. */
export function reconstructSequenceTarget(
  state: Float32Array,
  outputDimension = FRONTIER_VECTOR_DIMENSION
): Float32Array {
  const output = new Float32Array(outputDimension);
  const scale = 1 / Math.sqrt(Math.max(1, state.length));
  for (let input = 0; input < outputDimension; input += 1) {
    let sum = 0;
    for (let latent = 0; latent < state.length; latent += 1) {
      sum += projectionSign(input, latent) * state[latent];
    }
    output[input] = sum * scale;
  }
  return normalizeVector(output);
}

export function emptySequenceState(now = Date.now()): FrontierSequenceState {
  const state = new Float32Array(FRONTIER_SEQUENCE_DIMENSION);
  return {
    state,
    target: new Float32Array(FRONTIER_VECTOR_DIMENSION),
    updatedAt: now,
    interactions: 0,
  };
}

/**
 * x[k+1] = A x[k] + B (w u[k]) where A = 0.85 I per interaction.
 * Additional powers of A are applied after long idle gaps so yesterday's
 * reading context cannot dominate a new session indefinitely.
 */
export function updateSequenceState(
  current: FrontierSequenceState | undefined,
  itemVector: Float32Array,
  weight: number,
  now = Date.now(),
  decay = FRONTIER_SEQUENCE_DECAY
): FrontierSequenceState {
  const previous = current?.state.length === FRONTIER_SEQUENCE_DIMENSION
    ? current.state
    : new Float32Array(FRONTIER_SEQUENCE_DIMENSION);
  const projected = projectEmbeddingToSequence(itemVector);
  const next = new Float32Array(FRONTIER_SEQUENCE_DIMENSION);
  const boundedWeight = Math.max(-2, Math.min(1.5, weight));
  const idleMs = current ? Math.max(0, now - current.updatedAt) : 0;
  const idleSteps = Math.min(8, Math.floor(idleMs / IDLE_DECAY_STEP_MS));
  const effectiveDecay = Math.pow(decay, 1 + idleSteps);

  for (let index = 0; index < next.length; index += 1) {
    next[index] = previous[index] * effectiveDecay + projected[index] * boundedWeight * INPUT_GAIN;
  }

  // Keep pathological repeated signals bounded while retaining direction.
  let normSquared = 0;
  for (let index = 0; index < next.length; index += 1) normSquared += next[index] * next[index];
  const norm = Math.sqrt(normSquared);
  if (norm > 4) {
    const rescale = 4 / norm;
    for (let index = 0; index < next.length; index += 1) next[index] *= rescale;
  }

  return {
    state: next,
    target: reconstructSequenceTarget(next),
    updatedAt: now,
    interactions: idleMs >= CONTEXT_RESET_MS ? 1 : (current?.interactions ?? 0) + 1,
  };
}

export function blendSequenceWithLongTerm(
  sequenceTarget: Float32Array | undefined,
  longTerm: Float32Array | undefined,
  sequenceInteractions = 0
): Float32Array | undefined {
  if (!sequenceTarget?.length) return longTerm;
  if (!longTerm?.length || sequenceInteractions >= 4) return sequenceTarget;
  const alpha = Math.max(0.35, Math.min(0.8, 0.2 + sequenceInteractions * 0.15));
  const output = new Float32Array(Math.min(sequenceTarget.length, longTerm.length));
  for (let index = 0; index < output.length; index += 1) {
    output[index] = sequenceTarget[index] * alpha + longTerm[index] * (1 - alpha);
  }
  return normalizeVector(output);
}
