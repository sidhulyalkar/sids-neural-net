import assert from 'node:assert/strict';
import test from 'node:test';
import { ambientExplorationVector } from '../lib/frontier/ambientState';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, novelty: number, lane: FrontierItem['lane'] = 'ml_data'): FrontierItem {
  return {
    id,
    title: `Item ${id}`,
    summary: '',
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-21T12:00:00.000Z',
    lane,
    tags: [],
    baseScore: 0.5,
    importance: 0.5,
    novelty,
    quality: 0.7,
    momentum: 0.5,
  };
}

test('ambient exploration rises for more novel and lane-diverse recommendation surfaces', () => {
  const focused = Array.from({ length: 8 }, (_, index) => item(`focused-${index}`, 0.2, 'ml_data'));
  const exploratory = [
    item('a', 0.86, 'ml_data'),
    item('b', 0.8, 'neuro_frontier'),
    item('c', 0.82, 'creative_tech'),
    item('d', 0.78, 'gaming'),
    item('e', 0.84, 'music'),
    item('f', 0.9, 'wildcards'),
  ];

  const focusedValue = ambientExplorationVector(focused);
  const exploratoryValue = ambientExplorationVector(exploratory);
  assert.ok(focusedValue >= 0 && focusedValue <= 1);
  assert.ok(exploratoryValue >= 0 && exploratoryValue <= 1);
  assert.ok(exploratoryValue > focusedValue + 0.4);
});

test('ambient exploration has a stable quiet default for an empty surface', () => {
  assert.equal(ambientExplorationVector([]), 0.28);
});
