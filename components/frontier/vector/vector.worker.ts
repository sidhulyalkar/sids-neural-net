/// <reference lib="webworker" />

import { FRONTIER_VECTOR_DIMENSION, normalizeVector } from '@/lib/frontier/vector/math';

const TRANSFORMERS_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type EmbedInput = { id: string; text: string };
type EmbedRequest = { type: 'embed'; requestId: string; items: EmbedInput[] };
type WarmRequest = { type: 'warm'; requestId: string };
type WorkerRequest = EmbedRequest | WarmRequest;

type FeatureTensor = {
  data?: Float32Array | number[];
  dims?: number[];
  tolist?: () => unknown;
};

type FeatureExtractor = (
  input: string | string[],
  options?: { pooling?: 'mean'; normalize?: boolean }
) => Promise<FeatureTensor | FeatureTensor[]>;

type TransformersModule = {
  pipeline: (
    task: 'feature-extraction',
    model: string,
    options?: Record<string, unknown>
  ) => Promise<FeatureExtractor>;
  env?: {
    allowRemoteModels?: boolean;
    useBrowserCache?: boolean;
  };
};

type EmbedResponse = {
  type: 'embedded';
  requestId: string;
  backend: 'minilm' | 'feature-hash';
  vectors: Array<{ id: string; buffer: ArrayBuffer }>;
};

type ReadyResponse = {
  type: 'ready';
  requestId: string;
  backend: 'minilm' | 'feature-hash';
};

type ErrorResponse = {
  type: 'error';
  requestId: string;
  message: string;
};

let extractorPromise: Promise<FeatureExtractor | undefined> | undefined;
let backend: 'minilm' | 'feature-hash' = 'feature-hash';
let queue = Promise.resolve();

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function featureHashEmbedding(text: string): Float32Array {
  const vector = new Float32Array(FRONTIER_VECTOR_DIMENSION);
  const tokens = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9+#.-]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 420);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const unigram = stableHash(token);
    const signedIndex = unigram % FRONTIER_VECTOR_DIMENSION;
    vector[signedIndex] += (unigram & 1) === 0 ? 1 : -1;
    if (index + 1 < tokens.length) {
      const bigram = stableHash(`${token}\u0000${tokens[index + 1]}`);
      vector[bigram % FRONTIER_VECTOR_DIMENSION] += (bigram & 1) === 0 ? 0.55 : -0.55;
    }
  }
  return normalizeVector(vector);
}

async function loadExtractor(): Promise<FeatureExtractor | undefined> {
  if (extractorPromise) return extractorPromise;
  extractorPromise = (async () => {
    try {
      const moduleUrl: string = TRANSFORMERS_MODULE_URL;
      const transformers = await import(/* webpackIgnore: true */ moduleUrl) as TransformersModule;
      if (transformers.env) {
        transformers.env.allowRemoteModels = true;
        transformers.env.useBrowserCache = true;
      }
      const pipe = await transformers.pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
      backend = 'minilm';
      return pipe;
    } catch {
      backend = 'feature-hash';
      return undefined;
    }
  })();
  return extractorPromise;
}

function tensorToVector(tensor: FeatureTensor): Float32Array | undefined {
  const data = tensor.data;
  if (data && data.length >= FRONTIER_VECTOR_DIMENSION) {
    const source = data instanceof Float32Array ? data : Float32Array.from(data);
    const start = Math.max(0, source.length - FRONTIER_VECTOR_DIMENSION);
    return normalizeVector(source.slice(start, start + FRONTIER_VECTOR_DIMENSION));
  }
  if (tensor.tolist) {
    const nested = tensor.tolist();
    const flatten = (value: unknown, output: number[]) => {
      if (typeof value === 'number') output.push(value);
      else if (Array.isArray(value)) for (const child of value) flatten(child, output);
    };
    const values: number[] = [];
    flatten(nested, values);
    if (values.length >= FRONTIER_VECTOR_DIMENSION) {
      return normalizeVector(Float32Array.from(values.slice(-FRONTIER_VECTOR_DIMENSION)));
    }
  }
  return undefined;
}

async function miniLmEmbedding(extractor: FeatureExtractor, text: string): Promise<Float32Array> {
  const output = await extractor(text.slice(0, 3_500), { pooling: 'mean', normalize: true });
  const tensor = Array.isArray(output) ? output[0] : output;
  const vector = tensorToVector(tensor);
  if (!vector) throw new Error('MiniLM returned an unreadable vector');
  return vector;
}

async function embedBatch(inputs: EmbedInput[]): Promise<{ backend: 'minilm' | 'feature-hash'; vectors: Float32Array[] }> {
  const extractor = await loadExtractor();
  if (!extractor) {
    backend = 'feature-hash';
    return { backend, vectors: inputs.map((input) => featureHashEmbedding(input.text)) };
  }

  try {
    const vectors: Float32Array[] = [];
    for (const input of inputs) vectors.push(await miniLmEmbedding(extractor, input.text));
    backend = 'minilm';
    return { backend, vectors };
  } catch {
    // Coordinate-space integrity is more important than partial model use. If
    // one item fails MiniLM inference, recompute the entire request in the
    // deterministic fallback space and stay there for the worker lifetime.
    backend = 'feature-hash';
    extractorPromise = Promise.resolve(undefined);
    return { backend, vectors: inputs.map((input) => featureHashEmbedding(input.text)) };
  }
}

async function handle(request: WorkerRequest): Promise<void> {
  if (request.type === 'warm') {
    await loadExtractor();
    const response: ReadyResponse = { type: 'ready', requestId: request.requestId, backend };
    self.postMessage(response);
    return;
  }

  try {
    const inputs = request.items.slice(0, 32);
    const embedded = await embedBatch(inputs);
    const vectors: Array<{ id: string; buffer: ArrayBuffer }> = [];
    const transfers: Transferable[] = [];
    for (let index = 0; index < inputs.length; index += 1) {
      const buffer = embedded.vectors[index].buffer as ArrayBuffer;
      vectors.push({ id: inputs[index].id, buffer });
      transfers.push(buffer);
    }
    const response: EmbedResponse = { type: 'embedded', requestId: request.requestId, backend: embedded.backend, vectors };
    self.postMessage(response, { transfer: transfers });
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'vectorization failed',
    };
    self.postMessage(response);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => handle(event.data)).catch(() => undefined);
};

export {};
