import test from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, timeDecayFactor, updateInterestEwma } from '../lib/frontier/vector/math';
import { hybridFrontierScores } from '../lib/frontier/vector/ranker';
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
