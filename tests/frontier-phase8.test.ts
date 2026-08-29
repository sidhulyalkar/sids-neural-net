import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_FLUID_DOUBLE_MS,
  frontierCriticalSpringProgress,
  frontierFlipDelta,
  frontierSpringTransform,
  qualifiesFrontierFluidPairPress,
  qualifiesFrontierFluidRelease,
  resolveFrontierFluidIntent,
  type FrontierFluidClickState,
  type FrontierFluidPress,
} from '../lib/frontier/interaction/fluidPointer';

test('first pointer release expands immediately without a deferred single-click timer', () => {
  const state: FrontierFluidClickState = { lastReleaseAt: 0 };
  const result = resolveFrontierFluidIntent({ state, at: 1_000, expanded: false });
  assert.equal(result.intent, 'expand');
  assert.equal(result.state.lastReleaseAt, 1_000);
});

test('second release inside 250ms interrupts expansion and opens externally', () => {
  const first = resolveFrontierFluidIntent({ state: { lastReleaseAt: 0 }, at: 1_000, expanded: false });
  const second = resolveFrontierFluidIntent({ state: first.state, at: 1_000 + FRONTIER_FLUID_DOUBLE_MS - 1, expanded: true });
  assert.equal(second.intent, 'external');
  assert.equal(second.state.lastReleaseAt, 0);
});

test('late reading clicks keep an expanded card open instead of collapsing it', () => {
  const at = 1_000 + FRONTIER_FLUID_DOUBLE_MS + 1;
  const result = resolveFrontierFluidIntent({
    state: { lastReleaseAt: 1_000 },
    at,
    expanded: true,
  });
  assert.equal(result.intent, 'none');
  assert.equal(result.state.lastReleaseAt, at);
});

test('armed second press retains card ownership only near the original release and inside 250ms', () => {
  const release = { x: 140, y: 220, at: 1_000 };
  assert.equal(qualifiesFrontierFluidPairPress(release, { x: 143, y: 224, at: 1_180 }), true);
  assert.equal(qualifiesFrontierFluidPairPress(release, { x: 160, y: 220, at: 1_180 }), false);
  assert.equal(qualifiesFrontierFluidPairPress(release, { x: 140, y: 220, at: 1_251 }), false);
  assert.equal(qualifiesFrontierFluidPairPress(undefined, { x: 140, y: 220, at: 1_180 }), false);
});

test('pointer qualification rejects scroll gestures, long presses, and pointer mismatches', () => {
  const press: FrontierFluidPress = { pointerId: 4, x: 10, y: 10, startedAt: 100 };
  assert.equal(qualifiesFrontierFluidRelease(press, { pointerId: 4, x: 14, y: 14, at: 180 }), true);
  assert.equal(qualifiesFrontierFluidRelease(press, { pointerId: 4, x: 40, y: 10, at: 180 }), false);
  assert.equal(qualifiesFrontierFluidRelease(press, { pointerId: 4, x: 10, y: 10, at: 900 }), false);
  assert.equal(qualifiesFrontierFluidRelease(press, { pointerId: 5, x: 10, y: 10, at: 180 }), false);
});

test('critically damped progress is monotonic, grounded, and lands exactly at one', () => {
  let previous = 0;
  for (let index = 0; index <= 40; index += 1) {
    const current = frontierCriticalSpringProgress(index / 40);
    assert.ok(current >= previous - 1e-10);
    assert.ok(current >= 0 && current <= 1);
    previous = current;
  }
  assert.equal(frontierCriticalSpringProgress(0), 0);
  assert.equal(frontierCriticalSpringProgress(1), 1);
  assert.ok(frontierCriticalSpringProgress(0.25) > 0.55);
  assert.ok(frontierCriticalSpringProgress(0.75) > 0.98);
});

test('FLIP delta starts at the previous box and ends at compositor identity', () => {
  const delta = frontierFlipDelta(
    { left: 100, top: 80, width: 300, height: 220 },
    { left: 40, top: 40, width: 900, height: 500 },
  );
  assert.equal(delta.dx, 60);
  assert.equal(delta.dy, 40);
  assert.equal(delta.sx, 1 / 3);
  assert.equal(delta.sy, 0.44);
  assert.match(frontierSpringTransform(delta, 0), /translate3d\(60\.000px, 40\.000px, 0\)/);
  assert.equal(frontierSpringTransform(delta, 1), 'translate3d(0.000px, 0.000px, 0) scale(1.00000, 1.00000)');
});