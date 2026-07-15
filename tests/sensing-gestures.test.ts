import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialGestureTracker,
  isKarateChopPose,
  isPinching,
  isSecretCirclePose,
  updateGestureTracker,
  type CannedGesture,
  type GesturePoint,
  type GestureTracker,
  type HandObservation,
} from '../components/sensing/gestures';

function landmarks(palmX = 0.5, palmY = 0.5, pinch = false): GesturePoint[] {
  const result: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: palmX, y: palmY, z: 0 }));
  result[5] = { x: palmX - 0.1, y: palmY };
  result[17] = { x: palmX + 0.1, y: palmY };
  result[8] = { x: palmX - 0.04, y: palmY - 0.16 };
  result[4] = pinch
    ? { x: palmX - 0.045, y: palmY - 0.155 }
    : { x: palmX + 0.12, y: palmY + 0.02 };
  return result;
}

function observation(
  gesture: CannedGesture,
  palmX = 0.5,
  palmY = 0.5,
  pinch = false,
): HandObservation {
  return { landmarks: landmarks(palmX, palmY, pinch), gesture, confidence: 0.95 };
}

function secretLandmarks(): GesturePoint[] {
  const points: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.64 }));
  points[0] = { x: 0.5, y: 0.78 };
  points[5] = { x: 0.42, y: 0.62 };
  points[9] = { x: 0.48, y: 0.61 };
  points[13] = { x: 0.54, y: 0.62 };
  points[17] = { x: 0.6, y: 0.64 };
  points[4] = { x: 0.405, y: 0.5 };
  points[6] = { x: 0.4, y: 0.54 };
  points[8] = { x: 0.41, y: 0.505 };
  points[10] = { x: 0.48, y: 0.49 };
  points[12] = { x: 0.48, y: 0.29 };
  points[14] = { x: 0.54, y: 0.5 };
  points[16] = { x: 0.54, y: 0.31 };
  points[18] = { x: 0.6, y: 0.52 };
  points[20] = { x: 0.6, y: 0.34 };
  return points;
}

function chopLandmarks(palmY: number): GesturePoint[] {
  const points: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: palmY }));
  points[0] = { x: 0.5, y: palmY + 0.18 };
  points[5] = { x: 0.42, y: palmY };
  points[9] = { x: 0.48, y: palmY - 0.01 };
  points[13] = { x: 0.54, y: palmY };
  points[17] = { x: 0.6, y: palmY + 0.02 };
  points[4] = { x: 0.43, y: palmY + 0.02 };
  for (const [pip, tip, x] of [
    [6, 8, 0.43],
    [10, 12, 0.47],
    [14, 16, 0.51],
    [18, 20, 0.55],
  ] as const) {
    points[pip] = { x, y: palmY - 0.12 };
    points[tip] = { x, y: palmY - 0.3 };
  }
  return points;
}

function step(
  tracker: GestureTracker,
  frame: HandObservation | null,
  at: number,
) {
  return updateGestureTracker(tracker, frame, at);
}

test('pinch detection is normalized by palm width', () => {
  assert.equal(isPinching(landmarks(0.5, 0.5, true)), true);
  assert.equal(isPinching(landmarks(0.5, 0.5, false)), false);
  assert.equal(isPinching([]), false);
});

test('open palm must dwell before opening the palette and only fires once per hold', () => {
  let state = step(initialGestureTracker(), observation('Open_Palm'), 0);
  assert.equal(state.action, null);
  state = step(state.tracker, observation('Open_Palm'), 699);
  assert.equal(state.action, null);
  state = step(state.tracker, observation('Open_Palm'), 700);
  assert.equal(state.action?.type, 'open_palette');
  state = step(state.tracker, observation('Open_Palm'), 1700);
  assert.equal(state.action, null);
});

test('pose can fire again only after release and cooldown', () => {
  let state = step(initialGestureTracker(), observation('Closed_Fist'), 0);
  state = step(state.tracker, observation('Closed_Fist'), 450);
  assert.equal(state.action?.type, 'close_palette');
  state = step(state.tracker, null, 500);
  state = step(state.tracker, observation('Closed_Fist'), 1300);
  state = step(state.tracker, observation('Closed_Fist'), 1750);
  assert.equal(state.action?.type, 'close_palette');
});

test('a deliberate pinch emits activate after dwell', () => {
  let state = step(initialGestureTracker(), observation('None', 0.5, 0.5, true), 0);
  state = step(state.tracker, observation('None', 0.5, 0.5, true), 179);
  assert.equal(state.action, null);
  state = step(state.tracker, observation('None', 0.5, 0.5, true), 180);
  assert.equal(state.action?.type, 'activate');
  assert.equal(state.cursor?.pinching, true);
});

test('horizontal palm movement emits one mirrored swipe action', () => {
  let state = step(initialGestureTracker(), observation('Open_Palm', 0.25), 0);
  state = step(state.tracker, observation('Open_Palm', 0.4), 100);
  state = step(state.tracker, observation('Open_Palm', 0.55), 220);

  // Source x increased, mirrored x moved left: navigate to the next section.
  assert.equal(state.action?.type, 'navigate_next');
});

test('vertical movement is rejected as a swipe', () => {
  let state = step(initialGestureTracker(), observation('Open_Palm', 0.25, 0.2), 0);
  state = step(state.tracker, observation('Open_Palm', 0.55, 0.55), 220);
  assert.equal(state.action, null);
});

test('karate chop pose requires a flat tucked-thumb hand', () => {
  assert.equal(isKarateChopPose(chopLandmarks(0.4)), true);
  assert.equal(isKarateChopPose(landmarks()), false);
});

test('a downward karate chop emits page down', () => {
  const frame = (y: number): HandObservation => ({
    landmarks: chopLandmarks(y),
    gesture: 'None',
    confidence: 0.95,
  });
  let state = step(initialGestureTracker(), frame(0.28), 0);
  state = step(state.tracker, frame(0.4), 110);
  state = step(state.tracker, frame(0.52), 230);
  assert.equal(state.action?.type, 'page_down');
});

test('circle-game pose is distinct from an ordinary pinch', () => {
  assert.equal(isSecretCirclePose(secretLandmarks()), true);
  assert.equal(isSecretCirclePose(landmarks(0.5, 0.5, true)), false);
});

test('secret pose suppresses pinch until prank dwell completes', () => {
  const secret: HandObservation = {
    landmarks: secretLandmarks(),
    gesture: 'None',
    confidence: 0.95,
  };
  let state = step(initialGestureTracker(), secret, 0);
  state = step(state.tracker, secret, 180);
  assert.equal(state.action, null);
  state = step(state.tracker, secret, 899);
  assert.equal(state.action, null);
  state = step(state.tracker, secret, 900);
  assert.equal(state.action?.type, 'prank');
});

test('secret prank has a long cooldown even after pose release', () => {
  const secret: HandObservation = {
    landmarks: secretLandmarks(),
    gesture: 'None',
    confidence: 0.95,
  };
  let state = step(initialGestureTracker(), secret, 0);
  state = step(state.tracker, secret, 900);
  assert.equal(state.action?.type, 'prank');
  state = step(state.tracker, null, 2000);
  state = step(state.tracker, secret, 3000);
  state = step(state.tracker, secret, 4000);
  assert.equal(state.action, null);
});
