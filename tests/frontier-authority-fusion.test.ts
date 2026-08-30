import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_HARD_AVOID_PENALTY,
  FRONTIER_PASSIVE_SEMANTIC_RANK_WINDOW,
  hybridFrontierScores,
  rerankFrontierItems,
} from '../lib/frontier/vector/ranker';
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

function rankIndex(items: FrontierItem[], id: string): number {
  const index = items.findIndex((candidate) => candidate.id === id);
  assert.notEqual(index, -1, `missing ${id}`);
  return index;
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

test('passive semantic promotion is bounded independently of board length', () => {
  const items = Array.from({ length: 24 }, (_, index) => item(
    `candidate-${index}`,
    `Candidate ${index}`,
    index === 18
      ? { quality: 1, baseScore: 0.98, importance: 0.9, novelty: 0.9 }
      : {
          quality: 0.3,
          baseScore: 0.42,
          importance: 0.35,
          novelty: 0.4,
          publishedAt: '2026-06-01T00:00:00.000Z',
        },
  ));
  const vectors = new Map<string, Float32Array>(
    items.map((candidate, index) => [
      candidate.id,
      new Float32Array(index === 18 ? [1, 0, 0] : [-1, 0, 0]),
    ]),
  );
  const ranked = rerankFrontierItems(items, vectors, new Float32Array([1, 0, 0]), '', 0, NOW);

  assert.ok(
    rankIndex(ranked, 'candidate-18') >= 18 - FRONTIER_PASSIVE_SEMANTIC_RANK_WINDOW,
    'a perfect latent tail candidate must not jump across the board during passive browsing',
  );
  for (const [originalIndex, candidate] of items.entries()) {
    const displacement = Math.abs(rankIndex(ranked, candidate.id) - originalIndex);
    assert.ok(displacement <= FRONTIER_PASSIVE_SEMANTIC_RANK_WINDOW,
      `${candidate.id} moved ${displacement} positions, exceeding the passive authority window`);
  }
});

test('an explicit search bypasses the passive movement window because the query is direct intent', () => {
  const items = Array.from({ length: 20 }, (_, index) => item(
    `search-${index}`,
    index === 17 ? 'rock climbing biomechanics visualization toolkit' : `General recommendation ${index}`,
    index === 17 ? { tags: ['rock climbing', 'biomechanics', 'visualization'] } : {},
  ));
  const vectors = new Map<string, Float32Array>(
    items.map((candidate, index) => [candidate.id, new Float32Array(index === 17 ? [1, 0, 0] : [-1, 0, 0])]),
  );
  const ranked = rerankFrontierItems(
    items,
    vectors,
    new Float32Array([1, 0, 0]),
    'rock climbing biomechanics',
    0,
    NOW,
  );

  assert.equal(ranked[0].id, 'search-17');
  assert.ok(17 - rankIndex(ranked, 'search-17') > FRONTIER_PASSIVE_SEMANTIC_RANK_WINDOW);
});

test('a strong explicit avoid may demote globally instead of being protected by passive authority', () => {
  const items = Array.from({ length: 12 }, (_, index) => item(`avoid-${index}`, `Candidate ${index}`));
  const vectors = new Map<string, Float32Array>(items.map((candidate) => [candidate.id, new Float32Array([1, 0, 0])]));
  const ranked = rerankFrontierItems(
    items,
    vectors,
    new Float32Array([1, 0, 0]),
    '',
    0,
    NOW,
    undefined,
    undefined,
    (candidate) => candidate.id === 'avoid-0' ? FRONTIER_HARD_AVOID_PENALTY + 0.08 : 0,
  );

  assert.equal(ranked.at(-1)?.id, 'avoid-0');
  assert.ok(rankIndex(ranked, 'avoid-0') > FRONTIER_PASSIVE_SEMANTIC_RANK_WINDOW);
});

test('hybrid score exposes authority and latent components for decision logging', () => {
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
  assert.ok(scores.every((score) => score.latent >= 0 && score.latent <= 1));
});
