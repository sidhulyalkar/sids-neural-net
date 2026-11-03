import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const bridge = readFileSync('public/game-runtimes/game-network-bridge.js', 'utf8');

test('runtime bridge makes even a dynamically replaced packed canvas focusable', () => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  let focusCalls = 0;
  let activeCanvas = {
    tabIndex: -1,
    focus: () => { focusCalls += 1; },
  };
  const windowObject = {
    parent: null as unknown,
    location: { origin: 'http://localhost:3000' },
    addEventListener: (name: string, handler: (...args: unknown[]) => void) => {
      listeners.set(name, handler);
    },
    focus: () => { throw new Error('Canvas is present and must be focused'); },
  };
  windowObject.parent = windowObject;
  const doc = { querySelector: (selector: string) => selector === 'canvas' ? activeCanvas : null };

  runInNewContext(bridge, { window: windowObject, document: doc });
  assert.equal(activeCanvas.tabIndex, 0, 'Startup canvas must be focusable');
  assert.equal(focusCalls, 1);

  activeCanvas = {
    tabIndex: -1,
    focus: () => { focusCalls += 1; },
  };
  listeners.get('pointerdown')?.();
  assert.equal(activeCanvas.tabIndex, 0, 'Recreated canvas must be focusable on interaction');
  assert.equal(focusCalls, 2);
});

test('runtime bridge respects an already keyboard-focusable canvas', () => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const canvas = { tabIndex: 2, focus: () => {} };
  const windowObject = {
    parent: null as unknown,
    location: { origin: 'http://localhost:3000' },
    addEventListener: (name: string, handler: (...args: unknown[]) => void) => { listeners.set(name, handler); },
  };
  windowObject.parent = windowObject;
  runInNewContext(bridge, { window: windowObject, document: { querySelector: () => canvas } });
  assert.equal(canvas.tabIndex, 2, 'Do not replace a consciously configured positive tab order');
});
