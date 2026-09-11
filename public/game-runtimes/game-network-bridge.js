(() => {
  'use strict';

  if (window.__SIDS_GAME_NETWORK_BRIDGE__) return;
  window.__SIDS_GAME_NETWORK_BRIDGE__ = true;

  const SOURCE = 'sids-game-network-runtime';
  const notify = (kind = 'focus') => {
    if (window.parent === window) return;
    try {
      window.parent.postMessage({ source: SOURCE, kind }, window.location.origin);
    } catch {}
  };

  const focusCanvas = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        canvas.focus({ preventScroll: true });
      } catch {
        try {
          canvas.focus();
        } catch {}
      }
    } else {
      try {
        window.focus();
      } catch {}
    }
  };

  window.addEventListener(
    'pointerdown',
    () => {
      focusCanvas();
      notify('focus');
    },
    true
  );
  window.addEventListener(
    'mousedown',
    () => {
      focusCanvas();
      notify('focus');
    },
    true
  );
  window.addEventListener('touchstart', () => {
    focusCanvas();
    notify('focus');
  }, { capture: true, passive: true });
  window.addEventListener('focusin', () => notify('focus'), true);
  window.addEventListener(
    'keydown',
    (event) => notify(event.key === 'Escape' ? 'escape' : 'focus'),
    true
  );

  // Prefer an explicit keyboard target inside the frame as soon as the bridge loads.
  focusCanvas();
})();
