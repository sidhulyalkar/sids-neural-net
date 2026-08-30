import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_DECISION_ATTRIBUTION_WINDOW_MS,
  FRONTIER_DECISION_MAX_RECORDS,
  attributeFrontierDecisionOutcome,
  buildFrontierDecision,
  frontierDecisionPolicyMode,
  upsertFrontierDecision,
  type FrontierDecisionRecord,
} from '../lib/frontier/decisionLedger';

const AT = Date.UTC(2026, 7, 30, 17, 0, 0);

function decision(overrides: Partial<Parameters<typeof buildFrontierDecision>[0]> = {}): FrontierDecisionRecord {
  const built = buildFrontierDecision({
    sessionId: 'session-a',
    at: AT,
    policyMode: 'passive',
    semanticEnabled: true,
    streamEpoch: 7,
    upstreamIds: ['a', 'b', 'c', 'd'],
    displayedIds: ['b', 'a', 'x', 'd'],
    ...overrides,
  });
  assert.ok(built);
  return built;
}

test('decision records preserve upstream and displayed rank without content payloads', () => {
  const record = decision();
  assert.deepEqual(record.exposures, [
    { itemId: 'b', upstreamIndex: 1, displayedIndex: 0 },
    { itemId: 'a', upstreamIndex: 0, displayedIndex: 1 },
    { itemId: 'x', upstreamIndex: -1, displayedIndex: 2 },
    { itemId: 'd', upstreamIndex: 3, displayedIndex: 3 },
  ]);

  const serialized = JSON.stringify(record);
  assert.ok(!serialized.includes('title'));
  assert.ok(!serialized.includes('summary'));
  assert.ok(!serialized.includes('https://'));
  assert.ok(!serialized.includes('query'));
});

test('policy mode reflects product intent rather than any nonzero exploration coefficient', () => {
  assert.equal(frontierDecisionPolicyMode('', 0), 'passive');
  assert.equal(frontierDecisionPolicyMode('', 0.08), 'passive', 'normal background exploration is part of passive policy');
  assert.equal(frontierDecisionPolicyMode('', 0.62), 'explore', 'stream anti-staleness excursion should be observable as exploration');
  assert.equal(frontierDecisionPolicyMode('', 0.82), 'explore', 'manual exploration should be observable as exploration');
  assert.equal(frontierDecisionPolicyMode('rock climbing biomechanics', 0), 'search');
  assert.equal(frontierDecisionPolicyMode('rock climbing biomechanics', 0.5), 'search', 'search remains direct intent despite its temporary exploration spike');
  assert.equal(frontierDecisionPolicyMode('anything', 0.82), 'search', 'explicit query has higher causal authority than exploration temperature');
});

test('identical decisions within a short window extend exposure instead of duplicating records', () => {
  const first = decision();
  const repeated = decision({ at: AT + 5 * 60_000 });
  const ledger = upsertFrontierDecision([first], repeated);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].at, AT);
  assert.equal(ledger[0].lastSeenAt, AT + 5 * 60_000);
});

test('an outcome attaches to the latest decision that actually exposed the item', () => {
  const older = decision({ at: AT - 30_000, displayedIds: ['a', 'b'] });
  const newer = decision({ at: AT, displayedIds: ['c', 'b'] });
  const ledger = attributeFrontierDecisionOutcome([older, newer], {
    kind: 'open',
    itemId: 'b',
    at: AT + 2_000,
  }, 'session-a');

  assert.equal(ledger[0].outcomes.length, 0);
  assert.equal(ledger[1].outcomes.length, 1);
  assert.equal(ledger[1].outcomes[0].itemId, 'b');
  assert.equal(ledger[1].outcomes[0].opened, true);
});

test('visibility and dwell outcomes coalesce into bounded per-item evidence', () => {
  let ledger = [decision()];
  ledger = attributeFrontierDecisionOutcome(ledger, {
    kind: 'visibility-depth',
    itemId: 'b',
    at: AT + 1_000,
    depth: 0.53,
  }, 'session-a');
  ledger = attributeFrontierDecisionOutcome(ledger, {
    kind: 'visibility-depth',
    itemId: 'b',
    at: AT + 2_000,
    depth: 0.91,
  }, 'session-a');
  ledger = attributeFrontierDecisionOutcome(ledger, {
    kind: 'dwell',
    itemId: 'b',
    at: AT + 3_000,
    dwellMs: 12_260,
  }, 'session-a');
  ledger = attributeFrontierDecisionOutcome(ledger, {
    kind: 'dwell',
    itemId: 'b',
    at: AT + 4_000,
    dwellMs: 8_100,
  }, 'session-a');

  assert.equal(ledger[0].outcomes.length, 1);
  assert.equal(ledger[0].outcomes[0].maxDepth, 0.9);
  assert.equal(ledger[0].outcomes[0].maxDwellMs, 12_500);
});

test('reaction/save/open evidence can accumulate on the same exposure record', () => {
  let ledger = [decision()];
  ledger = attributeFrontierDecisionOutcome(ledger, { kind: 'open', itemId: 'a', at: AT + 1_000 }, 'session-a');
  ledger = attributeFrontierDecisionOutcome(ledger, { kind: 'save', itemId: 'a', at: AT + 2_000 }, 'session-a');
  ledger = attributeFrontierDecisionOutcome(ledger, {
    kind: 'reaction',
    itemId: 'a',
    at: AT + 3_000,
    reaction: 'love',
  }, 'session-a');

  assert.deepEqual(ledger[0].outcomes[0], {
    itemId: 'a',
    firstAt: AT + 1_000,
    lastAt: AT + 3_000,
    opened: true,
    saved: true,
    reaction: 'love',
  });
});

test('outcomes do not cross sessions, absent exposures, or stale attribution windows', () => {
  const base = [decision()];
  const otherSession = attributeFrontierDecisionOutcome(base, {
    kind: 'open', itemId: 'a', at: AT + 1_000,
  }, 'session-b');
  assert.strictEqual(otherSession, base);

  const absent = attributeFrontierDecisionOutcome(base, {
    kind: 'open', itemId: 'not-shown', at: AT + 1_000,
  }, 'session-a');
  assert.strictEqual(absent, base);

  const stale = attributeFrontierDecisionOutcome(base, {
    kind: 'open', itemId: 'a', at: AT + FRONTIER_DECISION_ATTRIBUTION_WINDOW_MS + 1,
  }, 'session-a');
  assert.strictEqual(stale, base);
});

test('ledger retention is bounded', () => {
  let ledger: FrontierDecisionRecord[] = [];
  for (let index = 0; index < FRONTIER_DECISION_MAX_RECORDS + 20; index += 1) {
    const next = decision({
      at: AT + index * 20 * 60_000,
      streamEpoch: index,
      displayedIds: [`item-${index}`],
      upstreamIds: [`item-${index}`],
    });
    ledger = upsertFrontierDecision(ledger, next);
  }
  assert.equal(ledger.length, FRONTIER_DECISION_MAX_RECORDS);
  assert.equal(ledger.at(-1)?.streamEpoch, FRONTIER_DECISION_MAX_RECORDS + 19);
});
