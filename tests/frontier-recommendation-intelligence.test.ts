import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregatePreference,
  applyBehaviorEvent,
  behavioralExplorationBonus,
  createInitialBehaviorModel,
  startBehaviorSession,
} from '../lib/frontier/behavior';
import type { FrontierBehaviorAggregate, FrontierItem } from '../lib/frontier/types';
import {
  applyEpsilonGreedyExploration,
  frontierFreshnessHalfLifeDays,
  freshnessDecay,
  type FrontierHybridScore,
} from '../lib/frontier/vector/ranker';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-26T12:00:00.000Z',
    lane: 'ml_data',
    tags: ['machine learning', id],
    baseScore: 0.72,
    importance: 0.68,
    novelty: 0.7,
    quality: 0.88,
    momentum: 0.55,
    ...overrides,
  };
}

function aggregate(overrides: Partial<FrontierBehaviorAggregate>): FrontierBehaviorAggregate {
  return {
    shown: 0,
    dwelled: 0,
    expanded: 0,
    opened: 0,
    saved: 0,
    positive: 0,
    negative: 0,
    dwellMs: 0,
    lastAt: '2026-08-27T09:00:00.000Z',
    ...overrides,
  };
}

test('sparse positive behavior remains lower confidence than repeated validated preference', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');
  const sparse = aggregatePreference(aggregate({ shown: 2, opened: 1, positive: 1 }), now);
  const mature = aggregatePreference(aggregate({
    shown: 36,
    dwelled: 14,
    expanded: 7,
    opened: 9,
    saved: 4,
    positive: 6,
    dwellMs: 240_000,
  }), now);

  assert.ok(sparse.score > 0, 'a real positive interaction should still point in the correct direction');
  assert.ok(sparse.confidence < 0.5, `sparse evidence became overconfident: ${sparse.confidence}`);
  assert.ok(mature.confidence > sparse.confidence + 0.35, 'repeated preference should earn materially more confidence');
  assert.ok(mature.score > 0.65, 'mature repeated preference should remain strongly positive');
});

test('quiet skips become mild negative evidence only after repeated opportunities', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');
  const early = aggregatePreference(aggregate({ shown: 8 }), now);
  const repeated = aggregatePreference(aggregate({ shown: 24 }), now);

  assert.ok(early.score >= 0, 'eight passive impressions should not punish a topic');
  assert.ok(repeated.score < 0, 'many unresolved impressions should eventually register as weak disinterest');
  assert.ok(repeated.score > -0.35, `passive skipping became too punitive: ${repeated.score}`);
});

test('explicit enthusiasm outweighs passive skipping', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');
  const preference = aggregatePreference(aggregate({
    shown: 24,
    dwelled: 8,
    expanded: 4,
    opened: 6,
    saved: 3,
    positive: 4,
    dwellMs: 150_000,
  }), now);

  assert.ok(preference.score > 0.6, `explicit preference was drowned by quiet exposures: ${preference.score}`);
  assert.ok(preference.confidence > 0.8, 'repeated explicit preference should be high-confidence');
});

test('information-gain exploration favors strong uncertain candidates over weak random noise', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');
  let model = createInitialBehaviorModel();
  const familiar = item('familiar', { tags: ['machine learning', 'representation learning'] });
  for (let index = 0; index < 18; index += 1) {
    model = applyBehaviorEvent(model, familiar, { kind: 'impression' }, new Date(now.getTime() - (18 - index) * 60_000));
    if (index % 3 === 0) model = applyBehaviorEvent(model, familiar, { kind: 'open' }, new Date(now.getTime() - (18 - index) * 60_000 + 1));
  }
  model = startBehaviorSession(model, now);

  const strongUnknown = item('strong-unknown', {
    lane: 'creative_tech',
    tags: ['world models', 'game simulation'],
    quality: 0.98,
    importance: 0.88,
    baseScore: 0.9,
    novelty: 0.94,
  });
  const weakUnknown = item('weak-unknown', {
    lane: 'creative_tech',
    tags: ['random novelty'],
    quality: 0.42,
    importance: 0.35,
    baseScore: 0.38,
    novelty: 0.94,
  });

  const strongBonus = behavioralExplorationBonus(strongUnknown, model, now);
  const weakBonus = behavioralExplorationBonus(weakUnknown, model, now);
  assert.ok(strongBonus > weakBonus * 1.7, `high-quality uncertainty was not favored: ${strongBonus} vs ${weakBonus}`);
  assert.ok(strongBonus <= 0.045, 'exploration must remain a bounded secondary signal');
});

test('freshness decays on the clock of the information class', () => {
  const now = Date.UTC(2026, 7, 27, 12);
  const publishedAt = new Date(now - 5 * 86_400_000).toISOString();
  const paper = item('paper', { publishedAt, lane: 'neuro_frontier', sourceKind: 'openalex' });
  const live = item('live', { publishedAt, lane: 'sports', sourceKind: 'sports_state' });

  assert.ok(frontierFreshnessHalfLifeDays(paper) > frontierFreshnessHalfLifeDays(live) * 10);
  const paperFreshness = freshnessDecay(publishedAt, now, frontierFreshnessHalfLifeDays(paper));
  const liveFreshness = freshnessDecay(publishedAt, now, frontierFreshnessHalfLifeDays(live));
  assert.ok(paperFreshness > 0.7, `durable research decayed too quickly: ${paperFreshness}`);
  assert.ok(liveFreshness < 0.01, `stale live state retained too much freshness: ${liveFreshness}`);
});

function hybrid(id: string, score: number, semantic: number, overrides: Partial<FrontierItem> = {}): FrontierHybridScore {
  const candidate = item(id, overrides);
  return {
    item: candidate,
    score,
    semantic,
    freshness: 0.8,
    credibility: candidate.quality,
    bm25: 0,
    avoidPenalty: 0,
    exploration: false,
  };
}

test('semantic exploration probes the useful boundary instead of a low-quality distant outlier', () => {
  const ranked: FrontierHybridScore[] = [
    hybrid('top-1', 0.96, 0.95),
    hybrid('top-2', 0.94, 0.92),
    hybrid('top-3', 0.92, 0.9),
    hybrid('top-4', 0.9, 0.88),
    hybrid('ordinary-1', 0.79, 0.76),
    hybrid('ordinary-2', 0.77, 0.73),
    hybrid('useful-boundary', 0.69, 0.58, { quality: 0.98, importance: 0.9, baseScore: 0.9, novelty: 0.95 }),
    hybrid('distant-noise', 0.66, 0.08, { quality: 0.58, importance: 0.3, baseScore: 0.44, novelty: 1 }),
    hybrid('ordinary-3', 0.65, 0.7),
    hybrid('ordinary-4', 0.64, 0.68),
    hybrid('ordinary-5', 0.63, 0.66),
    hybrid('ordinary-6', 0.62, 0.64),
  ];

  const output = applyEpsilonGreedyExploration(ranked, 0.2, '2026-08-27');
  assert.deepEqual(output.slice(0, 4).map((entry) => entry.item.id), ['top-1', 'top-2', 'top-3', 'top-4']);
  const probes = output.filter((entry) => entry.exploration).map((entry) => entry.item.id);
  assert.ok(probes.includes('useful-boundary'), `expected useful boundary probe, got ${probes.join(', ')}`);
  assert.ok(!probes.includes('distant-noise'), 'low-quality semantic distance must not masquerade as useful exploration');
  assert.ok(probes.length <= 3, 'exploration budget must remain bounded');
});
