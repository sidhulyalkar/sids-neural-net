import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBehaviorModel } from '../lib/frontier/behavior';
import { createInitialProfile, DEFAULT_COLLECTIONS } from '../lib/frontier/config';
import {
  buildLongitudinalRollups,
  createLongitudinalCheckin,
  createLongitudinalExposure,
  createLongitudinalInteraction,
  createLongitudinalReaction,
  summarizeLongitudinalData,
} from '../lib/frontier/longitudinal';
import { mergeFrontierMemory } from '../lib/frontier/memoryMerge';
import { reactionTrustAuthority, reactionTrustQuarantined } from '../lib/frontier/reactionTrust';
import { sanitizeFrontierCloudMemory } from '../lib/frontier/store';
import type { FrontierItem, FrontierPersistedState } from '../lib/frontier/types';

function item(id: string, tag: string, lane: FrontierItem['lane'] = 'creative_tech'): FrontierItem {
  return {
    id,
    title: id,
    summary: id,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-30T12:00:00.000Z',
    lane,
    tags: [tag],
    baseScore: 0.6,
    importance: 0.6,
    novelty: 0.7,
    quality: 0.8,
    momentum: 0.5,
  };
}

function state(): FrontierPersistedState {
  return {
    version: 2,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: {},
    collections: DEFAULT_COLLECTIONS.map((collection) => ({ ...collection, itemIds: [] })),
    history: {},
    game: { xp: 0, streak: 0, completedQuestDays: {} },
  };
}

test('reactivity is normalized by qualified exposure instead of raw reaction counts', () => {
  const fast = item('fast', 'visual production');
  const slow = item('slow', 'machine learning', 'ml_data');
  const startedAt = new Date('2026-08-30T12:00:00Z').getTime();
  const fastExposure = createLongitudinalExposure(fast, {
    startedAt,
    endedAt: startedAt + 60_000,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.8,
  });
  const slowExposure = createLongitudinalExposure(slow, {
    startedAt,
    endedAt: startedAt + 600_000,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.8,
  });
  const reactions = [fast, slow].map((signal, index) => createLongitudinalReaction(signal, {
    kind: 'interest',
    confidence: 0.82,
    intensity: 0.7,
    durationMs: 1_200,
    observedAt: 100,
  }, {
    exposureId: index === 0 ? fastExposure.id : slowExposure.id,
    occurredAt: startedAt + 20_000,
    latencyMs: 20_000,
    targetScore: 0.8,
    visibleFraction: 0.8,
    trustAuthority: 0.85,
  }));

  const summary = summarizeLongitudinalData({
    days: 90,
    exposures: [fastExposure, slowExposure],
    reactions,
    interactions: [],
    checkins: [],
    rollups: [],
  });
  const fastTopic = summary.topTopics.find((topic) => topic.key === 'visual production');
  const slowTopic = summary.topTopics.find((topic) => topic.key === 'machine learning');
  assert.ok(fastTopic && slowTopic);
  assert.ok(fastTopic.reactivityPer10Min > slowTopic.reactivityPer10Min * 5);
});

test('daily compaction preserves longitudinal totals and topic reactivity', () => {
  const signal = item('archive-me', 'neuroai', 'neuro_frontier');
  const startedAt = new Date('2026-01-10T12:00:00Z').getTime();
  const exposure = createLongitudinalExposure(signal, {
    startedAt,
    endedAt: startedAt + 180_000,
    attributionMean: 0.76,
    attributionMin: 0.65,
    visibleFractionMean: 0.81,
  });
  const reaction = createLongitudinalReaction(signal, {
    kind: 'surprise', confidence: 0.8, intensity: 0.75, durationMs: 1_100, observedAt: 1,
  }, {
    exposureId: exposure.id,
    occurredAt: startedAt + 30_000,
    latencyMs: 30_000,
    targetScore: 0.8,
    visibleFraction: 0.82,
    trustAuthority: 0.9,
  });
  reaction.review = 'confirmed';
  const interaction = createLongitudinalInteraction(signal, 'open', { at: startedAt + 40_000 });
  const raw = summarizeLongitudinalData({
    days: 3650,
    exposures: [exposure],
    reactions: [reaction],
    interactions: [interaction],
    checkins: [],
    rollups: [],
  });
  const rollups = buildLongitudinalRollups([exposure], [reaction], [interaction], startedAt + 1_000_000, 'test-batch');
  const compacted = summarizeLongitudinalData({
    days: 3650,
    exposures: [],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups,
  });

  assert.equal(compacted.exposureMs, raw.exposureMs);
  assert.equal(compacted.exposures, raw.exposures);
  assert.equal(compacted.reactions, raw.reactions);
  assert.equal(compacted.explicitInteractions, raw.explicitInteractions);
  assert.equal(compacted.confirmed, raw.confirmed);
  assert.equal(compacted.topTopics[0]?.reactivityPer10Min, raw.topTopics[0]?.reactivityPer10Min);
});

test('self-report check-ins remain explicit labels rather than inferred camera state', () => {
  const now = new Date('2026-08-30T12:00:00Z').getTime();
  const checkins = [
    createLongitudinalCheckin(2, 3, 4, now),
    createLongitudinalCheckin(4, 5, 2, now + 1_000),
  ];
  const summary = summarizeLongitudinalData({
    days: 90,
    exposures: [], reactions: [], interactions: [], checkins, rollups: [],
  });
  assert.deepEqual(summary.selfReported, { mood: 3, energy: 4, focus: 3 });
  assert.equal(summary.checkins, 2);
});

test('repeated cue contradictions can quarantine recommendation authority', () => {
  const unreliable = { observed: 12, confirmed: 1, contradicted: 8, confidenceSum: 9 };
  const reliable = { observed: 12, confirmed: 8, contradicted: 1, confidenceSum: 9 };
  assert.equal(reactionTrustQuarantined(unreliable), true);
  assert.equal(reactionTrustQuarantined(reliable), false);
  assert.ok(reactionTrustAuthority(unreliable) < 0.5);
  assert.ok(reactionTrustAuthority(reliable) > reactionTrustAuthority(unreliable));
});

test('cloud projection strips every ambient face-derived aggregate', () => {
  const memory = state();
  const signal = item('private', 'graphics');
  memory.behavior.topicStats.graphics = {
    shown: 3, dwelled: 1, expanded: 0, opened: 1, saved: 0, positive: 0, negative: 0, dwellMs: 12_000,
    ambientAffinity: 1.2, ambientInterest: 0.8, ambientSurprise: 0.4, ambientFriction: 0.2, ambientEvidence: 2.6,
  };
  memory.behavior.rankingSnapshot = {
    laneStats: {}, sourceStats: {}, topicStats: { graphics: memory.behavior.topicStats.graphics }, formatStats: {}, contextStats: {}, capturedAt: '2026-08-30T12:00:00.000Z',
  };
  memory.history[signal.id] = {
    item: signal,
    firstSeenAt: '2026-08-30T12:00:00.000Z',
    lastSeenAt: '2026-08-30T12:01:00.000Z',
    impressions: 1,
    resurfacedCount: 0,
    rewarded: false,
    ambientReaction: { affinity: 1, interest: 0.5, surprise: 0, friction: 0, evidence: 1.5, lastAt: '2026-08-30T12:01:00.000Z' },
  };

  const safe = sanitizeFrontierCloudMemory(memory);
  assert.equal(safe.history.private.ambientReaction, undefined);
  assert.equal(safe.behavior.topicStats.graphics.ambientEvidence, undefined);
  assert.equal(safe.behavior.rankingSnapshot?.topicStats.graphics.ambientAffinity, undefined);
  assert.ok(!JSON.stringify(safe).includes('ambientAffinity'));
});

test('cloud merge preserves local-only ambient memory after sanitizing the remote side', () => {
  const local = state();
  const remote = state();
  const signal = item('merge-private', 'graphics');
  local.behavior.topicStats.graphics = {
    shown: 4, dwelled: 1, expanded: 0, opened: 1, saved: 0, positive: 0, negative: 0, dwellMs: 10_000,
    ambientAffinity: 1.4, ambientEvidence: 1.4,
  };
  local.history[signal.id] = {
    item: signal,
    firstSeenAt: '2026-08-30T10:00:00.000Z',
    lastSeenAt: '2026-08-30T12:00:00.000Z',
    impressions: 2,
    resurfacedCount: 0,
    rewarded: false,
    ambientReaction: { affinity: 1.4, interest: 0, surprise: 0, friction: 0, evidence: 1.4 },
  };
  remote.behavior.topicStats.graphics = {
    shown: 6, dwelled: 2, expanded: 0, opened: 2, saved: 0, positive: 0, negative: 0, dwellMs: 20_000,
  };
  remote.history[signal.id] = {
    item: signal,
    firstSeenAt: '2026-08-29T10:00:00.000Z',
    lastSeenAt: '2026-08-30T13:00:00.000Z',
    impressions: 4,
    resurfacedCount: 0,
    rewarded: false,
  };

  const merged = mergeFrontierMemory(sanitizeFrontierCloudMemory(remote), local);
  assert.equal(merged.behavior.topicStats.graphics.ambientAffinity, 1.4);
  assert.equal(merged.history[signal.id].ambientReaction?.affinity, 1.4);
});
