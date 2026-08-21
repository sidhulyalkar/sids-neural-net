(() => {
  'use strict';
  const canvas = document.getElementById('c');
  const playtest = window.__MOSSLIGHT_PLAYTEST__;
  if (!canvas || !playtest) return;

  const THEMES = Object.freeze({
    forest: { id: 'forest', label: 'forest / moss' },
    volcanic: { id: 'volcanic', label: 'burn scar / ember' },
    reef: { id: 'reef', label: 'wetland / river' },
    ice: { id: 'ice', label: 'alpine / frost' },
    celestial: { id: 'celestial', label: 'night canopy / anomaly' },
  });
  const SPRID_RULES = Object.freeze([
    'Sprid remains a tiny high-contrast forest warrior at gameplay scale',
    'the machete is always rendered independently from step-dash deformation',
    'cardinal cuts and arrival-direction hints read before ornament',
    'step-dash stretch communicates committed movement without changing collision geometry',
    'high-speed returned bullets use a brighter trail than hostile projectiles',
    'counter flashes are brighter than ambient particles',
  ]);
  const WORLD_RULES = Object.freeze([
    'living trees are gameplay objectives and physical routing geometry',
    'deadwood physically blocks step-dashes until Sprid chops it open',
    'enemy intent lines and recovery rings stay readable over biome decoration',
    'evasion destinations are telegraphed before backsteps or blinks resolve',
    'support links reveal Committee shields without adding HUD text',
    'hostile zigzag wave spiral swerve and wobble patterns preserve readable arrival-side counters',
    'the 960x640 arena remains a stable 3:2 combat field',
    'full-device background extends the room palette without hiding threats',
  ]);

  const backdrop = document.createElement('canvas');
  backdrop.id = 'sylWorldBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  canvas.parentElement?.insertBefore(backdrop, canvas);
  const bg = backdrop.getContext('2d');

  function paint() {
    if (!bg) return;
    const snap = playtest.snapshot();
    const depth = snap.worldDepth || 1;
    const hue = 128 + (depth * 17) % 70;
    const g = bg.createRadialGradient(innerWidth * .5, innerHeight * .45, 20, innerWidth * .5, innerHeight * .5, Math.max(innerWidth, innerHeight));
    g.addColorStop(0, `hsl(${hue} 38% 16%)`);
    g.addColorStop(.58, `hsl(${hue - 18} 42% 7%)`);
    g.addColorStop(1, '#020504');
    bg.fillStyle = g;
    bg.fillRect(0, 0, innerWidth, innerHeight);
    bg.globalAlpha = .15;
    bg.strokeStyle = `hsl(${hue} 70% 70%)`;
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 83 + depth * 29) % Math.max(1, innerWidth);
      bg.beginPath();
      bg.moveTo(x, innerHeight);
      bg.lineTo(x + Math.sin(i) * 90, innerHeight * .2);
      bg.stroke();
    }
    bg.globalAlpha = 1;
  }

  function resize() {
    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    backdrop.width = Math.round(innerWidth * dpr);
    backdrop.height = Math.round(innerHeight * dpr);
    backdrop.style.width = `${innerWidth}px`;
    backdrop.style.height = `${innerHeight}px`;
    if (bg) bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  const rail = document.getElementById('runRail');
  if (rail && !document.getElementById('immersiveBtn')) {
    const button = document.createElement('button');
    button.id = 'immersiveBtn';
    button.type = 'button';
    button.textContent = 'FULLSCREEN';
    button.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      } catch {}
    });
    rail.appendChild(button);
  }

  const originalSnapshot = playtest.snapshot.bind(playtest);
  function visualSnapshot() {
    return {
      version: '0.8.2',
      theme: 'forest',
      themeLabel: 'countercut forest',
      quality: window.SylvariaRenderBudget?.snapshot?.() || { tier: 'balanced' },
      backdropCanvas: true,
      overlayCanvas: false,
      playfieldAspectSafe: true,
      immersiveControl: Boolean(document.getElementById('immersiveBtn')),
      backgroundParticles: 0,
      playfieldScale: window.SylvariaDisplayScale?.scale || 1,
      routeGeometry: true,
      lockedIntentTelegraphs: true,
      resilientMoveQueue: true,
      projectilePatternReadability: true,
      evasiveEnemyCues: true,
      counterRouting: true,
    };
  }
  playtest.version = '0.8.2';
  playtest.snapshot = () => ({ ...originalSnapshot(), visual: visualSnapshot() });

  window.addEventListener('resize', resize);
  window.addEventListener('sylvaria-quality-change', paint);
  resize();

  window.SylvariaVisualSystem = Object.freeze({
    version: '0.8.2',
    themes: THEMES,
    spridRules: SPRID_RULES,
    worldRules: WORLD_RULES,
    classifyTheme: () => THEMES.forest,
    snapshot: visualSnapshot,
  });
})();
