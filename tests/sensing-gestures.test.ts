import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialGestureTracker,
  isHammerPose,
  isPinching,
  isSecretCirclePose,
  isTwoFingerScrollPose,
  updateGestureTracker,
  type CannedGesture,
  type GesturePoint,
  type GestureTracker,
  type HandObservation,
} from '../components/sensing/gestures';

function baseLandmarks(palmX = 0.5, palmY = 0.5, pinch = false): GesturePoint[] {
  const points: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: palmX, y: palmY, z: 0 }));
  points[0] = { x: palmX, y: palmY + 0.18, z: 0 };
  points[5] = { x: palmX - 0.08, y: palmY, z: 0 };
  points[9] = { x: palmX - 0.02, y: palmY - 0.01, z: 0 };
  points[13] = { x: palmX + 0.04, y: palmY, z: 0 };
  points[17] = { x: palmX + 0.09, y: palmY + 0.01, z: 0 };
  points[6] = { x: palmX - 0.07, y: palmY - 0.07, z: 0 };
  points[8] = { x: palmX - 0.06, y: palmY - 0.2, z: 0 };
  points[10] = { x: palmX - 0.01, y: palmY - 0.07, z: 0 };
  points[12] = { x: palmX, y: palmY - 0.2, z: 0 };
  points[14] = { x: palmX + 0.05, y: palmY - 0.06, z: 0 };
  points[16] = { x: palmX + 0.05, y: palmY - 0.19, z: 0 };
  points[18] = { x: palmX + 0.1, y: palmY - 0.05, z: 0 };
  points[20] = { x: palmX + 0.09, y: palmY - 0.18, z: 0 };
  points[4] = pinch
    ? { x: palmX - 0.065, y: palmY - 0.195, z: 0 }
    : { x: palmX + 0.13, y: palmY + 0.01, z: 0 };
  return points;
}

function observation(
  gesture: CannedGesture,
  palmX = 0.5,
  palmY = 0.5,
  pinch = false,
): HandObservation {
  return { landmarks: baseLandmarks(palmX, palmY, pinch), gesture, confidence: 0.95 };
}

function fistLandmarks(palmY = 0.45): GesturePoint[] {
  const points: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: palmY, z: 0 }));
  points[0] = { x: 0.5, y: palmY + 0.17, z: 0 };
  points[4] = { x: 0.52, y: palmY + 0.02, z: 0 };
  for (const [mcp, pip, tip, x] of [
    [5, 6, 8, 0.43],
    [9, 10, 12, 0.48],
    [13, 14, 16, 0.53],
    [17, 18, 20, 0.58],
  ] as const) {
    points[mcp] = { x, y: palmY - 0.06, z: 0 };
    points[pip] = { x, y: palmY, z: 0 };
    points[tip] = { x, y: palmY + 0.06, z: 0 };
  }
  return points;
}

function twoFingerLandmarks(y = 0.35, x = 0.5): GesturePoint[] {
  const palmY = y + 0.2;
  const points = baseLandmarks(x, palmY, false);
  points[0] = { x, y: palmY + 0.18, z: 0 };
  points[6] = { x: x - 0.05, y: y + 0.1, z: 0 };
  points[8] = { x: x - 0.04, y, z: 0 };
  points[10] = { x: x + 0.01, y: y + 0.1, z: 0 };
  points[12] = { x: x + 0.02, y, z: 0 };
  points[14] = { x: x + 0.06, y: palmY - 0.02, z: 0 };
  points[16] = { x: x + 0.06, y: palmY + 0.05, z: 0 };
  points[18] = { x: x + 0.1, y: palmY - 0.01, z: 0 };
  points[20] = { x: x + 0.1, y: palmY + 0.06, z: 0 };
  return points;
}

function twoFingerObservation(y: number, x = 0.5): HandObservation {
  return {
    landmarks: twoFingerLandmarks(y, x),
    gesture: 'Victory',
    confidence: 0.95,
    handedness: 'Right',
  };
}

function secretLandmarks(): GesturePoint[] {
  const points: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.64, z: 0 }));
  points[0] = { x: 0.5, y: 0.78, z: 0 };
  points[5] = { x: 0.42, y: 0.62, z: 0 };
  points[9] = { x: 0.48, y: 0.61, z: 0 };
  points[13] = { x: 0.54, y: 0.62, z: 0 };
  points[17] = { x: 0.6, y: 0.64, z: 0 };
  points[4] = { x: 0.405, y: 0.5, z: 0 };
  points[6] = { x: 0.4, y: 0.54, z: 0 };
  points[8] = { x: 0.41, y: 0.505, z: 0 };
  points[10] = { x: 0.48, y: 0.49, z: 0 };
  points[12] = { x: 0.48, y: 0.29, z: 0 };
  points[14] = { x: 0.54, y: 0.5, z: 0 };
  points[16] = { x: 0.54, y: 0.31, z: 0 };
  points[18] = { x: 0.6, y: 0.52, z: 0 };
  points[20] = { x: 0.6, y: 0.34, z: 0 };
  return points;
}

function step(tracker: GestureTracker, frame: HandObservation | null, at: number) {
  return updateGestureTracker(tracker, frame, at);
}

test('pinch detection is normalized by hand length and drives the cursor only', () => {
  assert.equal(isPinching(baseLandmarks(0.5, 0.5, true)), true);
  assert.equal(isPinching(baseLandmarks(0.5, 0.5, false)), false);

  let state = step(initialGestureTracker(), observation('None', 0.5, 0.5, true), 0);
  state = step(state.tracker, observation('None', 0.5, 0.5, true), 300);
  assert.equal(state.action, null, 'pinch selection belongs to the target-aware controller');
  assert.equal(state.cursor?.pinching, true);
});

test('a closed fist has one production meaning: history back', () => {
  const fist: HandObservation = {
    landmarks: fistLandmarks(),
    gesture: 'Closed_Fist',
    confidence: 0.95,
  };
  let state = step(initialGestureTracker(), fist, 0);
  state = step(state.tracker, fist, 419);
  assert.equal(state.action, null);
  state = step(state.tracker, fist, 420);
  assert.equal(state.action?.type, 'history_back');
});

test('a held fist fires once until released and cooldown passes', () => {
  const fist: HandObservation = {
    landmarks: fistLandmarks(),
    gesture: 'Closed_Fist',
    confidence: 0.95,
  };
  let state = step(initialGestureTracker(), fist, 0);
  state = step(state.tracker, fist, 420);
  assert.equal(state.action?.type, 'history_back');
  state = step(state.tracker, fist, 1200);
  assert.equal(state.action, null);

  state = step(state.tracker, null, 1300);
  state = step(state.tracker, fist, 1400);
  state = step(state.tracker, fist, 1820);
  assert.equal(state.action?.type, 'history_back');
});

test('geometry can recover a fist when the canned classifier flickers', () => {
  assert.equal(isHammerPose(fistLandmarks()), true);
  const frame: HandObservation = { landmarks: fistLandmarks(), gesture: 'None', confidence: 0.95 };
  let state = step(initialGestureTracker(), frame, 0);
  state = step(state.tracker, frame, 420);
  assert.equal(state.action?.type, 'history_back');
});

test('an open palm no longer navigates or opens a gesture palette', () => {
  let state = step(initialGestureTracker(), observation('Open_Palm'), 0);
  for (const at of [500, 1000, 1600]) {
    state = step(state.tracker, observation('Open_Palm'), at);
    assert.equal(state.action, null);
  }
});

test('two-finger scroll pose requires index and middle fingers without ring and pinky', () => {
  assert.equal(isTwoFingerScrollPose(twoFingerLandmarks()), true);
  assert.equal(isTwoFingerScrollPose(baseLandmarks()), false);
});

test('two fingers moving downward emit a positive scroll delta', () => {
  let state = step(initialGestureTracker(), twoFingerObservation(0.28), 0);
  state = step(state.tracker, twoFingerObservation(0.33), 60);
  state = step(state.tracker, twoFingerObservation(0.39), 120);
  assert.equal(state.action?.type, 'scroll');
  assert.ok((state.action?.deltaY ?? 0) > 0);
});

test('two fingers moving upward emit a negative scroll delta', () => {
  let state = step(initialGestureTracker(), twoFingerObservation(0.52), 0);
  state = step(state.tracker, twoFingerObservation(0.47), 60);
  state = step(state.tracker, twoFingerObservation(0.4), 120);
  assert.equal(state.action?.type, 'scroll');
  assert.ok((state.action?.deltaY ?? 0) < 0);
});

test('two-finger jitter below the travel threshold never scrolls', () => {
  let state = step(initialGestureTracker(), twoFingerObservation(0.35), 0);
  for (const [at, y] of [[80, 0.36], [160, 0.345], [240, 0.365], [320, 0.35]] as const) {
    state = step(state.tracker, twoFingerObservation(y), at);
    assert.equal(state.action, null);
  }
});

test('horizontal two-finger motion does not alias into a scroll', () => {
  let state = step(initialGestureTracker(), twoFingerObservation(0.35, 0.35), 0);
  state = step(state.tracker, twoFingerObservation(0.36, 0.48), 120);
  state = step(state.tracker, twoFingerObservation(0.36, 0.62), 240);
  assert.equal(state.action, null);
});

test('circle-game pose is distinct from ordinary pinch and two-finger scroll', () => {
  assert.equal(isSecretCirclePose(secretLandmarks()), true);
  assert.equal(isSecretCirclePose(baseLandmarks(0.5, 0.5, true)), false);
  assert.equal(isTwoFingerScrollPose(secretLandmarks()), false);
});

test('secret pose suppresses cursor pinch until prank dwell completes', () => {
  const secret: HandObservation = {
    landmarks: secretLandmarks(),
    gesture: 'None',
    confidence: 0.95,
  };
  let state = step(initialGestureTracker(), secret, 0);
  assert.equal(state.cursor?.pinching, false, 'secret circle must not leak into click');
  state = step(state.tracker, secret, 899);
  assert.equal(state.action, null);
  state = step(state.tracker, secret, 900);
  assert.equal(state.action?.type, 'prank');
});
