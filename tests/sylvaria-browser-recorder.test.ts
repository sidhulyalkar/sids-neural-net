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
  const window: Record<string, any> = { Sylvaria091: { fn: F, state } };
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
    readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v011/replay-v011.js'), 'utf8'),
    sandbox,
    { filename: 'replay-v011.js' },
  );
  F.setupRoom(1);
  const dispatch = (type: string, event: Record<string, unknown> = {}) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  return { window, document, dispatch };
}

test('browser replay recorder stops allocating at 20,000 gameplay events', () => {
  const harness = createRecorderHarness();
  for (let index = 0; index < 20_001; index += 1) {
    harness.dispatch('keydown', { key: 'ArrowUp', repeat: false });
  }
  const snapshot = harness.window.SylvariaReplay.snapshot();
  assert.equal(snapshot.eventCount, 20_000);
  assert.equal(snapshot.eligible, false);
  assert.equal(snapshot.active, false);
  assert.equal(snapshot.overflowReason, 'input event limit');
  assert.deepEqual({ ...snapshot.limits }, { events: 20_000, ticks: 144_000, bytes: 120 * 1024 });
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
