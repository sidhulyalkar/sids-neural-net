import { cosineSimilarity, normalizeVector } from './math';
import { projectEmbeddingToSequence } from './sequenceModel';

export const FRONTIER_CHUNK_DB_NAME = 'frontier-vector-chunks-v1';
export const FRONTIER_CHUNK_SIZE = 96;
export const FRONTIER_CHUNK_RESIDENT_LIMIT = 8;
export const FRONTIER_CHUNK_QUERY_LIMIT = 6;
export const FRONTIER_CHUNK_COARSE_DIMENSION = 8;

export type FrontierChunkMetadata = {
  title?: string;
  sourceLabel?: string;
  lane?: string;
  publishedAt?: string;
  engagement?: number;
  lastSignalAt?: number;
};

export type QuantizedFrontierVector = {
  scale: number;
  data: Int8Array;
};

export type FrontierChunkManifest = {
  chunkId: string;
  gridKey: string;
  count: number;
  centroid: Float32Array;
  updatedAt: number;
  lastAccessedAt: number;
};

export type FrontierChunkVector = FrontierChunkMetadata & {
  id: string;
  vector: Float32Array;
  textHash: string;
  createdAt: number;
  lastAccessedAt: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Symmetric per-vector int8 quantization. Embeddings are normalized before they
 * enter FRONTIER, so a single scale value preserves cosine neighborhoods well
 * while cutting cold-storage vector bytes by roughly 4x versus Float32.
 */
export function quantizeFrontierVector(vector: Float32Array): QuantizedFrontierVector {
  let maxAbs = 0;
  for (let index = 0; index < vector.length; index += 1) {
    maxAbs = Math.max(maxAbs, Math.abs(vector[index]));
  }
  const scale = maxAbs > 1e-12 ? maxAbs / 127 : 1 / 127;
  const data = new Int8Array(vector.length);
  for (let index = 0; index < vector.length; index += 1) {
    data[index] = Math.round(clamp(vector[index] / scale, -127, 127));
  }
  return { scale, data };
}

export function dequantizeFrontierVector(encoded: QuantizedFrontierVector): Float32Array {
  const output = new Float32Array(encoded.data.length);
  for (let index = 0; index < output.length; index += 1) output[index] = encoded.data[index] * encoded.scale;
  return normalizeVector(output);
}

function coarseBin(value: number): number {
  // Random-projected normalized embeddings tend to stay close to zero. Five
  // bins retain locality without producing an enormous sparse key-space.
  if (value < -0.075) return 0;
  if (value < -0.025) return 1;
  if (value <= 0.025) return 2;
  if (value <= 0.075) return 3;
  return 4;
}

export function frontierSpatialGridKey(vector: Float32Array): string {
  const coarse = projectEmbeddingToSequence(vector, FRONTIER_CHUNK_COARSE_DIMENSION);
  const bins: number[] = [];
  for (let index = 0; index < coarse.length; index += 1) bins.push(coarseBin(coarse[index]));
  return `g:${bins.join('.')}`;
}

export function frontierChunkCentroid(vectors: Float32Array[]): Float32Array {
  if (!vectors.length) return new Float32Array(64);
  const centroid = new Float32Array(64);
  for (const vector of vectors) {
    const projected = projectEmbeddingToSequence(vector, centroid.length);
    for (let index = 0; index < centroid.length; index += 1) centroid[index] += projected[index];
  }
  const inv = 1 / vectors.length;
  for (let index = 0; index < centroid.length; index += 1) centroid[index] *= inv;
  return normalizeVector(centroid);
}

export function rankFrontierChunkManifests(
  manifests: FrontierChunkManifest[],
  targetVector: Float32Array,
  limit = FRONTIER_CHUNK_QUERY_LIMIT
): FrontierChunkManifest[] {
  if (!manifests.length || !targetVector.length || limit <= 0) return [];
  const target = normalizeVector(projectEmbeddingToSequence(targetVector, 64));
  return [...manifests]
    .map((manifest) => ({ manifest, score: cosineSimilarity(manifest.centroid, target) }))
    .sort((left, right) => right.score - left.score || right.manifest.lastAccessedAt - left.manifest.lastAccessedAt)
    .slice(0, Math.min(limit, manifests.length))
    .map(({ manifest }) => manifest);
}

export function mergeChunkNeighborhood(
  chunks: FrontierChunkVector[][],
  targetVector: Float32Array,
  limit = 192
): FrontierChunkVector[] {
  if (!targetVector.length || limit <= 0) return [];
  return chunks
    .flat()
    .map((entry) => ({ entry, score: cosineSimilarity(entry.vector, targetVector) }))
    .sort((left, right) => right.score - left.score || right.entry.lastAccessedAt - left.entry.lastAccessedAt)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function neighborhoodCentroid(entries: FrontierChunkVector[], targetVector?: Float32Array): Float32Array | undefined {
  if (!entries.length) return undefined;
  const dimension = entries[0].vector.length;
  const output = new Float32Array(dimension);
  let mass = 0;
  for (const entry of entries) {
    const similarity = targetVector?.length ? Math.max(0.05, (cosineSimilarity(entry.vector, targetVector) + 1) * 0.5) : 1;
    const engagement = clamp((entry.engagement ?? 0) * 0.08 + 1, 0.55, 1.45);
    const weight = similarity * engagement;
    mass += weight;
    for (let index = 0; index < dimension; index += 1) output[index] += entry.vector[index] * weight;
  }
  if (mass <= 1e-9) return undefined;
  for (let index = 0; index < dimension; index += 1) output[index] /= mass;
  return normalizeVector(output);
}
