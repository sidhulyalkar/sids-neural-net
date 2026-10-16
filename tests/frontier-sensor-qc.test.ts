import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_SENSOR_QC_MAX_SAMPLE_GAP_MS,
  FRONTIER_SENSOR_QC_SCHEMA,
  createSensorQcExport,
  createSensorQcTrialAccumulator,
  observeSensorQcSample,
  sensorQcTrialSnapshot,
  type SensorQcArchive,
} from '../lib/frontier/sensorQc';

test('Sensor QC caps callback stalls instead of inventing observation time', () => {
  let trial = createSensorQcTrialAccumulator('neutral_reading');
  trial = observeSensorQcSample(trial, { sampleAt: 0, wallAt: 0, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 100, wallAt: 100, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 5_100, wallAt: 5_100, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });

  assert.equal(trial.sensorSampledMs, 100 + FRONTIER_SENSOR_QC_MAX_SAMPLE_GAP_MS);
  assert.equal(trial.callbackGapCount, 1);
  assert.equal(trial.maxCallbackGapMs, 5_000);
});

test('Sensor QC keeps face coverage, attribution, and ambiguity separate', () => {
  let trial = createSensorQcTrialAccumulator('two_card_ambiguity');
  trial = observeSensorQcSample(trial, { sampleAt: 0, wallAt: 0, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 100, wallAt: 100, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 200, wallAt: 200, foreground: true, feedActive: true, faceObservable: false, targetAttributed: false, visibleCandidates: 2 });

  assert.equal(trial.sensorSampledMs, 200);
  assert.equal(trial.faceObservableMs, 100);
  assert.equal(trial.feedSampledMs, 200);
  assert.equal(trial.targetAttributedMs, 100);
  assert.equal(trial.jointFaceTargetMs, 100);
  assert.equal(trial.noTargetMs, 100);
  assert.equal(trial.ambiguousMultiCardMs, 100);
});

test('Sensor QC gives hidden callbacks zero sampled-time credit', () => {
  let trial = createSensorQcTrialAccumulator('background_tab');
  trial = observeSensorQcSample(trial, { sampleAt: 0, wallAt: 0, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 100, wallAt: 100, foreground: false, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 200, wallAt: 200, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });

  assert.equal(trial.sensorSampledMs, 100);
  assert.equal(trial.faceObservableMs, 100);
  assert.equal(trial.targetAttributedMs, 100);
});

test('Sensor QC rejects out-of-order callback duration', () => {
  let trial = createSensorQcTrialAccumulator('natural_browsing');
  trial = observeSensorQcSample(trial, { sampleAt: 100, wallAt: 100, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });
  trial = observeSensorQcSample(trial, { sampleAt: 90, wallAt: 110, foreground: true, feedActive: true, faceObservable: true, targetAttributed: true, visibleCandidates: 1 });

  assert.equal(trial.sensorSampledMs, 0);
  assert.equal(trial.outOfOrderSamples, 1);
});

test('review precision conditions only on reviewed detected cues', () => {
  const trial = createSensorQcTrialAccumulator('interesting_reading');
  trial.durationMs = 60_000;
  trial.sensorSampledMs = 54_000;
  trial.faceObservableMs = 45_000;
  trial.feedSampledMs = 50_000;
  trial.targetAttributedMs = 40_000;
  trial.jointFaceTargetMs = 35_000;
  trial.cues.interest = 4;
  trial.confirmed.interest = 2;
  trial.contradicted.interest = 1;
  const snapshot = sensorQcTrialSnapshot(trial);

  assert.equal(snapshot.sampleCoverage, 0.9);
  assert.equal(snapshot.faceCoverage, 45_000 / 54_000);
  assert.equal(snapshot.targetAttributionCoverage, 0.8);
  assert.equal(snapshot.reviewAgreement, 2 / 3);
  assert.equal(snapshot.cueRatePerMinute, 4);
});

test('Sensor QC export is aggregate-only and contains no content identifiers', () => {
  const trial = createSensorQcTrialAccumulator('neutral_reading');
  trial.id = 'qc-trial-1';
  trial.endedAt = 1_000;
  trial.durationMs = 1_000;
  const archive: SensorQcArchive = {
    schema: FRONTIER_SENSOR_QC_SCHEMA,
    sessions: [{ id: 'qc-session-1', startedAt: 0, endedAt: 1_000, updatedAt: 1_000, trials: [trial] }],
  };
  const report = createSensorQcExport(archive, '2026-08-31T00:00:00.000Z');

  assert.deepEqual(report.privacy, {
    aggregateOnly: true,
    contentIdentifiersIncluded: false,
    rawCameraDataIncluded: false,
  });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ['"itemid":', '"cardid":', '"contentid":', '"title":', '"url":', 'landmark', 'blendshape', 'embedding', 'biometrictemplate']) {
    assert.equal(serialized.includes(forbidden), false, `export leaked forbidden field ${forbidden}`);
  }
});
