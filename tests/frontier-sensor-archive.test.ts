import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLongitudinalArchive } from '../lib/frontier/longitudinalArchiveValidation';
import type { LongitudinalArchive } from '../lib/frontier/longitudinal';

function validArchive(): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: '2026-08-31T12:00:00.000Z',
    exposures: [{
      id: 'v2-exposure',
      sessionId: 'session-v2',
      itemId: 'item-v2',
      lane: 'creative_tech',
      tags: ['graphics'],
      sourceKind: 'github',
      format: 'code',
      startedAt: 1_000,
      endedAt: 61_000,
      dayKey: '2026-08-31',
      durationMs: 60_000,
      attributionMean: 0.8,
      attributionMin: 0.7,
      visibleFractionMean: 0.85,
      measurementVersion: 2,
      sensorSampledMs: 50_000,
      faceObservableMs: 35_000,
    }],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups: [{
      id: 'sensor-rollup',
      batchId: 'batch-sensor',
      dayKey: '2026-07-01',
      dimension: 'topic',
      key: 'graphics',
      exposureMs: 120_000,
      exposures: 2,
      reactions: 3,
      explicitInteractions: 1,
      confirmed: 2,
      contradicted: 1,
      affinity: 0,
      interest: 3,
      surprise: 0,
      friction: 0,
      confidenceSum: 2.1,
      intensitySum: 1.8,
      sensorMeasuredWallMs: 90_000,
      sensorSampledMs: 75_000,
      faceObservableMs: 50_000,
      sensorMeasuredExposures: 1,
      sensorMeasuredReactions: 2,
      sensorMeasuredConfirmed: 1,
      sensorMeasuredContradicted: 1,
      compactedAt: 200_000,
    }],
  };
}

test('strict archive parser preserves valid v2 observability fields', () => {
  const input = validArchive();
  const parsed = parseLongitudinalArchive(input);
  assert.ok(parsed);
  assert.equal(parsed.exposures[0].measurementVersion, 2);
  assert.equal(parsed.exposures[0].sensorSampledMs, 50_000);
  assert.equal(parsed.exposures[0].faceObservableMs, 35_000);
  assert.equal(parsed.rollups[0].sensorMeasuredWallMs, 90_000);
  assert.equal(parsed.rollups[0].sensorMeasuredReactions, 2);
});

test('v2 exposure fields are all-or-none and physically nested', () => {
  const partial = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  delete (partial.exposures as Array<Record<string, unknown>>)[0].faceObservableMs;
  assert.equal(parseLongitudinalArchive(partial), null);

  const badSample = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (badSample.exposures as Array<Record<string, unknown>>)[0].sensorSampledMs = 70_000;
  assert.equal(parseLongitudinalArchive(badSample), null);

  const badFace = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (badFace.exposures as Array<Record<string, unknown>>)[0].faceObservableMs = 55_000;
  assert.equal(parseLongitudinalArchive(badFace), null);
});

test('v2 rollup coverage fields are all-or-none and cannot exceed parent totals', () => {
  const partial = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  delete (partial.rollups as Array<Record<string, unknown>>)[0].faceObservableMs;
  assert.equal(parseLongitudinalArchive(partial), null);

  const tooMuchFace = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (tooMuchFace.rollups as Array<Record<string, unknown>>)[0].faceObservableMs = 80_000;
  assert.equal(parseLongitudinalArchive(tooMuchFace), null);

  const tooManyMeasuredReactions = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (tooManyMeasuredReactions.rollups as Array<Record<string, unknown>>)[0].sensorMeasuredReactions = 4;
  assert.equal(parseLongitudinalArchive(tooManyMeasuredReactions), null);

  const impossibleMeasuredReviews = structuredClone(validArchive()) as unknown as Record<string, unknown>;
  (impossibleMeasuredReviews.rollups as Array<Record<string, unknown>>)[0].sensorMeasuredConfirmed = 2;
  (impossibleMeasuredReviews.rollups as Array<Record<string, unknown>>)[0].sensorMeasuredContradicted = 1;
  assert.equal(parseLongitudinalArchive(impossibleMeasuredReviews), null);
});

test('legacy archives without sensor observability fields remain valid', () => {
  const legacy = validArchive();
  delete legacy.exposures[0].measurementVersion;
  delete legacy.exposures[0].sensorSampledMs;
  delete legacy.exposures[0].faceObservableMs;
  for (const key of [
    'sensorMeasuredWallMs', 'sensorSampledMs', 'faceObservableMs',
    'sensorMeasuredExposures', 'sensorMeasuredReactions',
    'sensorMeasuredConfirmed', 'sensorMeasuredContradicted',
  ] as const) {
    delete legacy.rollups[0][key];
  }
  assert.ok(parseLongitudinalArchive(legacy));
});
