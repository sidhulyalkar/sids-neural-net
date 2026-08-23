import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dequantizeFrontierVector,
  quantizeFrontierVector,
  rankFrontierChunkManifests,
  type FrontierChunkManifest,
  type FrontierChunkVector,
} from '../lib/frontier/vector/chunkedVectorStore';
import { cosineSimilarity, normalizeVector } from '../lib/frontier/vector/math';
import { projectEmbeddingToSequence } from '../lib/frontier/vector/sequenceModel';
import {
  FloatRingBuffer,
  FrontierSignalLoadEstimator,
  modulateImplicitSignalWeight,
} from '../lib/frontier/signals/signalProcessing';
import {
  createFrontierMeshState,
  incrementPnCounter,
  mergeFrontierMeshState,
  mergePnCounter,
  pnCounterValue,
  withChunkRegister,
  withEngagementDelta,
} from '../lib/frontier/sync/meshSync';
import { decodeMeshVectorChunk, encodeMeshVectorChunk } from '../lib/frontier/sync/meshChunkCodec';

function basis(index: number, dimension = 384): Float32Array {
  const vector = new Float32Array(dimension);
  vector[index] = 1;
  return vector;
}

test('int8 cold-vector quantization preserves semantic direction', () => {
  const source = new Float32Array(384);
  for (let index = 0; index < source.length; index += 1) source[index] = Math.sin(index * 0.37) + Math.cos(index * 0.11) * 0.4;
  const normalized = normalizeVector(source);
  const restored = dequantizeFrontierVector(quantizeFrontierVector(normalized));
  assert.equal(restored.length, 384);
  assert.ok(cosineSimilarity(normalized, restored) > 0.9999);
});

test('chunk manifest retrieval selects the semantic neighborhood nearest the active trajectory', () => {
  const target = basis(0);
  const near = normalizeVector(projectEmbeddingToSequence(target, 64));
  const far = normalizeVector(projectEmbeddingToSequence(basis(24), 64));
  const manifests: FrontierChunkManifest[] = [
    { chunkId: 'far', gridKey: 'g:far', count: 80, centroid: far, updatedAt: 1, lastAccessedAt: 1 },
    { chunkId: 'near', gridKey: 'g:near', count: 80, centroid: near, updatedAt: 1, lastAccessedAt: 1 },
  ];
  const ranked = rankFrontierChunkManifests(manifests, target, 1);
  assert.equal(ranked[0]?.chunkId, 'near');
});

test('ring buffer remains bounded and preserves newest samples in order', () => {
  const ring = new FloatRingBuffer(4);
  ring.pushMany([1, 2, 3, 4, 5, 6]);
  assert.equal(ring.length, 4);
  assert.deepEqual(Array.from(ring.snapshot()), [3, 4, 5, 6]);
});

test('signal load estimator stays finite and bounded under long noisy streams', () => {
  const estimator = new FrontierSignalLoadEstimator(128);
  let features = estimator.push(Float32Array.from({ length: 128 }, (_, index) => Math.sin(index * 0.02)));
  for (let pass = 0; pass < 80; pass += 1) {
    const samples = Float32Array.from({ length: 32 }, (_, index) => Math.sin((pass * 32 + index) * 0.9) * (1 + (pass % 5) * 0.4));
    features = estimator.push(samples);
  }
  assert.ok(Number.isFinite(features.load));
  assert.ok(features.load >= 0 && features.load <= 1);
  assert.ok(features.sampleCount <= 128);
});

test('physiological load only attenuates positive implicit sequence evidence', () => {
  assert.ok(Math.abs(modulateImplicitSignalWeight(1, 1, false) - 0.55) < 1e-9);
  assert.equal(modulateImplicitSignalWeight(-1.5, 1, false), -1.5);
  assert.equal(modulateImplicitSignalWeight(1, 1, true), 1);
});

test('PN-counter merge is commutative, idempotent, and retains concurrent positive and negative evidence', () => {
  const left = incrementPnCounter(incrementPnCounter({ positive: {}, negative: {} }, 'desktop', 2), 'desktop', -0.5);
  const right = incrementPnCounter(incrementPnCounter({ positive: {}, negative: {} }, 'mobile', 1.25), 'mobile', -0.25);
  const lr = mergePnCounter(left, right);
  const rl = mergePnCounter(right, left);
  assert.deepEqual(lr, rl);
  assert.deepEqual(mergePnCounter(lr, lr), lr);
  assert.ok(Math.abs(pnCounterValue(lr) - 2.5) < 1e-9);
});

test('mesh state merge converges for concurrent chunk and engagement updates', () => {
  let desktop = createFrontierMeshState('desktop');
  let mobile = createFrontierMeshState('mobile');
  desktop = withEngagementDelta(desktop, 'paper-1', 1);
  mobile = withEngagementDelta(mobile, 'paper-1', -0.5);
  desktop = withChunkRegister(desktop, { chunkId: 'g:1:p:0', hash: 'aaa', count: 96, updatedAt: 10 });
  mobile = withChunkRegister(mobile, { chunkId: 'g:2:p:0', hash: 'bbb', count: 24, updatedAt: 11 });

  const mergedDesktop = mergeFrontierMeshState(desktop, mobile);
  const mergedMobile = mergeFrontierMeshState(mobile, desktop);
  assert.equal(pnCounterValue(mergedDesktop.engagements['paper-1']), 0.5);
  assert.equal(pnCounterValue(mergedMobile.engagements['paper-1']), 0.5);
  assert.deepEqual(Object.keys(mergedDesktop.chunks).sort(), ['g:1:p:0', 'g:2:p:0']);
  assert.deepEqual(Object.keys(mergedMobile.chunks).sort(), ['g:1:p:0', 'g:2:p:0']);

  const again = mergeFrontierMeshState(mergedDesktop, mergedMobile);
  assert.deepEqual(again.engagements, mergedDesktop.engagements);
  assert.deepEqual(again.chunks, mergedDesktop.chunks);
});

test('mesh vector chunk codec preserves quantized semantic neighborhoods', () => {
  const source: FrontierChunkVector = {
    id: 'memory-1',
    vector: normalizeVector(Float32Array.from({ length: 384 }, (_, index) => Math.cos(index * 0.21))),
    textHash: 'hash',
    createdAt: 10,
    lastAccessedAt: 20,
    title: 'A remembered paper',
    engagement: 1.2,
  };
  const encoded = encodeMeshVectorChunk('mesh:g:2', [source], 30);
  const decoded = decodeMeshVectorChunk(encoded);
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].id, source.id);
  assert.equal(decoded[0].title, source.title);
  assert.ok(cosineSimilarity(source.vector, decoded[0].vector) > 0.9999);
});
