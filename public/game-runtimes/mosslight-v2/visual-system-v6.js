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
  const overlay = document.createElement('canvas');
  overlay.id = 'sylVisualOverlay';
  overlay.width = W;
  overlay.height = H;
  overlay.setAttribute('aria-hidden', 'true');
  gameCanvas.insertAdjacentElement('afterend', overlay);
  const ctx = overlay.getContext('2d');
  if (!ctx) { overlay.remove(); return; }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

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

  const THEMES = Object.freeze({
    forest: {
      id: 'forest', label: 'forest / moss',
      colors: { bg: '#06120c', mid: '#12331f', floor: '#1d4a2d', accent: '#8dffac', water: '#5fe9ff', warm: '#e8a76c', danger: '#ff8f72', ink: '#effff4' },
      motifs: ['fern', 'mushroom', 'root', 'spore'],
      cue: 'soft moss · cyan spores · warm bark',
    },
    volcanic: {
      id: 'volcanic', label: 'cave / volcanic',
      colors: { bg: '#140a08', mid: '#35150f', floor: '#52251a', accent: '#66efc7', water: '#4ce3ef', warm: '#ff9454', danger: '#ff5e50', ink: '#fff2e8' },
      motifs: ['basalt', 'ember', 'glowfungus', 'crack'],
      cue: 'ember orange · deep stone · teal glow',
    },
    reef: {
      id: 'reef', label: 'reef / wetland',
      colors: { bg: '#04131d', mid: '#07384a', floor: '#0c5260', accent: '#6fffd0', water: '#4edfff', warm: '#ff9f7c', danger: '#ff6e8a', ink: '#e9feff' },
      motifs: ['coral', 'kelp', 'bubble', 'shell'],
      cue: 'blue-green water · coral accents · soft bioluminescence',
    },
    ice: {
      id: 'ice', label: 'ice / alpine',
      colors: { bg: '#071320', mid: '#15334a', floor: '#244e66', accent: '#b9f8ff', water: '#6ec8ff', warm: '#c6a7ff', danger: '#ff8cab', ink: '#f5fdff' },
      motifs: ['crystal', 'snow', 'ridge', 'lichen'],
      cue: 'pale blue · white crystal · soft violet',
    },
    celestial: {
      id: 'celestial', label: 'celestial / anomaly',
      colors: { bg: '#08091c', mid: '#161a46', floor: '#25265d', accent: '#7fffe5', water: '#60d5ff', warm: '#df92ff', danger: '#ff77bd', ink: '#f4f1ff' },
      motifs: ['shard', 'star', 'orbit', 'voidflower'],
      cue: 'indigo · cyan · magenta particles',
    },
  });

  const SPRID_RULES = Object.freeze([
    'round moss-born silhouette readable at 24–36 px',
    'bright directional eyes remain the highest-contrast facial feature',
    'asymmetric leaf crown creates identity without widening the hitbox',
    'portal gun remains visibly separate from the body silhouette',
    'Mossglint chamber communicates charge with cyan-violet-green light',
    'run, dash, recoil, hit, and portal-ready states must alter silhouette',
  ]);
  const ENEMY_RULES = Object.freeze([
    'species family is readable before color is considered',
    'hostile creatures retain soft proportions and readable faces',
    'movement grammar is telegraphed by pose or accent marks',
    'danger color is reserved for threat information, not full-body fill',
    'bosses use larger silhouettes and unique ring language',
  ]);
  const ASSET_CHECKLIST = Object.freeze([
    'Sprid base/body/eyes/leaf-crown/portal-gun vector layers',
    'Sprid idle/run/dash/recoil/hit/portal-ready visual states',
    'five 2x biome motif kits: forest, volcanic, reef, ice, celestial',
    'cute face overlays for patrol/weave/orbit/swoop/stalk/dash/spiral encounters',
    'Mossglint pickup, portal-ready, portal-shot, and extraction glow language',
    'guardian silhouette/ring/health readability contract',
    'HUD biome badge, gate state, stability, score, timer, resonance selection',
    'auto/high/balanced/performance visual quality presets',
    'cross-browser screenshot fixtures for every biome family',
  ]);

  function classifyTheme(room) {
    const atlas = room?.atlas || {};
    const text = `${atlas.terrain || ''} ${atlas.atmosphere || ''} ${atlas.focalSubject || ''} ${room?.decor || ''}`.toLowerCase();
    if (/reef|shore|wetland|river|lake|tide|ocean|kelp|coral|marsh|water/.test(text)) return THEMES.reef;
    if (/ice|snow|mountain|alpine|glacier|frost|tundra/.test(text)) return THEMES.ice;
    if (/desert|canyon|volcanic|lava|ember|burn|basalt|cave|cavern/.test(text)) return THEMES.volcanic;
    if (/star|space|cosmic|celestial|void|nebula|aurora|moon|anomaly/.test(text)) return THEMES.celestial;
    return THEMES.forest;
  }

  const motifCache = new Map();
  function highResCanvas(size = 160) {
    const out = document.createElement('canvas');
    out.width = size * 2;
    out.height = size * 2;
    const g = out.getContext('2d');
    if (!g) return { canvas: out, g: null, size };
    g.scale(2, 2);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    return { canvas: out, g, size };
  }

  function strokeBranch(g, points, color, width) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    points.forEach(([x, y], index) => index ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
  }

  function buildForestSprite() {
    const { canvas: out, g } = highResCanvas();
    if (!g) return out;
    const glow = g.createRadialGradient(74, 105, 2, 74, 105, 54);
    glow.addColorStop(0, 'rgba(94,255,184,.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(10, 42, 140, 112);
    strokeBranch(g, [[8,155],[24,126],[43,120],[58,91],[76,82]], '#315c35', 10);
    strokeBranch(g, [[22,148],[40,131],[61,135],[82,112],[108,108]], '#5f8f49', 4);
    for (let i = 0; i < 7; i += 1) {
      const x = 35 + i * 14; const y = 124 - (i % 3) * 12;
      g.fillStyle = i % 2 ? '#77f4bc' : '#5adfff';
      g.beginPath(); g.ellipse(x, y, 6, 3, -.6 + i * .2, 0, TAU); g.fill();
    }
    for (let i = 0; i < 5; i += 1) {
      const x = 48 + i * 19; const y = 145 - (i % 2) * 7;
      g.fillStyle = '#dfffdc'; g.fillRect(x - 1, y - 8, 2, 8);
      g.fillStyle = i % 2 ? '#5bdfff' : '#ffa86d';
      g.beginPath(); g.ellipse(x, y - 9, 6, 3.5, 0, Math.PI, TAU); g.fill();
    }
    return out;
  }

  function buildVolcanicSprite() {
    const { canvas: out, g } = highResCanvas();
    if (!g) return out;
    const glow = g.createRadialGradient(80, 128, 2, 80, 128, 62);
    glow.addColorStop(0, 'rgba(255,115,64,.2)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(12, 62, 136, 96);
    g.fillStyle = '#30201c';
    for (let i = 0; i < 5; i += 1) {
      const x = 18 + i * 31; const h = 38 + (i % 3) * 20;
      g.beginPath(); g.moveTo(x,154); g.lineTo(x+8,154-h); g.lineTo(x+28,154); g.closePath(); g.fill();
      g.strokeStyle = '#ff8755'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x+10,151-h*.35); g.lineTo(x+17,145-h*.62); g.lineTo(x+13,138-h*.75); g.stroke();
    }
    for (let i = 0; i < 7; i += 1) {
      const x = 31 + i * 17; const y = 126 - (i % 3) * 14;
      g.fillStyle = i % 2 ? '#56efda' : '#ff9d55'; g.beginPath(); g.arc(x,y,2.4+(i%2),0,TAU); g.fill();
    }
    return out;
  }

  function buildReefSprite() {
    const { canvas: out, g } = highResCanvas();
    if (!g) return out;
    const glow = g.createRadialGradient(74, 118, 1, 74, 118, 58);
    glow.addColorStop(0, 'rgba(78,223,255,.15)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(8, 50, 144, 108);
    for (let i = 0; i < 5; i += 1) {
      const x = 25 + i * 26;
      strokeBranch(g, [[x,154],[x+2,128],[x-7,112],[x+5,92]], i % 2 ? '#47bda5' : '#4d93a8', 4);
      strokeBranch(g, [[x+1,130],[x+12,117]], '#ff9d83', 3);
      strokeBranch(g, [[x-2,119],[x-13,105]], '#65f1ce', 3);
    }
    g.strokeStyle = 'rgba(158,244,255,.62)'; g.lineWidth = 1.2;
    for (let i = 0; i < 8; i += 1) {
      g.beginPath(); g.arc(38 + i * 13, 110 - (i % 4) * 16, 2 + (i % 3), 0, TAU); g.stroke();
    }
    return out;
  }

  function buildIceSprite() {
    const { canvas: out, g } = highResCanvas();
    if (!g) return out;
    const gradient = g.createLinearGradient(0, 80, 0, 156);
    gradient.addColorStop(0, 'rgba(199,246,255,.62)'); gradient.addColorStop(1, 'rgba(73,137,177,.22)');
    g.fillStyle = gradient;
    for (let i = 0; i < 7; i += 1) {
      const x = 12 + i * 22; const h = 38 + (i % 4) * 15;
      g.beginPath(); g.moveTo(x,155); g.lineTo(x+9,155-h); g.lineTo(x+19,155); g.closePath(); g.fill();
      g.strokeStyle = i % 2 ? '#b9efff' : '#c7b5ff'; g.lineWidth = 1; g.stroke();
    }
    for (let i = 0; i < 8; i += 1) {
      const x = 28 + i * 15; const y = 91 - (i % 3) * 17;
      g.fillStyle = 'rgba(224,251,255,.72)'; g.beginPath(); g.arc(x,y,1.3+(i%2),0,TAU); g.fill();
    }
    return out;
  }

  function buildCelestialSprite() {
    const { canvas: out, g } = highResCanvas();
    if (!g) return out;
    const glow = g.createRadialGradient(80, 113, 0, 80, 113, 62);
    glow.addColorStop(0, 'rgba(136,105,255,.18)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(12, 48, 136, 112);
    const colors = ['#71e8ff','#87ffd9','#db8cff'];
    for (let i = 0; i < 8; i += 1) {
      const x = 22 + i * 17; const y = 133 - (i % 4) * 18;
      g.save(); g.translate(x,y); g.rotate((i*.63)%Math.PI);
      g.strokeStyle = colors[i%colors.length]; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0,-10); g.lineTo(5,0); g.lineTo(0,10); g.lineTo(-5,0); g.closePath(); g.stroke(); g.restore();
    }
    g.strokeStyle = 'rgba(123,230,255,.35)';
    g.beginPath(); g.arc(83,105,39,-.4,2.7); g.stroke();
    return out;
  }

  function motifFor(activeTheme) {
    if (motifCache.has(activeTheme.id)) return motifCache.get(activeTheme.id);
    const builders = { forest: buildForestSprite, volcanic: buildVolcanicSprite, reef: buildReefSprite, ice: buildIceSprite, celestial: buildCelestialSprite };
    const sprite = builders[activeTheme.id]();
    motifCache.set(activeTheme.id, sprite);
    return sprite;
  }

  let sceneKey = '';
  let theme = THEMES.forest;
  let motifLayout = [];
  function refreshScene(snapshot, force = false) {
    const room = content.rooms[snapshot.sectorIndex] || content.rooms[0];
    const key = `${snapshot.sectorIndex}:${snapshot.worldDepth}:${room?.atlas?.seed || room?.id || 0}`;
    if (!force && key === sceneKey) return false;
    sceneKey = key;
    theme = classifyTheme(room);
    const rng = rngFrom(hash(key));
    motifLayout = Array.from({ length: 8 }, (_, index) => {
      const left = index % 2 === 0;
      return {
        x: left ? -30 + rng() * 70 : W - 125 + rng() * 70,
        y: 105 + rng() * 420,
        scale: .56 + rng() * .5,
        flip: left ? 1 : -1,
        depth: .35 + rng() * .65,
      };
    });
    document.body.dataset.sylTheme = theme.id;
    const root = document.documentElement;
    root.style.setProperty('--biome-bg', theme.colors.bg);
    root.style.setProperty('--biome-mid', theme.colors.mid);
    root.style.setProperty('--biome-floor', theme.colors.floor);
    root.style.setProperty('--biome-accent', theme.colors.accent);
    root.style.setProperty('--biome-water', theme.colors.water);
    root.style.setProperty('--biome-warm', theme.colors.warm);
    root.style.setProperty('--biome-danger', theme.colors.danger);
    root.style.setProperty('--biome-ink', theme.colors.ink);
    const badge = document.getElementById('biomeBadge');
    if (badge) badge.textContent = `${theme.label} · ${theme.cue}`;
    return true;
  }

  function drawMotif(sprite, item, player) {
    const config = budget.current;
    const parallaxX = player ? ((player.x / W) - .5) * -10 * item.depth : 0;
    const parallaxY = player ? ((player.y / H) - .5) * -6 * item.depth : 0;
    const logicalSize = 160 * item.scale;
    const x = Math.round(item.x + parallaxX);
    const y = Math.round(item.y + parallaxY);
    ctx.save();
    ctx.globalAlpha = config.ambientAlpha * (.55 + item.depth * .38);
    if (item.flip < 0) {
      ctx.translate(x + logicalSize, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, logicalSize, logicalSize);
    } else {
      ctx.drawImage(sprite, x, y, logicalSize, logicalSize);
    }
    ctx.restore();
  }

  function drawCuteEnemyFace(enemy, now) {
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);
    const blink = Math.sin(now * .0018 + x * .03) > .985;
    const look = enemy.pattern === 'stalk' || enemy.pattern === 'dash' ? .9 : .55;
    const eyeY = y - 2;
    ctx.save();
    ctx.fillStyle = 'rgba(5,18,18,.88)';
    for (const side of [-1, 1]) {
      if (blink) ctx.fillRect(x + side * 4 - 2, eyeY, 4, 1);
      else {
        ctx.beginPath(); ctx.ellipse(x + side * 4, eyeY, 2.2, 2.8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(238,255,249,.88)'; ctx.beginPath(); ctx.arc(x + side * 4 + look, eyeY - .8, .65, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(5,18,18,.88)';
      }
    }
    ctx.strokeStyle = 'rgba(5,18,18,.72)'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (enemy.pattern === 'dash') { ctx.moveTo(x-3,y+5); ctx.lineTo(x+3,y+5); }
    else ctx.arc(x, y + 3, 3.2, .15, Math.PI - .15);
    ctx.stroke();
    if (enemy.pattern === 'dash' || enemy.pattern === 'stalk') {
      ctx.strokeStyle = theme.colors.danger; ctx.globalAlpha = .58;
      ctx.beginPath(); ctx.moveTo(x-7,y-7); ctx.lineTo(x-3,y-5); ctx.moveTo(x+7,y-7); ctx.lineTo(x+3,y-5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpridPolish(snapshot, now) {
    const p = snapshot.player;
    if (!p) return;
    const facingX = Math.cos(p.facing || 0);
    const facingY = Math.sin(p.facing || 0);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.beginPath(); ctx.arc(Math.round(p.x - 5 + facingX * 2.2), Math.round(p.y - 5 + facingY), 1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(Math.round(p.x + 5 + facingX * 2.2), Math.round(p.y - 5 + facingY), 1, 0, TAU); ctx.fill();
    if (snapshot.portalPhase === 'ready') {
      const count = budget.tier === 'performance' ? 2 : 4;
      for (let i = 0; i < count; i += 1) {
        const a = now * .0012 + i * TAU / count;
        ctx.fillStyle = i % 2 ? theme.colors.water : '#b273ff';
        ctx.beginPath(); ctx.arc(Math.round(p.x + Math.cos(a) * 21), Math.round(p.y + Math.sin(a) * 15), 1.25, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPortalPolish(snapshot, now) {
    if (!snapshot.portalOpen) return;
    const t = now * .001;
    ctx.save(); ctx.translate(894, H / 2); ctx.lineWidth = 1.2;
    const colors = ['#b46cff', theme.colors.water, theme.colors.accent];
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = colors[i]; ctx.globalAlpha = .38 + i * .1;
      ctx.setLineDash([3 + i * 2, 8 - i]); ctx.lineDashOffset = t * (i % 2 ? -16 : 13);
      ctx.beginPath(); ctx.arc(0, 0, 48 + i * 5, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();
  }

  const qualitySelect = document.getElementById('visualQuality');
  if (qualitySelect) {
    qualitySelect.value = budget.preference;
    qualitySelect.addEventListener('change', () => budget.setPreference(qualitySelect.value));
  }
  window.addEventListener('sylvaria-quality-change', (event) => {
    const badge = document.getElementById('qualityState');
    if (badge) badge.textContent = String(event.detail?.tier || budget.tier).toUpperCase();
  });

  const originalSnapshot = playtest.snapshot.bind(playtest);
  playtest.version = '0.6.0';
  playtest.snapshot = () => ({ ...originalSnapshot(), visual: systemSnapshot() });

  function systemSnapshot() {
    return {
      version: '0.6.0',
      theme: theme.id,
      themeLabel: theme.label,
      quality: budget.snapshot(),
      motifCount: Math.min(motifLayout.length, budget.current.motifCount),
      spriteScale: budget.current.spriteScale,
      overlayCanvas: true,
    };
  }

  let frameHandle = 0;
  let lastOverlayPaint = -Infinity;
  function renderOverlay(now) {
    const snapshot = originalSnapshot();
    const sceneChanged = refreshScene(snapshot);
    budget.noteFrame(now, snapshot.fps);
    const interval = 1000 / budget.current.overlayFps;
    if (sceneChanged || now - lastOverlayPaint >= interval) {
      lastOverlayPaint = now;
      ctx.clearRect(0, 0, W, H);
      if (snapshot.mode === 'playing') {
        const sprite = motifFor(theme);
        const motifCount = Math.min(motifLayout.length, budget.current.motifCount);
        for (let i = 0; i < motifCount; i += 1) drawMotif(sprite, motifLayout[i], snapshot.player);
        for (const enemy of snapshot.enemies || []) drawCuteEnemyFace(enemy, now);
        drawSpridPolish(snapshot, now);
        drawPortalPolish(snapshot, now);
      }
    }
    frameHandle = requestAnimationFrame(renderOverlay);
  }

  refreshScene(originalSnapshot(), true);
  const qualityBadge = document.getElementById('qualityState');
  if (qualityBadge) qualityBadge.textContent = budget.tier.toUpperCase();
  frameHandle = requestAnimationFrame(renderOverlay);

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameHandle);
    overlay.remove();
  }, { once: true });

  window.SylvariaVisualSystem = Object.freeze({
    version: '0.6.0',
    themes: THEMES,
    spridRules: SPRID_RULES,
    enemyRules: ENEMY_RULES,
    assetChecklist: ASSET_CHECKLIST,
    classifyTheme,
    snapshot: systemSnapshot,
  });
})();
