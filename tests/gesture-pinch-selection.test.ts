import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialPinchSelectionState,
  PINCH_HOLD_MS,
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

test('pinch selection requires a release before it can arm', () => {
  let update = step(initialPinchSelectionState(), true, 'projects', 0);
  update = step(update.state, true, 'projects', PINCH_HOLD_MS + TARGET_LOCK_MS + 20);
  assert.equal(update.activate, false, 'a hand entering frame already pinched must never click');

  update = step(update.state, false, 'projects', 400);
  assert.equal(update.state.armed, true);
  update = step(update.state, true, 'projects', 450);
  update = step(update.state, true, 'projects', 450 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);
});

test('a brief noisy pinch spike cannot activate', () => {
  let update = step(initialPinchSelectionState(), false, 'about', 0);
  update = step(update.state, true, 'about', 200);
  update = step(update.state, false, 'about', 200 + PINCH_HOLD_MS - 1);
  assert.equal(update.activate, false);
});

test('target must lock before a pinch can activate it', () => {
  let update = step(initialPinchSelectionState(), false, 'work', 0);
  update = step(update.state, true, 'work', 20);
  update = step(update.state, true, 'work', 20 + PINCH_HOLD_MS);
  assert.equal(update.activate, true, 'the target has been stable longer than the lock window');

  update = step(initialPinchSelectionState(), false, null, 0);
  update = step(update.state, false, 'work', 1000);
  update = step(update.state, true, 'work', 1010);
  update = step(update.state, true, 'work', 1010 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);
});

test('moving to a different target while pinched never clicks the new target', () => {
  let update = step(initialPinchSelectionState(), false, 'projects', 0);
  update = step(update.state, true, 'projects', 200);
  update = step(update.state, true, 'writing', 220);
  update = step(update.state, true, 'writing', 220 + TARGET_LOCK_MS + PINCH_HOLD_MS + 20);
  assert.equal(update.activate, false);
});

test('one held pinch fires once and requires release before another selection', () => {
  let update = step(initialPinchSelectionState(), false, 'projects', 0);
  update = step(update.state, true, 'projects', 200);
  update = step(update.state, true, 'projects', 200 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);

  update = step(update.state, true, 'projects', 1000);
  assert.equal(update.activate, false, 'a held pinch must not repeat');

  update = step(update.state, false, 'projects', 1100);
  update = step(update.state, true, 'projects', 1200);
  update = step(update.state, true, 'projects', 1200 + PINCH_HOLD_MS);
  assert.equal(update.activate, true);
});
