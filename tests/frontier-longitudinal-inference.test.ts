import assert from 'node:assert/strict';
import test from 'node:test';
import {
  longitudinalDayKey,
  longitudinalDayWindow,
  type LongitudinalArchive,
  type LongitudinalExposure,
  type LongitudinalReactionEpisode,
  type LongitudinalRollup,
} from '../lib/frontier/longitudinal';
import {
  inferLongitudinalMeasurementQuality,
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends,
} from '../lib/frontier/longitudinalInference';

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
    exposures: [],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups: [],
    ...overrides,
  };
}

function exposure(
  id: string,
  tag: string | string[],
  at: number,
  durationMs: number,
): LongitudinalExposure {
  return {
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
}

function reaction(
  id: string,
  tag: string | string[],
  at: number,
  review?: 'confirmed' | 'contradicted',
): LongitudinalReactionEpisode {
  return {
    id,
    sessionId: `session-${longitudinalDayKey(at)}`,
    exposureId: `exposure-${id}`,
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
): LongitudinalRollup {
  return {
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
}

test('longitudinal windows are exact local calendar-day cohorts including today', () => {
  const window = longitudinalDayWindow(90, NOW);
  assert.equal(window.days, 90);
  assert.equal(window.startDay, longitudinalDayKey(localDayOffset(-89)));
  assert.equal(window.endDayExclusive, longitudinalDayKey(localDayOffset(1)));

  const recent = longitudinalDayWindow(14, NOW);
  const previous = longitudinalDayWindow(14, NOW, -14);
  assert.equal(previous.endDayExclusive, recent.startDay, 'trend cohorts must be adjacent and non-overlapping');
  assert.equal(previous.startDay, longitudinalDayKey(localDayOffset(-27)));
  assert.equal(recent.startDay, longitudinalDayKey(localDayOffset(-13)));
});

test('sparse detected-cue rates are shrunk and retain wider 95% uncertainty', () => {
  const sparseAt = localDayOffset(-2);
  const steadyAt = localDayOffset(-1);
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
  assert.equal(sparse.intervalLevel, 0.95);
  assert.ok(sparse.ratePer10Min < 10, 'one event in one minute must be shrunk below its raw rate');
  assert.ok(sparse.upperPer10Min - sparse.lowerPer10Min > steady.upperPer10Min - steady.lowerPer10Min,
    'sparse topics should retain a wider uncertainty band');
  assert.ok(sparse.evidenceStrength < steady.evidenceStrength);
});

test('global shrinkage prior is invariant to how many tags unrelated items carry', () => {
  const at = localDayOffset(-1);
  const targetExposure = exposure('target-exposure', 'target-topic', at, 10 * 60_000);
  const targetReaction = reaction('target-r1', 'target-topic', at);

  const oneTag = archive({
    exposures: [targetExposure, exposure('other-one', ['other'], at, 10 * 60_000)],
    reactions: [targetReaction, reaction('other-one-r1', ['other'], at)],
  });
  const manyTags = archive({
    exposures: [targetExposure, exposure('other-many', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], at, 10 * 60_000)],
    reactions: [targetReaction, reaction('other-many-r1', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], at)],
  });

  const first = inferLongitudinalTopicRates(oneTag, 30, NOW).find((entry) => entry.key === 'target-topic');
  const second = inferLongitudinalTopicRates(manyTags, 30, NOW).find((entry) => entry.key === 'target-topic');
  assert.ok(first && second);
  assert.equal(first.baselinePer10Min, second.baselinePer10Min);
  assert.ok(Math.abs(first.ratePer10Min - second.ratePer10Min) < 1e-12);
});

test('review agreement estimates detected-cue precision and withholds claims before validation', () => {
  const previousAt = localDayOffset(-20);
  const recentAt = localDayOffset(-5);
  const data = archive({
    exposures: [
      exposure('graphics-prev', 'graphics', previousAt, 30 * 60_000),
      exposure('graphics-prev-2', 'graphics', localDayOffset(-19), 30 * 60_000),
      exposure('graphics-recent', 'graphics', recentAt, 30 * 60_000),
      exposure('graphics-recent-2', 'graphics', localDayOffset(-4), 30 * 60_000),
    ],
    reactions: [
      reaction('graphics-prev-r1', 'graphics', previousAt),
      ...Array.from({ length: 8 }, (_, index) => reaction(`graphics-recent-r${index}`, 'graphics', recentAt + index * 1_000)),
    ],
  });

  const quality = inferLongitudinalMeasurementQuality(data, 28, NOW);
  assert.equal(quality.status, 'unvalidated');
  assert.equal(quality.reviewed, 0);
  const trend = inferLongitudinalTopicTrends(data, 14, NOW).find((entry) => entry.key === 'graphics');
  assert.ok(trend);
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'measurement-unvalidated');
});

test('validated trend claims require replication across days and survive multiplicity control', () => {
  const previousDays = [localDayOffset(-21), localDayOffset(-18)];
  const recentDays = [localDayOffset(-7), localDayOffset(-4)];
  const exposures = [
    ...previousDays.map((at, index) => exposure(`graphics-prev-${index}`, 'graphics', at, 30 * 60_000)),
    ...recentDays.map((at, index) => exposure(`graphics-recent-${index}`, 'graphics', at, 30 * 60_000)),
  ];
  const reactions = [
    reaction('graphics-prev-r1', 'graphics', previousDays[0], 'confirmed'),
    reaction('graphics-prev-r2', 'graphics', previousDays[1], 'confirmed'),
    ...Array.from({ length: 12 }, (_, index) => reaction(
      `graphics-recent-r${index}`,
      'graphics',
      recentDays[index % recentDays.length] + index * 1_000,
      'confirmed',
    )),
  ];
  const data = archive({ exposures, reactions });

  const quality = inferLongitudinalMeasurementQuality(data, 28, NOW);
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

test('a one-day burst is not promoted into a longitudinal change claim', () => {
  const previousAt = localDayOffset(-20);
  const recentAt = localDayOffset(-5);
  const reactions = [
    ...Array.from({ length: 4 }, (_, index) => reaction(`prev-${index}`, 'burst', previousAt + index * 1_000, 'confirmed')),
    ...Array.from({ length: 10 }, (_, index) => reaction(`recent-${index}`, 'burst', recentAt + index * 1_000, 'confirmed')),
  ];
  const data = archive({
    exposures: [
      exposure('burst-prev', 'burst', previousAt, 45 * 60_000),
      exposure('burst-recent', 'burst', recentAt, 45 * 60_000),
    ],
    reactions,
  });
  const trend = inferLongitudinalTopicTrends(data, 14, NOW).find((entry) => entry.key === 'burst');
  assert.ok(trend);
  assert.equal(trend.measurement.status, 'supported');
  assert.equal(trend.direction, 'insufficient');
  assert.equal(trend.reason, 'single-day');
});

test('raw and compacted topic observations produce equivalent rate estimates with unique lane baseline', () => {
  const at = localDayOffset(-10);
  const raw = archive({
    exposures: [exposure('raw-exposure', 'neuroai', at, 10 * 60_000)],
    reactions: [
      reaction('raw-r1', 'neuroai', at, 'confirmed'),
      reaction('raw-r2', 'neuroai', at + 1_000, 'contradicted'),
    ],
  });

  const compacted = archive({
    rollups: [
      rollup('rollup-neuroai', 'topic', 'neuroai', at, 10 * 60_000, 2, 1, 1),
      rollup('rollup-lane', 'lane', 'creative_tech', at, 10 * 60_000, 2, 1, 1),
    ],
  });

  const rawEstimate = inferLongitudinalTopicRates(raw, 90, NOW).find((entry) => entry.key === 'neuroai');
  const compactedEstimate = inferLongitudinalTopicRates(compacted, 90, NOW).find((entry) => entry.key === 'neuroai');
  assert.ok(rawEstimate && compactedEstimate);
  assert.equal(rawEstimate.exposureMs, compactedEstimate.exposureMs);
  assert.equal(rawEstimate.exposures, compactedEstimate.exposures);
  assert.equal(rawEstimate.reactions, compactedEstimate.reactions);
  assert.equal(rawEstimate.confirmed, compactedEstimate.confirmed);
  assert.equal(rawEstimate.contradicted, compactedEstimate.contradicted);
  assert.equal(rawEstimate.reviewAgreement, 0.5);
  assert.equal(rawEstimate.baselinePer10Min, compactedEstimate.baselinePer10Min);
  assert.ok(Math.abs(rawEstimate.ratePer10Min - compactedEstimate.ratePer10Min) < 1e-12);
  assert.ok(Math.abs(rawEstimate.lowerPer10Min - compactedEstimate.lowerPer10Min) < 1e-12);
  assert.ok(Math.abs(rawEstimate.upperPer10Min - compactedEstimate.upperPer10Min) < 1e-12);
});

test('window-edge membership cannot change when raw observations are compacted', () => {
  const excludedAt = localDayOffset(-90, 8);
  const includedAt = localDayOffset(-89, 8);

  const raw = archive({
    exposures: [
      exposure('excluded-raw', 'outside-window', excludedAt, 10 * 60_000),
      exposure('included-raw', 'inside-window', includedAt, 10 * 60_000),
    ],
    reactions: [
      reaction('excluded-r1', 'outside-window', excludedAt, 'confirmed'),
      reaction('included-r1', 'inside-window', includedAt, 'confirmed'),
    ],
  });
  const compacted = archive({
    rollups: [
      rollup('excluded-topic', 'topic', 'outside-window', excludedAt, 10 * 60_000, 1, 1, 0),
      rollup('excluded-lane', 'lane', 'creative_tech', excludedAt, 10 * 60_000, 1, 1, 0),
      rollup('included-topic', 'topic', 'inside-window', includedAt, 10 * 60_000, 1, 1, 0),
      rollup('included-lane', 'lane', 'creative_tech', includedAt, 10 * 60_000, 1, 1, 0),
    ],
  });

  const rawRates = inferLongitudinalTopicRates(raw, 90, NOW);
  const compactedRates = inferLongitudinalTopicRates(compacted, 90, NOW);
  assert.equal(rawRates.some((entry) => entry.key === 'outside-window'), false);
  assert.equal(compactedRates.some((entry) => entry.key === 'outside-window'), false);

  const rawIncluded = rawRates.find((entry) => entry.key === 'inside-window');
  const compactedIncluded = compactedRates.find((entry) => entry.key === 'inside-window');
  assert.ok(rawIncluded && compactedIncluded);
  assert.equal(rawIncluded.exposureMs, compactedIncluded.exposureMs);
  assert.equal(rawIncluded.reactions, compactedIncluded.reactions);
  assert.equal(rawIncluded.baselinePer10Min, compactedIncluded.baselinePer10Min);
  assert.ok(Math.abs(rawIncluded.ratePer10Min - compactedIncluded.ratePer10Min) < 1e-12);
});
