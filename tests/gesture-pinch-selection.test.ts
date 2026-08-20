import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialPinchSelectionState,
  PINCH_HOLD_MS,
  RELEASE_ARM_MS,
  TARGET_LOCK_MS,
  updatePinchSelection,
} from '../components/sensing/gestures/pinchSelection';

function step(
  state: ReturnType<typeof initialPinchSelectionState>,
  pinching: boolean,
  targetKey: string | null,
  now: number,
) {
  return updatePinchSelection(state, { pinching, targetKey, now });
}

function arm(targetKey: string, startAt = 0) {
  let update = step(initialPinchSelectionState(), false, targetKey, startAt);
  update = step(update.state, false, targetKey, startAt + RELEASE_ARM_MS);
  assert.equal(update.state.armed, true);
  return update;
}

test('pinch selection requires a stable release before it can arm', () => {
  let update = step(initialPinchSelectionState(), true, 'projects', 0);
  update = step(update.state, true, 'projects', PINCH_HOLD_MS + TARGET_LOCK_MS + 20);
  assert.equal(update.activate, false, 'a hand entering frame already pinched must never click');

  update = step(update.state, false, 'projects', 400);
  assert.equal(update.state.armed, false, 'one release frame is not enough to re-arm');
  update = step(update.state, false, 'projects', 400 + RELEASE_ARM_MS);
  assert.equal(update.state.armed, true);

  update = step(update.state, true, 'projects', 550);
  update = step(update.state, true, 'projects', 550 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);
});

test('a brief noisy pinch spike cannot activate', () => {
  let update = arm('about');
  update = step(update.state, true, 'about', 200);
  update = step(update.state, false, 'about', 200 + PINCH_HOLD_MS - 1);
  assert.equal(update.activate, false);
});

test('target must lock before a pinch can activate it', () => {
  let update = arm('work');
  update = step(update.state, true, 'work', RELEASE_ARM_MS + 10);
  update = step(update.state, true, 'work', RELEASE_ARM_MS + 10 + PINCH_HOLD_MS);
  assert.equal(update.activate, true, 'stable target plus deliberate pinch should activate');

  update = arm('projects', 1000);
  update = step(update.state, false, 'writing', 1000 + RELEASE_ARM_MS + 10);
  update = step(update.state, true, 'writing', 1000 + RELEASE_ARM_MS + 20);
  update = step(update.state, true, 'writing', 1000 + RELEASE_ARM_MS + 20 + TARGET_LOCK_MS - 1);
  assert.equal(update.activate, false, 'new target has not locked long enough yet');
});

test('moving to a different target while pinched never clicks the new target', () => {
  let update = arm('projects');
  update = step(update.state, true, 'projects', 200);
  update = step(update.state, true, 'writing', 220);
  update = step(update.state, true, 'writing', 220 + TARGET_LOCK_MS + PINCH_HOLD_MS + 20);
  assert.equal(update.activate, false);
});

test('one held pinch fires once and requires a debounced release before another selection', () => {
  let update = arm('projects');
  update = step(update.state, true, 'projects', 200);
  update = step(update.state, true, 'projects', 200 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);

  update = step(update.state, true, 'projects', 1000);
  assert.equal(update.activate, false, 'a held pinch must not repeat');

  update = step(update.state, false, 'projects', 1100);
  update = step(update.state, true, 'projects', 1150);
  update = step(update.state, true, 'projects', 1150 + PINCH_HOLD_MS + 20);
  assert.equal(update.activate, false, 'a one-frame dropout must not create a second click');

  update = step(update.state, false, 'projects', 1400);
  update = step(update.state, false, 'projects', 1400 + RELEASE_ARM_MS);
  update = step(update.state, true, 'projects', 1550);
  update = step(update.state, true, 'projects', 1550 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);
});
