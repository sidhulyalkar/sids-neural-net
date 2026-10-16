(() => {
  'use strict';

  const nativeRequest = window.requestAnimationFrame?.bind(window);
  const nativeCancel = window.cancelAnimationFrame?.bind(window);
  if (!nativeRequest || !nativeCancel) return;

  const FALLBACK_MS = 48;
  let nextToken = 1;
  const pending = new Map();

  window.requestAnimationFrame = (callback) => {
    const token = nextToken++;
    let settled = false;
    let nativeId = 0;
    let timerId = 0;

    const finish = (timestamp) => {
      if (settled) return;
      settled = true;
      if (timerId) window.clearTimeout(timerId);
      if (nativeId) nativeCancel(nativeId);
      pending.delete(token);
      callback(Number.isFinite(timestamp) ? timestamp : performance.now());
    };

    nativeId = nativeRequest(finish);
    timerId = window.setTimeout(() => finish(performance.now()), FALLBACK_MS);
    pending.set(token, { nativeId, timerId, cancel: () => {
      if (settled) return;
      settled = true;
      nativeCancel(nativeId);
      window.clearTimeout(timerId);
      pending.delete(token);
    } });
    return token;
  };

  window.cancelAnimationFrame = (token) => {
    const request = pending.get(token);
    if (request) request.cancel();
  };

  window.__MOSSLIGHT_FRAME_DRIVER__ = {
    mode: 'native-with-bounded-fallback',
    fallbackMs: FALLBACK_MS,
  };
})();
