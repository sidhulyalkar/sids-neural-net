import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { buildConnectionExposureIndex, connectionPortfolioAdjustment } from '../lib/frontier/connectionPortfolio';
import { buildDiscoveryFocus } from '../lib/frontier/discoveryFocus';
import { buildPairEvidenceIndex, effectivePairAffinityForItem } from '../lib/frontier/pairEvidence';
import { rankFrontierItems, selectDailyRun } from '../lib/frontier/scoring';
import { buildSessionIntent } from '../lib/frontier/sessionIntent';
import { frontierSlateShape } from '../lib/frontier/slateEvaluation';
import { pairAffinityForItem } from '../lib/frontier/tasteLearning';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from '../lib/frontier/types';

const NOW = new Date('2026-08-29T21:00:00.000Z');

function item(
  id: string,
  title: string,
  tags: string[],
  overrides: Partial<FrontierItem> = {},
): FrontierItem {
  return {
    id,
    title,
    summary: overrides.summary ?? `${title}. Source-backed technical detail and practical context.`,
    url: overrides.url ?? `https://github.com/example/${id}`,
    source: overrides.source ?? 'github.com',
    sourceLabel: overrides.sourceLabel ?? 'GitHub',
    sourceKind: overrides.sourceKind ?? 'github',
    publishedAt: overrides.publishedAt ?? '2026-08-29T18:00:00.000Z',
    lane: overrides.lane ?? 'builder_signal',
    tags,
    baseScore: overrides.baseScore ?? 0.69,
    importance: overrides.importance ?? 0.58,
    novelty: overrides.novelty ?? 0.66,
    quality: overrides.quality ?? 0.82,
    momentum: overrides.momentum ?? 0.5,
    ...overrides,
  };
}

function historyEntry(
  source: FrontierItem,
  at: string,
  reaction?: FrontierReaction,
  overrides: Partial<FrontierHistoryEntry> = {},
): FrontierHistoryEntry {
  return {
    item: source,
    firstSeenAt: at,
    lastSeenAt: at,
    impressions: 1,
    dwellMs: reaction ? 34_000 : undefined,
    openedAt: reaction ? at : undefined,
    reaction,
    reactedAt: reaction ? at : undefined,
    resurfacedCount: 0,
    rewarded: false,
    ...overrides,
  };
}

function rankIndex(ranked: FrontierItem[], id: string): number {
  const index = ranked.findIndex((candidate) => candidate.id === id);
  assert.notEqual(index, -1, `expected ${id} in admitted ranking`);
  return index;
}

test('benchmark: a grounded integrated-interest bridge beats comparable generic trend inventory', () => {
  const profile = createInitialProfile();
  const bridge = item(
    'mtb-telemetry',
    'Open-source MTB telemetry visualizer maps GPX traces to suspension and speed data',
    ['mountain biking', 'telemetry', 'visualization', 'open source'],
  );
  const generic = item(
    'generic-ai',
    'New general-purpose AI agent framework launches',
    ['machine learning', 'agents', 'open source'],
    { baseScore: 0.72, momentum: 0.62 },
  );

  const ranked = rankFrontierItems([generic, bridge], profile, {}, NOW);
  assert.equal(ranked[0].id, bridge.id);
});

test('benchmark: current-session focus changes ordering without erasing the broader taste map', () => {
  const profile = createInitialProfile();
  const engaged = item(
    'climb-history',
    'Bouldering biomechanics and pose estimation study',
    ['rock climbing', 'bouldering', 'biomechanics', 'pose estimation', 'open source'],
  );
  const history = {
    [engaged.id]: historyEntry(engaged, '2026-08-29T20:35:00.000Z', 'love'),
  };

  const climbing = item(
    'climb-next',
    'Climbing movement analysis toolkit for sequencing dynamic moves',
    ['rock climbing', 'biomechanics', 'pose estimation', 'open source'],
  );
  const nfl = item(
    'nfl-next',
    'NFL player tracking visualization for route and separation analysis',
    ['nfl analytics', 'sports analytics', 'player tracking', 'visualization', 'open source'],
  );
  const neuro = item(
    'neuro-next',
    'Neural decoding visualization tools for large electrophysiology datasets',
    ['neuroai', 'neural decoding', 'scientific visualization', 'open source'],
    { lane: 'neuro_frontier' },
  );
  const game = item(
    'game-next',
    'WebGPU procedural physics playground for game developers',
    ['game design', 'webgpu', 'simulation', 'open source'],
    { lane: 'creative_tech' },
  );

  const withoutSession = rankFrontierItems([nfl, neuro, game, climbing], profile, {}, NOW);
  const withSession = rankFrontierItems([nfl, neuro, game, climbing], profile, history, NOW);

  assert.ok(rankIndex(withSession, climbing.id) <= rankIndex(withoutSession, climbing.id));
  assert.ok(rankIndex(withSession, climbing.id) < rankIndex(withSession, nfl.id));

  const slate = selectDailyRun(withSession, history, 4, NOW);
  const shape = frontierSlateShape(slate);
  assert.ok(shape.uniqueFamilies >= 2, 'session focus must not collapse the slate into one editorial family');
  assert.ok(shape.uniqueLanes >= 2, 'session focus must preserve broader long-term coverage when supply exists');
});

test('benchmark: newer contradictory evidence can reverse a stale positive compatibility prior end to end', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 12;
  const target = item(
    'skate-pose-target',
    'Skateboarding pose analysis for grind technique',
    ['skateboarding', 'pose estimation', 'analysis', 'open source'],
  );
  const literalPair = 'pose estimation × skateboarding';
  profile.interestPairs[literalPair] = 0.68;

  const liked = item(
    'old-skate-like',
    'Older skateboarding pose estimator',
    ['skateboarding', 'pose estimation', 'analysis', 'open source'],
  );
  const dislikedA = item(
    'new-skate-down-a',
    'Skate pose estimator update A',
    ['skateboarding', 'pose estimation', 'analysis', 'open source'],
  );
  const dislikedB = item(
    'new-skate-down-b',
    'Skate pose estimator update B',
    ['skateboarding', 'pose estimation', 'analysis', 'open source'],
  );
  const history = {
    [liked.id]: historyEntry(liked, '2026-05-01T12:00:00.000Z', 'love'),
    [dislikedA.id]: historyEntry(dislikedA, '2026-08-28T20:00:00.000Z', 'down'),
    [dislikedB.id]: historyEntry(dislikedB, '2026-08-29T18:30:00.000Z', 'hide'),
  };

  const evidence = buildPairEvidenceIndex(history, NOW);
  const legacy = pairAffinityForItem(target, profile);
  const effective = effectivePairAffinityForItem(target, legacy, evidence);
  assert.ok(legacy > 0.2);
  assert.ok(effective < 0, 'recent contradictory evidence should own the learned intersection');

  const focus = buildDiscoveryFocus(profile, undefined, 7, NOW, evidence);
  assert.ok(!focus.some((query) => query.includes('skateboarding pose estimation')),
    'rejected intersection must not spend an adaptive acquisition slot');
});

test('benchmark: repeated exact connection is taxed more than a fresh neighboring integrated bridge', () => {
  const skate = item(
    'skate-seen',
    'Skateboarding pose estimation toolkit',
    ['skateboarding', 'pose estimation', 'biomechanics', 'open source'],
  );
  const history: Record<string, FrontierHistoryEntry> = {};
  for (let index = 0; index < 5; index += 1) {
    const seen = { ...skate, id: `skate-seen-${index}`, url: `https://github.com/example/skate-${index}` };
    history[seen.id] = historyEntry(seen, `2026-08-29T${String(15 + index).padStart(2, '0')}:00:00.000Z`, undefined, {
      impressions: 2,
      dwellMs: undefined,
      openedAt: undefined,
    });
  }

  const repeated = item(
    'skate-more',
    'Another skateboarding pose estimation toolkit',
    ['skateboarding', 'pose estimation', 'biomechanics', 'open source'],
  );
  const neighbor = item(
    'climb-fresh',
    'Rock climbing biomechanics pose analysis toolkit',
    ['rock climbing', 'biomechanics', 'pose estimation', 'open source'],
  );
  const exposure = buildConnectionExposureIndex(history, NOW);
  const repeatedAdjustment = connectionPortfolioAdjustment(repeated, exposure, 0, 0);
  const neighborAdjustment = connectionPortfolioAdjustment(neighbor, exposure, 0, 0);

  assert.ok(repeatedAdjustment.exposure > neighborAdjustment.exposure * 2);
  assert.ok(repeatedAdjustment.net < neighborAdjustment.net);
});

test('benchmark: global consequential information can interrupt a focused session without teaching a new taste', () => {
  const profile = createInitialProfile();
  const engaged = item(
    'game-history',
    'WebGPU game physics engine deep dive',
    ['game design', 'webgpu', 'simulation', 'open source'],
  );
  const history = {
    [engaged.id]: historyEntry(engaged, '2026-08-29T20:45:00.000Z', 'love'),
  };
  const sessionIntent = buildSessionIntent(history, NOW);
  assert.ok(sessionIntent.confidence > 0.2);

  const game = item(
    'game-current',
    'Procedural WebGPU game simulation release',
    ['game design', 'webgpu', 'simulation', 'open source'],
  );
  const consequential = item(
    'consequential',
    'Major global infrastructure vulnerability requires immediate patching',
    ['security', 'infrastructure'],
    {
      source: 'cisa.gov',
      sourceLabel: 'CISA',
      sourceKind: 'rss',
      url: 'https://www.cisa.gov/news-events/alerts/example',
      lane: 'must_know',
      baseScore: 0.92,
      importance: 0.98,
      quality: 0.98,
      momentum: 0.88,
      novelty: 0.7,
    },
  );

  const ranked = rankFrontierItems([game, consequential], profile, history, NOW);
  assert.equal(ranked[0].id, consequential.id);
  assert.equal(profile.topicAffinity.security, undefined, 'ranking an interrupt must not mutate durable taste');
});
