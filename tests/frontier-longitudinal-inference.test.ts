import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends,
} from '../lib/frontier/longitudinalInference';
import type {
  LongitudinalArchive,
  LongitudinalExposure,
  LongitudinalReactionEpisode,
  LongitudinalRollup,
} from '../lib/frontier/longitudinal';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const DAY = 86_400_000;

function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
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

function exposure(id: string, tag: string, at: number, durationMs: number): LongitudinalExposure {
  return {
    id,
    sessionId: 'session-test',
    itemId: id,
    lane: 'creative_tech',
    tags: [tag],
    sourceKind: 'github',
    format: 'code',
    startedAt: at - durationMs,
    endedAt: at,
    dayKey: dayKey(at),
    durationMs,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.85,
  };
}

function reaction(
  id: string,
  tag: string,
  at: number,
  review?: 'confirmed' | 'contradicted',
): LongitudinalReactionEpisode {
  return {
    id,
    sessionId: 'session-test',
    exposureId: `exposure-${id}`,
    itemId: id,
    lane: 'creative_tech',
    tags: [tag],
    sourceKind: 'github',
    format: 'code',
    occurredAt: at,
    dayKey: dayKey(at),
    kind: 'interest',
    confidence: 0.8,
    intensity: 0.7,
    durationMs: 1_200,
    latencyMs: 900,
    targetScore: 0.8,
    visibleFraction: 0.85,
    trustAuthority: 0.9,
    review,
    reviewedAt: review ? at + 500 : undefined,
  };
}

test('sparse reaction rates are shrunk instead of winning on one dramatic event', () => {
  const sparseAt = NOW - 2 * DAY;
  const steadyAt = NOW - DAY;
  const data = archive({
    exposures: [
      exposure('sparse-exposure', 'sparse-topic', sparseAt, 60_000),
      exposure('steady-exposure', 'steady-topic', steadyAt, 20 * 60_000),
    ],
    reactions: [
      reaction('sparse-r1', 'sparse-topic', sparseAt),
      reaction('steady-r1', 'steady-topic', steadyAt),
      reaction('steady-r2', 'steady-topic', steadyAt + 1_000),
      reaction('steady-r3', 'steady-topic', steadyAt + 2_000),
      reaction('steady-r4', 'steady-topic', steadyAt + 3_000),
    ],
  });

  const rates = inferLongitudinalTopicRates(data, 30, NOW);
  const sparse = rates.find((entry) => entry.key === 'sparse-topic');
  const steady = rates.find((entry) => entry.key === 'steady-topic');
  assert.ok(sparse && steady);
  assert.ok(sparse.ratePer10Min < 10, 'one event in one minute must be shrunk below its raw rate');
  assert.ok(sparse.upperPer10Min - sparse.lowerPer10Min > steady.upperPer10Min - steady.lowerPer10Min,
    'sparse topics should retain a wider uncertainty band');
  assert.ok(sparse.evidenceStrength < steady.evidenceStrength);
});

test('trend inference requires exposure, event support, and a material rate shift', () => {
  const previousAt = NOW - 20 * DAY;
  const recentAt = NOW - 5 * DAY;
  const data = archive({
    exposures: [
      exposure('graphics-prev', 'graphics', previousAt, 20 * 60_000),
      exposure('graphics-recent', 'graphics', recentAt, 20 * 60_000),
      exposure('sparse-prev', 'single-flash', previousAt, 30_000),
      exposure('sparse-recent', 'single-flash', recentAt, 30_000),
    ],
    reactions: [
      reaction('graphics-prev-r1', 'graphics', previousAt),
      ...Array.from({ length: 7 }, (_, index) => reaction(`graphics-recent-r${index}`, 'graphics', recentAt + index * 1_000)),
      reaction('single-flash-r1', 'single-flash', recentAt),
    ],
  });

  const trends = inferLongitudinalTopicTrends(data, 14, NOW);
  const graphics = trends.find((entry) => entry.key === 'graphics');
  const sparse = trends.find((entry) => entry.key === 'single-flash');
  assert.ok(graphics && sparse);
  assert.equal(graphics.direction, 'rising');
  assert.ok(graphics.relativeChange > 0.3);
  assert.ok(graphics.signalStrength >= 1.15);
  assert.equal(sparse.direction, 'insufficient');
});

test('raw and compacted topic observations produce equivalent rate estimates', () => {
  const at = NOW - 10 * DAY;
  const raw = archive({
    exposures: [exposure('raw-exposure', 'neuroai', at, 10 * 60_000)],
    reactions: [
      reaction('raw-r1', 'neuroai', at, 'confirmed'),
      reaction('raw-r2', 'neuroai', at + 1_000, 'contradicted'),
    ],
  });

  const rollup: LongitudinalRollup = {
    id: 'rollup-neuroai',
    batchId: 'batch-test',
    dayKey: dayKey(at),
    dimension: 'topic',
    key: 'neuroai',
    exposureMs: 10 * 60_000,
    exposures: 1,
    reactions: 2,
    explicitInteractions: 0,
    confirmed: 1,
    contradicted: 1,
    affinity: 0,
    interest: 2,
    surprise: 0,
    friction: 0,
    confidenceSum: 1.6,
    intensitySum: 1.4,
    compactedAt: NOW,
  };
  const compacted = archive({ rollups: [rollup] });

  const rawEstimate = inferLongitudinalTopicRates(raw, 90, NOW).find((entry) => entry.key === 'neuroai');
  const compactedEstimate = inferLongitudinalTopicRates(compacted, 90, NOW).find((entry) => entry.key === 'neuroai');
  assert.ok(rawEstimate && compactedEstimate);
  assert.equal(rawEstimate.exposureMs, compactedEstimate.exposureMs);
  assert.equal(rawEstimate.reactions, compactedEstimate.reactions);
  assert.equal(rawEstimate.confirmed, compactedEstimate.confirmed);
  assert.equal(rawEstimate.contradicted, compactedEstimate.contradicted);
  assert.equal(rawEstimate.reviewAgreement, 0.5);
  assert.ok(Math.abs(rawEstimate.ratePer10Min - compactedEstimate.ratePer10Min) < 1e-12);
  assert.ok(Math.abs(rawEstimate.lowerPer10Min - compactedEstimate.lowerPer10Min) < 1e-12);
  assert.ok(Math.abs(rawEstimate.upperPer10Min - compactedEstimate.upperPer10Min) < 1e-12);
});
