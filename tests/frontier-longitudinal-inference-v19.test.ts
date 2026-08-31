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
    exposures: [], reactions: [], interactions: [], checkins: [], rollups: [],
    ...overrides,
  };
}

function exposure(id: string, tag: string, at: number, durationMs: number): LongitudinalExposure {
  return {
    id, sessionId: 'session-test', itemId: id, lane: 'creative_tech', tags: [tag], sourceKind: 'github', format: 'code',
    startedAt: at - durationMs, endedAt: at, dayKey: longitudinalDayKey(at), durationMs,
    attributionMean: 0.8, attributionMin: 0.7, visibleFractionMean: 0.85,
  };
}

function reaction(
  id: string,
  exposureId: string,
  tag: string,
  at: number,
  review?: 'confirmed' | 'contradicted',
): LongitudinalReactionEpisode {
  return {
    id, sessionId: 'session-test', exposureId, itemId: id, lane: 'creative_tech', tags: [tag],
    sourceKind: 'github', format: 'code', occurredAt: at, dayKey: longitudinalDayKey(at), kind: 'interest',
    confidence: 0.8, intensity: 0.7, durationMs: 1_200, latencyMs: 900, targetScore: 0.8,
    visibleFraction: 0.85, trustAuthority: 0.9, review, reviewedAt: review ? at + 500 : undefined,
  };
}

function topicRollup(
  id: string,
  tag: string,
  at: number,
  exposureMs: number,
  reactions: number,
  confirmed = 0,
  contradicted = 0,
): LongitudinalRollup {
  return {
    id, batchId: 'batch-test', dayKey: longitudinalDayKey(at), dimension: 'topic', key: tag,
    exposureMs, exposures: 1, reactions, explicitInteractions: 0, confirmed, contradicted,
    affinity: 0, interest: reactions, surprise: 0, friction: 0,
    confidenceSum: reactions * 0.8, intensitySum: reactions * 0.7, compactedAt: NOW,
  };
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

test('sparse reaction rates are shrunk instead of winning on one dramatic event', () => {
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
  assert.ok(sparse.ratePer10Min < 10);
  assert.ok(sparse.upperPer10Min - sparse.lowerPer10Min > steady.upperPer10Min - steady.lowerPer10Min);
  assert.ok(sparse.evidenceStrength < steady.evidenceStrength);
});

test('trend inference requires exposure, event support, and a material rate shift', () => {
  const previousAt = localDayOffset(-20);
  const recentAt = localDayOffset(-5);
  const data = archive({
    exposures: [
      exposure('graphics-prev', 'graphics', previousAt, 20 * 60_000),
      exposure('graphics-recent', 'graphics', recentAt, 20 * 60_000),
      exposure('sparse-prev', 'single-flash', previousAt, 30_000),
      exposure('sparse-recent', 'single-flash', recentAt, 30_000),
    ],
    reactions: [
      reaction('graphics-prev-r1', 'graphics-prev', 'graphics', previousAt),
      ...Array.from({ length: 7 }, (_, index) => reaction(
        `graphics-recent-r${index}`,
        'graphics-recent',
        'graphics',
        recentAt + index * 1_000,
      )),
      reaction('single-flash-r1', 'sparse-recent', 'single-flash', recentAt),
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
  const at = localDayOffset(-10);
  const raw = archive({
    exposures: [exposure('raw-exposure', 'neuroai', at, 10 * 60_000)],
    reactions: [
      reaction('raw-r1', 'raw-exposure', 'neuroai', at, 'confirmed'),
      reaction('raw-r2', 'raw-exposure', 'neuroai', at + 1_000, 'contradicted'),
    ],
  });
  const compacted = archive({ rollups: [topicRollup('rollup-neuroai', 'neuroai', at, 10 * 60_000, 2, 1, 1)] });

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

test('window-edge membership cannot change when raw observations are compacted', () => {
  const excludedAt = localDayOffset(-90, 8);
  const includedAt = localDayOffset(-89, 8);
  const raw = archive({
    exposures: [
      exposure('excluded-raw', 'outside-window', excludedAt, 10 * 60_000),
      exposure('included-raw', 'inside-window', includedAt, 10 * 60_000),
    ],
    reactions: [
      reaction('excluded-r1', 'excluded-raw', 'outside-window', excludedAt, 'confirmed'),
      reaction('included-r1', 'included-raw', 'inside-window', includedAt, 'confirmed'),
    ],
  });
  const compacted = archive({
    rollups: [
      topicRollup('excluded-rollup', 'outside-window', excludedAt, 10 * 60_000, 1, 1, 0),
      topicRollup('included-rollup', 'inside-window', includedAt, 10 * 60_000, 1, 1, 0),
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
  assert.ok(Math.abs(rawIncluded.ratePer10Min - compactedIncluded.ratePer10Min) < 1e-12);
});

test('orphan reactions remain observations but have zero rate and trend authority', () => {
  const at = localDayOffset(-2);
  const data = archive({
    exposures: [exposure('qualified', 'graphics', at, 10 * 60_000)],
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
  const exposures = [exposure('qualified-old', 'neuroai', at, 10 * 60_000)];
  const reactions = [
    reaction('linked-old', 'qualified-old', 'neuroai', at, 'confirmed'),
    reaction('orphan-old', 'missing-old', 'neuroai', at + 1_000, 'confirmed'),
  ];
  const rollups = buildLongitudinalRollups(exposures, reactions, [], NOW, 'test-batch');
  const topic = rollups.find((entry) => entry.dimension === 'topic' && entry.key === 'neuroai');
  assert.ok(topic);
  assert.equal(topic.reactions, 1);
  assert.equal(topic.confirmed, 1);
});
