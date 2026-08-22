import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

function createRecorderHarness() {
  const listeners = new Map<string, Array<(event: any) => void>>();
  const document = {
    hidden: false,
    addEventListener(type: string, listener: (event: any) => void) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
  };
  const state = { mode: 'playing', worldsCleared: 0 };
  const F: Record<string, any> = {
    setupRoom() {},
    updateMovement() {},
    endRun() {},
  };
  const window: Record<string, any> = { Sylvaria091: { fn: F, state }, addEventListener() {} };
  const sandbox = {
    window,
    document,
    Uint8Array,
    Set,
    Number,
    Math,
    String,
    Array,
    Object,
    btoa(value: string) { return Buffer.from(value, 'binary').toString('base64'); },
  };
  vm.runInNewContext(
    readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v013/replay-v013.js'), 'utf8'),
    sandbox,
    { filename: 'replay-v013.js' },
  );
  F.setupRoom(1);
  const dispatch = (type: string, event: Record<string, unknown> = {}) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  return { window, document, dispatch };
}

test('v0.13 browser replay recorder stops allocating at 24,000 gameplay events', () => {
  const harness = createRecorderHarness();
  for (let index = 0; index < 24_001; index += 1) {
    harness.dispatch('keydown', { key: 'ArrowUp', repeat: false });
  }
  const snapshot = harness.window.SylvariaReplay.snapshot();
  assert.equal(snapshot.version, '0.13.0');
  assert.equal(snapshot.schema, 2);
  assert.equal(snapshot.eventCount, 24_000);
  assert.equal(snapshot.eligible, false);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.overflowReason, 'input event limit');
  assert.deepEqual({ ...snapshot.limits }, { events: 24_000, ticks: 144_000, bytes: 128 * 1024 });
});

test('v0.13 records Space charge and release as deterministic actions 12 and 13', () => {
  const harness = createRecorderHarness();
  harness.dispatch('keydown', { key: ' ', code: 'Space', repeat: false });
  harness.dispatch('keyup', { key: ' ', code: 'Space' });
  const snapshot = harness.window.SylvariaReplay.snapshot();
  const actions = Array.from(snapshot.events, (event: { action: number }) => Number(event.action));
  assert.deepEqual(actions, [12, 13]);
  assert.equal(snapshot.eligible, true);
});

test('ranked replay capture becomes ineligible when the document is hidden', () => {
  const harness = createRecorderHarness();
  harness.dispatch('keydown', { key: 'd', repeat: false });
  harness.document.hidden = true;
  harness.dispatch('visibilitychange');
  const snapshot = harness.window.SylvariaReplay.snapshot();
  assert.equal(snapshot.eventCount, 1);
  assert.equal(snapshot.eligible, false);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.overflowReason, 'visibility changed');
  assert.throws(() => harness.window.SylvariaReplay.envelope('a'.repeat(64)), /ranked replay ineligible/);
});
