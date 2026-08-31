import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLongitudinalRollups,
  longitudinalDayKey,
  type LongitudinalArchive,
  type LongitudinalExposure,
  type LongitudinalReactionEpisode,
} from '../lib/frontier/longitudinal';
import {
  inferLongitudinalMeasurementQuality,
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends,
} from '../lib/frontier/longitudinalInference';

const NOW = new Date(2026, 7, 30, 12, 0, 0, 0).getTime();

function atOffset(days: number): number {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

function archive(overrides: Partial<LongitudinalArchive> = {}): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: new Date(NOW).toISOString(),
    exposures: [],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups: [],
    ...overrides,
  };
}

function exposure(input: {
  id: string;
  day: number;
  tag?: string;
  wallMs?: number;
  sampledMs?: number;
  faceMs?: number;
  measured?: boolean;
}): LongitudinalExposure {
  const at = atOffset(input.day);
  const wallMs = input.wallMs ?? 20 * 60_000;
  const common = {
    id: input.id,
    sessionId: `session-${input.id}`,
    itemId: input.id,
    lane: 'creative_tech' as const,
    tags: [input.tag ?? 'graphics'],
    sourceKind: 'github' as const,
    format: 'code',
    startedAt: at - wallMs,
    endedAt: at,
    dayKey: longitudinalDayKey(at),
    durationMs: wallMs,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.85,
  };
  if (input.measured === false) return common;
  return {
    ...common,
    measurementVersion: 2,
    sensorSampledMs: input.sampledMs ?? wallMs,
    faceObservableMs: input.faceMs ?? input.sampledMs ?? wallMs,
  };
}

function reaction(input: {
  id: string;
  exposure: LongitudinalExposure;
  review?: 'confirmed' | 'contradicted';
  offsetMs?: number;
}): LongitudinalReactionEpisode {
  const occurredAt = input.exposure.startedAt + (input.offsetMs ?? 10_000);
  return {
    id: input.id,
    sessionId: input.exposure.sessionId,
    exposureId: input.exposure.id,
    itemId: input.exposure.itemId,
    lane: input.exposure.lane,
    tags: [...input.exposure.tags],
    sourceKind: input.exposure.sourceKind,
    format: input.exposure.format,
    occurredAt,
    dayKey: input.exposure.dayKey,
    kind: 'interest',
    confidence: 0.8,
    intensity: 0.7,
    durationMs: 1_200,
    latencyMs: input.offsetMs ?? 10_000,
    targetScore: 0.8,
    visibleFraction: 0.85,
    trustAuthority: 0.9,
    ...(input.review ? { review: input.review, reviewedAt: occurredAt + 500 } : {}),
  };
}

test('once v2 measurements exist, scientific topic rates exclude legacy camera-on history', () => {
  const legacy = exposure({ id: 'legacy', day: -3, wallMs: 60 * 60_000, measured: false });
  const measured = exposure({ id: 'measured', day: -2, wallMs: 20 * 60_000, sampledMs: 18 * 60_000, faceMs: 10 * 60_000 });
  const reactions = [
    ...Array.from({ length: 20 }, (_, index) => reaction({ id: `legacy-r${index}`, exposure: legacy })),
    reaction({ id: 'measured-r1', exposure: measured, review: 'confirmed' }),
  ];
  const rates = inferLongitudinalTopicRates(archive({ exposures: [legacy, measured], reactions }), 30, NOW);
  const graphics = rates.find((entry) => entry.key === 'graphics');
  assert.ok(graphics);
  assert.equal(graphics.measurementBasis, 'sensor-observable-v2');
  assert.equal(graphics.exposureMs, 10 * 60_000);
  assert.equal(graphics.reactions, 1);
  assert.equal(graphics.exposures, 1);
  assert.ok(Math.abs((graphics.sensorSamplingCoverage ?? 0) - 0.9) < 1e-12);
  assert.ok(Math.abs((graphics.faceObservability ?? 0) - (10 / 18)) < 1e-12);
});

test('review validation restarts on the v2-linked cue population rather than inheriting legacy trust', () => {
  const legacy = exposure({ id: 'legacy-validation', day: -4, wallMs: 30 * 60_000, measured: false });
  const measured = exposure({ id: 'v2-validation', day: -2, wallMs: 20 * 60_000, sampledMs: 18 * 60_000, faceMs: 15 * 60_000 });
  const reactions = [
    ...Array.from({ length: 20 }, (_, index) => reaction({ id: `legacy-confirmed-${index}`, exposure: legacy, review: 'confirmed' })),
    reaction({ id: 'v2-confirmed-1', exposure: measured, review: 'confirmed' }),
  ];
  const quality = inferLongitudinalMeasurementQuality(archive({ exposures: [legacy, measured], reactions }), 30, NOW);
  assert.equal(quality.basis, 'sensor-observable-v2');
  assert.equal(quality.reviewed, 1);
  assert.equal(quality.status, 'unvalidated');
});

test('the v1 to v2 deployment boundary cannot become a personal longitudinal trend', () => {
  const previousA = exposure({ id: 'previous-a', day: -22, measured: false, wallMs: 30 * 60_000 });
  const previousB = exposure({ id: 'previous-b', day: -18, measured: false, wallMs: 30 * 60_000 });
  const recentA = exposure({ id: 'recent-a', day: -7, wallMs: 30 * 60_000, sampledMs: 27 * 60_000, faceMs: 24 * 60_000 });
  const recentB = exposure({ id: 'recent-b', day: -4, wallMs: 30 * 60_000, sampledMs: 27 * 60_000, faceMs: 24 * 60_000 });
  const reactions = [
    reaction({ id: 'prev-r1', exposure: previousA, review: 'confirmed' }),
    reaction({ id: 'prev-r2', exposure: previousB, review: 'confirmed' }),
    ...Array.from({ length: 10 }, (_, index) => reaction({
      id: `recent-r${index}`,
      exposure: index % 2 ? recentA : recentB,
      review: 'confirmed',
      offsetMs: 10_000 + index * 1_000,
    })),
  ];
  const trend = inferLongitudinalTopicTrends(
    archive({ exposures: [previousA, previousB, recentA, recentB], reactions }),
    14,
    NOW,
  ).find((entry) => entry.key === 'graphics');
  assert.ok(trend);
  assert.equal(trend.measurement.basis, 'sensor-observable-v2');
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'measurement-transition');
});

test('poor callback coverage blocks v2 trend claims even with ample face-observable exposure', () => {
  const previousA = exposure({ id: 'coverage-prev-a', day: -22, wallMs: 30 * 60_000, sampledMs: 15 * 60_000, faceMs: 15 * 60_000 });
  const previousB = exposure({ id: 'coverage-prev-b', day: -18, wallMs: 30 * 60_000, sampledMs: 15 * 60_000, faceMs: 15 * 60_000 });
  const recentA = exposure({ id: 'coverage-recent-a', day: -7, wallMs: 30 * 60_000, sampledMs: 15 * 60_000, faceMs: 15 * 60_000 });
  const recentB = exposure({ id: 'coverage-recent-b', day: -4, wallMs: 30 * 60_000, sampledMs: 15 * 60_000, faceMs: 15 * 60_000 });
  const reactions = [
    ...Array.from({ length: 4 }, (_, index) => reaction({
      id: `coverage-prev-r${index}`,
      exposure: index % 2 ? previousA : previousB,
      review: 'confirmed',
      offsetMs: 10_000 + index * 1_000,
    })),
    ...Array.from({ length: 10 }, (_, index) => reaction({
      id: `coverage-recent-r${index}`,
      exposure: index % 2 ? recentA : recentB,
      review: 'confirmed',
      offsetMs: 10_000 + index * 1_000,
    })),
  ];
  const trend = inferLongitudinalTopicTrends(
    archive({ exposures: [previousA, previousB, recentA, recentB], reactions }),
    14,
    NOW,
  ).find((entry) => entry.key === 'graphics');
  assert.ok(trend);
  assert.equal(trend.measurement.status, 'supported');
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'low-sensor-coverage');
  assert.ok((trend.recent.sensorSamplingCoverage ?? 1) < 0.6);
  assert.ok((trend.previous.sensorSamplingCoverage ?? 1) < 0.6);
});

test('v2 scientific rates are invariant to raw versus compacted representation', () => {
  const measured = exposure({ id: 'compact-measured', day: -10, wallMs: 20 * 60_000, sampledMs: 18 * 60_000, faceMs: 12 * 60_000, tag: 'neuroai' });
  const reactions = [
    reaction({ id: 'compact-r1', exposure: measured, review: 'confirmed' }),
    reaction({ id: 'compact-r2', exposure: measured, review: 'contradicted', offsetMs: 20_000 }),
  ];
  const rawArchive = archive({ exposures: [measured], reactions });
  const compactedArchive = archive({
    rollups: buildLongitudinalRollups([measured], reactions, [], NOW, 'v2-inference-batch'),
  });

  const raw = inferLongitudinalTopicRates(rawArchive, 30, NOW).find((entry) => entry.key === 'neuroai');
  const compacted = inferLongitudinalTopicRates(compactedArchive, 30, NOW).find((entry) => entry.key === 'neuroai');
  assert.ok(raw && compacted);
  assert.equal(raw.measurementBasis, 'sensor-observable-v2');
  assert.equal(compacted.measurementBasis, 'sensor-observable-v2');
  assert.equal(raw.exposureMs, compacted.exposureMs);
  assert.equal(raw.reactions, compacted.reactions);
  assert.equal(raw.confirmed, compacted.confirmed);
  assert.equal(raw.contradicted, compacted.contradicted);
  assert.equal(raw.baselinePer10Min, compacted.baselinePer10Min);
  assert.equal(raw.sensorSamplingCoverage, compacted.sensorSamplingCoverage);
  assert.equal(raw.faceObservability, compacted.faceObservability);
  assert.ok(Math.abs(raw.ratePer10Min - compacted.ratePer10Min) < 1e-12);
  assert.ok(Math.abs(raw.lowerPer10Min - compacted.lowerPer10Min) < 1e-12);
  assert.ok(Math.abs(raw.upperPer10Min - compacted.upperPer10Min) < 1e-12);
});
