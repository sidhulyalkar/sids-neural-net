import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBehaviorModel, startBehaviorSession } from '../lib/frontier/behavior';
import { createInitialProfile } from '../lib/frontier/config';
import { buildDirectPreferenceEvidenceIndex } from '../lib/frontier/directPreferenceEvidence';
import { buildDiscoveryFocus } from '../lib/frontier/discoveryFocus';
import { buildPairEvidenceIndex } from '../lib/frontier/pairEvidence';
import { explainRecommendation, personalizedScore, rankFrontierItems } from '../lib/frontier/scoring';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from '../lib/frontier/types';

const NOW = new Date('2026-08-30T19:30:00.000Z');

function item(id: string, tags: string[], overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: id,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-30T18:00:00.000Z',
    lane: 'ai_frontier',
    tags,
    baseScore: 0.7,
    importance: 0.56,
    novelty: 0.58,
    quality: 0.82,
    momentum: 0.5,
    ...overrides,
  };
}

function historyEntry(source: FrontierItem, at: string, reaction: FrontierReaction): FrontierHistoryEntry {
  return {
    item: source,
    firstSeenAt: at,
    lastSeenAt: at,
    impressions: 1,
    dwellMs: 25_000,
    openedAt: at,
    reaction,
    reactedAt: at,
    resurfacedCount: 0,
    rewarded: false,
  };
}

function contradictoryHistory(topic: string, count = 5): Record<string, FrontierHistoryEntry> {
  const history: Record<string, FrontierHistoryEntry> = {};
  for (let index = 0; index < count; index += 1) {
    const source = item(`reject-${index}`, [topic], {
      url: `https://example.com/reject-${index}`,
      publishedAt: `2026-08-${String(26 + Math.min(index, 4)).padStart(2, '0')}T18:00:00.000Z`,
    });
    history[source.id] = historyEntry(
      source,
      `2026-08-${String(26 + Math.min(index, 4)).padStart(2, '0')}T19:00:00.000Z`,
      index % 2 ? 'hide' : 'down',
    );
  }
  return history;
}

test('ranking no longer lets a stale positive topic scalar independently fight strong recent rejection', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 30;
  profile.topicAffinity['generic ai startup'] = 0.9;
  const history = contradictoryHistory('generic ai startup');
  const rejected = item('rejected-current', ['generic ai startup']);
  const neutral = item('neutral-current', ['distributed systems'], {
    lane: 'builder_signal',
    baseScore: 0.71,
  });

  const directEvidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const pairEvidence = buildPairEvidenceIndex(history, NOW);
  const stalePriorScore = personalizedScore(
    rejected,
    profile,
    undefined,
    NOW,
    undefined,
    pairEvidence,
    undefined,
    undefined,
  );
  const reconciledScore = personalizedScore(
    rejected,
    profile,
    undefined,
    NOW,
    undefined,
    pairEvidence,
    undefined,
    directEvidence,
  );
  assert.ok(reconciledScore < stalePriorScore - 0.04, `${reconciledScore} did not materially reduce stale prior ${stalePriorScore}`);

  const ranked = rankFrontierItems([rejected, neutral], profile, history, NOW, undefined, pairEvidence, undefined, directEvidence);
  assert.equal(ranked[0].id, neutral.id, 'confidently rejected topic remained ahead of comparable neutral inventory');
});

test('adaptive discovery does not spend learned or seed slots on a confidently rejected topic', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 35;
  profile.topicAffinity['game development'] = 0.85;
  profile.topicAffinity['neuroai'] = 0.5;
  const history = contradictoryHistory('game development', 6);
  const evidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const focus = buildDiscoveryFocus(profile, undefined, 7, NOW, undefined, undefined, evidence);

  assert.ok(!focus.some((query) => query.includes('game development')),
    `rejected cold-start seed still consumed acquisition authority: ${focus.join(' | ')}`);
  assert.ok(focus.some((query) => query.includes('neuroai') || query.includes('neuroscience')),
    'suppressing one stale seed should leave unrelated positive taste available');
});

test('mature passive disinterest can retire a cold-start seed without explicit negative reactions', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 25;
  const target = item('ignored', ['game development'], { lane: 'creative_tech' });
  let behavior = createInitialBehaviorModel();
  for (let index = 0; index < 28; index += 1) {
    behavior.topicStats['game development'] = {
      shown: index + 1,
      dwelled: 0,
      expanded: 0,
      opened: 0,
      saved: 0,
      positive: 0,
      negative: 0,
      dwellMs: 0,
      lastAt: `2026-08-30T${String(10 + Math.floor(index / 4)).padStart(2, '0')}:00:00.000Z`,
    };
  }
  // Snapshot is the ranking authority for behavior and intentionally does not
  // mutate during the active session.
  behavior = startBehaviorSession(behavior, NOW);
  void target;

  const focus = buildDiscoveryFocus(profile, behavior, 7, NOW);
  assert.ok(!focus.some((query) => query.includes('game development')),
    `mature repeated skips failed to retire seed: ${focus.join(' | ')}`);
});

test('low-confidence contradiction does not destabilize acquisition or explanation', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 12;
  profile.topicAffinity['scientific visualization'] = 0.42;
  const weakReject = item('weak-reject', ['scientific visualization'], { lane: 'methods' });
  const history = {
    [weakReject.id]: historyEntry(weakReject, '2026-08-30T18:30:00.000Z', 'meh'),
  };
  const directEvidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const focus = buildDiscoveryFocus(profile, undefined, 7, NOW, undefined, undefined, directEvidence);
  assert.ok(focus.some((query) => query.includes('scientific visualization')),
    'one weak negative should not erase a durable direct preference');

  const current = item('current', ['scientific visualization'], { lane: 'methods' });
  const explanation = explainRecommendation(current, profile, undefined, NOW, undefined, directEvidence);
  assert.ok(explanation.includes('scientific visualization') || explanation.includes('radar'),
    `explanation stopped recognizing still-positive preference: ${explanation}`);
});

test('high-confidence contradiction prevents stale positive explanation text', () => {
  const profile = createInitialProfile();
  profile.meaningfulInteractions = 30;
  profile.topicAffinity['legacy niche'] = 0.75;
  const history = contradictoryHistory('legacy niche', 6);
  const evidence = buildDirectPreferenceEvidenceIndex(history, NOW);
  const current = item('current-niche', ['legacy niche'], { lane: 'wildcards' });
  const explanation = explainRecommendation(current, profile, undefined, NOW, undefined, evidence);
  assert.ok(!explanation.includes('Your interest in legacy niche'),
    `explanation claimed a stale preference after strong contradiction: ${explanation}`);
});
