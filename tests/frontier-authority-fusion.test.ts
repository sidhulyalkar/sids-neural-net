import assert from 'node:assert/strict';
import test from 'node:test';
import { hybridFrontierScores, rerankFrontierItems } from '../lib/frontier/vector/ranker';
import type { FrontierItem } from '../lib/frontier/types';

const NOW = new Date('2026-08-29T21:00:00.000Z').getTime();

function item(id: string, title: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title,
    summary: title,
    url: `https://github.com/example/${id}`,
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-29T20:00:00.000Z',
    lane: 'builder_signal',
    tags: ['open source'],
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.5,
    ...overrides,
  };
}

test('semantic reranking refines but does not casually overturn a strong upstream policy order', () => {
  const preferred = item('preferred', 'Preferred integrated-interest result');
  const latentFavorite = item('latent', 'Semantically perfect but lower policy candidate');
  const vectors = new Map<string, Float32Array>([
    [preferred.id, new Float32Array([-1, 0, 0])],
    [latentFavorite.id, new Float32Array([1, 0, 0])],
  ]);
  const interest = new Float32Array([1, 0, 0]);

  const scores = hybridFrontierScores([preferred, latentFavorite], vectors, interest, '', NOW);
  assert.equal(scores[0].authority, 1);
  assert.equal(scores[1].authority, 0);
  assert.ok(scores[0].score > scores[1].score,
    'the latent layer must remain a residual when the user has not issued a new query');

  const ranked = rerankFrontierItems([preferred, latentFavorite], vectors, interest, '', 0, NOW);
  assert.equal(ranked[0].id, preferred.id);
});

test('an explicit search deliberately relaxes policy authority so direct query intent can reorder', () => {
  const preferred = item('preferred', 'General recommendation');
  const queryMatch = item('query', 'rock climbing biomechanics visualization toolkit', {
    tags: ['rock climbing', 'biomechanics', 'visualization'],
  });
  const vectors = new Map<string, Float32Array>([
    [preferred.id, new Float32Array([-1, 0, 0])],
    [queryMatch.id, new Float32Array([1, 0, 0])],
  ]);
  const interest = new Float32Array([1, 0, 0]);

  const ranked = rerankFrontierItems(
    [preferred, queryMatch],
    vectors,
    interest,
    'rock climbing biomechanics',
    0,
    NOW,
  );
  assert.equal(ranked[0].id, queryMatch.id);
});

test('explicit avoid authority can still override a high upstream position', () => {
  const avoided = item('avoided', 'High policy candidate matching an avoid anchor');
  const safe = item('safe', 'Safe neighboring candidate');
  const vectors = new Map<string, Float32Array>([
    [avoided.id, new Float32Array([1, 0, 0])],
    [safe.id, new Float32Array([0.8, 0.2, 0])],
  ]);
  const interest = new Float32Array([1, 0, 0]);

  const ranked = rerankFrontierItems(
    [avoided, safe],
    vectors,
    interest,
    '',
    0,
    NOW,
    undefined,
    undefined,
    (candidate) => candidate.id === avoided.id ? 0.45 : 0,
  );
  assert.equal(ranked[0].id, safe.id);
});

test('hybrid score exposes both authority and latent components for future policy logging', () => {
  const first = item('one', 'One');
  const second = item('two', 'Two');
  const vectors = new Map<string, Float32Array>([
    [first.id, new Float32Array([1, 0])],
    [second.id, new Float32Array([0, 1])],
  ]);
  const scores = hybridFrontierScores([first, second], vectors, new Float32Array([1, 0]), '', NOW);

  assert.ok(scores.every((score) => Number.isFinite(score.authority)));
  assert.ok(scores.every((score) => Number.isFinite(score.latent)));
  assert.ok(scores[0].authority > scores[1].authority);
});
