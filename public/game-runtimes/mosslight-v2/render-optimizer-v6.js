(() => {
  'use strict';

  const canvas = document.getElementById('c');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const QUALITY_KEY = 'sid.sylvaria.visual-quality.v6';
  const LEVELS = ['performance', 'balanced', 'high'];
  const CONFIG = {
    performance: { blurCap: 0.75, gradientCache: 72, motifCount: 1, ambientAlpha: .3, spriteScale: 1.5, overlayFps: 24 },
    balanced: { blurCap: 4.5, gradientCache: 144, motifCount: 3, ambientAlpha: .44, spriteScale: 2, overlayFps: 30 },
    high: { blurCap: 9, gradientCache: 224, motifCount: 6, ambientAlpha: .6, spriteScale: 2, overlayFps: 45 },
  };

  const validPreference = (value) => ['auto', ...LEVELS].includes(value) ? value : 'auto';
  let preference;
  try { preference = validPreference(localStorage.getItem(QUALITY_KEY) || 'auto'); }
  catch { preference = 'auto'; }
  let tier = preference === 'auto' ? 'balanced' : preference;
  let smoothedFps = 60;
  let lowWindows = 0;
  let highWindows = 0;
  let lastQualityShift = performance.now();
  let lastFrame = performance.now();
  let requestedShadowBlur = 0;
  let shadowPatchActive = false;
  let gradientPatchActive = false;

  const findDescriptor = (object, prop) => {
    let cursor = object;
    while (cursor) {
      const descriptor = Object.getOwnPropertyDescriptor(cursor, prop);
      if (descriptor) return descriptor;
      cursor = Object.getPrototypeOf(cursor);
    }
    return null;
  };

  const shadowDescriptor = findDescriptor(Object.getPrototypeOf(ctx), 'shadowBlur');
  if (shadowDescriptor?.get && shadowDescriptor?.set) {
    try {
      Object.defineProperty(ctx, 'shadowBlur', {
        configurable: true,
        get() { return requestedShadowBlur; },
        set(value) {
          requestedShadowBlur = Number(value) || 0;
          shadowDescriptor.set.call(ctx, Math.min(requestedShadowBlur, CONFIG[tier].blurCap));
        },
      });
      shadowPatchActive = true;
    } catch {}
  }

  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  } catch {}

  const nativeLinear = ctx.createLinearGradient.bind(ctx);
  const nativeRadial = ctx.createRadialGradient.bind(ctx);
  const fillDescriptor = findDescriptor(Object.getPrototypeOf(ctx), 'fillStyle');
  const strokeDescriptor = findDescriptor(Object.getPrototypeOf(ctx), 'strokeStyle');
  const gradientCache = new Map();

  const currentTransform = () => {
    try {
      const matrix = ctx.getTransform();
      return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
    } catch {
      return [1, 0, 0, 1, 0, 0];
    }
  };

  class GradientRequest {
    constructor(kind, args) {
      this.__sylvariaGradient = true;
      this.kind = kind;
      this.args = args;
      this.transform = currentTransform();
      this.stops = [];
    }
    addColorStop(offset, color) {
      this.stops.push([Number(offset), String(color)]);
    }
  }

  const numberKey = (value) => Math.round(Number(value) * 2) / 2;
  const gradientKey = (request) => `${request.kind}:${request.args.map(numberKey).join(',')}:m=${request.transform.map(numberKey).join(',')}:${request.stops.map(([offset, color]) => `${numberKey(offset)}@${color}`).join('|')}`;
  const trimCache = () => {
    const limit = CONFIG[tier].gradientCache;
    while (gradientCache.size > limit) gradientCache.delete(gradientCache.keys().next().value);
  };
  const resolveGradient = (request) => {
    const key = gradientKey(request);
    const cached = gradientCache.get(key);
    if (cached) {
      gradientCache.delete(key);
      gradientCache.set(key, cached);
      return cached;
    }
    const gradient = request.kind === 'linear' ? nativeLinear(...request.args) : nativeRadial(...request.args);
    for (const [offset, color] of request.stops) gradient.addColorStop(offset, color);
    gradientCache.set(key, gradient);
    trimCache();
    return gradient;
  };

  if (fillDescriptor?.get && fillDescriptor?.set && strokeDescriptor?.get && strokeDescriptor?.set) {
    try {
      Object.defineProperty(ctx, 'fillStyle', {
        configurable: true,
        get() { return fillDescriptor.get.call(ctx); },
        set(value) { fillDescriptor.set.call(ctx, value?.__sylvariaGradient ? resolveGradient(value) : value); },
      });
      Object.defineProperty(ctx, 'strokeStyle', {
        configurable: true,
        get() { return strokeDescriptor.get.call(ctx); },
        set(value) { strokeDescriptor.set.call(ctx, value?.__sylvariaGradient ? resolveGradient(value) : value); },
      });
      ctx.createLinearGradient = (...args) => new GradientRequest('linear', args);
      ctx.createRadialGradient = (...args) => new GradientRequest('radial', args);
      gradientPatchActive = true;
    } catch {
      try { delete ctx.fillStyle; } catch {}
      try { delete ctx.strokeStyle; } catch {}
      try { ctx.createLinearGradient = nativeLinear; } catch {}
      try { ctx.createRadialGradient = nativeRadial; } catch {}
      gradientCache.clear();
    }
  }

  const applyTier = (nextTier, reason = 'manual') => {
    if (!CONFIG[nextTier] || nextTier === tier) return;
    tier = nextTier;
    trimCache();
    lastQualityShift = performance.now();
    try { ctx.imageSmoothingQuality = tier === 'performance' ? 'medium' : 'high'; } catch {}
    document.documentElement.dataset.sylvariaQuality = tier;
    window.dispatchEvent(new CustomEvent('sylvaria-quality-change', { detail: { tier, preference, reason } }));
  };

  const setPreference = (next) => {
    preference = validPreference(next);
    try { localStorage.setItem(QUALITY_KEY, preference); } catch {}
    if (preference !== 'auto') applyTier(preference, 'preference');
    else applyTier('balanced', 'auto-reset');
  };

  const noteFrame = (now, reportedFps) => {
    const elapsed = Math.max(1, now - lastFrame);
    lastFrame = now;
    const instantaneous = 1000 / elapsed;
    const sample = Number.isFinite(reportedFps) && reportedFps > 1 ? Math.min(instantaneous, reportedFps) : instantaneous;
    smoothedFps = smoothedFps * .92 + sample * .08;
    if (preference !== 'auto' || now - lastQualityShift < 1600) return;

    if (smoothedFps < 47) { lowWindows += 1; highWindows = 0; }
    else if (smoothedFps > 58) { highWindows += 1; lowWindows = 0; }
    else { lowWindows = Math.max(0, lowWindows - 1); highWindows = Math.max(0, highWindows - 1); }

    if (lowWindows > 34) {
      const index = Math.max(0, LEVELS.indexOf(tier) - 1);
      applyTier(LEVELS[index], 'fps-downshift');
      lowWindows = 0;
    } else if (highWindows > 300) {
      const index = Math.min(LEVELS.length - 1, LEVELS.indexOf(tier) + 1);
      applyTier(LEVELS[index], 'fps-upshift');
      highWindows = 0;
    }
  };

  document.documentElement.dataset.sylvariaQuality = tier;
  canvas.style.imageRendering = 'auto';

  window.SylvariaRenderBudget = Object.freeze({
    version: '0.6.0',
    config: CONFIG,
    get tier() { return tier; },
    get preference() { return preference; },
    get current() { return CONFIG[tier]; },
    setPreference,
    noteFrame,
    snapshot() {
      return {
        preference,
        tier,
        smoothedFps: Number(smoothedFps.toFixed(1)),
        gradientCacheSize: gradientCache.size,
        gradientCacheLimit: CONFIG[tier].gradientCache,
        blurCap: CONFIG[tier].blurCap,
        overlayFps: CONFIG[tier].overlayFps,
        gradientCacheActive: gradientPatchActive,
        shadowBudgetActive: shadowPatchActive,
      };
    },
  });
})();
