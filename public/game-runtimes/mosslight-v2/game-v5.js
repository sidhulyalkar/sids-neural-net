(() => {
  'use strict';

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const ATLAS_LENGTH = 1000;
  const SETTINGS_KEY = 'sid.sylvaria.settings.v5';
  const LEGACY_SETTINGS_KEY = 'sid.mosslight.settings.v4';
  const BEST_KEY = 'sid.sylvaria.best.v5';
  const LEGACY_BEST_KEY = 'sid.mosslight.best.v4';
  const canvas = document.getElementById('c');
  const ctx = canvas?.getContext('2d');
  const content = window.MosslightContent;
  if (!canvas || !ctx || !content?.rooms?.length) return;

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const normKey = (key) => String(key || '').toLowerCase();
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
  const hexAlpha = (hex, alpha) => {
    if (!hex?.startsWith('#')) return `rgba(255,255,255,${alpha})`;
    let raw = hex.slice(1);
    if (raw.length === 3) raw = raw.split('').map((x) => x + x).join('');
    const n = Number.parseInt(raw, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  };

  const ABILITIES = {
    rain:   { name: 'Rain',   icon: '◌', color: '#64d9ff', speed: 660, radius: 7, cooldown: .155, damage: 1.0 },
    sun:    { name: 'Sun',    icon: '✦', color: '#ffdb6e', speed: 760, radius: 7, cooldown: .145, damage: 1.15 },
    seed:   { name: 'Seed',   icon: '⌁', color: '#76f59c', speed: 590, radius: 8, cooldown: .165, damage: 1.0 },
    wind:   { name: 'Wind',   icon: '≈', color: '#c9fff4', speed: 635, radius: 10, cooldown: .13, damage: .85 },
    mend:   { name: 'Mend',   icon: '◇', color: '#ff92c6', speed: 570, radius: 8, cooldown: .17, damage: .9 },
    gather: { name: 'Gather', icon: '●', color: '#ffb66e', speed: 680, radius: 7, cooldown: .15, damage: 1.05 },
  };
  const ABILITY_IDS = Object.keys(ABILITIES);

  const DEFAULT_BINDINGS = {
    moveUp: 'w', moveDown: 's', moveLeft: 'a', moveRight: 'd',
    aimUp: 'arrowup', aimDown: 'arrowdown', aimLeft: 'arrowleft', aimRight: 'arrowright',
    cast: ' ', dash: 'shift', portalFire: 'f', portalEnter: 'enter',
    cyclePrev: 'q', cycleNext: 'e', pause: 'p',
  };
  const BIND_LABELS = {
    moveUp: 'move up', moveDown: 'move down', moveLeft: 'move left', moveRight: 'move right',
    aimUp: 'aim up', aimDown: 'aim down', aimLeft: 'aim left', aimRight: 'aim right',
    cast: 'cast / fire', dash: 'dash', portalFire: 'fire gate', portalEnter: 'enter gate',
    cyclePrev: 'previous resonance', cycleNext: 'next resonance', pause: 'pause',
  };
  const DEFAULT_SETTINGS = {
    music: true,
    sfx: true,
    volume: .68,
    reducedMotion: false,
    aimAssist: true,
    bindings: { ...DEFAULT_BINDINGS },
  };

  function readStored(primary, legacy) {
    try {
      return JSON.parse(localStorage.getItem(primary) || localStorage.getItem(legacy) || 'null');
    } catch {
      return null;
    }
  }

  function loadSettings() {
    const parsed = readStored(SETTINGS_KEY, LEGACY_SETTINGS_KEY);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
    const legacyBindings = parsed.bindings || {};
    if (legacyBindings.portal && !legacyBindings.portalEnter) legacyBindings.portalEnter = legacyBindings.portal;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      bindings: { ...DEFAULT_BINDINGS, ...legacyBindings, portalFire: legacyBindings.portalFire || 'f' },
    };
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function loadBest() {
    const parsed = readStored(BEST_KEY, LEGACY_BEST_KEY);
    return parsed && typeof parsed === 'object' ? parsed : { world: 0, score: 0, time: 0, atlasClears: 0 };
  }

  const settings = loadSettings();
  const keys = new Set();
  const pointer = { x: W * .5, y: H * .5, down: false, seen: false };
  let aimSource = 'keyboard';
  let captureAction = null;
  let last = performance.now();
  let fps = 60;
  let fpsFrames = 0;
  let fpsWindow = performance.now();
  let toastTimer = 0;
  let introTimer = 0;
  let sceneDecor = [];

  const freshRelics = () => ({
    fireRate: 1, projectileScale: 1, spread: 1, pierce: 0,
    moveSpeed: 1, dashRecharge: 1, shield: 0, shieldCharges: 0, collected: [],
  });

  const state = {
    mode: 'menu',
    runMode: 'run',
    sectorIndex: 0,
    worldDepth: 1,
    worldsCleared: 0,
    atlasClears: 0,
    room: null,
    player: null,
    selected: 'rain',
    lastAim: { x: 1, y: 0 },
    projectiles: [], hostileShots: [], particles: [], sweeps: [],
    enemies: [], boss: null,
    totalTime: 0, roomTime: 0,
    shootCd: 0, dashCd: 0, dashTime: 0, hitCd: 0, recoil: 0,
    integrity: 3, maxIntegrity: 3,
    chain: 0, bestChain: 0, chainTimer: 0,
    score: 0,
    stones: 0, lifetimeStones: 0, stoneQuota: 0,
    portal: {
      x: 894, y: H / 2, r: 39,
      phase: 'sealed', ready: false, open: false,
      charge: 0, age: 0, extractionAge: 0, bolt: null,
    },
    situationClock: 4,
    roomStats: [],
    stats: { casts: 0, correct: 0, wasted: 0, hits: 0, dashes: 0, kills: 0, bosses: 0, stones: 0, portals: 0 },
    relics: freshRelics(),
  };

  function deepCloneRoom(source) {
    return {
      ...source,
      palette: { ...source.palette },
      atlas: source.atlas ? JSON.parse(JSON.stringify(source.atlas)) : null,
      challenge: source.challenge ? JSON.parse(JSON.stringify(source.challenge)) : {},
      targets: (source.targets || []).map((target) => ({
        ...target,
        zone: target.zone ? { ...target.zone } : null,
        sequence: [...(target.sequence || [])],
        step: 0, done: false, stoneAwarded: false,
        vx: target.vx || 0, vy: target.vy || 0,
        baseX: target.baseX ?? target.x, baseY: target.baseY ?? target.y,
      })),
      obstacles: (source.obstacles || []).map((obstacle) => ({
        ...obstacle,
        motion: obstacle.motion ? { ...obstacle.motion } : null,
        baseX: obstacle.baseX ?? obstacle.x, baseY: obstacle.baseY ?? obstacle.y,
      })),
      hazards: (source.hazards || []).map((hazard) => ({
        ...hazard,
        baseX: hazard.baseX ?? hazard.x, baseY: hazard.baseY ?? hazard.y,
        phase: hazard.phase || 0,
      })),
      encounters: (source.encounters || []).map((encounter) => ({ ...encounter })),
      powerup: source.powerup ? { ...source.powerup, apply: { ...(source.powerup.apply || {}) }, collected: false } : null,
    };
  }

  function globalPressure() {
    const d = Math.max(1, state.worldDepth);
    return clamp(.9 + Math.log2(d + 1) * .085 + Math.min(.45, d / 2200), .9, 2.18);
  }

  function enemyBudget() {
    const base = state.room?.encounters?.length || 0;
    return clamp(base + Math.floor((state.worldDepth - 1) / 35), state.worldDepth < 3 ? 0 : 1, 8);
  }

  function isBossWorld() { return state.worldDepth % 10 === 0; }
  function roomSolved() { return Boolean(state.room?.targets?.length) && state.room.targets.every((target) => target.done); }
  function bossDefeated() { return !state.boss || state.boss.dead; }
  function canChargePortal() { return roomSolved() && bossDefeated() && state.stones >= state.stoneQuota; }
  function deriveStoneQuota(room) { return Math.max(1, room.targets.length + (isBossWorld() ? 2 : 0)); }
  function targetExpected(target) {
    if (!target || target.done) return null;
    if (target.kind === 'cloud' && target.step === 0) return 'wind';
    if (target.kind === 'sluice') return 'rain';
    return target.sequence[target.step] || null;
  }
  function currentAtlasIndex() { return state.room?.atlas?.index || (((state.worldDepth - 1) % ATLAS_LENGTH) + 1); }
  function roomLabel() {
    const cycle = Math.floor((state.worldDepth - 1) / ATLAS_LENGTH);
    return cycle === 0
      ? `world ${String(currentAtlasIndex()).padStart(3, '0')} / 1000`
      : `deep loop ${cycle} · world ${String(currentAtlasIndex()).padStart(3, '0')}`;
  }

  function resetPlayer() {
    state.player = { x: 86, y: H / 2, vx: 0, vy: 0, r: 14, facing: 0, walk: 0 };
  }

  function generateDecor() {
    const room = state.room;
    const seed = room?.atlas?.seed ?? hash(room?.id || 'sylvaria');
    const rng = rngFrom(seed);
    sceneDecor = Array.from({ length: 42 }, (_, index) => ({
      x: 28 + rng() * (W - 56),
      y: 72 + rng() * (H - 112),
      r: 1.5 + rng() * 7,
      phase: rng() * TAU,
      type: index % 7,
      depth: rng(),
    }));
  }

  function setupRoom(index) {
    state.sectorIndex = index;
    state.room = deepCloneRoom(content.rooms[index]);
    state.roomTime = 0;
    state.projectiles.length = 0;
    state.hostileShots.length = 0;
    state.particles.length = 0;
    state.sweeps.length = 0;
    state.chain = 0;
    state.chainTimer = 0;
    state.shootCd = 0;
    state.dashCd = 0;
    state.dashTime = 0;
    state.hitCd = 0;
    state.recoil = 0;
    state.stones = 0;
    state.portal.phase = 'sealed';
    state.portal.ready = false;
    state.portal.open = false;
    state.portal.charge = 0;
    state.portal.age = 0;
    state.portal.extractionAge = 0;
    state.portal.bolt = null;
    state.situationClock = clamp(5.2 - Math.log2(state.worldDepth + 1) * .25, 2.25, 5.2);
    resetPlayer();
    spawnEnemies();
    spawnBoss();
    state.stoneQuota = deriveStoneQuota(state.room);
    const first = nextUsefulAbility();
    if (first) state.selected = first;
    generateDecor();
    introTimer = 2.1;
    syncHud(true);
    music.setWorld(state.room, state.worldDepth, Boolean(state.boss));
  }

  function spawnEnemies() {
    state.enemies = [];
    const rng = rngFrom(hash(`${state.room.id}:${state.worldDepth}:encounters`));
    const patterns = ['patrol', 'weave', 'orbit', 'swoop', 'stalk', 'dash', 'spiral'];
    const wildlife = state.room.atlas?.wildlife?.length ? state.room.atlas.wildlife : ['moth', 'fox', 'wisp'];
    const source = state.room.encounters || [];
    for (let i = 0; i < enemyBudget(); i += 1) {
      const seeded = source[i % Math.max(1, source.length)] || {};
      const x = seeded.x ?? (190 + rng() * 590);
      const y = seeded.y ?? (135 + rng() * 355);
      const hp = clamp(2 + Math.floor(Math.log2(state.worldDepth + 1) / 2), 2, 7);
      state.enemies.push({
        id: `${state.room.id}-hostile-${i}`,
        species: seeded.species || wildlife[i % wildlife.length],
        pattern: seeded.pattern || patterns[(hash(state.room.id) + i * 5 + state.worldDepth) % patterns.length],
        x, y, baseX: x, baseY: y,
        vx: 0, vy: 0, r: 13 + Math.min(4, hp * .5), hp, maxHp: hp,
        phase: seeded.phase ?? rng() * TAU,
        heading: seeded.heading ?? rng() * TAU,
        speed: (52 + rng() * 22) * globalPressure(),
        range: 66 + rng() * 100,
        dashClock: .9 + rng() * 2.4,
        telegraph: 0, dead: false,
      });
    }
  }

  function bossName() {
    const situation = state.room.challenge?.situation?.id || 'migration-path';
    const names = {
      'living-corridor': 'Rootwarden', 'tidal-lanes': 'Tideglass Ray',
      'heat-crossing': 'Cinder Hart', 'alpine-switchback': 'Frosthorn',
      'orbital-dance': 'Astral Moth', 'weather-window': 'Storm Heron',
      'migration-path': 'Wayfinder Stag', 'earthheart-convergence': 'Atlas Warden',
    };
    return names[situation] || 'Atlas Warden';
  }

  function spawnBoss() {
    state.boss = null;
    if (!isBossWorld()) return;
    const hp = clamp(16 + Math.floor(state.worldDepth / 30) * 2, 16, 52);
    state.boss = {
      name: bossName(), x: 735, y: 315, baseX: 735, baseY: 315,
      r: 38, hp, maxHp: hp, phase: 0, attackClock: 1.15,
      pattern: state.room.challenge?.situation?.id || 'orbital-dance', dead: false,
    };
  }

  function awardStone(x, y, count = 1, label = 'Mossglint') {
    for (let i = 0; i < count; i += 1) {
      state.stones += 1;
      state.lifetimeStones += 1;
      state.stats.stones += 1;
      state.score += 180 + state.chain * 18;
      burst(x + (i - (count - 1) / 2) * 13, y, '#8dffb4', 16, 145);
    }
    toast(`${label} · ${state.stones}/${state.stoneQuota}`, 800);
    music.chime('stone');
    checkPortalReady();
  }

  function awardBossStones() {
    awardStone(state.boss?.x || 730, state.boss?.y || 300, 2, 'guardian Mossglint');
  }

  function checkPortalReady() {
    if (state.portal.phase !== 'sealed' || !canChargePortal()) return;
    state.portal.phase = 'ready';
    state.portal.ready = true;
    state.portal.charge = 1;
    state.score += Math.max(250, 900 - state.roomTime * 4);
    toast('Mossglint aligned · F to fire the gate', 1600);
    burst(state.player.x, state.player.y, '#a685ff', 26, 130);
    music.chime('ready');
    syncHud();
  }

  function firePortalCharge() {
    if (state.mode !== 'playing') return false;
    if (state.portal.phase !== 'ready') {
      if (!canChargePortal()) toast('the gate needs more Mossglint', 900);
      return false;
    }
    state.portal.phase = 'charging';
    state.portal.ready = false;
    state.portal.charge = 0;
    state.portal.age = 0;
    state.recoil = .24;
    state.stats.portals += 1;
    music.chime('charge');
    toast('gate charge released', 760);
    return true;
  }

  function openExtractionPortal() {
    state.portal.phase = 'open';
    state.portal.open = true;
    state.portal.age = 0;
    state.portal.extractionAge = 0;
    state.score += 650;
    burst(state.portal.x, state.portal.y, '#6ee7ff', 42, 230);
    burst(state.portal.x, state.portal.y, '#b368ff', 32, 180);
    burst(state.portal.x, state.portal.y, '#8fff9d', 24, 155);
    state.situationClock = .85;
    toast('GATE OPEN · reach the rift', 1450);
    music.chime('portal');
    syncHud();
  }

  function updatePortal(dt) {
    const portal = state.portal;
    portal.age += dt;
    if (portal.phase === 'charging') {
      portal.charge = clamp(portal.charge + dt / .58, 0, 1);
      if (portal.charge >= 1) {
        portal.phase = 'firing';
        portal.bolt = { x: state.player.x, y: state.player.y, vx: 0, vy: 0, trail: [] };
        music.chime('firegate');
      }
    } else if (portal.phase === 'firing' && portal.bolt) {
      const bolt = portal.bolt;
      const dx = portal.x - bolt.x;
      const dy = portal.y - bolt.y;
      const d = Math.max(.001, Math.hypot(dx, dy));
      const speed = 860;
      bolt.vx = dx / d * speed;
      bolt.vy = dy / d * speed;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.trail.push({ x: bolt.x, y: bolt.y, life: .42 });
      if (bolt.trail.length > 18) bolt.trail.shift();
      if (d < 24) {
        portal.bolt = null;
        openExtractionPortal();
      }
    } else if (portal.phase === 'open') {
      portal.extractionAge += dt;
      if (portal.extractionAge > .55 && dist(state.player.x, state.player.y, portal.x, portal.y) < portal.r + state.player.r + 7) {
        advanceWorld();
      }
    }
  }

  function attemptPortalEnter() {
    if (!state.portal.open) {
      if (state.portal.phase === 'ready') toast('fire the gate first · F', 850);
      else toast('the gate is still sealed', 700);
      return false;
    }
    if (dist(state.player.x, state.player.y, state.portal.x, state.portal.y) > state.portal.r + state.player.r + 20) {
      toast('reach the portal to commit', 780);
      return false;
    }
    advanceWorld();
    return true;
  }

  function atlasMilestone() {
    state.atlasClears += 1;
    state.score += 100000;
    const copy = $('atlasMilestoneCopy');
    if (copy) copy.textContent = `Sprid crossed all 1,000 Atlas worlds · clear ${state.atlasClears}. The deep loop remains open.`;
    $('atlasMilestone')?.classList.remove('hidden');
    setTimeout(() => $('atlasMilestone')?.classList.add('hidden'), 4200);
    music.chime('atlas');
  }

  function advanceWorld() {
    if (!state.portal.open) return;
    const speedBonus = Math.max(0, 2500 - state.roomTime * 26);
    state.score += speedBonus;
    state.roomStats.push({ world: state.worldDepth, atlas: currentAtlasIndex(), time: state.roomTime, score: state.score, hits: state.stats.hits });
    state.worldsCleared += 1;
    if (state.worldsCleared > 0 && state.worldsCleared % ATLAS_LENGTH === 0) atlasMilestone();
    state.worldDepth += 1;
    state.sectorIndex += 1;
    if (state.sectorIndex >= content.rooms.length) {
      window.MosslightExpedition?.newRun?.();
      state.sectorIndex = 0;
    }
    setupRoom(state.sectorIndex);
  }

  function nearestTarget() {
    if (!state.room?.targets?.length || !state.player) return null;
    let best = null;
    let bestD = Infinity;
    for (const target of state.room.targets) {
      if (target.done) continue;
      const d = dist(state.player.x, state.player.y, target.x, target.y);
      if (d < bestD) { best = target; bestD = d; }
    }
    return best;
  }

  function nextUsefulAbility() {
    const target = nearestTarget();
    const expected = targetExpected(target);
    if (expected && (state.room?.unlock || []).includes(expected)) return expected;
    return (state.room?.unlock || [])[0] || 'rain';
  }

  function isAction(action, key) { return normKey(settings.bindings[action]) === key; }

  function keyboardAimVector() {
    let x = 0;
    let y = 0;
    if (keys.has(normKey(settings.bindings.aimLeft))) x -= 1;
    if (keys.has(normKey(settings.bindings.aimRight))) x += 1;
    if (keys.has(normKey(settings.bindings.aimUp))) y -= 1;
    if (keys.has(normKey(settings.bindings.aimDown))) y += 1;
    if (!x && !y) return null;
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  }

  function aimVector() {
    const keyboard = keyboardAimVector();
    if (keyboard) {
      aimSource = 'keyboard';
      state.lastAim = keyboard;
      return keyboard;
    }
    if (aimSource === 'mouse' && pointer.seen) {
      const dx = pointer.x - state.player.x;
      const dy = pointer.y - state.player.y;
      const d = Math.hypot(dx, dy) || 1;
      state.lastAim = { x: dx / d, y: dy / d };
      return state.lastAim;
    }
    return state.lastAim;
  }

  function assistedAim(base) {
    if (!settings.aimAssist || !state.room) return base;
    const target = nearestTarget();
    if (!target) return base;
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const d = Math.hypot(dx, dy) || 1;
    const desired = { x: dx / d, y: dy / d };
    const dot = base.x * desired.x + base.y * desired.y;
    const compatible = targetExpected(target) === state.selected;
    if (!compatible || dot < .72) return base;
    const strength = aimSource === 'keyboard' ? .82 : .62;
    const x = lerp(base.x, desired.x, strength);
    const y = lerp(base.y, desired.y, strength);
    const n = Math.hypot(x, y) || 1;
    return { x: x / n, y: y / n };
  }

  function fire() {
    if (state.mode !== 'playing' || state.shootCd > 0 || !state.player) return;
    const spec = ABILITIES[state.selected];
    if (!spec || !(state.room.unlock || []).includes(state.selected)) return;
    const base = assistedAim(aimVector());
    const spread = state.relics.spread >= 3 ? [-.13, 0, .13] : [0];
    for (const angle of spread) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const dx = base.x * c - base.y * s;
      const dy = base.x * s + base.y * c;
      state.projectiles.push({
        x: state.player.x + dx * 22, y: state.player.y + dy * 22,
        vx: dx * spec.speed, vy: dy * spec.speed,
        r: spec.radius * state.relics.projectileScale,
        ability: state.selected, damage: spec.damage,
        life: 1.35, pierce: state.relics.pierce,
      });
    }
    state.shootCd = spec.cooldown / state.relics.fireRate;
    state.recoil = .13;
    state.stats.casts += 1;
    music.chime('cast');
  }

  function selectAbility(id) {
    if (!ABILITIES[id] || !(state.room?.unlock || []).includes(id)) return;
    state.selected = id;
    syncAbilityButtons();
  }

  function cycleAbility(direction) {
    const unlocked = ABILITY_IDS.filter((id) => (state.room?.unlock || []).includes(id));
    if (!unlocked.length) return;
    const i = Math.max(0, unlocked.indexOf(state.selected));
    selectAbility(unlocked[(i + direction + unlocked.length) % unlocked.length]);
  }

  function applyTargetHit(target, shot) {
    if (target.done) return false;
    const expected = targetExpected(target);
    if (shot.ability !== expected) {
      state.stats.wasted += 1;
      state.chain = Math.max(0, state.chain - 1);
      burst(target.x, target.y, '#ff856e', 5, 72);
      return false;
    }

    if (target.kind === 'cloud' && target.step === 0 && target.zone) {
      const d = Math.hypot(shot.vx, shot.vy) || 1;
      target.x = clamp(target.x + shot.vx / d * 44, 100, W - 100);
      target.y = clamp(target.y + shot.vy / d * 44, 110, H - 95);
      if (dist(target.x, target.y, target.zone.x, target.zone.y) <= target.zone.r) target.step += 1;
    } else if (target.kind === 'sluice') {
      target.orientation = ((target.orientation || 0) + 1) % 4;
      if (target.orientation === target.goal) target.step = target.sequence.length;
    } else {
      target.step += 1;
    }

    state.stats.correct += 1;
    state.chain += 1;
    state.bestChain = Math.max(state.bestChain, state.chain);
    state.chainTimer = 2.4;
    state.score += 75 + state.chain * 14;
    burst(target.x, target.y, ABILITIES[shot.ability].color, 9, 95);

    if (target.step >= target.sequence.length) {
      target.done = true;
      if (!target.stoneAwarded) {
        target.stoneAwarded = true;
        awardStone(target.x, target.y, 1);
      }
      const next = nextUsefulAbility();
      if (next) selectAbility(next);
    }
    return true;
  }

  function damageEnemy(enemy, shot) {
    if (enemy.dead) return false;
    enemy.hp -= shot.damage;
    burst(enemy.x, enemy.y, '#7ee7ff', 7, 88);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      state.stats.kills += 1;
      state.score += 190 + Math.round(globalPressure() * 55);
      burst(enemy.x, enemy.y, state.room.palette.warm || '#ffba72', 18, 155);
    }
    return true;
  }

  function damageBoss(shot) {
    if (!state.boss || state.boss.dead) return false;
    state.boss.hp -= shot.damage;
    burst(state.boss.x, state.boss.y, '#9fffea', 6, 82);
    if (state.boss.hp <= 0) defeatBoss();
    return true;
  }

  function defeatBoss() {
    if (!state.boss || state.boss.dead) return;
    state.boss.dead = true;
    state.stats.bosses += 1;
    state.score += 3200 + state.worldDepth * 12;
    burst(state.boss.x, state.boss.y, '#c18cff', 54, 260);
    awardBossStones();
    if (state.room.powerup && !state.room.powerup.collected) applyRelic(state.room.powerup, true);
    toast(`${state.boss.name} released the gate`, 1450);
    music.chime('boss');
    checkPortalReady();
  }

  function applyRelic(powerup, bossReward = false) {
    if (!powerup || powerup.collected) return;
    powerup.collected = true;
    for (const [key, value] of Object.entries(powerup.apply || {})) {
      if (key === 'shield') {
        state.relics.shield = Math.max(state.relics.shield, Number(value) || 1);
        state.relics.shieldCharges = Math.max(state.relics.shieldCharges, 1);
      } else if (key === 'spread' || key === 'pierce') {
        state.relics[key] = Math.max(state.relics[key], Number(value) || 0);
      } else if (key in state.relics) {
        state.relics[key] *= Number(value) || 1;
      }
    }
    if (!state.relics.collected.includes(powerup.id)) state.relics.collected.push(powerup.id);
    state.score += bossReward ? 900 : 420;
    burst(powerup.x || state.player.x, powerup.y || state.player.y, powerup.color || '#8fffc4', 28, 170);
    toast(`${powerup.name} · ${powerup.description}`, 1450);
    music.chime('gift');
  }

  function playerHit(sourceX, sourceY) {
    if (state.hitCd > 0 || state.mode !== 'playing') return;
    if (state.relics.shieldCharges > 0) {
      state.relics.shieldCharges -= 1;
      state.hitCd = .75;
      burst(state.player.x, state.player.y, '#c9fff4', 24, 160);
      toast('Moss Ward absorbed the impact', 800);
      return;
    }
    state.integrity -= 1;
    state.stats.hits += 1;
    state.chain = 0;
    state.hitCd = 1.0;
    const dx = state.player.x - sourceX;
    const dy = state.player.y - sourceY;
    const d = Math.hypot(dx, dy) || 1;
    state.player.vx += dx / d * 255;
    state.player.vy += dy / d * 255;
    burst(state.player.x, state.player.y, '#ff7b83', 26, 190);
    music.chime('hit');
    if (state.runMode === 'run' && state.integrity <= 0) gameOver();
    else if (state.runMode === 'explore' && state.integrity <= 0) state.integrity = state.maxIntegrity;
  }

  function updatePlayer(dt) {
    let mx = 0;
    let my = 0;
    if (keys.has(normKey(settings.bindings.moveLeft))) mx -= 1;
    if (keys.has(normKey(settings.bindings.moveRight))) mx += 1;
    if (keys.has(normKey(settings.bindings.moveUp))) my -= 1;
    if (keys.has(normKey(settings.bindings.moveDown))) my += 1;
    const m = Math.hypot(mx, my) || 1;
    const speed = 228 * state.relics.moveSpeed * (state.dashTime > 0 ? 2.2 : 1);
    const targetVx = mx / m * speed;
    const targetVy = my / m * speed;
    state.player.vx = lerp(state.player.vx, targetVx, clamp(dt * 13, 0, 1));
    state.player.vy = lerp(state.player.vy, targetVy, clamp(dt * 13, 0, 1));
    const oldX = state.player.x;
    const oldY = state.player.y;
    state.player.x += state.player.vx * dt;
    if (hitsObstacle(state.player.x, state.player.y, state.player.r)) state.player.x = oldX;
    state.player.y += state.player.vy * dt;
    if (hitsObstacle(state.player.x, state.player.y, state.player.r)) state.player.y = oldY;
    state.player.x = clamp(state.player.x, 30, W - 30);
    state.player.y = clamp(state.player.y, 78, H - 60);
    state.player.walk += Math.hypot(state.player.vx, state.player.vy) * dt * .03;
    const aim = aimVector();
    state.player.facing = Math.atan2(aim.y, aim.x);
  }

  function tryDash() {
    if (state.dashCd > 0 || state.mode !== 'playing') return;
    state.dashTime = .18;
    state.dashCd = 1.55 / state.relics.dashRecharge;
    state.stats.dashes += 1;
    burst(state.player.x, state.player.y, '#78f2c1', 13, 125);
    music.chime('dash');
  }

  function hitsObstacle(x, y, r) {
    return (state.room?.obstacles || []).some((o) => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
  }

  function updateObstacles() {
    const t = state.roomTime;
    for (const obstacle of state.room.obstacles) {
      const motion = obstacle.motion;
      if (!motion) continue;
      if (motion.type === 'slide-x') obstacle.x = obstacle.baseX + Math.sin(t * motion.speed + motion.phase) * motion.range;
      else if (motion.type === 'slide-y') obstacle.y = obstacle.baseY + Math.sin(t * motion.speed + motion.phase) * motion.range;
      else if (motion.type === 'orbit') {
        obstacle.x = obstacle.baseX + Math.cos(t * motion.speed + motion.phase) * motion.radius;
        obstacle.y = obstacle.baseY + Math.sin(t * motion.speed + motion.phase) * motion.radius;
      }
    }
  }

  function updateTargets(dt) {
    const t = state.roomTime;
    for (const target of state.room.targets) {
      if (target.done) continue;
      if (target.kind === 'cloud') {
        target.x = clamp(target.x + target.vx * dt, 100, W - 100);
        target.y = clamp(target.y + target.vy * dt, 110, H - 90);
        target.vx *= Math.pow(.25, dt);
        target.vy *= Math.pow(.25, dt);
      }
      if (target.kind !== 'animal') continue;
      const range = target.moveRange || target.wander || 22;
      const speed = target.moveSpeed || .8;
      const p = target.movePhase || 0;
      const pattern = target.movementPattern || 'prowl';
      if (pattern === 'swoop') {
        target.x = target.baseX + Math.sin(t * speed + p) * range;
        target.y = target.baseY + Math.sin(t * speed * 2 + p) * range * .38;
      } else if (pattern === 'flee') {
        const d = dist(state.player.x, state.player.y, target.x, target.y);
        const flee = clamp((155 - d) / 155, 0, 1);
        target.x = target.baseX + Math.sin(t * speed + p) * range + (target.x - state.player.x) * flee * dt * 1.6;
        target.y = target.baseY + Math.cos(t * speed * .7 + p) * range * .55 + (target.y - state.player.y) * flee * dt * 1.6;
      } else if (pattern === 'hop') {
        target.x = target.baseX + Math.sin(t * speed + p) * range;
        target.y = target.baseY - Math.abs(Math.sin(t * speed * 2.4 + p)) * range * .45;
      } else if (pattern === 'orbit') {
        target.x = target.baseX + Math.cos(t * speed + p) * range;
        target.y = target.baseY + Math.sin(t * speed + p) * range * .7;
      } else {
        target.x = target.baseX + Math.sin(t * speed + p) * range;
        target.y = target.baseY + Math.cos(t * speed * .8 + p) * range * .42;
      }
    }
  }

  function updateHazards(dt) {
    const t = state.roomTime;
    for (const hazard of state.room.hazards) {
      const scale = globalPressure() * (state.portal.open ? 1.12 : 1);
      if (hazard.pattern === 'orbit') {
        const range = hazard.range || 70;
        hazard.x = hazard.baseX + Math.cos(t * .72 + hazard.phase) * range;
        hazard.y = hazard.baseY + Math.sin(t * .72 + hazard.phase) * range;
      } else if (hazard.pattern === 'weave') {
        hazard.x += hazard.vx * dt * scale;
        hazard.y = hazard.baseY + Math.sin(t * 1.6 + hazard.phase) * (hazard.range || 75);
      } else {
        hazard.x += hazard.vx * dt * scale;
        hazard.y += hazard.vy * dt * scale;
      }
      if (hazard.x < 70 || hazard.x > W - 70) hazard.vx *= -1;
      if (hazard.y < 95 || hazard.y > H - 75) hazard.vy *= -1;
      if (dist(state.player.x, state.player.y, hazard.x, hazard.y) < state.player.r + hazard.r) playerHit(hazard.x, hazard.y);
    }
  }

  function updateEnemies(dt) {
    const t = state.roomTime;
    const extractionBoost = state.portal.open ? 1.13 : 1;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const speed = enemy.speed * extractionBoost;
      enemy.phase += dt;
      if (enemy.pattern === 'orbit') {
        enemy.x = enemy.baseX + Math.cos(t * .72 + enemy.heading) * enemy.range;
        enemy.y = enemy.baseY + Math.sin(t * .72 + enemy.heading) * enemy.range * .72;
      } else if (enemy.pattern === 'weave' || enemy.pattern === 'swoop') {
        enemy.x = enemy.baseX + Math.sin(t * .8 + enemy.heading) * enemy.range;
        enemy.y = enemy.baseY + Math.sin(t * (enemy.pattern === 'swoop' ? 1.9 : 1.25) + enemy.heading) * enemy.range * .5;
      } else if (enemy.pattern === 'stalk') {
        const dx = state.player.x - enemy.x;
        const dy = state.player.y - enemy.y;
        const d = Math.hypot(dx, dy) || 1;
        enemy.x += dx / d * speed * .58 * dt;
        enemy.y += dy / d * speed * .58 * dt;
      } else if (enemy.pattern === 'dash') {
        enemy.dashClock -= dt;
        if (enemy.dashClock <= 0) {
          if (enemy.telegraph <= 0) enemy.telegraph = .55;
          enemy.telegraph -= dt;
          if (enemy.telegraph <= 0) {
            const dx = state.player.x - enemy.x;
            const dy = state.player.y - enemy.y;
            const d = Math.hypot(dx, dy) || 1;
            enemy.vx = dx / d * speed * 4;
            enemy.vy = dy / d * speed * 4;
            enemy.dashClock = 2.6;
          }
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.vx *= Math.pow(.06, dt);
        enemy.vy *= Math.pow(.06, dt);
      } else if (enemy.pattern === 'spiral') {
        const radius = 30 + ((t * speed * .18) % enemy.range);
        enemy.x = enemy.baseX + Math.cos(t * 1.25 + enemy.heading) * radius;
        enemy.y = enemy.baseY + Math.sin(t * 1.25 + enemy.heading) * radius;
      } else {
        enemy.x = enemy.baseX + Math.sin(t * .65 + enemy.heading) * enemy.range;
      }
      enemy.x = clamp(enemy.x, 55, W - 55);
      enemy.y = clamp(enemy.y, 90, H - 70);
      if (dist(state.player.x, state.player.y, enemy.x, enemy.y) < state.player.r + enemy.r) playerHit(enemy.x, enemy.y);
    }
  }

  function spawnBossVolley() {
    if (!state.boss || state.boss.dead) return;
    const count = state.worldDepth >= 100 ? 10 : 8;
    const base = Math.atan2(state.player.y - state.boss.y, state.player.x - state.boss.x);
    for (let i = 0; i < count; i += 1) {
      const angle = base + (i - (count - 1) / 2) * .18;
      const speed = 155 + globalPressure() * 32;
      state.hostileShots.push({ x: state.boss.x, y: state.boss.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 6, life: 4 });
    }
    music.chime('bossPulse');
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss || boss.dead) return;
    boss.phase += dt;
    const orbit = boss.pattern === 'orbital-dance' ? 82 : 50;
    boss.x = boss.baseX + Math.cos(boss.phase * .72) * orbit;
    boss.y = boss.baseY + Math.sin(boss.phase * .92) * orbit * .55;
    boss.attackClock -= dt;
    if (boss.attackClock <= 0) {
      spawnBossVolley();
      boss.attackClock = clamp(1.75 - Math.log2(state.worldDepth + 1) * .08, .72, 1.75);
    }
    if (dist(state.player.x, state.player.y, boss.x, boss.y) < state.player.r + boss.r) playerHit(boss.x, boss.y);
  }

  function spawnSituationSweep() {
    const vertical = (state.worldDepth + Math.floor(state.roomTime)) % 2 === 0;
    const speed = 125 * globalPressure() * (state.portal.open ? 1.08 : 1);
    const gap = 125 + ((hash(state.room.id) + Math.floor(state.roomTime * 10)) % 320);
    state.sweeps.push({ vertical, x: vertical ? -40 : 0, y: vertical ? 0 : -40, gap, speed, life: 7, width: 24 });
  }

  function updateSituation(dt) {
    state.situationClock -= dt;
    if (state.situationClock <= 0 && state.worldDepth >= 3) {
      spawnSituationSweep();
      state.situationClock = clamp(5.4 - Math.log2(state.worldDepth + 1) * .32 - (state.portal.open ? 1.05 : 0), 2.05, 5.4);
    }
    for (const sweep of state.sweeps) {
      sweep.life -= dt;
      if (sweep.vertical) sweep.x += sweep.speed * dt;
      else sweep.y += sweep.speed * dt;
      const onBand = sweep.vertical ? Math.abs(state.player.x - sweep.x) < sweep.width : Math.abs(state.player.y - sweep.y) < sweep.width;
      const gapAxis = sweep.vertical ? state.player.y : state.player.x;
      if (onBand && Math.abs(gapAxis - sweep.gap) > 82) playerHit(sweep.vertical ? sweep.x : state.player.x, sweep.vertical ? state.player.y : sweep.y);
    }
    state.sweeps = state.sweeps.filter((sweep) => sweep.life > 0);
  }

  function updateProjectiles(dt) {
    for (const shot of state.projectiles) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0) continue;
      let consumed = false;
      for (const target of state.room.targets) {
        if (target.done || dist(shot.x, shot.y, target.x, target.y) > shot.r + (target.r || 24)) continue;
        applyTargetHit(target, shot);
        if (shot.pierce > 0) shot.pierce -= 1; else consumed = true;
        break;
      }
      if (!consumed) {
        for (const enemy of state.enemies) {
          if (enemy.dead || dist(shot.x, shot.y, enemy.x, enemy.y) > shot.r + enemy.r) continue;
          damageEnemy(enemy, shot);
          if (shot.pierce > 0) shot.pierce -= 1; else consumed = true;
          break;
        }
      }
      if (!consumed && state.boss && !state.boss.dead && dist(shot.x, shot.y, state.boss.x, state.boss.y) <= shot.r + state.boss.r) {
        damageBoss(shot);
        consumed = true;
      }
      if (consumed || hitsObstacle(shot.x, shot.y, shot.r * .55)) shot.life = 0;
    }
    state.projectiles = state.projectiles.filter((shot) => shot.life > 0 && shot.x > -30 && shot.x < W + 30 && shot.y > 55 && shot.y < H + 30);

    for (const shot of state.hostileShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (dist(state.player.x, state.player.y, shot.x, shot.y) < state.player.r + shot.r) {
        playerHit(shot.x, shot.y);
        shot.life = 0;
      }
    }
    state.hostileShots = state.hostileShots.filter((shot) => shot.life > 0 && shot.x > -40 && shot.x < W + 40 && shot.y > 50 && shot.y < H + 40);
  }

  function updatePowerup() {
    const powerup = state.room.powerup;
    if (!powerup || powerup.collected) return;
    if (dist(state.player.x, state.player.y, powerup.x, powerup.y) < state.player.r + (powerup.r || 15) + 5) applyRelic(powerup);
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(.16, dt);
      particle.vy *= Math.pow(.16, dt);
      particle.life -= dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function burst(x, y, color, count = 12, speed = 110) {
    const rng = rngFrom((hash(`${x}:${y}:${state.roomTime}`) + state.particles.length * 131) >>> 0);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * TAU;
      const velocity = speed * (.35 + rng() * .75);
      state.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: .35 + rng() * .7, maxLife: 1, r: 1 + rng() * 3, color });
    }
  }

  function update(dt) {
    if (state.mode !== 'playing') return;
    state.totalTime += dt;
    state.roomTime += dt;
    state.shootCd = Math.max(0, state.shootCd - dt);
    state.dashCd = Math.max(0, state.dashCd - dt);
    state.dashTime = Math.max(0, state.dashTime - dt);
    state.hitCd = Math.max(0, state.hitCd - dt);
    state.recoil = Math.max(0, state.recoil - dt);
    state.chainTimer = Math.max(0, state.chainTimer - dt);
    if (state.chainTimer <= 0) state.chain = 0;
    updateObstacles(dt);
    updateTargets(dt);
    updatePlayer(dt);
    updateHazards(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateSituation(dt);
    updateProjectiles(dt);
    updatePowerup();
    updatePortal(dt);
    updateParticles(dt);
    checkPortalReady();
    music.update(dt);
    syncHud();
  }

  function roundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawBiomeBackground(now) {
    const room = state.room || content.rooms[0];
    const palette = room.palette || { bg: '#06110e', floor: '#10291c', accent: '#86f0b0', water: '#5adfff', warm: '#ffaf68' };
    const atlas = room.atlas || {};
    const terrain = String(atlas.terrain || room.decor || 'forest');
    const t = now * .001;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, palette.bg || '#071410');
    bg.addColorStop(.5, hexAlpha(palette.floor || '#173027', .92));
    bg.addColorStop(1, '#020806');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(W * .56, H * .38, 20, W * .56, H * .38, 470);
    halo.addColorStop(0, hexAlpha(palette.accent || '#79efb1', .15));
    halo.addColorStop(.48, hexAlpha(palette.water || '#58d8ff', .055));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = .38;
    if (/forest|garden|meadow|field|hollow|orchard/.test(terrain)) {
      ctx.strokeStyle = hexAlpha(palette.accent, .42);
      ctx.lineWidth = 8;
      for (let side = 0; side < 2; side += 1) {
        for (let i = 0; i < 5; i += 1) {
          const baseX = side ? W - i * 34 : i * 34;
          ctx.beginPath();
          ctx.moveTo(baseX, H);
          ctx.bezierCurveTo(baseX + (side ? -60 : 60), 470, baseX + Math.sin(i + t * .2) * 25, 260, baseX + (side ? -35 : 35), 100);
          ctx.stroke();
        }
      }
    } else if (/reef|shore|wetland|river|lake|tide/.test(terrain)) {
      ctx.strokeStyle = hexAlpha(palette.water, .35);
      ctx.lineWidth = 3;
      for (let y = 120; y < H; y += 48) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 22) {
          const yy = y + Math.sin(x * .021 + t * .55 + y) * 8;
          if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (/ice|snow|mountain|alpine/.test(terrain)) {
      ctx.strokeStyle = hexAlpha(palette.water, .3);
      ctx.lineWidth = 2;
      for (let i = 0; i < 11; i += 1) {
        const x = i * 95 - 25;
        const h = 60 + (i % 4) * 34;
        ctx.beginPath(); ctx.moveTo(x - 70, 560); ctx.lineTo(x, 560 - h); ctx.lineTo(x + 80, 560); ctx.stroke();
      }
    } else if (/desert|canyon|volcanic|burn/.test(terrain)) {
      ctx.fillStyle = hexAlpha(palette.warm, .12);
      for (let i = 0; i < 9; i += 1) {
        const x = 30 + i * 116;
        const h = 85 + (i % 3) * 54;
        ctx.beginPath(); ctx.moveTo(x - 65, H); ctx.lineTo(x - 28, H - h * .55); ctx.lineTo(x, H - h); ctx.lineTo(x + 52, H); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = hexAlpha(palette.water, .4);
      for (const d of sceneDecor.slice(0, 28)) {
        const pulse = .7 + .5 * Math.sin(t * .7 + d.phase);
        ctx.beginPath(); ctx.arc(d.x, d.y * .65, d.r * .35 * pulse, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    for (const d of sceneDecor) {
      const bob = settings.reducedMotion ? 0 : Math.sin(t * (.45 + d.depth) + d.phase) * (2 + d.depth * 5);
      if (d.type <= 2) {
        ctx.fillStyle = d.type === 0 ? hexAlpha(palette.water, .34) : d.type === 1 ? hexAlpha(palette.accent, .32) : hexAlpha(palette.warm, .24);
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(d.x, d.y + bob, d.r * .42, 0, TAU); ctx.fill();
      } else if (d.type === 3 && /forest|garden|meadow|field/.test(terrain)) {
        ctx.strokeStyle = hexAlpha(palette.accent, .18);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(d.x, d.y + 14); ctx.quadraticCurveTo(d.x - 8, d.y, d.x + Math.sin(t + d.phase) * 4, d.y - d.r * 2); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    const vignette = ctx.createRadialGradient(W / 2, H / 2, 250, W / 2, H / 2, 610);
    vignette.addColorStop(.52, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawObstacle(obstacle) {
    const palette = state.room.palette;
    const kind = String(obstacle.kind || 'stone');
    const organic = /root|log|tree|hedge|mangrove/.test(kind);
    const icy = /ice|glass/.test(kind);
    const hot = /char|rock/.test(kind);
    const color = icy ? palette.water : hot ? palette.warm : organic ? palette.accent : '#93a59d';
    ctx.save();
    ctx.shadowColor = hexAlpha(color, .45);
    ctx.shadowBlur = 12;
    const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
    gradient.addColorStop(0, hexAlpha(color, organic ? .42 : .34));
    gradient.addColorStop(1, 'rgba(4,10,8,.92)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = hexAlpha(color, .42);
    ctx.lineWidth = 1.4;
    roundedRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, organic ? 14 : 8);
    ctx.fill(); ctx.stroke();
    if (organic) {
      ctx.strokeStyle = hexAlpha(color, .42);
      for (let i = 0; i < 3; i += 1) {
        const y = obstacle.y + 8 + (i + 1) * obstacle.h / 4;
        ctx.beginPath(); ctx.moveTo(obstacle.x + 5, y); ctx.bezierCurveTo(obstacle.x + obstacle.w * .3, y - 9, obstacle.x + obstacle.w * .7, y + 8, obstacle.x + obstacle.w - 5, y - 3); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTarget(target, now) {
    const expected = targetExpected(target);
    const color = expected ? ABILITIES[expected].color : '#8fffb8';
    const t = now * .001;
    ctx.save();
    if (target.zone && !target.done) {
      ctx.strokeStyle = hexAlpha('#6bdcff', .35);
      ctx.setLineDash([5, 7]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(target.zone.x, target.zone.y, target.zone.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    const pulse = 1 + Math.sin(t * 3 + hash(target.id)) * .08;
    ctx.translate(target.x, target.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = color;
    ctx.shadowBlur = target.done ? 9 : 18;
    ctx.fillStyle = target.done ? 'rgba(96,186,129,.28)' : 'rgba(8,20,15,.78)';
    ctx.strokeStyle = target.done ? 'rgba(143,255,182,.32)' : hexAlpha(color, .72);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, target.r || 24, 0, TAU); ctx.fill(); ctx.stroke();
    if (target.kind === 'animal') drawCreatureGlyph(target.species || 'wildlife', 0, 0, target.done ? '#9be9b5' : color, .72);
    else {
      ctx.fillStyle = target.done ? '#b7f5c9' : color;
      ctx.font = '700 17px ui-monospace,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(target.done ? '✓' : ABILITIES[expected]?.icon || '◇', 0, 0);
    }
    ctx.restore();
  }

  function creatureKind(species) {
    const s = String(species || '').toLowerCase();
    if (/moth|butterfly|bird|owl|hawk|eagle|bat|heron/.test(s)) return 'flying';
    if (/fish|ray|turtle|dolphin|whale/.test(s)) return 'aquatic';
    if (/beetle|bee|ant|bug|insect/.test(s)) return 'insect';
    if (/fox|wolf|deer|goat|hare|rabbit|marmot|cat|lynx/.test(s)) return 'quadruped';
    return 'wisp';
  }

  function drawCreatureGlyph(species, x, y, color, scale = 1) {
    const kind = creatureKind(species);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = color; ctx.fillStyle = hexAlpha(color, .2); ctx.lineWidth = 2;
    if (kind === 'flying') {
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-8, -2, 8, 4, -.45, 0, TAU); ctx.ellipse(8, -2, 8, 4, .45, 0, TAU); ctx.stroke();
    } else if (kind === 'aquatic') {
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-16, -7); ctx.lineTo(-16, 7); ctx.closePath(); ctx.stroke();
    } else if (kind === 'insect') {
      for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.arc(i * 5, 0, 5, 0, TAU); ctx.fill(); ctx.stroke(); }
      for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.moveTo(i * 4, 4); ctx.lineTo(i * 7 - 7, 10); ctx.moveTo(i * 4, -4); ctx.lineTo(i * 7 - 7, -10); ctx.stroke(); }
    } else if (kind === 'quadruped') {
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(10, -3, 5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(-8, 11); ctx.moveTo(5, 4); ctx.lineTo(6, 11); ctx.moveTo(-9, -1); ctx.quadraticCurveTo(-17, -7, -18, 0); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-12, 10, -4, 15); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy, now) {
    if (enemy.dead) return;
    const palette = state.room.palette;
    const color = palette.warm || '#ffaf70';
    ctx.save();
    if (enemy.telegraph > 0) {
      ctx.strokeStyle = hexAlpha('#ffb35f', .7);
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(state.player.x, state.player.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.translate(enemy.x, enemy.y);
    const wobble = 1 + Math.sin(now * .004 + enemy.phase) * .08;
    ctx.scale(wobble, wobble);
    ctx.shadowColor = color; ctx.shadowBlur = 15;
    drawCreatureGlyph(enemy.species, 0, 0, color, 1.05);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + 5, 0, TAU); ctx.stroke();
    const w = 26;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-w / 2, enemy.r + 8, w, 3);
    ctx.fillStyle = color; ctx.fillRect(-w / 2, enemy.r + 8, w * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
    ctx.restore();
  }

  function drawBoss(now) {
    const boss = state.boss;
    if (!boss || boss.dead) return;
    const t = now * .001;
    ctx.save(); ctx.translate(boss.x, boss.y);
    ctx.shadowColor = '#aa73ff'; ctx.shadowBlur = 28;
    ctx.strokeStyle = '#b98aff'; ctx.lineWidth = 3;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath(); ctx.arc(0, 0, boss.r + ring * 8, t * (.4 + ring * .13), t * (.4 + ring * .13) + Math.PI * 1.32); ctx.stroke();
    }
    const g = ctx.createRadialGradient(-10, -12, 2, 0, 0, boss.r);
    g.addColorStop(0, '#a9ffd1'); g.addColorStop(.35, '#3f7c68'); g.addColorStop(1, '#17241e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, boss.r, 0, TAU); ctx.fill();
    drawCreatureGlyph(boss.name, 0, 0, '#e7d8ff', 1.55);
    ctx.restore();
    const w = 120;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(boss.x - w / 2, boss.y - boss.r - 18, w, 6);
    ctx.fillStyle = '#b47cff'; ctx.fillRect(boss.x - w / 2, boss.y - boss.r - 18, w * clamp(boss.hp / boss.maxHp, 0, 1), 6);
  }

  function drawHazards() {
    for (const hazard of state.room.hazards) {
      const color = hazard.type === 'heat' ? '#ff8b59' : hazard.type === 'cold' ? '#8bdcff' : hazard.type === 'thorn' ? '#9be86e' : '#6ad5ed';
      ctx.save(); ctx.strokeStyle = hexAlpha(color, .58); ctx.fillStyle = hexAlpha(color, .10); ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    for (const sweep of state.sweeps) {
      const color = state.portal.open ? '#b76cff' : '#64d9ff';
      ctx.save(); ctx.fillStyle = hexAlpha(color, .10); ctx.strokeStyle = hexAlpha(color, .42); ctx.lineWidth = 1.5;
      if (sweep.vertical) {
        ctx.fillRect(sweep.x - sweep.width, 70, sweep.width * 2, H - 120);
        ctx.clearRect(sweep.x - sweep.width - 1, sweep.gap - 82, sweep.width * 2 + 2, 164);
      } else {
        ctx.fillRect(0, sweep.y - sweep.width, W, sweep.width * 2);
        ctx.clearRect(sweep.gap - 82, sweep.y - sweep.width - 1, 164, sweep.width * 2 + 2);
      }
      ctx.restore();
    }
  }

  function drawPowerup(now) {
    const gift = state.room.powerup;
    if (!gift || gift.collected) return;
    const pulse = 1 + Math.sin(now * .005) * .12;
    ctx.save(); ctx.translate(gift.x, gift.y); ctx.scale(pulse, pulse);
    ctx.shadowColor = gift.color || '#8fffc4'; ctx.shadowBlur = 22;
    ctx.strokeStyle = gift.color || '#8fffc4'; ctx.fillStyle = hexAlpha(gift.color || '#8fffc4', .18); ctx.lineWidth = 2;
    ctx.rotate(now * .00055);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = i / 6 * TAU;
      const x = Math.cos(a) * 16; const y = Math.sin(a) * 16;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(-now * .00055);
    ctx.fillStyle = '#effff6'; ctx.font = '700 12px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gift.icon || '✦', 0, 0);
    ctx.restore();
  }

  function drawProjectile(shot) {
    const color = ABILITIES[shot.ability]?.color || '#74eaff';
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = .28; ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * .035, shot.y - shot.vy * .035); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, shot.r * .8); ctx.stroke(); ctx.restore();
  }

  function drawPortal(now) {
    const p = state.portal;
    const t = now * .001;
    if (p.phase === 'sealed') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = canChargePortal() ? 'rgba(154,255,181,.38)' : 'rgba(143,180,162,.22)'; ctx.lineWidth = 2; ctx.setLineDash([5, 8]);
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(116,218,255,.18)';
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke(); ctx.restore();
      return;
    }
    if (p.phase === 'ready') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.shadowColor = '#8cffad'; ctx.shadowBlur = 20;
      ctx.strokeStyle = '#83ffac'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(0, 0, p.r + i * 6, t * (.6 + i * .2), t * (.6 + i * .2) + Math.PI * .9); ctx.stroke(); }
      ctx.restore();
      return;
    }
    if (p.phase === 'charging') {
      ctx.save(); ctx.translate(state.player.x, state.player.y); ctx.strokeStyle = '#b978ff'; ctx.shadowColor = '#78e8ff'; ctx.shadowBlur = 24; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 27 + p.charge * 13, -Math.PI / 2, -Math.PI / 2 + TAU * p.charge); ctx.stroke(); ctx.restore();
      return;
    }
    if (p.phase === 'firing' && p.bolt) {
      for (let i = 0; i < p.bolt.trail.length; i += 1) {
        const pt = p.bolt.trail[i];
        const alpha = (i + 1) / p.bolt.trail.length;
        ctx.fillStyle = i % 3 === 0 ? hexAlpha('#b66fff', alpha * .55) : i % 3 === 1 ? hexAlpha('#62e7ff', alpha * .6) : hexAlpha('#8affaa', alpha * .6);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2 + alpha * 5, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.shadowColor = '#b76cff'; ctx.shadowBlur = 32; ctx.fillStyle = '#d6b5ff'; ctx.beginPath(); ctx.arc(p.bolt.x, p.bolt.y, 9, 0, TAU); ctx.fill(); ctx.restore();
      return;
    }
    if (!p.open) return;

    ctx.save(); ctx.translate(p.x, p.y);
    const breathe = 1 + Math.sin(t * 2.2) * .045;
    ctx.scale(breathe, breathe);
    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * .92);
    core.addColorStop(0, 'rgba(3,8,18,.95)');
    core.addColorStop(.45, 'rgba(28,23,77,.86)');
    core.addColorStop(.72, 'rgba(34,113,130,.54)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, p.r * .9, 0, TAU); ctx.fill();

    const colors = ['#9b5cff', '#52d9ff', '#79ff9a', '#6f73ff'];
    for (let ring = 0; ring < 5; ring += 1) {
      ctx.save();
      ctx.rotate((ring % 2 ? -1 : 1) * t * (.45 + ring * .11));
      ctx.strokeStyle = colors[ring % colors.length];
      ctx.shadowColor = colors[ring % colors.length];
      ctx.shadowBlur = 17;
      ctx.lineWidth = 2.2 + (ring % 2);
      const radius = p.r + ring * 5;
      for (let arc = 0; arc < 3; arc += 1) {
        const start = arc * TAU / 3 + ring * .23;
        ctx.beginPath(); ctx.arc(0, 0, radius, start, start + 1.15); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i += 1) {
      const a = t * (.6 + (i % 5) * .08) + i * 1.37;
      const r = p.r + 12 + (i % 4) * 6 + Math.sin(t * 2 + i) * 3;
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = .35 + (i % 3) * .15;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.4 + (i % 2), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawSprid(now) {
    const p = state.player;
    if (!p) return;
    const t = now * .001;
    const moving = Math.hypot(p.vx, p.vy) > 15;
    const bob = moving ? Math.sin(p.walk) * 2.4 : Math.sin(t * 2.1) * 1.2;
    const aim = { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    const chargeRatio = clamp(state.stones / Math.max(1, state.stoneQuota), 0, 1);
    const portalColor = state.portal.phase === 'ready' || state.portal.phase === 'charging' ? '#b26cff' : '#58dfff';
    ctx.save(); ctx.translate(p.x, p.y + bob);
    if (state.dashTime > 0) { ctx.scale(1.28, .76); ctx.globalAlpha = .88; }

    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(0, 21, 17, 5, 0, 0, TAU); ctx.fill();

    ctx.strokeStyle = 'rgba(109,239,160,.74)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const legSwing = moving ? Math.sin(p.walk) * 5 : 0;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * 5, 10); ctx.quadraticCurveTo(side * (7 + legSwing * .25), 17, side * (9 + legSwing * side), 23); ctx.stroke();
    }

    const body = ctx.createRadialGradient(-5, -8, 2, 0, 0, 18);
    body.addColorStop(0, '#c8ffda'); body.addColorStop(.32, '#6ef2a4'); body.addColorStop(.72, '#318b69'); body.addColorStop(1, '#123e35');
    ctx.shadowColor = '#72f1a9'; ctx.shadowBlur = 18;
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -1, 16, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#a5ffd0'; ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i += 1) {
      const a = -2.6 + i * .36;
      const len = 10 + (i % 2) * 5;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, -12 + Math.sin(a) * 4); ctx.quadraticCurveTo(Math.cos(a) * 15, -23, Math.cos(a) * len, -27 - (i % 2) * 4); ctx.stroke();
      ctx.fillStyle = '#8effaf'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * len + 2, -29 - (i % 2) * 4, 3.8, 2.2, a, 0, TAU); ctx.fill();
    }

    const eyeOffsetX = aim.x * 2.2;
    const eyeOffsetY = aim.y * 1.2;
    ctx.fillStyle = '#efffff'; ctx.shadowColor = '#88f7ff'; ctx.shadowBlur = 9;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 5 + eyeOffsetX, -4 + eyeOffsetY, 2.4, 3.2, 0, 0, TAU); ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(2,35,28,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 2, 4, .25, Math.PI - .25); ctx.stroke();

    const gunX = aim.x * (19 - state.recoil * 22);
    const gunY = aim.y * (19 - state.recoil * 22);
    ctx.save(); ctx.translate(gunX, gunY); ctx.rotate(p.facing);
    ctx.strokeStyle = '#79e6bd'; ctx.fillStyle = '#214e42'; ctx.lineWidth = 1.7;
    roundedRect(-6, -5, 21, 10, 4); ctx.fill(); ctx.stroke();
    const chamber = ctx.createLinearGradient(-2, 0, 11, 0);
    chamber.addColorStop(0, '#58dfff'); chamber.addColorStop(.5, portalColor); chamber.addColorStop(1, '#8dff9e');
    ctx.fillStyle = chamber; ctx.globalAlpha = .35 + chargeRatio * .65; ctx.fillRect(0, -3, 9, 6); ctx.globalAlpha = 1;
    ctx.strokeStyle = portalColor; ctx.shadowColor = portalColor; ctx.shadowBlur = state.portal.phase === 'ready' ? 16 : 7;
    ctx.beginPath(); ctx.arc(16, 0, 4.8, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();

    if (state.portal.phase === 'ready') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i += 1) {
        const a = t * 1.4 + i * TAU / 6;
        ctx.fillStyle = i % 2 ? '#6ee7ff' : '#b46cff';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 23, -1 + Math.sin(a) * 17, 1.6, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = clamp(particle.life / .75, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawIntro() {
    if (introTimer <= 0 || !state.room) return;
    const alpha = clamp(introTimer < .5 ? introTimer / .5 : (2.1 - introTimer) / .45, 0, 1);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#caffde'; ctx.font = '700 10px ui-monospace,monospace'; ctx.fillText(roomLabel().toUpperCase(), W / 2, 262);
    ctx.fillStyle = '#f1fff7'; ctx.font = '600 34px system-ui,sans-serif'; ctx.fillText(state.room.title, W / 2, 302);
    ctx.fillStyle = 'rgba(224,246,235,.72)'; ctx.font = '500 12px system-ui,sans-serif'; ctx.fillText(state.room.challenge?.situation?.name || state.room.subtitle || 'Sylvarian world', W / 2, 327);
    ctx.restore();
  }

  function draw(now) {
    drawBiomeBackground(now);
    if (!state.room) return;
    for (const obstacle of state.room.obstacles) drawObstacle(obstacle);
    drawHazards();
    for (const target of state.room.targets) drawTarget(target, now);
    drawPowerup(now);
    for (const enemy of state.enemies) drawEnemy(enemy, now);
    drawBoss(now);
    for (const shot of state.projectiles) drawProjectile(shot);
    for (const shot of state.hostileShots) {
      ctx.save(); ctx.shadowColor = '#ff8d6e'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffae79'; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, TAU); ctx.fill(); ctx.restore();
    }
    drawPortal(now);
    drawSprid(now);
    drawParticles();
    drawIntro();
  }

  function toast(message, duration = 1100) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
  }

  function syncHud(force = false) {
    if (!state.room) return;
    const world = $('roomKicker');
    const title = $('roomTitle');
    const task = $('roomTask');
    const score = $('score');
    const time = $('time');
    const integrity = $('integrity');
    const stones = $('mossglint');
    const portal = $('portalState');
    const dash = $('dashState');
    const boss = $('bossState');
    if (world) world.textContent = `${roomLabel()} · depth ${state.worldDepth}`;
    if (title) title.textContent = state.room.title;
    if (task) {
      task.textContent = state.portal.open
        ? 'Extraction live. Reach the neon gate before the world closes.'
        : state.portal.phase === 'ready'
          ? 'Mossglint aligned. Fire the portal charge, then escape.'
          : `${state.room.challenge?.situation?.hint || state.room.task}`;
    }
    if (score) score.textContent = Math.round(state.score).toLocaleString();
    if (time) time.textContent = formatTime(state.totalTime);
    if (integrity) integrity.textContent = `${'◆'.repeat(Math.max(0, state.integrity))}${'◇'.repeat(Math.max(0, state.maxIntegrity - state.integrity))}`;
    if (stones) stones.textContent = `${state.stones}/${state.stoneQuota}`;
    if (portal) {
      const labels = {
        sealed: `${Math.round(clamp(state.stones / Math.max(1, state.stoneQuota), 0, 1) * 100)}%`,
        ready: 'READY · F', charging: 'CHARGING', firing: 'CASTING', open: 'OPEN',
      };
      portal.textContent = labels[state.portal.phase] || state.portal.phase.toUpperCase();
    }
    if (dash) dash.textContent = state.dashCd <= 0 ? 'READY' : `${state.dashCd.toFixed(1)}s`;
    if (boss) boss.textContent = state.boss && !state.boss.dead ? `${state.boss.name} ${Math.ceil(state.boss.hp)}/${state.boss.maxHp}` : '';
    const fireBtn = $('portalFireBtn');
    if (fireBtn) {
      fireBtn.disabled = state.portal.phase !== 'ready';
      fireBtn.classList.toggle('ready', state.portal.phase === 'ready');
      fireBtn.textContent = state.portal.phase === 'ready' ? 'F · FIRE GATE' : state.portal.open ? 'GATE OPEN' : 'GATE LOCKED';
    }
    const nearest = nearestTarget();
    const hint = $('hintCard');
    if (hint) {
      if (state.portal.open) hint.innerHTML = '<strong>Extraction:</strong> the world is destabilizing. Reach the neon rift and press Enter, or cross its edge.';
      else if (state.portal.phase === 'ready') hint.innerHTML = '<strong>Portal charged:</strong> press F or click FIRE GATE. The shot will bind the Mossglint to the eastern anchor.';
      else if (state.boss && !state.boss.dead && roomSolved()) hint.innerHTML = `<strong>Guardian lock:</strong> defeat ${state.boss.name} to release the final Mossglint charge.`;
      else if (nearest) hint.innerHTML = `<strong>${nearest.label || 'puzzle node'}:</strong> ${ABILITIES[targetExpected(nearest)]?.name || 'observe'} resonance next · solved nodes condense Mossglint.`;
      else hint.innerHTML = '<strong>Read the arena:</strong> route around wildlife pressure and finish the Mossglint circuit.';
    }
    if (force) syncAbilityButtons();
  }

  function syncAbilityButtons() {
    document.querySelectorAll('.ability').forEach((button) => {
      const id = button.dataset.a;
      button.disabled = !(state.room?.unlock || []).includes(id);
      button.classList.toggle('active', id === state.selected);
    });
  }

  function keyLabel(key) {
    if (key === ' ') return 'Space';
    if (key === 'arrowup') return '↑'; if (key === 'arrowdown') return '↓';
    if (key === 'arrowleft') return '←'; if (key === 'arrowright') return '→';
    if (key === 'shift') return 'Shift'; if (key === 'enter') return 'Enter';
    return String(key || '').toUpperCase();
  }

  function syncBindingButtons() {
    document.querySelectorAll('[data-bind]').forEach((button) => {
      const action = button.dataset.bind;
      const target = button.querySelector('.bindKey');
      if (target && action) target.textContent = keyLabel(settings.bindings[action]);
    });
  }

  function beginCapture(action, button) {
    captureAction = action;
    document.querySelectorAll('[data-bind]').forEach((entry) => entry.classList.remove('listening'));
    button.classList.add('listening');
    const key = button.querySelector('.bindKey');
    if (key) key.textContent = 'press key';
  }

  function hideScreens() {
    for (const id of ['title','howScreen','controlsScreen','optionsScreen','pauseScreen','gameOver']) $(id)?.classList.add('hidden');
  }

  function showScreen(id) {
    hideScreens();
    $(id)?.classList.remove('hidden');
  }

  function startRun(mode = 'run') {
    state.mode = 'playing';
    state.runMode = mode;
    state.worldDepth = 1;
    state.worldsCleared = 0;
    state.atlasClears = 0;
    state.totalTime = 0;
    state.score = 0;
    state.integrity = mode === 'explore' ? 5 : 3;
    state.maxIntegrity = state.integrity;
    state.roomStats = [];
    state.stats = { casts: 0, correct: 0, wasted: 0, hits: 0, dashes: 0, kills: 0, bosses: 0, stones: 0, portals: 0 };
    state.relics = freshRelics();
    state.sectorIndex = 0;
    hideScreens();
    setupRoom(0);
    canvas.focus();
    music.ensure();
    music.setEnabled(settings.music, settings.sfx, settings.volume);
  }

  function pause() {
    if (state.mode === 'playing') {
      state.mode = 'paused'; showScreen('pauseScreen');
    } else if (state.mode === 'paused') {
      state.mode = 'playing'; hideScreens(); canvas.focus(); last = performance.now();
    }
  }

  function gameOver() {
    state.mode = 'gameover';
    saveBest();
    const title = $('gameOverTitle');
    const summary = $('gameOverSummary');
    if (title) title.textContent = 'the gate went dark';
    if (summary) summary.textContent = `${state.worldsCleared} worlds · ${Math.round(state.score).toLocaleString()} points · ${formatTime(state.totalTime)}`;
    showScreen('gameOver');
    music.chime('collapse');
  }

  function saveBest() {
    const best = loadBest();
    const next = {
      world: Math.max(best.world || 0, state.worldsCleared),
      score: Math.max(best.score || 0, Math.round(state.score)),
      time: Math.max(best.world || 0, state.worldsCleared) === state.worldsCleared ? state.totalTime : best.time,
      atlasClears: Math.max(best.atlasClears || 0, state.atlasClears),
    };
    try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch {}
    syncBestCard();
  }

  function syncBestCard() {
    const best = loadBest();
    const card = $('bestRun');
    if (!card) return;
    card.textContent = best.world > 0
      ? `best · ${best.world} worlds · ${Number(best.score || 0).toLocaleString()} points${best.atlasClears ? ` · ${best.atlasClears} Atlas clear` : ''}`
      : 'best · no run yet';
  }

  class SylvariaMusic {
    constructor() {
      this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
      this.enabledMusic = true; this.enabledSfx = true; this.volume = .68;
      this.clock = 0; this.step = 0; this.seed = 1; this.depth = 1; this.guardian = false;
    }
    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.musicGain = this.ctx.createGain(); this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master); this.sfxGain.connect(this.master); this.master.connect(this.ctx.destination);
      this.setEnabled(settings.music, settings.sfx, settings.volume);
    }
    setEnabled(musicOn, sfxOn, volume) {
      this.enabledMusic = musicOn; this.enabledSfx = sfxOn; this.volume = Number(volume ?? .68);
      if (!this.ctx) return;
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .03);
      this.musicGain.gain.setTargetAtTime(musicOn ? .14 : 0, this.ctx.currentTime, .04);
      this.sfxGain.gain.setTargetAtTime(sfxOn ? .28 : 0, this.ctx.currentTime, .03);
    }
    setWorld(room, depth, guardian) {
      this.seed = room?.atlas?.seed || hash(room?.id || 'sylvaria'); this.depth = depth; this.guardian = guardian; this.clock = 0; this.step = 0;
    }
    bpm() { return clamp(78 + Math.log2(this.depth + 1) * 6 + (this.guardian ? 13 : 0), 78, 142); }
    tone(freq, duration, gain, type = 'sine', destination = this.musicGain, when = 0) {
      if (!this.ctx || !destination) return;
      const at = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), at + .015); g.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(g); g.connect(destination); osc.start(at); osc.stop(at + duration + .03);
    }
    update(dt) {
      if (!this.enabledMusic || !this.ctx) return;
      this.clock -= dt;
      if (this.clock > 0) return;
      const beat = 60 / this.bpm(); this.clock += beat;
      const roots = [55, 61.74, 65.41, 73.42, 82.41, 87.31];
      const root = roots[this.seed % roots.length];
      const scale = [1, 9/8, 5/4, 4/3, 3/2, 5/3];
      const note = root * scale[(this.step + (this.seed >>> 5)) % scale.length];
      this.tone(note, beat * .78, .035, 'triangle');
      if (this.step % 2 === 0) this.tone(note * 2, beat * .32, .016, 'sine', this.musicGain, .02);
      if (this.guardian && this.step % 2 === 0) this.tone(root / 2, beat * .24, .04, 'sawtooth');
      this.step = (this.step + 1) % 16;
    }
    chime(kind) {
      if (!this.enabledSfx) return;
      this.ensure();
      if (!this.ctx) return;
      const map = {
        cast: [420, .055, .018, 'square'], stone: [740, .16, .045, 'sine'], ready: [520, .18, .05, 'sine'],
        charge: [130, .32, .07, 'sawtooth'], firegate: [92, .35, .09, 'sawtooth'], portal: [330, .38, .065, 'triangle'],
        dash: [260, .08, .028, 'triangle'], hit: [92, .12, .06, 'square'], gift: [620, .22, .05, 'sine'],
        boss: [185, .4, .08, 'sawtooth'], bossPulse: [110, .08, .025, 'square'], atlas: [880, .5, .06, 'sine'], collapse: [75, .5, .08, 'sawtooth'],
      };
      const [f,d,g,type] = map[kind] || map.cast;
      this.tone(f, d, g, type, this.sfxGain);
      if (kind === 'ready' || kind === 'portal' || kind === 'atlas') this.tone(f * 1.5, d * .85, g * .72, 'sine', this.sfxGain, .055);
      if (kind === 'portal') this.tone(f * 2, d * .7, g * .48, 'sine', this.sfxGain, .11);
    }
  }
  const music = new SylvariaMusic();

  document.querySelectorAll('.ability').forEach((button) => button.addEventListener('click', () => selectAbility(button.dataset.a)));
  $('portalFireBtn')?.addEventListener('click', () => { music.ensure(); firePortalCharge(); canvas.focus(); });
  $('start')?.addEventListener('click', () => startRun('run'));
  $('explore')?.addEventListener('click', () => startRun('explore'));
  $('howBtn')?.addEventListener('click', () => showScreen('howScreen'));
  $('controlsBtn')?.addEventListener('click', () => showScreen('controlsScreen'));
  $('optionsBtn')?.addEventListener('click', () => showScreen('optionsScreen'));
  $('resume')?.addEventListener('click', pause);
  $('pauseOptions')?.addEventListener('click', () => showScreen('optionsScreen'));
  $('restartRun')?.addEventListener('click', () => { window.MosslightExpedition?.newRun?.(); startRun(state.runMode); });
  $('menuFromGameOver')?.addEventListener('click', () => { state.mode = 'menu'; showScreen('title'); });
  document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showScreen(state.mode === 'paused' ? 'pauseScreen' : 'title')));
  document.querySelectorAll('[data-bind]').forEach((button) => button.addEventListener('click', () => beginCapture(button.dataset.bind, button)));
  $('resetControls')?.addEventListener('click', () => { settings.bindings = { ...DEFAULT_BINDINGS }; saveSettings(); syncBindingButtons(); });

  const musicToggle = $('musicToggle');
  const sfxToggle = $('sfxToggle');
  const assistToggle = $('assistToggle');
  const motionToggle = $('motionToggle');
  const volume = $('volume');
  if (musicToggle) musicToggle.checked = settings.music;
  if (sfxToggle) sfxToggle.checked = settings.sfx;
  if (assistToggle) assistToggle.checked = settings.aimAssist;
  if (motionToggle) motionToggle.checked = settings.reducedMotion;
  if (volume) volume.value = String(settings.volume);
  const syncOptions = () => {
    settings.music = Boolean(musicToggle?.checked); settings.sfx = Boolean(sfxToggle?.checked);
    settings.aimAssist = Boolean(assistToggle?.checked); settings.reducedMotion = Boolean(motionToggle?.checked);
    settings.volume = Number(volume?.value ?? .68); saveSettings(); music.setEnabled(settings.music, settings.sfx, settings.volume);
  };
  for (const input of [musicToggle,sfxToggle,assistToggle,motionToggle,volume]) input?.addEventListener('input', syncOptions);

  window.addEventListener('keydown', (event) => {
    const key = normKey(event.key);
    if (captureAction) {
      event.preventDefault();
      const action = captureAction; captureAction = null;
      settings.bindings[action] = key; saveSettings(); syncBindingButtons();
      document.querySelectorAll('[data-bind]').forEach((entry) => entry.classList.remove('listening'));
      return;
    }
    const gameplayKey = Object.values(settings.bindings).includes(key) || /^arrow/.test(key) || key === ' ';
    if (gameplayKey) event.preventDefault();
    keys.add(key);
    if (state.mode === 'playing') {
      if (isAction('cast', key) && !event.repeat) fire();
      if (isAction('dash', key) && !event.repeat) tryDash();
      if (isAction('portalFire', key) && !event.repeat) firePortalCharge();
      if (isAction('portalEnter', key) && !event.repeat) attemptPortalEnter();
      if (isAction('cyclePrev', key) && !event.repeat) cycleAbility(-1);
      if (isAction('cycleNext', key) && !event.repeat) cycleAbility(1);
      if (isAction('pause', key) && !event.repeat) pause();
      if (event.key >= '1' && event.key <= '6') selectAbility(ABILITY_IDS[Number(event.key) - 1]);
    } else if (state.mode === 'paused' && isAction('pause', key)) pause();
  }, { passive: false });
  window.addEventListener('keyup', (event) => keys.delete(normKey(event.key)));

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) * W / rect.width;
    pointer.y = (event.clientY - rect.top) * H / rect.height;
    pointer.seen = true; aimSource = 'mouse';
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    music.ensure();
    pointer.down = true;
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) * W / rect.width;
    pointer.y = (event.clientY - rect.top) * H / rect.height;
    pointer.seen = true; aimSource = 'mouse';
    fire();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });

  function completeRoomForTest() {
    for (const target of state.room.targets) {
      if (target.done) continue;
      target.step = target.sequence.length;
      target.done = true;
      if (!target.stoneAwarded) { target.stoneAwarded = true; awardStone(target.x, target.y, 1); }
    }
    checkPortalReady();
    return snapshot();
  }

  function forceOpenPortalForTest() {
    completeRoomForTest();
    if (state.boss && !state.boss.dead) defeatBoss();
    state.stones = Math.max(state.stones, state.stoneQuota);
    state.portal.phase = 'open'; state.portal.ready = false; state.portal.open = true; state.portal.extractionAge = 1;
    return snapshot();
  }

  function snapshot() {
    return {
      mode: state.mode, runMode: state.runMode, worldDepth: state.worldDepth, worldsCleared: state.worldsCleared,
      atlasClears: state.atlasClears, sectorIndex: state.sectorIndex,
      player: state.player ? { x: state.player.x, y: state.player.y, facing: state.player.facing } : null,
      selected: state.selected, aimSource, score: state.score, integrity: state.integrity,
      stones: state.stones, stoneQuota: state.stoneQuota,
      portalOpen: state.portal.open, portalReady: state.portal.phase === 'ready', portalPhase: state.portal.phase,
      extractionAge: state.portal.extractionAge,
      boss: state.boss ? { name: state.boss.name, hp: state.boss.hp, maxHp: state.boss.maxHp, dead: state.boss.dead } : null,
      challenge: state.room?.challenge || null,
      targets: state.room?.targets?.map((target) => ({ id: target.id, x: target.x, y: target.y, done: target.done, step: target.step, expected: targetExpected(target) })) || [],
      enemies: state.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ x: enemy.x, y: enemy.y, pattern: enemy.pattern, hp: enemy.hp })),
      stats: { ...state.stats }, relics: { ...state.relics, collected: [...state.relics.collected] },
      fps,
    };
  }

  window.__MOSSLIGHT_PLAYTEST__ = {
    version: '0.5.0',
    title: 'Sylvaria',
    roomCount: content.rooms.length,
    roomTitles: content.rooms.map((room) => room.title),
    snapshot,
    setRoom(index, depth = Number(index) + 1) {
      state.mode = 'playing'; state.worldDepth = Math.max(1, Number(depth) || 1);
      state.sectorIndex = clamp(Number(index) || 0, 0, content.rooms.length - 1);
      hideScreens(); setupRoom(state.sectorIndex); return snapshot();
    },
    completeRoom: completeRoomForTest,
    firePortal() { firePortalCharge(); return snapshot(); },
    openPortal: forceOpenPortalForTest,
    advance() { if (!state.portal.open) forceOpenPortalForTest(); advanceWorld(); return snapshot(); },
    defeatBoss() { if (state.boss && !state.boss.dead) defeatBoss(); return snapshot(); },
    collectPowerup() { if (state.room?.powerup && !state.room.powerup.collected) applyRelic(state.room.powerup); return snapshot(); },
  };

  syncBindingButtons();
  syncBestCard();
  setupRoom(0);
  showScreen('title');

  function frame(now) {
    const rawDt = Math.max(0, (now - last) / 1000);
    last = now;
    let remaining = Math.min(rawDt, .15);
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 60);
      if (introTimer > 0 && state.mode === 'playing') introTimer = Math.max(0, introTimer - dt);
      update(dt);
      remaining -= dt;
    }
    fpsFrames += 1;
    if (now - fpsWindow >= 500) {
      fps = fps * .45 + (fpsFrames * 1000 / (now - fpsWindow)) * .55;
      fpsFrames = 0; fpsWindow = now;
    }
    draw(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
