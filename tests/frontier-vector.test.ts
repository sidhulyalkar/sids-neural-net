import test from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, timeDecayFactor, updateInterestEwma } from '../lib/frontier/vector/math';
import { randomizedPca3 } from '../lib/frontier/vector/pca3';
import { hybridFrontierScores } from '../lib/frontier/vector/ranker';
import {
  FRONTIER_SEQUENCE_DECAY,
  projectEmbeddingToSequence,
  updateSequenceState,
} from '../lib/frontier/vector/sequenceModel';
import { selectLruEvictions } from '../lib/frontier/vector/vectorStore';
import type { FrontierItem } from '../lib/frontier/types';

function vector(...values: number[]): Float32Array {
  return Float32Array.from(values);
}

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `Item ${id}`,
    summary: '',
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-21T12:00:00.000Z',
    lane: 'ml_data',
    tags: ['machine learning'],
    baseScore: 0.5,
    importance: 0.5,
    novelty: 0.5,
    quality: 0.8,
    momentum: 0.5,
    ...overrides,
  };
}

function norm(value: Float32Array): number {
  let sum = 0;
  for (const entry of value) sum += entry * entry;
  return Math.sqrt(sum);
}

test('cosine similarity is mathematically correct for aligned and orthogonal vectors', () => {
  assert.ok(Math.abs(cosineSimilarity(vector(1, 0), vector(1, 0)) - 1) < 1e-7);
  assert.ok(Math.abs(cosineSimilarity(vector(1, 0), vector(0, 1))) < 1e-7);
  assert.ok(Math.abs(cosineSimilarity(vector(1, 2, 3), vector(-1, -2, -3)) + 1) < 1e-7);
});

test('seven-day preference half-life decays old evidence by one half', () => {
  const start = Date.UTC(2026, 7, 1);
  const sevenDays = 7 * 86_400_000;
  assert.ok(Math.abs(timeDecayFactor(start, start + sevenDays, 7) - 0.5) < 1e-10);
});

test('EWMA preference update moves toward positive evidence and away from negative evidence', () => {
  const now = Date.UTC(2026, 7, 21);
  const positive = updateInterestEwma(undefined, vector(1, 0), 1, now);
  assert.ok(positive.vector[0] > 0.99);
  assert.ok(Math.abs(positive.vector[1]) < 1e-7);

  const diversified = updateInterestEwma(positive, vector(0, 1), 0.8, now + 1_000);
  assert.ok(diversified.vector[0] > 0);
  assert.ok(diversified.vector[1] > 0);

  const negative = updateInterestEwma(diversified, vector(0, 1), -1.5, now + 2_000);
  assert.ok(negative.vector[1] < diversified.vector[1]);
  assert.ok(negative.updatedAt === now + 2_000);
});

test('sequence model obeys x[k+1] = 0.85 x[k] + B(wu) and returns a normalized target', () => {
  const input = new Float32Array(384);
  input[0] = 0.8;
  input[19] = -0.35;
  input[201] = 0.48;
  const projected = projectEmbeddingToSequence(input);
  const first = updateSequenceState(undefined, input, 1, 1_000);
  const second = updateSequenceState(first, input, 1, 2_000);

  for (let index = 0; index < second.state.length; index += 1) {
    const expected = first.state[index] * FRONTIER_SEQUENCE_DECAY + projected[index] * 0.38;
    assert.ok(Math.abs(second.state[index] - expected) < 1e-6);
  }
  assert.equal(second.interactions, 2);
  assert.equal(second.updatedAt, 2_000);
  assert.ok(Math.abs(norm(second.target) - 1) < 1e-5);
});

test('negative sequence evidence pushes the recurrent context away from the interacted projection', () => {
  const input = new Float32Array(384);
  input[4] = 1;
  input[88] = 0.4;
  const projected = projectEmbeddingToSequence(input);
  const positive = updateSequenceState(undefined, input, 1.2, 1_000);
  const before = cosineSimilarity(positive.state, projected);
  const negative = updateSequenceState(positive, input, -1.5, 2_000);
  const after = cosineSimilarity(negative.state, projected);
  assert.ok(after < before);
});

test('randomized PCA recovers a three-dimensional dominant manifold off a higher-dimensional input', () => {
  const vectors: Float32Array[] = [];
  for (let index = 0; index < 180; index += 1) {
    const t = (index - 90) / 45;
    const sample = new Float32Array(8);
    sample[0] = t * 4.5;
    sample[1] = Math.sin(index * 0.23) * 2.4;
    sample[2] = Math.cos(index * 0.17) * 1.25;
    sample[3] = Math.sin(index * 0.71) * 0.025;
    sample[4] = Math.cos(index * 0.61) * 0.02;
    vectors.push(sample);
  }
  const result = randomizedPca3(vectors, { dimensions: 8, iterations: 12 });
  assert.equal(result.positions.length, vectors.length * 3);
  assert.equal(result.components.length, 24);
  const explained = result.explained[0] + result.explained[1] + result.explained[2];
  assert.ok(explained > 0.98, `expected >98% explained variance, got ${explained}`);
  for (const coordinate of result.positions) assert.ok(Number.isFinite(coordinate) && Math.abs(coordinate) <= 1.151);
});

test('LRU eviction removes oldest active vectors and respects deterministic ties', () => {
  const records = [
    { id: 'new', lastAccessedAt: 40 },
    { id: 'old-b', lastAccessedAt: 10 },
    { id: 'middle', lastAccessedAt: 30 },
    { id: 'old-a', lastAccessedAt: 10 },
    { id: 'recent', lastAccessedAt: 50 },
  ];
  assert.deepEqual(selectLruEvictions(records, 3), ['old-a', 'old-b']);
  assert.deepEqual(selectLruEvictions(records, 5), []);
});

test('hybrid ranker obeys the 0.4 semantic + 0.3 fresh + 0.2 credibility + 0.1 BM25 contract', () => {
  const now = Date.UTC(2026, 7, 21, 12);
  const candidate = item('a', {
    title: 'Neural decoding benchmark',
    publishedAt: new Date(now).toISOString(),
    quality: 1,
  });
  const scores = hybridFrontierScores(
    [candidate],
    new Map([[candidate.id, vector(1, 0)]]),
    vector(1, 0),
    'neural decoding',
    now
  );
  assert.equal(scores.length, 1);
  assert.ok(Math.abs(scores[0].semantic - 1) < 1e-7);
  assert.ok(Math.abs(scores[0].freshness - 1) < 1e-7);
  assert.ok(Math.abs(scores[0].credibility - 1) < 1e-7);
  assert.ok(Math.abs(scores[0].bm25 - 1) < 1e-7);
  assert.ok(Math.abs(scores[0].score - 1) < 1e-7);
});
