import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import {
  buildDirectPreferenceEvidenceIndex,
  directPreferenceEvidenceFor,
  directPreferenceSignalsForItem,
  effectiveDirectPreferenceAffinity,
} from '../lib/frontier/directPreferenceEvidence';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from '../lib/frontier/types';

const NOW = new Date('2026-08-30T19:00:00.000Z');

function item(id: string, tags: string[], overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'github',
    publishedAt: '2026-08-30T18:00:00.000Z',
    lane: 'ml_data',
    tags,
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.85,
    momentum: 0.5,
    ...overrides,
  };
}

function historyEntry(source: FrontierItem, at: string, reaction?: FrontierReaction): FrontierHistoryEntry {
  return {
    item: source,
    firstSeenAt: at,
    lastSeenAt: at,
    impressions: 1,
    dwellMs: reaction ? 30_000 : 0,
    openedAt: reaction ? at : undefined,
    reaction,
    reactedAt: reaction ? at : undefined,
    resurfacedCount: 0,
    rewarded: false,
  };
}

test('direct evidence is derived from canonical lane, topic, and source identity', () => {
  const target = item('climb', ['rock climbing', 'biomechanics'], { lane: 'sports', sourceKind: 'github' });
  const index = buildDirectPreferenceEvidenceIndex({
    [target.id]: historyEntry(target, '2026-08-30T18:30:00.000Z', 'love'),
  }, NOW);

  const lane = directPreferenceEvidenceFor(index, 'lane', 'sports');
  const topic = directPreferenceEvidenceFor(index, 'topic', 'rock climbing');
  const source = directPreferenceEvidenceFor(index, 'source', 'github');
  assert.ok(lane && lane.affinity > 0);
  assert.ok(topic && topic.affinity > lane.affinity, 'specific topics should earn more evidence per item than broad lanes');
  assert.ok(source && source.confidence < topic.confidence, 'source preference should require more repeated evidence');
});

test('confirming evidence does not double-amplify an existing direct prior', () => {
  const liked = item('liked', ['recommendation systems']);
  const index = buildDirectPreferenceEvidenceIndex({
    [liked.id]: historyEntry(liked, '2026-08-30T18:30:00.000Z', 'love'),
  }, NOW);
  const legacy = 0.35;
  assert.equal(
    effectiveDirectPreferenceAffinity(legacy, 'topic', 'recommendation systems', index),
    legacy,
  );
});

test('weak contradictory evidence cannot erase a durable prior', () => {
  const disliked = item('disliked', ['recommendation systems']);
  const index = buildDirectPreferenceEvidenceIndex({
    [disliked.id]: historyEntry(disliked, '2026-08-30T18:30:00.000Z', 'meh'),
  }, NOW);
  const effective = effectiveDirectPreferenceAffinity(0.55, 'topic', 'recommendation systems', index);
  assert.ok(effective > 0.35, `one weak negative overrode durable taste too aggressively: ${effective}`);
});

test('repeated strong contradictory evidence can reverse a stale positive prior', () => {
  const history: Record<string, FrontierHistoryEntry> = {};
  for (let index = 0; index < 4; index += 1) {
    const disliked = item(`disliked-${index}`, ['generic ai', 'startup'], { lane: 'ai_frontier', sourceKind: 'rss' });
    history[disliked.id] = historyEntry(
      disliked,
      `2026-08-${String(27 + Math.min(index, 3)).padStart(2, '0')}T18:00:00.000Z`,
      index % 2 ? 'hide' : 'down',
    );
  }
  const evidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const effective = effectiveDirectPreferenceAffinity(0.52, 'topic', 'generic ai', evidence);
  assert.ok(effective < 0, `strong recent contradiction failed to reverse stale positive prior: ${effective}`);
});

test('arbitration is symmetric when old negative taste becomes strongly positive', () => {
  const history: Record<string, FrontierHistoryEntry> = {};
  for (let index = 0; index < 4; index += 1) {
    const liked = item(`liked-${index}`, ['scientific visualization'], { lane: 'methods' });
    history[liked.id] = historyEntry(liked, `2026-08-${String(27 + Math.min(index, 3)).padStart(2, '0')}T18:00:00.000Z`, 'love');
  }
  const evidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const effective = effectiveDirectPreferenceAffinity(-0.45, 'topic', 'scientific visualization', evidence);
  assert.ok(effective > 0, `strong positive history failed to overturn stale negative prior: ${effective}`);
});

test('contradiction loses authority as evidence ages', () => {
  const disliked = item('old-dislike', ['game development']);
  const recent = buildDirectPreferenceEvidenceIndex({
    [disliked.id]: historyEntry(disliked, '2026-08-30T18:00:00.000Z', 'hide'),
  }, NOW);
  const old = buildDirectPreferenceEvidenceIndex({
    [disliked.id]: historyEntry(disliked, '2025-08-30T18:00:00.000Z', 'hide'),
  }, NOW);
  const recentEffective = effectiveDirectPreferenceAffinity(0.45, 'topic', 'game development', recent);
  const oldEffective = effectiveDirectPreferenceAffinity(0.45, 'topic', 'game development', old);
  assert.ok(recentEffective < oldEffective, 'recent contradiction should arbitrate more strongly than year-old evidence');
  assert.ok(oldEffective > 0.3, 'very old contradiction should not permanently erase a durable prior');
});

test('item-level signals reconcile lane source and topic without inventing absent priors', () => {
  const profile = createInitialProfile();
  profile.laneAffinity.ml_data = 0.4;
  profile.topicAffinity['recommendation systems'] = 0.5;
  profile.sourceAffinity.github = 0.22;
  const history: Record<string, FrontierHistoryEntry> = {};
  for (let index = 0; index < 4; index += 1) {
    const disliked = item(`bad-${index}`, ['recommendation systems'], { lane: 'ml_data', sourceKind: 'github' });
    history[disliked.id] = historyEntry(disliked, `2026-08-30T${String(14 + index).padStart(2, '0')}:00:00.000Z`, 'hide');
  }
  const evidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const target = item('target', ['recommendation systems', 'unseen-tag'], { lane: 'ml_data', sourceKind: 'github' });
  const signals = directPreferenceSignalsForItem(target, profile, evidence);
  assert.ok(signals.laneAffinity < profile.laneAffinity.ml_data);
  assert.ok(signals.sourceAffinity < profile.sourceAffinity.github);
  assert.ok(signals.topicSignal < 0.25, 'contradicted learned topic should not be rescued by an absent second-topic prior');
  assert.equal(
    effectiveDirectPreferenceAffinity(0, 'topic', 'unseen-tag', evidence),
    0,
    'history arbitration must not create a second independent direct-affinity learner',
  );
});
