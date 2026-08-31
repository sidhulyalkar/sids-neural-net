import assert from 'node:assert/strict';
import test from 'node:test';
import {
  restoreArchiveDomainsAtomically,
  type FrontierArchiveRestoreAdapters,
} from '../lib/frontier/archiveIntegrity';
import {
  LONGITUDINAL_ARCHIVE_LIMITS,
  parseLongitudinalArchive,
} from '../lib/frontier/longitudinalArchiveValidation';
import { parseReactionTrustState } from '../lib/frontier/reactionTrust';
import type { LongitudinalArchive } from '../lib/frontier/longitudinal';
import type { ReactionTrustState } from '../lib/frontier/reactionTrust';
import type { FrontierPersistedState } from '../lib/frontier/types';

const EXPORTED_AT = '2026-08-31T12:00:00.000Z';
const DAY_KEY = '2026-08-31';

function validLongitudinalArchive(): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: EXPORTED_AT,
    exposures: [{
      id: 'exposure-1', sessionId: 'session-1', itemId: 'item-1', lane: 'creative_tech',
      tags: ['neuroai'], sourceKind: 'github', format: 'code',
      startedAt: 1000, endedAt: 61_000, dayKey: DAY_KEY, durationMs: 60_000,
      attributionMean: 0.8, attributionMin: 0.7, visibleFractionMean: 0.85,
    }],
    reactions: [{
      id: 'reaction-1', sessionId: 'session-1', exposureId: 'exposure-1', itemId: 'item-1',
      lane: 'creative_tech', tags: ['neuroai'], sourceKind: 'github', format: 'code',
      occurredAt: 20_000, dayKey: DAY_KEY, kind: 'interest', confidence: 0.8, intensity: 0.7,
      durationMs: 1_200, latencyMs: 19_000, targetScore: 0.8, visibleFraction: 0.85,
      trustAuthority: 0.9, review: 'confirmed', reviewedAt: 21_000,
    }],
    interactions: [{
      id: 'interaction-1', sessionId: 'session-1', itemId: 'item-1', lane: 'creative_tech',
      tags: ['neuroai'], sourceKind: 'github', format: 'code', at: 30_000, dayKey: DAY_KEY,
      kind: 'reaction', reaction: 'love',
    }],
    checkins: [{ id: 'checkin-1', at: 40_000, dayKey: DAY_KEY, mood: 4, energy: 3, focus: 5 }],
    rollups: [{
      id: 'rollup-1', batchId: 'batch-1', dayKey: DAY_KEY, dimension: 'topic', key: 'neuroai',
      exposureMs: 60_000, exposures: 1, reactions: 1, explicitInteractions: 1,
      confirmed: 1, contradicted: 0, affinity: 0, interest: 1, surprise: 0, friction: 0,
      confidenceSum: 0.8, intensitySum: 0.7, compactedAt: 100_000,
    }],
  };
}

test('longitudinal archive parser accepts a valid private archive and returns canonical copied records', () => {
  const input = validLongitudinalArchive();
  const parsed = parseLongitudinalArchive(input);
  assert.ok(parsed);
  assert.deepEqual(parsed, input);
  assert.notEqual(parsed.exposures, input.exposures);
  assert.notEqual(parsed.exposures[0], input.exposures[0]);
  assert.equal(Object.hasOwn(parsed.interactions[0], 'dwellMs'), false);

  const unreviewed = structuredClone(validLongitudinalArchive());
  delete unreviewed.reactions[0].review;
  delete unreviewed.reactions[0].reviewedAt;
  const parsedUnreviewed = parseLongitudinalArchive(unreviewed);
  assert.ok(parsedUnreviewed);
  assert.equal(Object.hasOwn(parsedUnreviewed.reactions[0], 'review'), false);
  assert.equal(Object.hasOwn(parsedUnreviewed.reactions[0], 'reviewedAt'), false);
});

test('longitudinal archive parser fails closed on malformed semantic invariants', () => {
  const badLane = structuredClone(validLongitudinalArchive()) as unknown as Record<string, unknown>;
  (badLane.exposures as Array<Record<string, unknown>>)[0].lane = 'invented_lane';
  assert.equal(parseLongitudinalArchive(badLane), null);

  const badDay = structuredClone(validLongitudinalArchive()) as unknown as Record<string, unknown>;
  (badDay.checkins as Array<Record<string, unknown>>)[0].dayKey = '2026-02-31';
  assert.equal(parseLongitudinalArchive(badDay), null);

  const badRollup = structuredClone(validLongitudinalArchive()) as unknown as Record<string, unknown>;
  (badRollup.rollups as Array<Record<string, unknown>>)[0].interest = 0;
  assert.equal(parseLongitudinalArchive(badRollup), null);

  const badNumber = structuredClone(validLongitudinalArchive()) as unknown as Record<string, unknown>;
  (badNumber.reactions as Array<Record<string, unknown>>)[0].confidence = Number.POSITIVE_INFINITY;
  assert.equal(parseLongitudinalArchive(badNumber), null);

  const reactionWithoutValue = structuredClone(validLongitudinalArchive()) as unknown as Record<string, unknown>;
  delete (reactionWithoutValue.interactions as Array<Record<string, unknown>>)[0].reaction;
  assert.equal(parseLongitudinalArchive(reactionWithoutValue), null);
});

test('longitudinal archive parser rejects duplicate object-store IDs instead of relying on last-write-wins', () => {
  const duplicateExposure = structuredClone(validLongitudinalArchive());
  duplicateExposure.exposures.push({ ...duplicateExposure.exposures[0] });
  assert.equal(parseLongitudinalArchive(duplicateExposure), null);

  const duplicateRollup = structuredClone(validLongitudinalArchive());
  duplicateRollup.rollups.push({ ...duplicateRollup.rollups[0] });
  assert.equal(parseLongitudinalArchive(duplicateRollup), null);
});

test('longitudinal archive parser rejects pathological store sizes before record traversal', () => {
  const input = validLongitudinalArchive() as unknown as Record<string, unknown>;
  input.exposures = new Array(LONGITUDINAL_ARCHIVE_LIMITS.exposures + 1).fill((validLongitudinalArchive().exposures[0]));
  assert.equal(parseLongitudinalArchive(input), null);
});

test('reaction trust archive parser enforces invariants and canonical optional fields', () => {
  const valid: ReactionTrustState = {
    interest: { observed: 8, confirmed: 4, contradicted: 2, confidenceSum: 5.6, lastAt: 1234 },
  };
  assert.deepEqual(parseReactionTrustState(valid), valid);

  const withoutLastAt: ReactionTrustState = {
    surprise: { observed: 2, confirmed: 1, contradicted: 0, confidenceSum: 1.4 },
  };
  const parsedWithoutLastAt = parseReactionTrustState(withoutLastAt);
  assert.deepEqual(parsedWithoutLastAt, withoutLastAt);
  assert.ok(parsedWithoutLastAt?.surprise);
  assert.equal(Object.hasOwn(parsedWithoutLastAt.surprise, 'lastAt'), false);

  assert.equal(parseReactionTrustState({ interest: { observed: 2, confirmed: 2, contradicted: 1, confidenceSum: 1.5 } }), null);
  assert.equal(parseReactionTrustState({ interest: { observed: 2, confirmed: 1, contradicted: 0, confidenceSum: 2.5 } }), null);
  assert.equal(parseReactionTrustState({ interest: valid.interest, inventedCue: valid.interest }), null);
});

test('archive restore keeps all three domains on the target when every write succeeds', async () => {
  const oldFrontier = { version: 2, marker: 'old' } as unknown as FrontierPersistedState;
  const newFrontier = { version: 2, marker: 'new' } as unknown as FrontierPersistedState;
  const oldTrust: ReactionTrustState = { interest: { observed: 1, confirmed: 1, contradicted: 0, confidenceSum: 0.8 } };
  const newTrust: ReactionTrustState = { interest: { observed: 2, confirmed: 2, contradicted: 0, confidenceSum: 1.6 } };
  const oldLongitudinal = validLongitudinalArchive();
  const newLongitudinal = { ...validLongitudinalArchive(), exportedAt: '2026-09-01T12:00:00.000Z' };
  let frontier = oldFrontier;
  let trust = oldTrust;
  let longitudinal = oldLongitudinal;
  const adapters: FrontierArchiveRestoreAdapters = {
    readFrontier: () => frontier,
    writeFrontier: (value) => { frontier = value; return true; },
    readReactionTrust: () => trust,
    writeReactionTrust: (value) => { trust = value; return true; },
    readLongitudinal: async () => longitudinal,
    writeLongitudinal: async (value) => { longitudinal = value; return true; },
  };
  const result = await restoreArchiveDomainsAtomically({ frontier: newFrontier, reactionTrust: newTrust, longitudinal: newLongitudinal }, adapters);
  assert.deepEqual(result, { ok: true, rollbackAttempted: false, rollbackSucceeded: true });
  assert.equal(frontier, newFrontier);
  assert.equal(trust, newTrust);
  assert.equal(longitudinal, newLongitudinal);
});

test('archive restore compensates every memory domain when a later write rejects', async () => {
  const oldFrontier = { version: 2, marker: 'old' } as unknown as FrontierPersistedState;
  const newFrontier = { version: 2, marker: 'new' } as unknown as FrontierPersistedState;
  const oldTrust: ReactionTrustState = { interest: { observed: 1, confirmed: 1, contradicted: 0, confidenceSum: 0.8 } };
  const newTrust: ReactionTrustState = { surprise: { observed: 2, confirmed: 1, contradicted: 1, confidenceSum: 1.4 } };
  const oldLongitudinal = validLongitudinalArchive();
  const newLongitudinal = { ...validLongitudinalArchive(), exportedAt: '2026-09-01T12:00:00.000Z' };
  let frontier = oldFrontier;
  let trust = oldTrust;
  let longitudinal = oldLongitudinal;
  const writes: string[] = [];
  const adapters: FrontierArchiveRestoreAdapters = {
    readFrontier: () => frontier,
    writeFrontier: (value) => {
      frontier = value;
      writes.push(value === newFrontier ? 'frontier:new' : 'frontier:rollback');
      return value !== newFrontier;
    },
    readReactionTrust: () => trust,
    writeReactionTrust: (value) => {
      trust = value;
      writes.push(value === newTrust ? 'trust:new' : 'trust:rollback');
      return true;
    },
    readLongitudinal: async () => longitudinal,
    writeLongitudinal: async (value) => {
      longitudinal = value;
      writes.push(value === newLongitudinal ? 'longitudinal:new' : 'longitudinal:rollback');
      return true;
    },
  };
  const result = await restoreArchiveDomainsAtomically({ frontier: newFrontier, reactionTrust: newTrust, longitudinal: newLongitudinal }, adapters);
  assert.deepEqual(result, { ok: false, rollbackAttempted: true, rollbackSucceeded: true });
  assert.equal(frontier, oldFrontier);
  assert.equal(trust, oldTrust);
  assert.equal(longitudinal, oldLongitudinal);
  assert.deepEqual(writes, [
    'longitudinal:new', 'trust:new', 'frontier:new',
    'frontier:rollback', 'trust:rollback', 'longitudinal:rollback',
  ]);
});
