(() => {
  'use strict';
  const canvas = document.getElementById('c');
  const W = 960;
  const H = 640;
  if (!canvas) return;

  const finitePositive = (value, fallback = 1) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  };

  const dpr = Math.max(1, finitePositive(window.devicePixelRatio, 1));
  const memory = finitePositive(navigator.deviceMemory, 4);
  const cores = finitePositive(navigator.hardwareConcurrency, 4);
  const constrained = memory <= 2 || cores <= 2;
  const requestedScale = constrained ? 1 : dpr >= 1.75 ? 2 : dpr >= 1.25 ? 1.5 : 1;
  const scale = finitePositive(requestedScale, 1);

  if (scale !== 1) {
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Guard every transform input explicitly. Canvas host objects throw rather
      // than sanitize NaN/Infinity, so the display layer must never forward an
      // invalid browser/device signal into the authoritative gameplay context.
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      try {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      } catch {}
    }
  }

  canvas.dataset.logicalWidth = String(W);
  canvas.dataset.logicalHeight = String(H);
  canvas.dataset.renderScale = String(scale);
  window.SylvariaDisplayScale = Object.freeze({
    version: '0.7.0',
    logicalWidth: W,
    logicalHeight: H,
    scale,
    dpr,
    constrained,
  });
})();
