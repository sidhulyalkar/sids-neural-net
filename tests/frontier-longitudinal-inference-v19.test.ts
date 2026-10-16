import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLongitudinalRollups, summarizeLongitudinalData } from '../lib/frontier/longitudinalAggregation';
import {
  longitudinalDayKey,
  longitudinalDayWindow,
  type LongitudinalArchive,
  type LongitudinalExposure,
  type LongitudinalReactionEpisode,
  type LongitudinalRollup,
} from '../lib/frontier/longitudinalModel';
import {
  inferLongitudinalMeasurementQuality,
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends,
} from '../lib/frontier/longitudinalInference';
import { FRONTIER_SENSOR_MEASUREMENT_VERSION } from '../lib/frontier/sensorObservability';

const NOW = new Date(2026, 7, 30, 12, 0, 0, 0).getTime();

function localDayOffset(days: number, hour = 12): number {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

function archive(overrides: Partial<LongitudinalArchive> = {}): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: new Date(NOW).toISOString(),
    exposures: [], reactions: [], interactions: [], checkins: [], rollups: [],
    ...overrides,
  };
}

type Measurement = false | { sampled?: number; observable?: number };

function exposure(
  id: string,
  tag: string | string[],
  at: number,
  durationMs: number,
  measurement: Measurement = false,
): LongitudinalExposure {
  const base: LongitudinalExposure = {
    id,
    sessionId: `session-${longitudinalDayKey(at)}`,
    itemId: id,
    lane: 'creative_tech',
    tags: Array.isArray(tag) ? tag : [tag],
    sourceKind: 'github',
    format: 'code',
    startedAt: at - durationMs,
    endedAt: at,
    dayKey: longitudinalDayKey(at),
    durationMs,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.85,
  };
  if (measurement) {
    base.measurementVersion = FRONTIER_SENSOR_MEASUREMENT_VERSION;
    base.sensorSampledMs = measurement.sampled ?? durationMs * 0.9;
    base.faceObservableMs = measurement.observable ?? durationMs * 0.8;
  }
  return base;
}

function reaction(
  id: string,
  exposureId: string,
  tag: string | string[],
  at: number,
  review?: 'confirmed' | 'contradicted',
): LongitudinalReactionEpisode {
  return {
    id,
    sessionId: `session-${longitudinalDayKey(at)}`,
    exposureId,
    itemId: id,
    lane: 'creative_tech',
    tags: Array.isArray(tag) ? tag : [tag],
    sourceKind: 'github',
    format: 'code',
    occurredAt: at,
    dayKey: longitudinalDayKey(at),
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

function rollup(
  id: string,
  dimension: 'topic' | 'lane',
  key: string,
  at: number,
  exposureMs: number,
  reactions: number,
  confirmed = 0,
  contradicted = 0,
  measured = false,
): LongitudinalRollup {
  const base: LongitudinalRollup = {
    id,
    batchId: 'batch-test',
    dayKey: longitudinalDayKey(at),
    dimension,
    key,
    exposureMs,
    exposures: 1,
    reactions,
    explicitInteractions: 0,
    confirmed,
    contradicted,
    affinity: 0,
    interest: reactions,
    surprise: 0,
    friction: 0,
    confidenceSum: reactions * 0.8,
    intensitySum: reactions * 0.7,
    compactedAt: NOW,
  };
  if (measured) {
    base.sensorMeasuredWallMs = exposureMs;
    base.sensorSampledMs = exposureMs * 0.9;
    base.faceObservableMs = exposureMs * 0.8;
    base.sensorMeasuredExposures = 1;
    base.sensorMeasuredReactions = reactions;
    base.sensorMeasuredConfirmed = confirmed;
    base.sensorMeasuredContradicted = contradicted;
  }
  return base;
}

test('longitudinal windows are exact local calendar-day cohorts including today', () => {
  const window = longitudinalDayWindow(90, NOW);
  assert.equal(window.days, 90);
  assert.equal(window.startDay, longitudinalDayKey(localDayOffset(-89)));
  assert.equal(window.endDayExclusive, longitudinalDayKey(localDayOffset(1)));
  const recent = longitudinalDayWindow(14, NOW);
  const previous = longitudinalDayWindow(14, NOW, -14);
  assert.equal(previous.endDayExclusive, recent.startDay);
  assert.equal(previous.startDay, longitudinalDayKey(localDayOffset(-27)));
  assert.equal(recent.startDay, longitudinalDayKey(localDayOffset(-13)));
});

test('sparse detected-cue rates shrink and retain wider 95% uncertainty', () => {
  const sparseAt = localDayOffset(-2);
  const steadyAt = localDayOffset(-1);
  const data = archive({
    exposures: [
      exposure('sparse-exposure', 'sparse-topic', sparseAt, 60_000),
      exposure('steady-exposure', 'steady-topic', steadyAt, 20 * 60_000),
    ],
    reactions: [
      reaction('sparse-r1', 'sparse-exposure', 'sparse-topic', sparseAt),
      reaction('steady-r1', 'steady-exposure', 'steady-topic', steadyAt),
      reaction('steady-r2', 'steady-exposure', 'steady-topic', steadyAt + 1_000),
      reaction('steady-r3', 'steady-exposure', 'steady-topic', steadyAt + 2_000),
      reaction('steady-r4', 'steady-exposure', 'steady-topic', steadyAt + 3_000),
    ],
  });
  const rates = inferLongitudinalTopicRates(data, 30, NOW);
  const sparse = rates.find((entry) => entry.key === 'sparse-topic');
  const steady = rates.find((entry) => entry.key === 'steady-topic');
  assert.ok(sparse && steady);
  assert.equal(sparse.intervalLevel, 0.95);
  assert.ok(sparse.ratePer10Min < 10);
  assert.ok(sparse.upperPer10Min - sparse.lowerPer10Min > steady.upperPer10Min - steady.lowerPer10Min);
  assert.ok(sparse.evidenceStrength < steady.evidenceStrength);
});

test('global shrinkage prior is invariant to unrelated tag multiplicity', () => {
  const at = localDayOffset(-1);
  const oneTag = archive({
    exposures: [exposure('target-one', 'target-topic', at, 10 * 60_000), exposure('other-one', ['other'], at, 10 * 60_000)],
    reactions: [reaction('target-r1', 'target-one', 'target-topic', at), reaction('other-r1', 'other-one', ['other'], at)],
  });
  const manyTags = archive({
    exposures: [
      exposure('target-many', 'target-topic', at, 10 * 60_000),
      exposure('other-many', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], at, 10 * 60_000),
    ],
    reactions: [
      reaction('target-r2', 'target-many', 'target-topic', at),
      reaction('other-r2', 'other-many', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], at),
    ],
  });
  const first = inferLongitudinalTopicRates(oneTag, 30, NOW).find((entry) => entry.key === 'target-topic');
  const second = inferLongitudinalTopicRates(manyTags, 30, NOW).find((entry) => entry.key === 'target-topic');
  assert.ok(first && second);
  assert.equal(first.baselinePer10Min, second.baselinePer10Min);
  assert.ok(Math.abs(first.ratePer10Min - second.ratePer10Min) < 1e-12);
});

test('unreviewed v2 cue streams remain descriptive and cannot produce trend claims', () => {
  const previousDays = [localDayOffset(-21), localDayOffset(-18)];
  const recentDays = [localDayOffset(-7), localDayOffset(-4)];
  const exposures = [
    ...previousDays.map((at, index) => exposure(`unreviewed-prev-${index}`, 'graphics', at, 30 * 60_000, {})),
    ...recentDays.map((at, index) => exposure(`unreviewed-recent-${index}`, 'graphics', at, 30 * 60_000, {})),
  ];
  const reactions = [
    reaction('unreviewed-prev-r1', 'unreviewed-prev-0', 'graphics', previousDays[0]),
    reaction('unreviewed-prev-r2', 'unreviewed-prev-1', 'graphics', previousDays[1]),
    ...Array.from({ length: 10 }, (_, index) => reaction(
      `unreviewed-recent-r${index}`,
      `unreviewed-recent-${index % 2}`,
      'graphics',
      recentDays[index % 2] + index * 1_000,
    )),
  ];
  const data = archive({ exposures, reactions });
  const quality = inferLongitudinalMeasurementQuality(data, 28, NOW);
  assert.equal(quality.mode, 'sensor-v2');
  assert.equal(quality.status, 'unvalidated');
  assert.equal(quality.reviewed, 0);
  const trend = inferLongitudinalTopicTrends(data, 14, NOW).find((entry) => entry.key === 'graphics');
  assert.ok(trend);
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'measurement-unvalidated');
});

test('validated v2 trend claims require replicated days and survive multiplicity control', () => {
  const previousDays = [localDayOffset(-21), localDayOffset(-18)];
  const recentDays = [localDayOffset(-7), localDayOffset(-4)];
  const exposures = [
    ...previousDays.map((at, index) => exposure(`graphics-prev-${index}`, 'graphics', at, 30 * 60_000, {})),
    ...recentDays.map((at, index) => exposure(`graphics-recent-${index}`, 'graphics', at, 30 * 60_000, {})),
  ];
  const reactions = [
    reaction('graphics-prev-r1', 'graphics-prev-0', 'graphics', previousDays[0], 'confirmed'),
    reaction('graphics-prev-r2', 'graphics-prev-1', 'graphics', previousDays[1], 'confirmed'),
    ...Array.from({ length: 12 }, (_, index) => reaction(
      `graphics-recent-r${index}`,
      `graphics-recent-${index % 2}`,
      'graphics',
      recentDays[index % 2] + index * 1_000,
      'confirmed',
    )),
  ];
  const data = archive({ exposures, reactions });
  const quality = inferLongitudinalMeasurementQuality(data, 28, NOW);
  assert.equal(quality.mode, 'sensor-v2');
  assert.equal(quality.status, 'supported');
  assert.equal(quality.reviewAgreement, 1);
  const graphics = inferLongitudinalTopicTrends(data, 14, NOW).find((entry) => entry.key === 'graphics');
  assert.ok(graphics);
  assert.equal(graphics.direction, 'rising');
  assert.equal(graphics.reason, 'detected');
  assert.ok(graphics.recent.observedDays >= 2);
  assert.ok(graphics.previous.observedDays >= 2);
  assert.ok(graphics.relativeChange > 0.35);
  assert.ok(graphics.qValue <= 0.1);
});

test('low sensor coverage blocks v2 longitudinal claims', () => {
  const previousDays = [localDayOffset(-21), localDayOffset(-18)];
  const recentDays = [localDayOffset(-7), localDayOffset(-4)];
  const duration = 30 * 60_000;
  const low = { sampled: duration * 0.3, observable: duration * 0.25 };
  const exposures = [
    ...previousDays.map((at, index) => exposure(`coverage-prev-${index}`, 'coverage', at, duration, low)),
    ...recentDays.map((at, index) => exposure(`coverage-recent-${index}`, 'coverage', at, duration, low)),
  ];
  const reactions = Array.from({ length: 12 }, (_, index) => reaction(
    `coverage-r${index}`,
    index < 4 ? `coverage-prev-${index % 2}` : `coverage-recent-${index % 2}`,
    'coverage',
    index < 4 ? previousDays[index % 2] + index * 1_000 : recentDays[index % 2] + index * 1_000,
    'confirmed',
  ));
  const trend = inferLongitudinalTopicTrends(archive({ exposures, reactions }), 14, NOW).find((entry) => entry.key === 'coverage');
  assert.ok(trend);
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'sensor-sampling-low');
});

test('a v1 to v2 instrumentation transition can never masquerade as personal change', () => {
  const previousDays = [localDayOffset(-21), localDayOffset(-18)];
  const recentDays = [localDayOffset(-7), localDayOffset(-4)];
  const exposures = [
    ...previousDays.map((at, index) => exposure(`transition-prev-${index}`, 'transition', at, 30 * 60_000)),
    ...recentDays.map((at, index) => exposure(`transition-recent-${index}`, 'transition', at, 30 * 60_000, {})),
  ];
  const reactions = [
    reaction('transition-prev-r1', 'transition-prev-0', 'transition', previousDays[0], 'confirmed'),
    reaction('transition-prev-r2', 'transition-prev-1', 'transition', previousDays[1], 'confirmed'),
    ...Array.from({ length: 10 }, (_, index) => reaction(
      `transition-recent-r${index}`,
      `transition-recent-${index % 2}`,
      'transition',
      recentDays[index % 2] + index * 1_000,
      'confirmed',
    )),
  ];
  const trend = inferLongitudinalTopicTrends(archive({ exposures, reactions }), 14, NOW).find((entry) => entry.key === 'transition');
  assert.ok(trend);
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'measurement-transition');
});

test('a one-day v2 burst is not promoted into a longitudinal change claim', () => {
  const previousAt = localDayOffset(-20);
  const recentAt = localDayOffset(-5);
  const data = archive({
    exposures: [
      exposure('burst-prev', 'burst', previousAt, 45 * 60_000, {}),
      exposure('burst-recent', 'burst', recentAt, 45 * 60_000, {}),
    ],
    reactions: [
      ...Array.from({ length: 4 }, (_, index) => reaction(`burst-prev-r${index}`, 'burst-prev', 'burst', previousAt + index * 1_000, 'confirmed')),
      ...Array.from({ length: 10 }, (_, index) => reaction(`burst-recent-r${index}`, 'burst-recent', 'burst', recentAt + index * 1_000, 'confirmed')),
    ],
  });
  const trend = inferLongitudinalTopicTrends(data, 14, NOW).find((entry) => entry.key === 'burst');
  assert.ok(trend);
  assert.equal(trend.measurement.status, 'supported');
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'single-day');
});

test('raw and compacted v2 observations produce equivalent estimates', () => {
  const at = localDayOffset(-10);
  const raw = archive({
    exposures: [exposure('raw-exposure', 'neuroai', at, 10 * 60_000, {})],
    reactions: [
      reaction('raw-r1', 'raw-exposure', 'neuroai', at, 'confirmed'),
      reaction('raw-r2', 'raw-exposure', 'neuroai', at + 1_000, 'contradicted'),
    ],
  });
  const compacted = archive({
    rollups: [
      rollup('rollup-neuroai', 'topic', 'neuroai', at, 10 * 60_000, 2, 1, 1, true),
      rollup('rollup-lane', 'lane', 'creative_tech', at, 10 * 60_000, 2, 1, 1, true),
    ],
  });
  const rawEstimate = inferLongitudinalTopicRates(raw, 90, NOW).find((entry) => entry.key === 'neuroai');
  const compactedEstimate = inferLongitudinalTopicRates(compacted, 90, NOW).find((entry) => entry.key === 'neuroai');
  assert.ok(rawEstimate && compactedEstimate);
  assert.equal(rawEstimate.measurementMode, 'sensor-v2');
  assert.equal(compactedEstimate.measurementMode, 'sensor-v2');
  assert.equal(rawEstimate.exposureMs, compactedEstimate.exposureMs);
  assert.equal(rawEstimate.reactions, compactedEstimate.reactions);
  assert.equal(rawEstimate.baselinePer10Min, compactedEstimate.baselinePer10Min);
  assert.ok(Math.abs(rawEstimate.ratePer10Min - compactedEstimate.ratePer10Min) < 1e-12);
  assert.ok(Math.abs(rawEstimate.lowerPer10Min - compactedEstimate.lowerPer10Min) < 1e-12);
  assert.ok(Math.abs(rawEstimate.upperPer10Min - compactedEstimate.upperPer10Min) < 1e-12);
});

test('orphan reactions remain observations but have zero rate and trend authority', () => {
  const at = localDayOffset(-2);
  const data = archive({
    exposures: [exposure('qualified', 'graphics', at, 10 * 60_000, {})],
    reactions: [
      reaction('linked', 'qualified', 'graphics', at, 'confirmed'),
      reaction('orphan', 'missing-exposure', 'graphics', at + 1_000, 'confirmed'),
    ],
  });
  const estimate = inferLongitudinalTopicRates(data, 30, NOW).find((entry) => entry.key === 'graphics');
  assert.ok(estimate);
  assert.equal(estimate.reactions, 1);
  assert.equal(estimate.confirmed, 1);
  const summary = summarizeLongitudinalData({
    days: 30,
    exposures: data.exposures,
    reactions: data.reactions,
    interactions: [],
    checkins: [],
    rollups: [],
  });
  assert.equal(summary.reactions, 1);
  assert.equal(summary.confirmed, 1);
});

test('compaction cannot grant an orphan reaction aggregate authority', () => {
  const at = localDayOffset(-140);
  const exposures = [exposure('qualified-old', 'neuroai', at, 10 * 60_000, {})];
  const reactions = [
    reaction('linked-old', 'qualified-old', 'neuroai', at, 'confirmed'),
    reaction('orphan-old', 'missing-old', 'neuroai', at + 1_000, 'confirmed'),
  ];
  const rollups = buildLongitudinalRollups(exposures, reactions, [], NOW, 'test-batch');
  const topic = rollups.find((entry) => entry.dimension === 'topic' && entry.key === 'neuroai');
  assert.ok(topic);
  assert.equal(topic.reactions, 1);
  assert.equal(topic.confirmed, 1);
  assert.equal(topic.sensorMeasuredReactions, 1);
});