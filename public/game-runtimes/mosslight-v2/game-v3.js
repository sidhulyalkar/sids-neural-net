(() => {
  'use strict';

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const canvas = document.getElementById('c');
  const ctx = canvas?.getContext('2d');
  const content = window.MosslightContent;
  const rooms = content?.rooms;
  if (!canvas || !ctx || !rooms?.length) return;

  const $ = (id) => document.getElementById(id);
  const ABILITIES = {
    rain:   { name: 'Rain',   icon: '🌧️', color: '#6bdcff', freq: 340, speed: 610, radius: 7, cooldown: .155 },
    sun:    { name: 'Sun',    icon: '☀️', color: '#ffd66b', freq: 520, speed: 740, radius: 7, cooldown: .145 },
    seed:   { name: 'Seed',   icon: '🌱', color: '#7bf19d', freq: 410, speed: 570, radius: 8, cooldown: .165 },
    wind:   { name: 'Wind',   icon: '🍃', color: '#c8f7ed', freq: 620, speed: 625, radius: 10, cooldown: .13 },
    mend:   { name: 'Mend',   icon: '💚', color: '#ff8ebc', freq: 455, speed: 545, radius: 8, cooldown: .17 },
    gather: { name: 'Gather', icon: '🍎', color: '#ffb66e', freq: 570, speed: 650, radius: 7, cooldown: .15 },
  };
  const ABILITY_IDS = Object.keys(ABILITIES);

  const ui = {
    title: $('title'), pause: $('pauseScreen'), victory: $('victory'), start: $('start'), challenge: $('challenge'), resume: $('resume'), again: $('again'), flowAgain: $('flowAgain'),
    roomKicker: $('roomKicker'), roomTitle: $('roomTitle'), roomTask: $('roomTask'), hint: $('hintCard'), chain: $('chain'), fruit: $('fruit'), time: $('time'), dash: $('dashState'), toast: $('toast'), intro: $('roomIntro'),
    abilities: [...document.querySelectorAll('.ability')], sumTime: $('sumTime'), sumChain: $('sumChain'), sumHits: $('sumHits'), sumAccuracy: $('sumAccuracy'),
  };

  const keys = new Set();
  const pointer = { x: W * .5, y: H * .5, down: false, seen: false };
  let aimSource = 'keyboard';
  let audio = null;
  let toastTimer = 0;
  let introTimer = 0;
  let last = performance.now();
  let fpsFrames = 0;
  let fpsWindow = performance.now();
  let fps = 60;

  const state = {
    mode: 'title',
    difficulty: 'gentle',
    roomIndex: 0,
    room: null,
    player: null,
    selected: 'rain',
    lastAim: { x: 1, y: 0 },
    projectiles: [], particles: [], trails: [], ripples: [], waves: [],
    totalTime: 0, roomTime: 0, shootCd: 0, dashCd: 0, dashTime: 0, hitCd: 0,
    chain: 0, bestChain: 0, chainTimer: 0, fruit: 0,
    waveClock: 4.8,
    stats: { casts: 0, correct: 0, wasted: 0, hits: 0, fruit: 0, dashes: 0, gifts: 0 },
    roomStats: [],
    relics: {
      fireRate: 1,
      projectileScale: 1,
      spread: 1,
      pierce: 0,
      moveSpeed: 1,
      dashRecharge: 1,
      shield: 0,
      shieldCharges: 0,
      collected: [],
    },
    hudClock: 0,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const hash = (value) => {
    let result = 0;
    for (let i = 0; i < String(value).length; i += 1) result = (result * 31 + String(value).charCodeAt(i)) | 0;
    return Math.abs(result % 10000) / 10000;
  };

  function hexAlpha(hex, alpha) {
    if (!hex?.startsWith('#')) return hex || `rgba(255,255,255,${alpha})`;
    let raw = hex.slice(1);
    if (raw.length === 3) raw = raw.split('').map((x) => x + x).join('');
    const n = Number.parseInt(raw, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function hexRgb(hex) {
    let raw = String(hex || '#000000').replace('#', '');
    if (raw.length === 3) raw = raw.split('').map((x) => x + x).join('');
    const n = Number.parseInt(raw, 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }

  function mixHex(a, b, amount) {
    const ar = hexRgb(a);
    const br = hexRgb(b);
    const t = clamp(amount, 0, 1);
    const mix = (x, y) => Math.round(x + (y - x) * t);
    return `rgb(${mix(ar[0], br[0])},${mix(ar[1], br[1])},${mix(ar[2], br[2])})`;
  }

  function cloneRoom(source) {
    return {
      ...source,
      palette: { ...source.palette },
      challenge: source.challenge ? { ...source.challenge, situation: { ...source.challenge.situation } } : { level: 1, pressure: 0, speedScale: 1, situation: { id: 'calm', name: 'calm' } },
      powerup: source.powerup ? { ...source.powerup, apply: { ...source.powerup.apply }, collected: false } : null,
      targets: source.targets.map((target) => ({
        ...target,
        zone: target.zone ? { ...target.zone } : undefined,
        sequence: [...target.sequence],
        step: 0,
        done: false,
        primed: false,
        orientation: target.orientation ?? 0,
        vx: target.vx ?? 0,
        vy: target.vy ?? 0,
      })),
      obstacles: source.obstacles.map((obstacle) => ({ ...obstacle, motion: obstacle.motion ? { ...obstacle.motion } : null, baseX: obstacle.baseX ?? obstacle.x, baseY: obstacle.baseY ?? obstacle.y })),
      hazards: source.hazards.map((hazard) => ({ ...hazard, baseX: hazard.baseX ?? hazard.x, baseY: hazard.baseY ?? hazard.y })),
      encounters: (source.encounters || []).map((encounter) => ({ ...encounter, baseX: encounter.baseX ?? encounter.x, baseY: encounter.baseY ?? encounter.y })),
      complete: false,
    };
  }

  function freshRelics() {
    return { fireRate: 1, projectileScale: 1, spread: 1, pierce: 0, moveSpeed: 1, dashRecharge: 1, shield: 0, shieldCharges: 0, collected: [] };
  }

  function resetPlayer() {
    state.player = { x: 92, y: H / 2, vx: 0, vy: 0, r: 14, walk: 0, blink: 0, blinkAt: 2.4 + Math.random() * 3, facing: 0 };
  }

  function startGame(difficulty = state.difficulty, keepBuild = false) {
    state.difficulty = difficulty;
    state.mode = 'playing';
    state.roomIndex = 0;
    state.totalTime = 0;
    state.bestChain = 0;
    state.chain = 0;
    state.chainTimer = 0;
    state.fruit = 0;
    state.stats = { casts: 0, correct: 0, wasted: 0, hits: 0, fruit: 0, dashes: 0, gifts: 0 };
    state.roomStats = [];
    state.projectiles = [];
    state.particles = [];
    state.trails = [];
    state.ripples = [];
    state.waves = [];
    if (!keepBuild) state.relics = freshRelics();
    ui.title?.classList.add('hidden');
    ui.victory?.classList.add('hidden');
    ui.pause?.classList.add('hidden');
    enterRoom(0);
    ensureAudio();
  }

  function enterRoom(index) {
    state.roomIndex = index;
    state.room = cloneRoom(rooms[index]);
    state.roomTime = 0;
    state.chain = 0;
    state.chainTimer = 0;
    state.projectiles.length = 0;
    state.particles.length = 0;
    state.trails.length = 0;
    state.ripples.length = 0;
    state.waves.length = 0;
    state.waveClock = Math.max(2.8, 6.5 - index * .33);
    state.dashCd = 0;
    state.shootCd = 0;
    state.hitCd = 0;
    if (state.relics.shield > 0) state.relics.shieldCharges = Math.max(1, state.relics.shieldCharges);
    resetPlayer();
    safePowerupPosition();
    const first = nextUsefulAbility();
    if (first) selectAbility(first, false);
    showIntro();
    syncHud(true);
  }

  function safePowerupPosition() {
    const pickup = state.room?.powerup;
    if (!pickup) return;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const blocked = state.room.obstacles.some((obstacle) => circleHitsRect(pickup.x, pickup.y, pickup.r + 18, obstacle));
      const tooClose = dist(pickup.x, pickup.y, 92, H / 2) < 90;
      if (!blocked && !tooClose) return;
      pickup.x = 190 + ((hash(`${state.room.id}-${attempt}`) * 617 + attempt * 83) % 590);
      pickup.y = 145 + ((hash(`${state.room.id}-y-${attempt}`) * 359 + attempt * 61) % 335);
    }
  }

  function nextRoom() {
    state.roomStats.push({ id: state.room.id, time: state.roomTime, hits: state.stats.hits, gift: state.room.powerup?.collected || false });
    if (state.roomIndex >= rooms.length - 1) {
      winGame();
      return;
    }
    roomChord();
    enterRoom(state.roomIndex + 1);
  }

  function restartRoom() {
    if (state.mode !== 'playing') return;
    const keepFruit = state.fruit;
    const keepRelics = { ...state.relics, collected: [...state.relics.collected] };
    enterRoom(state.roomIndex);
    state.fruit = keepFruit;
    state.relics = keepRelics;
    toast('world reset · your expedition gifts stay with you', 950);
  }

  function winGame() {
    state.mode = 'victory';
    state.roomStats.push({ id: state.room.id, time: state.roomTime, hits: state.stats.hits, gift: state.room.powerup?.collected || false });
    if (ui.sumTime) ui.sumTime.textContent = formatTime(state.totalTime, false);
    if (ui.sumChain) ui.sumChain.textContent = `×${state.bestChain}`;
    if (ui.sumHits) ui.sumHits.textContent = String(state.stats.hits);
    const accuracy = state.stats.casts ? Math.round((state.stats.correct / state.stats.casts) * 100) : 100;
    if (ui.sumAccuracy) ui.sumAccuracy.textContent = `${Math.min(100, accuracy)}%`;
    ui.victory?.classList.remove('hidden');
    roomChord(true);
  }

  function pause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      ui.pause?.classList.remove('hidden');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      ui.pause?.classList.add('hidden');
      last = performance.now();
    }
  }

  function unlockedAbilities() {
    return ABILITY_IDS.filter((id) => state.room?.unlock.includes(id));
  }

  function selectAbility(id, announce = true) {
    if (!ABILITIES[id] || !state.room?.unlock.includes(id)) return;
    state.selected = id;
    ui.abilities.forEach((button) => button.classList.toggle('active', button.dataset.a === id));
    if (announce) toast(`${ABILITIES[id].icon} ${ABILITIES[id].name}`, 380);
  }

  function cycleAbility(direction) {
    const unlocked = unlockedAbilities();
    if (!unlocked.length) return;
    const current = Math.max(0, unlocked.indexOf(state.selected));
    selectAbility(unlocked[(current + direction + unlocked.length) % unlocked.length]);
  }

  function targetExpected(target) {
    if (target.done) return null;
    if (target.kind === 'cloud' && target.step === 0) return 'wind';
    if (target.kind === 'sluice') return 'rain';
    return target.sequence[target.step] || null;
  }

  function nextUsefulAbility() {
    if (!state.room) return 'rain';
    const unfinished = state.room.targets.filter((target) => !target.done);
    const nearest = nearestTarget(unfinished);
    return nearest ? targetExpected(nearest) : state.room.unlock[0];
  }

  function smartSelect() {
    if (state.difficulty !== 'gentle') return;
    const useful = nextUsefulAbility();
    if (useful && useful !== state.selected) selectAbility(useful, false);
  }

  function nearestTarget(list = state.room?.targets.filter((target) => !target.done) || []) {
    if (!state.player || !list.length) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const target of list) {
      const d = dist(state.player.x, state.player.y, target.x, target.y);
      if (d < bestDistance) { best = target; bestDistance = d; }
    }
    return best;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (W / rect.width), y: (event.clientY - rect.top) * (H / rect.height) };
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.seen = true;
    aimSource = 'mouse';
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const point = canvasPoint(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.down = true;
    pointer.seen = true;
    aimSource = 'mouse';
    ensureAudio();
    fire();
  });

  window.addEventListener('pointerup', () => { pointer.down = false; });

  window.addEventListener('keydown', (event) => {
    const lower = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(lower)) event.preventDefault();
    keys.add(lower);
    if (lower.startsWith('arrow')) aimSource = 'keyboard';
    if (event.key >= '1' && event.key <= '6') selectAbility(ABILITY_IDS[Number(event.key) - 1]);
    if (lower === 'q') cycleAbility(-1);
    if (lower === 'e') cycleAbility(1);
    if (lower === 'r') restartRoom();
    if (lower === 'p') pause();
    if (lower === 'shift' && !event.repeat) tryDash();
    if (lower === 'enter' && state.mode === 'title') startGame('gentle');
    else if (lower === 'enter' && state.mode === 'playing' && state.room?.complete) nextRoom();
    if (lower === ' ' && state.mode === 'playing') fire();
  }, { passive: false });

  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.down = false;
    if (state.mode === 'playing') pause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'playing') pause(); });

  ui.abilities.forEach((button) => button.addEventListener('click', () => selectAbility(button.dataset.a)));
  ui.start?.addEventListener('click', () => startGame('gentle'));
  ui.challenge?.addEventListener('click', () => startGame('flow'));
  ui.resume?.addEventListener('click', pause);
  ui.again?.addEventListener('click', () => startGame('gentle'));
  ui.flowAgain?.addEventListener('click', () => startGame('flow'));

  function aimVector() {
    const ax = (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0);
    const ay = (keys.has('arrowdown') ? 1 : 0) - (keys.has('arrowup') ? 1 : 0);
    if (ax || ay) {
      const length = Math.hypot(ax, ay);
      state.lastAim = { x: ax / length, y: ay / length };
      aimSource = 'keyboard';
    } else if (aimSource === 'mouse' && pointer.seen && state.player) {
      const dx = pointer.x - state.player.x;
      const dy = pointer.y - state.player.y;
      const length = Math.hypot(dx, dy) || 1;
      state.lastAim = { x: dx / length, y: dy / length };
    }
    return state.lastAim;
  }

  function assistedAim(base, ability) {
    if (!state.room || state.difficulty === 'flow') return base;
    const player = state.player;
    let best = null;
    let bestScore = -Infinity;
    for (const target of state.room.targets) {
      if (target.done || targetExpected(target) !== ability) continue;
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 350 || distance < 1) continue;
      const tx = dx / distance;
      const ty = dy / distance;
      const dot = base.x * tx + base.y * ty;
      if (dot < .76) continue;
      const score = dot * 2.2 - distance / 520;
      if (score > bestScore) { bestScore = score; best = { x: tx, y: ty }; }
    }
    if (!best) return base;
    const blend = aimSource === 'keyboard' ? .54 : .42;
    const x = base.x * (1 - blend) + best.x * blend;
    const y = base.y * (1 - blend) + best.y * blend;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function rotateVector(vector, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: vector.x * c - vector.y * s, y: vector.x * s + vector.y * c };
  }

  function tryDash() {
    if (state.mode !== 'playing' || state.dashCd > 0) return;
    let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    if (!dx && !dy) ({ x: dx, y: dy } = aimVector());
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    state.player.vx = dx * 535 * state.relics.moveSpeed;
    state.player.vy = dy * 535 * state.relics.moveSpeed;
    state.dashTime = .14;
    const baseCd = state.difficulty === 'gentle' ? .72 : .9;
    state.dashCd = baseCd / state.relics.dashRecharge;
    state.stats.dashes += 1;
    burst(state.player.x, state.player.y, '#d9fff2', 14, 170, 'leaf');
    tone(190, .05, 'sawtooth', .015);
    tone(390, .07, 'sine', .012, .018);
  }

  function fire() {
    if (state.mode !== 'playing' || state.shootCd > 0) return;
    const ability = state.selected;
    const spec = ABILITIES[ability];
    const base = assistedAim(aimVector(), ability);
    const spreadCount = Math.max(1, state.relics.spread);
    const angles = spreadCount >= 3 ? [-.14, 0, .14] : [0];
    const player = state.player;

    for (const angle of angles) {
      const vector = rotateVector(base, angle);
      state.projectiles.push({
        id: `${performance.now()}-${Math.random()}`,
        x: player.x + vector.x * 22,
        y: player.y + vector.y * 22,
        vx: vector.x * spec.speed,
        vy: vector.y * spec.speed,
        r: spec.radius * state.relics.projectileScale,
        ability,
        life: 1.25,
        trailClock: 0,
        pierce: Math.max(0, state.relics.pierce),
        hitIds: new Set(),
      });
    }

    if (state.projectiles.length > 72) state.projectiles.splice(0, state.projectiles.length - 72);
    state.shootCd = spec.cooldown / state.relics.fireRate;
    state.stats.casts += 1;
    tone(spec.freq, .032, ability === 'wind' ? 'triangle' : 'sine', .011);
  }

  function update(dt, now) {
    const room = state.room;
    const player = state.player;
    if (!room || !player) return;

    state.totalTime += dt;
    state.roomTime += dt;
    state.shootCd = Math.max(0, state.shootCd - dt);
    state.dashCd = Math.max(0, state.dashCd - dt);
    state.dashTime = Math.max(0, state.dashTime - dt);
    state.hitCd = Math.max(0, state.hitCd - dt);
    state.chainTimer = Math.max(0, state.chainTimer - dt);
    if (state.chainTimer === 0) state.chain = 0;

    updatePlayer(dt);
    updateObstacles(now);
    resolveBounds(player);
    for (const obstacle of room.obstacles) resolveObstacle(player, obstacle);

    if (pointer.down && state.shootCd <= 0) fire();

    updateProjectiles(dt);
    updateTargets(dt, now);
    collideProjectiles();
    updateHazards(dt, now);
    updateEncounters(dt, now);
    updateSituation(dt, now);
    updatePowerup();
    updateEffects(dt);

    if (!room.complete && room.targets.every((target) => target.done)) {
      room.complete = true;
      roomChord();
      burst(W - 64, H / 2, room.palette.accent, 36, 220, 'leaf');
      toast('world breathing · follow the eastern light', 1550);
    }
    if (room.complete && player.x > 904 && Math.abs(player.y - H / 2) < 92) nextRoom();

    state.hudClock += dt;
    if (state.hudClock > .075) {
      state.hudClock = 0;
      syncHud();
    }
  }

  function updatePlayer(dt) {
    const player = state.player;
    let mx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let my = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const length = Math.hypot(mx, my);
    if (length) { mx /= length; my /= length; }
    const accel = (state.dashTime > 0 ? 720 : 1380) * state.relics.moveSpeed;
    const maxSpeed = (state.dashTime > 0 ? 545 : 225) * state.relics.moveSpeed;
    const drag = state.dashTime > 0 ? Math.pow(.35, dt) : Math.pow(.004, dt);
    player.vx = (player.vx + mx * accel * dt) * drag;
    player.vy = (player.vy + my * accel * dt) * drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) { player.vx = player.vx / speed * maxSpeed; player.vy = player.vy / speed * maxSpeed; }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.walk += speed * dt * .035;
    player.blink += dt;
    if (player.blink > player.blinkAt) { player.blink = 0; player.blinkAt = 2.5 + Math.random() * 3.4; }
  }

  function updateProjectiles(dt) {
    for (const projectile of state.projectiles) {
      if (projectile.ability === 'mend') steerMendProjectile(projectile, dt);
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      projectile.trailClock -= dt;
      if (projectile.trailClock <= 0) {
        projectile.trailClock = .035;
        state.trails.push({ x: projectile.x, y: projectile.y, ability: projectile.ability, life: .28, r: projectile.r * .7 });
      }
    }
    state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -40 && projectile.x < W + 40 && projectile.y > -40 && projectile.y < H + 40);
  }

  function steerMendProjectile(projectile, dt) {
    let target = null;
    let best = 210;
    for (const candidate of state.room.targets) {
      if (candidate.done || targetExpected(candidate) !== 'mend') continue;
      const d = dist(projectile.x, projectile.y, candidate.x, candidate.y);
      if (d < best) { best = d; target = candidate; }
    }
    if (!target) return;
    const speed = Math.hypot(projectile.vx, projectile.vy) || ABILITIES.mend.speed;
    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const length = Math.hypot(dx, dy) || 1;
    const tx = dx / length;
    const ty = dy / length;
    const blend = clamp(dt * 2.8, 0, .12);
    let vx = projectile.vx / speed * (1 - blend) + tx * blend;
    let vy = projectile.vy / speed * (1 - blend) + ty * blend;
    const norm = Math.hypot(vx, vy) || 1;
    projectile.vx = vx / norm * speed;
    projectile.vy = vy / norm * speed;
  }

  function updateTargets(dt, now) {
    for (const target of state.room.targets) {
      if (target.kind === 'animal' && !target.done) updateAnimalTarget(target, dt, now);
      if (target.kind === 'cloud' && !target.done) {
        target.x += target.vx * dt;
        target.y += target.vy * dt;
        target.vx *= Math.pow(.10, dt);
        target.vy *= Math.pow(.10, dt);
        target.x = clamp(target.x, 72, W - 92);
        target.y = clamp(target.y, 95, H - 90);
        if (target.primed && target.step === 0 && target.zone && dist(target.x, target.y, target.zone.x, target.zone.y) < target.zone.r) {
          target.step = 1;
          target.primed = false;
          correct(target, 'cloud positioned', false, 'wind');
          smartSelect();
        }
      }
    }
  }

  function updateAnimalTarget(target, dt, now) {
    const phase = target.movePhase ?? hash(target.id) * TAU;
    const range = target.moveRange || target.wander || 24;
    const speed = target.moveSpeed || .85;
    const t = now * .001 * speed + phase;
    const pattern = target.movementPattern || 'graze';

    if (pattern === 'swoop') {
      target.x = target.baseX + Math.sin(t * 1.35) * range * 1.25;
      target.y = target.baseY + Math.sin(t * 2.7) * range * .42;
    } else if (pattern === 'prowl') {
      target.x = target.baseX + Math.sin(t) * range * 1.3;
      target.y = target.baseY + Math.sin(t * .55) * range * .28;
    } else if (pattern === 'hop') {
      const hop = Math.max(0, Math.sin(t * 2.4));
      target.x = target.baseX + Math.sin(t * .72) * range;
      target.y = target.baseY - hop * range * .55;
    } else if (pattern === 'flee') {
      const dx = target.baseX - state.player.x;
      const dy = target.baseY - state.player.y;
      const d = Math.hypot(target.x - state.player.x, target.y - state.player.y);
      const alarm = clamp((150 - d) / 150, 0, 1);
      const l = Math.hypot(dx, dy) || 1;
      target.x = target.baseX + Math.sin(t * .8) * range * .55 + dx / l * range * alarm;
      target.y = target.baseY + Math.cos(t * .65) * range * .25 + dy / l * range * alarm;
    } else if (pattern === 'orbit') {
      target.x = target.baseX + Math.cos(t) * range;
      target.y = target.baseY + Math.sin(t) * range * .55;
    } else {
      target.x = target.baseX + Math.sin(t * .72) * range;
      target.y = target.baseY + Math.cos(t * .58) * range * .55;
    }
    target.x = clamp(target.x, 82, W - 82);
    target.y = clamp(target.y, 105, H - 78);
  }

  function collideProjectiles() {
    for (const projectile of state.projectiles) {
      if (projectile.life <= 0) continue;
      for (const target of state.room.targets) {
        if (target.done || projectile.hitIds.has(target.id)) continue;
        const hitPadding = state.difficulty === 'gentle' ? 12 : 5;
        if (dist(projectile.x, projectile.y, target.x, target.y) >= projectile.r + (target.r || 24) + hitPadding) continue;
        projectile.hitIds.add(target.id);
        const wasCorrect = hitTarget(target, projectile);
        if (wasCorrect && projectile.ability === 'rain') splashRain(target, projectile);
        if (projectile.pierce > 0 && wasCorrect) projectile.pierce -= 1;
        else projectile.life = 0;
        break;
      }
    }
  }

  function splashRain(primary, projectile) {
    const radius = 42 * state.relics.projectileScale;
    for (const target of state.room.targets) {
      if (target === primary || target.done || targetExpected(target) !== 'rain') continue;
      if (dist(primary.x, primary.y, target.x, target.y) > radius) continue;
      target.step += 1;
      correct(target, 'rain ripple', target.step >= target.sequence.length, 'rain');
      if (target.step >= target.sequence.length) target.done = true;
      ripple(target.x, target.y, ABILITIES.rain.color);
    }
  }

  function hitTarget(target, projectile) {
    const ability = projectile.ability;
    if (target.kind === 'cloud' && target.step === 0) {
      if (ability !== 'wind') { wrong(target, ability); return false; }
      target.primed = true;
      const l = Math.hypot(projectile.vx, projectile.vy) || 1;
      const push = state.difficulty === 'gentle' ? 220 : 260;
      target.vx += projectile.vx / l * push;
      target.vy += projectile.vy / l * push;
      burst(target.x, target.y, ABILITIES.wind.color, 8, 80, 'leaf');
      tone(ABILITIES.wind.freq, .04, 'triangle', .016);
      return true;
    }

    if (target.kind === 'sluice' && !target.done) {
      if (ability !== 'rain') { wrong(target, ability); return false; }
      target.orientation = (target.orientation + 1) % 4;
      state.stats.correct += 1;
      state.chain += 1;
      state.bestChain = Math.max(state.bestChain, state.chain);
      state.chainTimer = chainWindow();
      ripple(target.x, target.y, ABILITIES.rain.color);
      tone(ABILITIES.rain.freq, .05, 'triangle', .022);
      if (target.orientation === target.goal) {
        target.done = true;
        correct(target, 'flow aligned', true, 'rain');
        smartSelect();
      } else toast('sluice turned · follow the pale arrow', 560);
      return true;
    }

    const expected = targetExpected(target);
    if (ability !== expected) { wrong(target, ability); return false; }

    if ((target.kind === 'animal' || target.kind === 'heart') && ability === 'gather' && state.fruit <= 0) {
      toast(`${target.label} is ready · restore a fruit source first`, 900);
      wrongTone();
      return false;
    }

    if ((target.kind === 'animal' || target.kind === 'heart') && ability === 'gather') state.fruit -= 1;
    target.step += 1;
    if (target.step >= target.sequence.length) {
      target.done = true;
      if (target.kind === 'fruit') {
        const amount = target.yield || 2;
        state.fruit += amount;
        state.stats.fruit += amount;
        toast(`+${amount} fruit · habitat food restored`, 820);
      }
      correct(target, `${target.label} restored`, true, ability);
      smartSelect();
    } else {
      correct(target, `${ABILITIES[ability].name} accepted`, false, ability);
      if (state.difficulty === 'gentle') {
        const next = targetExpected(target);
        if (next && next !== state.selected) selectAbility(next, false);
      }
    }
    return true;
  }

  function updateObstacles(now) {
    for (const obstacle of state.room.obstacles) {
      const motion = obstacle.motion;
      if (!motion) continue;
      const t = now * .001 * motion.speed + (motion.phase || 0);
      if (motion.type === 'slide-x') obstacle.x = obstacle.baseX + Math.sin(t) * motion.range;
      else if (motion.type === 'slide-y') obstacle.y = obstacle.baseY + Math.sin(t) * motion.range;
      else if (motion.type === 'orbit') {
        obstacle.x = obstacle.baseX + Math.cos(t) * motion.radius;
        obstacle.y = obstacle.baseY + Math.sin(t) * motion.radius;
      }
    }
  }

  function updateHazards(dt, now) {
    const progress = roomProgress();
    const roomScale = state.room.challenge?.speedScale || 1;
    const modeScale = state.difficulty === 'gentle' ? .68 : 1.08;
    const relief = .52 + .48 * (1 - progress);

    for (const hazard of state.room.hazards) {
      const pattern = hazard.pattern || 'patrol';
      const scale = roomScale * modeScale * relief * (hazard.speedScale || 1);
      if (pattern === 'weave') {
        hazard.x += hazard.vx * dt * scale;
        hazard.y = hazard.baseY + Math.sin(now * .0022 + (hazard.phase || 0)) * (hazard.range || 70);
      } else if (pattern === 'orbit') {
        const angle = now * .001 * scale + (hazard.phase || 0);
        hazard.x = hazard.baseX + Math.cos(angle) * (hazard.range || 70);
        hazard.y = hazard.baseY + Math.sin(angle) * (hazard.range || 70) * .72;
      } else if (pattern === 'sweep') {
        hazard.x += hazard.vx * dt * scale * 1.25;
        hazard.y += hazard.vy * dt * scale * .35;
      } else {
        hazard.x += hazard.vx * dt * scale;
        hazard.y += hazard.vy * dt * scale;
      }
      bounceHazard(hazard);
      collideStress(hazard.x, hazard.y, hazard.r, hazardColor(hazard.type), 'stress front');
    }
  }

  function bounceHazard(hazard) {
    if (hazard.x < hazard.r + 46 || hazard.x > W - hazard.r - 46) hazard.vx *= -1;
    if (hazard.y < hazard.r + 72 || hazard.y > H - hazard.r - 55) hazard.vy *= -1;
    hazard.x = clamp(hazard.x, hazard.r + 46, W - hazard.r - 46);
    hazard.y = clamp(hazard.y, hazard.r + 72, H - hazard.r - 55);
  }

  function updateEncounters(dt, now) {
    const levelScale = state.room.challenge?.speedScale || 1;
    const modeScale = state.difficulty === 'gentle' ? .74 : 1.05;
    for (const encounter of state.room.encounters || []) {
      updateEncounter(encounter, dt, now, levelScale * modeScale);
      collideStress(encounter.x, encounter.y, encounter.r, encounterColor(encounter), `${encounter.species} crossing`);
    }
  }

  function updateEncounter(encounter, dt, now, scale) {
    const t = now * .001;
    const pattern = encounter.pattern;
    const speed = encounter.speed * scale;

    if (pattern === 'orbit') {
      const angle = t * speed * .013 + encounter.phase;
      const centerX = 500 + Math.sin(t * .31 + encounter.phase) * 70;
      const centerY = 315 + Math.cos(t * .27 + encounter.phase) * 45;
      encounter.x = centerX + Math.cos(angle) * encounter.orbitRadius;
      encounter.y = centerY + Math.sin(angle) * encounter.orbitRadius * .72;
      return;
    }

    if (pattern === 'spiral') {
      const angle = t * speed * .015 + encounter.phase;
      const radius = 45 + (Math.sin(t * .55 + encounter.phase) + 1) * encounter.range * .42;
      encounter.x = 510 + Math.cos(angle) * radius;
      encounter.y = 315 + Math.sin(angle) * radius * .68;
      return;
    }

    if (pattern === 'weave' || pattern === 'swoop') {
      encounter.heading += dt * (pattern === 'swoop' ? .17 : .08);
      encounter.x += Math.cos(encounter.heading) * speed * dt;
      encounter.y += Math.sin(encounter.heading) * speed * dt + Math.sin(t * (pattern === 'swoop' ? 4.4 : 2.4) + encounter.phase) * 26 * dt;
      bounceEncounter(encounter);
      return;
    }

    if (pattern === 'stalk') {
      const dx = state.player.x - encounter.x;
      const dy = state.player.y - encounter.y;
      const length = Math.hypot(dx, dy) || 1;
      const desiredX = dx / length * speed;
      const desiredY = dy / length * speed;
      encounter.vx += (desiredX - encounter.vx) * clamp(dt * .75, 0, 1);
      encounter.vy += (desiredY - encounter.vy) * clamp(dt * .75, 0, 1);
      encounter.x += encounter.vx * dt;
      encounter.y += encounter.vy * dt;
      bounceEncounter(encounter);
      return;
    }

    if (pattern === 'dash') {
      encounter.dashClock -= dt;
      if (encounter.telegraph > 0) {
        encounter.telegraph -= dt;
        if (encounter.telegraph <= 0) {
          const dx = state.player.x - encounter.x;
          const dy = state.player.y - encounter.y;
          const length = Math.hypot(dx, dy) || 1;
          encounter.vx = dx / length * speed * 4.2;
          encounter.vy = dy / length * speed * 4.2;
        }
      } else if (encounter.dashClock <= 0) {
        encounter.telegraph = .72;
        encounter.dashClock = encounter.dashEvery;
        encounter.vx *= .15;
        encounter.vy *= .15;
      }
      encounter.x += encounter.vx * dt;
      encounter.y += encounter.vy * dt;
      encounter.vx *= Math.pow(.05, dt);
      encounter.vy *= Math.pow(.05, dt);
      bounceEncounter(encounter);
      return;
    }

    // Patrol is deliberately readable and becomes the baseline grammar.
    if (!encounter.vx && !encounter.vy) {
      encounter.vx = Math.cos(encounter.heading) * speed;
      encounter.vy = Math.sin(encounter.heading) * speed * .65;
    }
    encounter.x += encounter.vx * dt;
    encounter.y += encounter.vy * dt;
    bounceEncounter(encounter);
  }

  function bounceEncounter(encounter) {
    if (encounter.x < 70 || encounter.x > W - 70) { encounter.vx *= -1; encounter.heading = Math.PI - encounter.heading; }
    if (encounter.y < 105 || encounter.y > H - 72) { encounter.vy *= -1; encounter.heading *= -1; }
    encounter.x = clamp(encounter.x, 70, W - 70);
    encounter.y = clamp(encounter.y, 105, H - 72);
  }

  function updateSituation(dt, now) {
    const level = state.room.challenge?.level || 1;
    if (level < 3) return;
    state.waveClock -= dt;
    if (state.waveClock <= 0) {
      spawnSituationWave(now);
      const base = state.difficulty === 'gentle' ? 6.25 : 5.25;
      state.waveClock = Math.max(2.9, base - level * .24);
    }

    for (const wave of state.waves) {
      wave.age += dt;
      if (wave.age < wave.telegraph) continue;
      const activeAge = wave.age - wave.telegraph;
      const duration = wave.duration;
      const progress = clamp(activeAge / duration, 0, 1);
      const travel = wave.direction > 0 ? progress : 1 - progress;
      if (wave.axis === 'x') wave.position = 48 + travel * (W - 96);
      else wave.position = 78 + travel * (H - 140);
      if (activeAge <= duration) collideWave(wave);
    }
    state.waves = state.waves.filter((wave) => wave.age < wave.telegraph + wave.duration + .15);
  }

  function spawnSituationWave(now) {
    const situation = state.room.challenge?.situation?.id || 'migration-path';
    const level = state.room.challenge?.level || 1;
    const index = Math.floor((state.roomTime + level) * 10) % 4;
    const horizontal = ['tidal-lanes', 'weather-window', 'heat-crossing'].includes(situation) ? index % 2 === 0 : index % 3 !== 0;
    const type = situation === 'heat-crossing' ? 'heat'
      : situation === 'alpine-switchback' ? 'cold'
      : situation === 'living-corridor' ? 'thorn'
      : situation === 'orbital-dance' || situation === 'earthheart-convergence' ? 'meteor'
      : 'current';
    state.waves.push({
      id: `${state.room.id}-${now}-${index}`,
      axis: horizontal ? 'x' : 'y',
      type,
      direction: index % 2 ? -1 : 1,
      width: 24 + Math.min(30, level * 3),
      telegraph: state.difficulty === 'gentle' ? .95 : .68,
      duration: Math.max(1.05, 1.85 - level * .055),
      age: 0,
      position: -100,
    });
    tone(type === 'heat' ? 128 : type === 'cold' ? 260 : 185, .08, 'triangle', .009);
  }

  function collideWave(wave) {
    const player = state.player;
    const distance = wave.axis === 'x' ? Math.abs(player.x - wave.position) : Math.abs(player.y - wave.position);
    if (distance > player.r + wave.width * .5) return;
    collideStress(player.x, player.y, player.r + 1, hazardColor(wave.type), `${wave.type} sweep`, true);
  }

  function collideStress(x, y, radius, color, label, force = false) {
    if (state.hitCd > 0) return;
    const player = state.player;
    if (!force && dist(player.x, player.y, x, y) >= player.r + radius) return;

    if (state.relics.shieldCharges > 0) {
      state.relics.shieldCharges -= 1;
      state.hitCd = .45;
      ripple(player.x, player.y, '#c8f7ed');
      burst(player.x, player.y, '#c8f7ed', 16, 125, 'spark');
      tone(760, .08, 'sine', .018);
      toast('Moss Ward absorbed the stress', 650);
      return;
    }

    const dx = player.x - x || -1;
    const dy = player.y - y;
    const length = Math.hypot(dx, dy) || 1;
    player.vx = dx / length * 295;
    player.vy = dy / length * 295;
    state.hitCd = state.difficulty === 'gentle' ? .78 : .62;
    state.stats.hits += 1;
    if (state.difficulty === 'flow') { state.chain = 0; state.chainTimer = 0; }
    burst(player.x, player.y, color, 14, 120, 'spark');
    wrongTone();
    toast(state.difficulty === 'gentle' ? `${label} · soft bump` : `${label} · chain reset`, 620);
  }

  function updatePowerup() {
    const pickup = state.room.powerup;
    if (!pickup || pickup.collected) return;
    if (dist(state.player.x, state.player.y, pickup.x, pickup.y) < state.player.r + pickup.r + 5) collectPowerup(pickup);
  }

  function collectPowerup(pickup) {
    if (!pickup || pickup.collected) return;
    pickup.collected = true;
    state.stats.gifts += 1;
    state.relics.collected.push(pickup.id);
    for (const [key, value] of Object.entries(pickup.apply || {})) {
      if (key === 'spread') state.relics.spread = Math.max(state.relics.spread, value);
      else if (key === 'pierce') state.relics.pierce = Math.min(2, state.relics.pierce + value);
      else if (key === 'shield') {
        state.relics.shield = Math.min(2, state.relics.shield + value);
        state.relics.shieldCharges = Math.min(2, state.relics.shieldCharges + 1);
      } else if (typeof value === 'number') {
        const cap = key === 'fireRate' ? 2.15 : key === 'projectileScale' ? 1.95 : key === 'moveSpeed' ? 1.42 : key === 'dashRecharge' ? 1.8 : 2;
        state.relics[key] = Math.min(cap, state.relics[key] * value);
      }
    }
    burst(pickup.x, pickup.y, pickup.color, 34, 190, 'spark');
    ripple(pickup.x, pickup.y, pickup.color);
    [pickup.color, state.room.palette.accent].forEach((_, index) => tone(530 + index * 220, .16, 'sine', .025, index * .06));
    toast(`${pickup.icon} ${pickup.name} · ${pickup.description}`, 1500);
  }

  function updateEffects(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(.2, dt);
      particle.vy *= Math.pow(.2, dt);
      particle.life -= dt;
      particle.r *= Math.pow(.58, dt);
    }
    for (const trail of state.trails) trail.life -= dt;
    for (const rippleState of state.ripples) { rippleState.life -= dt; rippleState.r += 70 * dt; }
    state.particles = state.particles.filter((particle) => particle.life > 0).slice(-220);
    state.trails = state.trails.filter((trail) => trail.life > 0).slice(-160);
    state.ripples = state.ripples.filter((rippleState) => rippleState.life > 0).slice(-40);
  }

  function chainWindow() { return state.difficulty === 'gentle' ? 3.45 : 2.35; }

  function correct(target, label, finish = false, ability = state.selected) {
    state.stats.correct += 1;
    state.chain += 1;
    state.chainTimer = chainWindow();
    state.bestChain = Math.max(state.bestChain, state.chain);
    const color = ABILITIES[ability]?.color || state.room.palette.accent;
    burst(target.x, target.y, color, finish ? 20 : 11, finish ? 145 : 92, ability === 'rain' ? 'drop' : ability === 'seed' ? 'leaf' : 'spark');
    ripple(target.x, target.y, color);
    tone((ABILITIES[ability]?.freq || 440) * (1 + Math.min(7, state.chain) * .022), finish ? .11 : .055, 'sine', finish ? .028 : .018);
    if (finish) toast(label, 690);
  }

  function wrong(target, ability) {
    state.stats.wasted += 1;
    if (state.difficulty === 'flow') {
      state.chain = Math.max(0, state.chain - 1);
      state.chainTimer = Math.min(state.chainTimer, .6);
    }
    wrongTone();
    burst(target.x, target.y, '#789086', 5, 50, 'spark');
    const need = targetExpected(target);
    toast(`${ABILITIES[ability].name} drifts away · ${target.label} needs ${ABILITIES[need]?.name || 'another step'}`, 720);
  }

  function roomProgress() {
    const room = state.room;
    if (!room?.targets?.length) return 0;
    let complete = 0;
    let total = 0;
    for (const target of room.targets) {
      total += Math.max(1, target.sequence.length);
      complete += target.done ? Math.max(1, target.sequence.length) : Math.min(target.step, target.sequence.length);
    }
    return total ? clamp(complete / total, 0, 1) : 0;
  }

  function syncHud(force = false) {
    if (!state.room) return;
    const progress = Math.round(roomProgress() * 100);
    const level = state.room.challenge?.level || state.roomIndex + 1;
    const situation = state.room.challenge?.situation?.name || 'restoration';
    if (ui.roomKicker) ui.roomKicker.textContent = `world ${String(state.room.atlas?.index || state.roomIndex + 1).padStart(3, '0')} · threat ${level}/10 · ${situation} · ${progress}%`;
    if (ui.roomTitle) ui.roomTitle.textContent = state.room.title;
    if (ui.roomTask) ui.roomTask.textContent = state.room.task;
    if (ui.chain) ui.chain.textContent = `×${state.chain}`;
    if (ui.fruit) ui.fruit.textContent = String(state.fruit);
    if (ui.time) ui.time.textContent = formatTime(state.totalTime);
    if (ui.dash) ui.dash.textContent = state.dashCd <= 0 ? 'READY' : `${state.dashCd.toFixed(1)}s`;

    const nearest = nearestTarget();
    const pickup = state.room.powerup;
    if (state.room.complete) {
      ui.hint.innerHTML = '<strong>World restored:</strong> follow the eastern light, or press Enter.';
    } else if (pickup && !pickup.collected && dist(state.player.x, state.player.y, pickup.x, pickup.y) < 260) {
      ui.hint.innerHTML = `<strong>${pickup.icon} World gift nearby:</strong> ${pickup.name} · ${pickup.description}.`;
    } else if (nearest && dist(state.player.x, state.player.y, nearest.x, nearest.y) < 245) {
      const need = targetExpected(nearest);
      ui.hint.innerHTML = `<strong>${nearest.label}:</strong> ${ABILITIES[need]?.icon || ''} ${ABILITIES[need]?.name || 'observe'} next · ${state.room.challenge?.situation?.hint || ''}`;
    } else {
      const giftCount = state.relics.collected.length;
      ui.hint.innerHTML = `<strong>${situation}:</strong> ${state.room.challenge?.situation?.hint || state.room.teaching}${giftCount ? ` · ${giftCount} expedition gift${giftCount === 1 ? '' : 's'} active` : ''}`;
    }

    for (const button of ui.abilities) {
      const enabled = state.room.unlock.includes(button.dataset.a);
      button.disabled = !enabled;
      button.classList.toggle('active', button.dataset.a === state.selected);
    }
    if (force) document.documentElement.style.setProperty('--accent', state.room.palette.accent);
  }

  function showIntro() {
    if (!ui.intro) return;
    ui.intro.querySelector('.n').textContent = `room ${String(state.roomIndex + 1).padStart(2, '0')} · threat ${state.room.challenge?.level || state.roomIndex + 1}/10 · ${state.room.subtitle}`;
    ui.intro.querySelector('h2').textContent = state.room.title;
    const powerText = state.room.powerup ? ` Find ${state.room.powerup.name} while you restore.` : '';
    ui.intro.querySelector('p').textContent = `${state.room.task} ${state.room.challenge?.situation?.hint || ''}${powerText}`;
    ui.intro.classList.add('show');
    clearTimeout(introTimer);
    introTimer = setTimeout(() => ui.intro.classList.remove('show'), 1550);
  }

  function toast(message, duration = 600) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), duration);
  }

  function formatTime(seconds, tenths = true) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${minutes}:${remainder.toFixed(tenths ? 1 : 0).padStart(tenths ? 4 : 2, '0')}`;
  }

  function ensureAudio() {
    if (audio) return audio;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audio = new AudioContext();
    return audio;
  }

  function tone(freq, duration = .05, type = 'sine', volume = .015, delay = 0) {
    const ac = ensureAudio();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    const start = ac.currentTime + delay;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(ac.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  function wrongTone() {
    tone(150, .07, 'triangle', .014);
    tone(118, .09, 'sine', .01, .025);
  }

  function roomChord(big = false) {
    [392, 494, 587, big ? 784 : 659].forEach((freq, index) => tone(freq, .28, 'sine', .018, index * .055));
  }

  function burst(x, y, color, count = 10, speed = 100, shape = 'spark') {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const velocity = speed * (.3 + Math.random() * .75);
      state.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, r: 1.6 + Math.random() * 3, life: .36 + Math.random() * .6, color, shape, spin: Math.random() * TAU });
    }
  }

  function ripple(x, y, color) { state.ripples.push({ x, y, color, r: 8, life: .55 }); }

  function resolveBounds(player) {
    const minX = 48 + player.r;
    const maxX = W - 48 - player.r;
    const minY = 76 + player.r;
    const maxY = H - 58 - player.r;
    if (player.x < minX) { player.x = minX; player.vx = Math.max(0, player.vx); }
    if (player.x > maxX) { player.x = maxX; player.vx = Math.min(0, player.vx); }
    if (player.y < minY) { player.y = minY; player.vy = Math.max(0, player.vy); }
    if (player.y > maxY) { player.y = maxY; player.vy = Math.min(0, player.vy); }
  }

  function circleHitsRect(x, y, r, obstacle) {
    const nearestX = clamp(x, obstacle.x, obstacle.x + obstacle.w);
    const nearestY = clamp(y, obstacle.y, obstacle.y + obstacle.h);
    return dist(x, y, nearestX, nearestY) < r;
  }

  function resolveObstacle(player, obstacle) {
    const nearestX = clamp(player.x, obstacle.x, obstacle.x + obstacle.w);
    const nearestY = clamp(player.y, obstacle.y, obstacle.y + obstacle.h);
    const dx = player.x - nearestX;
    const dy = player.y - nearestY;
    const d = Math.hypot(dx, dy);
    if (d >= player.r || (!dx && !dy)) return;
    const length = d || 1;
    const push = player.r - d + .5;
    player.x += dx / length * push;
    player.y += dy / length * push;
    const dot = player.vx * dx / length + player.vy * dy / length;
    if (dot < 0) {
      player.vx -= dx / length * dot * 1.2;
      player.vy -= dy / length * dot * 1.2;
    }
  }

  function draw(now) {
    const room = state.room || cloneRoom(rooms[0]);
    const player = state.player || { x: 92, y: H / 2, vx: 0, vy: 0, r: 14, walk: 0, blink: 0, blinkAt: 3 };
    const progress = state.room ? roomProgress() : 0;
    ctx.save();
    drawBackdrop(room, progress, now, player);
    drawFloor(room, progress, now);
    drawDoor(room, Boolean(state.room?.complete), now);
    for (const obstacle of room.obstacles) drawObstacle(obstacle, room, progress, now);
    if (state.room) {
      for (const wave of state.waves) drawWave(wave, now);
      for (const target of room.targets) drawTarget(target, room, now);
      for (const hazard of room.hazards) drawHazard(hazard, progress, now);
      for (const encounter of room.encounters || []) drawEncounter(encounter, room, now);
      if (room.powerup && !room.powerup.collected) drawPowerup(room.powerup, now);
      for (const trail of state.trails) drawTrail(trail);
      for (const projectile of state.projectiles) drawProjectile(projectile);
      for (const rippleState of state.ripples) drawRipple(rippleState);
      for (const particle of state.particles) drawParticle(particle);
    }
    drawPlayer(player, now);
    drawAimReticle(player, now);
    drawBuildBadges(now);
    drawVignette();
    ctx.restore();
  }

  function drawBackdrop(room, progress, now, player) {
    ctx.fillStyle = mixHex(room.palette.bg, '#071d16', progress * .24);
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createRadialGradient(W * .52, H * .46, 70, W * .52, H * .46, 570);
    gradient.addColorStop(0, hexAlpha(room.palette.accent, .08 + progress * .1));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(player.vx * .008, player.vy * .008);
    for (let i = 0; i < 30; i += 1) {
      const x = 34 + ((i * 173) % 900);
      const y = 70 + ((i * 91) % 510);
      const pulse = 1 + Math.sin(now * .001 + i) * .1;
      ctx.fillStyle = i % 4 ? hexAlpha(room.palette.accent, .18 + progress * .12) : hexAlpha(room.palette.warm, .15 + progress * .12);
      ctx.beginPath(); ctx.arc(x, y, (1.1 + (i % 3)) * pulse, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFloor(room, progress, now) {
    ctx.fillStyle = mixHex(room.palette.floor, room.palette.accent, progress * .075);
    roundedRect(32, 58, W - 64, H - 94, 18);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(room.palette.accent, .24 + progress * .22);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    roundedRect(34, 60, W - 68, H - 98, 16);
    ctx.clip();
    const decor = room.decor;
    ctx.strokeStyle = hexAlpha(room.palette.accent, .1 + progress * .14);
    ctx.fillStyle = hexAlpha(room.palette.water, .07 + progress * .1);
    if (['river', 'tide'].includes(decor)) {
      for (let lane = 0; lane < 5; lane += 1) {
        ctx.beginPath();
        for (let x = 35; x < W - 30; x += 20) {
          const y = 115 + lane * 92 + Math.sin(x * .021 + lane + now * .0008) * 13;
          if (x === 35) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (decor === 'alpine') {
      for (let i = 0; i < 13; i += 1) {
        const x = 45 + i * 73;
        const h = 42 + (i % 5) * 16;
        ctx.beginPath(); ctx.moveTo(x - 40, 560); ctx.lineTo(x, 560 - h); ctx.lineTo(x + 48, 560); ctx.stroke();
      }
    } else if (decor === 'burn') {
      for (let i = 0; i < 26; i += 1) {
        const x = 55 + ((i * 157) % 850);
        const y = 90 + ((i * 87) % 460);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 7); ctx.lineTo(x + 7, y + 18); ctx.stroke();
      }
    } else if (decor === 'glasshouse' || decor === 'heart') {
      for (let x = 65; x < 930; x += 65) { ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, 570); ctx.stroke(); }
      for (let y = 95; y < 570; y += 58) { ctx.beginPath(); ctx.moveTo(45, y); ctx.lineTo(915, y); ctx.stroke(); }
    } else {
      for (let i = 0; i < 74; i += 1) {
        const x = 48 + ((i * 97) % 860);
        const y = 88 + ((i * 53) % 475);
        const sway = Math.sin(now * .0018 + i * .7) * 3;
        ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.quadraticCurveTo(x + sway, y, x + sway, y - 7 - (i % 6)); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawDoor(room, open, now) {
    const x = W - 49;
    const y = H / 2;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = open ? room.palette.accent : 'rgba(180,210,198,.12)';
    ctx.lineWidth = open ? 5 : 2;
    ctx.shadowColor = room.palette.accent;
    ctx.shadowBlur = open ? 22 + Math.sin(now * .006) * 5 : 0;
    ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 60); ctx.stroke();
    if (open) {
      ctx.fillStyle = hexAlpha(room.palette.accent, .18);
      ctx.fillRect(-18, -58, 24, 116);
      ctx.fillStyle = '#e8fff5'; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('→', -8, 5);
    }
    ctx.restore();
  }

  function drawObstacle(obstacle, room, progress, now) {
    ctx.save();
    const moving = Boolean(obstacle.motion);
    ctx.fillStyle = obstacle.kind === 'ice' ? 'rgba(153,220,244,.2)'
      : obstacle.kind === 'char' ? 'rgba(83,54,43,.84)'
      : obstacle.kind === 'mangrove' ? 'rgba(69,91,66,.86)'
      : obstacle.kind === 'glass' ? 'rgba(188,233,235,.12)'
      : obstacle.kind === 'hedge' ? 'rgba(65,103,70,.82)'
      : 'rgba(74,83,72,.82)';
    ctx.strokeStyle = moving ? hexAlpha(room.palette.warm, .55) : hexAlpha(room.palette.accent, .18 + progress * .08);
    ctx.lineWidth = moving ? 2.2 : 1.3;
    roundedRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, Math.min(11, obstacle.w * .18, obstacle.h * .18));
    ctx.fill(); ctx.stroke();
    if (moving) {
      ctx.globalAlpha = .35 + .15 * Math.sin(now * .006);
      ctx.strokeStyle = room.palette.warm;
      ctx.setLineDash([4, 6]);
      roundedRect(obstacle.x - 5, obstacle.y - 5, obstacle.w + 10, obstacle.h + 10, 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTarget(target, room, now) {
    const done = target.done;
    ctx.save(); ctx.translate(target.x, target.y);
    const expected = targetExpected(target);
    if (!done && expected) {
      ctx.strokeStyle = hexAlpha(ABILITIES[expected].color, .45 + .15 * Math.sin(now * .007));
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(0, 0, (target.r || 24) + 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#f5fff9'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ABILITIES[expected].icon, 0, -32);
    }

    if (target.kind === 'animal') drawAnimal(target, room, done, now);
    else if (target.kind === 'fruit') drawTree(target, room, done, now);
    else if (target.kind === 'cloud') drawCloud(target, room, done, now);
    else if (target.kind === 'sluice') drawSluice(target, room, done);
    else if (target.kind === 'ember') drawEmber(target, room, done, now);
    else if (target.kind === 'ice') drawIce(target, room, done, now);
    else if (target.kind === 'coral') drawCoral(target, room, done, now);
    else if (target.kind === 'mangrove') drawMangrove(target, room, done, now);
    else if (target.kind === 'heart') drawHeart(target, room, done, now);
    else drawPlant(target, room, done, now);

    if (!done) {
      ctx.fillStyle = 'rgba(236,255,247,.52)';
      ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(target.label || '').slice(0, 28), 0, (target.r || 24) + 24);
    }
    ctx.restore();
  }

  function drawPlant(target, room, done, now) {
    const growth = done ? 1 : .3 + target.step / Math.max(1, target.sequence.length) * .55;
    const sway = Math.sin(now * .002 + hash(target.id) * 10) * 3;
    ctx.strokeStyle = done ? room.palette.accent : 'rgba(115,151,126,.72)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(-4 + sway, 2, sway * .4, -18 * growth); ctx.stroke();
    ctx.fillStyle = done ? room.palette.accent : 'rgba(105,141,116,.66)';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 8 + sway * .2, -3, 8 * growth, 4 * growth, side * .45, 0, TAU); ctx.fill(); }
    if (done) { ctx.fillStyle = room.palette.warm; for (let i = 0; i < 6; i += 1) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 7, -20 + Math.sin(a) * 7, 3.6, 0, TAU); ctx.fill(); } }
  }

  function drawTree(target, room, done, now) {
    const sway = Math.sin(now * .0015 + hash(target.id) * 5) * 2;
    ctx.strokeStyle = '#896441'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 25); ctx.quadraticCurveTo(sway, 3, sway, -14); ctx.stroke();
    ctx.fillStyle = done ? room.palette.accent : '#52674f';
    for (const [x, y, radius] of [[0, -26, 21], [-16, -16, 15], [17, -14, 16]]) { ctx.beginPath(); ctx.arc(x + sway, y, radius, 0, TAU); ctx.fill(); }
    if (target.step >= Math.min(2, target.sequence.length - 1) || done) { ctx.fillStyle = '#ff9a65'; for (const [x, y] of [[-12, -26], [12, -16], [3, -34], [-4, -11]]) { ctx.beginPath(); ctx.arc(x + sway, y, 4.3, 0, TAU); ctx.fill(); } }
  }

  function drawAnimal(target, room, done, now) {
    const species = String(target.species || 'wildlife').toLowerCase();
    const bob = Math.sin(now * .006 + hash(target.id) * 7) * 1.5;
    ctx.save(); ctx.translate(0, bob);
    const flying = /owl|hawk|bird|moth|butterfly|bat/.test(species);
    const long = /deer|goat|antelope|fox|wolf|cat|lynx/.test(species);
    const color = done ? room.palette.warm : '#8b8d84';
    ctx.fillStyle = color; ctx.strokeStyle = color;
    if (flying) {
      const flap = Math.sin(now * .009) * 7;
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-22, 5 + flap); ctx.moveTo(8, 0); ctx.lineTo(22, 5 - flap); ctx.stroke();
      ctx.fillStyle = '#182019'; ctx.beginPath(); ctx.arc(3, -4, 1.5, 0, TAU); ctx.fill();
    } else if (long) {
      ctx.beginPath(); ctx.ellipse(-3, 4, 19, 10, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -6, 8, 0, TAU); ctx.fill();
      ctx.lineWidth = 4; for (const x of [-10, 7]) { ctx.beginPath(); ctx.moveTo(x, 11); ctx.lineTo(x, 21); ctx.stroke(); }
      ctx.fillStyle = '#182019'; ctx.beginPath(); ctx.arc(17, -7, 1.5, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(-2, 6, 17, 14, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(10, -5, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#182019'; ctx.beginPath(); ctx.arc(13, -6, 1.5, 0, TAU); ctx.fill();
    }
    if (done) { ctx.fillStyle = '#ff9fc2'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('♥', 0, -32); }
    ctx.restore();
  }

  function drawCloud(target, room, done, now) {
    ctx.fillStyle = done ? 'rgba(230,255,248,.95)' : target.step > 0 ? 'rgba(211,238,242,.9)' : 'rgba(176,203,210,.82)';
    const stretch = 1 + Math.sin(now * .002 + hash(target.id)) * .035;
    ctx.save(); ctx.scale(stretch, 1 / stretch);
    for (const [x, y, radius] of [[-17, 2, 16], [0, -8, 20], [19, 1, 15], [0, 9, 22]]) { ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (target.zone && !done) { ctx.strokeStyle = hexAlpha(room.palette.water, .32); ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(target.zone.x - target.x, target.zone.y - target.y, target.zone.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }

  function drawSluice(target, room, done) {
    ctx.strokeStyle = hexAlpha(room.palette.water, .8); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-31, 0); ctx.lineTo(31, 0); ctx.stroke();
    ctx.save(); ctx.rotate(target.orientation * Math.PI / 2); ctx.strokeStyle = done ? room.palette.accent : '#f5e3bd'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(target.goal * Math.PI / 2); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(38, 0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }

  function drawEmber(target, room, done, now) {
    if (done) { drawPlant(target, room, true, now); return; }
    const factor = 1 - target.step / target.sequence.length * .65;
    ctx.fillStyle = `rgba(255,${95 + target.step * 28},55,${.32 + .18 * Math.sin(now * .009)})`;
    for (let i = 0; i < 5; i += 1) { const angle = i / 5 * TAU + now * .0005; const radius = (12 + i * 2) * factor; ctx.beginPath(); ctx.arc(Math.cos(angle) * 9, Math.sin(angle) * 8, radius * .5, 0, TAU); ctx.fill(); }
  }

  function drawIce(target, room, done, now) {
    if (done) { drawPlant(target, room, true, now); return; }
    ctx.fillStyle = 'rgba(177,230,255,.3)'; ctx.strokeStyle = '#d6f5ff'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 8; i += 1) { const angle = -Math.PI / 2 + i / 8 * TAU; const radius = i % 2 ? 20 : 28; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function drawCoral(target, room, done, now) {
    const sway = Math.sin(now * .002) * 2; ctx.strokeStyle = done ? room.palette.accent : '#856c74'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const x of [-13, 0, 13]) { ctx.beginPath(); ctx.moveTo(0, 21); ctx.quadraticCurveTo(x * .5 + sway, 0, x + sway, -21); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x * .5, -4); ctx.lineTo(x + 8 + sway, -13); ctx.stroke(); }
  }

  function drawMangrove(target, room, done, now) {
    ctx.strokeStyle = done ? '#7d5a3e' : '#5b4c3b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 10); ctx.stroke();
    for (const x of [-18, -9, 9, 18]) { ctx.beginPath(); ctx.moveTo(0, 5); ctx.quadraticCurveTo(x * .6, 15, x, 25); ctx.stroke(); }
    ctx.fillStyle = done ? room.palette.accent : '#4b6b55'; for (const x of [-12, 0, 13]) { ctx.beginPath(); ctx.arc(x, -27 - Math.abs(x) * .15, 10, 0, TAU); ctx.fill(); }
  }

  function drawHeart(target, room, done, now) {
    const pulse = 1 + .07 * Math.sin(now * .006); ctx.scale(pulse, pulse); ctx.strokeStyle = done ? '#c9ffda' : room.palette.accent; ctx.lineWidth = 3;
    for (let i = 0; i < 7; i += 1) { const angle = i / 7 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(angle + .55) * 24, Math.sin(angle + .55) * 24, Math.cos(angle) * 40, Math.sin(angle) * 40); ctx.stroke(); }
    ctx.fillStyle = done ? '#e6fff0' : '#7ddfa2'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
  }

  function drawHazard(hazard, progress, now) {
    ctx.save(); ctx.translate(hazard.x, hazard.y); ctx.globalAlpha = .17 + .5 * (1 - progress); const color = hazardColor(hazard.type); ctx.fillStyle = hexAlpha(color, .14); ctx.strokeStyle = hexAlpha(color, .72); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, hazard.r * (1 + .07 * Math.sin(now * .008 + hazard.x)), 0, TAU); ctx.fill(); ctx.stroke();
    ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = hexAlpha(color, .75); ctx.fillText(hazard.pattern || 'front', 0, hazard.r + 13);
    ctx.restore();
  }

  function hazardColor(type) {
    return type === 'heat' ? '#ff7048' : type === 'smoke' ? '#aaa8b4' : type === 'cold' ? '#90dfff' : type === 'current' ? '#69c7f2' : type === 'meteor' ? '#d4a1ff' : '#d57ca1';
  }

  function encounterColor(encounter) {
    const pattern = encounter.pattern;
    return pattern === 'dash' ? '#ffcc7c' : pattern === 'stalk' ? '#ff8fa8' : pattern === 'orbit' ? '#bca7ff' : '#a8e9c8';
  }

  function drawEncounter(encounter, room, now) {
    const color = encounterColor(encounter);
    ctx.save(); ctx.translate(encounter.x, encounter.y);
    if (encounter.telegraph > 0) {
      const pulse = 1 + Math.sin(now * .02) * .12;
      ctx.strokeStyle = hexAlpha('#ffe6a1', .75); ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(0, 0, (encounter.r + 13) * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const dx = state.player.x - encounter.x; const dy = state.player.y - encounter.y; const l = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx / l * 45, dy / l * 45); ctx.stroke();
    }
    ctx.fillStyle = hexAlpha(color, .18); ctx.strokeStyle = hexAlpha(color, .88); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, encounter.r + 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 1, encounter.r * .78, encounter.r * .5, encounter.heading || 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(245,255,249,.7)'; ctx.font = '8px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(encounter.species || 'wildlife').slice(0, 16), 0, encounter.r + 18);
    ctx.fillStyle = hexAlpha(color, .58); ctx.fillText(encounter.pattern, 0, encounter.r + 29);
    ctx.restore();
  }

  function drawWave(wave, now) {
    const color = hazardColor(wave.type);
    const telegraphing = wave.age < wave.telegraph;
    ctx.save();
    if (telegraphing) {
      const pulse = .12 + .12 * Math.sin(now * .02);
      ctx.fillStyle = hexAlpha(color, pulse);
      const edge = wave.direction > 0 ? 48 : wave.axis === 'x' ? W - 48 : H - 62;
      if (wave.axis === 'x') ctx.fillRect(edge - 8, 78, 16, H - 140);
      else ctx.fillRect(48, edge - 8, W - 96, 16);
    } else {
      ctx.fillStyle = hexAlpha(color, .16);
      ctx.strokeStyle = hexAlpha(color, .48);
      ctx.lineWidth = 1.5;
      if (wave.axis === 'x') { ctx.fillRect(wave.position - wave.width / 2, 78, wave.width, H - 140); ctx.strokeRect(wave.position - wave.width / 2, 78, wave.width, H - 140); }
      else { ctx.fillRect(48, wave.position - wave.width / 2, W - 96, wave.width); ctx.strokeRect(48, wave.position - wave.width / 2, W - 96, wave.width); }
    }
    ctx.restore();
  }

  function drawPowerup(pickup, now) {
    const pulse = 1 + Math.sin(now * .006) * .09;
    ctx.save(); ctx.translate(pickup.x, pickup.y); ctx.scale(pulse, pulse);
    ctx.shadowColor = pickup.color; ctx.shadowBlur = 18;
    ctx.fillStyle = hexAlpha(pickup.color, .16); ctx.strokeStyle = pickup.color; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) { const angle = -Math.PI / 2 + i / 6 * TAU; const x = Math.cos(angle) * 18; const y = Math.sin(angle) * 18; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5fff9'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pickup.icon, 0, 0);
    ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = hexAlpha('#ffffff', .7); ctx.fillText(pickup.name, 0, 31);
    ctx.restore();
  }

  function drawProjectile(projectile) {
    ctx.save(); ctx.translate(projectile.x, projectile.y); const spec = ABILITIES[projectile.ability]; const angle = Math.atan2(projectile.vy, projectile.vx); ctx.rotate(angle);
    ctx.fillStyle = spec.color; ctx.strokeStyle = spec.color; ctx.shadowColor = spec.color; ctx.shadowBlur = 12 + projectile.r;
    if (projectile.ability === 'wind') { ctx.lineWidth = Math.max(2, projectile.r * .2); ctx.beginPath(); ctx.arc(0, 0, projectile.r, -1.15, 1.15); ctx.stroke(); ctx.beginPath(); ctx.arc(-projectile.r * .5, 0, projectile.r * .65, -1.1, 1.1); ctx.stroke(); }
    else if (projectile.ability === 'seed') { ctx.beginPath(); ctx.ellipse(0, 0, projectile.r * 1.2, projectile.r * .55, 0, 0, TAU); ctx.fill(); }
    else if (projectile.ability === 'sun') { ctx.beginPath(); ctx.arc(0, 0, projectile.r * .8, 0, TAU); ctx.fill(); for (let i = 0; i < 4; i += 1) { ctx.fillRect(projectile.r, -1, projectile.r * .8, 2); ctx.rotate(Math.PI / 2); } }
    else if (projectile.ability === 'rain') { ctx.rotate(-.15); ctx.beginPath(); ctx.ellipse(0, 0, projectile.r * .72, projectile.r * 1.12, 0, 0, TAU); ctx.fill(); }
    else if (projectile.ability === 'mend') { ctx.font = `${Math.max(13, projectile.r * 1.8)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♥', 0, 0); }
    else { ctx.beginPath(); ctx.arc(0, 0, projectile.r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawTrail(trail) { ctx.save(); ctx.globalAlpha = clamp(trail.life / .28, 0, 1) * .45; ctx.fillStyle = ABILITIES[trail.ability].color; ctx.beginPath(); ctx.arc(trail.x, trail.y, trail.r, 0, TAU); ctx.fill(); ctx.restore(); }
  function drawRipple(rippleState) { ctx.save(); ctx.globalAlpha = clamp(rippleState.life / .55, 0, 1) * .5; ctx.strokeStyle = rippleState.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rippleState.x, rippleState.y, rippleState.r, 0, TAU); ctx.stroke(); ctx.restore(); }
  function drawParticle(particle) { ctx.save(); ctx.globalAlpha = clamp(particle.life * 1.7, 0, 1); ctx.fillStyle = particle.color; ctx.translate(particle.x, particle.y); ctx.rotate(particle.spin + particle.life * 2); if (particle.shape === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, particle.r * 1.7, particle.r * .7, .5, 0, TAU); ctx.fill(); } else if (particle.shape === 'drop') { ctx.beginPath(); ctx.ellipse(0, 0, particle.r * .7, particle.r * 1.6, 0, 0, TAU); ctx.fill(); } else { ctx.beginPath(); ctx.arc(0, 0, particle.r, 0, TAU); ctx.fill(); } ctx.restore(); }

  function drawPlayer(player, now) {
    const aim = aimVector(); const angle = Math.atan2(aim.y, aim.x); const speed = Math.hypot(player.vx, player.vy); const moving = clamp(speed / 220, 0, 1); const step = Math.sin(player.walk) * moving; const blink = player.blink < .1;
    ctx.save(); ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 17, 17 + moving * 2, 7, 0, 0, TAU); ctx.fill();
    if (state.relics.shieldCharges > 0) { ctx.strokeStyle = hexAlpha('#c8f7ed', .65); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(now * .007) * 2, 0, TAU); ctx.stroke(); }
    ctx.rotate(angle * .08); ctx.strokeStyle = '#607f63'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(-8 + step * 3, 20); ctx.moveTo(7, 12); ctx.lineTo(8 - step * 3, 20); ctx.stroke();
    ctx.fillStyle = '#78b783'; ctx.shadowColor = '#8effd0'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.ellipse(0, 2, 14, 16, -.1, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#9ed49f'; ctx.beginPath(); ctx.arc(4, -10, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#c8e8ac'; ctx.beginPath(); ctx.ellipse(-6, -16, 8, 4, -.8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(4, -20, 8, 4, -1.25, 0, TAU); ctx.fill();
    ctx.fillStyle = '#15231b'; ctx.beginPath(); ctx.ellipse(7, -11, 2.2, blink ? .45 : 2.6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -12, 2, blink ? .45 : 2.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = ABILITIES[state.selected].color; ctx.beginPath(); ctx.moveTo(aim.x * 20, aim.y * 20); ctx.lineTo(aim.x * 11 - aim.y * 5, aim.y * 11 + aim.x * 5); ctx.lineTo(aim.x * 11 + aim.y * 5, aim.y * 11 - aim.x * 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawAimReticle(player, now) {
    const aim = aimVector(); const distance = 68; const x = player.x + aim.x * distance; const y = player.y + aim.y * distance;
    ctx.save(); ctx.strokeStyle = hexAlpha(ABILITIES[state.selected].color, .42); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 8 + Math.sin(now * .006) * 1.5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 12); ctx.stroke(); ctx.restore();
  }

  function drawBuildBadges(now) {
    if (!state.relics.collected.length || state.mode !== 'playing') return;
    const director = window.MosslightDirector;
    const catalog = director?.powerups || [];
    const counts = new Map();
    for (const id of state.relics.collected) counts.set(id, (counts.get(id) || 0) + 1);
    ctx.save();
    let x = 53;
    const y = H - 38;
    for (const [id, count] of counts) {
      const gift = catalog.find((entry) => entry.id === id);
      if (!gift) continue;
      ctx.fillStyle = 'rgba(3,10,9,.72)'; ctx.strokeStyle = hexAlpha(gift.color, .48); ctx.lineWidth = 1; roundedRect(x, y - 17, 55, 25, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gift.color; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.fillText(gift.icon, x + 7, y);
      ctx.fillStyle = 'rgba(245,255,249,.7)'; ctx.font = '8px ui-monospace, monospace'; ctx.fillText(count > 1 ? `×${count}` : gift.name.slice(0, 4), x + 25, y - 1);
      x += 61;
    }
    ctx.restore();
  }

  function drawVignette() { const gradient = ctx.createRadialGradient(W / 2, H / 2, 230, W / 2, H / 2, 570); gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,.38)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H); }
  function roundedRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function completeTargetForPlaytest(target) {
    target.step = target.sequence.length;
    target.done = true;
    if (target.kind === 'fruit') state.fruit += target.yield || 2;
  }

  window.__MOSSLIGHT_PLAYTEST__ = {
    version: '0.3.0',
    roomCount: rooms.length,
    get roomTitles() { return rooms.map((room) => room.title); },
    setRoom(index) {
      state.mode = 'playing';
      ui.title?.classList.add('hidden'); ui.pause?.classList.add('hidden'); ui.victory?.classList.add('hidden');
      enterRoom(clamp(Number(index) || 0, 0, rooms.length - 1));
      return this.snapshot();
    },
    completeRoom() {
      state.room.targets.forEach(completeTargetForPlaytest);
      state.room.complete = true;
      syncHud(true);
      return this.snapshot();
    },
    collectPowerup() {
      if (state.room?.powerup) collectPowerup(state.room.powerup);
      return this.snapshot();
    },
    snapshot() {
      return {
        version: this.version,
        mode: state.mode,
        difficulty: state.difficulty,
        roomIndex: state.roomIndex,
        room: state.room?.title,
        progress: roomProgress(),
        selected: state.selected,
        fruit: state.fruit,
        chain: state.chain,
        stats: { ...state.stats },
        relics: { ...state.relics, collected: [...state.relics.collected] },
        challenge: state.room?.challenge ? { ...state.room.challenge, situation: { ...state.room.challenge.situation } } : null,
        powerup: state.room?.powerup ? { id: state.room.powerup.id, name: state.room.powerup.name, x: state.room.powerup.x, y: state.room.powerup.y, collected: state.room.powerup.collected } : null,
        encounters: (state.room?.encounters || []).map((encounter) => ({ species: encounter.species, pattern: encounter.pattern, x: encounter.x, y: encounter.y, telegraph: encounter.telegraph })),
        targets: (state.room?.targets || []).map((target) => ({ id: target.id, kind: target.kind, label: target.label, x: target.x, y: target.y, expected: targetExpected(target), movementPattern: target.movementPattern || null, done: target.done })),
        movingObstacles: state.room?.obstacles.filter((obstacle) => obstacle.motion).map((obstacle) => ({ x: obstacle.x, y: obstacle.y, motion: obstacle.motion.type })) || [],
        waves: state.waves.map((wave) => ({ type: wave.type, axis: wave.axis, age: wave.age, telegraph: wave.telegraph })),
        player: state.player ? { x: state.player.x, y: state.player.y, vx: state.player.vx, vy: state.player.vy } : null,
        aimSource,
        fps,
      };
    },
    setDifficulty(mode) { state.difficulty = mode === 'flow' ? 'flow' : 'gentle'; return state.difficulty; },
  };

  function loop(now) {
    const dt = Math.min(.033, Math.max(.001, (now - last) / 1000));
    last = now;
    fpsFrames += 1;
    if (now - fpsWindow >= 1000) { fps = fpsFrames * 1000 / (now - fpsWindow); fpsFrames = 0; fpsWindow = now; }
    if (state.mode === 'playing') update(dt, now);
    draw(now);
    requestAnimationFrame(loop);
  }

  resetPlayer();
  state.room = cloneRoom(rooms[0]);
  safePowerupPosition();
  syncHud(true);
  requestAnimationFrame(loop);
})();
