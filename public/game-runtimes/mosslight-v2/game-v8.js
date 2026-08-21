(() => {
  'use strict';

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const VERSION = '0.8.0';
  const canvas = document.getElementById('c');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const normKey = (key) => String(key || '').toLowerCase();
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const alpha = (hex, a) => {
    let raw = String(hex || '#ffffff').replace('#', '');
    if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
    const n = Number.parseInt(raw, 16) || 0xffffff;
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const hash = (value) => {
    let h = 2166136261;
    for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
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

  const DIRS = Object.freeze({
    up: { x: 0, y: -1, key: 'arrowup', glyph: '↑' },
    down: { x: 0, y: 1, key: 'arrowdown', glyph: '↓' },
    left: { x: -1, y: 0, key: 'arrowleft', glyph: '←' },
    right: { x: 1, y: 0, key: 'arrowright', glyph: '→' },
  });
  const MOVE_DIRS = Object.freeze({ w: DIRS.up, s: DIRS.down, a: DIRS.left, d: DIRS.right });
  const CUT_KEYS = Object.freeze({ arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' });

  const ENEMY_TYPES = Object.freeze({
    feller: { name: 'Rookie Feller', hp: 3, speed: 55, r: 16, color: '#ffb36b', reward: 90, blurb: 'Telegraphs a broad axe swing, then commits.' },
    foreman: { name: 'Nailgun Foreman', hp: 4, speed: 44, r: 17, color: '#ff7f66', reward: 120, blurb: 'Fires crisp cardinal nail bursts that beg to be counter-cut.' },
    lobbyist: { name: 'Timber Lobbyist', hp: 4, speed: 40, r: 16, color: '#d698ff', reward: 145, blurb: 'Launches red tape. Counter it or lose dash cadence.' },
    skidder: { name: 'Skidder Bruiser', hp: 7, speed: 34, r: 22, color: '#ffc85c', reward: 190, blurb: 'Armored front, vulnerable after a long committed charge.' },
    drone: { name: 'Harvester Drone', hp: 5, speed: 70, r: 15, color: '#7de6ff', reward: 170, blurb: 'Orbits trees and throws rotating saw-discs.' },
    chair: { name: 'Committee Chair', hp: 6, speed: 31, r: 18, color: '#8ea2ff', reward: 210, blurb: 'Projects procedural armor while firing enormous paperwork.' },
    broker: { name: 'Subsidy Broker', hp: 5, speed: 48, r: 17, color: '#f6e17b', reward: 190, blurb: 'Throws coin arcs that accelerate other cutters.' },
    mech: { name: 'Clearcut Mech', hp: 10, speed: 28, r: 25, color: '#ff6f6f', reward: 280, blurb: 'Alternates saw-lanes, bullets, and tree-targeting bursts.' },
  });

  const ROOM_BLUEPRINTS = Object.freeze([
    { title: 'Trailhead Trespass', subtitle: 'learn the step-dash', palette: ['#07160f','#123a24','#79ef91','#f4e4a5'], trees: 5, deadwood: 4, enemies: ['feller','feller'], dash: 48, hint: 'WASD step-dashes. Arrow keys cut. Save the trees.' },
    { title: 'Nailgun Nursery', subtitle: 'first real counters', palette: ['#061713','#0d4634','#70ffd0','#ffc274'], trees: 5, deadwood: 5, enemies: ['foreman','feller','foreman'], dash: 50, hint: 'Cut toward incoming nails to reflect them.' },
    { title: 'Red Tape Ravine', subtitle: 'bureaucracy has projectiles', palette: ['#101322','#263866','#a9baff','#ff87bf'], trees: 6, deadwood: 5, enemies: ['lobbyist','foreman','feller'], dash: 52, hint: 'Red tape slows your dash repeat. Send it back.' },
    { title: 'Skidder Switchback', subtitle: 'commitment beats armor', palette: ['#171107','#4c3212','#f7cc69','#7bffa4'], trees: 6, deadwood: 6, enemies: ['skidder','feller','foreman'], dash: 54, hint: 'Bait the Skidder charge, step aside, cut its exposed rear.' },
    { title: 'Sawdisc Wetland', subtitle: 'moving counter geometry', palette: ['#04141a','#07556b','#78e7ff','#ffba8c'], trees: 7, deadwood: 6, enemies: ['drone','drone','foreman'], dash: 56, hint: 'Saw-discs curve. Counter from the side they actually reach you.' },
    { title: 'Committee Canopy', subtitle: 'delay tactics', palette: ['#0c1022','#263570','#9cafef','#e4d2ff'], trees: 7, deadwood: 7, enemies: ['chair','lobbyist','foreman'], dash: 58, hint: 'The Chair shields nearby cutters. Break the committee first.' },
    { title: 'Subsidy Grove', subtitle: 'enemy synergies', palette: ['#161707','#52500e','#fff078','#ff8b6f'], trees: 8, deadwood: 7, enemies: ['broker','skidder','feller','foreman'], dash: 60, hint: 'Coin boosts make slow enemies nasty. Counter the money.' },
    { title: 'Clearcut Conveyor', subtitle: 'protect moving priorities', palette: ['#160a0a','#562020','#ff786e','#e2f58a'], trees: 8, deadwood: 8, enemies: ['mech','drone','foreman','feller'], dash: 62, hint: 'The mech attacks trees directly. Interrupt its telegraphed burst.' },
    { title: 'Four-Way Firebreak', subtitle: 'counter fluency check', palette: ['#07110f','#284835','#8dff9b','#ffb568'], trees: 9, deadwood: 9, enemies: ['lobbyist','drone','skidder','foreman','chair'], dash: 64, hint: 'Dash and cut can overlap. Move one direction, defend another.' },
    { title: 'PAC-a-Saw Summit', subtitle: 'boss · fully subsidized', palette: ['#050914','#1d2854','#89d8ff','#ff6f92'], trees: 10, deadwood: 10, enemies: [], dash: 66, boss: true, hint: 'Three phases. Read the lane, counter the paperwork, punish the saw.' },
  ]);

  const state = {
    mode: 'menu', runMode: 'run', roomIndex: 0, worldDepth: 1, worldsCleared: 0, score: 0, totalTime: 0, roomTime: 0, fps: 60,
    player: null, room: null, enemies: [], shots: [], particles: [], slashes: [], trees: [], debris: [], boss: null,
    flash: 0, shake: 0, slowTimer: 0, roomClearTimer: 0,
    stats: { cuts: 0, hits: 0, counters: 0, perfectCounters: 0, kills: 0, treesSaved: 0, deadwood: 0, dashes: 0, damageTaken: 0 },
    heldMoves: new Set(), moveRepeat: { key: null, timer: 0 }, keys: new Set(), best: readBest(),
  };

  function readBest() {
    try { return JSON.parse(localStorage.getItem('sid.sylvaria.countercut.v8.best') || 'null') || { room: 0, score: 0 }; }
    catch { return { room: 0, score: 0 }; }
  }
  function writeBest() {
    const best = { room: Math.max(state.best.room || 0, state.worldDepth), score: Math.max(state.best.score || 0, Math.floor(state.score)) };
    state.best = best;
    try { localStorage.setItem('sid.sylvaria.countercut.v8.best', JSON.stringify(best)); } catch {}
  }
  function randomPoint(rng, margin = 70) { return { x: margin + rng() * (W - margin * 2), y: 105 + rng() * (H - 175) }; }
  function proceduralBlueprint(depth) {
    const rng = rngFrom(hash(`sylvaria-room-${depth}`));
    const roster = Object.keys(ENEMY_TYPES);
    const count = clamp(3 + Math.floor(Math.log2(depth + 1)), 4, 8);
    const enemies = Array.from({ length: count }, (_, i) => roster[(Math.floor(rng() * roster.length) + i) % roster.length]);
    const palettes = ROOM_BLUEPRINTS[Math.floor(rng() * ROOM_BLUEPRINTS.length)].palette;
    return { title: `Wild Sector ${String(depth).padStart(3, '0')}`, subtitle: 'seeded forest counter-scenario', palette: palettes, trees: clamp(6 + Math.floor(depth / 6), 7, 12), deadwood: clamp(5 + Math.floor(depth / 8), 5, 12), enemies, dash: clamp(66 + Math.floor((depth - 10) / 4) * 3, 66, 104), hint: 'Longer steps are faster and riskier. Commit carefully, cut independently.', boss: depth % 10 === 0 };
  }

  function setupRoom(depth) {
    state.worldDepth = depth; state.roomIndex = (depth - 1) % 10;
    const blueprint = depth <= 10 ? ROOM_BLUEPRINTS[depth - 1] : proceduralBlueprint(depth);
    const rng = rngFrom(hash(`layout-${depth}`)); state.room = { ...blueprint, seed: hash(`layout-${depth}`) };
    state.player = { x: 108, y: H / 2, r: 14, hp: 5, maxHp: 5, facing: 'right', dash: null, dashCooldown: 0, cutCooldown: 0, invuln: 0, flow: 0, dashDistance: blueprint.dash, trail: [] };
    state.enemies = []; state.shots = []; state.particles = []; state.slashes = []; state.trees = []; state.debris = []; state.boss = null;
    state.roomTime = 0; state.roomClearTimer = 0; state.slowTimer = 0; state.flash = 0; state.shake = 0; state.heldMoves.clear(); state.moveRepeat = { key: null, timer: 0 };
    for (let i = 0; i < blueprint.trees; i += 1) { let p = randomPoint(rng, 105); if (p.x < 230) p.x += 180; state.trees.push({ ...p, r: 22 + rng() * 7, hp: 5, maxHp: 5, phase: rng() * TAU, alive: true }); }
    for (let i = 0; i < blueprint.deadwood; i += 1) { const p = randomPoint(rng, 80); state.debris.push({ ...p, r: 15 + rng() * 8, hp: 2, dead: false, angle: rng() * TAU }); }
    blueprint.enemies.forEach((type, i) => spawnEnemy(type, rng, i)); if (blueprint.boss) spawnBoss(); updateHud(true);
  }
  function spawnEnemy(type, rng, index = 0) {
    const spec = ENEMY_TYPES[type]; const p = randomPoint(rng, 110); p.x = Math.max(360, p.x); const hpScale = 1 + Math.max(0, state.worldDepth - 10) * .025;
    state.enemies.push({ id: `${type}-${state.worldDepth}-${index}`, type, ...p, r: spec.r, hp: Math.ceil(spec.hp * hpScale), maxHp: Math.ceil(spec.hp * hpScale), clock: .4 + rng() * 1.6, phase: rng() * TAU, telegraph: 0, state: 'move', dead: false, armor: type === 'skidder' ? 1 : 0, boosted: 0, angle: rng() * TAU });
  }
  function spawnBoss() {
    state.boss = { id: `pac-a-saw-${state.worldDepth}`, type: 'boss', name: 'PAC-a-Saw', x: 720, y: H / 2, r: 42, hp: 36 + Math.max(0, state.worldDepth - 10) * 2, maxHp: 36 + Math.max(0, state.worldDepth - 10) * 2, phase: 1, clock: 1.2, telegraph: 0, state: 'move', angle: 0, dead: false, slogan: 'FULLY SUBSIDIZED · MINIMALLY ACCOUNTABLE' };
  }

  function dashStep(dir, sourceKey = null) {
    const p = state.player; if (!p || state.mode !== 'playing' || p.dash || p.dashCooldown > 0) return false;
    const slow = state.slowTimer > 0 ? .72 : 1; const flowBonus = 1 + Math.min(.14, p.flow * .0014); const distance = p.dashDistance * slow * flowBonus;
    const sx = p.x, sy = p.y; const tx = clamp(sx + dir.x * distance, 30, W - 30); const ty = clamp(sy + dir.y * distance, 82, H - 34);
    p.dash = { sx, sy, tx, ty, t: 0, duration: .105, dir }; p.facing = dir.x < 0 ? 'left' : dir.x > 0 ? 'right' : p.facing; p.dashCooldown = .038;
    state.stats.dashes += 1; state.shake = Math.max(state.shake, 1.5); for (let i = 0; i < 4; i += 1) spawnParticle(sx - dir.x * i * 5, sy - dir.y * i * 5, '#8dff9b', 8 + i * 3);
    if (sourceKey) state.moveRepeat = { key: sourceKey, timer: .16 }; return true;
  }
  function updateDash(dt) {
    const p = state.player; if (!p) return; if (p.dashCooldown > 0) p.dashCooldown -= dt; if (!p.dash) return;
    p.dash.t += dt; const t = clamp(p.dash.t / p.dash.duration, 0, 1); const e = easeOut(t); p.x = lerp(p.dash.sx, p.dash.tx, e); p.y = lerp(p.dash.sy, p.dash.ty, e);
    p.trail.push({ x: p.x, y: p.y, life: .18 }); if (p.trail.length > 10) p.trail.shift(); if (t >= 1) p.dash = null;
  }
  function updateHeldMovement(dt) {
    if (state.mode !== 'playing') return; if (state.moveRepeat.timer > 0) state.moveRepeat.timer -= dt;
    const active = state.moveRepeat.key && state.heldMoves.has(state.moveRepeat.key) ? state.moveRepeat.key : [...state.heldMoves][state.heldMoves.size - 1];
    if (!active) { state.moveRepeat.key = null; return; }
    if (!state.player.dash && state.player.dashCooldown <= 0 && state.moveRepeat.timer <= 0) dashStep(MOVE_DIRS[active], active);
  }

  function cut(direction) {
    const p = state.player; if (!p || state.mode !== 'playing' || p.cutCooldown > 0) return false; const d = DIRS[direction];
    p.cutCooldown = .19; p.facing = d.x < 0 ? 'left' : d.x > 0 ? 'right' : p.facing; state.stats.cuts += 1;
    state.slashes.push({ direction, x: p.x, y: p.y, age: 0, life: .13, reach: 78, width: 58, hits: new Set() }); state.shake = Math.max(state.shake, 2.2); spawnParticle(p.x + d.x * 34, p.y + d.y * 34, '#d9ffd7', 20); return true;
  }
  function slashContains(slash, obj) {
    const d = DIRS[slash.direction], ox = obj.x - slash.x, oy = obj.y - slash.y, along = ox * d.x + oy * d.y, side = Math.abs(ox * -d.y + oy * d.x);
    return along >= 4 - obj.r && along <= slash.reach + obj.r && side <= slash.width * .5 + obj.r;
  }
  function shotApproachDirection(shot) {
    const dx = shot.x - state.player.x, dy = shot.y - state.player.y; if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'; return dy < 0 ? 'up' : 'down';
  }
  function counterShot(shot, slash) {
    if (shot.dead || shot.friendly) return false; const approach = shotApproachDirection(shot); if (approach !== slash.direction || !slashContains(slash, shot)) return false;
    const d = DIRS[slash.direction], perfect = slash.age <= .075; shot.friendly = true; shot.owner = null; shot.vx = d.x * (perfect ? 680 : 570); shot.vy = d.y * (perfect ? 680 : 570); shot.damage = perfect ? 3 : 2; shot.color = perfect ? '#ffffff' : '#99ffb3'; shot.life = 1.3;
    state.stats.counters += 1; if (perfect) state.stats.perfectCounters += 1; state.player.flow = clamp(state.player.flow + (perfect ? 18 : 10), 0, 100); state.score += perfect ? 120 : 70; state.flash = Math.max(state.flash, perfect ? .18 : .08); state.shake = Math.max(state.shake, perfect ? 6 : 3);
    for (let i = 0; i < (perfect ? 12 : 7); i += 1) spawnParticle(shot.x, shot.y, perfect ? '#fff8bb' : '#93ffb2', 30 + i * 2); return true;
  }

  function damageEnemy(enemy, amount, hitDir = null) {
    if (!enemy || enemy.dead) return; if (enemy.type === 'skidder' && enemy.armor > 0 && enemy.state !== 'recover') amount *= .25; enemy.hp -= amount; enemy.hitFlash = .12; state.stats.hits += 1;
    if (hitDir) { enemy.x += hitDir.x * 8; enemy.y += hitDir.y * 8; }
    if (enemy.hp <= 0) { enemy.dead = true; state.stats.kills += 1; state.score += (ENEMY_TYPES[enemy.type]?.reward || 250) + state.player.flow * 2; state.player.flow = clamp(state.player.flow + 8, 0, 100); for (let i = 0; i < 14; i += 1) spawnParticle(enemy.x, enemy.y, ENEMY_TYPES[enemy.type]?.color || '#ff8f73', 24 + i * 2); }
  }
  function damageBoss(amount, hitDir = null) {
    const boss = state.boss; if (!boss || boss.dead) return; const armored = boss.state !== 'recover' && boss.phase >= 2; boss.hp -= armored ? amount * .45 : amount; boss.hitFlash = .13;
    if (hitDir) { boss.x += hitDir.x * 5; boss.y += hitDir.y * 5; }
    if (boss.hp <= boss.maxHp * .66 && boss.phase === 1) { boss.phase = 2; boss.clock = .7; toast('PAC-a-Saw phase 2 · paperwork barrage'); }
    if (boss.hp <= boss.maxHp * .33 && boss.phase === 2) { boss.phase = 3; boss.clock = .55; toast('PAC-a-Saw phase 3 · emergency clearcut'); }
    if (boss.hp <= 0) { boss.dead = true; state.score += 1600; state.stats.kills += 1; for (let i = 0; i < 45; i += 1) spawnParticle(boss.x, boss.y, i % 2 ? '#ff7b9b' : '#91f7ff', 35 + i); }
  }
  function damagePlayer(amount, source = null) {
    const p = state.player; if (!p || p.invuln > 0 || state.mode !== 'playing') return; p.hp -= amount; p.invuln = .68; p.flow = Math.max(0, p.flow - 25); state.stats.damageTaken += amount; state.shake = 9; state.flash = .3;
    if (source) { const dx = p.x - source.x, dy = p.y - source.y, mag = Math.hypot(dx, dy) || 1; p.x = clamp(p.x + dx / mag * 18, 30, W - 30); p.y = clamp(p.y + dy / mag * 18, 82, H - 34); }
    if (p.hp <= 0) endRun('Sprid was overwhelmed');
  }
  function nearestLivingTree(from) { let best = null, bestD = Infinity; for (const tree of state.trees) { if (!tree.alive) continue; const d = dist(from, tree); if (d < bestD) { bestD = d; best = tree; } } return best; }
  function moveToward(enemy, target, speed, dt) { if (!target) return; const dx = target.x - enemy.x, dy = target.y - enemy.y, m = Math.hypot(dx, dy) || 1; enemy.x += dx / m * speed * dt; enemy.y += dy / m * speed * dt; }
  function fireShot(enemy, target, kind = 'nail', speed = 330, spread = 0) {
    if (!target) return; const dx = target.x - enemy.x, dy = target.y - enemy.y, base = Math.atan2(dy, dx) + spread; const colors = { nail: '#ffad79', tape: '#dba0ff', saw: '#75e7ff', paper: '#a9baff', coin: '#ffe56e', boss: '#ff6f92' };
    state.shots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed, r: kind === 'saw' ? 9 : 6, life: 3, kind, color: colors[kind], friendly: false, owner: enemy, damage: 1, dead: false, spin: 0 });
  }
  function enemyAttack(enemy, spec) {
    const p = state.player; if (!p) return;
    if (enemy.type === 'feller') { if (dist(enemy, p) < 62) damagePlayer(1, enemy); else moveToward(enemy, p, spec.speed * 2, .18); }
    else if (enemy.type === 'foreman') { fireShot(enemy, p, 'nail', 360); if (state.worldDepth >= 5) { fireShot(enemy, p, 'nail', 360, -.12); fireShot(enemy, p, 'nail', 360, .12); } }
    else if (enemy.type === 'lobbyist') fireShot(enemy, p, 'tape', 280);
    else if (enemy.type === 'drone') fireShot(enemy, p, 'saw', 300);
    else if (enemy.type === 'chair') { fireShot(enemy, p, 'paper', 250); state.enemies.filter((e) => !e.dead && e !== enemy && dist(e, enemy) < 150).forEach((e) => { e.boosted = .9; }); }
    else if (enemy.type === 'broker') { for (const s of [-.22, 0, .22]) fireShot(enemy, p, 'coin', 285, s); state.enemies.filter((e) => !e.dead && e !== enemy && dist(e, enemy) < 180).forEach((e) => { e.boosted = 1.2; }); }
    else if (enemy.type === 'skidder') { enemy.state = 'charge'; enemy.chargeDir = { x: p.x - enemy.x, y: p.y - enemy.y }; const m = Math.hypot(enemy.chargeDir.x, enemy.chargeDir.y) || 1; enemy.chargeDir.x /= m; enemy.chargeDir.y /= m; enemy.chargeTime = .42; }
    else if (enemy.type === 'mech') { const tree = nearestLivingTree(enemy); if (tree && Math.random() < .55) fireShot(enemy, tree, 'boss', 300); else for (const s of [-.18,0,.18]) fireShot(enemy, p, 'boss', 320, s); }
  }

  function updateEnemies(dt) {
    const p = state.player; if (!p) return;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue; if (enemy.hitFlash > 0) enemy.hitFlash -= dt; if (enemy.boosted > 0) enemy.boosted -= dt; const spec = ENEMY_TYPES[enemy.type], boost = enemy.boosted > 0 ? 1.45 : 1;
      if (enemy.type === 'skidder' && enemy.state === 'charge') {
        enemy.x += enemy.chargeDir.x * 430 * dt; enemy.y += enemy.chargeDir.y * 430 * dt; enemy.chargeTime -= dt; if (dist(enemy, p) < enemy.r + p.r + 4) damagePlayer(1, enemy);
        if (enemy.chargeTime <= 0 || enemy.x < 35 || enemy.x > W - 35 || enemy.y < 85 || enemy.y > H - 30) { enemy.state = 'recover'; enemy.clock = .85; enemy.armor = 0; } continue;
      }
      if (enemy.state === 'recover') { enemy.clock -= dt; if (enemy.clock <= 0) { enemy.state = 'move'; enemy.clock = 1.2; enemy.armor = enemy.type === 'skidder' ? 1 : 0; } continue; }
      enemy.clock -= dt;
      if (enemy.telegraph > 0) { enemy.telegraph -= dt; if (enemy.telegraph <= 0) { enemyAttack(enemy, spec); enemy.clock = 1 + Math.random() * .8; } continue; }
      if (enemy.type === 'drone') { enemy.angle += dt * 1.1; const tree = nearestLivingTree(enemy) || p; enemy.x += Math.cos(enemy.angle) * 38 * dt; enemy.y += Math.sin(enemy.angle) * 38 * dt; moveToward(enemy, tree, 18, dt); }
      else if (['chair','lobbyist','foreman','broker'].includes(enemy.type)) { const desired = 230, d = dist(enemy, p); if (d > desired + 30) moveToward(enemy, p, spec.speed * boost, dt); else if (d < desired - 60) moveToward(enemy, { x: enemy.x + (enemy.x - p.x), y: enemy.y + (enemy.y - p.y) }, spec.speed * .75 * boost, dt); }
      else { const tree = nearestLivingTree(enemy), target = tree && dist(enemy, tree) < dist(enemy, p) * .92 ? tree : p; moveToward(enemy, target, spec.speed * boost, dt); }
      enemy.x = clamp(enemy.x, 34, W - 34); enemy.y = clamp(enemy.y, 88, H - 35); if (enemy.clock <= 0) { enemy.telegraph = enemy.type === 'skidder' ? .55 : enemy.type === 'feller' ? .38 : .42; enemy.state = 'telegraph'; }
      const tree = nearestLivingTree(enemy); if (tree && dist(enemy, tree) < enemy.r + tree.r + 8 && ['feller','skidder','mech'].includes(enemy.type)) { enemy.treeClock = (enemy.treeClock || .4) - dt; if (enemy.treeClock <= 0) { damageTree(tree, enemy.type === 'mech' ? 2 : 1); enemy.treeClock = 1.05; } }
    }
  }
  function updateBoss(dt) {
    const boss = state.boss, p = state.player; if (!boss || boss.dead || !p) return; if (boss.hitFlash > 0) boss.hitFlash -= dt; boss.clock -= dt; boss.angle += dt * (.6 + boss.phase * .25); boss.x = 720 + Math.cos(boss.angle) * 90; boss.y = H / 2 + Math.sin(boss.angle * .7) * 150;
    if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph <= 0) { if (boss.phase === 1) for (const s of [-.25,0,.25]) fireShot(boss, p, 'boss', 330, s); else if (boss.phase === 2) for (let i = 0; i < 8; i += 1) { const a = i * TAU / 8; state.shots.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, r: 7, life: 3, kind: 'paper', color: '#a9baff', friendly: false, owner: boss, damage: 1, dead: false }); } else { const tree = nearestLivingTree(boss); if (tree) for (const s of [-.12,.12]) fireShot(boss, tree, 'boss', 360, s); for (const s of [-.3,-.1,.1,.3]) fireShot(boss, p, 'saw', 340, s); } boss.state = 'recover'; boss.clock = .65; boss.recover = .34; } return; }
    if (boss.state === 'recover') { boss.recover -= dt; if (boss.recover <= 0) boss.state = 'move'; return; }
    if (boss.clock <= 0) { boss.telegraph = .62 - boss.phase * .08; boss.state = 'telegraph'; boss.clock = 1.15; }
  }
  function damageTree(tree, amount) {
    if (!tree?.alive) return; tree.hp -= amount; state.shake = Math.max(state.shake, 2); for (let i = 0; i < 6; i += 1) spawnParticle(tree.x, tree.y, '#c99b5d', 18 + i * 2);
    if (tree.hp <= 0) { tree.alive = false; tree.hp = 0; if (!state.trees.some((t) => t.alive)) endRun('The grove was clear-cut'); }
  }
  function updateShots(dt) {
    const p = state.player;
    for (const shot of state.shots) {
      if (shot.dead) continue; shot.life -= dt; shot.spin = (shot.spin || 0) + dt * 8;
      if (shot.kind === 'saw' && !shot.friendly) { const dx = p.x - shot.x, dy = p.y - shot.y, m = Math.hypot(dx, dy) || 1; shot.vx += dx / m * 42 * dt; shot.vy += dy / m * 42 * dt; }
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; if (shot.life <= 0 || shot.x < -30 || shot.x > W + 30 || shot.y < 50 || shot.y > H + 30) { shot.dead = true; continue; }
      if (shot.friendly) { for (const enemy of state.enemies) { if (!enemy.dead && dist(shot, enemy) < shot.r + enemy.r) { damageEnemy(enemy, shot.damage, { x: Math.sign(shot.vx), y: Math.sign(shot.vy) }); shot.dead = true; break; } } if (!shot.dead && state.boss && !state.boss.dead && dist(shot, state.boss) < shot.r + state.boss.r) { damageBoss(shot.damage, { x: Math.sign(shot.vx), y: Math.sign(shot.vy) }); shot.dead = true; } continue; }
      for (const tree of state.trees) { if (tree.alive && shot.owner?.type === 'mech' && dist(shot, tree) < shot.r + tree.r) { damageTree(tree, 1); shot.dead = true; break; } }
      if (!shot.dead && dist(shot, p) < shot.r + p.r) { if (shot.kind === 'tape') state.slowTimer = 2.2; damagePlayer(1, shot); shot.dead = true; }
    }
    state.shots = state.shots.filter((s) => !s.dead);
  }
  function updateSlashes(dt) {
    for (const slash of state.slashes) {
      slash.age += dt; for (const shot of state.shots) counterShot(shot, slash); const d = DIRS[slash.direction];
      for (const enemy of state.enemies) { if (enemy.dead || slash.hits.has(enemy.id) || !slashContains(slash, enemy)) continue; slash.hits.add(enemy.id); damageEnemy(enemy, 1.25, d); state.player.flow = clamp(state.player.flow + 4, 0, 100); }
      if (state.boss && !state.boss.dead && !slash.hits.has(state.boss.id) && slashContains(slash, state.boss)) { slash.hits.add(state.boss.id); damageBoss(1.1, d); state.player.flow = clamp(state.player.flow + 3, 0, 100); }
      for (const debris of state.debris) { const id = `debris-${debris.x}-${debris.y}`; if (debris.dead || slash.hits.has(id) || !slashContains(slash, debris)) continue; slash.hits.add(id); debris.hp -= 1; if (debris.hp <= 0) { debris.dead = true; state.stats.deadwood += 1; state.score += 35; state.player.flow = clamp(state.player.flow + 2, 0, 100); for (let i = 0; i < 8; i += 1) spawnParticle(debris.x, debris.y, '#c7955c', 18 + i * 2); } }
    }
    state.slashes = state.slashes.filter((s) => s.age < s.life);
  }
  function spawnParticle(x, y, color, speed = 30) { const a = Math.random() * TAU, s = speed * (.35 + Math.random()); state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .25 + Math.random() * .35, max: .6, color, r: 1 + Math.random() * 2.4 }); if (state.particles.length > 260) state.particles.shift(); }
  function updateParticles(dt) { for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; } state.particles = state.particles.filter((p) => p.life > 0); for (const t of state.player?.trail || []) t.life -= dt; if (state.player) state.player.trail = state.player.trail.filter((t) => t.life > 0); }
  function roomCleared() { return state.enemies.every((e) => e.dead) && (!state.boss || state.boss.dead); }
  function advanceRoom() { const saved = state.trees.filter((t) => t.alive).length; state.stats.treesSaved += saved; state.score += saved * 120 + Math.floor(state.player.flow) * 4; state.worldsCleared += 1; writeBest(); setupRoom(state.worldDepth + 1); toast(`room ${state.worldDepth} · dash ${Math.round(state.player.dashDistance)}px`); }
  function endRun(reason) { if (state.mode !== 'playing') return; state.mode = 'gameover'; writeBest(); $('gameOverTitle').textContent = reason; $('gameOverSummary').textContent = `${state.worldsCleared} rooms cleared · ${Math.floor(state.score)} score · ${state.stats.counters} counters`; $('gameOver').classList.remove('hidden'); }

  function update(dt) {
    if (state.mode !== 'playing') return; dt = Math.min(dt, .033); state.totalTime += dt; state.roomTime += dt; if (state.player.invuln > 0) state.player.invuln -= dt; if (state.player.cutCooldown > 0) state.player.cutCooldown -= dt; if (state.slowTimer > 0) state.slowTimer -= dt; if (state.flash > 0) state.flash -= dt; state.shake *= Math.pow(.02, dt); state.player.flow = Math.max(0, state.player.flow - dt * 2.5);
    updateDash(dt); updateHeldMovement(dt); updateSlashes(dt); updateEnemies(dt); updateBoss(dt); updateShots(dt); updateParticles(dt);
    if (roomCleared()) { state.roomClearTimer += dt; if (state.roomClearTimer > 1.15) advanceRoom(); } else state.roomClearTimer = 0; updateHud();
  }

  function drawBackground() {
    const p = state.room?.palette || ROOM_BLUEPRINTS[0].palette, g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, p[0]); g.addColorStop(.58, p[1]); g.addColorStop(1, '#050a08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = alpha(p[2], .08); ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 72); ctx.lineTo(x - 80, H); ctx.stroke(); } for (let y = 98; y < H; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 32); ctx.stroke(); }
  }
  function drawTree(tree) {
    const p = state.room.palette; ctx.save(); ctx.translate(tree.x, tree.y);
    if (!tree.alive) { ctx.fillStyle = '#6e4b2f'; ctx.fillRect(-7, -8, 14, 22); ctx.strokeStyle = '#9d7047'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.stroke(); ctx.restore(); return; }
    const hurt = tree.hp / tree.maxHp; ctx.strokeStyle = '#6f4f30'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, -10); ctx.stroke(); ctx.fillStyle = alpha(p[2], .35 + hurt * .45);
    for (let i = 0; i < 7; i += 1) { const a = i * TAU / 7 + tree.phase; ctx.beginPath(); ctx.arc(Math.cos(a) * 15, -16 + Math.sin(a) * 10, 13, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#dfffd8'; ctx.fillRect(-18, 28, 36 * hurt, 3); ctx.restore();
  }
  function drawDebris(d) { if (d.dead) return; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.angle); ctx.strokeStyle = '#8f6340'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-d.r, 0); ctx.lineTo(d.r, 0); ctx.stroke(); ctx.strokeStyle = '#b88454'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.moveTo(i * 7, -5); ctx.lineTo(i * 7 + 3, 5); ctx.stroke(); } ctx.restore(); }
  function drawEnemy(enemy) {
    if (enemy.dead) return; const spec = ENEMY_TYPES[enemy.type]; ctx.save(); ctx.translate(enemy.x, enemy.y);
    if (enemy.telegraph > 0) { ctx.strokeStyle = alpha('#ff7d67', .3 + .5 * Math.sin(performance.now() * .02)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, enemy.r + 13 + enemy.telegraph * 10, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : spec.color; ctx.beginPath(); ctx.arc(0, 0, enemy.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#101315'; ctx.fillRect(-9, -5, 5, 4); ctx.fillRect(4, -5, 5, 4); ctx.strokeStyle = '#101315'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(7, 7); ctx.stroke();
    if (enemy.type === 'feller') { ctx.strokeStyle = '#d7e0e0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(11,-14); ctx.lineTo(22,12); ctx.stroke(); } if (enemy.type === 'foreman') { ctx.fillStyle = '#222'; ctx.fillRect(10,-3,16,7); } if (enemy.type === 'lobbyist') { ctx.fillStyle = '#f6f0ff'; ctx.fillRect(-13,15,26,8); } if (enemy.type === 'chair') { ctx.strokeStyle = '#c6d2ff'; ctx.strokeRect(-15,-15,30,30); } if (enemy.type === 'skidder') { ctx.strokeStyle = enemy.armor ? '#f8dc83' : '#704f20'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0,0,enemy.r+5,-1.1,1.1); ctx.stroke(); }
    ctx.fillStyle = '#211515'; ctx.fillRect(-enemy.r, -enemy.r - 10, enemy.r * 2, 3); ctx.fillStyle = '#a6ffad'; ctx.fillRect(-enemy.r, -enemy.r - 10, enemy.r * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3); ctx.restore();
  }
  function drawBoss() { const b = state.boss; if (!b || b.dead) return; ctx.save(); ctx.translate(b.x, b.y); if (b.telegraph > 0) { ctx.strokeStyle = alpha('#ff668c', .6); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0,0,b.r+18+b.telegraph*20,0,TAU); ctx.stroke(); } ctx.rotate(Math.sin(performance.now() * .002) * .08); ctx.fillStyle = b.hitFlash > 0 ? '#fff' : '#ff668c'; ctx.beginPath(); ctx.arc(0,0,b.r,0,TAU); ctx.fill(); ctx.strokeStyle = '#d9f6ff'; ctx.lineWidth = 7; for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6 + performance.now()*.001; ctx.beginPath(); ctx.moveTo(Math.cos(a)*28,Math.sin(a)*28); ctx.lineTo(Math.cos(a)*57,Math.sin(a)*57); ctx.stroke(); } ctx.fillStyle='#10131a'; ctx.fillRect(-17,-7,10,7); ctx.fillRect(7,-7,10,7); ctx.restore(); }
  function drawShot(s) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.spin || 0); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 10; if (s.kind === 'saw') { for (let i=0;i<8;i+=1){ const a=i*TAU/8; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a-.15)*13,Math.sin(a-.15)*13); ctx.lineTo(Math.cos(a+.15)*13,Math.sin(a+.15)*13); ctx.closePath(); ctx.fill(); } } else if (s.kind === 'tape') ctx.fillRect(-11,-4,22,8); else if (s.kind === 'paper') ctx.fillRect(-8,-6,16,12); else { ctx.beginPath(); ctx.arc(0,0,s.r,0,TAU); ctx.fill(); } ctx.restore(); }
  function drawPlayer() { const p = state.player; if (!p) return; for (const t of p.trail) { ctx.fillStyle = alpha('#8dff9b', clamp(t.life/.18,0,1)*.2); ctx.beginPath(); ctx.arc(t.x,t.y,p.r*1.15,0,TAU); ctx.fill(); } ctx.save(); ctx.translate(p.x, p.y); if (p.dash) { const d=p.dash.dir; ctx.rotate(Math.atan2(d.y,d.x)); ctx.scale(1.35,.78); } if (p.invuln > 0 && Math.floor(p.invuln*18)%2===0) ctx.globalAlpha=.35; ctx.fillStyle='#8dff9b'; ctx.shadowColor='#8dff9b'; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(0,0,p.r,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#102014'; ctx.fillRect(-7,-5,4,4); ctx.fillRect(3,-5,4,4); ctx.fillStyle='#d6f7cb'; ctx.beginPath(); ctx.moveTo(-6,-13);ctx.lineTo(-1,-23);ctx.lineTo(2,-12);ctx.fill();ctx.beginPath();ctx.moveTo(2,-13);ctx.lineTo(8,-21);ctx.lineTo(8,-10);ctx.fill(); ctx.restore(); }
  function drawSlashes() { for (const s of state.slashes) { const d = DIRS[s.direction], t = s.age / s.life; ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(d.y,d.x)); ctx.strokeStyle=alpha('#ecffe9',1-t); ctx.lineWidth=8*(1-t)+2; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(6,0,54,-.62,.62); ctx.stroke(); ctx.strokeStyle=alpha('#85ffab',.7*(1-t)); ctx.lineWidth=2; ctx.beginPath(); ctx.arc(6,0,66,-.55,.55); ctx.stroke(); ctx.restore(); } }
  function drawParticles() { ctx.save(); ctx.globalCompositeOperation='lighter'; for (const p of state.particles) { ctx.fillStyle=alpha(p.color,clamp(p.life/p.max,0,1)); ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill(); } ctx.restore(); }
  function render() { const shakeX = state.shake ? (Math.random()-.5)*state.shake : 0, shakeY = state.shake ? (Math.random()-.5)*state.shake : 0; const scale = window.SylvariaDisplayScale?.scale || 1; ctx.save(); ctx.setTransform(scale,0,0,scale,0,0); ctx.translate(shakeX,shakeY); drawBackground(); for (const tree of state.trees) drawTree(tree); for (const d of state.debris) drawDebris(d); for (const e of state.enemies) drawEnemy(e); drawBoss(); for (const s of state.shots) drawShot(s); drawPlayer(); drawSlashes(); drawParticles(); if (state.roomClearTimer > 0) { ctx.fillStyle=alpha('#8dff9b',clamp(state.roomClearTimer,0,.7)*.25); ctx.fillRect(0,0,W,H); ctx.fillStyle='#efffed'; ctx.font='700 28px system-ui'; ctx.textAlign='center'; ctx.fillText('GROVE SECURED',W/2,H/2); } if (state.flash > 0) { ctx.fillStyle=`rgba(255,255,255,${state.flash})`;ctx.fillRect(0,0,W,H); } ctx.restore(); }

  let accumulator=0, last=performance.now(), fpsClock=performance.now(), frames=0;
  function frame(now) { const elapsed=Math.min(.08,(now-last)/1000); last=now; accumulator+=elapsed; while(accumulator>=1/120){update(1/120);accumulator-=1/120;} render(); frames+=1; if(now-fpsClock>=500){state.fps=frames*1000/(now-fpsClock);frames=0;fpsClock=now;} requestAnimationFrame(frame); }
  function updateHud(force=false) { if (!state.player || !state.room) return; if (force) { $('roomTitle').textContent=state.room.title; $('roomTask').textContent=state.room.hint; $('roomKicker').textContent=`room ${String(state.worldDepth).padStart(3,'0')} · countercut expedition`; $('biomeBadge').textContent=state.room.subtitle; } $('score').textContent=Math.floor(state.score); $('time').textContent=formatTime(state.totalTime); $('integrity').textContent='◆'.repeat(Math.max(0,state.player.hp))+'◇'.repeat(Math.max(0,state.player.maxHp-state.player.hp)); $('flowState').textContent=`${Math.round(state.player.flow)}%`; $('dashState').textContent=state.slowTimer>0?'RED TAPE':state.player.dash?'STEP':`${Math.round(state.player.dashDistance)}px`; $('treeState').textContent=`${state.trees.filter(t=>t.alive).length}/${state.trees.length}`; $('counterState').textContent=String(state.stats.counters); $('bossWrap').hidden=!state.boss; if(state.boss) $('bossState').textContent=state.boss.dead?'DOWN':`P${state.boss.phase} · ${Math.ceil(state.boss.hp)}/${state.boss.maxHp}`; }
  function formatTime(seconds){const m=Math.floor(seconds/60);const s=seconds-m*60;return `${m}:${s.toFixed(1).padStart(4,'0')}`;}
  function toast(text){const el=$('toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),1800);}
  function startRun(mode='run') { state.mode='playing';state.runMode=mode;state.score=0;state.totalTime=0;state.worldsCleared=0; state.stats={cuts:0,hits:0,counters:0,perfectCounters:0,kills:0,treesSaved:0,deadwood:0,dashes:0,damageTaken:0}; document.querySelectorAll('.screen').forEach((el)=>el.classList.add('hidden')); $('hud').classList.remove('hidden');setupRoom(1);canvas.focus();toast('WASD step-dashes · arrows cut'); }
  function snapshot(){ return { title:'Sylvaria',version:VERSION,mode:state.mode,sectorIndex:state.roomIndex,worldDepth:state.worldDepth,worldsCleared:state.worldsCleared,score:state.score,fps:state.fps,room:state.room?{title:state.room.title,subtitle:state.room.subtitle}:null,player:state.player?{x:state.player.x,y:state.player.y,hp:state.player.hp,flow:state.player.flow,dashDistance:state.player.dashDistance,dashing:Boolean(state.player.dash)}:null,enemies:state.enemies.filter(e=>!e.dead).map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,r:e.r,hp:e.hp,maxHp:e.maxHp,pattern:e.state})),boss:state.boss?{x:state.boss.x,y:state.boss.y,r:state.boss.r,hp:state.boss.hp,maxHp:state.boss.maxHp,phase:state.boss.phase,dead:state.boss.dead}:null,trees:state.trees.map(t=>({x:t.x,y:t.y,hp:t.hp,alive:t.alive})),shots:state.shots.map(s=>({x:s.x,y:s.y,kind:s.kind,friendly:s.friendly})),stats:{...state.stats,casts:state.stats.cuts},dashDistance:state.player?.dashDistance||0,roomCleared:roomCleared(),portalOpen:false,portalReady:false,portalPhase:'retired',targets:[],stones:0,stoneQuota:0 }; }

  window.__MOSSLIGHT_PLAYTEST__={ title:'Sylvaria',version:VERSION,roomCount:10,roomTitles:ROOM_BLUEPRINTS.map(r=>r.title),snapshot,setRoom(index,depth=index+1){setupRoom(depth||index+1);state.mode='playing';return snapshot();},completeRoom(){state.enemies.forEach(e=>e.dead=true);if(state.boss)state.boss.dead=true;return snapshot();},defeatBoss(){if(state.boss)state.boss.dead=true;return snapshot();},advance(){advanceRoom();return snapshot();},cut(dir){cut(dir);return snapshot();},dash(dir){dashStep(DIRS[dir]||DIRS.right);return snapshot();},spawnCounterShot(direction='right'){const d=DIRS[direction]||DIRS.right,p=state.player,sx=p.x+d.x*95,sy=p.y+d.y*95;state.shots.push({x:sx,y:sy,vx:-d.x*240,vy:-d.y*240,r:6,life:2,kind:'nail',color:'#ffad79',friendly:false,owner:null,damage:1,dead:false});return snapshot();}};
  window.MosslightExpedition={atlasCount:1000,summary:()=>({atlasCount:1000,worlds:Array.from({length:10},(_,i)=>({index:i+1})),deck:{cursor:10}}),newRun:()=>({})};
  window.MosslightDirector={movementPatterns:['telegraph','cardinal-shot','orbit','charge','support','tree-pressure'],powerups:[],summary:()=>ROOM_BLUEPRINTS.map((r,i)=>({room:i+1,situation:r.subtitle}))};

  document.addEventListener('keydown',(event)=>{const key=normKey(event.key);if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift','enter'].includes(key))event.preventDefault();if(state.mode==='menu'&&key==='enter'){startRun('run');return;}if(state.mode!=='playing')return;if(MOVE_DIRS[key]){if(!state.heldMoves.has(key))dashStep(MOVE_DIRS[key],key);state.heldMoves.add(key);return;}if(CUT_KEYS[key]){cut(CUT_KEYS[key]);return;}if(key==='p'){state.mode='paused';$('pauseScreen').classList.remove('hidden');return;}});
  document.addEventListener('keyup',(event)=>{const key=normKey(event.key);if(MOVE_DIRS[key])state.heldMoves.delete(key);}); window.addEventListener('blur',()=>state.heldMoves.clear());
  $('start')?.addEventListener('click',()=>startRun('run')); $('explore')?.addEventListener('click',()=>startRun('explore')); $('restartRun')?.addEventListener('click',()=>{$('gameOver').classList.add('hidden');startRun('run');}); $('menuFromGameOver')?.addEventListener('click',()=>{state.mode='menu';$('gameOver').classList.add('hidden');$('title').classList.remove('hidden');$('hud').classList.add('hidden');}); $('resume')?.addEventListener('click',()=>{state.mode='playing';$('pauseScreen').classList.add('hidden');canvas.focus();}); $('howBtn')?.addEventListener('click',()=>{$('title').classList.add('hidden');$('howScreen').classList.remove('hidden');}); $('controlsBtn')?.addEventListener('click',()=>{$('title').classList.add('hidden');$('controlsScreen').classList.remove('hidden');}); document.querySelectorAll('[data-back]').forEach((btn)=>btn.addEventListener('click',()=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));$('title').classList.remove('hidden');})); $('bestRun').textContent=`best · room ${state.best.room||0} · ${state.best.score||0} score`;
  drawBackground(); requestAnimationFrame(frame);
})();