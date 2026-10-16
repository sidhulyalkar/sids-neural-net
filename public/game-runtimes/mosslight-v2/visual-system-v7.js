(() => {
  'use strict';

  const gameCanvas = document.getElementById('c');
  const playtest = window.__MOSSLIGHT_PLAYTEST__;
  const content = window.MosslightContent;
  const budget = window.SylvariaRenderBudget;
  if (!gameCanvas || !playtest || !content?.rooms?.length || !budget) return;

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const RESONANCE_COLORS = Object.freeze({
    rain: '#64d9ff', sun: '#ffdb6e', seed: '#76f59c', wind: '#c9fff4', mend: '#ff92c6', gather: '#ffb66e',
  });

  const THEMES = Object.freeze({
    forest: {
      id: 'forest', label: 'forest / moss',
      colors: { bg: '#030b08', sky: '#09251a', mid: '#123d26', floor: '#1e5433', accent: '#8dffac', water: '#5fe9ff', warm: '#f0af70', danger: '#ff8f72', ink: '#effff4' },
      cue: 'moss cathedral · cyan spores · warm bark',
    },
    volcanic: {
      id: 'volcanic', label: 'cave / volcanic',
      colors: { bg: '#090504', sky: '#1a0a08', mid: '#42160f', floor: '#5d281b', accent: '#66efc7', water: '#4ce3ef', warm: '#ff9454', danger: '#ff5e50', ink: '#fff2e8' },
      cue: 'ember cavern · basalt teeth · teal fungi',
    },
    reef: {
      id: 'reef', label: 'reef / wetland',
      colors: { bg: '#020a11', sky: '#062130', mid: '#07465a', floor: '#0b6270', accent: '#6fffd0', water: '#4edfff', warm: '#ff9f7c', danger: '#ff6e8a', ink: '#e9feff' },
      cue: 'living water · coral gardens · soft caustics',
    },
    ice: {
      id: 'ice', label: 'ice / alpine',
      colors: { bg: '#030910', sky: '#0a2035', mid: '#17445d', floor: '#285f78', accent: '#c8fbff', water: '#70cfff', warm: '#c9a9ff', danger: '#ff8cab', ink: '#f5fdff' },
      cue: 'glacial air · crystal ridges · violet snowlight',
    },
    celestial: {
      id: 'celestial', label: 'celestial / anomaly',
      colors: { bg: '#03020c', sky: '#090a25', mid: '#19164d', floor: '#2b2567', accent: '#82ffe7', water: '#61d8ff', warm: '#e08fff', danger: '#ff77bd', ink: '#f7f2ff' },
      cue: 'deep indigo · aurora ribbons · orbital flora',
    },
  });

  const SPRID_RULES = Object.freeze([
    'high-contrast eyes and leaf crown survive every palette',
    'portal gun silhouette stays separate from Sprid at gameplay scale',
    'movement creates readable footfall, recoil, dash, and Mossglint-ready accents',
    'detail is additive and never changes collision geometry',
  ]);
  const WORLD_RULES = Object.freeze([
    'every Atlas family changes silhouette, horizon, particles, motion, and lighting rather than hue alone',
    'the 960x640 gameplay field keeps a stable 3:2 composition while the world extends into unused device space',
    'foreground motion responds subtly to Sprid for depth without obscuring puzzle targets',
    'weather and ambient particles are seeded, bounded, and quality-tier aware',
    'interactive events ripple into the environment so casting, Mossglint, and portal extraction feel physically connected to the world',
  ]);

  const hash = (value) => {
    let result = 2166136261;
    for (const ch of String(value)) {
      result ^= ch.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  };
  const rngFrom = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const alpha = (hex, a) => {
    if (!hex?.startsWith('#')) return `rgba(255,255,255,${a})`;
    let raw = hex.slice(1);
    if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
    const value = Number.parseInt(raw, 16);
    return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${a})`;
  };

  function classifyTheme(room) {
    const atlas = room?.atlas || {};
    const scene = atlas.scene || {};
    const cues = Array.isArray(scene.renderCues) ? scene.renderCues.join(' ') : '';
    const collection = String(atlas.collection || '').toLowerCase();
    const text = `${collection} ${atlas.terrain || ''} ${scene.atmosphere || atlas.atmosphere || ''} ${scene.focalSubject || atlas.focalSubject || ''} ${cues} ${room?.decor || ''}`.toLowerCase();
    if (collection === 'celestial' || /\bstars?\b|space|cosmic|celestial|void|nebula|aurora|meteor|moon|anomaly/.test(text)) return THEMES.celestial;
    if (/reef|shore|wetland|river|lake|tide|ocean|kelp|coral|marsh|water|lagoon/.test(text)) return THEMES.reef;
    if (/ice|snow|mountain|alpine|glacier|frost|tundra|crystal/.test(text)) return THEMES.ice;
    if (/desert|canyon|volcanic|lava|ember|burn|basalt|cave|cavern|geological/.test(text)) return THEMES.volcanic;
    return THEMES.forest;
  }

  function currentRoom(snapshot) {
    return content.rooms[snapshot.sectorIndex] || content.rooms[0];
  }

  const backdrop = document.createElement('canvas');
  backdrop.id = 'sylWorldBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  gameCanvas.parentElement?.insertBefore(backdrop, gameCanvas);
  const bg = backdrop.getContext('2d');

  const playfieldScale = Math.max(1, Number(window.SylvariaDisplayScale?.scale) || 1);
  const overlay = document.createElement('canvas');
  overlay.id = 'sylVisualOverlay';
  overlay.width = Math.round(W * playfieldScale);
  overlay.height = Math.round(H * playfieldScale);
  overlay.setAttribute('aria-hidden', 'true');
  overlay.className = 'syl-playfield';
  gameCanvas.insertAdjacentElement('afterend', overlay);
  const ctx = overlay.getContext('2d');
  if (!bg || !ctx) {
    backdrop.remove();
    overlay.remove();
    return;
  }
  ctx.setTransform(playfieldScale, 0, 0, playfieldScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let backdropScale = 1;
  function resizeBackdrop() {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const requested = budget.tier === 'high' ? Math.min(1.5, window.devicePixelRatio || 1) : budget.tier === 'balanced' ? Math.min(1.2, window.devicePixelRatio || 1) : 1;
    backdropScale = requested;
    const nextW = Math.max(1, Math.round(cssW * requested));
    const nextH = Math.max(1, Math.round(cssH * requested));
    if (backdrop.width !== nextW || backdrop.height !== nextH) {
      backdrop.width = nextW;
      backdrop.height = nextH;
    }
  }
  resizeBackdrop();
  window.addEventListener('resize', resizeBackdrop, { passive: true });

  let theme = THEMES.forest;
  let sceneKey = '';
  let sceneModel = null;
  let ambient = [];
  let ridges = [];
  let foreground = [];
  let reactions = [];
  let lastPlayer = null;
  let lastStats = { casts: 0, hits: 0, stones: 0, portals: 0 };
  let lastPortalPhase = 'sealed';

  function buildSceneModel(room, snapshot) {
    const atlas = room?.atlas || {};
    const scene = atlas.scene || {};
    const seed = atlas.seed ?? hash(`${room?.id || 'sylvaria'}:${snapshot.worldDepth}`);
    const rng = rngFrom(seed >>> 0);
    theme = classifyTheme(room);
    const density = clamp(Number(scene.density ?? .55), .2, 1);
    const sparkle = clamp(Number(scene.sparkle ?? .35), 0, 1);
    const atmosphere = String(scene.atmosphere || 'clear');
    const depth = String(scene.depth || 'pathway');
    const cueSet = new Set(scene.renderCues || []);

    ambient = Array.from({ length: 72 }, (_, index) => ({
      x: rng(), y: rng(), z: .15 + rng() * .85, phase: rng() * TAU,
      size: .5 + rng() * (2.2 + sparkle * 2.2), kind: index % 7,
    }));
    ridges = Array.from({ length: 18 }, (_, index) => ({
      x: index / 17, height: .1 + rng() * .38, width: .06 + rng() * .12, phase: rng() * TAU,
    }));
    foreground = Array.from({ length: 16 }, (_, index) => ({
      side: index % 2 ? 1 : -1, y: .15 + rng() * .75, size: .45 + rng() * .9, z: .45 + rng() * .55, phase: rng() * TAU,
    }));

    const model = { seed, density, sparkle, atmosphere, depth, cueSet, atlas, scene, room };
    sceneModel = model;
    document.body.dataset.sylTheme = theme.id;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(theme.colors)) root.style.setProperty(`--biome-${name}`, value);
    const badge = document.getElementById('biomeBadge');
    if (badge) badge.textContent = `${theme.label} · ${theme.cue}`;
    return model;
  }

  function refreshScene(snapshot, force = false) {
    const room = currentRoom(snapshot);
    const key = `${snapshot.sectorIndex}:${snapshot.worldDepth}:${room?.atlas?.index || 0}:${room?.atlas?.seed || room?.id || 0}`;
    if (!force && key === sceneKey) return false;
    sceneKey = key;
    buildSceneModel(room, snapshot);
    reactions.length = 0;
    lastPlayer = snapshot.player ? { ...snapshot.player } : null;
    lastStats = { ...snapshot.stats };
    lastPortalPhase = snapshot.portalPhase;
    return true;
  }

  function backdropGradient(g, width, height) {
    const top = g.createLinearGradient(0, 0, 0, height);
    top.addColorStop(0, theme.colors.bg);
    top.addColorStop(.48, theme.colors.sky);
    top.addColorStop(1, theme.colors.mid);
    g.fillStyle = top;
    g.fillRect(0, 0, width, height);
    const aura = g.createRadialGradient(width * .56, height * .4, 0, width * .56, height * .4, Math.max(width, height) * .6);
    aura.addColorStop(0, alpha(theme.colors.water, theme.id === 'celestial' ? .18 : .11));
    aura.addColorStop(.42, alpha(theme.colors.accent, .06));
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = aura;
    g.fillRect(0, 0, width, height);
  }

  function drawForestBackdrop(g, w, h, t, px) {
    const sway = Math.sin(t * .2) * w * .006 + px * .02;
    g.save();
    g.globalAlpha = .62;
    for (let side = 0; side < 2; side += 1) {
      const direction = side ? -1 : 1;
      for (let i = 0; i < 6; i += 1) {
        const base = side ? w - i * w * .055 : i * w * .055;
        g.strokeStyle = alpha(i % 2 ? theme.colors.floor : theme.colors.accent, .22 + i * .018);
        g.lineWidth = Math.max(3, w * (.009 - i * .0007));
        g.beginPath();
        g.moveTo(base, h * 1.05);
        g.bezierCurveTo(base + direction * w * .12, h * .7, base + direction * (w * .08 + sway), h * .32, base + direction * w * .05, -h * .08);
        g.stroke();
      }
    }
    g.globalAlpha = .28;
    for (const ridge of ridges) {
      const x = ridge.x * w;
      const y = h * (.72 - ridge.height * .25);
      g.fillStyle = alpha(theme.colors.floor, .35);
      g.beginPath(); g.ellipse(x, y, ridge.width * w, ridge.height * h * .35, 0, 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawVolcanicBackdrop(g, w, h, t, px) {
    g.save();
    const floor = h * .69;
    const lava = g.createLinearGradient(0, floor, 0, h);
    lava.addColorStop(0, alpha(theme.colors.warm, .08));
    lava.addColorStop(1, alpha('#100402', .8));
    g.fillStyle = lava; g.fillRect(0, floor, w, h - floor);
    g.fillStyle = alpha('#030202', .72);
    for (const ridge of ridges) {
      const x = ridge.x * w + px * ridge.height * .04;
      const base = h * .78;
      const hh = h * (.16 + ridge.height * .32);
      g.beginPath(); g.moveTo(x - ridge.width * w, base); g.lineTo(x, base - hh); g.lineTo(x + ridge.width * w, base); g.closePath(); g.fill();
      g.strokeStyle = alpha(theme.colors.warm, .18); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, base - hh * .9); g.lineTo(x - ridge.width * w * .18, base - hh * .44); g.lineTo(x + ridge.width * w * .12, base - hh * .2); g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    for (const mote of ambient.slice(0, 34)) {
      const y = ((mote.y + t * (.006 + mote.z * .01)) % 1) * h;
      g.fillStyle = alpha(mote.kind % 2 ? theme.colors.warm : theme.colors.accent, .18 + mote.z * .22);
      g.beginPath(); g.arc(mote.x * w, h - y * .74, mote.size * backdropScale, 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawReefBackdrop(g, w, h, t, px) {
    g.save();
    const water = g.createLinearGradient(0, h * .2, 0, h);
    water.addColorStop(0, alpha(theme.colors.water, .05));
    water.addColorStop(1, alpha(theme.colors.floor, .34));
    g.fillStyle = water; g.fillRect(0, h * .18, w, h * .82);
    g.strokeStyle = alpha(theme.colors.water, .18); g.lineWidth = Math.max(1, w * .0013);
    for (let row = 0; row < 9; row += 1) {
      g.beginPath();
      for (let x = -20; x <= w + 20; x += 26) {
        const y = h * (.18 + row * .07) + Math.sin(x * .012 + t * (.45 + row * .04)) * (6 + row * .8) + px * .008;
        if (x < 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (const item of foreground.slice(0, 12)) {
      const x = item.side < 0 ? w * (.04 + item.size * .06) : w * (.96 - item.size * .06);
      const base = h * (.82 + item.y * .16);
      g.strokeStyle = alpha(item.side > 0 ? theme.colors.warm : theme.colors.accent, .18 + item.z * .18);
      g.lineWidth = 3 + item.size * 5;
      g.beginPath(); g.moveTo(x, h); g.bezierCurveTo(x + item.side * -28, base, x + Math.sin(t + item.phase) * 24, h * .62, x + item.side * -22, h * .44); g.stroke();
    }
    g.restore();
  }

  function drawIceBackdrop(g, w, h, t, px) {
    g.save();
    g.fillStyle = alpha('#dff9ff', .035);
    g.fillRect(0, 0, w, h);
    const base = h * .82;
    for (const ridge of ridges) {
      const x = ridge.x * w + px * ridge.height * .035;
      const width = ridge.width * w * 1.25;
      const hh = h * (.12 + ridge.height * .38);
      const crystal = g.createLinearGradient(x, base - hh, x, base);
      crystal.addColorStop(0, alpha(theme.colors.ink, .28));
      crystal.addColorStop(.5, alpha(theme.colors.water, .17));
      crystal.addColorStop(1, alpha(theme.colors.floor, .24));
      g.fillStyle = crystal;
      g.beginPath(); g.moveTo(x - width, base); g.lineTo(x, base - hh); g.lineTo(x + width, base); g.closePath(); g.fill();
      g.strokeStyle = alpha(ridge.x > .5 ? theme.colors.warm : theme.colors.accent, .18); g.lineWidth = 1; g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    for (const mote of ambient.slice(0, 44)) {
      const drift = (mote.y + t * (.004 + mote.z * .007)) % 1;
      g.fillStyle = alpha(theme.colors.ink, .18 + mote.z * .28);
      g.beginPath(); g.arc(mote.x * w + Math.sin(t + mote.phase) * 5, drift * h, Math.max(.6, mote.size * .48), 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawCelestialBackdrop(g, w, h, t, px, py) {
    g.save();
    const nebula = g.createRadialGradient(w * .45, h * .36, 0, w * .45, h * .36, Math.max(w, h) * .52);
    nebula.addColorStop(0, alpha(theme.colors.warm, .14));
    nebula.addColorStop(.36, alpha(theme.colors.water, .07));
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = nebula; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (const mote of ambient) {
      const x = (mote.x * w + px * mote.z * .025 + w) % w;
      const y = (mote.y * h + py * mote.z * .018 + h) % h;
      const pulse = .55 + .45 * Math.sin(t * (.8 + mote.z) + mote.phase);
      g.fillStyle = alpha(mote.kind % 3 === 0 ? theme.colors.warm : mote.kind % 2 ? theme.colors.water : theme.colors.accent, .18 + pulse * .4);
      g.beginPath(); g.arc(x, y, Math.max(.45, mote.size * (.4 + pulse * .45)), 0, TAU); g.fill();
    }
    g.globalAlpha = .22;
    g.strokeStyle = theme.colors.accent; g.lineWidth = Math.max(1, w * .0015);
    for (let band = 0; band < 3; band += 1) {
      g.beginPath();
      for (let x = -40; x <= w + 40; x += 34) {
        const y = h * (.18 + band * .09) + Math.sin(x * .009 + t * (.18 + band * .05) + band) * (22 + band * 8);
        if (x < 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  }

  function drawBackdrop(snapshot, now) {
    if (!sceneModel) return;
    const w = backdrop.width / backdropScale;
    const h = backdrop.height / backdropScale;
    bg.setTransform(backdropScale, 0, 0, backdropScale, 0, 0);
    bg.clearRect(0, 0, w, h);
    backdropGradient(bg, w, h);
    const player = snapshot.player || { x: W / 2, y: H / 2 };
    const px = player.x - W / 2;
    const py = player.y - H / 2;
    const t = now * .001;
    if (theme.id === 'forest') drawForestBackdrop(bg, w, h, t, px);
    else if (theme.id === 'volcanic') drawVolcanicBackdrop(bg, w, h, t, px);
    else if (theme.id === 'reef') drawReefBackdrop(bg, w, h, t, px);
    else if (theme.id === 'ice') drawIceBackdrop(bg, w, h, t, px);
    else drawCelestialBackdrop(bg, w, h, t, px, py);

    const shade = bg.createRadialGradient(w * .5, h * .48, Math.min(w, h) * .16, w * .5, h * .48, Math.max(w, h) * .7);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,.5)');
    bg.fillStyle = shade; bg.fillRect(0, 0, w, h);
  }

  function reaction(x, y, color, kind = 'cast', strength = 1) {
    reactions.push({ x, y, color, kind, strength, life: 1, age: 0 });
    if (reactions.length > 14) reactions.shift();
  }

  function detectReactions(snapshot) {
    const p = snapshot.player;
    if (p && lastPlayer) {
      const speed = Math.hypot(p.x - lastPlayer.x, p.y - lastPlayer.y);
      if (speed > 5.5 && Math.random() < .15) reaction(p.x, p.y + 15, theme.colors.accent, 'step', .45);
    }
    if (p) lastPlayer = { ...p };
    const stats = snapshot.stats || {};
    if ((stats.casts || 0) > (lastStats.casts || 0) && p) {
      const a = p.facing || 0;
      reaction(p.x + Math.cos(a) * 25, p.y + Math.sin(a) * 25, RESONANCE_COLORS[snapshot.selected] || theme.colors.water, 'cast', 1);
    }
    if ((stats.hits || 0) > (lastStats.hits || 0) && p) reaction(p.x, p.y, theme.colors.danger, 'hit', 1.25);
    if ((snapshot.stones || 0) > (lastStats.stones || 0) && p) reaction(p.x, p.y, theme.colors.accent, 'mossglint', 1.45);
    if (snapshot.portalPhase !== lastPortalPhase && snapshot.portalPhase === 'open') reaction(894, H / 2, '#b56cff', 'portal', 2.2);
    lastStats = { ...stats, stones: snapshot.stones || 0 };
    lastPortalPhase = snapshot.portalPhase;
  }

  function updateReactions(dt) {
    for (const pulse of reactions) {
      pulse.age += dt;
      pulse.life = Math.max(0, 1 - pulse.age / (pulse.kind === 'portal' ? 1.6 : .8));
    }
    reactions = reactions.filter((pulse) => pulse.life > 0);
  }

  function drawAtmosphere(snapshot, now) {
    const t = now * .001;
    const cfg = budget.current;
    const player = snapshot.player || { x: W / 2, y: H / 2 };
    const count = budget.tier === 'high' ? 46 : budget.tier === 'balanced' ? 28 : 14;
    const atmosphere = sceneModel?.atmosphere || 'clear';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < Math.min(count, ambient.length); i += 1) {
      const mote = ambient[i];
      let x = (mote.x * W + (player.x - W / 2) * -mote.z * .025 + W) % W;
      let y = mote.y * H;
      const drift = settingsReducedMotion() ? 0 : t;
      let color = theme.colors.accent;
      let radius = mote.size * .55;
      if (/rain|storm/.test(atmosphere)) {
        x = (x + drift * 25 * mote.z) % W;
        y = (y + drift * 150 * (.45 + mote.z)) % H;
        ctx.strokeStyle = alpha(theme.colors.water, .18 + mote.z * .32);
        ctx.lineWidth = .7 + mote.z;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13 + mote.z * 10); ctx.stroke();
        continue;
      }
      if (/snow|frost/.test(atmosphere) || theme.id === 'ice') {
        y = (y + drift * 16 * (.5 + mote.z)) % H;
        x += Math.sin(drift * .7 + mote.phase) * 9;
        color = theme.colors.ink;
      } else if (theme.id === 'reef') {
        y = (H + y - (drift * 14 * (.5 + mote.z)) % H) % H;
        x += Math.sin(drift + mote.phase) * 6;
        color = i % 3 ? theme.colors.water : theme.colors.warm;
        ctx.strokeStyle = alpha(color, .18 + mote.z * .2);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, radius * 1.4), 0, TAU); ctx.stroke();
        continue;
      } else if (theme.id === 'volcanic') {
        y = (H + y - (drift * 22 * (.5 + mote.z)) % H) % H;
        x += Math.sin(drift * 1.2 + mote.phase) * 4;
        color = i % 3 ? theme.colors.warm : theme.colors.accent;
      } else if (theme.id === 'celestial') {
        x += Math.sin(drift * .25 + mote.phase) * 5;
        y += Math.cos(drift * .2 + mote.phase) * 4;
        color = i % 3 === 0 ? theme.colors.warm : i % 2 ? theme.colors.water : theme.colors.accent;
      } else {
        x += Math.sin(drift * .55 + mote.phase) * 6;
        y += Math.cos(drift * .43 + mote.phase) * 5;
        color = i % 3 ? theme.colors.accent : theme.colors.water;
      }
      ctx.fillStyle = alpha(color, cfg.ambientAlpha * (.28 + mote.z * .55));
      ctx.beginPath(); ctx.arc(x, y, Math.max(.6, radius), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function settingsReducedMotion() {
    return Boolean(document.getElementById('motionToggle')?.checked) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function drawForeground(snapshot, now) {
    if (budget.tier === 'performance') return;
    const t = now * .001;
    const p = snapshot.player || { x: W / 2, y: H / 2 };
    const limit = budget.tier === 'high' ? 12 : 7;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < Math.min(limit, foreground.length); i += 1) {
      const item = foreground[i];
      const baseX = item.side < 0 ? -18 + item.size * 25 : W + 18 - item.size * 25;
      const x = baseX + (p.x - W / 2) * -item.z * .035;
      const y = item.y * H + (p.y - H / 2) * -item.z * .02;
      const sway = settingsReducedMotion() ? 0 : Math.sin(t * (.3 + item.z * .3) + item.phase) * (7 + item.size * 6);
      ctx.globalAlpha = .12 + item.z * .12;
      ctx.strokeStyle = i % 3 === 0 ? theme.colors.warm : i % 2 ? theme.colors.water : theme.colors.accent;
      ctx.lineWidth = 2 + item.size * 3;
      ctx.beginPath();
      ctx.moveTo(x, H + 25);
      ctx.bezierCurveTo(x + item.side * 34, y + 120, x + sway, y + 38, x + item.side * -18, y - item.size * 45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTargetAuras(snapshot, now) {
    const t = now * .001;
    ctx.save();
    for (const target of snapshot.targets || []) {
      if (target.done) continue;
      const color = RESONANCE_COLORS[target.expected] || theme.colors.accent;
      const r = 31 + Math.sin(t * 2.2 + hash(target.id)) * 2.5;
      ctx.strokeStyle = alpha(color, .16);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 7]);
      ctx.lineDashOffset = -t * 8;
      ctx.beginPath(); ctx.arc(target.x, target.y, r, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEnemyFace(enemy, now) {
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);
    const blink = Math.sin(now * .0017 + x * .031) > .986;
    const focus = /stalk|dash|swoop/.test(enemy.pattern) ? 1.1 : .45;
    ctx.save();
    ctx.fillStyle = 'rgba(1,10,12,.92)';
    for (const side of [-1, 1]) {
      if (blink) ctx.fillRect(x + side * 4 - 2, y - 3, 4, 1.2);
      else {
        ctx.beginPath(); ctx.ellipse(x + side * 4, y - 3, 2.35, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(246,255,251,.94)';
        ctx.beginPath(); ctx.arc(x + side * 4 + focus, y - 4, .7, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(1,10,12,.92)';
      }
    }
    ctx.strokeStyle = alpha(theme.colors.ink, .5); ctx.lineWidth = .8;
    ctx.beginPath();
    if (enemy.pattern === 'dash') { ctx.moveTo(x - 3, y + 4); ctx.lineTo(x + 3, y + 4); }
    else ctx.arc(x, y + 2.5, 3.2, .18, Math.PI - .18);
    ctx.stroke();
    if (/dash|stalk/.test(enemy.pattern)) {
      ctx.strokeStyle = alpha(theme.colors.danger, .65); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x - 3, y - 6); ctx.moveTo(x + 8, y - 8); ctx.lineTo(x + 3, y - 6); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpridHighlights(snapshot, now) {
    const p = snapshot.player;
    if (!p) return;
    const facing = p.facing || 0;
    const fx = Math.cos(facing);
    const fy = Math.sin(facing);
    ctx.save();
    ctx.strokeStyle = alpha(theme.colors.ink, .38);
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.arc(p.x, p.y - 1, 18.2, -2.35, -.55); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.arc(Math.round(p.x + side * 5 + fx * 2.4), Math.round(p.y - 5 + fy * 1.1), 1.05, 0, TAU); ctx.fill();
    }
    if (snapshot.portalPhase === 'ready') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < (budget.tier === 'performance' ? 3 : 6); i += 1) {
        const a = now * .0013 + i * TAU / 6;
        ctx.fillStyle = i % 3 === 0 ? theme.colors.accent : i % 2 ? '#b56cff' : theme.colors.water;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 18, 1.2 + (i % 2) * .5, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawReactions() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pulse of reactions) {
      const radius = (10 + pulse.age * (pulse.kind === 'portal' ? 86 : 44)) * pulse.strength;
      ctx.strokeStyle = alpha(pulse.color, pulse.life * (pulse.kind === 'step' ? .16 : .5));
      ctx.lineWidth = pulse.kind === 'portal' ? 2 : 1.3;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, radius, 0, TAU); ctx.stroke();
      if (pulse.kind === 'mossglint' || pulse.kind === 'portal') {
        for (let i = 0; i < (budget.tier === 'performance' ? 4 : 9); i += 1) {
          const a = i * TAU / 9 + pulse.age * 1.2;
          ctx.fillStyle = alpha(i % 2 ? theme.colors.water : pulse.color, pulse.life * .55);
          ctx.beginPath(); ctx.arc(pulse.x + Math.cos(a) * radius * .7, pulse.y + Math.sin(a) * radius * .5, 1.2, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawPortalPolish(snapshot, now) {
    if (!snapshot.portalOpen) return;
    const t = now * .001;
    ctx.save(); ctx.translate(894, H / 2); ctx.globalCompositeOperation = 'lighter';
    const colors = ['#b56cff', theme.colors.water, theme.colors.accent, '#6f73ff'];
    const ringCount = budget.tier === 'performance' ? 2 : 4;
    for (let i = 0; i < ringCount; i += 1) {
      ctx.strokeStyle = alpha(colors[i % colors.length], .28 + i * .07);
      ctx.lineWidth = 1 + i * .35;
      ctx.setLineDash([2 + i * 2, 8 - Math.min(i, 5)]);
      ctx.lineDashOffset = t * (i % 2 ? -15 : 12);
      ctx.beginPath(); ctx.arc(0, 0, 51 + i * 5, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();
  }

  function renderOverlay(snapshot, now) {
    ctx.setTransform(playfieldScale, 0, 0, playfieldScale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (snapshot.mode !== 'playing') return;
    drawAtmosphere(snapshot, now);
    drawForeground(snapshot, now);
    drawTargetAuras(snapshot, now);
    for (const enemy of snapshot.enemies || []) drawEnemyFace(enemy, now);
    drawSpridHighlights(snapshot, now);
    drawReactions();
    drawPortalPolish(snapshot, now);
  }

  function installFullscreenControl() {
    const rail = document.getElementById('runRail');
    if (!rail || document.getElementById('immersiveBtn')) return;
    const wrap = document.createElement('div');
    wrap.id = 'immersiveAction';
    const button = document.createElement('button');
    button.id = 'immersiveBtn';
    button.type = 'button';
    button.textContent = 'FULLSCREEN';
    button.setAttribute('aria-label', 'Toggle immersive fullscreen');
    wrap.appendChild(button);
    rail.appendChild(wrap);

    const sync = () => {
      const active = Boolean(document.fullscreenElement) || document.documentElement.dataset.sylPseudoFullscreen === 'true';
      button.textContent = active ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
      document.body.dataset.sylImmersive = active ? 'true' : 'false';
    };
    button.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        else document.documentElement.dataset.sylPseudoFullscreen = document.documentElement.dataset.sylPseudoFullscreen === 'true' ? 'false' : 'true';
      } catch {
        document.documentElement.dataset.sylPseudoFullscreen = document.documentElement.dataset.sylPseudoFullscreen === 'true' ? 'false' : 'true';
      }
      sync();
    });
    document.addEventListener('fullscreenchange', sync);
    sync();
  }

  const originalSnapshot = playtest.snapshot.bind(playtest);
  playtest.version = '0.7.0';
  playtest.snapshot = () => ({ ...originalSnapshot(), visual: systemSnapshot() });

  function systemSnapshot() {
    return {
      version: '0.7.0',
      theme: theme.id,
      themeLabel: theme.label,
      quality: budget.snapshot(),
      backdropCanvas: true,
      overlayCanvas: true,
      playfieldAspectSafe: true,
      immersiveControl: Boolean(document.getElementById('immersiveBtn')),
      backgroundParticles: ambient.length,
      playfieldScale,
      reactionCount: reactions.length,
      sceneCollection: sceneModel?.atlas?.collection || null,
      sceneAtmosphere: sceneModel?.atmosphere || null,
    };
  }

  let frameHandle = 0;
  let lastOverlayPaint = -Infinity;
  let lastBackdropPaint = -Infinity;
  let lastNow = performance.now();
  function frame(now) {
    const snapshot = originalSnapshot();
    const changed = refreshScene(snapshot);
    budget.noteFrame(now, snapshot.fps);
    detectReactions(snapshot);
    updateReactions(Math.min(.05, Math.max(0, (now - lastNow) / 1000)));
    lastNow = now;

    const overlayFps = budget.current.overlayFps;
    const backdropFps = budget.tier === 'high' ? 30 : budget.tier === 'balanced' ? 20 : 12;
    if (changed || now - lastBackdropPaint >= 1000 / backdropFps) {
      lastBackdropPaint = now;
      drawBackdrop(snapshot, now);
    }
    if (changed || now - lastOverlayPaint >= 1000 / overlayFps) {
      lastOverlayPaint = now;
      renderOverlay(snapshot, now);
    }
    frameHandle = requestAnimationFrame(frame);
  }

  gameCanvas.classList.add('syl-playfield');
  const atlasOverlay = document.getElementById('atlasOverlay');
  atlasOverlay?.classList.add('syl-playfield');
  if (atlasOverlay && playfieldScale > 1 && atlasOverlay.width === W) {
    atlasOverlay.width = Math.round(W * playfieldScale);
    atlasOverlay.height = Math.round(H * playfieldScale);
    atlasOverlay.getContext('2d')?.setTransform(playfieldScale, 0, 0, playfieldScale, 0, 0);
  }
  installFullscreenControl();
  refreshScene(originalSnapshot(), true);
  resizeBackdrop();
  frameHandle = requestAnimationFrame(frame);

  window.addEventListener('sylvaria-quality-change', () => resizeBackdrop());
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameHandle);
    window.removeEventListener('resize', resizeBackdrop);
    backdrop.remove();
    overlay.remove();
  }, { once: true });

  window.SylvariaVisualSystem = Object.freeze({
    version: '0.7.0', themes: THEMES, spridRules: SPRID_RULES, worldRules: WORLD_RULES,
    classifyTheme, snapshot: systemSnapshot,
  });
})();
