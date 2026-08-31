import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LONGITUDINAL_ARCHIVE_LIMITS,
  parseLongitudinalArchive,
} from '../lib/frontier/longitudinalArchiveValidation';
import { longitudinalDayKey, type LongitudinalArchive } from '../lib/frontier/longitudinalModel';

const AT = new Date(2026, 7, 31, 12, 0, 0, 0).getTime();
const DAY = longitudinalDayKey(AT);

function validArchive(): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: new Date(AT).toISOString(),
    exposures: [{
      id: 'exposure-1', sessionId: 'session-1', itemId: 'item-1', lane: 'creative_tech',
      tags: ['neuroai'], sourceKind: 'github', format: 'code',
      startedAt: AT, endedAt: AT + 60_000, dayKey: DAY, durationMs: 60_000,
      attributionMean: 0.8, attributionMin: 0.7, visibleFractionMean: 0.85,
    }],
    reactions: [{
      id: 'reaction-1', sessionId: 'session-1', exposureId: 'exposure-1', itemId: 'item-1',
      lane: 'creative_tech', tags: ['neuroai'], sourceKind: 'github', format: 'code',
      occurredAt: AT + 20_000, dayKey: DAY, kind: 'interest', confidence: 0.8, intensity: 0.7,
      durationMs: 1_200, latencyMs: 20_000, targetScore: 0.8, visibleFraction: 0.85,
      trustAuthority: 0.9, review: 'confirmed', reviewedAt: AT + 21_000,
    }],
    interactions: [{
      id: 'interaction-1', sessionId: 'session-1', itemId: 'item-1', lane: 'creative_tech',
      tags: ['neuroai'], sourceKind: 'github', format: 'code', at: AT + 30_000, dayKey: DAY,
      kind: 'reaction', reaction: 'love',
    }],
    checkins: [{ id: 'checkin-1', at: AT + 40_000, dayKey: DAY, mood: 4, energy: 3, focus: 5 }],
    rollups: [{
      id: 'rollup-1', batchId: 'batch-1', dayKey: DAY, dimension: 'topic', key: 'neuroai',
      exposureMs: 60_000, exposures: 1, reactions: 1, explicitInteractions: 1,
      confirmed: 1, contradicted: 0, affinity: 0, interest: 1, surprise: 0, friction: 0,
      confidenceSum: 0.8, intensitySum: 0.7, compactedAt: AT + 100_000,
    }],
  };
}

test('strict longitudinal parser returns a canonical deep copy', () => {
  const input = validArchive();
  input.exposures[0].tags = ['NeuroAI'];
  input.exposures[0].format = 'Code';
  const parsed = parseLongitudinalArchive(input);
  assert.ok(parsed);
  assert.notEqual(parsed, input);
  assert.notEqual(parsed.exposures, input.exposures);
  assert.notEqual(parsed.exposures[0], input.exposures[0]);
  assert.deepEqual(parsed.exposures[0].tags, ['neuroai']);
  assert.equal(parsed.exposures[0].format, 'code');
});

test('parser rejects timestamp/day and exposure-duration contradictions', () => {
  const badDay = structuredClone(validArchive());
  badDay.exposures[0].dayKey = '2026-08-30';
  assert.equal(parseLongitudinalArchive(badDay), null);

  const badDuration = structuredClone(validArchive());
  badDuration.exposures[0].durationMs = 59_000;
  assert.equal(parseLongitudinalArchive(badDuration), null);

  const badReviewTime = structuredClone(validArchive());
  badReviewTime.reactions[0].reviewedAt = AT + 10_000;
  assert.equal(parseLongitudinalArchive(badReviewTime), null);
});

test('parser rejects duplicate normalized tags and duplicate object-store IDs', () => {
  const duplicateTag = structuredClone(validArchive());
  duplicateTag.exposures[0].tags = ['BCI', ' bci '];
  assert.equal(parseLongitudinalArchive(duplicateTag), null);

  const duplicateId = structuredClone(validArchive());
  duplicateId.exposures.push(structuredClone(duplicateId.exposures[0]));
  assert.equal(parseLongitudinalArchive(duplicateId), null);
});

test('parser accepts current source kinds and rejects unknown executable enums', () => {
  const sports = validArchive();
  sports.exposures[0].sourceKind = 'sports_state';
  assert.ok(parseLongitudinalArchive(sports));

  const unknownLane = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (unknownLane.exposures as Array<Record<string, unknown>>)[0].lane = 'invented_lane';
  assert.equal(parseLongitudinalArchive(unknownLane), null);

  const unknownCue = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (unknownCue.reactions as Array<Record<string, unknown>>)[0].kind = 'mind_reading';
  assert.equal(parseLongitudinalArchive(unknownCue), null);
});

test('parser rejects impossible rollup arithmetic and pathological archive size', () => {
  const badRollup = structuredClone(validArchive());
  badRollup.rollups[0].interest = 0;
  assert.equal(parseLongitudinalArchive(badRollup), null);

  const oversized = validArchive() as unknown as Record<string, unknown>;
  oversized.exposures = Array.from({ length: LONGITUDINAL_ARCHIVE_LIMITS.exposures + 1 }, () => ({}));
  assert.equal(parseLongitudinalArchive(oversized), null);
});
