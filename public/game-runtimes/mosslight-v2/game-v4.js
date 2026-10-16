(() => {
  'use strict';

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const ATLAS_LENGTH = 1000;
  const SETTINGS_KEY = 'sid.mosslight.settings.v4';
  const BEST_KEY = 'sid.mosslight.best.v4';
  const canvas = document.getElementById('c');
  const ctx = canvas?.getContext('2d');
  const content = window.MosslightContent;
  if (!canvas || !ctx || !content?.rooms?.length) return;

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const lerp = (a, b, t) => a + (b - a) * t;
  const normKey = (key) => String(key || '').toLowerCase();
  const hexAlpha = (hex, alpha) => {
    if (!hex?.startsWith('#')) return hex || `rgba(255,255,255,${alpha})`;
    let raw = hex.slice(1);
    if (raw.length === 3) raw = raw.split('').map((x) => x + x).join('');
    const n = Number.parseInt(raw, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  };
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

  const ABILITIES = {
    rain:   { name: 'Rain',   icon: '◌', color: '#6bdcff', speed: 660, radius: 7, cooldown: .155, damage: 1.0 },
    sun:    { name: 'Sun',    icon: '✦', color: '#ffd66b', speed: 760, radius: 7, cooldown: .145, damage: 1.15 },
    seed:   { name: 'Seed',   icon: '⌁', color: '#7bf19d', speed: 590, radius: 8, cooldown: .165, damage: 1.0 },
    wind:   { name: 'Wind',   icon: '≈', color: '#c8f7ed', speed: 635, radius: 10, cooldown: .13, damage: .85 },
    mend:   { name: 'Mend',   icon: '◇', color: '#ff8ebc', speed: 570, radius: 8, cooldown: .17, damage: .9 },
    gather: { name: 'Gather', icon: '●', color: '#ffb66e', speed: 680, radius: 7, cooldown: .15, damage: 1.05 },
  };
  const ABILITY_IDS = Object.keys(ABILITIES);

  const DEFAULT_BINDINGS = {
    moveUp: 'w', moveDown: 's', moveLeft: 'a', moveRight: 'd',
    aimUp: 'arrowup', aimDown: 'arrowdown', aimLeft: 'arrowleft', aimRight: 'arrowright',
    cast: ' ', dash: 'shift', portal: 'enter', cyclePrev: 'q', cycleNext: 'e', pause: 'p',
  };
  const BIND_LABELS = {
    moveUp: 'move up', moveDown: 'move down', moveLeft: 'move left', moveRight: 'move right',
    aimUp: 'aim up', aimDown: 'aim down', aimLeft: 'aim left', aimRight: 'aim right',
    cast: 'cast / fire', dash: 'dash', portal: 'enter portal', cyclePrev: 'previous resonance', cycleNext: 'next resonance', pause: 'pause',
  };
  const DEFAULT_SETTINGS = {
    music: true,
    sfx: true,
    volume: .68,
    reducedMotion: false,
    aimAssist: true,
    bindings: { ...DEFAULT_BINDINGS },
  };

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings || {}) },
        };
      }
    } catch {}
    return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function loadBest() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return { world: 0, score: 0, time: 0, atlasClears: 0 };
  }

  function saveBest() {
    const next = loadBest();
    next.world = Math.max(next.world || 0, state.worldsCleared);
    next.score = Math.max(next.score || 0, Math.round(state.score));
    next.time = next.world <= state.worldsCleared ? state.totalTime : next.time;
    next.atlasClears = Math.max(next.atlasClears || 0, state.atlasClears);
    try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch {}
    syncBestCard();
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
    projectiles: [], particles: [], sweeps: [],
    enemies: [], boss: null,
    totalTime: 0, roomTime: 0,
    shootCd: 0, dashCd: 0, dashTime: 0, hitCd: 0,
    integrity: 3, maxIntegrity: 3,
    chain: 0, bestChain: 0, chainTimer: 0,
    score: 0,
    stones: 0, lifetimeStones: 0, stoneQuota: 0,
    portal: { open: false, x: 894, y: H / 2, r: 34, pulse: 0 },
    situationClock: 3.8,
    roomStats: [],
    stats: { casts: 0, correct: 0, wasted: 0, hits: 0, dashes: 0, kills: 0, bosses: 0, stones: 0 },
    relics: freshRelics(),
  };

  function freshRelics() {
    return { fireRate: 1, projectileScale: 1, spread: 1, pierce: 0, moveSpeed: 1, dashRecharge: 1, shield: 0, shieldCharges: 0, collected: [] };
  }

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
        step: 0,
        done: false,
        stoneAwarded: false,
        vx: target.vx || 0,
        vy: target.vy || 0,
        baseX: target.baseX ?? target.x,
        baseY: target.baseY ?? target.y,
      })),
      obstacles: (source.obstacles || []).map((obstacle) => ({ ...obstacle, motion: obstacle.motion ? { ...obstacle.motion } : null, baseX: obstacle.baseX ?? obstacle.x, baseY: obstacle.baseY ?? obstacle.y })),
      hazards: (source.hazards || []).map((hazard) => ({ ...hazard, baseX: hazard.baseX ?? hazard.x, baseY: hazard.baseY ?? hazard.y, phase: hazard.phase || 0 })),
      encounters: (source.encounters || []).map((encounter) => ({ ...encounter })),
      powerup: source.powerup ? { ...source.powerup, apply: { ...(source.powerup.apply || {}) }, collected: false } : null,
    };
  }

  function globalPressure() {
    const d = Math.max(1, state.worldDepth);
    return clamp(.9 + Math.log2(d + 1) * .085 + Math.min(.45, d / 2200), .9, 2.18);
  }

  function enemyBudget() {
    const depth = state.worldDepth;
    const base = state.room?.encounters?.length || 0;
    return clamp(base + Math.floor((depth - 1) / 35), depth < 3 ? 0 : 1, 8);
  }

  function isBossWorld() {
    return state.worldDepth % 10 === 0;
  }

  function targetExpected(target) {
    if (!target || target.done) return null;
    if (target.kind === 'cloud' && target.step === 0) return 'wind';
    if (target.kind === 'sluice') return 'rain';
    return target.sequence[target.step] || null;
  }

  function roomSolved() {
    return Boolean(state.room?.targets?.length) && state.room.targets.every((target) => target.done);
  }

  function bossDefeated() {
    return !state.boss || state.boss.dead;
  }

  function canOpenPortal() {
    return roomSolved() && bossDefeated() && state.stones >= state.stoneQuota;
  }

  function deriveStoneQuota(room) {
    return Math.max(1, room.targets.length + (isBossWorld() ? 2 : 0));
  }

  function resetPlayer() {
    state.player = { x: 86, y: H / 2, vx: 0, vy: 0, r: 14, facing: 0, walk: 0 };
  }

  function currentAtlasIndex() {
    return state.room?.atlas?.index || (((state.worldDepth - 1) % ATLAS_LENGTH) + 1);
  }

  function roomLabel() {
    const cycle = Math.floor((state.worldDepth - 1) / ATLAS_LENGTH);
    return cycle === 0 ? `world ${String(currentAtlasIndex()).padStart(3, '0')} / 1000` : `deep loop ${cycle} · world ${String(currentAtlasIndex()).padStart(3, '0')}`;
  }

  function setupRoom(index) {
    state.sectorIndex = index;
    state.room = deepCloneRoom(content.rooms[index]);
    state.roomTime = 0;
    state.projectiles.length = 0;
    state.particles.length = 0;
    state.sweeps.length = 0;
    state.chain = 0;
    state.chainTimer = 0;
    state.shootCd = 0;
    state.dashCd = 0;
    state.dashTime = 0;
    state.hitCd = 0;
    state.stones = 0;
    state.portal.open = false;
    state.portal.pulse = 0;
    state.situationClock = clamp(5.2 - Math.log2(state.worldDepth + 1) * .25, 2.3, 5.2);
    resetPlayer();
    updateMovingObstacleBases();
    spawnEnemies();
    spawnBoss();
    state.stoneQuota = deriveStoneQuota(state.room);
    const first = nextUsefulAbility();
    if (first) state.selected = first;
    introTimer = 2.3;
    syncHud(true);
    music.setWorld(state.room, state.worldDepth, Boolean(state.boss));
  }

  function updateMovingObstacleBases() {
    for (const obstacle of state.room.obstacles) {
      obstacle.baseX ??= obstacle.x;
      obstacle.baseY ??= obstacle.y;
    }
  }

  function spawnEnemies() {
    state.enemies = [];
    const rng = rngFrom(hash(`${state.room.id}:${state.worldDepth}:encounters`));
    const patterns = ['patrol', 'weave', 'orbit', 'swoop', 'stalk', 'dash', 'spiral'];
    const wildlife = state.room.atlas?.wildlife || ['moth', 'fox', 'wisp'];
    const source = state.room.encounters || [];
    const count = enemyBudget();
    for (let i = 0; i < count; i += 1) {
      const seeded = source[i % Math.max(1, source.length)] || {};
      const edge = i % 4;
      const x = seeded.x ?? (edge === 0 ? 180 : edge === 2 ? 790 : 220 + rng() * 540);
      const y = seeded.y ?? (edge === 1 ? 145 : edge === 3 ? 500 : 145 + rng() * 350);
      const hp = clamp(2 + Math.floor(Math.log2(state.worldDepth + 1) / 2), 2, 7);
      state.enemies.push({
        id: `${state.room.id}-hostile-${i}`,
        species: seeded.species || wildlife[i % wildlife.length],
        pattern: seeded.pattern || patterns[(hash(state.room.id) + i * 5 + state.worldDepth) % patterns.length],
        x, y, baseX: x, baseY: y,
        vx: 0, vy: 0,
        r: 13 + Math.min(4, hp * .5),
        hp, maxHp: hp,
        phase: seeded.phase ?? rng() * TAU,
        heading: seeded.heading ?? rng() * TAU,
        speed: (54 + rng() * 22) * globalPressure(),
        range: 64 + rng() * 100,
        dashClock: 1.2 + rng() * 2.2,
        telegraph: 0,
        dead: false,
      });
    }
  }

  function bossName() {
    const situation = state.room.challenge?.situation?.id || 'migration-path';
    const names = {
      'living-corridor': 'Rootwarden',
      'tidal-lanes': 'Tideglass Ray',
      'heat-crossing': 'Cinder Hart',
      'alpine-switchback': 'Frosthorn',
      'orbital-dance': 'Astral Moth',
      'weather-window': 'Storm Heron',
      'migration-path': 'Wayfinder Stag',
      'earthheart-convergence': 'Atlas Warden',
    };
    return names[situation] || 'Atlas Warden';
  }

  function spawnBoss() {
    state.boss = null;
    if (!isBossWorld()) return;
    const phasePattern = state.room.challenge?.situation?.id || 'orbital-dance';
    const hp = clamp(16 + Math.floor(state.worldDepth / 30) * 2, 16, 52);
    state.boss = {
      name: bossName(), pattern: phasePattern,
      x: 725, y: H / 2, baseX: 725, baseY: H / 2,
      r: 31, hp, maxHp: hp, phase: 0, clock: 1.6,
      telegraph: 0, dead: false,
    };
  }

  function beginRun(mode = 'run') {
    state.mode = 'playing';
    state.runMode = mode;
    state.sectorIndex = 0;
    state.worldDepth = 1;
    state.worldsCleared = 0;
    state.atlasClears = 0;
    state.totalTime = 0;
    state.score = 0;
    state.integrity = mode === 'explore' ? 5 : 3;
    state.maxIntegrity = state.integrity;
    state.lifetimeStones = 0;
    state.bestChain = 0;
    state.stats = { casts: 0, correct: 0, wasted: 0, hits: 0, dashes: 0, kills: 0, bosses: 0, stones: 0 };
    state.roomStats = [];
    state.relics = freshRelics();
    hideScreens();
    setupRoom(0);
    music.start();
    canvas.focus();
  }

  function endRun(reason = 'stability lost') {
    if (state.runMode === 'explore') {
      state.integrity = state.maxIntegrity;
      state.player.x = 86;
      state.player.y = H / 2;
      toast('explorer recovery · keep moving', 1100);
      return;
    }
    state.mode = 'gameover';
    saveBest();
    music.setBoss(false);
    const title = $('gameOverTitle');
    const summary = $('gameOverSummary');
    if (title) title.textContent = reason;
    if (summary) summary.textContent = `${state.worldsCleared} worlds · ${Math.round(state.score).toLocaleString()} points · ${formatTime(state.totalTime)}`;
    $('gameOver')?.classList.remove('hidden');
  }

  function atlasMilestone() {
    state.atlasClears += 1;
    saveBest();
    const card = $('atlasMilestone');
    const copy = $('atlasMilestoneCopy');
    if (copy) copy.textContent = `You crossed all ${ATLAS_LENGTH.toLocaleString()} Atlas worlds in one run. The portal network loops deeper from here; difficulty continues climbing.`;
    card?.classList.remove('hidden');
    window.setTimeout(() => card?.classList.add('hidden'), 5200);
    state.score += 100000;
    music.chime('atlas');
  }

  function advanceWorld() {
    if (!state.portal.open) return;
    const speedBonus = Math.max(0, 2200 - state.roomTime * 24);
    state.score += speedBonus;
    state.roomStats.push({ world: state.worldDepth, atlas: currentAtlasIndex(), time: state.roomTime, score: state.score, hits: state.stats.hits });
    state.worldsCleared += 1;
    if (state.worldsCleared > 0 && state.worldsCleared % ATLAS_LENGTH === 0) atlasMilestone();
    state.worldDepth += 1;
    state.sectorIndex += 1;
    music.chime('portal');
    if (state.sectorIndex >= content.rooms.length) {
      window.MosslightExpedition?.newRun?.();
      window.MosslightDirector?.refresh?.();
      state.sectorIndex = 0;
    }
    setupRoom(state.sectorIndex);
  }

  function openPortalIfReady() {
    if (!state.portal.open && canOpenPortal()) {
      state.portal.open = true;
      state.score += Math.max(250, 850 - state.roomTime * 4);
      burst(state.portal.x, state.portal.y, '#aef9cd', 34, 190);
      toast('portal charged · commit east', 1300);
      music.chime('stone');
    }
  }

  function awardStone(x, y, source = 'puzzle') {
    state.stones += 1;
    state.lifetimeStones += 1;
    state.stats.stones += 1;
    state.score += source === 'boss' ? 600 : 260 + state.chain * 18;
    burst(x, y, '#a9ffd1', source === 'boss' ? 24 : 14, source === 'boss' ? 180 : 115);
    music.chime('stone');
    openPortalIfReady();
  }

  function awardBossStones() {
    awardStone(state.boss.x - 12, state.boss.y, 'boss');
    awardStone(state.boss.x + 12, state.boss.y, 'boss');
  }

  function nextUsefulAbility() {
    const target = nearestTarget();
    return target ? targetExpected(target) : state.room?.unlock?.[0] || 'rain';
  }

  function nearestTarget() {
    if (!state.player || !state.room) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const target of state.room.targets) {
      if (target.done) continue;
      const d = dist(state.player.x, state.player.y, target.x, target.y);
      if (d < bestDistance) { best = target; bestDistance = d; }
    }
    return best;
  }

  function unlockedAbilities() {
    return ABILITY_IDS.filter((id) => state.room?.unlock?.includes(id));
  }

  function selectAbility(id, announce = true) {
    if (!ABILITIES[id] || !state.room?.unlock?.includes(id)) return;
    state.selected = id;
    document.querySelectorAll('.ability').forEach((button) => button.classList.toggle('active', button.dataset.a === id));
    if (announce) toast(`${ABILITIES[id].icon} ${ABILITIES[id].name} resonance`, 420);
  }

  function cycleAbility(direction) {
    const unlocked = unlockedAbilities();
    if (!unlocked.length) return;
    const current = Math.max(0, unlocked.indexOf(state.selected));
    selectAbility(unlocked[(current + direction + unlocked.length) % unlocked.length]);
  }

  function aimVector() {
    const b = settings.bindings;
    const ax = (keys.has(b.aimRight) ? 1 : 0) - (keys.has(b.aimLeft) ? 1 : 0);
    const ay = (keys.has(b.aimDown) ? 1 : 0) - (keys.has(b.aimUp) ? 1 : 0);
    if (ax || ay) {
      aimSource = 'keyboard';
      const length = Math.hypot(ax, ay) || 1;
      state.lastAim = { x: ax / length, y: ay / length };
      return state.lastAim;
    }
    if (aimSource === 'mouse' && pointer.seen && state.player) {
      const dx = pointer.x - state.player.x;
      const dy = pointer.y - state.player.y;
      const length = Math.hypot(dx, dy) || 1;
      state.lastAim = { x: dx / length, y: dy / length };
    }
    return state.lastAim;
  }

  function assistedAim(vector) {
    if (!settings.aimAssist || state.runMode === 'flow') return vector;
    const target = nearestTarget();
    if (!target || !state.player) return vector;
    const tx = target.x - state.player.x;
    const ty = target.y - state.player.y;
    const length = Math.hypot(tx, ty) || 1;
    const nx = tx / length;
    const ny = ty / length;
    const dot = nx * vector.x + ny * vector.y;
    if (dot < .79) return vector;
    const blend = .34;
    const bx = lerp(vector.x, nx, blend);
    const by = lerp(vector.y, ny, blend);
    const bl = Math.hypot(bx, by) || 1;
    return { x: bx / bl, y: by / bl };
  }

  function fire() {
    if (state.mode !== 'playing' || state.shootCd > 0) return;
    const spec = ABILITIES[state.selected];
    if (!spec) return;
    const base = assistedAim(aimVector());
    const spread = state.relics.spread > 1 ? [-.14, 0, .14] : [0];
    const angles = spread.slice(0, state.relics.spread > 1 ? 3 : 1);
    for (const offset of angles) {
      const angle = Math.atan2(base.y, base.x) + offset;
      const vx = Math.cos(angle) * spec.speed;
      const vy = Math.sin(angle) * spec.speed;
      state.projectiles.push({
        x: state.player.x + Math.cos(angle) * 20,
        y: state.player.y + Math.sin(angle) * 20,
        vx, vy,
        r: spec.radius * state.relics.projectileScale,
        ability: state.selected,
        damage: spec.damage,
        life: 1.55,
        pierce: state.relics.pierce,
      });
    }
    state.shootCd = spec.cooldown / state.relics.fireRate;
    state.stats.casts += 1;
    state.player.facing = Math.atan2(base.y, base.x);
    music.sfx('shot', spec.color);
  }

  function tryDash() {
    if (state.mode !== 'playing' || state.dashCd > 0) return;
    const b = settings.bindings;
    let dx = (keys.has(b.moveRight) ? 1 : 0) - (keys.has(b.moveLeft) ? 1 : 0);
    let dy = (keys.has(b.moveDown) ? 1 : 0) - (keys.has(b.moveUp) ? 1 : 0);
    if (!dx && !dy) { const aim = aimVector(); dx = aim.x; dy = aim.y; }
    const length = Math.hypot(dx, dy) || 1;
    state.player.vx += dx / length * 390;
    state.player.vy += dy / length * 390;
    state.dashTime = .18;
    state.dashCd = 1.15 / state.relics.dashRecharge;
    state.stats.dashes += 1;
    music.sfx('dash');
  }

  function circleRect(x, y, r, obstacle) {
    const cx = clamp(x, obstacle.x, obstacle.x + obstacle.w);
    const cy = clamp(y, obstacle.y, obstacle.y + obstacle.h);
    return dist(x, y, cx, cy) < r;
  }

  function updatePlayer(dt) {
    if (!state.player) return;
    const b = settings.bindings;
    let dx = (keys.has(b.moveRight) ? 1 : 0) - (keys.has(b.moveLeft) ? 1 : 0);
    let dy = (keys.has(b.moveDown) ? 1 : 0) - (keys.has(b.moveUp) ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    if (dx || dy) { dx /= length; dy /= length; }
    const speed = 205 * state.relics.moveSpeed * (state.dashTime > 0 ? 1.85 : 1);
    const responsiveness = state.dashTime > 0 ? 10 : 15;
    state.player.vx = lerp(state.player.vx, dx * speed, clamp(dt * responsiveness, 0, 1));
    state.player.vy = lerp(state.player.vy, dy * speed, clamp(dt * responsiveness, 0, 1));
    const ox = state.player.x;
    const oy = state.player.y;
    state.player.x += state.player.vx * dt;
    for (const obstacle of state.room.obstacles) {
      if (circleRect(state.player.x, state.player.y, state.player.r + 3, obstacle)) { state.player.x = ox; state.player.vx *= -.18; break; }
    }
    state.player.y += state.player.vy * dt;
    for (const obstacle of state.room.obstacles) {
      if (circleRect(state.player.x, state.player.y, state.player.r + 3, obstacle)) { state.player.y = oy; state.player.vy *= -.18; break; }
    }
    state.player.x = clamp(state.player.x, 35, W - 35);
    state.player.y = clamp(state.player.y, 84, H - 64);
    state.player.walk += Math.hypot(state.player.vx, state.player.vy) * dt * .025;
    const aim = aimVector();
    state.player.facing = Math.atan2(aim.y, aim.x);
    if (state.portal.open && dist(state.player.x, state.player.y, state.portal.x, state.portal.y) < state.portal.r + state.player.r + 5) advanceWorld();
  }

  function updateObstacles(dt) {
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
      if (state.player && circleRect(state.player.x, state.player.y, state.player.r + 2, obstacle)) hurtPlayer('moving terrain');
    }
  }

  function updateTargets(dt) {
    const t = state.roomTime;
    for (const target of state.room.targets) {
      if (target.done) continue;
      if (target.kind === 'animal') {
        const pattern = target.movementPattern || 'prowl';
        const range = target.moveRange || target.wander || 22;
        const speed = target.moveSpeed || .9;
        const phase = target.movePhase || 0;
        if (pattern === 'swoop') {
          target.x = target.baseX + Math.sin(t * speed + phase) * range;
          target.y = target.baseY + Math.sin(t * speed * 2.2 + phase) * range * .42;
        } else if (pattern === 'flee') {
          const d = dist(target.baseX, target.baseY, state.player.x, state.player.y);
          const fear = clamp((150 - d) / 150, 0, 1);
          const dx = target.baseX - state.player.x;
          const dy = target.baseY - state.player.y;
          const l = Math.hypot(dx, dy) || 1;
          target.x = target.baseX + dx / l * range * fear;
          target.y = target.baseY + dy / l * range * fear;
        } else if (pattern === 'hop') {
          target.x = target.baseX + Math.sin(t * speed + phase) * range;
          target.y = target.baseY - Math.max(0, Math.sin(t * speed * 2.7 + phase)) * range * .55;
        } else if (pattern === 'orbit') {
          target.x = target.baseX + Math.cos(t * speed + phase) * range;
          target.y = target.baseY + Math.sin(t * speed + phase) * range * .72;
        } else {
          target.x = target.baseX + Math.sin(t * speed + phase) * range;
          target.y = target.baseY + Math.sin(t * speed * .63 + phase) * range * .3;
        }
      }
      if (target.kind === 'cloud') {
        target.x += target.vx * dt;
        target.y += target.vy * dt;
        target.vx *= Math.pow(.9, dt * 60);
        target.vy *= Math.pow(.9, dt * 60);
        target.x = clamp(target.x, 130, 835);
        target.y = clamp(target.y, 120, 505);
      }
    }
  }

  function updateEnemies(dt) {
    const t = state.roomTime;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const speed = enemy.speed;
      if (enemy.pattern === 'patrol') {
        enemy.x = enemy.baseX + Math.sin(t * speed * .011 + enemy.phase) * enemy.range;
      } else if (enemy.pattern === 'weave' || enemy.pattern === 'swoop') {
        enemy.heading += dt * (enemy.pattern === 'swoop' ? .42 : .18);
        enemy.x += Math.cos(enemy.heading) * speed * dt;
        enemy.y += Math.sin(enemy.heading) * speed * dt + Math.sin(t * (enemy.pattern === 'swoop' ? 4.2 : 2.2) + enemy.phase) * 22 * dt;
      } else if (enemy.pattern === 'orbit') {
        const radius = enemy.range;
        enemy.x = W * .55 + Math.cos(t * speed * .009 + enemy.phase) * radius;
        enemy.y = H * .5 + Math.sin(t * speed * .009 + enemy.phase) * radius * .7;
      } else if (enemy.pattern === 'spiral') {
        const radius = 42 + (Math.sin(t * .7 + enemy.phase) + 1) * enemy.range * .45;
        enemy.x = W * .55 + Math.cos(t * 1.2 + enemy.phase) * radius;
        enemy.y = H * .5 + Math.sin(t * 1.2 + enemy.phase) * radius * .68;
      } else if (enemy.pattern === 'stalk') {
        const dx = state.player.x - enemy.x;
        const dy = state.player.y - enemy.y;
        const l = Math.hypot(dx, dy) || 1;
        enemy.x += dx / l * speed * .62 * dt;
        enemy.y += dy / l * speed * .62 * dt;
      } else if (enemy.pattern === 'dash') {
        enemy.dashClock -= dt;
        if (enemy.telegraph > 0) {
          enemy.telegraph -= dt;
          if (enemy.telegraph <= 0) {
            const dx = state.player.x - enemy.x;
            const dy = state.player.y - enemy.y;
            const l = Math.hypot(dx, dy) || 1;
            enemy.vx = dx / l * speed * 3.3;
            enemy.vy = dy / l * speed * 3.3;
          }
        } else if (enemy.dashClock <= 0) {
          enemy.telegraph = .72;
          enemy.dashClock = clamp(3.2 - Math.log2(state.worldDepth + 1) * .14, 1.45, 3.2);
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.vx *= Math.pow(.91, dt * 60);
        enemy.vy *= Math.pow(.91, dt * 60);
      }
      if (enemy.x < 45 || enemy.x > W - 45) enemy.heading = Math.PI - enemy.heading;
      if (enemy.y < 90 || enemy.y > H - 55) enemy.heading = -enemy.heading;
      enemy.x = clamp(enemy.x, 45, W - 45);
      enemy.y = clamp(enemy.y, 92, H - 58);
      if (dist(enemy.x, enemy.y, state.player.x, state.player.y) < enemy.r + state.player.r + 3) hurtPlayer(enemy.species || 'wildlife pressure');
    }
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss || boss.dead) return;
    boss.phase += dt;
    boss.clock -= dt;
    const pressure = globalPressure();
    const situation = boss.pattern;
    if (situation === 'orbital-dance' || situation === 'earthheart-convergence') {
      boss.x = 680 + Math.cos(boss.phase * .78) * 110;
      boss.y = H * .5 + Math.sin(boss.phase * 1.08) * 135;
    } else if (situation === 'living-corridor') {
      boss.x = 700 + Math.sin(boss.phase * .7) * 120;
      boss.y = H * .5 + Math.sin(boss.phase * 1.4) * 105;
    } else if (situation === 'tidal-lanes' || situation === 'weather-window') {
      boss.x = 720 + Math.sin(boss.phase * 1.1) * 95;
      boss.y = 175 + ((boss.phase * 105 * pressure) % 300);
    } else {
      boss.x = 705 + Math.sin(boss.phase * .9) * 125;
      boss.y = H * .5 + Math.sin(boss.phase * 1.7) * 120;
    }
    if (boss.clock <= 0) {
      spawnBossPattern();
      boss.clock = clamp(2.8 - Math.log2(state.worldDepth + 1) * .11, 1.15, 2.8);
    }
    if (dist(boss.x, boss.y, state.player.x, state.player.y) < boss.r + state.player.r + 4) hurtPlayer(boss.name);
  }

  function spawnBossPattern() {
    const boss = state.boss;
    if (!boss) return;
    const count = clamp(3 + Math.floor(state.worldDepth / 80), 3, 8);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + boss.phase * .35;
      state.sweeps.push({
        kind: 'orb', x: boss.x, y: boss.y,
        vx: Math.cos(angle) * (100 + globalPressure() * 42),
        vy: Math.sin(angle) * (100 + globalPressure() * 42),
        r: 9, life: 4.5, telegraph: .3,
        color: state.room.palette?.accent || '#9bf0b8',
      });
    }
    music.sfx('boss');
  }

  function spawnSituationSweep() {
    const situation = state.room.challenge?.situation?.id || 'migration-path';
    const pressure = globalPressure();
    if (situation === 'living-corridor') return;
    const horizontal = ['tidal-lanes', 'heat-crossing', 'weather-window'].includes(situation);
    const fromPositive = hash(`${state.room.id}:${Math.floor(state.roomTime)}`) % 2 === 0;
    if (horizontal) {
      state.sweeps.push({
        kind: 'lane', axis: 'x', x: fromPositive ? W + 80 : -80, y: 145 + (hash(state.room.id) % 300),
        vx: (fromPositive ? -1 : 1) * (135 + pressure * 48), vy: 0, r: 22, span: 120,
        life: 8, telegraph: state.runMode === 'flow' ? .58 : .9, color: state.room.palette?.water || '#6bdcff',
      });
    } else {
      state.sweeps.push({
        kind: 'lane', axis: 'y', x: 220 + (hash(`${state.room.id}:x`) % 520), y: fromPositive ? H + 80 : -80,
        vx: 0, vy: (fromPositive ? -1 : 1) * (125 + pressure * 44), r: 22, span: 115,
        life: 8, telegraph: state.runMode === 'flow' ? .58 : .9, color: state.room.palette?.accent || '#9bf0b8',
      });
    }
  }

  function updateSweeps(dt) {
    for (const sweep of state.sweeps) {
      sweep.life -= dt;
      if (sweep.telegraph > 0) { sweep.telegraph -= dt; continue; }
      sweep.x += sweep.vx * dt;
      sweep.y += sweep.vy * dt;
      const hitRadius = sweep.kind === 'lane' ? sweep.r + 5 : sweep.r;
      if (dist(sweep.x, sweep.y, state.player.x, state.player.y) < hitRadius + state.player.r) hurtPlayer('arena pulse');
    }
    state.sweeps = state.sweeps.filter((sweep) => sweep.life > 0);
  }

  function updateSituation(dt) {
    if (state.worldDepth < 4) return;
    state.situationClock -= dt;
    if (state.situationClock <= 0) {
      spawnSituationSweep();
      state.situationClock = clamp(5.4 - Math.log2(state.worldDepth + 1) * .28, 2.25, 5.4);
    }
  }

  function updateHazards(dt) {
    for (const hazard of state.room.hazards) {
      const scale = clamp(globalPressure(), .9, 1.8);
      hazard.x += (hazard.vx || 0) * dt * scale;
      hazard.y += (hazard.vy || 0) * dt * scale;
      if (hazard.x < 80 || hazard.x > W - 50) hazard.vx *= -1;
      if (hazard.y < 100 || hazard.y > H - 55) hazard.vy *= -1;
      if (dist(hazard.x, hazard.y, state.player.x, state.player.y) < (hazard.r || 18) + state.player.r) hurtPlayer(hazard.type || 'stress front');
    }
  }

  function updateProjectiles(dt) {
    for (const shot of state.projectiles) {
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.x < -30 || shot.x > W + 30 || shot.y < 50 || shot.y > H + 30) shot.life = 0;
      if (shot.life <= 0) continue;
      let consumed = false;
      for (const obstacle of state.room.obstacles) {
        if (circleRect(shot.x, shot.y, shot.r, obstacle)) { consumed = true; break; }
      }
      if (consumed) { shot.life = 0; continue; }
      for (const target of state.room.targets) {
        if (target.done || consumed) continue;
        if (dist(shot.x, shot.y, target.x, target.y) < shot.r + (target.r || 23)) {
          resolvePuzzleHit(target, shot);
          consumed = shot.pierce <= 0;
          if (shot.pierce > 0) shot.pierce -= 1;
        }
      }
      for (const enemy of state.enemies) {
        if (enemy.dead || consumed) continue;
        if (dist(shot.x, shot.y, enemy.x, enemy.y) < shot.r + enemy.r) {
          enemy.hp -= shot.damage;
          burst(enemy.x, enemy.y, ABILITIES[shot.ability].color, 5, 70);
          if (shot.ability === 'wind') {
            const l = Math.hypot(shot.vx, shot.vy) || 1;
            enemy.x += shot.vx / l * 14;
            enemy.y += shot.vy / l * 14;
          }
          if (enemy.hp <= 0) defeatEnemy(enemy);
          consumed = shot.pierce <= 0;
          if (shot.pierce > 0) shot.pierce -= 1;
        }
      }
      const boss = state.boss;
      if (boss && !boss.dead && !consumed && dist(shot.x, shot.y, boss.x, boss.y) < shot.r + boss.r) {
        boss.hp -= shot.damage;
        burst(shot.x, shot.y, ABILITIES[shot.ability].color, 7, 80);
        if (boss.hp <= 0) defeatBoss();
        consumed = true;
      }
      if (consumed) shot.life = 0;
    }
    state.projectiles = state.projectiles.filter((shot) => shot.life > 0);
  }

  function resolvePuzzleHit(target, shot) {
    const expected = targetExpected(target);
    if (!expected) return;
    if (target.kind === 'cloud' && expected === 'wind') {
      if (shot.ability !== 'wind') return wrongPuzzle(target);
      const length = Math.hypot(shot.vx, shot.vy) || 1;
      target.vx += shot.vx / length * 145;
      target.vy += shot.vy / length * 145;
      if (target.zone && dist(target.x, target.y, target.zone.x, target.zone.y) < target.zone.r) {
        target.step = 1;
        state.stats.correct += 1;
        state.chain += 1;
      } else {
        toast('push the cloud into its basin', 520);
      }
      return;
    }
    if (target.kind === 'sluice') {
      if (shot.ability !== 'rain') return wrongPuzzle(target);
      target.orientation = ((target.orientation || 0) + 1) % 4;
      state.stats.correct += 1;
      state.chain += 1;
      if (target.orientation === target.goal) completeTarget(target);
      return;
    }
    if (shot.ability !== expected) return wrongPuzzle(target);
    target.step += 1;
    state.stats.correct += 1;
    state.chain += 1;
    state.chainTimer = 3.1;
    state.bestChain = Math.max(state.bestChain, state.chain);
    state.score += 70 + state.chain * 9;
    music.sfx('correct');
    if (target.step >= target.sequence.length) completeTarget(target);
  }

  function wrongPuzzle(target) {
    state.stats.wasted += 1;
    state.chain = 0;
    state.chainTimer = 0;
    toast(`${target.label || 'node'} needs ${ABILITIES[targetExpected(target)]?.name || 'another resonance'}`, 540);
    music.sfx('wrong');
  }

  function completeTarget(target) {
    if (target.done) return;
    target.done = true;
    target.step = target.sequence.length;
    state.score += Math.max(120, 520 - state.roomTime * 3);
    if (!target.stoneAwarded) {
      target.stoneAwarded = true;
      awardStone(target.x, target.y, 'puzzle');
    }
    toast(`Mossglint formed · ${state.stones}/${state.stoneQuota}`, 720);
    openPortalIfReady();
  }

  function defeatEnemy(enemy) {
    enemy.dead = true;
    state.stats.kills += 1;
    state.score += 110 + Math.min(240, state.worldDepth * 2);
    burst(enemy.x, enemy.y, state.room.palette?.accent || '#9bf0b8', 15, 135);
    music.sfx('enemy');
  }

  function applyRelic(relic) {
    if (!relic) return;
    state.relics.collected.push(relic.id);
    for (const [key, value] of Object.entries(relic.apply || {})) {
      if (key === 'spread') state.relics.spread = Math.max(state.relics.spread, value);
      else if (key === 'pierce') state.relics.pierce = Math.min(3, state.relics.pierce + value);
      else if (key === 'shield') {
        state.relics.shield = Math.min(3, state.relics.shield + value);
        state.relics.shieldCharges = Math.min(3, state.relics.shieldCharges + 1);
      } else if (typeof state.relics[key] === 'number') {
        state.relics[key] = clamp(state.relics[key] * Number(value), .5, key === 'projectileScale' ? 2.7 : 2.45);
      }
    }
    toast(`${relic.icon || '✦'} ${relic.name} acquired`, 1200);
  }

  function defeatBoss() {
    if (!state.boss || state.boss.dead) return;
    state.boss.dead = true;
    state.stats.bosses += 1;
    state.score += 2200 + state.worldDepth * 18;
    awardBossStones();
    const catalog = window.MosslightDirector?.powerups || [];
    if (catalog.length) {
      const relic = catalog[hash(`${state.room.id}:${state.worldDepth}:boss`) % catalog.length];
      applyRelic(relic);
    }
    burst(state.boss.x, state.boss.y, '#d8ffe7', 54, 250);
    music.chime('boss');
    toast(`${state.boss.name} released a world gift`, 1500);
    openPortalIfReady();
  }

  function hurtPlayer(label) {
    if (state.hitCd > 0 || state.mode !== 'playing') return;
    if (state.relics.shieldCharges > 0) {
      state.relics.shieldCharges -= 1;
      state.hitCd = .75;
      toast(`Moss Ward absorbed ${label}`, 700);
      music.sfx('shield');
      return;
    }
    state.stats.hits += 1;
    state.integrity -= 1;
    state.hitCd = .95;
    state.chain = 0;
    const dx = state.player.x - W * .55;
    const dy = state.player.y - H * .5;
    const l = Math.hypot(dx, dy) || 1;
    state.player.vx += dx / l * 260;
    state.player.vy += dy / l * 260;
    burst(state.player.x, state.player.y, '#ff8b9e', 18, 150);
    music.sfx('hit');
    if (state.integrity <= 0) endRun('portal field collapsed');
  }

  function collectWorldGift() {
    const pickup = state.room.powerup;
    if (!pickup || pickup.collected || !state.player) return;
    if (dist(state.player.x, state.player.y, pickup.x, pickup.y) < state.player.r + (pickup.r || 15) + 6) {
      pickup.collected = true;
      applyRelic(pickup);
      state.score += 350;
      burst(pickup.x, pickup.y, pickup.color || '#a9ffd1', 22, 150);
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
    state.chainTimer = Math.max(0, state.chainTimer - dt);
    if (state.chainTimer <= 0) state.chain = 0;
    updateObstacles(dt);
    updatePlayer(dt);
    updateTargets(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateHazards(dt);
    updateSituation(dt);
    updateSweeps(dt);
    updateProjectiles(dt);
    collectWorldGift();
    openPortalIfReady();
    state.portal.pulse += dt;
    if (pointer.down) fire();
    music.update(state.worldDepth, Boolean(state.boss && !state.boss.dead), globalPressure());
    syncHud();
  }

  function draw(now) {
    const room = state.room || content.rooms[0];
    drawBackground(room, now);
    if (!room || !state.player) return;
    drawArenaGrid(room);
    for (const obstacle of room.obstacles) drawObstacle(obstacle, room);
    for (const target of room.targets) drawTarget(target, now);
    for (const hazard of room.hazards) drawHazard(hazard, room, now);
    for (const sweep of state.sweeps) drawSweep(sweep, now);
    for (const enemy of state.enemies) if (!enemy.dead) drawEnemy(enemy, now);
    if (state.boss && !state.boss.dead) drawBoss(state.boss, now);
    if (room.powerup && !room.powerup.collected) drawPowerup(room.powerup, now);
    for (const shot of state.projectiles) drawProjectile(shot);
    drawPortal(now);
    drawParticles(dtVisual());
    drawPlayer(now);
    drawAimReticle(now);
    if (introTimer > 0) drawIntro(now);
  }

  function drawBackground(room, now) {
    const bg = room?.palette?.bg || '#07120f';
    const floor = room?.palette?.floor || '#11271d';
    const gradient = ctx.createRadialGradient(W * .52, H * .46, 80, W * .52, H * .46, 620);
    gradient.addColorStop(0, floor);
    gradient.addColorStop(1, bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(0, 0, W, 72);
    if (!settings.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = .1;
      ctx.fillStyle = room?.palette?.accent || '#9bf0b8';
      for (let i = 0; i < 26; i += 1) {
        const x = ((i * 157 + hash(room?.id || 'moss') * .001) % W + Math.sin(now * .00012 + i) * 18) % W;
        const y = 90 + ((i * 83) % 500);
        ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .5, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawArenaGrid(room) {
    ctx.save();
    ctx.strokeStyle = hexAlpha(room.palette?.accent || '#9bf0b8', .055);
    ctx.lineWidth = 1;
    for (let x = 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 82); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 100; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }

  function drawObstacle(obstacle, room) {
    ctx.save();
    const accent = room.palette?.accent || '#9bf0b8';
    ctx.fillStyle = obstacle.kind === 'ice' ? 'rgba(150,220,245,.18)' : obstacle.kind === 'char' ? 'rgba(85,52,42,.84)' : obstacle.kind === 'glass' ? 'rgba(200,240,242,.12)' : 'rgba(50,73,61,.84)';
    ctx.strokeStyle = hexAlpha(accent, obstacle.motion ? .38 : .18);
    ctx.lineWidth = obstacle.motion ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 8); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawTarget(target, now) {
    if (target.done) return;
    const need = targetExpected(target);
    const spec = ABILITIES[need] || ABILITIES.rain;
    ctx.save();
    if (target.zone) {
      ctx.strokeStyle = hexAlpha(spec.color, .35);
      ctx.setLineDash([6, 7]);
      ctx.beginPath(); ctx.arc(target.zone.x, target.zone.y, target.zone.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.translate(target.x, target.y);
    ctx.fillStyle = 'rgba(5,12,10,.82)';
    ctx.strokeStyle = hexAlpha(spec.color, .78);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, (target.r || 23) + Math.sin(now * .004 + hash(target.id)) * 1.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = spec.color;
    ctx.font = '600 17px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(spec.icon, 0, 0);
    ctx.restore();
  }

  function drawHazard(hazard, room, now) {
    ctx.save();
    const color = hazard.type === 'heat' ? '#ff926d' : hazard.type === 'cold' ? '#8edcff' : hazard.type === 'thorn' ? '#d39aff' : room.palette?.water || '#6bdcff';
    ctx.fillStyle = hexAlpha(color, .15);
    ctx.strokeStyle = hexAlpha(color, .52);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(hazard.x, hazard.y, (hazard.r || 18) + Math.sin(now * .006 + hazard.phase) * 2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawSweep(sweep, now) {
    ctx.save();
    const alpha = sweep.telegraph > 0 ? .28 + Math.sin(now * .018) * .12 : .72;
    ctx.strokeStyle = hexAlpha(sweep.color, alpha);
    ctx.fillStyle = hexAlpha(sweep.color, sweep.telegraph > 0 ? .04 : .13);
    ctx.lineWidth = sweep.telegraph > 0 ? 2 : 1.5;
    if (sweep.kind === 'lane') {
      ctx.beginPath(); ctx.arc(sweep.x, sweep.y, sweep.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.setLineDash(sweep.telegraph > 0 ? [8, 8] : []);
      ctx.beginPath();
      if (sweep.axis === 'x') { ctx.moveTo(sweep.x, sweep.y - sweep.span); ctx.lineTo(sweep.x, sweep.y + sweep.span); }
      else { ctx.moveTo(sweep.x - sweep.span, sweep.y); ctx.lineTo(sweep.x + sweep.span, sweep.y); }
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(sweep.x, sweep.y, sweep.r + (sweep.telegraph > 0 ? 5 : 0), 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy, now) {
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    const tele = enemy.telegraph > 0;
    ctx.fillStyle = tele ? 'rgba(255,180,110,.28)' : 'rgba(12,22,18,.88)';
    ctx.strokeStyle = tele ? '#ffc06f' : hexAlpha(state.room.palette?.accent || '#9bf0b8', .65);
    ctx.lineWidth = tele ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + (tele ? Math.sin(now * .02) * 3 : 0), 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d7f3df'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(String(enemy.species || 'wisp').slice(0, 3).toUpperCase(), 0, 4);
    const hp = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-15, enemy.r + 7, 30, 2);
    ctx.fillStyle = '#a9ffd1'; ctx.fillRect(-15, enemy.r + 7, 30 * hp, 2);
    ctx.restore();
  }

  function drawBoss(boss, now) {
    ctx.save(); ctx.translate(boss.x, boss.y);
    const accent = state.room.palette?.warm || '#ffd66b';
    ctx.shadowColor = accent; ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(8,15,12,.9)'; ctx.strokeStyle = accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, boss.r + Math.sin(now * .004) * 2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.rotate(now * .00035);
    for (let i = 0; i < 6; i += 1) {
      ctx.rotate(TAU / 6); ctx.strokeStyle = hexAlpha(accent, .52); ctx.beginPath(); ctx.moveTo(boss.r + 5, 0); ctx.lineTo(boss.r + 15, 0); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillRect(610, 89, 260, 7);
    ctx.fillStyle = accent; ctx.fillRect(610, 89, 260 * clamp(boss.hp / boss.maxHp, 0, 1), 7);
    ctx.fillStyle = '#e9f7ee'; ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(boss.name.toUpperCase(), 870, 82);
    ctx.restore();
  }

  function drawPowerup(pickup, now) {
    ctx.save(); ctx.translate(pickup.x, pickup.y);
    ctx.strokeStyle = pickup.color || '#a9ffd1'; ctx.fillStyle = hexAlpha(pickup.color || '#a9ffd1', .14); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(now * .006) * 2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pickup.color || '#a9ffd1'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pickup.icon || '✦', 0, 0);
    ctx.restore();
  }

  function drawProjectile(shot) {
    const color = ABILITIES[shot.ability]?.color || '#fff';
    ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, TAU); ctx.fill(); ctx.restore();
  }

  function drawPortal(now) {
    if (!state.portal.open) {
      if (roomSolved()) {
        ctx.save(); ctx.strokeStyle = 'rgba(170,255,210,.13)'; ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.arc(state.portal.x, state.portal.y, state.portal.r, 0, TAU); ctx.stroke(); ctx.restore();
      }
      return;
    }
    const pulse = Math.sin(now * .006 + state.portal.pulse) * 3;
    const gradient = ctx.createRadialGradient(state.portal.x, state.portal.y, 6, state.portal.x, state.portal.y, state.portal.r + 13);
    gradient.addColorStop(0, 'rgba(6,12,10,.94)');
    gradient.addColorStop(.58, 'rgba(40,138,106,.34)');
    gradient.addColorStop(1, 'rgba(170,255,210,0)');
    ctx.save(); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(state.portal.x, state.portal.y, state.portal.r + 15 + pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a9ffd1'; ctx.shadowColor = '#7bf1b0'; ctx.shadowBlur = 18; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(state.portal.x, state.portal.y, state.portal.r * .62 + pulse * .25, state.portal.r + pulse, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
  }

  function drawPlayer(now) {
    const p = state.player;
    const aim = aimVector();
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(0, 17, 18, 7, 0, 0, TAU); ctx.fill();
    if (state.relics.shieldCharges > 0) { ctx.strokeStyle = 'rgba(200,247,237,.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 25 + Math.sin(now * .007) * 2, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#78b783'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 16, -.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9ed49f'; ctx.beginPath(); ctx.arc(4, -10, 11, 0, TAU); ctx.fill();
    ctx.save(); ctx.rotate(Math.atan2(aim.y, aim.x));
    ctx.fillStyle = '#233c32'; ctx.strokeStyle = ABILITIES[state.selected].color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(8, -5, 18, 10, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ABILITIES[state.selected].color; ctx.beginPath(); ctx.arc(24, 0, 3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#15231b'; ctx.beginPath(); ctx.arc(7, -11, 2.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawAimReticle(now) {
    if (!state.player) return;
    const aim = aimVector();
    const x = aimSource === 'mouse' && pointer.seen ? pointer.x : state.player.x + aim.x * 92;
    const y = aimSource === 'mouse' && pointer.seen ? pointer.y : state.player.y + aim.y * 92;
    ctx.save(); ctx.strokeStyle = hexAlpha(ABILITIES[state.selected].color, .55); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, y, 8 + Math.sin(now * .007) * 1.2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 12); ctx.stroke(); ctx.restore();
  }

  function burst(x, y, color, count = 10, speed = 90) {
    const rng = rngFrom(hash(`${x}:${y}:${state.totalTime}`));
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * TAU;
      const velocity = speed * (.35 + rng() * .8);
      state.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: .45 + rng() * .45, max: .9, color, r: 1 + rng() * 2.4 });
    }
  }

  function drawParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(.94, dt * 60);
      particle.vy *= Math.pow(.94, dt * 60);
      ctx.fillStyle = hexAlpha(particle.color, clamp(particle.life / particle.max, 0, 1));
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r, 0, TAU); ctx.fill();
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  let visualDt = 1 / 60;
  const dtVisual = () => visualDt;

  function drawIntro() {
    if (introTimer <= 0) return;
    const alpha = clamp(introTimer / .45, 0, 1) * clamp((2.3 - introTimer) / .3, 0, 1);
    const situation = state.room.challenge?.situation?.name || 'arena';
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = 'rgba(4,10,8,.74)'; ctx.fillRect(0, 215, W, 165);
    ctx.fillStyle = '#dff5e7'; ctx.textAlign = 'center'; ctx.font = '600 13px ui-monospace, monospace'; ctx.fillText(roomLabel().toUpperCase(), W / 2, 258);
    ctx.font = '600 30px ui-sans-serif, system-ui'; ctx.fillText(state.room.title, W / 2, 300);
    ctx.fillStyle = '#9fb7aa'; ctx.font = '500 13px ui-monospace, monospace'; ctx.fillText(`${situation} · charge ${state.stoneQuota} Mossglint${state.boss ? ` · guardian: ${state.boss.name}` : ''}`, W / 2, 334);
    ctx.restore();
  }

  function updateParticlesOnly(dt) {
    visualDt = dt;
    introTimer = Math.max(0, introTimer - dt);
    toastTimer = Math.max(0, toastTimer - dt);
    if (toastTimer <= 0) $('toast')?.classList.remove('show');
  }

  function syncHud(force = false) {
    if (!state.room) return;
    const world = $('roomKicker');
    const title = $('roomTitle');
    const task = $('roomTask');
    const score = $('score');
    const time = $('time');
    const integrity = $('integrity');
    const stone = $('mossglint');
    const portal = $('portalState');
    const dash = $('dashState');
    const boss = $('bossState');
    if (world) world.textContent = `${roomLabel()} · depth ${state.worldDepth}`;
    if (title) title.textContent = state.room.title;
    if (task) task.textContent = state.portal.open ? 'Portal charged. Commit east; this world closes behind you.' : `${state.room.challenge?.situation?.hint || state.room.task}`;
    if (score) score.textContent = Math.round(state.score).toLocaleString();
    if (time) time.textContent = formatTime(state.totalTime);
    if (integrity) integrity.textContent = `${'◆'.repeat(Math.max(0, state.integrity))}${'◇'.repeat(Math.max(0, state.maxIntegrity - state.integrity))}`;
    if (stone) stone.textContent = `${state.stones}/${state.stoneQuota}`;
    if (portal) portal.textContent = state.portal.open ? 'OPEN' : `${Math.round(clamp(state.stones / state.stoneQuota, 0, 1) * 100)}%`;
    if (dash) dash.textContent = state.dashCd <= 0 ? 'READY' : `${state.dashCd.toFixed(1)}s`;
    if (boss) boss.textContent = state.boss && !state.boss.dead ? state.boss.name : '';
    const nearest = nearestTarget();
    const hint = $('hintCard');
    if (hint) {
      if (state.portal.open) hint.innerHTML = '<strong>Portal online:</strong> enter the eastern ring or press your portal key. There is no return.';
      else if (state.boss && !state.boss.dead && roomSolved()) hint.innerHTML = `<strong>Guardian lock:</strong> defeat ${state.boss.name} to release the final Mossglint charge.`;
      else if (nearest) hint.innerHTML = `<strong>${nearest.label || 'puzzle node'}:</strong> ${ABILITIES[targetExpected(nearest)]?.name || 'observe'} resonance next · each solved node forms one Mossglint stone.`;
      else hint.innerHTML = '<strong>Stay alive:</strong> read the arena pattern and finish charging the portal gun.';
    }
    if (force) syncAbilityButtons();
  }

  function syncAbilityButtons() {
    document.querySelectorAll('.ability').forEach((button) => {
      const id = button.dataset.a;
      button.disabled = !state.room?.unlock?.includes(id);
      button.classList.toggle('active', id === state.selected);
    });
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rem = seconds - minutes * 60;
    return `${minutes}:${rem.toFixed(1).padStart(4, '0')}`;
  }

  function toast(message, duration = 650) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    toastTimer = duration / 1000;
  }

  function hideScreens() {
    for (const id of ['title', 'pauseScreen', 'optionsScreen', 'controlsScreen', 'howScreen', 'gameOver']) $(id)?.classList.add('hidden');
  }

  function showScreen(id) {
    for (const screenId of ['title', 'pauseScreen', 'optionsScreen', 'controlsScreen', 'howScreen', 'gameOver']) $(screenId)?.classList.add('hidden');
    $(id)?.classList.remove('hidden');
  }

  function pause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      showScreen('pauseScreen');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      hideScreens();
      last = performance.now();
      canvas.focus();
    }
  }

  function syncBestCard() {
    const best = loadBest();
    const el = $('bestRun');
    if (el) el.textContent = best.world ? `best · world ${best.world} · ${Number(best.score || 0).toLocaleString()} pts` : 'best · no run yet';
  }

  function keyName(key) {
    const names = { ' ': 'Space', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', shift: 'Shift', enter: 'Enter' };
    return names[key] || key.length === 1 ? (names[key] || key.toUpperCase()) : key;
  }

  function syncControlBindings() {
    document.querySelectorAll('[data-bind]').forEach((button) => {
      const action = button.dataset.bind;
      if (!action) return;
      button.querySelector('.bindKey')?.replaceChildren(document.createTextNode(keyName(settings.bindings[action])));
    });
  }

  function beginCapture(action, button) {
    captureAction = action;
    document.querySelectorAll('[data-bind]').forEach((node) => node.classList.remove('listening'));
    button.classList.add('listening');
    const key = button.querySelector('.bindKey');
    if (key) key.textContent = 'press key';
  }

  function captureBinding(event) {
    if (!captureAction) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    settings.bindings[captureAction] = normKey(event.key);
    captureAction = null;
    saveSettings();
    syncControlBindings();
    document.querySelectorAll('[data-bind]').forEach((node) => node.classList.remove('listening'));
    return true;
  }

  function isAction(action, key) {
    return settings.bindings[action] === normKey(key);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (W / rect.width), y: (event.clientY - rect.top) * (H / rect.height) };
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    pointer.x = point.x; pointer.y = point.y; pointer.seen = true; aimSource = 'mouse';
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const point = canvasPoint(event);
    pointer.x = point.x; pointer.y = point.y; pointer.seen = true; pointer.down = true; aimSource = 'mouse';
    music.start(); fire();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  window.addEventListener('blur', () => { keys.clear(); pointer.down = false; });

  window.addEventListener('keydown', (event) => {
    if (captureBinding(event)) return;
    const key = normKey(event.key);
    const b = settings.bindings;
    if (Object.values(b).includes(key)) event.preventDefault();
    keys.add(key);
    if ([b.aimUp, b.aimDown, b.aimLeft, b.aimRight].includes(key)) aimSource = 'keyboard';
    if (state.mode === 'playing') {
      if (isAction('cast', key) && !event.repeat) fire();
      if (isAction('dash', key) && !event.repeat) tryDash();
      if (isAction('cyclePrev', key) && !event.repeat) cycleAbility(-1);
      if (isAction('cycleNext', key) && !event.repeat) cycleAbility(1);
      if (isAction('portal', key) && state.portal.open) advanceWorld();
      if (isAction('pause', key) && !event.repeat) pause();
      if (event.key >= '1' && event.key <= '6') selectAbility(ABILITY_IDS[Number(event.key) - 1]);
    } else if (state.mode === 'paused' && isAction('pause', key)) pause();
  }, { passive: false });
  window.addEventListener('keyup', (event) => keys.delete(normKey(event.key)));

  document.querySelectorAll('.ability').forEach((button) => button.addEventListener('click', () => selectAbility(button.dataset.a)));
  $('start')?.addEventListener('click', () => beginRun('run'));
  $('explore')?.addEventListener('click', () => beginRun('explore'));
  $('resume')?.addEventListener('click', pause);
  $('restartRun')?.addEventListener('click', () => beginRun('run'));
  $('menuFromGameOver')?.addEventListener('click', () => { state.mode = 'menu'; showScreen('title'); });
  $('optionsBtn')?.addEventListener('click', () => showScreen('optionsScreen'));
  $('pauseOptions')?.addEventListener('click', () => showScreen('optionsScreen'));
  $('controlsBtn')?.addEventListener('click', () => showScreen('controlsScreen'));
  $('howBtn')?.addEventListener('click', () => showScreen('howScreen'));
  document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showScreen(state.mode === 'paused' ? 'pauseScreen' : 'title')));
  document.querySelectorAll('[data-bind]').forEach((button) => button.addEventListener('click', () => beginCapture(button.dataset.bind, button)));
  $('resetControls')?.addEventListener('click', () => {
    settings.bindings = { ...DEFAULT_BINDINGS };
    saveSettings(); syncControlBindings();
  });
  $('musicToggle')?.addEventListener('change', (event) => { settings.music = event.currentTarget.checked; saveSettings(); music.syncSettings(); });
  $('sfxToggle')?.addEventListener('change', (event) => { settings.sfx = event.currentTarget.checked; saveSettings(); });
  $('motionToggle')?.addEventListener('change', (event) => { settings.reducedMotion = event.currentTarget.checked; saveSettings(); });
  $('assistToggle')?.addEventListener('change', (event) => { settings.aimAssist = event.currentTarget.checked; saveSettings(); });
  $('volume')?.addEventListener('input', (event) => { settings.volume = Number(event.currentTarget.value); saveSettings(); music.syncSettings(); });

  function syncSettingsUi() {
    if ($('musicToggle')) $('musicToggle').checked = settings.music;
    if ($('sfxToggle')) $('sfxToggle').checked = settings.sfx;
    if ($('motionToggle')) $('motionToggle').checked = settings.reducedMotion;
    if ($('assistToggle')) $('assistToggle').checked = settings.aimAssist;
    if ($('volume')) $('volume').value = String(settings.volume);
    syncControlBindings(); syncBestCard();
  }

  class MosslightMusic {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.timer = 0;
      this.step = 0;
      this.nextNote = 0;
      this.sceneSeed = 1;
      this.depth = 1;
      this.boss = false;
      this.pressure = 1;
    }
    ensure() {
      if (this.ctx) return true;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master); this.sfxGain.connect(this.master); this.master.connect(this.ctx.destination);
      this.syncSettings();
      return true;
    }
    start() {
      if (!this.ensure()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 45);
    }
    syncSettings() {
      if (!this.master) return;
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(clamp(settings.volume, 0, 1), now, .03);
      this.musicGain.gain.setTargetAtTime(settings.music ? .24 : 0, now, .08);
      this.sfxGain.gain.setTargetAtTime(settings.sfx ? .34 : 0, now, .03);
    }
    setWorld(room, depth, boss) {
      this.sceneSeed = room?.atlas?.seed || hash(room?.id || depth);
      this.depth = depth; this.boss = boss; this.step = 0;
      if (this.ctx) this.nextNote = this.ctx.currentTime + .08;
    }
    setBoss(value) { this.boss = value; }
    update(depth, boss, pressure) { this.depth = depth; this.boss = boss; this.pressure = pressure; }
    bpm() { return clamp(78 + Math.log2(this.depth + 1) * 4.4 + (this.boss ? 9 : 0), 78, 126); }
    scale() {
      const roots = [146.83, 164.81, 174.61, 196, 220];
      const root = roots[this.sceneSeed % roots.length];
      return [1, 9 / 8, 6 / 5, 3 / 2, 5 / 3, 2].map((ratio) => root * ratio);
    }
    schedule() {
      if (!this.ctx || !settings.music || state.mode !== 'playing') return;
      const beat = 60 / this.bpm();
      if (!this.nextNote) this.nextNote = this.ctx.currentTime + .05;
      const scale = this.scale();
      while (this.nextNote < this.ctx.currentTime + .12) {
        const step = this.step++;
        if (step % 4 === 0) this.note(scale[(step / 4 + this.sceneSeed) % scale.length], this.nextNote, beat * 1.7, 'sine', .15, -12);
        if (step % 2 === 0) this.note(scale[(step + this.sceneSeed) % scale.length] * 2, this.nextNote, beat * .32, 'triangle', .055, 5);
        if (step % 8 === 0) this.note(scale[0] / 2, this.nextNote, beat * .75, 'sine', .18, -18);
        if (this.boss && step % 2 === 1) this.note(scale[(step * 3) % scale.length] * 1.5, this.nextNote, beat * .22, 'square', .025, 0);
        this.nextNote += beat / 2;
      }
    }
    note(freq, at, duration, type, gain, detune = 0) {
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
      amp.gain.setValueAtTime(.0001, at); amp.gain.exponentialRampToValueAtTime(gain, at + .02); amp.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(amp); amp.connect(this.musicGain); osc.start(at); osc.stop(at + duration + .04);
    }
    tone(freq, duration = .09, gain = .08, type = 'sine', when = 0) {
      if (!this.ensure() || !settings.sfx) return;
      const at = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator(); const amp = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, at); osc.frequency.exponentialRampToValueAtTime(Math.max(50, freq * .72), at + duration);
      amp.gain.setValueAtTime(gain, at); amp.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(amp); amp.connect(this.sfxGain); osc.start(at); osc.stop(at + duration + .03);
    }
    sfx(kind) {
      const table = { shot: [470,.05,.035,'triangle'], correct:[680,.08,.06,'sine'], wrong:[160,.1,.045,'sawtooth'], dash:[250,.06,.055,'triangle'], hit:[95,.15,.09,'sawtooth'], shield:[520,.14,.055,'sine'], enemy:[320,.08,.05,'triangle'], boss:[115,.12,.065,'square'] };
      const spec = table[kind] || table.shot; this.tone(...spec);
    }
    chime(kind) {
      const chords = kind === 'portal' ? [330,494,659] : kind === 'boss' ? [220,330,440,660] : kind === 'atlas' ? [196,294,392,587,784] : [392,494,659];
      chords.forEach((freq, index) => this.tone(freq, .18, .055, 'sine', index * .045));
    }
  }

  const music = new MosslightMusic();

  function snapshot() {
    return {
      version: '0.4.0',
      mode: state.mode,
      runMode: state.runMode,
      worldDepth: state.worldDepth,
      worldsCleared: state.worldsCleared,
      atlasClears: state.atlasClears,
      atlasWorld: currentAtlasIndex(),
      player: state.player ? { x: state.player.x, y: state.player.y } : null,
      selected: state.selected,
      aimSource,
      score: state.score,
      integrity: state.integrity,
      stones: state.stones,
      stoneQuota: state.stoneQuota,
      portalOpen: state.portal.open,
      boss: state.boss ? { name: state.boss.name, hp: state.boss.hp, maxHp: state.boss.maxHp, dead: state.boss.dead } : null,
      challenge: state.room?.challenge || null,
      targets: state.room?.targets?.map((target) => ({ id: target.id, x: target.x, y: target.y, done: target.done, step: target.step, expected: targetExpected(target) })) || [],
      enemies: state.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ x: enemy.x, y: enemy.y, pattern: enemy.pattern, hp: enemy.hp })),
      stats: { ...state.stats },
      relics: { ...state.relics, collected: [...state.relics.collected] },
      fps,
    };
  }

  function completeRoomForTest() {
    for (const target of state.room.targets) {
      if (!target.done) {
        target.done = true; target.step = target.sequence.length;
        if (!target.stoneAwarded) { target.stoneAwarded = true; state.stones += 1; state.stats.stones += 1; }
      }
    }
    if (state.boss && !state.boss.dead) { state.boss.dead = true; state.stones += 2; }
    openPortalIfReady();
    return snapshot();
  }

  window.__MOSSLIGHT_PLAYTEST__ = {
    version: '0.4.0',
    get roomCount() { return content.rooms.length; },
    get roomTitles() { return content.rooms.map((room) => room.title); },
    snapshot,
    start(mode = 'run') { beginRun(mode); return snapshot(); },
    setRoom(index, depth = Number(index) + 1) {
      state.mode = 'playing'; state.worldDepth = Math.max(1, Number(depth) || 1); state.sectorIndex = clamp(Number(index) || 0, 0, content.rooms.length - 1); hideScreens(); setupRoom(state.sectorIndex); return snapshot();
    },
    completeRoom: completeRoomForTest,
    openPortal() { completeRoomForTest(); return snapshot(); },
    advance() { if (!state.portal.open) completeRoomForTest(); advanceWorld(); return snapshot(); },
    defeatBoss() { if (state.boss && !state.boss.dead) defeatBoss(); return snapshot(); },
    collectPowerup() { if (state.room?.powerup && !state.room.powerup.collected) { state.room.powerup.collected = true; applyRelic(state.room.powerup); } return snapshot(); },
  };

  function frame(now) {
    const raw = Math.min(.18, Math.max(0, (now - last) / 1000));
    last = now;
    let remaining = raw;
    const step = 1 / 60;
    let loops = 0;
    while (remaining > 0 && loops < 8) {
      const dt = Math.min(step, remaining);
      update(dt); updateParticlesOnly(dt);
      remaining -= dt; loops += 1;
    }
    draw(now);
    fpsFrames += 1;
    if (now - fpsWindow >= 750) { fps = fpsFrames * 1000 / (now - fpsWindow); fpsFrames = 0; fpsWindow = now; }
    requestAnimationFrame(frame);
  }

  syncSettingsUi();
  showScreen('title');
  requestAnimationFrame(frame);
})();
