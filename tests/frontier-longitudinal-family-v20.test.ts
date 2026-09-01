import assert from 'node:assert/strict';
import test from 'node:test';
import { inferLongitudinalTopicTrends } from '../lib/frontier/longitudinalInference';
import {
  longitudinalDayKey,
  type LongitudinalArchive,
  type LongitudinalRollup,
} from '../lib/frontier/longitudinalModel';

const NOW = new Date(2026, 8, 1, 12, 0, 0, 0).getTime();
const HALF_HOUR = 30 * 60_000;

function dayOffset(days: number): number {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function measuredRollup(
  id: string,
  dimension: 'topic' | 'lane',
  key: string,
  at: number,
  reactions: number,
  exposureMs = HALF_HOUR,
): LongitudinalRollup {
  return {
    id,
    batchId: 'v20-family-test',
    dayKey: longitudinalDayKey(at),
    dimension,
    key,
    exposureMs,
    exposures: 1,
    reactions,
    explicitInteractions: 0,
    confirmed: reactions,
    contradicted: 0,
    affinity: 0,
    interest: reactions,
    surprise: 0,
    friction: 0,
    confidenceSum: reactions * 0.8,
    intensitySum: reactions * 0.7,
    compactedAt: NOW,
    sensorMeasuredWallMs: exposureMs,
    sensorSampledMs: exposureMs,
    faceObservableMs: exposureMs,
    sensorMeasuredExposures: 1,
    sensorMeasuredReactions: reactions,
    sensorMeasuredConfirmed: reactions,
    sensorMeasuredContradicted: 0,
  };
}

test('material-effect filtering happens after the BH family is constructed', () => {
  const previousDays = [dayOffset(-21), dayOffset(-18)];
  const recentDays = [dayOffset(-7), dayOffset(-4)];
  const topicRollups: LongitudinalRollup[] = [];

  const addTopic = (key: string, previousCounts: number[], recentCounts: number[]) => {
    previousDays.forEach((at, index) => topicRollups.push(measuredRollup(`${key}-p${index}`, 'topic', key, at, previousCounts[index])));
    recentDays.forEach((at, index) => topicRollups.push(measuredRollup(`${key}-r${index}`, 'topic', key, at, recentCounts[index])));
  };

  addTopic('strong-change', [1, 1], [6, 6]);
  addTopic('small-change', [20, 20], [25, 25]);
  addTopic('zero-events', [0, 0], [0, 0]);

  const laneRollups = [...previousDays, ...recentDays].map((at, index) => {
    const reactions = index < 2 ? 21 : 31;
    return measuredRollup(`lane-${index}`, 'lane', 'creative_tech', at, reactions, 3 * HALF_HOUR);
  });
  const archive: LongitudinalArchive = {
    schema: 'frontier-longitudinal-v1',
    exportedAt: new Date(NOW).toISOString(),
    exposures: [],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups: [...topicRollups, ...laneRollups],
  };

  const trends = inferLongitudinalTopicTrends(archive, 14, NOW);
  const strong = trends.find((entry) => entry.key === 'strong-change');
  const small = trends.find((entry) => entry.key === 'small-change');
  const zero = trends.find((entry) => entry.key === 'zero-events');
  assert.ok(strong && small && zero);

  assert.equal(strong.reason, 'detected');
  assert.equal(strong.direction, 'rising');
  assert.ok(strong.qValue <= 0.1);

  assert.equal(small.reason, 'small-effect');
  assert.equal(small.direction, 'insufficient');
  assert.ok(small.qValue < 1,
    'a small-effect topic must still receive a BH-adjusted q-value before the materiality gate withholds it');

  assert.equal(zero.pValue, 1);
  assert.equal(zero.reason, 'few-events');
  assert.equal(zero.direction, 'insufficient');
});
