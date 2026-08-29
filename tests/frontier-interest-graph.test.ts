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
import { canonicalTastePair } from '../lib/frontier/tasteLearning';
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
