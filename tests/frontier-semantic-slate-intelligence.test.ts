import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diversifyFrontierSlate,
  frontierExplorationOpportunity,
  type FrontierAntiStalenessScore,
} from '../lib/frontier/vector/antiStalenessReranker';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://${id}.example.com/story`,
    source: `${id}.example.com`,
    sourceLabel: id,
    sourceKind: 'rss',
    publishedAt: '2026-08-27T08:00:00.000Z',
    lane: 'ml_data',
    tags: [id, 'machine learning'],
    baseScore: 0.76,
    importance: 0.72,
    novelty: 0.74,
    quality: 0.9,
    momentum: 0.5,
    ...overrides,
  };
}

function scored(candidate: FrontierItem, finalScore: number): FrontierAntiStalenessScore {
  return {
    item: candidate,
    baseline: finalScore,
    exploration: 0,
    semanticDistance: 0.3,
    repetitionPenalty: 0,
    avoidPenalty: 0,
    finalScore,
  };
}

test('normal exploration values a strong nearby boundary more than distant low-quality noise', () => {
  const useful = item('useful', { quality: 0.99, importance: 0.9, novelty: 0.92, baseScore: 0.9 });
  const noise = item('noise', { quality: 0.5, importance: 0.3, novelty: 1, baseScore: 0.42 });
  const usefulValue = frontierExplorationOpportunity(useful, 0.31, 0.08);
  const noiseValue = frontierExplorationOpportunity(noise, 0.95, 0.08);
  assert.ok(usefulValue > noiseValue * 5, `boundary discovery did not dominate noise: ${usefulValue} vs ${noiseValue}`);
});

test('manual exploration moves the target outward without rewarding maximum semantic distance', () => {
  const candidate = item('manual', { quality: 0.96, importance: 0.82, novelty: 0.9, baseScore: 0.86 });
  const mediumFar = frontierExplorationOpportunity(candidate, 0.53, 0.82);
  const extremeFar = frontierExplorationOpportunity(candidate, 0.98, 0.82);
  assert.ok(mediumFar > extremeFar * 2, `manual exploration still favored maximal distance: ${mediumFar} vs ${extremeFar}`);
});

test('slate diversification protects the anchor and promotes a distinct high-quality neighbor over a near-duplicate', () => {
  const anchor = item('anchor', {
    url: 'https://same.example/a',
    source: 'same.example',
    lane: 'neuro_frontier',
    tags: ['neuroai', 'representation learning'],
  });
  const duplicate = item('duplicate', {
    url: 'https://same.example/b',
    source: 'same.example',
    lane: 'neuro_frontier',
    tags: ['neuroai', 'representation learning'],
  });
  const diverse = item('diverse', {
    url: 'https://different.example/c',
    source: 'different.example',
    lane: 'creative_tech',
    tags: ['webgpu', 'game simulation'],
  });
  const another = item('another', {
    url: 'https://another.example/d',
    source: 'another.example',
    lane: 'sports',
    tags: ['sports analytics', 'player tracking'],
  });
  const vectors = new Map<string, Float32Array>([
    [anchor.id, Float32Array.from([1, 0])],
    [duplicate.id, Float32Array.from([1, 0])],
    [diverse.id, Float32Array.from([0, 1])],
    [another.id, Float32Array.from([-0.2, 0.98])],
  ]);
  const output = diversifyFrontierSlate([
    scored(anchor, 0.9),
    scored(duplicate, 0.85),
    scored(diverse, 0.84),
    scored(another, 0.8),
  ], vectors, 1, 1);

  assert.equal(output[0].item.id, 'anchor', 'the protected recommendation anchor moved');
  assert.equal(output[1].item.id, 'diverse', 'semantic MMR did not break the immediate duplicate cluster');
  assert.equal(new Set(output.map((entry) => entry.item.id)).size, 4, 'slate diversification lost or duplicated candidates');
});
