import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import {
  buildDiscoveryFocus,
  FRONTIER_CONNECTION_DISCOVERY_SEEDS,
} from '../lib/frontier/discoveryFocus';
import { personalInterestConnection } from '../lib/frontier/interestGraph';
import {
  isBuilderDiscoveryFocus,
  isCrossInterestBuilderFocus,
} from '../lib/frontier/liveDiscovery';
import { personalizedScore } from '../lib/frontier/scoring';
import {
  applyExplicitPairSignal,
  canonicalTastePair,
  pairAffinityForItem,
} from '../lib/frontier/tasteLearning';
import type { FrontierItem } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: overrides.id ?? 'bridge-item',
    title: 'Street skating pose estimation toolkit',
    summary: 'Open-source computer vision and biomechanics analysis for trick progression.',
    url: 'https://github.com/example/skate-motion',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-29T12:00:00.000Z',
    lane: 'sports',
    tags: ['street skating', 'skateboarding', 'pose estimation', 'open source'],
    baseScore: 0.68,
    importance: 0.58,
    novelty: 0.72,
    quality: 0.76,
    momentum: 0.55,
    ...overrides,
  };
}

test('method applications to a concrete motion sport earn a bounded connection signal', () => {
  const connection = personalInterestConnection(item());
  assert.ok(connection.score >= 0.05);
  assert.ok(connection.score <= 0.115);
  assert.ok(connection.domains.includes('motion-sports'));
  assert.ok(connection.facets.includes('motion-science'));
  assert.ok(connection.facets.includes('open-source'));
  assert.match(connection.explanation ?? '', /Applies|Connects/);
});

test('graph-only child identities improve memory precision without inflating ranking evidence', () => {
  const skate = personalInterestConnection(item({
    id: 'bare-skate',
    title: 'Skateboarding pose estimation toolkit',
    summary: 'Open-source biomechanics toolkit.',
    tags: ['skateboarding', 'pose estimation', 'biomechanics', 'open source'],
  }));
  const broadMotion = personalInterestConnection(item({
    id: 'broad-motion',
    title: 'Longboarding pose estimation toolkit',
    summary: 'Open-source biomechanics toolkit.',
    tags: ['longboarding', 'pose estimation', 'biomechanics', 'open source'],
  }));

  assert.ok(skate.topicIds.includes('skate-progression'));
  assert.equal(skate.score, broadMotion.score,
    'splitting a broad motion-sport identity must not manufacture more bridge score');
  assert.equal(skate.confidence, broadMotion.confidence,
    'graph-only identity detail must not manufacture more evidence confidence');
});

test('true cross-domain candidates outrank same-interest synonym piles in connection depth', () => {
  const crossDomain = personalInterestConnection(item({
    id: 'game-skate',
    title: 'WebGPU street skating physics engine for procedural trick simulation',
    summary: 'Open-source game design experiment with skateboarding kinematics.',
    lane: 'creative_tech',
    tags: ['webgpu', 'game design', 'street skating', 'skateboarding', 'simulation', 'open source'],
  }));
  const synonyms = personalInterestConnection(item({
    id: 'skate-only',
    title: 'Street skating 50-50 grind and boardslide progression',
    summary: 'Skateboarding tutorial for rail and ledge technique.',
    sourceKind: 'youtube',
    url: 'https://youtube.com/watch?v=test',
    tags: ['street skating', 'skateboarding', 'trick progression', 'tutorial'],
  }));

  assert.ok(crossDomain.domains.includes('creative-systems'));
  assert.ok(crossDomain.domains.includes('motion-sports'));
  assert.ok(crossDomain.score > synonyms.score);
});

test('generic grind or infrastructure language cannot manufacture a connection', () => {
  const generic = item({
    id: 'generic',
    title: 'Linux driver team discusses the daily grind after a rail infrastructure update',
    summary: 'A municipal ledge project and electric scooter policy are also mentioned.',
    sourceKind: 'rss',
    url: 'https://example.com/generic',
    tags: [],
  });
  const connection = personalInterestConnection(generic);
  assert.equal(connection.score, 0);
  assert.deepEqual(connection.topicIds, []);
});

test('learned negative pair affinity vetoes most of the cold-start bridge bonus', () => {
  const signal = item();
  const neutral = createInitialProfile();
  const negative = createInitialProfile();
  negative.interestPairs[canonicalTastePair('open source', 'skateboarding')] = -0.8;

  const now = new Date('2026-08-29T16:00:00.000Z');
  const neutralScore = personalizedScore(signal, neutral, undefined, now);
  const negativeScore = personalizedScore(signal, negative, undefined, now);
  assert.ok(negativeScore < neutralScore - 0.02);
});

test('positive learned pair memory becomes a retrieval intersection', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 8;
  profile.interestPairs[canonicalTastePair('mountain biking', 'telemetry')] = 0.48;
  const focus = buildDiscoveryFocus(profile, undefined, 7, new Date('2026-08-29T12:00:00.000Z'));
  assert.ok(focus.some((topic) => topic.includes('mountain biking') && topic.includes('telemetry')));
});

test('hierarchical bridge memory transfers cautiously across related methods without equating hobbies', () => {
  const profile = applyExplicitPairSignal(createInitialProfile(), item(), 1);
  const climbing = item({
    id: 'climbing-biomechanics',
    title: 'Rock climbing biomechanics and movement analysis',
    summary: 'Kinematics analysis of efficient climbing technique.',
    url: 'https://example.com/climbing-biomechanics',
    sourceKind: 'openalex',
    tags: ['rock climbing', 'biomechanics', 'analysis'],
  });
  const unrelated = item({
    id: 'generic-ml',
    title: 'Generic machine learning benchmark',
    summary: 'A model benchmark with no motion-sport application.',
    url: 'https://example.com/generic-ml',
    sourceKind: 'openalex',
    lane: 'ml_data',
    tags: ['machine learning', 'benchmark'],
  });

  assert.ok(pairAffinityForItem(climbing, profile) > 0.01);
  assert.equal(pairAffinityForItem(unrelated, profile), 0);
});

test('hierarchical memory keys never leak into literal discovery queries', () => {
  let profile = createInitialProfile();
  profile = applyExplicitPairSignal(profile, item(), 1);
  profile.meaningfulInteractions = 8;
  const focus = buildDiscoveryFocus(profile, undefined, 7, new Date('2026-08-29T12:00:00.000Z'));
  assert.equal(focus.some((topic) => /(?:topic|domain|facet):/.test(topic)), false);
});

test('adaptive discovery spends existing focus capacity on one rotating connection probe', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 8;
  const focus = buildDiscoveryFocus(profile, undefined, 7, new Date('2026-08-29T12:00:00.000Z'));
  assert.ok(FRONTIER_CONNECTION_DISCOVERY_SEEDS.some((seed) => focus.includes(seed)));
  assert.ok(focus.length <= 7);
});

test('sports-method intersections qualify for GitHub discovery without making plain sports highlights builder searches', () => {
  assert.equal(isCrossInterestBuilderFocus('skateboarding pose estimation'), true);
  assert.equal(isBuilderDiscoveryFocus('mountain biking telemetry'), true);
  assert.equal(isBuilderDiscoveryFocus('rock climbing biomechanics'), true);
  assert.equal(isBuilderDiscoveryFocus('disc golf simulation'), true);
  assert.equal(isCrossInterestBuilderFocus('mountain biking highlights'), false);
});
