import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { auditFrontierRecommendationPipeline } from '../lib/frontier/recommendationHealth';
import type { FrontierItem, FrontierLaneId } from '../lib/frontier/types';

function item(
  id: string,
  tag: string,
  overrides: Partial<FrontierItem> = {},
): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} technical signal`,
    url: `https://${id}.example/story`,
    source: `${id}.example`,
    sourceLabel: id,
    sourceKind: 'rss',
    publishedAt: '2026-08-30T19:00:00.000Z',
    lane: 'wildcards',
    tags: [tag],
    baseScore: 0.7,
    importance: 0.55,
    novelty: 0.65,
    quality: 0.82,
    momentum: 0.5,
    ...overrides,
  };
}

test('pipeline health distinguishes personalized admission loss from a ranker failure', () => {
  const profile = createInitialProfile();
  profile.topicAffinity['precision niche'] = 0.7;
  const acquired = [
    item('fit-a', 'precision niche'),
    item('fit-b', 'precision niche'),
    item('other-a', 'unrelated-a'),
    item('other-b', 'unrelated-b'),
  ];

  const health = auditFrontierRecommendationPipeline({
    acquired,
    admitted: [],
    ranked: [],
    selected: [],
  }, profile);

  assert.ok(health.warnings.includes('admission-collapse'));
  assert.ok(health.warnings.includes('personalized-admission-loss'));
  assert.ok(!health.warnings.includes('ranking-collapse'),
    'an upstream provenance collapse must not be mislabeled as a ranker collapse');
  assert.equal(health.counts.highFitAcquired, 2);
});

test('pipeline health flags selected-source concentration without inventing relevance loss', () => {
  const profile = createInitialProfile();
  const selected = Array.from({ length: 8 }, (_, index) => item(
    `selected-${index}`,
    `neutral-${index}`,
    {
      source: index < 5 ? 'dominant.example' : `source-${index}.example`,
      sourceLabel: index < 5 ? 'Dominant' : `Source ${index}`,
      lane: (index % 2 ? 'methods' : 'broad_science') as FrontierLaneId,
    },
  ));

  const health = auditFrontierRecommendationPipeline({
    acquired: selected,
    admitted: selected,
    ranked: selected,
    selected,
  }, profile);

  assert.ok(health.warnings.includes('source-concentration'));
  assert.ok(!health.warnings.includes('selection-collapse'));
  assert.equal(health.diversity.sources, 4);
  assert.equal(health.diversity.maxSourceShare, 5 / 8);
});

test('healthy diverse supply produces no structural warning', () => {
  const profile = createInitialProfile();
  profile.topicAffinity['deep niche'] = 0.55;
  const lanes: FrontierLaneId[] = ['methods', 'broad_science', 'builder_signal', 'creative_tech', 'neuro_frontier', 'ml_data'];
  const acquired = Array.from({ length: 8 }, (_, index) => item(
    `healthy-${index}`,
    index < 3 ? 'deep niche' : `neutral-${index}`,
    { lane: lanes[index % lanes.length] },
  ));
  const admitted = acquired.slice(0, 7);
  const ranked = admitted;
  const selected = admitted.slice(0, 6);

  const health = auditFrontierRecommendationPipeline({ acquired, admitted, ranked, selected }, profile);

  assert.deepEqual(health.warnings, []);
  assert.ok(health.rates.admission > 0.8);
  assert.ok(health.rates.highFitAdmission >= 2 / 3);
  assert.ok(health.diversity.lanes >= 5);
});
