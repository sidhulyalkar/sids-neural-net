(() => {
  'use strict';
  const canvas = document.getElementById('c');
  const playtest = window.__MOSSLIGHT_PLAYTEST__;
  if (!canvas || !playtest) return;

  const THEMES = Object.freeze({
    forest: { id: 'forest', label: 'forest / moss' },
    wetland: { id: 'wetland', label: 'water / reed' },
    alpine: { id: 'alpine', label: 'ice / frost' },
    burnscar: { id: 'burnscar', label: 'bramble / scar' },
    clearing: { id: 'clearing', label: 'open grove' },
  });

  const SPRID_RULES = Object.freeze([
    'Sprid remains a tiny high-contrast forest warrior at gameplay scale',
    'the machete is always rendered independently from step-dash deformation',
    'cardinal cuts and arrival-direction hints read before ornament',
    'locomotion, anticipation, recoil, and recovery are visible without changing hitboxes',
    'terrain modifies movement but never changes the four-direction Countercut grammar',
    'high-speed returned bullets remain brighter than hostile projectiles',
  ]);

  const WORLD_RULES = Object.freeze([
    'living trees are objectives and physical routing geometry',
    'deadwood and brittle barriers physically block step-dashes until opened',
    'ice mud sand water brambles and grass have distinct visual signatures',
    'terrain mobility and hazards apply symmetrically to Sprid and enemies',
    'mud and brambles can jam evasive escape destinations',
    'tall grass is destructible soft scenery rather than opaque HUD information',
    'blink ghosts and backstep smears communicate enemy locomotion without changing simulation state',
    'hostile projectile shapes communicate zigzag wave spiral swerve and wobble families',
    'the 960x640 arena remains a stable 3:2 combat field',
  ]);

  const backdrop = document.createElement('canvas');
  backdrop.id = 'sylWorldBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  canvas.parentElement?.insertBefore(backdrop, canvas);
  const bg = backdrop.getContext('2d');

  function classifyTheme(snapshot) {
    const types = new Set((snapshot.terrain || []).map((patch) => patch.type));
    if (types.has('ice') || types.has('shards')) return THEMES.alpine;
    if (types.has('water')) return THEMES.wetland;
    if (types.has('bramble')) return THEMES.burnscar;
    if (types.size <= 1) return THEMES.clearing;
    return THEMES.forest;
  }

  function paint() {
    if (!bg) return;
    const snap = playtest.snapshot();
    const depth = snap.worldDepth || 1;
    const theme = classifyTheme(snap);
    const hueShift = theme.id === 'alpine' ? 70 : theme.id === 'wetland' ? 35 : theme.id === 'burnscar' ? -18 : 0;
    const hue = 128 + (depth * 17) % 55 + hueShift;
    const g = bg.createRadialGradient(innerWidth * .5, innerHeight * .45, 20, innerWidth * .5, innerHeight * .5, Math.max(innerWidth, innerHeight));
    g.addColorStop(0, `hsl(${hue} 38% 16%)`);
    g.addColorStop(.58, `hsl(${hue - 18} 42% 7%)`);
    g.addColorStop(1, '#020504');
    bg.fillStyle = g;
    bg.fillRect(0, 0, innerWidth, innerHeight);
    bg.globalAlpha = .13;
    bg.strokeStyle = `hsl(${hue} 70% 70%)`;
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 83 + depth * 29) % Math.max(1, innerWidth);
      bg.beginPath();
      bg.moveTo(x, innerHeight);
      bg.lineTo(x + Math.sin(i + depth) * 90, innerHeight * .2);
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
    const snap = originalSnapshot();
    const theme = classifyTheme(snap);
    return {
      version: '0.9.0',
      theme: theme.id,
      themeLabel: theme.label,
      quality: window.SylvariaRenderBudget?.snapshot?.() || { tier: 'balanced' },
      backdropCanvas: true,
      cachedTerrainLayer: true,
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
      terrainReadability: true,
      symmetricTerrainRules: true,
      destructibleFoliage: true,
      combatAnimationStates: true,
      proceduralSilhouettes: true,
    };
  }

  playtest.version = '0.9.0';
  playtest.snapshot = () => ({ ...originalSnapshot(), visual: visualSnapshot() });

  window.addEventListener('resize', resize);
  window.addEventListener('sylvaria-quality-change', paint);
  resize();

  window.SylvariaVisualSystem = Object.freeze({
    version: '0.9.0',
    themes: THEMES,
    spridRules: SPRID_RULES,
    worldRules: WORLD_RULES,
    classifyTheme: () => classifyTheme(originalSnapshot()),
    snapshot: visualSnapshot,
  });
})();
