import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialGestureTracker,
  isHammerPose,
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

/** A closed fist at a given palm height: every tip curled back toward the wrist. */
function hammerLandmarks(palmY: number): GesturePoint[] {
  const points: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: palmY }));
  points[0] = { x: 0.5, y: palmY + 0.16 };
  // Thumb wraps across the middle of the fingers, as a real fist does. Parking
  // it on the index tip would also read as a pinch, which fires first.
  points[4] = { x: 0.52, y: palmY + 0.02 };
  for (const [mcp, tip, x] of [
    [5, 8, 0.43],
    [9, 12, 0.48],
    [13, 16, 0.53],
    [17, 20, 0.58],
  ] as const) {
    points[mcp] = { x, y: palmY - 0.06 };
    points[tip] = { x, y: palmY + 0.06 };
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

test('raising the right hand navigates forward after a dwell, once per raise', () => {
  const raise = (hand: string): HandObservation => ({
    ...observation('None', 0.5, 0.2), handedness: hand,
  });
  let state = step(initialGestureTracker(), raise('Right'), 0);
  assert.equal(state.action, null);
  state = step(state.tracker, raise('Right'), 449);
  assert.equal(state.action, null, 'must dwell before firing');
  state = step(state.tracker, raise('Right'), 450);
  assert.equal(state.action?.type, 'navigate_next');
  state = step(state.tracker, raise('Right'), 1500);
  assert.equal(state.action, null, 'a held hand must not repeat');
});

test('raising the left hand navigates back', () => {
  const raise: HandObservation = { ...observation('None', 0.5, 0.2), handedness: 'Left' };
  let state = step(initialGestureTracker(), raise, 0);
  state = step(state.tracker, raise, 500);
  assert.equal(state.action?.type, 'navigate_previous');
});

test('a hand held low never navigates', () => {
  const low: HandObservation = { ...observation('None', 0.5, 0.8), handedness: 'Right' };
  let state = step(initialGestureTracker(), low, 0);
  state = step(state.tracker, low, 500);
  state = step(state.tracker, low, 1500);
  assert.equal(state.action, null);
});

test('switching hands restarts the dwell', () => {
  const raise = (hand: string): HandObservation => ({
    ...observation('None', 0.5, 0.2), handedness: hand,
  });
  let state = step(initialGestureTracker(), raise('Right'), 0);
  state = step(state.tracker, raise('Left'), 400);
  assert.equal(state.action, null, 'the right hand dwell must not carry over');
  state = step(state.tracker, raise('Left'), 860);
  assert.equal(state.action?.type, 'navigate_previous');
});

test('hammer pose requires a closed fist', () => {
  assert.equal(isHammerPose(hammerLandmarks(0.4)), true);
  assert.equal(isHammerPose(landmarks()), false);
});

test('hammer pose survives an edge-on fist whose palm width has foreshortened', () => {
  // Palm width collapses when the hand turns edge-on; the curl test reads along
  // the wrist axis instead, so it must not care.
  const edgeOn = hammerLandmarks(0.4).map((p) => ({ ...p }));
  edgeOn[5] = { x: 0.49, y: 0.34 };
  edgeOn[17] = { x: 0.51, y: 0.34 };
  assert.equal(isHammerPose(edgeOn), true);
});

test('an open flat hand is never a hammer pose', () => {
  // The whole reason for the fist: lowering a raised flat hand is the same
  // motion as a chop, so only a curled fist may arm the strike.
  const flat: GesturePoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.4 }));
  flat[0] = { x: 0.5, y: 0.58 };
  flat[9] = { x: 0.48, y: 0.39 };
  for (const [mcp, tip, x] of [[5, 8, 0.43], [9, 12, 0.48], [13, 16, 0.53], [17, 20, 0.58]] as const) {
    flat[mcp] = { x, y: 0.4 };
    flat[tip] = { x, y: 0.1 };
  }
  assert.equal(isHammerPose(flat), false);
});

test('a downward fist hammer emits page down', () => {
  const frame = (y: number): HandObservation => ({
    landmarks: hammerLandmarks(y),
    gesture: 'None',
    confidence: 0.95,
  });
  let state = step(initialGestureTracker(), frame(0.28), 0);
  state = step(state.tracker, frame(0.4), 110);
  state = step(state.tracker, frame(0.52), 230);
  assert.equal(state.action?.type, 'page_down');
});

test('a hammer fires even when the recovery stroke is in the same window', () => {
  // At 30fps the buffer holds the strike AND the hand coming back up. Comparing
  // only the buffer's endpoints cancels the strike out; the largest downward
  // excursion must still be found.
  const frame = (y: number): HandObservation => ({
    landmarks: hammerLandmarks(y), gesture: 'None', confidence: 0.95,
  });
  let state = step(initialGestureTracker(), frame(0.25), 0);
  state = step(state.tracker, frame(0.35), 40);
  state = step(state.tracker, frame(0.5), 80);
  state = step(state.tracker, frame(0.62), 120);
  assert.equal(state.action?.type, 'page_down', 'strike should fire on the way down');
});

test('a hammer survives a blurred frame that drops the hand shape mid-swing', () => {
  const chop = (y: number): HandObservation => ({
    landmarks: hammerLandmarks(y), gesture: 'None', confidence: 0.95,
  });
  // Frame 2 loses the shape (blur) but keeps a palm: the buffer must persist.
  const blurred = (y: number): HandObservation => ({
    landmarks: landmarks(0.5, y), gesture: 'None', confidence: 0.95,
  });
  let state = step(initialGestureTracker(), chop(0.28), 0);
  state = step(state.tracker, blurred(0.4), 90);
  state = step(state.tracker, chop(0.52), 180);
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
