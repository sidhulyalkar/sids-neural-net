import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import { buildDiscoveryFocus } from '../lib/frontier/discoveryFocus';
import { buildPairEvidenceIndex } from '../lib/frontier/pairEvidence';
import { buildSessionIntent } from '../lib/frontier/sessionIntent';
import type { FrontierHistoryEntry, FrontierItem } from '../lib/frontier/types';

const NOW = new Date('2026-08-29T21:00:00.000Z');

function climbingItem(): FrontierItem {
  return {
    id: 'climb-session',
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
  };
}

test('high-confidence current intent may replace one adaptive focus slot without increasing fanout', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 12;
  profile.topicAffinity.neuroai = 0.45;
  profile.topicAffinity['sports analytics'] = 0.38;

  const source = climbingItem();
  const history: Record<string, FrontierHistoryEntry> = {
    [source.id]: {
      item: source,
      firstSeenAt: '2026-08-29T20:20:00.000Z',
      lastSeenAt: '2026-08-29T20:45:00.000Z',
      impressions: 2,
      dwellMs: 62_000,
      openedAt: '2026-08-29T20:42:00.000Z',
      reaction: 'love',
      reactedAt: '2026-08-29T20:44:00.000Z',
      resurfacedCount: 0,
      rewarded: false,
    },
  };

  const evidence = buildPairEvidenceIndex(history, NOW);
  const intent = buildSessionIntent(history, NOW);
  assert.ok(intent.confidence >= 0.28);

  const withoutSession = buildDiscoveryFocus(profile, undefined, 7, NOW, evidence);
  const withSession = buildDiscoveryFocus(profile, undefined, 7, NOW, evidence, intent);

  assert.equal(withSession.length, 7, 'session intent must stay inside the existing focus budget');
  assert.ok(withSession.some((query) => query.startsWith('rock climbing')),
    'the active concrete interest should earn one bounded retrieval slot');
  assert.ok(withoutSession.length <= 7);
});

test('weak or expired session evidence does not perturb acquisition', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 12;
  profile.topicAffinity.neuroai = 0.45;
  const source = climbingItem();
  const history: Record<string, FrontierHistoryEntry> = {
    [source.id]: {
      item: source,
      firstSeenAt: '2026-08-28T14:00:00.000Z',
      lastSeenAt: '2026-08-28T14:00:00.000Z',
      impressions: 1,
      dwellMs: 30_000,
      openedAt: '2026-08-28T14:00:00.000Z',
      reaction: 'up',
      reactedAt: '2026-08-28T14:00:00.000Z',
      resurfacedCount: 0,
      rewarded: false,
    },
  };

  const evidence = buildPairEvidenceIndex(history, NOW);
  const expired = buildSessionIntent(history, NOW);
  assert.equal(expired.confidence, 0);

  assert.deepEqual(
    buildDiscoveryFocus(profile, undefined, 7, NOW, evidence, expired),
    buildDiscoveryFocus(profile, undefined, 7, NOW, evidence),
  );
});
