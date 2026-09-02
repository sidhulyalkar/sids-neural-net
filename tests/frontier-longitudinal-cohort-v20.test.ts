import assert from 'node:assert/strict';
import test from 'node:test';
import { inferLongitudinalTopicRates } from '../lib/frontier/longitudinalInference';
import {
  longitudinalDayKey,
  type LongitudinalArchive,
  type LongitudinalExposure,
  type LongitudinalReactionEpisode,
} from '../lib/frontier/longitudinalModel';

const NOW = new Date(2026, 8, 1, 12, 0, 0, 0).getTime();

function baseArchive(): LongitudinalArchive {
  return {
    schema: 'frontier-longitudinal-v1',
    exportedAt: new Date(NOW).toISOString(),
    exposures: [],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups: [],
  };
}

function exposureAt(id: string, endedAt: number): LongitudinalExposure {
  const durationMs = 10 * 60_000;
  return {
    id,
    sessionId: 'session-cross-midnight',
    itemId: id,
    lane: 'creative_tech',
    tags: ['cohort-integrity'],
    sourceKind: 'github',
    format: 'code',
    startedAt: endedAt - durationMs,
    endedAt,
    dayKey: longitudinalDayKey(endedAt),
    durationMs,
    attributionMean: 0.9,
    attributionMin: 0.8,
    visibleFractionMean: 0.9,
  };
}

function reactionAt(id: string, exposureId: string, occurredAt: number): LongitudinalReactionEpisode {
  return {
    id,
    sessionId: 'session-cross-midnight',
    exposureId,
    itemId: exposureId,
    lane: 'creative_tech',
    tags: ['cohort-integrity'],
    sourceKind: 'github',
    format: 'code',
    occurredAt,
    dayKey: longitudinalDayKey(occurredAt),
    kind: 'interest',
    confidence: 0.85,
    intensity: 0.7,
    durationMs: 1_000,
    latencyMs: 2_000,
    targetScore: 0.9,
    visibleFraction: 0.9,
    trustAuthority: 0.9,
  };
}

test('linked reactions inherit the qualified exposure cohort across midnight', () => {
  const exposureEnd = new Date(2026, 7, 31, 23, 59, 58, 0).getTime();
  const sameDayReactionAt = new Date(2026, 7, 31, 23, 59, 59, 0).getTime();
  const nextDayReactionAt = new Date(2026, 8, 1, 0, 0, 1, 0).getTime();

  const linkedExposure = exposureAt('cross-midnight-exposure', exposureEnd);
  const sameDay = baseArchive();
  sameDay.exposures = [linkedExposure];
  sameDay.reactions = [reactionAt('reaction-same-day', linkedExposure.id, sameDayReactionAt)];

  const crossedMidnight = baseArchive();
  crossedMidnight.exposures = [linkedExposure];
  crossedMidnight.reactions = [reactionAt('reaction-next-day', linkedExposure.id, nextDayReactionAt)];

  const sameDayRate = inferLongitudinalTopicRates(sameDay, 1, exposureEnd)
    .find((entry) => entry.key === 'cohort-integrity');
  const crossedRate = inferLongitudinalTopicRates(crossedMidnight, 1, exposureEnd)
    .find((entry) => entry.key === 'cohort-integrity');

  assert.ok(sameDayRate);
  assert.ok(crossedRate);
  assert.equal(crossedRate.attributedExposureMs, sameDayRate.attributedExposureMs);
  assert.equal(crossedRate.totalReactions, sameDayRate.totalReactions);
  assert.equal(crossedRate.observedDays, sameDayRate.observedDays);
  assert.equal(crossedRate.ratePer10Min, sameDayRate.ratePer10Min);
});

test('a reaction cannot enter a day window when its linked exposure is outside that cohort', () => {
  const previousDayExposureEnd = new Date(2026, 7, 31, 23, 59, 58, 0).getTime();
  const currentDayReactionAt = new Date(2026, 8, 1, 0, 0, 1, 0).getTime();
  const linkedExposure = exposureAt('outside-window-exposure', previousDayExposureEnd);
  const data = baseArchive();
  data.exposures = [linkedExposure];
  data.reactions = [reactionAt('inside-clock-day-reaction', linkedExposure.id, currentDayReactionAt)];

  const rates = inferLongitudinalTopicRates(data, 1, NOW);
  assert.equal(rates.some((entry) => entry.key === 'cohort-integrity'), false);
});
