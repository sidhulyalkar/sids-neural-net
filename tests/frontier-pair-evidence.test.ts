import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import {
  buildPairEvidenceIndex,
  effectivePairAffinityForItem,
  positiveLiteralPairEvidence,
} from '../lib/frontier/pairEvidence';
import { canonicalTastePair, pairAffinityForItem } from '../lib/frontier/tasteLearning';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from '../lib/frontier/types';

function item(id: string): FrontierItem {
  return {
    id,
    title: 'Street skateboarding pose estimation toolkit',
    summary: 'Open-source biomechanics analysis for trick progression.',
    url: `https://github.com/example/${id}`,
    source: 'github.com',
    sourceLabel: `example/${id}`,
    sourceKind: 'github',
    publishedAt: '2026-08-28T12:00:00.000Z',
    lane: 'sports',
    tags: ['skateboarding', 'pose estimation', 'open source'],
    baseScore: 0.7,
    importance: 0.55,
    novelty: 0.7,
    quality: 0.8,
    momentum: 0.5,
  };
}

function historyEntry(
  source: FrontierItem,
  reaction: FrontierReaction,
  reactedAt: string,
): FrontierHistoryEntry {
  return {
    item: source,
    firstSeenAt: reactedAt,
    lastSeenAt: reactedAt,
    impressions: 2,
    reaction,
    reactedAt,
    resurfacedCount: 0,
    rewarded: false,
  };
}

const NOW = new Date('2026-08-29T20:00:00.000Z');
const PAIR = canonicalTastePair('skateboarding', 'pose estimation');

test('repeated independent positive examples build more confidence than one click', () => {
  const one = buildPairEvidenceIndex({
    a: historyEntry(item('a'), 'love', '2026-08-29T18:00:00.000Z'),
  }, NOW).get(PAIR)!;
  const many = buildPairEvidenceIndex({
    a: historyEntry(item('a'), 'love', '2026-08-29T18:00:00.000Z'),
    b: historyEntry(item('b'), 'up', '2026-08-28T18:00:00.000Z'),
    c: historyEntry(item('c'), 'useful', '2026-08-27T18:00:00.000Z'),
  }, NOW).get(PAIR)!;

  assert.ok(one.affinity > 0);
  assert.ok(many.confidence > one.confidence);
  assert.ok(many.supportCount > one.supportCount);
  assert.equal(many.contradictionCount, 0);
});

test('contradictory reactions lower confidence and block acquisition evidence', () => {
  const consistent = buildPairEvidenceIndex({
    a: historyEntry(item('a'), 'love', '2026-08-29T18:00:00.000Z'),
    b: historyEntry(item('b'), 'up', '2026-08-28T18:00:00.000Z'),
  }, NOW);
  const contradicted = buildPairEvidenceIndex({
    a: historyEntry(item('a'), 'love', '2026-08-29T18:00:00.000Z'),
    b: historyEntry(item('b'), 'down', '2026-08-29T17:00:00.000Z'),
  }, NOW);

  assert.ok(contradicted.get(PAIR)!.confidence < consistent.get(PAIR)!.confidence);
  assert.ok(Math.abs(contradicted.get(PAIR)!.affinity) < consistent.get(PAIR)!.affinity);
  assert.equal(positiveLiteralPairEvidence(contradicted).some((entry) => entry.key === PAIR), false);
});

test('recent negative evidence can overturn a stale positive scalar compatibility prior', () => {
  const candidate = item('candidate');
  const profile = createInitialProfile();
  profile.interestPairs[PAIR] = 0.7;
  const history = {
    a: historyEntry(item('a'), 'hide', '2026-08-29T18:00:00.000Z'),
    b: historyEntry(item('b'), 'down', '2026-08-28T18:00:00.000Z'),
    c: historyEntry(item('c'), 'meh', '2026-08-27T18:00:00.000Z'),
  };
  const index = buildPairEvidenceIndex(history, NOW);
  const legacy = pairAffinityForItem(candidate, profile);
  const effective = effectivePairAffinityForItem(candidate, legacy, index);

  assert.ok(legacy > 0.5);
  assert.ok(index.get(PAIR)!.affinity < 0);
  assert.ok(effective < 0, `recent evidence failed to reverse stale scalar: ${effective}`);
});

test('old evidence decays instead of becoming permanent taste authority', () => {
  const recent = buildPairEvidenceIndex({
    recent: historyEntry(item('recent'), 'love', '2026-08-28T18:00:00.000Z'),
  }, NOW).get(PAIR)!;
  const old = buildPairEvidenceIndex({
    old: historyEntry(item('old'), 'love', '2025-08-28T18:00:00.000Z'),
  }, NOW).get(PAIR)!;

  assert.ok(old.confidence < recent.confidence * 0.35);
  assert.ok(old.affinity < recent.affinity * 0.35);
});

test('legacy scalar remains authoritative when the history ledger has no evidence', () => {
  const candidate = item('candidate');
  const profile = createInitialProfile();
  profile.interestPairs[PAIR] = 0.44;
  const legacy = pairAffinityForItem(candidate, profile);
  const effective = effectivePairAffinityForItem(candidate, legacy, buildPairEvidenceIndex({}, NOW));
  assert.equal(effective, legacy);
});
