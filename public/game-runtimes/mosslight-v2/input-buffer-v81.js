(() => {
  'use strict';

  const playtest = window.__MOSSLIGHT_PLAYTEST__;
  if (!playtest) return;

  const MOVE_KEYS = new Set(['w', 'a', 's', 'd']);
  const BUFFER_MS = 320;
  let queued = null;
  let raf = 0;

  function normalizedKey(event) {
    return String(event.key || '').toLowerCase();
  }

  function queueMove(key) {
    queued = { key, expiresAt: performance.now() + BUFFER_MS };
  }

  function clearQueue() {
    queued = null;
  }

  function pump(now) {
    const snapshot = playtest.snapshot();
    if (queued && snapshot.mode === 'playing') {
      if (now > queued.expiresAt) {
        clearQueue();
      } else if (!snapshot.player?.dashing) {
        const before = snapshot.stats?.dashes || 0;
        playtest.requestDash(queued.key);
        const after = playtest.snapshot();
        if (after.player?.dashing || (after.stats?.dashes || 0) > before) clearQueue();
      }
    } else if (queued && snapshot.mode !== 'playing') {
      clearQueue();
    }
    raf = requestAnimationFrame(pump);
  }

  document.addEventListener('keydown', (event) => {
    const key = normalizedKey(event);
    if (!MOVE_KEYS.has(key) || event.repeat) return;
    const snapshot = playtest.snapshot();
    if (snapshot.mode !== 'playing' || !snapshot.player?.dashing) return;

    // During an active committed step, the newest cardinal input becomes the
    // single next-step intent. Capture-phase interception prevents the older
    // short-lived in-core buffer from racing browser frame scheduling.
    event.preventDefault();
    event.stopImmediatePropagation();
    queueMove(key);
  }, true);

  window.addEventListener('blur', clearQueue);
  window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });

  raf = requestAnimationFrame(pump);
  window.SylvariaInputBuffer = Object.freeze({
    version: '0.8.1',
    maxQueuedSteps: 1,
    bufferMs: BUFFER_MS,
    snapshot: () => queued ? { key: queued.key, remainingMs: Math.max(0, queued.expiresAt - performance.now()) } : null,
  });
})();
