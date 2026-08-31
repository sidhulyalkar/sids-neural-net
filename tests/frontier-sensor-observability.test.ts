import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_SENSOR_MAX_SAMPLE_GAP_MS,
  createSensorObservabilityAccumulator,
  observeSensorSample,
  sensorObservabilityArchiveFields,
  sensorObservabilitySnapshot,
} from '../lib/frontier/sensorObservability';

test('regular callbacks distinguish sampled time from face-observable time', () => {
  let state = createSensorObservabilityAccumulator(0, true);
  state = observeSensorSample(state, 100, true);
  state = observeSensorSample(state, 200, false);
  state = observeSensorSample(state, 300, true);
  const snapshot = sensorObservabilitySnapshot(state);

  assert.equal(snapshot.sampledMs, 300);
  assert.equal(snapshot.faceObservableMs, 200);
  assert.equal(snapshot.samples, 4);
  assert.equal(snapshot.faceObservedSamples, 3);
  assert.equal(snapshot.samplingCoverage, 1);
  assert.ok(Math.abs(snapshot.faceCoverage - 2 / 3) < 1e-12);
});

test('worker or page stalls cannot be credited as continuously observed face time', () => {
  let state = createSensorObservabilityAccumulator(0, true);
  state = observeSensorSample(state, 100, true);
  state = observeSensorSample(state, 5_100, true);
  const snapshot = sensorObservabilitySnapshot(state);

  assert.equal(snapshot.sampledMs, 100 + FRONTIER_SENSOR_MAX_SAMPLE_GAP_MS);
  assert.equal(snapshot.faceObservableMs, snapshot.sampledMs);
  assert.equal(snapshot.gapCount, 1);
  assert.equal(snapshot.maxRawGapMs, 5_000);
  assert.ok(snapshot.samplingCoverage < 0.1, 'a five-second callback hole must remain visible as missing data');
});

test('camera analysis can be present while the face is entirely unobservable', () => {
  let state = createSensorObservabilityAccumulator(1_000, false);
  state = observeSensorSample(state, 1_100, false);
  state = observeSensorSample(state, 1_200, false);
  const snapshot = sensorObservabilitySnapshot(state);

  assert.equal(snapshot.sampledMs, 200);
  assert.equal(snapshot.faceObservableMs, 0);
  assert.equal(snapshot.faceCoverage, 0);
  assert.equal(snapshot.samplingCoverage, 1);
});

test('out-of-order monotonic samples never create negative or invented duration', () => {
  let state = createSensorObservabilityAccumulator(1_000, true);
  state = observeSensorSample(state, 1_100, true);
  const before = sensorObservabilitySnapshot(state);
  state = observeSensorSample(state, 1_050, true);
  const after = sensorObservabilitySnapshot(state);

  assert.equal(after.sampledMs, before.sampledMs);
  assert.equal(after.faceObservableMs, before.faceObservableMs);
  assert.equal(after.lastSampleAt, before.lastSampleAt);
  assert.equal(after.outOfOrderSamples, 1);
});

test('archive projection contains aggregate coverage only', () => {
  let state = createSensorObservabilityAccumulator(0, true);
  state = observeSensorSample(state, 80, true);
  state = observeSensorSample(state, 160, false);
  const fields = sensorObservabilityArchiveFields(state);

  assert.deepEqual(fields, {
    measurementVersion: 2,
    sensorSampledMs: 160,
    faceObservableMs: 80,
  });
  const serialized = JSON.stringify(fields);
  for (const forbidden of ['landmark', 'blendshape', 'frame', 'identity', 'biometric']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
