(() => {
  'use strict';

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const FIXED_DT = 1 / 120;
  const VERSION = '0.8.2';
  const BEST_KEY = 'sid.sylvaria.countercut.v8.best';
  const MAX_SHOTS = 128;
  const MAX_PENDING = 72;

  const canvas = document.getElementById('c');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const normKey = (key) => String(key || '').toLowerCase();
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeInOut = (t) => 0.5 - Math.cos(clamp(t, 0, 1) * Math.PI) * 0.5;
  const rotate = (x, y, radians) => ({ x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) });
  const alpha = (hex, opacity) => {
    let raw = String(hex || '#ffffff').replace('#', '');
    if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
    const n = Number.parseInt(raw, 16) || 0xffffff;
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${opacity})`;
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
  const entityRand = (entity) => {
    let x = (entity.rngState || 0x9e3779b9) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    entity.rngState = x >>> 0;
    return entity.rngState / 4294967296;
  };

  const DIRS = Object.freeze({
    up: { x: 0, y: -1, key: 'arrowup', glyph: '↑' },
    down: { x: 0, y: 1, key: 'arrowdown', glyph: '↓' },
    left: { x: -1, y: 0, key: 'arrowleft', glyph: '←' },
    right: { x: 1, y: 0, key: 'arrowright', glyph: '→' },
  });
  const MOVE_DIRS = Object.freeze({ w: DIRS.up, s: DIRS.down, a: DIRS.left, d: DIRS.right });
  const CUT_KEYS = Object.freeze({ arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' });

  const ENEMY_TYPES = Object.freeze({
    feller: { name: 'Rookie Feller', hp: 3, speed: 52, r: 16, color: '#ffb36b', reward: 90, role: 'melee' },
    foreman: { name: 'Nailgun Foreman', hp: 4, speed: 43, r: 17, color: '#ff7f66', reward: 125, role: 'ranged' },
    lobbyist: { name: 'Timber Lobbyist', hp: 4, speed: 39, r: 16, color: '#d698ff', reward: 150, role: 'ranged' },
    skidder: { name: 'Skidder Bruiser', hp: 7, speed: 34, r: 22, color: '#ffc85c', reward: 195, role: 'charger' },
    drone: { name: 'Harvester Drone', hp: 5, speed: 66, r: 15, color: '#7de6ff', reward: 175, role: 'orbit' },
    chair: { name: 'Committee Chair', hp: 6, speed: 31, r: 18, color: '#8ea2ff', reward: 225, role: 'support' },
    broker: { name: 'Subsidy Broker', hp: 5, speed: 47, r: 17, color: '#f6e17b', reward: 205, role: 'support' },
    surveyor: { name: 'Boundary Surveyor', hp: 4, speed: 50, r: 15, color: '#74f4d8', reward: 210, role: 'blink' },
    mech: { name: 'Clearcut Mech', hp: 10, speed: 27, r: 25, color: '#ff6f6f', reward: 295, role: 'heavy' },
    mulcher: { name: 'Mulcher Rig', hp: 9, speed: 24, r: 24, color: '#e8915a', reward: 285, role: 'artillery' },
  });

  const ROOM_BLUEPRINTS = Object.freeze([
    { title: 'Trailhead Trespass', subtitle: 'learn committed movement', palette: ['#07160f', '#123a24', '#79ef91', '#f4e4a5'], trees: 5, deadwood: 4, enemies: ['feller', 'feller'], dash: 48, hint: 'Tap WASD to step-dash. A fast second tap queues through the current step. Arrow keys cut.' },
    { title: 'Nailgun Nursery', subtitle: 'learn return fire', palette: ['#061713', '#0d4634', '#70ffd0', '#ffc274'], trees: 5, deadwood: 5, enemies: ['foreman', 'feller', 'foreman'], dash: 50, hint: 'Counter from the arrival side. Returned nails fly much faster and gently lock into a readable lane.' },
    { title: 'Red Tape Ravine', subtitle: 'first moving trajectories', palette: ['#101322', '#263866', '#a9baff', '#ff87bf'], trees: 6, deadwood: 5, enemies: ['lobbyist', 'foreman', 'feller'], dash: 52, hint: 'Red tape zigzags. Read where it arrives, not where it launched, then send it through another enemy.' },
    { title: 'Skidder Switchback', subtitle: 'commitment beats armor', palette: ['#171107', '#4c3212', '#f7cc69', '#7bffa4'], trees: 6, deadwood: 6, enemies: ['skidder', 'feller', 'foreman'], dash: 54, hint: 'The Skidder locks its charge line. Step aside, then punish recovery or return a nail through it.' },
    { title: 'Sawdisc Wetland', subtitle: 'spiral arrival geometry', palette: ['#04141a', '#07556b', '#78e7ff', '#ffba8c'], trees: 7, deadwood: 6, enemies: ['drone', 'drone', 'foreman'], dash: 56, hint: 'Saw-discs curve in controlled spirals. Counter the actual arrival side.' },
    { title: 'Committee Canopy', subtitle: 'break the support network', palette: ['#0c1022', '#263570', '#9cafef', '#e4d2ff'], trees: 7, deadwood: 7, enemies: ['chair', 'lobbyist', 'foreman'], dash: 58, hint: 'The Chair shields nearby cutters and retreats from melee. Reflected shots punch support protection.' },
    { title: 'Subsidy Grove', subtitle: 'blink and intercept', palette: ['#161707', '#52500e', '#fff078', '#ff8b6f'], trees: 8, deadwood: 7, enemies: ['broker', 'surveyor', 'skidder', 'foreman'], dash: 60, hint: 'Surveyors blink away and bend shots. Intercept gold transfers, then route return fire into evasive targets.' },
    { title: 'Clearcut Conveyor', subtitle: 'pattern pressure', palette: ['#160a0a', '#562020', '#ff786e', '#e2f58a'], trees: 8, deadwood: 8, enemies: ['mech', 'mulcher', 'drone', 'foreman'], dash: 62, hint: 'Heavy units create swerve and wobble lanes. Use counter speed to turn their own screen control against them.' },
    { title: 'Four-Way Firebreak', subtitle: 'counter-routing fluency', palette: ['#07110f', '#284835', '#8dff9b', '#ffb568'], trees: 9, deadwood: 9, enemies: ['lobbyist', 'surveyor', 'drone', 'skidder', 'foreman', 'chair'], dash: 64, hint: 'Movement and cuts are independent. Choose which incoming bullet becomes your weapon and which enemy it crosses.' },
    { title: 'PAC-a-Saw Summit', subtitle: 'boss · pattern synthesis', palette: ['#050914', '#1d2854', '#89d8ff', '#ff6f92'], trees: 10, deadwood: 10, enemies: [], dash: 66, boss: true, hint: 'Three phases combine bursts, carousel fire, spirals, grove pressure, and explicit green punish windows.' },
  ]);

  function freshStats() {
    return {
      cuts: 0, hits: 0, counters: 0, perfectCounters: 0, kills: 0, treesSaved: 0,
      deadwood: 0, dashes: 0, damageTaken: 0, grazes: 0, blockedSteps: 0, fullGroves: 0,
      crosscuts: 0, longReturns: 0, ricochets: 0, evasions: 0,
    };
  }

  function readBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || 'null') || { room: 0, score: 0 }; }
    catch { return { room: 0, score: 0 }; }
  }

  const state = {
    mode: 'menu', runMode: 'run', worldDepth: 1, roomIndex: 0, worldsCleared: 0,
    score: 0, totalTime: 0, roomTime: 0, fps: 60, player: null, room: null,
    enemies: [], shots: [], pendingShots: [], particles: [], slashes: [], trees: [], debris: [],
    callouts: [], boss: null, heldMoves: new Set(), heldOrder: [], moveQueue: null,
    moveRepeatTimer: 0, roomClearTimer: 0, slowTimer: 0, flash: 0, shake: 0,
    blockedHint: null, best: readBest(), muted: false, stats: freshStats(), inputSerial: 0,
  };

  function writeBest() {
    state.best = {
      room: Math.max(state.best.room || 0, state.worldDepth),
      score: Math.max(state.best.score || 0, Math.floor(state.score)),
    };
    try { localStorage.setItem(BEST_KEY, JSON.stringify(state.best)); } catch {}
  }

  class CountercutAudio {
    constructor() { this.ctx = null; }
    ensure() {
      if (state.muted) return null;
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    tone(freq, duration = .05, type = 'sine', gain = .035, slide = 0) {
      const audioCtx = this.ensure();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
      amp.gain.setValueAtTime(gain, now);
      amp.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(amp).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration + .01);
    }
    dash() { this.tone(190, .045, 'triangle', .028, 80); }
    cut() { this.tone(510, .035, 'sawtooth', .02, -180); }
    counter(perfect) {
      this.tone(perfect ? 980 : 760, .055, 'triangle', .045, perfect ? 460 : 180);
      if (perfect) this.tone(1380, .07, 'sine', .025, 140);
    }
    returnHit(long, crosscut) { this.tone(crosscut ? 1160 : long ? 980 : 840, .055, 'triangle', .035, 220); }
    evade() { this.tone(320, .045, 'sine', .015, 120); }
    hurt() { this.tone(95, .11, 'square', .045, -25); }
    room() { this.tone(520, .08, 'triangle', .03, 240); this.tone(780, .11, 'sine', .025, 280); }
    phase() { this.tone(145, .12, 'sawtooth', .04, -35); }
  }
  const audio = new CountercutAudio();

  function pressure(depth = state.worldDepth) {
    if (depth <= 1) return .72;
    if (depth === 2) return .82;
    return clamp(.88 + Math.log2(depth + 1) * .08, .88, 1.55);
  }

  function proceduralBlueprint(depth) {
    const rng = rngFrom(hash(`sylvaria-countercut-room-${depth}`));
    const roster = Object.keys(ENEMY_TYPES);
    const count = clamp(4 + Math.floor(Math.log2(depth + 1) * .8), 4, 9);
    const enemies = [];
    let supportCount = 0;
    let heavyCount = 0;
    while (enemies.length < count) {
      const candidate = roster[Math.floor(rng() * roster.length)];
      const support = candidate === 'chair' || candidate === 'broker';
      const heavy = candidate === 'mech' || candidate === 'mulcher';
      if (support && supportCount >= 2) continue;
      if (heavy && heavyCount >= 2) continue;
      if (support) supportCount += 1;
      if (heavy) heavyCount += 1;
      enemies.push(candidate);
    }
    const palette = ROOM_BLUEPRINTS[Math.floor(rng() * ROOM_BLUEPRINTS.length)].palette;
    return {
      title: `Wild Sector ${String(depth).padStart(3, '0')}`,
      subtitle: depth % 10 === 0 ? 'seeded guardian counterstorm' : 'seeded counter-routing scenario',
      palette,
      trees: clamp(7 + Math.floor(depth / 7), 7, 12),
      deadwood: clamp(5 + Math.floor(depth / 9), 5, 12),
      enemies: depth % 10 === 0 ? enemies.slice(0, Math.max(2, enemies.length - 2)) : enemies,
      dash: clamp(66 + Math.floor((depth - 10) / 4) * 3, 66, 104),
      hint: 'Longer steps and denser pattern mixes make routing more powerful and more dangerous.',
      boss: depth % 10 === 0,
    };
  }

  const roomBlueprint = (depth) => depth <= 10 ? ROOM_BLUEPRINTS[depth - 1] : proceduralBlueprint(depth);
  const randomPoint = (rng, margin = 70) => ({ x: margin + rng() * (W - margin * 2), y: 105 + rng() * (H - 175) });
  const pointClear = (point, radius, existing, pad = 14) => existing.every((item) => dist(point, item) > radius + item.r + pad);
  function placeObject(rng, radius, existing, preferRight = false) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const point = randomPoint(rng, 78);
      if (preferRight) point.x = Math.max(280, point.x);
      if (point.x < 210 && Math.abs(point.y - H / 2) < 90) continue;
      if (pointClear(point, radius, existing)) return point;
    }
    return { x: preferRight ? 520 : 360, y: 140 + (existing.length % 6) * 72 };
  }

  function setupRoom(depth, carry = null) {
    const blueprint = roomBlueprint(depth);
    const rng = rngFrom(hash(`sylvaria-countercut-layout-${depth}`));
    state.worldDepth = depth;
    state.roomIndex = (depth - 1) % 10;
    state.room = { ...blueprint, seed: hash(`sylvaria-countercut-layout-${depth}`) };
    state.player = { x: 108, y: H / 2, r: 14, hp: clamp(carry?.hp ?? 5, 1, 5), maxHp: 5, flow: clamp(carry?.flow ?? 0, 0, 100), facing: 'right', cutDirection: 'right', dash: null, dashCooldown: 0, cutCooldown: 0, invuln: 0, dashDistance: blueprint.dash, trail: [] };
    state.enemies = []; state.shots = []; state.pendingShots = []; state.particles = []; state.slashes = []; state.trees = []; state.debris = []; state.callouts = []; state.boss = null;
    state.heldMoves.clear(); state.heldOrder = []; state.moveQueue = null; state.moveRepeatTimer = 0; state.roomTime = 0; state.roomClearTimer = 0; state.slowTimer = 0; state.flash = 0; state.shake = 0; state.blockedHint = null;
    const placed = [];
    for (let i = 0; i < blueprint.trees; i += 1) { const r = 22 + rng() * 6; const point = placeObject(rng, r, placed, true); const tree = { ...point, r, hp: 5, maxHp: 5, alive: true, phase: rng() * TAU, id: `tree-${depth}-${i}` }; state.trees.push(tree); placed.push(tree); }
    for (let i = 0; i < blueprint.deadwood; i += 1) { const r = 15 + rng() * 7; const point = placeObject(rng, r, placed, false); const debris = { ...point, r, hp: 2, dead: false, angle: rng() * TAU, id: `deadwood-${depth}-${i}` }; state.debris.push(debris); placed.push(debris); }
    blueprint.enemies.forEach((type, index) => spawnEnemy(type, rng, index, placed));
    if (blueprint.boss) spawnBoss();
    updateHud(true);
  }

  function spawnEnemy(type, rng, index = 0, placed = []) {
    const spec = ENEMY_TYPES[type]; if (!spec) return null;
    const point = placeObject(rng, spec.r, placed, true); const hpScale = 1 + Math.max(0, state.worldDepth - 10) * .024; const hp = Math.ceil(spec.hp * hpScale);
    const enemy = { id: `${type}-${state.worldDepth}-${index}-${state.enemies.length}`, type, x: point.x, y: point.y, r: spec.r, hp, maxHp: hp, clock: .8 + rng() * .7, telegraph: 0, state: 'move', phase: rng() * TAU, angle: rng() * TAU, armor: type === 'skidder' ? 1 : 0, boosted: 0, intent: null, attackCount: 0, rngState: hash(`${state.room.seed}:${type}:${index}:${state.enemies.length}`), hitFlash: 0, dead: false, evadeCooldown: .4 + rng() * .8, evade: null, counterStagger: 0 };
    state.enemies.push(enemy); placed.push(enemy); return enemy;
  }

  function spawnBoss() {
    const maxHp = 38 + Math.max(0, state.worldDepth - 10) * 2;
    state.boss = { id: `pac-a-saw-${state.worldDepth}`, type: 'boss', name: 'PAC-a-Saw', x: 720, y: H / 2, r: 42, hp: maxHp, maxHp, phase: 1, clock: 1.25, telegraph: 0, recover: 0, state: 'move', angle: 0, attackCount: 0, intent: null, rngState: hash(`pac-a-saw:${state.worldDepth}`), hitFlash: 0, dead: false, counterStagger: 0, slogan: 'FULLY SUBSIDIZED · MINIMALLY ACCOUNTABLE' };
  }

  function blockers() { return [...state.trees.filter((tree) => tree.alive).map((tree) => ({ ...tree, kind: 'tree' })), ...state.debris.filter((item) => !item.dead).map((item) => ({ ...item, kind: 'deadwood' }))]; }
  function positionClear(x, y, radius = 16) { if (x < 34 || x > W - 34 || y < 88 || y > H - 35) return false; return blockers().every((item) => Math.hypot(x - item.x, y - item.y) >= radius + item.r + 7); }
  function resolveDashTarget(startX, startY, dir, distance) {
    let lastX = startX; let lastY = startY; let blockedBy = null; const steps = Math.max(1, Math.ceil(distance / 4));
    for (let i = 1; i <= steps; i += 1) { const amount = distance * (i / steps); const x = clamp(startX + dir.x * amount, 28, W - 28); const y = clamp(startY + dir.y * amount, 80, H - 32); const hit = blockers().find((item) => Math.hypot(x - item.x, y - item.y) < state.player.r + item.r + 3); if (hit) { blockedBy = hit; break; } lastX = x; lastY = y; }
    return { x: lastX, y: lastY, blockedBy };
  }
  function repeatCadence() { const flowBenefit = lerp(.175, .138, clamp(state.player.flow / 100, 0, 1)); return state.slowTimer > 0 ? flowBenefit * 1.55 : flowBenefit; }
  function queueMove(key) { state.moveQueue = { key, serial: ++state.inputSerial }; }
  function requestDash(key, allowQueue = true) {
    const p = state.player; const dir = MOVE_DIRS[key]; if (!p || !dir || state.mode !== 'playing') return false;
    if (p.dash || p.dashCooldown > 0) { if (allowQueue) queueMove(key); return false; }
    return dashStep(dir, key);
  }
  function dashStep(dir, sourceKey = null) {
    const p = state.player; if (!p || state.mode !== 'playing' || p.dash || p.dashCooldown > 0) return false;
    const resolved = resolveDashTarget(p.x, p.y, dir, p.dashDistance); const travelled = Math.hypot(resolved.x - p.x, resolved.y - p.y);
    if (travelled < 12) { p.dashCooldown = .055; state.stats.blockedSteps += 1; state.blockedHint = resolved.blockedBy ? { x: resolved.blockedBy.x, y: resolved.blockedBy.y, life: .28 } : null; state.shake = Math.max(state.shake, 2.5); audio.tone(120, .045, 'square', .02, -30); return false; }
    p.dash = { sx: p.x, sy: p.y, tx: resolved.x, ty: resolved.y, t: 0, duration: clamp(.095 + travelled / 2400, .10, .145), dir, blockedBy: resolved.blockedBy };
    p.dashCooldown = .025; p.facing = dir.x < 0 ? 'left' : dir.x > 0 ? 'right' : p.facing; state.stats.dashes += 1; state.moveRepeatTimer = repeatCadence(); state.shake = Math.max(state.shake, 1.2);
    for (let i = 0; i < 4; i += 1) spawnParticle(p.x - dir.x * i * 5, p.y - dir.y * i * 5, '#8dff9b', 8 + i * 3);
    if (sourceKey) state.lastMoveKey = sourceKey; audio.dash(); return true;
  }
  function consumeMoveQueue() { if (!state.moveQueue || !state.player || state.player.dash || state.player.dashCooldown > 0) return false; const queued = state.moveQueue; state.moveQueue = null; return requestDash(queued.key, false); }
  function updateMovement(dt) {
    const p = state.player; if (!p) return;
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt); if (state.moveRepeatTimer > 0) state.moveRepeatTimer = Math.max(0, state.moveRepeatTimer - dt);
    if (p.dash) { p.dash.t += dt; const t = clamp(p.dash.t / p.dash.duration, 0, 1); const eased = easeOut(t); p.x = lerp(p.dash.sx, p.dash.tx, eased); p.y = lerp(p.dash.sy, p.dash.ty, eased); p.trail.push({ x: p.x, y: p.y, life: .18 }); if (p.trail.length > 12) p.trail.shift(); if (t < 1) return; const blocked = p.dash.blockedBy; p.dash = null; p.dashCooldown = 0; if (blocked) state.blockedHint = { x: blocked.x, y: blocked.y, life: .24 }; if (consumeMoveQueue()) return; }
    if (consumeMoveQueue()) return; const active = [...state.heldOrder].reverse().find((key) => state.heldMoves.has(key)); if (active && p.dashCooldown <= 0 && state.moveRepeatTimer <= 0) requestDash(active, false);
  }

  function cut(direction) {
    const p = state.player; if (!p || state.mode !== 'playing' || p.cutCooldown > 0) return false; const d = DIRS[direction]; const flow = clamp(p.flow / 100, 0, 1);
    p.cutCooldown = lerp(.19, .152, flow); p.cutDirection = direction; p.facing = d.x < 0 ? 'left' : d.x > 0 ? 'right' : p.facing; state.stats.cuts += 1;
    state.slashes.push({ direction, x: p.x, y: p.y, age: 0, life: state.worldDepth <= 2 ? .15 : .136, perfectWindow: clamp(.09 - Math.max(0, state.worldDepth - 1) * .0014, .064, .09), reach: 80, width: 60, hits: new Set() });
    state.shake = Math.max(state.shake, 1.7); spawnParticle(p.x + d.x * 34, p.y + d.y * 34, '#d9ffd7', 20); audio.cut(); return true;
  }
  function slashContains(slash, object) { const d = DIRS[slash.direction]; const ox = object.x - slash.x; const oy = object.y - slash.y; const along = ox * d.x + oy * d.y; const side = Math.abs(ox * -d.y + oy * d.x); return along >= 4 - object.r && along <= slash.reach + object.r && side <= slash.width * .5 + object.r; }
  function shotApproachDirection(shot) { const dx = shot.x - state.player.x; const dy = shot.y - state.player.y; if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'; return dy < 0 ? 'up' : 'down'; }
  function hostileTargets() { const targets = state.enemies.filter((enemy) => !enemy.dead); if (state.boss && !state.boss.dead) targets.push(state.boss); return targets; }
  function chooseReturnTarget(shot, slash) {
    const d = DIRS[slash.direction]; let best = null; let bestScore = Infinity;
    for (const target of hostileTargets()) { const dx = target.x - shot.x; const dy = target.y - shot.y; const distance = Math.hypot(dx, dy); if (distance < 1 || distance > 760) continue; const nx = dx / distance; const ny = dy / distance; const forward = nx * d.x + ny * d.y; if (forward < .72) continue; const offAxis = Math.acos(clamp(forward, -1, 1)); const ownerBias = target.id === shot.originalOwnerId ? -45 : 0; const crossBias = target.id !== shot.originalOwnerId ? -18 : 0; const score = offAxis * 380 + distance * .18 + ownerBias + crossBias; if (score < bestScore) { best = target; bestScore = score; } }
    return best;
  }
  function returnVector(shot, slash, target) { const d = DIRS[slash.direction]; if (!target) return { x: d.x, y: d.y }; const dx = target.x - shot.x; const dy = target.y - shot.y; const magnitude = Math.hypot(dx, dy) || 1; const tx = dx / magnitude; const ty = dy / magnitude; const assist = .82; const bx = d.x * (1 - assist) + tx * assist; const by = d.y * (1 - assist) + ty * assist; const bmag = Math.hypot(bx, by) || 1; return { x: bx / bmag, y: by / bmag }; }
  function counterShot(shot, slash) {
    if (shot.dead || shot.friendly) return false; const approach = shotApproachDirection(shot); if (approach !== slash.direction || !slashContains(slash, shot)) return false;
    const perfect = slash.age <= slash.perfectWindow; const target = chooseReturnTarget(shot, slash); const vector = returnVector(shot, slash, target); const speed = perfect ? 1040 : 840;
    shot.friendly = true; shot.beneficiaryId = null; shot.originalOwnerId = shot.originalOwnerId || shot.owner?.id || null; shot.owner = null; shot.pattern = 'return'; shot.vx = vector.x * speed; shot.vy = vector.y * speed; shot.baseSpeed = speed; shot.damage = perfect ? 3.0 : 2.0; shot.counterQuality = perfect ? 'perfect' : 'normal'; shot.counterTargetId = target?.id || null; shot.counterOrigin = { x: shot.x, y: shot.y }; shot.reflectedTravel = 0; shot.pierces = perfect ? 1 : 0; shot.hitIds = new Set(); shot.color = perfect ? '#fffce0' : '#8fffb0'; shot.life = 1.55;
    state.stats.counters += 1; if (perfect) state.stats.perfectCounters += 1; state.player.flow = clamp(state.player.flow + (perfect ? 18 : 10), 0, 100); state.score += perfect ? 120 : 70; state.flash = Math.max(state.flash, perfect ? .16 : .06); state.shake = Math.max(state.shake, perfect ? 5 : 2.5); for (let i = 0; i < (perfect ? 12 : 7); i += 1) spawnParticle(shot.x, shot.y, perfect ? '#fff8bb' : '#93ffb2', 30 + i * 2); audio.counter(perfect); return true;
  }

  function shieldProvider(enemy) { if (!enemy || enemy.type === 'chair') return null; return state.enemies.find((candidate) => !candidate.dead && candidate.type === 'chair' && dist(candidate, enemy) <= 165) || null; }
  function addCallout(x, y, text, color = '#efffed') { state.callouts.push({ x, y, text, color, life: .75, max: .75 }); if (state.callouts.length > 18) state.callouts.shift(); }
  function applyCounterHitReward(shot, target) {
    const travel = shot.reflectedTravel || 0; const distanceFactor = 1 + clamp(travel / 520, 0, .85); const crosscut = Boolean(shot.originalOwnerId && target.id !== shot.originalOwnerId); const long = travel >= 280; let scoreBonus = Math.round(55 + travel * .28);
    if (crosscut) { scoreBonus += 150; state.stats.crosscuts += 1; state.player.flow = clamp(state.player.flow + 8, 0, 100); }
    if (long) { scoreBonus += 90; state.stats.longReturns += 1; state.player.flow = clamp(state.player.flow + 6, 0, 100); }
    state.score += scoreBonus; const label = `${crosscut ? 'CROSSCUT · ' : ''}${long ? 'LONG RETURN · ' : ''}+${scoreBonus}`; addCallout(target.x, target.y - target.r - 12, label, crosscut ? '#8fffe0' : '#fff4a8'); audio.returnHit(long, crosscut); return distanceFactor;
  }
  function damageEnemy(enemy, amount, hitDir = null, source = {}) {
    if (!enemy || enemy.dead) return; const shield = shieldProvider(enemy); if (shield) amount *= source.counterShot ? .82 : .52; if (enemy.type === 'skidder' && enemy.armor > 0 && enemy.state !== 'recover') amount *= .25;
    if (source.counterShot) { amount *= applyCounterHitReward(source.counterShot, enemy); enemy.counterStagger = Math.max(enemy.counterStagger, source.counterShot.originalOwnerId === enemy.id ? .34 : .22); enemy.evade = null; enemy.state = 'recover'; enemy.clock = Math.max(enemy.clock, enemy.counterStagger); }
    enemy.hp -= amount; enemy.hitFlash = .12; state.stats.hits += 1; if (hitDir) { enemy.x = clamp(enemy.x + hitDir.x * 8, 34, W - 34); enemy.y = clamp(enemy.y + hitDir.y * 8, 88, H - 35); }
    if (enemy.hp <= 0) { enemy.dead = true; state.stats.kills += 1; state.score += (ENEMY_TYPES[enemy.type]?.reward || 250) + state.player.flow * 2; state.player.flow = clamp(state.player.flow + 8, 0, 100); for (let i = 0; i < 14; i += 1) spawnParticle(enemy.x, enemy.y, ENEMY_TYPES[enemy.type]?.color || '#ff8f73', 24 + i * 2); }
  }
  function damageBoss(amount, hitDir = null, source = {}) {
    const boss = state.boss; if (!boss || boss.dead) return; const armored = boss.state !== 'recover' && boss.phase >= 2; let applied = armored ? amount * .42 : amount;
    if (source.counterShot) { applied *= applyCounterHitReward(source.counterShot, boss); if (boss.state === 'recover') applied *= 1.28; boss.counterStagger = Math.max(boss.counterStagger, .14); }
    boss.hp -= applied; boss.hitFlash = .13; if (hitDir) { boss.x += hitDir.x * 5; boss.y += hitDir.y * 5; }
    if (boss.hp <= boss.maxHp * .66 && boss.phase === 1) { boss.phase = 2; boss.clock = .8; audio.phase(); toast('PAC-a-Saw phase 2 · paperwork helix'); }
    if (boss.hp <= boss.maxHp * .33 && boss.phase === 2) { boss.phase = 3; boss.clock = .65; audio.phase(); toast('PAC-a-Saw phase 3 · emergency clearcut authority'); }
    if (boss.hp <= 0) { boss.dead = true; state.score += 1750; state.stats.kills += 1; for (let i = 0; i < 48; i += 1) spawnParticle(boss.x, boss.y, i % 2 ? '#ff7b9b' : '#91f7ff', 35 + i); }
  }
  function damagePlayer(amount, source = null) {
    const p = state.player; if (!p || p.invuln > 0 || state.mode !== 'playing') return; p.hp -= amount; p.invuln = .66; p.flow = Math.max(0, p.flow - 25); state.stats.damageTaken += amount; state.shake = 8; state.flash = .26; audio.hurt();
    if (source) { const dx = p.x - source.x; const dy = p.y - source.y; const mag = Math.hypot(dx, dy) || 1; p.x = clamp(p.x + dx / mag * 16, 28, W - 28); p.y = clamp(p.y + dy / mag * 16, 80, H - 32); }
    if (p.hp <= 0) endRun('Sprid was overwhelmed');
  }
  function damageTree(tree, amount) { if (!tree?.alive) return; tree.hp -= amount; state.shake = Math.max(state.shake, 2); for (let i = 0; i < 6; i += 1) spawnParticle(tree.x, tree.y, '#c99b5d', 18 + i * 2); if (tree.hp <= 0) { tree.alive = false; tree.hp = 0; if (!state.trees.some((candidate) => candidate.alive)) endRun('The grove was clear-cut'); } }
  function nearestLivingTree(from) { let best = null; let bestDistance = Infinity; for (const tree of state.trees) { if (!tree.alive) continue; const distance = dist(from, tree); if (distance < bestDistance) { best = tree; bestDistance = distance; } } return best; }
  function moveToward(enemy, target, speed, dt) { if (!target) return; const dx = target.x - enemy.x; const dy = target.y - enemy.y; const magnitude = Math.hypot(dx, dy) || 1; const nx = enemy.x + dx / magnitude * speed * dt; const ny = enemy.y + dy / magnitude * speed * dt; if (positionClear(nx, ny, enemy.r)) { enemy.x = nx; enemy.y = ny; } }

  function safeEvadeDestination(enemy, mode) {
    const p = state.player; const awayX = enemy.x - p.x; const awayY = enemy.y - p.y; const mag = Math.hypot(awayX, awayY) || 1; const ax = awayX / mag; const ay = awayY / mag; const sideSign = entityRand(enemy) < .5 ? -1 : 1; const sx = -ay * sideSign; const sy = ax * sideSign; const distance = mode === 'blink' ? 92 : 58;
    const candidates = mode === 'blink' ? [{ x: enemy.x + sx * distance, y: enemy.y + sy * distance }, { x: enemy.x + ax * distance * .8 + sx * distance * .5, y: enemy.y + ay * distance * .8 + sy * distance * .5 }, { x: enemy.x + ax * distance, y: enemy.y + ay * distance }] : [{ x: enemy.x + ax * distance, y: enemy.y + ay * distance }, { x: enemy.x + ax * distance * .7 + sx * 28, y: enemy.y + ay * distance * .7 + sy * 28 }];
    return candidates.find((point) => positionClear(point.x, point.y, enemy.r)) || null;
  }
  function maybeBeginEvade(enemy) {
    if (enemy.counterStagger > 0 || enemy.evadeCooldown > 0 || enemy.telegraph > 0 || enemy.state !== 'move') return false; const distance = dist(enemy, state.player); const mode = ['lobbyist', 'broker', 'surveyor'].includes(enemy.type) ? 'blink' : 'backstep'; const threshold = enemy.type === 'surveyor' ? 165 : ['foreman', 'lobbyist', 'chair', 'broker'].includes(enemy.type) ? 118 : 0; if (!threshold || distance > threshold) return false;
    const destination = safeEvadeDestination(enemy, mode); if (!destination) return false; enemy.state = 'evade-telegraph'; enemy.evade = { mode, sx: enemy.x, sy: enemy.y, tx: destination.x, ty: destination.y, t: 0, cue: mode === 'blink' ? .11 : .075, duration: mode === 'blink' ? .105 : .135 }; enemy.intent = { kind: 'evade', x: destination.x, y: destination.y }; enemy.evadeCooldown = mode === 'blink' ? 1.25 + entityRand(enemy) * .5 : .8 + entityRand(enemy) * .45; return true;
  }
  function updateEvade(enemy, dt) {
    const evade = enemy.evade; if (!evade) return false;
    if (enemy.state === 'evade-telegraph') { evade.cue -= dt; if (evade.cue <= 0) { enemy.state = 'evade'; audio.evade(); state.stats.evasions += 1; } return true; }
    if (enemy.state !== 'evade') return false; evade.t += dt; const t = clamp(evade.t / evade.duration, 0, 1); const eased = evade.mode === 'blink' ? easeInOut(t) : easeOut(t); enemy.x = lerp(evade.sx, evade.tx, eased); enemy.y = lerp(evade.sy, evade.ty, eased);
    if (t >= 1) { enemy.evade = null; enemy.intent = null; enemy.state = 'move'; enemy.clock = Math.max(enemy.clock, .24); }
    return true;
  }

  const SHOT_COLORS = Object.freeze({ nail: '#ffad79', tape: '#dba0ff', saw: '#75e7ff', paper: '#a9baff', coin: '#ffe56e', boss: '#ff6f92', survey: '#74f4d8', chip: '#e8a36c' });
  function fireShotToPoint(enemy, point, kind = 'nail', speed = 330, spread = 0, extra = {}) {
    if (!point || state.shots.length >= MAX_SHOTS) return null; const dx = point.x - enemy.x; const dy = point.y - enemy.y; const base = Math.atan2(dy, dx) + spread; const pattern = extra.pattern || 'straight'; const phase = extra.patternPhase ?? entityRand(enemy) * TAU;
    const shot = { x: enemy.x, y: enemy.y, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed, r: kind === 'saw' ? 9 : kind === 'coin' ? 7 : kind === 'chip' ? 8 : 6, life: extra.life || 3, kind, color: SHOT_COLORS[kind] || '#ffffff', friendly: false, owner: enemy, originalOwnerId: enemy.id, damage: 1, dead: false, spin: 0, grazed: false, age: 0, pattern, baseSpeed: speed, patternPhase: phase, patternAmp: extra.patternAmp ?? (pattern === 'zigzag' ? 105 : pattern === 'wave' ? 74 : pattern === 'wobble' ? 92 : 0), patternFreq: extra.patternFreq ?? (pattern === 'zigzag' ? 9.5 : pattern === 'wave' ? 5.8 : pattern === 'wobble' ? 7.1 : 0), turnRate: extra.turnRate ?? (pattern === 'spiral' ? .78 : 0), turnAt: extra.turnAt ?? .36, turnAngle: extra.turnAngle ?? (entityRand(enemy) < .5 ? -.48 : .48), turned: false, beneficiaryId: extra.beneficiaryId || null, trail: [], counterQuality: null, counterTargetId: null, reflectedTravel: 0, hitIds: new Set(), pierces: 0 };
    state.shots.push(shot); return shot;
  }
  function scheduleShot(enemy, delay, target, kind, speed, spread = 0, extra = {}) { if (state.pendingShots.length >= MAX_PENDING) return; state.pendingShots.push({ delay, shooterId: enemy.id, target: { x: target.x, y: target.y }, kind, speed, spread, extra }); }
  function findShooter(id) { if (state.boss?.id === id) return state.boss; return state.enemies.find((enemy) => enemy.id === id && !enemy.dead) || null; }
  function queueVolley(enemy, target, specs) { for (const spec of specs) scheduleShot(enemy, spec.delay || 0, target, spec.kind || 'nail', spec.speed || 330, spec.spread || 0, spec.extra || {}); }
  function updatePendingShots(dt) { for (const pending of state.pendingShots) pending.delay -= dt; const ready = state.pendingShots.filter((pending) => pending.delay <= 0); state.pendingShots = state.pendingShots.filter((pending) => pending.delay > 0); for (const pending of ready) { const shooter = findShooter(pending.shooterId); if (!shooter || shooter.dead) continue; fireShotToPoint(shooter, pending.target, pending.kind, pending.speed, pending.spread, pending.extra); } }

  function telegraphDuration(enemy) { const early = state.worldDepth <= 2 ? .10 : 0; const base = enemy.type === 'skidder' ? .56 : enemy.type === 'feller' ? .42 : enemy.type === 'mulcher' ? .58 : .46; return clamp(base + early - Math.log2(state.worldDepth + 1) * .012, .30, .68); }
  function chooseIntent(enemy) {
    const p = state.player; const tree = nearestLivingTree(enemy);
    if (enemy.type === 'feller') { if (tree && dist(enemy, tree) < 95) return { kind: 'tree-melee', x: tree.x, y: tree.y, treeId: tree.id }; return { kind: 'player-melee', x: p.x, y: p.y }; }
    if (enemy.type === 'skidder') return { kind: 'charge', x: p.x, y: p.y };
    if (enemy.type === 'broker') { const candidates = state.enemies.filter((candidate) => !candidate.dead && candidate !== enemy && candidate.type !== 'broker'); if (candidates.length) { const beneficiary = candidates[Math.floor(entityRand(enemy) * candidates.length)]; return { kind: 'subsidy', x: beneficiary.x, y: beneficiary.y, beneficiaryId: beneficiary.id }; } }
    if (enemy.type === 'mech' && tree && entityRand(enemy) < .58) return { kind: 'tree-shot', x: tree.x, y: tree.y, treeId: tree.id };
    if (enemy.type === 'mulcher' && tree && entityRand(enemy) < .45) return { kind: 'tree-shot', x: tree.x, y: tree.y, treeId: tree.id };
    return { kind: 'player-shot', x: p.x, y: p.y };
  }
  function beginTelegraph(enemy) { enemy.intent = chooseIntent(enemy); enemy.telegraph = telegraphDuration(enemy); enemy.state = 'telegraph'; }
  function enemyAttack(enemy) {
    const intent = enemy.intent || chooseIntent(enemy); const target = { x: intent.x, y: intent.y }; enemy.attackCount += 1;
    if (enemy.type === 'feller') { if (intent.kind === 'tree-melee') { const tree = state.trees.find((candidate) => candidate.id === intent.treeId && candidate.alive); if (tree && Math.hypot(enemy.x - target.x, enemy.y - target.y) < enemy.r + tree.r + 24) damageTree(tree, 1); } else if (Math.hypot(state.player.x - target.x, state.player.y - target.y) < 34) damagePlayer(1, enemy); }
    else if (enemy.type === 'foreman') { const depth = state.worldDepth; queueVolley(enemy, target, depth < 4 ? [{ delay: 0, kind: 'nail', speed: 360 }] : [{ delay: 0, kind: 'nail', speed: 365, spread: -.08, extra: { pattern: 'straight' } }, { delay: .09, kind: 'nail', speed: 380, spread: .06, extra: { pattern: depth >= 7 ? 'swerve' : 'straight', turnAt: .28 } }, { delay: .18, kind: 'nail', speed: 395, spread: 0, extra: { pattern: 'straight' } }]); }
    else if (enemy.type === 'lobbyist') fireShotToPoint(enemy, target, 'tape', 285, 0, { pattern: 'zigzag', patternAmp: 112, patternFreq: 9.2 });
    else if (enemy.type === 'drone') fireShotToPoint(enemy, target, 'saw', 305, 0, { pattern: 'spiral', turnRate: enemy.attackCount % 2 ? .82 : -.82 });
    else if (enemy.type === 'chair') queueVolley(enemy, target, [{ delay: 0, kind: 'paper', speed: 250, spread: -.14, extra: { pattern: 'wave', patternAmp: 70 } }, { delay: .11, kind: 'paper', speed: 250, spread: .14, extra: { pattern: 'wave', patternAmp: -70 } }]);
    else if (enemy.type === 'broker') { const beneficiary = state.enemies.find((candidate) => candidate.id === intent.beneficiaryId && !candidate.dead); if (beneficiary) fireShotToPoint(enemy, beneficiary, 'coin', 290, 0, { beneficiaryId: beneficiary.id, pattern: 'straight' }); else fireShotToPoint(enemy, state.player, 'coin', 290, 0, { pattern: 'swerve', turnAt: .42 }); }
    else if (enemy.type === 'surveyor') queueVolley(enemy, target, [{ delay: 0, kind: 'survey', speed: 330, spread: -.10, extra: { pattern: 'swerve', turnAt: .30, turnAngle: .52 } }, { delay: .13, kind: 'survey', speed: 340, spread: .10, extra: { pattern: 'swerve', turnAt: .42, turnAngle: -.52 } }]);
    else if (enemy.type === 'skidder') { const dx = target.x - enemy.x; const dy = target.y - enemy.y; const magnitude = Math.hypot(dx, dy) || 1; enemy.chargeDir = { x: dx / magnitude, y: dy / magnitude }; enemy.chargeTime = .46; enemy.state = 'charge'; }
    else if (enemy.type === 'mech') { if (intent.kind === 'tree-shot') queueVolley(enemy, target, [{ delay: 0, kind: 'boss', speed: 305, spread: -.08, extra: { pattern: 'straight' } }, { delay: .10, kind: 'boss', speed: 315, spread: .08, extra: { pattern: 'swerve', turnAt: .38 } }]); else for (const spread of [-.22, 0, .22]) fireShotToPoint(enemy, target, 'boss', 325, spread, { pattern: spread === 0 ? 'straight' : 'swerve', turnAt: .34, turnAngle: spread > 0 ? -.34 : .34 }); }
    else if (enemy.type === 'mulcher') { const pattern = enemy.attackCount % 2 ? 'wobble' : 'spiral'; for (const spread of [-.28, -.09, .09, .28]) fireShotToPoint(enemy, target, 'chip', 270 + Math.abs(spread) * 80, spread, { pattern, patternAmp: 88, patternFreq: 6.8, turnRate: spread > 0 ? .48 : -.48 }); }
    enemy.intent = null;
  }

  function updateEnemies(dt) {
    const p = state.player; if (!p) return; const globalPressure = pressure();
    for (const enemy of state.enemies) {
      if (enemy.dead) continue; if (enemy.hitFlash > 0) enemy.hitFlash -= dt; if (enemy.boosted > 0) enemy.boosted -= dt; if (enemy.evadeCooldown > 0) enemy.evadeCooldown -= dt; if (enemy.counterStagger > 0) enemy.counterStagger -= dt; const spec = ENEMY_TYPES[enemy.type]; const boost = enemy.boosted > 0 ? 1.45 : 1;
      if (updateEvade(enemy, dt)) continue; if (enemy.counterStagger > 0 && enemy.state === 'recover') continue;
      if (enemy.type === 'skidder' && enemy.state === 'charge') { const nx = enemy.x + enemy.chargeDir.x * 420 * globalPressure * dt; const ny = enemy.y + enemy.chargeDir.y * 420 * globalPressure * dt; if (positionClear(nx, ny, enemy.r)) { enemy.x = nx; enemy.y = ny; } else enemy.chargeTime = 0; enemy.chargeTime -= dt; if (dist(enemy, p) < enemy.r + p.r + 4) damagePlayer(1, enemy); if (enemy.chargeTime <= 0 || enemy.x < 35 || enemy.x > W - 35 || enemy.y < 85 || enemy.y > H - 30) { enemy.state = 'recover'; enemy.clock = .82; enemy.armor = 0; } continue; }
      if (enemy.state === 'recover') { enemy.clock -= dt; if (enemy.clock <= 0) { enemy.state = 'move'; enemy.clock = .9 + entityRand(enemy) * .5; enemy.armor = enemy.type === 'skidder' ? 1 : 0; } continue; }
      enemy.clock -= dt; if (enemy.telegraph > 0) { enemy.telegraph -= dt; if (enemy.telegraph <= 0) { enemyAttack(enemy); if (enemy.state !== 'charge') enemy.state = 'move'; enemy.clock = (.95 + entityRand(enemy) * .65) / globalPressure; } continue; }
      if (maybeBeginEvade(enemy)) continue;
      if (enemy.type === 'drone') { enemy.angle += dt * 1.1 * globalPressure; const anchor = nearestLivingTree(enemy) || p; const nx = enemy.x + Math.cos(enemy.angle) * 34 * dt; const ny = enemy.y + Math.sin(enemy.angle) * 34 * dt; if (positionClear(nx, ny, enemy.r)) { enemy.x = nx; enemy.y = ny; } moveToward(enemy, anchor, 16 * globalPressure, dt); }
      else if (['chair', 'lobbyist', 'foreman', 'broker', 'surveyor'].includes(enemy.type)) { const desired = enemy.type === 'surveyor' ? 270 : 230; const distanceToPlayer = dist(enemy, p); if (distanceToPlayer > desired + 30) moveToward(enemy, p, spec.speed * boost * globalPressure, dt); else if (distanceToPlayer < desired - 55) moveToward(enemy, { x: enemy.x + (enemy.x - p.x), y: enemy.y + (enemy.y - p.y) }, spec.speed * .9 * boost * globalPressure, dt); else { const side = Math.sin(enemy.phase + state.roomTime * .8) >= 0 ? 1 : -1; const dx = p.x - enemy.x; const dy = p.y - enemy.y; const mag = Math.hypot(dx, dy) || 1; moveToward(enemy, { x: enemy.x + (-dy / mag) * 60 * side, y: enemy.y + (dx / mag) * 60 * side }, spec.speed * .35 * boost, dt); } }
      else if (enemy.type === 'mulcher' || enemy.type === 'mech') { const tree = nearestLivingTree(enemy); const target = tree && dist(enemy, tree) < 330 ? tree : p; if (dist(enemy, target) > 235) moveToward(enemy, target, spec.speed * boost * globalPressure, dt); }
      else { const tree = nearestLivingTree(enemy); const target = tree && dist(enemy, tree) < dist(enemy, p) * .9 ? tree : p; moveToward(enemy, target, spec.speed * boost * globalPressure, dt); }
      enemy.x = clamp(enemy.x, 34, W - 34); enemy.y = clamp(enemy.y, 88, H - 35); if (enemy.clock <= 0) beginTelegraph(enemy);
    }
  }

  function chooseBossIntent(boss) { if (boss.phase === 3 && boss.attackCount % 2 === 0) { const tree = nearestLivingTree(boss); if (tree) return { kind: 'tree', x: tree.x, y: tree.y, treeId: tree.id }; } return { kind: 'player', x: state.player.x, y: state.player.y }; }
  function bossAttack(boss) {
    const intent = boss.intent || chooseBossIntent(boss); const target = { x: intent.x, y: intent.y }; boss.attackCount += 1;
    if (boss.phase === 1) queueVolley(boss, target, [{ delay: 0, kind: 'boss', speed: 350, spread: -.22, extra: { pattern: 'straight' } }, { delay: .08, kind: 'boss', speed: 375, spread: 0, extra: { pattern: 'swerve', turnAt: .32, turnAngle: boss.attackCount % 2 ? .30 : -.30 } }, { delay: .16, kind: 'boss', speed: 400, spread: .22, extra: { pattern: 'straight' } }]);
    else if (boss.phase === 2) { for (let i = 0; i < 10; i += 1) { const angle = i * TAU / 10; const point = { x: boss.x + Math.cos(angle) * 160, y: boss.y + Math.sin(angle) * 160 }; fireShotToPoint(boss, point, 'paper', 285, 0, { pattern: 'spiral', turnRate: i % 2 ? .62 : -.62 }); } }
    else { if (intent.kind === 'tree') for (const spread of [-.10, .10]) fireShotToPoint(boss, target, 'boss', 370, spread, { pattern: 'swerve', turnAt: .32, turnAngle: -spread * 2.6 }); for (const spread of [-.30, -.10, .10, .30]) fireShotToPoint(boss, state.player, 'saw', 350, spread, { pattern: 'wobble', patternAmp: 80, patternFreq: 7.4 }); }
    boss.intent = null; boss.state = 'recover'; boss.recover = boss.phase === 1 ? .56 : boss.phase === 2 ? .48 : .42; boss.clock = .9 / pressure();
  }
  function updateBoss(dt) {
    const boss = state.boss; if (!boss || boss.dead || !state.player) return; if (boss.hitFlash > 0) boss.hitFlash -= dt; if (boss.counterStagger > 0) { boss.counterStagger -= dt; return; } boss.clock -= dt; boss.angle += dt * (.55 + boss.phase * .22); boss.x = 720 + Math.cos(boss.angle) * 88; boss.y = H / 2 + Math.sin(boss.angle * .72) * 145;
    if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph <= 0) bossAttack(boss); return; } if (boss.state === 'recover') { boss.recover -= dt; if (boss.recover <= 0) boss.state = 'move'; return; } if (boss.clock <= 0) { boss.intent = chooseBossIntent(boss); boss.telegraph = .68 - boss.phase * .08; boss.state = 'telegraph'; }
  }

  function normalizeShotSpeed(shot, targetSpeed = shot.baseSpeed) { const speed = Math.hypot(shot.vx, shot.vy) || 1; shot.vx = shot.vx / speed * targetSpeed; shot.vy = shot.vy / speed * targetSpeed; }
  function applyProjectilePattern(shot, dt) {
    if (shot.friendly || shot.pattern === 'straight' || shot.pattern === 'return') return; const speed = Math.hypot(shot.vx, shot.vy) || shot.baseSpeed || 1; const ux = shot.vx / speed; const uy = shot.vy / speed; const px = -uy; const py = ux;
    if (shot.pattern === 'zigzag' || shot.pattern === 'wave') { const accel = Math.sin(shot.age * shot.patternFreq + shot.patternPhase) * shot.patternAmp; shot.vx += px * accel * dt; shot.vy += py * accel * dt; normalizeShotSpeed(shot); }
    else if (shot.pattern === 'wobble') { const accel = (Math.sin(shot.age * shot.patternFreq + shot.patternPhase) + .45 * Math.sin(shot.age * shot.patternFreq * 2.17 + 1.3)) * shot.patternAmp; shot.vx += px * accel * dt; shot.vy += py * accel * dt; normalizeShotSpeed(shot); }
    else if (shot.pattern === 'spiral') { const rotated = rotate(shot.vx, shot.vy, shot.turnRate * dt); shot.vx = rotated.x; shot.vy = rotated.y; normalizeShotSpeed(shot); }
    else if (shot.pattern === 'swerve' && !shot.turned && shot.age >= shot.turnAt) { const rotated = rotate(shot.vx, shot.vy, shot.turnAngle); shot.vx = rotated.x; shot.vy = rotated.y; shot.turned = true; normalizeShotSpeed(shot); }
  }
  function handleFriendlyHit(shot, target) {
    if (shot.hitIds?.has(target.id)) return false; shot.hitIds?.add(target.id); const direction = { x: Math.sign(shot.vx), y: Math.sign(shot.vy) }; if (target.type === 'boss') damageBoss(shot.damage, direction, { counterShot: shot }); else damageEnemy(target, shot.damage, direction, { counterShot: shot });
    if (shot.pierces > 0) { shot.pierces -= 1; shot.damage *= .82; shot.vx *= .92; shot.vy *= .92; state.stats.ricochets += 1; addCallout(target.x, target.y + target.r + 14, 'PIERCE', '#b9fff1'); return false; }
    shot.dead = true; return true;
  }
  function updateShots(dt) {
    const p = state.player; if (!p) return;
    for (const shot of state.shots) {
      if (shot.dead) continue; shot.life -= dt; shot.age += dt; shot.spin = (shot.spin || 0) + dt * 8; applyProjectilePattern(shot, dt); const previousX = shot.x; const previousY = shot.y; shot.x += shot.vx * dt; shot.y += shot.vy * dt; if (shot.friendly) shot.reflectedTravel += Math.hypot(shot.x - previousX, shot.y - previousY); shot.trail.push({ x: shot.x, y: shot.y, life: shot.friendly ? .16 : .08 }); if (shot.trail.length > (shot.friendly ? 9 : 4)) shot.trail.shift();
      if (shot.life <= 0 || shot.x < -30 || shot.x > W + 30 || shot.y < 50 || shot.y > H + 30) { shot.dead = true; continue; }
      if (shot.friendly) { for (const enemy of state.enemies) { if (enemy.dead || dist(shot, enemy) >= shot.r + enemy.r) continue; handleFriendlyHit(shot, enemy); if (shot.dead) break; } if (!shot.dead && state.boss && !state.boss.dead && dist(shot, state.boss) < shot.r + state.boss.r) handleFriendlyHit(shot, state.boss); continue; }
      if (shot.kind === 'coin' && shot.beneficiaryId) { const beneficiary = state.enemies.find((enemy) => enemy.id === shot.beneficiaryId && !enemy.dead); if (beneficiary && dist(shot, beneficiary) < shot.r + beneficiary.r) { beneficiary.boosted = Math.max(beneficiary.boosted, 2.2); shot.dead = true; for (let i = 0; i < 8; i += 1) spawnParticle(beneficiary.x, beneficiary.y, '#ffe56e', 18 + i * 2); continue; } }
      for (const tree of state.trees) { if (!tree.alive || !['mech', 'mulcher', 'boss'].includes(shot.owner?.type)) continue; if (dist(shot, tree) < shot.r + tree.r) { damageTree(tree, 1); shot.dead = true; break; } }
      if (shot.dead) continue; const playerDistance = dist(shot, p); const hitRadius = shot.r + p.r; if (playerDistance < hitRadius) { if (shot.kind === 'tape') state.slowTimer = 2.2; damagePlayer(1, shot); shot.dead = true; continue; } if (p.dash && !shot.grazed && playerDistance < hitRadius + 18) { shot.grazed = true; state.stats.grazes += 1; p.flow = clamp(p.flow + 6, 0, 100); state.score += 25; spawnParticle(p.x, p.y, '#b9f8ff', 24); }
    }
    state.shots = state.shots.filter((shot) => !shot.dead);
  }

  function updateSlashes(dt) {
    for (const slash of state.slashes) { slash.x = state.player.x; slash.y = state.player.y; slash.age += dt; for (const shot of state.shots) counterShot(shot, slash); const d = DIRS[slash.direction]; for (const enemy of state.enemies) { if (enemy.dead || slash.hits.has(enemy.id) || !slashContains(slash, enemy)) continue; slash.hits.add(enemy.id); damageEnemy(enemy, 1.25, d, { counter: false }); state.player.flow = clamp(state.player.flow + 4, 0, 100); } if (state.boss && !state.boss.dead && !slash.hits.has(state.boss.id) && slashContains(slash, state.boss)) { slash.hits.add(state.boss.id); damageBoss(1.1, d, { counter: false }); state.player.flow = clamp(state.player.flow + 3, 0, 100); } for (const debris of state.debris) { if (debris.dead || slash.hits.has(debris.id) || !slashContains(slash, debris)) continue; slash.hits.add(debris.id); debris.hp -= 1; if (debris.hp <= 0) { debris.dead = true; state.stats.deadwood += 1; state.score += 35; state.player.flow = clamp(state.player.flow + 2, 0, 100); for (let i = 0; i < 8; i += 1) spawnParticle(debris.x, debris.y, '#c7955c', 18 + i * 2); } } }
    state.slashes = state.slashes.filter((slash) => slash.age < slash.life);
  }

  function spawnParticle(x, y, color, speed = 30) { const angle = Math.random() * TAU; const magnitude = speed * (.35 + Math.random()); state.particles.push({ x, y, vx: Math.cos(angle) * magnitude, vy: Math.sin(angle) * magnitude, life: .25 + Math.random() * .35, max: .6, color, r: 1 + Math.random() * 2.4 }); if (state.particles.length > 260) state.particles.shift(); }
  function updateParticles(dt) { for (const particle of state.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .94; particle.vy *= .94; particle.life -= dt; } state.particles = state.particles.filter((particle) => particle.life > 0); for (const trail of state.player?.trail || []) trail.life -= dt; if (state.player) state.player.trail = state.player.trail.filter((trail) => trail.life > 0); for (const shot of state.shots) { for (const trail of shot.trail || []) trail.life -= dt; shot.trail = (shot.trail || []).filter((trail) => trail.life > 0); } for (const callout of state.callouts) { callout.life -= dt; callout.y -= 22 * dt; } state.callouts = state.callouts.filter((callout) => callout.life > 0); if (state.blockedHint) { state.blockedHint.life -= dt; if (state.blockedHint.life <= 0) state.blockedHint = null; } }
  const roomCleared = () => state.enemies.every((enemy) => enemy.dead) && (!state.boss || state.boss.dead);
  function advanceRoom() { const alive = state.trees.filter((tree) => tree.alive).length; const perfectGrove = alive === state.trees.length; state.stats.treesSaved += alive; if (perfectGrove) state.stats.fullGroves += 1; state.score += alive * 120 + Math.floor(state.player.flow) * 4 + (perfectGrove ? 250 : 0); state.worldsCleared += 1; const carry = { hp: clamp(state.player.hp + (perfectGrove ? 1 : 0), 1, state.player.maxHp), flow: state.player.flow * .35 }; writeBest(); setupRoom(state.worldDepth + 1, carry); audio.room(); toast(perfectGrove ? `perfect grove · +1 heartwood · step ${Math.round(state.player.dashDistance)}px` : `room ${state.worldDepth} · step ${Math.round(state.player.dashDistance)}px`); }
  function endRun(reason) { if (state.mode !== 'playing') return; state.mode = 'gameover'; writeBest(); $('gameOverTitle').textContent = reason; $('gameOverSummary').textContent = `${state.worldsCleared} rooms · ${Math.floor(state.score)} score · ${state.stats.counters} counters · ${state.stats.crosscuts} crosscuts`; $('gameOver').classList.remove('hidden'); }
  function update(dt) { if (state.mode !== 'playing') return; state.totalTime += dt; state.roomTime += dt; if (state.player.invuln > 0) state.player.invuln -= dt; if (state.player.cutCooldown > 0) state.player.cutCooldown -= dt; if (state.slowTimer > 0) state.slowTimer -= dt; if (state.flash > 0) state.flash -= dt; state.shake *= Math.pow(.02, dt); state.player.flow = Math.max(0, state.player.flow - dt * 2.35); updateMovement(dt); updateSlashes(dt); updateEnemies(dt); updateBoss(dt); updatePendingShots(dt); updateShots(dt); updateParticles(dt); if (roomCleared()) { state.roomClearTimer += dt; if (state.roomClearTimer > .92) advanceRoom(); } else state.roomClearTimer = 0; updateHud(); }

  function drawBackground() { const palette = state.room?.palette || ROOM_BLUEPRINTS[0].palette; const gradient = ctx.createLinearGradient(0, 0, W, H); gradient.addColorStop(0, palette[0]); gradient.addColorStop(.58, palette[1]); gradient.addColorStop(1, '#050a08'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = alpha(palette[2], .08); ctx.lineWidth = 1; for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 72); ctx.lineTo(x - 80, H); ctx.stroke(); } for (let y = 98; y < H; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 32); ctx.stroke(); } }
  function drawTree(tree) { const palette = state.room.palette; ctx.save(); ctx.translate(tree.x, tree.y); if (!tree.alive) { ctx.fillStyle = '#6e4b2f'; ctx.fillRect(-7, -8, 14, 22); ctx.strokeStyle = '#9d7047'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.stroke(); ctx.restore(); return; } const health = tree.hp / tree.maxHp; ctx.strokeStyle = '#6f4f30'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, -10); ctx.stroke(); ctx.fillStyle = alpha(palette[2], .35 + health * .45); for (let i = 0; i < 7; i += 1) { const angle = i * TAU / 7 + tree.phase; ctx.beginPath(); ctx.arc(Math.cos(angle) * 15, -16 + Math.sin(angle) * 10, 13, 0, TAU); ctx.fill(); } ctx.fillStyle = '#dfffd8'; ctx.fillRect(-18, 28, 36 * health, 3); ctx.restore(); }
  function drawDebris(item) { if (item.dead) return; ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.angle); ctx.strokeStyle = '#8f6340'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-item.r, 0); ctx.lineTo(item.r, 0); ctx.stroke(); ctx.strokeStyle = '#d09d67'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.moveTo(i * 7, -5); ctx.lineTo(i * 7 + 3, 5); ctx.stroke(); } ctx.restore(); }
  function drawSupportLinks() { ctx.save(); ctx.setLineDash([4, 7]); for (const chair of state.enemies.filter((enemy) => !enemy.dead && enemy.type === 'chair')) for (const enemy of state.enemies) { if (enemy.dead || enemy === chair || dist(chair, enemy) > 165) continue; ctx.strokeStyle = alpha('#a9baff', .28); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(chair.x, chair.y); ctx.lineTo(enemy.x, enemy.y); ctx.stroke(); } ctx.setLineDash([]); ctx.restore(); }
  function drawIntentLine(entity, color) { if (!entity.intent || (entity.telegraph <= 0 && entity.state !== 'evade-telegraph')) return; ctx.save(); ctx.strokeStyle = alpha(color, entity.intent.kind === 'evade' ? .45 : .62); ctx.lineWidth = entity.intent.kind === 'evade' ? 1.8 : 2.5; ctx.setLineDash(entity.intent.kind === 'evade' ? [3, 7] : [7, 6]); ctx.beginPath(); ctx.moveTo(entity.x, entity.y); ctx.lineTo(entity.intent.x, entity.intent.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = alpha(color, .18); ctx.beginPath(); ctx.arc(entity.intent.x, entity.intent.y, entity.intent.kind === 'evade' ? entity.r : 17 + Math.sin(performance.now() * .02) * 3, 0, TAU); ctx.fill(); ctx.restore(); }
  function drawEnemy(enemy) {
    if (enemy.dead) return; const spec = ENEMY_TYPES[enemy.type]; const intentColor = enemy.intent?.kind === 'evade' ? '#7cf6dc' : enemy.type === 'broker' ? '#ffe56e' : enemy.type === 'lobbyist' ? '#d698ff' : '#ff806f'; drawIntentLine(enemy, intentColor); ctx.save(); ctx.translate(enemy.x, enemy.y); if (enemy.evade?.mode === 'blink' && enemy.state === 'evade') ctx.globalAlpha = .3 + .7 * Math.abs(Math.cos(enemy.evade.t / enemy.evade.duration * Math.PI)); if (enemy.telegraph > 0) { ctx.strokeStyle = alpha('#ff7d67', .3 + .45 * Math.sin(performance.now() * .02)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 11 + enemy.telegraph * 12, 0, TAU); ctx.stroke(); } if (enemy.state === 'recover') { ctx.strokeStyle = '#a8ffb5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 8, 0, TAU); ctx.stroke(); } if (shieldProvider(enemy)) { ctx.strokeStyle = alpha('#a9baff', .65); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 6, 0, TAU); ctx.stroke(); } ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : spec.color; ctx.beginPath(); ctx.arc(0, 0, enemy.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#101315'; ctx.fillRect(-9, -5, 5, 4); ctx.fillRect(4, -5, 5, 4); ctx.strokeStyle = '#101315'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(7, 7); ctx.stroke(); if (enemy.type === 'feller') { ctx.strokeStyle = '#d7e0e0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(11, -14); ctx.lineTo(22, 12); ctx.stroke(); } if (enemy.type === 'foreman') { ctx.fillStyle = '#222'; ctx.fillRect(10, -3, 16, 7); } if (enemy.type === 'lobbyist') { ctx.fillStyle = '#f6f0ff'; ctx.fillRect(-13, 15, 26, 8); } if (enemy.type === 'chair') { ctx.strokeStyle = '#d5dcff'; ctx.lineWidth = 3; ctx.strokeRect(-15, -15, 30, 30); } if (enemy.type === 'broker') { ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.arc(0, 14, 7, 0, TAU); ctx.fill(); } if (enemy.type === 'surveyor') { ctx.strokeStyle = '#e1fff8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 11); ctx.lineTo(12, -11); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke(); } if (enemy.type === 'skidder') { ctx.strokeStyle = enemy.armor ? '#f8dc83' : '#704f20'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 5, -1.1, 1.1); ctx.stroke(); } if (enemy.type === 'mech' || enemy.type === 'mulcher') { ctx.strokeStyle = '#24130f'; ctx.lineWidth = 5; ctx.strokeRect(-enemy.r * .7, -enemy.r * .55, enemy.r * 1.4, enemy.r * 1.1); } if (enemy.boosted > 0) { ctx.strokeStyle = '#ffe56e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 10 + Math.sin(performance.now() * .02) * 2, 0, TAU); ctx.stroke(); } ctx.fillStyle = '#211515'; ctx.fillRect(-enemy.r, -enemy.r - 10, enemy.r * 2, 3); ctx.fillStyle = '#a6ffad'; ctx.fillRect(-enemy.r, -enemy.r - 10, enemy.r * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3); ctx.restore();
  }
  function drawBoss() { const boss = state.boss; if (!boss || boss.dead) return; drawIntentLine(boss, boss.phase === 3 ? '#ff5f72' : '#ff94b1'); ctx.save(); ctx.translate(boss.x, boss.y); if (boss.telegraph > 0) { ctx.strokeStyle = alpha('#ff668c', .65); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, boss.r + 18 + boss.telegraph * 20, 0, TAU); ctx.stroke(); } if (boss.state === 'recover') { ctx.strokeStyle = '#a8ffb5'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, boss.r + 12, 0, TAU); ctx.stroke(); } ctx.rotate(Math.sin(performance.now() * .002) * .08); ctx.fillStyle = boss.hitFlash > 0 ? '#fff' : '#ff668c'; ctx.beginPath(); ctx.arc(0, 0, boss.r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d9f6ff'; ctx.lineWidth = 7; for (let i = 0; i < 6; i += 1) { const angle = i * TAU / 6 + performance.now() * .001; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 28, Math.sin(angle) * 28); ctx.lineTo(Math.cos(angle) * 57, Math.sin(angle) * 57); ctx.stroke(); } ctx.fillStyle = '#10131a'; ctx.fillRect(-17, -7, 10, 7); ctx.fillRect(7, -7, 10, 7); ctx.restore(); }
  function drawShot(shot) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const trail of shot.trail || []) { ctx.fillStyle = alpha(shot.color, clamp(trail.life / (shot.friendly ? .16 : .08), 0, 1) * (shot.friendly ? .42 : .18)); ctx.beginPath(); ctx.arc(trail.x, trail.y, shot.friendly ? shot.r * 1.25 : shot.r * .65, 0, TAU); ctx.fill(); } ctx.restore(); ctx.save(); ctx.translate(shot.x, shot.y); ctx.rotate(shot.spin || 0); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = shot.color; ctx.shadowColor = shot.color; ctx.shadowBlur = shot.friendly ? 18 : 10; if (shot.kind === 'saw' || shot.kind === 'chip') { const teeth = shot.kind === 'chip' ? 5 : 8; for (let i = 0; i < teeth; i += 1) { const angle = i * TAU / teeth; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle - .15) * 13, Math.sin(angle - .15) * 13); ctx.lineTo(Math.cos(angle + .15) * 13, Math.sin(angle + .15) * 13); ctx.closePath(); ctx.fill(); } } else if (shot.kind === 'tape') ctx.fillRect(-11, -4, 22, 8); else if (shot.kind === 'paper') ctx.fillRect(-8, -6, 16, 12); else if (shot.kind === 'coin') { ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#6c5712'; ctx.fillRect(-1, -4, 2, 8); } else if (shot.kind === 'survey') { ctx.strokeStyle = shot.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(0, 0, shot.r, 0, TAU); ctx.fill(); } if (shot.friendly) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, shot.r + 4, 0, TAU); ctx.stroke(); } ctx.restore(); if (!shot.friendly && dist(shot, state.player) < 185) { const approach = shotApproachDirection(shot); ctx.save(); ctx.fillStyle = alpha('#ffffff', .68); ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(DIRS[approach].glyph, shot.x, shot.y - 16); ctx.restore(); } }
  function drawMachete(player) { const activeSlash = state.slashes.at(-1); const direction = activeSlash?.direction || player.cutDirection || (player.facing === 'left' ? 'left' : 'right'); const d = DIRS[direction]; ctx.save(); ctx.rotate(Math.atan2(d.y, d.x)); ctx.strokeStyle = '#6e4e2c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(19, 4); ctx.stroke(); ctx.strokeStyle = '#e8f3e9'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, 4); ctx.lineTo(36, -1); ctx.stroke(); ctx.lineCap = 'butt'; ctx.restore(); }
  function drawCounterCompass(player) { let nearest = null; let nearestDistance = Infinity; for (const shot of state.shots) { if (shot.friendly) continue; const distance = dist(shot, player); if (distance < nearestDistance && distance < 145) { nearest = shot; nearestDistance = distance; } } if (!nearest) return; const approach = shotApproachDirection(nearest); const d = DIRS[approach]; ctx.save(); ctx.strokeStyle = alpha('#fffce0', clamp(1 - nearestDistance / 155, .18, .8)); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x * 24 - d.y * 6, d.y * 24 + d.x * 6); ctx.lineTo(d.x * 31, d.y * 31); ctx.lineTo(d.x * 24 + d.y * 6, d.y * 24 - d.x * 6); ctx.stroke(); ctx.restore(); }
  function drawPlayer() { const p = state.player; if (!p) return; for (const trail of p.trail) { ctx.fillStyle = alpha('#8dff9b', clamp(trail.life / .18, 0, 1) * .20); ctx.beginPath(); ctx.arc(trail.x, trail.y, p.r * 1.15, 0, TAU); ctx.fill(); } ctx.save(); ctx.translate(p.x, p.y); if (p.dash) { ctx.rotate(Math.atan2(p.dash.dir.y, p.dash.dir.x)); ctx.scale(1.34, .79); } if (p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0) ctx.globalAlpha = .35; ctx.fillStyle = '#8dff9b'; ctx.shadowColor = '#8dff9b'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#102014'; ctx.fillRect(-7, -5, 4, 4); ctx.fillRect(3, -5, 4, 4); ctx.fillStyle = '#d6f7cb'; ctx.beginPath(); ctx.moveTo(-6, -13); ctx.lineTo(-1, -23); ctx.lineTo(2, -12); ctx.fill(); ctx.beginPath(); ctx.moveTo(2, -13); ctx.lineTo(8, -21); ctx.lineTo(8, -10); ctx.fill(); ctx.restore(); ctx.save(); ctx.translate(p.x, p.y); drawMachete(p); drawCounterCompass(p); ctx.restore(); }
  function drawSlashes() { for (const slash of state.slashes) { const d = DIRS[slash.direction]; const t = slash.age / slash.life; ctx.save(); ctx.translate(slash.x, slash.y); ctx.rotate(Math.atan2(d.y, d.x)); ctx.strokeStyle = alpha('#ecffe9', 1 - t); ctx.lineWidth = 8 * (1 - t) + 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(6, 0, 54, -.62, .62); ctx.stroke(); ctx.strokeStyle = alpha('#85ffab', .7 * (1 - t)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, 0, 66, -.55, .55); ctx.stroke(); ctx.restore(); } }
  function drawParticles() { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const particle of state.particles) { ctx.fillStyle = alpha(particle.color, clamp(particle.life / particle.max, 0, 1)); ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r, 0, TAU); ctx.fill(); } ctx.restore(); }
  function drawCallouts() { ctx.save(); ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; for (const callout of state.callouts) { ctx.globalAlpha = clamp(callout.life / callout.max, 0, 1); ctx.fillStyle = callout.color; ctx.fillText(callout.text, callout.x, callout.y); } ctx.restore(); }
  function drawBlockedHint() { if (!state.blockedHint) return; ctx.save(); ctx.strokeStyle = alpha('#ffc86e', clamp(state.blockedHint.life / .28, 0, 1)); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(state.blockedHint.x, state.blockedHint.y, 24, 0, TAU); ctx.stroke(); ctx.restore(); }
  function render() { const shakeX = state.shake ? (Math.random() - .5) * state.shake : 0; const shakeY = state.shake ? (Math.random() - .5) * state.shake : 0; const scale = window.SylvariaDisplayScale?.scale || 1; ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.translate(shakeX, shakeY); drawBackground(); for (const tree of state.trees) drawTree(tree); for (const item of state.debris) drawDebris(item); drawSupportLinks(); for (const enemy of state.enemies) drawEnemy(enemy); drawBoss(); for (const shot of state.shots) drawShot(shot); drawPlayer(); drawSlashes(); drawParticles(); drawCallouts(); drawBlockedHint(); if (state.roomClearTimer > 0) { ctx.fillStyle = alpha('#8dff9b', clamp(state.roomClearTimer, 0, .7) * .25); ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#efffed'; ctx.font = '700 28px system-ui'; ctx.textAlign = 'center'; ctx.fillText('GROVE SECURED', W / 2, H / 2); } if (state.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${state.flash})`; ctx.fillRect(0, 0, W, H); } ctx.restore(); }

  function updateHud(force = false) { if (!state.player || !state.room) return; if (force) { $('roomTitle').textContent = state.room.title; $('roomTask').textContent = state.room.hint; $('roomKicker').textContent = `room ${String(state.worldDepth).padStart(3, '0')} · countercut expedition`; $('biomeBadge').textContent = state.room.subtitle; } $('score').textContent = Math.floor(state.score); $('time').textContent = formatTime(state.totalTime); $('integrity').textContent = '◆'.repeat(Math.max(0, state.player.hp)) + '◇'.repeat(Math.max(0, state.player.maxHp - state.player.hp)); $('flowState').textContent = `${Math.round(state.player.flow)}%`; $('dashState').textContent = state.slowTimer > 0 ? 'RED TAPE' : state.player.dash ? 'STEP' : `${Math.round(state.player.dashDistance)}px`; $('treeState').textContent = `${state.trees.filter((tree) => tree.alive).length}/${state.trees.length}`; $('counterState').textContent = String(state.stats.counters); const graze = $('grazeState'); if (graze) graze.textContent = String(state.stats.grazes); const returnState = $('returnState'); if (returnState) returnState.textContent = `${state.stats.crosscuts}/${state.stats.longReturns}`; $('bossWrap').hidden = !state.boss; if (state.boss) $('bossState').textContent = state.boss.dead ? 'DOWN' : `P${state.boss.phase} · ${state.boss.state === 'recover' ? 'OPEN · ' : ''}${Math.ceil(state.boss.hp)}/${state.boss.maxHp}`; }
  function formatTime(seconds) { const minutes = Math.floor(seconds / 60); const remaining = seconds - minutes * 60; return `${minutes}:${remaining.toFixed(1).padStart(4, '0')}`; }
  function toast(text) { const element = $('toast'); if (!element) return; element.textContent = text; element.classList.add('show'); clearTimeout(toast._timer); toast._timer = setTimeout(() => element.classList.remove('show'), 1800); }
  function startRun(mode = 'run') { state.mode = 'playing'; state.runMode = mode; state.score = 0; state.totalTime = 0; state.worldsCleared = 0; state.stats = freshStats(); document.querySelectorAll('.screen').forEach((element) => element.classList.add('hidden')); $('hud').classList.remove('hidden'); setupRoom(1); canvas.focus(); audio.ensure(); toast('WASD queues steps · arrows counter · M mutes'); }

  function shotSnapshot(shot) { return { x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, speed: Math.hypot(shot.vx, shot.vy), kind: shot.kind, friendly: shot.friendly, pattern: shot.pattern, beneficiaryId: shot.beneficiaryId || null, counterQuality: shot.counterQuality || null, counterTargetId: shot.counterTargetId || null, originalOwnerId: shot.originalOwnerId || null, reflectedTravel: shot.reflectedTravel || 0, pierces: shot.pierces || 0 }; }
  function snapshot() { return { title: 'Sylvaria', version: VERSION, mode: state.mode, sectorIndex: state.roomIndex, worldDepth: state.worldDepth, worldsCleared: state.worldsCleared, score: state.score, fps: state.fps, room: state.room ? { title: state.room.title, subtitle: state.room.subtitle, seed: state.room.seed } : null, player: state.player ? { x: state.player.x, y: state.player.y, hp: state.player.hp, maxHp: state.player.maxHp, flow: state.player.flow, dashDistance: state.player.dashDistance, dashing: Boolean(state.player.dash), bufferedMove: state.moveQueue?.key || null } : null, enemies: state.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ id: enemy.id, type: enemy.type, x: enemy.x, y: enemy.y, r: enemy.r, hp: enemy.hp, maxHp: enemy.maxHp, pattern: enemy.state, boosted: enemy.boosted > 0, shielded: Boolean(shieldProvider(enemy)), evading: Boolean(enemy.evade), counterStagger: enemy.counterStagger, intent: enemy.intent ? { ...enemy.intent } : null })), boss: state.boss ? { id: state.boss.id, type: 'boss', x: state.boss.x, y: state.boss.y, r: state.boss.r, hp: state.boss.hp, maxHp: state.boss.maxHp, phase: state.boss.phase, dead: state.boss.dead, state: state.boss.state, vulnerable: state.boss.state === 'recover', intent: state.boss.intent ? { ...state.boss.intent } : null } : null, trees: state.trees.map((tree) => ({ id: tree.id, x: tree.x, y: tree.y, hp: tree.hp, alive: tree.alive })), debris: state.debris.map((item) => ({ id: item.id, x: item.x, y: item.y, hp: item.hp, dead: item.dead })), shots: state.shots.map(shotSnapshot), pendingShots: state.pendingShots.length, stats: { ...state.stats, casts: state.stats.cuts }, dashDistance: state.player?.dashDistance || 0, roomCleared: roomCleared(), slowTimer: state.slowTimer, muted: state.muted, portalOpen: false, portalReady: false, portalPhase: 'retired', targets: [], stones: 0, stoneQuota: 0 }; }
  function placeDeadwoodAhead(direction = 'right', distance = 34) { const d = DIRS[direction] || DIRS.right; const p = state.player; const item = { id: `playtest-deadwood-${performance.now()}`, x: clamp(p.x + d.x * distance, 45, W - 45), y: clamp(p.y + d.y * distance, 95, H - 45), r: 18, hp: 2, dead: false, angle: 0 }; state.debris.push(item); return snapshot(); }
  function spawnCounterShot(direction = 'right', distance = 92, options = {}) { const d = DIRS[direction] || DIRS.right; const p = state.player; const speed = options.speed || 245; const owner = options.ownerId ? state.enemies.find((enemy) => enemy.id === options.ownerId) : null; const shot = { x: p.x + d.x * distance, y: p.y + d.y * distance, vx: -d.x * speed, vy: -d.y * speed, r: 6, life: 2.4, kind: options.kind || 'nail', color: SHOT_COLORS[options.kind || 'nail'] || '#ffad79', friendly: false, owner, originalOwnerId: owner?.id || options.originalOwnerId || null, damage: 1, dead: false, spin: 0, grazed: false, age: 0, pattern: options.pattern || 'straight', baseSpeed: speed, patternPhase: options.patternPhase || 0, patternAmp: options.patternAmp || 90, patternFreq: options.patternFreq || 7, turnRate: options.turnRate || .6, turnAt: options.turnAt || .35, turnAngle: options.turnAngle || .45, turned: false, beneficiaryId: null, trail: [], counterQuality: null, counterTargetId: null, reflectedTravel: 0, hitIds: new Set(), pierces: 0 }; state.shots.push(shot); return snapshot(); }
  function spawnTestEnemy(type = 'foreman', x = 520, y = H / 2, id = null) { const spec = ENEMY_TYPES[type]; const enemy = { id: id || `playtest-${type}-${state.enemies.length}`, type, x, y, r: spec.r, hp: spec.hp * 4, maxHp: spec.hp * 4, clock: 99, telegraph: 0, state: 'move', phase: 0, angle: 0, armor: type === 'skidder' ? 1 : 0, boosted: 0, intent: null, attackCount: 0, rngState: hash(`playtest:${type}:${x}:${y}`), hitFlash: 0, dead: false, evadeCooldown: 99, evade: null, counterStagger: 0 }; state.enemies.push(enemy); return enemy.id; }
  function clearCombatants() { state.enemies = []; state.boss = null; state.shots = []; state.pendingShots = []; }
  function setPlayerPosition(x, y) { state.player.x = clamp(x, 34, W - 34); state.player.y = clamp(y, 88, H - 35); state.player.dash = null; state.moveQueue = null; return snapshot(); }
  function forceEvade(type = 'surveyor', distance = 80) { clearCombatants(); state.trees = []; state.debris = []; const x = clamp(state.player.x + distance, 180, W - 100); const id = spawnTestEnemy(type, x, state.player.y); const enemy = state.enemies.find((candidate) => candidate.id === id); enemy.evadeCooldown = 0; maybeBeginEvade(enemy); return snapshot(); }

  window.__MOSSLIGHT_PLAYTEST__ = { title: 'Sylvaria', version: VERSION, roomCount: 10, roomTitles: ROOM_BLUEPRINTS.map((room) => room.title), snapshot, setRoom(index, depth = index + 1) { setupRoom(depth || index + 1); state.mode = 'playing'; return snapshot(); }, completeRoom() { state.enemies.forEach((enemy) => { enemy.dead = true; }); if (state.boss) state.boss.dead = true; return snapshot(); }, defeatBoss() { if (state.boss) state.boss.dead = true; return snapshot(); }, advance() { advanceRoom(); return snapshot(); }, cut(direction) { cut(direction); return snapshot(); }, dash(direction) { dashStep(DIRS[direction] || DIRS.right); return snapshot(); }, requestDash(key) { requestDash(key, true); return snapshot(); }, spawnCounterShot, placeDeadwoodAhead, damagePlayer(amount = 1) { damagePlayer(amount); return snapshot(); }, setFlow(value) { state.player.flow = clamp(value, 0, 100); return snapshot(); }, roomBlueprint(depth) { return roomBlueprint(depth); }, forceBossPhase(phase) { if (!state.boss) return snapshot(); state.boss.phase = clamp(phase, 1, 3); state.boss.hp = state.boss.maxHp * (phase === 1 ? .9 : phase === 2 ? .55 : .25); state.boss.state = 'move'; state.boss.clock = .01; return snapshot(); }, clearCombatants() { clearCombatants(); return snapshot(); }, spawnTestEnemy, setPlayerPosition, forceEvade, firePattern(pattern = 'zigzag', direction = 'right', distance = 130) { return spawnCounterShot(direction, distance, { pattern }); } };
  window.MosslightExpedition = { atlasCount: 1000, summary: () => ({ atlasCount: 1000, worlds: Array.from({ length: 10 }, (_, index) => ({ index: index + 1 })), deck: { cursor: 10 } }), newRun: () => ({}) };
  window.MosslightDirector = { movementPatterns: ['telegraph-lock', 'cardinal-counter', 'orbit', 'charge-recover', 'shield-support', 'subsidy-intercept', 'tree-pressure', 'backstep', 'blink-evade'], projectilePatterns: ['straight', 'zigzag', 'wave', 'spiral', 'swerve', 'wobble', 'return'], powerups: [], summary: () => ROOM_BLUEPRINTS.map((room, index) => ({ room: index + 1, situation: room.subtitle })) };

  document.addEventListener('keydown', (event) => { const key = normKey(event.key); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'enter'].includes(key)) event.preventDefault(); if (key === 'm') { state.muted = !state.muted; toast(state.muted ? 'sound muted' : 'sound on'); if (!state.muted) audio.ensure(); return; } if (state.mode === 'menu' && key === 'enter') { startRun('run'); return; } if (key === 'p' && state.mode === 'paused') { state.mode = 'playing'; $('pauseScreen').classList.add('hidden'); canvas.focus(); return; } if (state.mode !== 'playing') return; if (event.repeat) return; if (MOVE_DIRS[key]) { state.heldMoves.add(key); state.heldOrder = state.heldOrder.filter((entry) => entry !== key); state.heldOrder.push(key); requestDash(key, true); return; } if (CUT_KEYS[key]) { cut(CUT_KEYS[key]); return; } if (key === 'p') { state.mode = 'paused'; state.moveQueue = null; $('pauseScreen').classList.remove('hidden'); } });
  document.addEventListener('keyup', (event) => { const key = normKey(event.key); if (MOVE_DIRS[key]) { state.heldMoves.delete(key); state.heldOrder = state.heldOrder.filter((entry) => entry !== key); /* queued taps survive keyup */ } });
  window.addEventListener('blur', () => { state.heldMoves.clear(); state.heldOrder = []; state.moveQueue = null; });
  $('start')?.addEventListener('click', () => startRun('run')); $('explore')?.addEventListener('click', () => startRun('explore')); $('restartRun')?.addEventListener('click', () => { $('gameOver').classList.add('hidden'); startRun('run'); }); $('menuFromGameOver')?.addEventListener('click', () => { state.mode = 'menu'; $('gameOver').classList.add('hidden'); $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); }); $('resume')?.addEventListener('click', () => { state.mode = 'playing'; $('pauseScreen').classList.add('hidden'); canvas.focus(); }); $('howBtn')?.addEventListener('click', () => { $('title').classList.add('hidden'); $('howScreen').classList.remove('hidden'); }); $('controlsBtn')?.addEventListener('click', () => { $('title').classList.add('hidden'); $('controlsScreen').classList.remove('hidden'); }); document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.screen').forEach((element) => element.classList.add('hidden')); $('title').classList.remove('hidden'); })); $('bestRun').textContent = `best · room ${state.best.room || 0} · ${state.best.score || 0} score`;

  let accumulator = 0; let last = performance.now(); let fpsClock = performance.now(); let frames = 0;
  function frame(now) { const elapsed = Math.min(.08, (now - last) / 1000); last = now; accumulator += elapsed; while (accumulator >= FIXED_DT) { update(FIXED_DT); accumulator -= FIXED_DT; } render(); frames += 1; if (now - fpsClock >= 500) { state.fps = frames * 1000 / (now - fpsClock); frames = 0; fpsClock = now; } requestAnimationFrame(frame); }
  setupRoom(1); state.mode = 'menu'; drawBackground(); requestAnimationFrame(frame);
})();
