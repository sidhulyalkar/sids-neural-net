import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CALIBRATION_STEPS,
  deriveGestureCalibration,
  parseGestureCalibration,
} from '../components/sensing/gestures/gestureCalibration';
import {
  initialPinchSelectionState,
  updatePinchSelection,
} from '../components/sensing/gestures/pinchSelection';

function cluster(cx: number, cy: number, radius: number) {
  return Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    const wobble = index % 3 === 0 ? radius : radius * 0.55;
    return { x: cx + Math.cos(angle) * wobble, y: cy + Math.sin(angle) * wobble };
  });
}

test('calibration course validates the exact simplified production grammar', () => {
  assert.deepEqual(
    CALIBRATION_STEPS.map((step) => step.id),
    ['aim', 'pinch', 'back', 'scroll-down', 'scroll-up'],
  );
});

test('calibration widens target acquisition for a noisier pointer', () => {
  const steady = deriveGestureCalibration({
    pointerSamples: cluster(500, 300, 2),
    pinchDurationMs: 300,
    calibratedAt: 1,
  });
  const noisy = deriveGestureCalibration({
    pointerSamples: cluster(500, 300, 14),
    pinchDurationMs: 300,
    calibratedAt: 1,
  });

  assert.ok(noisy.targetProbeRadiusPx > steady.targetProbeRadiusPx);
  assert.ok(noisy.targetLockMs > steady.targetLockMs);
  assert.ok(noisy.releaseArmMs >= steady.releaseArmMs);
});

test('calibration follows demonstrated pinch cadence but preserves safe bounds', () => {
  const fast = deriveGestureCalibration({ pointerSamples: cluster(0, 0, 3), pinchDurationMs: 180 });
  const slow = deriveGestureCalibration({ pointerSamples: cluster(0, 0, 3), pinchDurationMs: 650 });

  assert.ok(slow.pinchHoldMs > fast.pinchHoldMs);
  assert.ok(fast.pinchHoldMs >= 115);
  assert.ok(slow.pinchHoldMs <= 190);
});

test('serialized calibration profiles are strictly validated', () => {
  const profile = deriveGestureCalibration({
    pointerSamples: cluster(100, 100, 4),
    pinchDurationMs: 320,
    calibratedAt: 123,
  });
  assert.deepEqual(parseGestureCalibration(JSON.parse(JSON.stringify(profile))), profile);
  assert.equal(parseGestureCalibration({ ...profile, version: 999 }), null);
  assert.equal(parseGestureCalibration({ ...profile, targetProbeRadiusPx: 500 }), null);
});

test('pinch selector honors calibrated timing values without removing safety gates', () => {
  const config = { pinchHoldMs: 180, targetLockMs: 160, releaseArmMs: 120 };
  let state = initialPinchSelectionState();

  let update = updatePinchSelection(state, { pinching: false, targetKey: 'target', now: 0 }, config);
  state = update.state;
  update = updatePinchSelection(state, { pinching: false, targetKey: 'target', now: 120 }, config);
  assert.equal(update.state.armed, true);

  state = update.state;
  update = updatePinchSelection(state, { pinching: true, targetKey: 'target', now: 200 }, config);
  state = update.state;
  update = updatePinchSelection(state, { pinching: true, targetKey: 'target', now: 379 }, config);
  assert.equal(update.activate, false, 'custom pinch dwell must be respected');

  state = update.state;
  update = updatePinchSelection(state, { pinching: true, targetKey: 'target', now: 380 }, config);
  assert.equal(update.activate, true);
});
