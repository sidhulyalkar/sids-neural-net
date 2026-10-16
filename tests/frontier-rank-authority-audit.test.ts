import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConnectionExposureIndex } from '../lib/frontier/connectionPortfolio';
import { createInitialProfile } from '../lib/frontier/config';
import { buildDirectPreferenceEvidenceIndex } from '../lib/frontier/directPreferenceEvidence';
import { buildPairEvidenceIndex, pairEvidenceForItem } from '../lib/frontier/pairEvidence';
import { auditFrontierRankAuthority } from '../lib/frontier/rankAuthorityAudit';
import {
  frontierPersonalizedScoreBreakdown,
  frontierRankScoreBreakdown,
  personalizedScore,
  rankFrontierItems,
  sumFrontierPersonalizedScoreComponents,
} from '../lib/frontier/scoring';
import { buildSessionIntent } from '../lib/frontier/sessionIntent';
import type { FrontierHistoryEntry, FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} neutral report`,
    summary: 'A routine neutral update with no special topic language.',
    url: `https://github.com/frontier-rank-audit/${id}`,
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-30T18:00:00.000Z',
    lane: 'builder_signal',
    tags: ['neutral-topic'],
    baseScore: 0.7,
    importance: 0.55,
    novelty: 0.52,
    quality: 0.76,
    momentum: 0.48,
    ...overrides,
  };
}

function neutralProfile() {
  const profile = createInitialProfile();
  for (const lane of Object.keys(profile.laneAffinity)) profile.laneAffinity[lane as keyof typeof profile.laneAffinity] = 0;
  profile.topicAffinity = {};
  profile.sourceAffinity = {};
  profile.interestPairs = {};
  profile.knownTopics = {};
  profile.curiosity = 0.08;
  return profile;
}

test('missing pair evidence is a zero-confidence observation, not a type hole', () => {
  const evidence = pairEvidenceForItem(item('no-pair-evidence'));
  assert.deepEqual(evidence, { affinity: 0, confidence: 0 });
});

test('production personalized score equals the exact ordered component sum', () => {
  const now = new Date('2026-08-30T20:00:00.000Z');
  const profile = neutralProfile();
  profile.topicAffinity['neutral-topic'] = 0.42;
  const signal = item('identity', { baseScore: 0.73, novelty: 0.68 });
  const breakdown = frontierPersonalizedScoreBreakdown(signal, profile, undefined, now);

  assert.equal(breakdown.hidden, false);
  assert.equal(sumFrontierPersonalizedScoreComponents(breakdown.components), breakdown.rawScore);
  assert.equal(personalizedScore(signal, profile, undefined, now), breakdown.score);

  const rankBreakdown = frontierRankScoreBreakdown(
    signal,
    profile,
    undefined,
    buildConnectionExposureIndex({}, now),
    now,
  );
  assert.equal(rankBreakdown.personalized.score, breakdown.score);
  assert.equal(rankBreakdown.score, breakdown.score + rankBreakdown.connectionPortfolio);
});

test('hidden reactions retain the exact -1 personalized authority override', () => {
  const now = new Date('2026-08-30T20:00:00.000Z');
  const profile = neutralProfile();
  const signal = item('hidden');
  const history: FrontierHistoryEntry = {
    item: signal,
    firstSeenAt: '2026-08-30T19:00:00.000Z',
    lastSeenAt: '2026-08-30T19:01:00.000Z',
    impressions: 1,
    reaction: 'hide',
    reactedAt: '2026-08-30T19:01:00.000Z',
    resurfacedCount: 0,
    rewarded: false,
  };
  const breakdown = frontierPersonalizedScoreBreakdown(signal, profile, history, now);
  assert.equal(breakdown.hidden, true);
  assert.equal(breakdown.score, -1);
  assert.equal(personalizedScore(signal, profile, history, now), -1);
});

test('direct-preference additive authority can be isolated without disabling the rest of personalization', () => {
  const now = new Date('2026-08-30T20:00:00.000Z');
  const profile = neutralProfile();
  profile.topicAffinity['my-topic'] = 1.2;

  const evidenceItem = item('evidence', { tags: ['my-topic'] });
  const history: Record<string, FrontierHistoryEntry> = {
    evidence: {
      item: evidenceItem,
      firstSeenAt: '2026-08-29T12:00:00.000Z',
      lastSeenAt: '2026-08-29T12:01:00.000Z',
      impressions: 1,
      reaction: 'love',
      reactedAt: '2026-08-29T12:01:00.000Z',
      resurfacedCount: 0,
      rewarded: false,
    },
  };
  const pairEvidence = buildPairEvidenceIndex({}, now);
  const sessionIntent = buildSessionIntent({}, now);
  const directEvidence = buildDirectPreferenceEvidenceIndex(history, now);
  const generic = item('generic', { baseScore: 0.8, tags: ['other-topic'] });
  const preferred = item('preferred', { baseScore: 0.78, tags: ['my-topic'] });
  const ranked = rankFrontierItems(
    [generic, preferred],
    profile,
    history,
    now,
    undefined,
    pairEvidence,
    sessionIntent,
    directEvidence,
  );

  assert.equal(ranked[0]?.id, 'preferred');
  const audit = auditFrontierRankAuthority(
    ranked,
    profile,
    history,
    1,
    now,
    undefined,
    pairEvidence,
    sessionIntent,
    directEvidence,
  );
  const direct = audit.components.find((entry) => entry.component === 'direct-preference-additive');
  assert.ok(direct);
  assert.equal(direct.topK, 1);
  assert.equal(direct.protectedTopK, 1);
  assert.equal(direct.displacedTopK, 1);
  assert.equal(direct.sharedTopK, 0);
  assert.ok(direct.maxAbsoluteScoreContribution > 0);
});

test('rank authority audit returns aggregate diagnostics without item identities or content', () => {
  const now = new Date('2026-08-30T20:00:00.000Z');
  const profile = neutralProfile();
  const candidates = Array.from({ length: 12 }, (_, index) => item(`candidate-${index}`, {
    baseScore: 0.62 + index * 0.01,
    tags: index % 3 === 0 ? ['my-topic'] : ['neutral-topic'],
  }));
  profile.topicAffinity['my-topic'] = 0.7;
  const ranked = rankFrontierItems(candidates, profile, {}, now);
  const audit = auditFrontierRankAuthority(ranked, profile, {}, 5, now);

  assert.equal(audit.schema, 'frontier-rank-authority-v1');
  assert.equal(audit.candidates, 12);
  assert.equal(audit.topK, 5);
  assert.deepEqual(audit.components.map((entry) => entry.component), [
    'fixed-taste',
    'direct-preference-additive',
    'pair-connection-additive',
    'implicit-behavior',
    'session-intent',
    'exploration',
  ]);
  for (const component of audit.components) {
    assert.equal(component.sharedTopK + component.protectedTopK, 5);
    assert.equal(component.sharedTopK + component.displacedTopK, 5);
    assert.ok(component.overlapRate >= 0 && component.overlapRate <= 1);
  }
  const serialized = JSON.stringify(audit).toLowerCase();
  for (const forbidden of ['candidate-0', 'title', 'summary', 'url', 'itemid']) {
    assert.equal(serialized.includes(forbidden), false, `rank audit leaked ${forbidden}`);
  }
});
