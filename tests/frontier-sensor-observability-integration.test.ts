import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLongitudinalRollups,
  createLongitudinalExposure,
  createLongitudinalReaction,
  summarizeLongitudinalData,
} from '../lib/frontier/longitudinal';
import type { FrontierItem } from '../lib/frontier/types';

function item(id = 'observability-item', tag = 'graphics'): FrontierItem {
  return {
    id,
    title: id,
    summary: 'sensor observability integration fixture',
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-30T12:00:00.000Z',
    lane: 'creative_tech',
    tags: [tag],
    baseScore: 0.6,
    importance: 0.6,
    novelty: 0.7,
    quality: 0.8,
    momentum: 0.5,
  };
}

test('legacy exposures remain explicitly outside the v2 sensor measurement regime', () => {
  const signal = item('legacy');
  const startedAt = Date.parse('2026-08-30T12:00:00.000Z');
  const exposure = createLongitudinalExposure(signal, {
    startedAt,
    endedAt: startedAt + 60_000,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.8,
  });

  assert.equal(exposure.measurementVersion, undefined);
  assert.equal(exposure.sensorSampledMs, undefined);
  assert.equal(exposure.faceObservableMs, undefined);
});

test('v2 exposure creation bounds observability inside sampled and wall duration', () => {
  const signal = item('bounded');
  const startedAt = Date.parse('2026-08-30T12:00:00.000Z');
  const exposure = createLongitudinalExposure(signal, {
    startedAt,
    endedAt: startedAt + 60_000,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.8,
    sensorSampledMs: 90_000,
    faceObservableMs: 80_000,
  });

  assert.equal(exposure.measurementVersion, 2);
  assert.equal(exposure.sensorSampledMs, 60_000);
  assert.equal(exposure.faceObservableMs, 60_000);
});

test('raw and compacted summaries preserve the complete v2 missingness denominator', () => {
  const signal = item('compact-v2', 'neuroai');
  const startedAt = Date.parse('2026-01-10T12:00:00.000Z');
  const exposure = createLongitudinalExposure(signal, {
    startedAt,
    endedAt: startedAt + 180_000,
    attributionMean: 0.76,
    attributionMin: 0.65,
    visibleFractionMean: 0.81,
    sensorSampledMs: 150_000,
    faceObservableMs: 96_000,
  });
  const reaction = createLongitudinalReaction(signal, {
    kind: 'interest', confidence: 0.8, intensity: 0.75, durationMs: 1_100, observedAt: 1,
  }, {
    exposureId: exposure.id,
    occurredAt: startedAt + 30_000,
    latencyMs: 30_000,
    targetScore: 0.8,
    visibleFraction: 0.82,
    trustAuthority: 0.9,
  });
  reaction.review = 'confirmed';
  reaction.reviewedAt = startedAt + 31_000;

  const raw = summarizeLongitudinalData({
    days: 3650,
    exposures: [exposure],
    reactions: [reaction],
    interactions: [],
    checkins: [],
    rollups: [],
  });
  const rollups = buildLongitudinalRollups([exposure], [reaction], [], startedAt + 1_000_000, 'sensor-batch');
  const compacted = summarizeLongitudinalData({
    days: 3650,
    exposures: [],
    reactions: [],
    interactions: [],
    checkins: [],
    rollups,
  });

  for (const summary of [raw, compacted]) {
    assert.equal(summary.sensorMeasuredWallMs, 180_000);
    assert.equal(summary.sensorSampledMs, 150_000);
    assert.equal(summary.faceObservableMs, 96_000);
    assert.equal(summary.sensorMeasuredExposures, 1);
    assert.equal(summary.sensorMeasuredReactions, 1);
    assert.ok(Math.abs((summary.sensorSamplingCoverage ?? 0) - (150 / 180)) < 1e-12);
    assert.ok(Math.abs((summary.faceObservability ?? 0) - (96 / 150)) < 1e-12);
  }

  assert.equal(compacted.sensorMeasuredWallMs, raw.sensorMeasuredWallMs);
  assert.equal(compacted.sensorSampledMs, raw.sensorSampledMs);
  assert.equal(compacted.faceObservableMs, raw.faceObservableMs);
  assert.equal(compacted.sensorMeasuredReactions, raw.sensorMeasuredReactions);
  const topicRollup = rollups.find((rollup) => rollup.dimension === 'topic' && rollup.key === 'neuroai');
  assert.ok(topicRollup);
  assert.equal(topicRollup.sensorMeasuredWallMs, 180_000);
  assert.equal(topicRollup.sensorSampledMs, 150_000);
  assert.equal(topicRollup.faceObservableMs, 96_000);
  assert.equal(topicRollup.sensorMeasuredReactions, 1);
  assert.equal(topicRollup.sensorMeasuredConfirmed, 1);
});

test('a reaction linked only to a legacy exposure never enters v2 measured reaction counts', () => {
  const signal = item('legacy-linked');
  const startedAt = Date.parse('2026-08-30T12:00:00.000Z');
  const legacy = createLongitudinalExposure(signal, {
    startedAt,
    endedAt: startedAt + 60_000,
    attributionMean: 0.8,
    attributionMin: 0.7,
    visibleFractionMean: 0.8,
  });
  const reaction = createLongitudinalReaction(signal, {
    kind: 'interest', confidence: 0.8, intensity: 0.7, durationMs: 1_100, observedAt: 1,
  }, {
    exposureId: legacy.id,
    occurredAt: startedAt + 10_000,
    latencyMs: 10_000,
    targetScore: 0.8,
    visibleFraction: 0.8,
    trustAuthority: 0.9,
  });

  const summary = summarizeLongitudinalData({
    days: 90,
    exposures: [legacy],
    reactions: [reaction],
    interactions: [],
    checkins: [],
    rollups: [],
  });
  assert.equal(summary.reactions, 1);
  assert.equal(summary.sensorMeasuredReactions, 0);
  assert.equal(summary.faceObservableMs, 0);
});
