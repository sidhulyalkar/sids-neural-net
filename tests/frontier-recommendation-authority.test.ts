import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDailyRun } from '../lib/frontier/scoring';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-22T12:00:00.000Z',
    lane: 'wildcards',
    tags: ['frontier-test'],
    baseScore: 0.8,
    importance: 0.55,
    novelty: 0.55,
    quality: 0.8,
    momentum: 0.6,
    ...overrides,
  };
}

test('presentation media cannot preempt a higher-ranked recommendation', () => {
  const rankedWithoutMedia = [
    item('top-interest', { lane: 'must_know', importance: 0.92 }),
    item('lower-visual', { lane: 'must_know', importance: 0.86 }),
    item('builder', { lane: 'builder_signal' }),
    item('gaming', { lane: 'gaming' }),
    item('music', { lane: 'music' }),
  ];
  const rankedWithMedia = rankedWithoutMedia.map((entry) =>
    entry.id === 'lower-visual'
      ? { ...entry, media: { type: 'image' as const, url: 'https://example.com/visual.jpg' } }
      : entry
  );

  const plain = selectDailyRun(rankedWithoutMedia, {}, 5).map((entry) => entry.id);
  const visual = selectDailyRun(rankedWithMedia, {}, 5).map((entry) => entry.id);

  assert.deepEqual(visual, plain);
  assert.equal(visual[0], 'top-interest');
});

test('daily selection preserves diversity instead of flooding concentrated generic material', () => {
  const concentrated = Array.from({ length: 10 }, (_, index) => item(`samey-${index}`, {
    lane: 'wildcards',
    novelty: 0.8,
    url: `https://same-source.example/story-${index}`,
    source: 'same-source.example',
    sourceLabel: 'Same Source',
  }));

  const selected = selectDailyRun(concentrated, {}, 6);

  assert.ok(selected.length <= 2, `expected diversity guard to stop concentrated fill, saw ${selected.length}`);
  assert.equal(new Set(selected.map((entry) => entry.lane)).size, 1);
  assert.equal(new Set(selected.map((entry) => new URL(entry.url).hostname)).size, 1);
});
