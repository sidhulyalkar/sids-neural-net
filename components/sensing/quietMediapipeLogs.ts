'use client';

// MediaPipe's WASM runtime routes informational lines ("INFO: Created TensorFlow
// Lite XNNPACK delegate for CPU.") through console.error. Next's dev overlay
// escalates any console.error into a blocking Console Error modal, so loading a
// model pops an error dialog for a message that reports success.
//
// Only exact `INFO:`-prefixed strings are dropped; every other console.error —
// including real MediaPipe failures — passes through untouched.

const INFO_PREFIX = /^INFO:\s/;

let patched = false;

export function quietMediapipeInfoLogs(): void {
  if (patched || typeof console === 'undefined') return;
  patched = true;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string' && INFO_PREFIX.test(first)) {
      console.debug(...args);
      return;
    }
    original(...args);
  };
}
