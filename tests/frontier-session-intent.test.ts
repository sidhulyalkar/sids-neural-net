import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSessionIntent, sessionIntentAdjustment } from '../lib/frontier/sessionIntent';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from '../lib/frontier/types';

function item(overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id: overrides.id ?? 'climb-motion',
    title: 'Rock climbing biomechanics pose analysis',
    summary: 'Open-source movement analysis for bouldering technique.',
    url: 'https://github.com/example/climb-motion',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-29T20:00:00.000Z',
    lane: 'sports',
    tags: ['rock climbing', 'bouldering', 'biomechanics', 'pose estimation', 'open source'],
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.66,
    quality: 0.8,
    momentum: 0.5,
    ...overrides,
  };
}

function historyEntry(
  source: FrontierItem,
  at: string,
  reaction?: FrontierReaction,
): FrontierHistoryEntry {
  return {
    item: source,
    firstSeenAt: at,
    lastSeenAt: at,
    impressions: 1,
    dwellMs: 42_000,
    openedAt: at,
    reaction,
    reactedAt: reaction ? at : undefined,
    resurfacedCount: 0,
    rewarded: false,
  };
}

test('recent meaningful engagement activates a concrete short-term interest region', () => {
  const now = new Date('2026-08-29T21:00:00.000Z');
  const source = item();
  const intent = buildSessionIntent({
    [source.id]: historyEntry(source, '2026-08-29T20:40:00.000Z', 'up'),
  }, now);

  assert.ok(intent.confidence > 0.2);
  assert.ok(intent.topicWeights['rock-climbing'] > 0.9);
  assert.ok(intent.domainWeights['motion-sports']! > 0.9);
  assert.ok(intent.facetWeights['motion-science']! > 0.9);
  assert.ok(intent.dominantTopicIds.includes('rock-climbing'));
});

test('session intent boosts a current concrete topic more than an unrelated durable interest', () => {
  const now = new Date('2026-08-29T21:00:00.000Z');
  const source = item();
  const intent = buildSessionIntent({
    [source.id]: historyEntry(source, '2026-08-29T20:20:00.000Z', 'love'),
  }, now);

  const climbing = sessionIntentAdjustment(item({ id: 'next-climb' }), intent);
  const nfl = sessionIntentAdjustment(item({
    id: 'nfl',
    title: 'NFL player tracking EPA dashboard',
    summary: 'Open-source football analytics and player tracking visualization.',
    url: 'https://github.com/example/nfl-data',
    tags: ['nfl analytics', 'sports analytics', 'player tracking', 'open source'],
  }), intent);

  assert.ok(climbing.score > nfl.score * 2);
  assert.ok(climbing.topicMatch > nfl.topicMatch);
});

test('short-term intent decays away instead of becoming another permanent taste store', () => {
  const now = new Date('2026-08-29T21:00:00.000Z');
  const old = item({ id: 'old' });
  const intent = buildSessionIntent({
    [old.id]: historyEntry(old, '2026-08-28T18:00:00.000Z', 'love'),
  }, now);

  assert.equal(intent.evidenceCount, 0);
  assert.equal(intent.confidence, 0);
  assert.equal(sessionIntentAdjustment(item({ id: 'new' }), intent).score, 0);
});

test('negative reactions do not define the active recommendation direction', () => {
  const now = new Date('2026-08-29T21:00:00.000Z');
  const rejected = item({ id: 'rejected' });
  const entry = historyEntry(rejected, '2026-08-29T20:55:00.000Z', 'hide');
  entry.openedAt = undefined;
  entry.dwellMs = 0;
  const intent = buildSessionIntent({ [rejected.id]: entry }, now);

  assert.equal(intent.evidenceCount, 0);
  assert.equal(intent.confidence, 0);
});

test('concrete interest identity outranks transfer-only umbrella topics inside the session map', () => {
  const now = new Date('2026-08-29T21:00:00.000Z');
  const source = item();
  const intent = buildSessionIntent({
    [source.id]: historyEntry(source, '2026-08-29T20:50:00.000Z', 'useful'),
  }, now);

  assert.ok(intent.topicWeights['rock-climbing'] > (intent.topicWeights['active-sports'] ?? 0));
});
