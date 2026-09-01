import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attributeFrontierDecisionOutcome,
  buildFrontierDecision,
  type FrontierDecisionRecord,
} from '../lib/frontier/decisionLedger';
import {
  auditFrontierExposure,
  frontierWilsonRate,
} from '../lib/frontier/exposureAudit';

const AT = Date.UTC(2026, 7, 30, 18, 0, 0);

function decision(
  sessionId: string,
  displayedIds: string[],
  upstreamIds = displayedIds,
  policyMode: 'passive' | 'search' | 'explore' = 'passive',
  at = AT,
): FrontierDecisionRecord {
  const built = buildFrontierDecision({
    sessionId,
    at,
    policyMode,
    semanticEnabled: true,
    streamEpoch: 1,
    upstreamIds,
    displayedIds,
  });
  assert.ok(built);
  return built;
}

function outcome(
  records: FrontierDecisionRecord[],
  sessionId: string,
  itemId: string,
  kind: 'visibility-depth' | 'dwell' | 'open' | 'save' | 'reaction',
  extras: { depth?: number; dwellMs?: number; reaction?: 'love' | 'down' | 'read' } = {},
  at = AT + 1_000,
): FrontierDecisionRecord[] {
  return attributeFrontierDecisionOutcome(records, {
    itemId,
    kind,
    at,
    depth: extras.depth,
    dwellMs: extras.dwellMs,
    reaction: extras.reaction,
  }, sessionId);
}

test('Wilson rate remains bounded and useful for sparse evidence', () => {
  const empty = frontierWilsonRate(0, 0);
  assert.deepEqual(empty, { value: 0, low: 0, high: 1, successes: 0, total: 0 });

  const sparse = frontierWilsonRate(1, 2);
  assert.equal(sparse.value, 0.5);
  assert.ok(sparse.low > 0 && sparse.low < 0.5);
  assert.ok(sparse.high > 0.5 && sparse.high < 1);
});

test('audit separates opportunity, canonical visibility, and engagement', () => {
  let records = [decision('s1', ['a', 'b', 'c', 'd'])];
  records = outcome(records, 's1', 'a', 'visibility-depth', { depth: 0.55 });
  records = outcome(records, 's1', 'a', 'dwell', { dwellMs: 9_000 }, AT + 2_000);
  records = outcome(records, 's1', 'b', 'visibility-depth', { depth: 0.55 }, AT + 3_000);
  records = outcome(records, 's1', 'b', 'reaction', { reaction: 'love' }, AT + 4_000);

  const audit = auditFrontierExposure(records, AT + 5_000);
  assert.equal(audit.overall.offered, 4);
  assert.equal(audit.overall.visible, 2);
  assert.equal(audit.overall.engaged, 2);
  assert.equal(audit.overall.explicit, 1);
  assert.equal(audit.overall.positive, 1);
  assert.equal(audit.overall.visibility.value, 0.5);
  assert.equal(audit.overall.engagementGivenVisible.value, 1);
});

test('rank buckets and movement diagnostics preserve policy/display distinction', () => {
  const records = [decision(
    's1',
    ['b', 'a', 'x', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'],
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'],
  )];
  const audit = auditFrontierExposure(records, AT);

  assert.equal(audit.byDisplayedRank['1-4'].offered, 4);
  assert.equal(audit.byDisplayedRank['5-12'].offered, 8);
  assert.equal(audit.byDisplayedRank['13-24'].offered, 1);
  assert.equal(audit.overall.promoted, 1);
  assert.equal(audit.overall.demoted, 1);
  assert.equal(audit.overall.synthesized, 1);
  assert.equal(audit.overall.unchanged, 10);
});

test('policy modes stay observationally separated', () => {
  const records = [
    decision('s1', ['a'], ['a'], 'passive', AT),
    decision('s2', ['b'], ['b'], 'search', AT + 20_000),
    decision('s3', ['c'], ['c'], 'explore', AT + 40_000),
  ];
  const audit = auditFrontierExposure(records, AT + 60_000);
  assert.deepEqual(audit.modeCoverage, ['explore', 'passive', 'search']);
  assert.equal(audit.byPolicyMode.passive.offered, 1);
  assert.equal(audit.byPolicyMode.search.offered, 1);
  assert.equal(audit.byPolicyMode.explore.offered, 1);
});

test('negative and neutral explicit reactions are not misread as positive engagement', () => {
  let records = [decision('s1', ['a', 'b'])];
  for (const id of ['a', 'b']) records = outcome(records, 's1', id, 'visibility-depth', { depth: 0.55 });
  records = outcome(records, 's1', 'a', 'reaction', { reaction: 'down' }, AT + 2_000);
  records = outcome(records, 's1', 'b', 'reaction', { reaction: 'read' }, AT + 3_000);

  const audit = auditFrontierExposure(records, AT + 4_000);
  assert.equal(audit.overall.negative, 1);
  assert.equal(audit.overall.neutralReaction, 1);
  assert.equal(audit.overall.positive, 0);
  assert.equal(audit.overall.explicit, 2);
  assert.equal(audit.overall.engaged, 2);
});

test('learning maturity requires longitudinal and explicit evidence, not raw impressions', () => {
  const cold = auditFrontierExposure([decision('s1', Array.from({ length: 40 }, (_, i) => `item-${i}`))], AT);
  assert.equal(cold.maturity, 'cold');

  let records: FrontierDecisionRecord[] = [];
  for (let session = 0; session < 6; session += 1) {
    const ids = Array.from({ length: 24 }, (_, i) => `s${session}-item-${i}`);
    let current = [decision(`session-${session}`, ids, ids, 'passive', AT + session * 60_000)];
    for (let i = 0; i < ids.length; i += 1) {
      current = outcome(current, `session-${session}`, ids[i], 'visibility-depth', { depth: 0.55 }, AT + session * 60_000 + i + 1);
      if (i < 3) current = outcome(current, `session-${session}`, ids[i], 'reaction', { reaction: 'love' }, AT + session * 60_000 + 1_000 + i);
    }
    records.push(...current);
  }
  const rich = auditFrontierExposure(records, AT + 10 * 60_000);
  assert.equal(rich.sessions, 6);
  assert.equal(rich.overall.visible, 144);
  assert.equal(rich.overall.explicit, 18);
  assert.equal(rich.maturity, 'rich');
  assert.ok(rich.evidenceScore > 0.8);
});

test('audit refuses causal claims without propensities and randomized assignment', () => {
  const audit = auditFrontierExposure([decision('s1', ['a'])], AT);
  assert.equal(audit.causalReady, false);
  assert.ok(audit.causalBlockers.some((reason) => reason.includes('propensities')));
  assert.ok(audit.causalBlockers.some((reason) => reason.includes('randomized')));
});

test('health warnings surface sparse explicit feedback and stale evidence', () => {
  let records = [decision('s1', Array.from({ length: 24 }, (_, i) => `item-${i}`), undefined, 'passive', AT)];
  for (let i = 0; i < 20; i += 1) {
    records = outcome(records, 's1', `item-${i}`, 'visibility-depth', { depth: 0.55 }, AT + i + 1);
    records = outcome(records, 's1', `item-${i}`, 'dwell', { dwellMs: 3_000 }, AT + 1_000 + i);
  }
  const audit = auditFrontierExposure(records, AT + 45 * 86_400_000);
  assert.ok(audit.warnings.some((warning) => warning.includes('explicit feedback')));
  assert.ok(audit.warnings.some((warning) => warning.includes('stale')));
});
