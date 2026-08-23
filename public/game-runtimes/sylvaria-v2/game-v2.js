const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = {
  intro: document.getElementById('intro'),
  complete: document.getElementById('complete'),
  dead: document.getElementById('dead'),
  health: document.getElementById('health'),
  objective: document.getElementById('objective'),
  moveState: document.getElementById('moveState'),
  airStep: document.getElementById('airStep'),
  stats: document.getElementById('completeStats'),
};

const VIEW_W = 1280;
const VIEW_H = 720;
const WORLD_W = 3600;
const WORLD_H = 1000;
const FIXED_DT = 1 / 120;
const TAU = Math.PI * 2;

const MOVE = Object.freeze({
  runSpeed: 285,
  groundAccel: 2350,
  airAccel: 1550,
  groundBrake: 2850,
  gravity: 1850,
  maxFall: 900,
  jumpSpeed: 590,
  coyote: 0.105,
  jumpBuffer: 0.12,
  wallFall: 125,
  wallLaunchX: 430,
  wallLaunchY: 545,
  canopySpeed: 720,
  canopyTime: 0.115,
});

const COMBAT = Object.freeze({
  meleeStartup: 0.035,
  sideActiveEnd: 0.145,
  verticalActiveEnd: 0.165,
  deflectWindow: 0.12,
  nailSpeed: 565,
  returnSpeed: 680,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (value, target, delta) => value < target ? Math.min(target, value + delta) : Math.max(target, value - delta);
const rect = (x, y, w, h) => ({ l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2 });
const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const hash = (text) => {
  let value = 2166136261;
  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
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

// ---------------------------------------------------------------------------
// Old Growth Trial geometry
// ---------------------------------------------------------------------------
const roots = [
  { id: 'g0', x: 0, y: 860, w: 910, h: 160 },
  { id: 'g1', x: 1160, y: 900, w: 760, h: 120 },
  { id: 'g2', x: 2040, y: 880, w: 700, h: 140 },
  { id: 'g3', x: 2920, y: 900, w: 680, h: 120 },
  { id: 'r0', x: 820, y: 795, w: 180, h: 42 },
  { id: 'r1', x: 1780, y: 805, w: 220, h: 40 },
  { id: 'r2', x: 2650, y: 790, w: 170, h: 38 },
];

const trunks = [
  { id: 't0', x: 500, y: 220, w: 92, h: 640 },
  { id: 't1', x: 1390, y: 250, w: 104, h: 650 },
  { id: 't2', x: 2300, y: 170, w: 112, h: 710 },
  { id: 't3', x: 3070, y: 255, w: 96, h: 645 },
];

const branches = [
  { id: 'b0', x: 360, baseY: 680, w: 360, h: 24, spring: 0.72, flex: 0 },
  { id: 'b1', x: 500, baseY: 510, w: 390, h: 22, spring: 1.0, flex: 0 },
  { id: 'b2', x: 1210, baseY: 705, w: 390, h: 24, spring: 0.76, flex: 0 },
  { id: 'b3', x: 1390, baseY: 535, w: 390, h: 22, spring: 1.08, flex: 0 },
  { id: 'b4', x: 2070, baseY: 675, w: 450, h: 24, spring: 0.82, flex: 0 },
  { id: 'b5', x: 2290, baseY: 485, w: 430, h: 22, spring: 1.12, flex: 0 },
  { id: 'b6', x: 2860, baseY: 690, w: 360, h: 24, spring: 0.82, flex: 0 },
  { id: 'b7', x: 3050, baseY: 520, w: 390, h: 22, spring: 1.16, flex: 0 },
];

const vines = [
  { id: 'v0', ax: 1010, ay: 335, len: 285, angle: -0.42, angVel: 0 },
  { id: 'v1', ax: 1930, ay: 310, len: 265, angle: 0.30, angVel: 0 },
  { id: 'v2', ax: 2775, ay: 300, len: 300, angle: -0.26, angVel: 0 },
];

const checkpoints = [
  { x: 150, y: 839 },
  { x: 1260, y: 819 },
  { x: 2090, y: 789 },
  { x: 2970, y: 819 },
];

const enemyBlueprints = [
  { id: 'logger', kind: 'logger', x: 760, y: 831, w: 36, h: 58, hp: 5, maxHp: 5, platform: 'g0', minX: 625, maxX: 845 },
  { id: 'nailgun', kind: 'nailgun', x: 2425, y: 648, w: 38, h: 54, hp: 5, maxHp: 5, platform: 'b4', minX: 2200, maxX: 2520 },
];

const branchTop = (branch) => branch.baseY + branch.flex * 17;
const platformById = (id) => roots.find((item) => item.id === id) || branches.find((item) => item.id === id) || trunks.find((item) => item.id === id) || null;
function platformRect(platform) {
  if ('baseY' in platform) {
    const top = branchTop(platform);
    return { l: platform.x, r: platform.x + platform.w, t: top, b: top + platform.h };
  }
  return { l: platform.x, r: platform.x + platform.w, t: platform.y, b: platform.y + platform.h };
}
const playerRect = (player) => rect(player.x, player.y, player.w, player.h);
const vineTip = (vine) => ({ x: vine.ax + Math.sin(vine.angle) * vine.len, y: vine.ay + Math.cos(vine.angle) * vine.len });

// ---------------------------------------------------------------------------
// Input / state
// ---------------------------------------------------------------------------
const keys = new Set();
const pressed = new Set();
addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (!keys.has(event.code)) pressed.add(event.code);
  keys.add(event.code);
  if (event.code === 'KeyR' && (state.mode === 'dead' || state.mode === 'complete')) reset(true);
});
addEventListener('keyup', (event) => keys.delete(event.code));
const take = (code) => {
  const value = pressed.has(code);
  pressed.delete(code);
  return value;
};

let audioCtx = null;
function tone(freq = 300, duration = 0.05, gain = 0.025, type = 'triangle') {
  try {
    audioCtx ??= new AudioContext();
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

const state = {
  mode: 'menu', time: 0, roomTime: 0, player: null, enemies: [], nails: [], fx: [], fxSerial: 0,
  camera: { x: VIEW_W / 2, y: VIEW_H / 2 }, checkpoint: 0, shake: 0, flash: 0, stats: null,
};
const freshStats = () => ({ slashes: 0, reflects: 0, branchLaunches: 0, wallLaunches: 0, vineSwings: 0, canopySteps: 0, damageTaken: 0, kills: 0 });
function newPlayer() {
  return {
    x: 150, y: 839, w: 26, h: 42, vx: 0, vy: 0, facing: 1,
    onGround: true, groundId: 'g0', coyote: MOVE.coyote, jumpBuffer: 0,
    wallDir: 0, wallTime: 0, airStep: true, dashTime: 0, dashDir: { x: 0, y: 0 },
    vineId: null, attack: null, attackCooldown: 0, combo: 0, comboWindow: 0,
    hp: 5, maxHp: 5, invuln: 0, landSpeed: 0,
  };
}

function reset(play = false) {
  state.time = 0;
  state.roomTime = 0;
  state.player = newPlayer();
  state.enemies = enemyBlueprints.map((enemy) => ({ ...enemy, state: 'idle', clock: 0.35, windup: 0, recover: 0, dead: false, hitFlash: 0, attackSerial: 0, facing: -1 }));
  state.nails = [];
  state.fx = [];
  state.fxSerial = 0;
  state.camera = { x: VIEW_W / 2, y: VIEW_H / 2 };
  state.checkpoint = 0;
  state.shake = 0;
  state.flash = 0;
  state.stats = freshStats();
  for (const branch of branches) branch.flex = 0;
  const initialAngles = [-0.42, 0.30, -0.26];
  vines.forEach((vine, index) => { vine.angle = initialAngles[index]; vine.angVel = 0; });
  state.mode = play ? 'playing' : 'menu';
  ui.intro.classList.toggle('hidden', play);
  ui.complete.classList.add('hidden');
  ui.dead.classList.add('hidden');
  updateHud();
}

function spawnFx(x, y, color = '#d9f5c5', count = 8, speed = 120) {
  for (let index = 0; index < count; index++) {
    const angle = (state.fxSerial * 1.71 + index * 2.399) % TAU;
    const radius = 0.35 + ((state.fxSerial + index * 7) % 13) / 13;
    state.fx.push({ x, y, vx: Math.cos(angle) * speed * radius, vy: Math.sin(angle) * speed * radius - 20, life: 0.28 + ((index * 3) % 7) * 0.022, max: 0.45, size: 1.5 + (index % 3), color });
    state.fxSerial++;
  }
  if (state.fx.length > 190) state.fx.splice(0, state.fx.length - 190);
}
function hurtPlayer(sourceX, amount = 1) {
  const player = state.player;
  if (player.invuln > 0 || state.mode !== 'playing') return;
  player.hp -= amount;
  player.invuln = 0.85;
  player.vx = (player.x < sourceX ? -1 : 1) * 330;
  player.vy = -350;
  player.vineId = null;
  state.stats.damageTaken += amount;
  state.shake = 8;
  state.flash = 0.22;
  spawnFx(player.x, player.y, '#f0a978', 14, 170);
  tone(90, 0.13, 0.055, 'sawtooth');
  if (player.hp <= 0) { state.mode = 'dead'; ui.dead.classList.remove('hidden'); }
}
function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.stats.kills++;
  spawnFx(enemy.x, enemy.y, '#e4d0a0', 20, 180);
  tone(110, 0.08, 0.035, 'square');
}
function damageEnemy(enemy, damage, knock = 0) {
  if (enemy.dead) return;
  enemy.hp -= damage;
  enemy.hitFlash = 0.12;
  enemy.x += knock;
  state.shake = Math.max(state.shake, 3);
  spawnFx(enemy.x, enemy.y - 8, enemy.kind === 'logger' ? '#d8c08f' : '#efb46c', 8, 110);
  tone(210, 0.045, 0.025);
  if (enemy.hp <= 0) killEnemy(enemy);
}

// ---------------------------------------------------------------------------
// Collision and tree traversal
// ---------------------------------------------------------------------------
function detectWall(player) {
  const body = playerRect(player);
  for (const trunk of trunks) {
    const surface = platformRect(trunk);
    if (body.b <= surface.t + 5 || body.t >= surface.b - 5) continue;
    if (Math.abs(body.r - surface.l) <= 7) return 1;
    if (Math.abs(body.l - surface.r) <= 7) return -1;
  }
  return 0;
}
function collideHorizontal(player, dx) {
  player.x += dx;
  let hit = 0;
  const body = playerRect(player);
  for (const solid of [...trunks, ...roots]) {
    const surface = platformRect(solid);
    if (!overlap(body, surface)) continue;
    if (dx > 0) { player.x = surface.l - player.w / 2; hit = 1; }
    else if (dx < 0) { player.x = surface.r + player.w / 2; hit = -1; }
  }
  player.x = clamp(player.x, player.w / 2, WORLD_W - player.w / 2);
  return hit;
}
function collideVertical(player, dy) {
  const previousBottom = player.y + player.h / 2;
  const previousTop = player.y - player.h / 2;
  player.y += dy;
  player.onGround = false;
  player.groundId = null;
  let landed = null;
  if (dy >= 0) {
    let bestTop = Infinity;
    for (const surfaceItem of [...roots, ...trunks, ...branches]) {
      const surface = platformRect(surfaceItem);
      const body = playerRect(player);
      if (body.r <= surface.l + 3 || body.l >= surface.r - 3) continue;
      if (previousBottom <= surface.t + 6 && body.b >= surface.t && surface.t < bestTop) {
        bestTop = surface.t;
        landed = surfaceItem;
      }
    }
    if (landed) {
      const landingSpeed = player.vy;
      player.y = platformRect(landed).t - player.h / 2;
      player.vy = 0;
      player.onGround = true;
      player.groundId = landed.id;
      player.coyote = MOVE.coyote;
      player.airStep = true;
      player.landSpeed = landingSpeed;
      if ('flex' in landed) landed.flex = clamp(landed.flex + Math.max(0, landingSpeed - 140) / 900, 0, 1);
    }
  } else {
    for (const trunk of trunks) {
      const surface = platformRect(trunk);
      const body = playerRect(player);
      if (body.r <= surface.l || body.l >= surface.r) continue;
      if (previousTop >= surface.b - 4 && body.t <= surface.b) {
        player.y = surface.b + player.h / 2;
        player.vy = 0;
        break;
      }
    }
  }
  player.y = clamp(player.y, player.h / 2, WORLD_H + 120);
  return landed;
}

function updateBranches(dt) {
  const player = state.player;
  for (const branch of branches) {
    const supported = player.onGround && player.groundId === branch.id;
    const oldTop = branchTop(branch);
    if (supported) branch.flex = clamp(branch.flex + dt * (0.65 + branch.spring * 0.7), 0, 1);
    else branch.flex = Math.max(0, branch.flex - dt * (1.8 + branch.spring * 0.45));
    const platformMotion = branchTop(branch) - oldTop;
    if (supported && platformMotion !== 0) player.y += platformMotion;
  }
}
function updateVines(dt) {
  for (const vine of vines) {
    const torque = -Math.sin(vine.angle) * 2.15;
    vine.angVel += (torque - vine.angVel * 0.32) * dt;
    vine.angle = clamp(vine.angle + vine.angVel * dt, -1.15, 1.15);
  }
  const player = state.player;
  if (!player.vineId) return;
  const vine = vines.find((item) => item.id === player.vineId);
  if (!vine) { player.vineId = null; return; }
  vine.angVel += ((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)) * 1.8 * dt;
  const end = vineTip(vine);
  player.x = end.x;
  player.y = end.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.groundId = null;
  player.wallDir = 0;
}
function tryGrabVine() {
  const player = state.player;
  let best = null;
  let bestDistance = 78;
  for (const vine of vines) {
    const end = vineTip(vine);
    const distance = Math.hypot(end.x - player.x, end.y - player.y);
    if (distance < bestDistance) { best = vine; bestDistance = distance; }
  }
  if (!best) return false;
  player.vineId = best.id;
  player.vx = 0;
  player.vy = 0;
  tone(270, 0.04, 0.018);
  return true;
}
function releaseVine(jump = false) {
  const player = state.player;
  const vine = vines.find((item) => item.id === player.vineId);
  if (!vine) return;
  if (jump) {
    const tangent = vine.angVel * vine.len;
    player.vx = Math.cos(vine.angle) * tangent + (keys.has('KeyD') ? 110 : keys.has('KeyA') ? -110 : 0);
    player.vy = -Math.sin(vine.angle) * tangent - 190;
    player.airStep = true;
    state.stats.vineSwings++;
    tone(390, 0.05, 0.02);
  }
  player.vineId = null;
}
function startCanopyStep() {
  const player = state.player;
  if (!player.airStep || player.dashTime > 0) return;
  let x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  let y = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
  if (!x && !y) x = player.facing;
  const magnitude = Math.hypot(x, y) || 1;
  player.dashDir = { x: x / magnitude, y: y / magnitude };
  player.dashTime = MOVE.canopyTime;
  player.airStep = false;
  player.vineId = null;
  state.stats.canopySteps++;
  spawnFx(player.x, player.y, '#bdeca7', 8, 95);
  tone(500, 0.045, 0.025);
}

// ---------------------------------------------------------------------------
// Machete combat
// ---------------------------------------------------------------------------
function startAttack() {
  const player = state.player;
  if (player.attackCooldown > 0) return;
  let type = 'side';
  if (keys.has('KeyW')) type = 'up';
  else if (keys.has('KeyS') && !player.onGround) type = 'down';
  if (type === 'side') {
    player.combo = player.comboWindow > 0 ? (player.combo % 3) + 1 : 1;
    player.comboWindow = 0.34;
  } else player.combo = 1;
  player.attack = { type, time: 0, duration: type === 'side' ? 0.20 : 0.23, hit: new Set(), deflected: new Set() };
  player.attackCooldown = 0.11;
  state.stats.slashes++;
  tone(type === 'down' ? 260 : type === 'up' ? 340 : 300 + player.combo * 40, 0.055, 0.023);
}
function directionalBox(player, type, deflection = false) {
  if (type === 'up') return rect(player.x, player.y - 35, deflection ? 48 : 40, deflection ? 72 : 58);
  if (type === 'down') return rect(player.x, player.y + 38, deflection ? 46 : 38, deflection ? 74 : 64);
  const width = deflection ? 78 : 58 + (player.combo === 3 ? 16 : 0);
  const height = deflection ? 48 : 38;
  const offset = deflection ? 30 : 32 + (player.combo === 3 ? 8 : 0);
  return rect(player.x + player.facing * offset, player.y - 2, width, height);
}
function attackBox(player) {
  if (!player.attack) return null;
  const activeEnd = player.attack.type === 'side' ? COMBAT.sideActiveEnd : COMBAT.verticalActiveEnd;
  if (player.attack.time < COMBAT.meleeStartup || player.attack.time > activeEnd) return null;
  return directionalBox(player, player.attack.type, false);
}
function deflectBox(player) {
  if (!player.attack || player.attack.time > COMBAT.deflectWindow) return null;
  return directionalBox(player, player.attack.type, true);
}
function reflectNail(nail, player, attack) {
  if (nail.friendly) return;
  nail.friendly = true;
  nail.owner = 'player';
  state.stats.reflects++;
  const speed = COMBAT.returnSpeed;
  if (attack.type === 'up') { nail.vx = player.facing * speed * 0.35; nail.vy = -speed * 0.94; }
  else if (attack.type === 'down') { nail.vx = player.facing * speed * 0.25; nail.vy = speed * 0.97; }
  else { nail.vx = player.facing * speed; nail.vy = -55; }
  nail.life = 3;
  spawnFx(nail.x, nail.y, '#e9f5b5', 12, 170);
  state.shake = Math.max(state.shake, 2.5);
  tone(720, 0.055, 0.032, 'square');
}
function updateAttack(dt) {
  const player = state.player;
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.comboWindow > 0) player.comboWindow -= dt;
  if (!player.attack) return;
  player.attack.time += dt;

  const guard = deflectBox(player);
  if (guard) {
    for (const nail of state.nails) {
      if (nail.dead || nail.friendly || player.attack.deflected.has(nail)) continue;
      if (overlap(guard, rect(nail.x, nail.y, nail.r * 2, nail.r * 2))) {
        player.attack.deflected.add(nail);
        reflectNail(nail, player, player.attack);
      }
    }
  }

  const blade = attackBox(player);
  if (blade) {
    for (const enemy of state.enemies) {
      if (enemy.dead || player.attack.hit.has(enemy.id)) continue;
      if (!overlap(blade, rect(enemy.x, enemy.y, enemy.w, enemy.h))) continue;
      player.attack.hit.add(enemy.id);
      const damage = player.attack.type === 'side' ? (player.combo === 3 ? 1.7 : 1) : 1.15;
      damageEnemy(enemy, damage, player.facing * 12);
      if (player.attack.type === 'down') {
        player.vy = -520;
        player.airStep = true;
        state.stats.branchLaunches++;
        spawnFx(player.x, player.y + 20, '#bce79f', 10, 130);
      }
    }
    if (player.attack.type === 'down') {
      for (const branch of branches) {
        if (player.attack.hit.has(branch.id)) continue;
        if (!overlap(blade, platformRect(branch))) continue;
        player.attack.hit.add(branch.id);
        branch.flex = 1;
        player.vy = -560;
        player.airStep = true;
        state.stats.branchLaunches++;
        spawnFx(player.x, branchTop(branch), '#88b66e', 12, 125);
        tone(430, 0.07, 0.026);
      }
    }
  }
  if (player.attack.time >= player.attack.duration) player.attack = null;
}

// ---------------------------------------------------------------------------
// Player / enemies
// ---------------------------------------------------------------------------
function updatePlayer(dt) {
  const player = state.player;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.jumpBuffer > 0) player.jumpBuffer -= dt;
  if (player.coyote > 0 && !player.onGround) player.coyote -= dt;

  updateAttack(dt);
  if (take('KeyJ')) startAttack();
  if (take('KeyE')) { if (player.vineId) releaseVine(false); else tryGrabVine(); }
  if (take('ShiftLeft') || take('ShiftRight')) startCanopyStep();
  const jumpPressed = take('Space');
  if (player.vineId) { if (jumpPressed) releaseVine(true); return; }
  if (jumpPressed) player.jumpBuffer = MOVE.jumpBuffer;

  player.wallDir = detectWall(player);
  const move = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  if (move) player.facing = move;

  if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0 || player.wallDir)) {
    if (player.wallDir && !player.onGround) {
      player.vx = -player.wallDir * MOVE.wallLaunchX;
      player.vy = -MOVE.wallLaunchY;
      player.onGround = false;
      player.groundId = null;
      player.coyote = 0;
      state.stats.wallLaunches++;
      spawnFx(player.x, player.y, '#9ab982', 9, 120);
      tone(360, 0.045, 0.02);
    } else {
      let boost = 0;
      const ground = platformById(player.groundId);
      if (ground && 'flex' in ground) {
        boost = ground.flex * 250 * ground.spring;
        ground.flex *= 0.25;
        if (boost > 45) state.stats.branchLaunches++;
      }
      player.vy = -MOVE.jumpSpeed - boost;
      player.onGround = false;
      player.groundId = null;
      player.coyote = 0;
      tone(330 + Math.min(180, boost), 0.045, 0.018);
    }
    player.jumpBuffer = 0;
  }

  if (player.dashTime > 0) {
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.vx = player.dashDir.x * MOVE.canopySpeed;
    player.vy = player.dashDir.y * MOVE.canopySpeed;
    const wall = collideHorizontal(player, player.vx * dt);
    if (wall) { player.dashTime = 0; player.wallDir = wall; }
    collideVertical(player, player.vy * dt);
    if (player.dashTime <= 0) { player.vx *= 0.68; player.vy *= 0.5; }
    return;
  }

  const target = move * MOVE.runSpeed;
  const acceleration = player.onGround ? MOVE.groundAccel : MOVE.airAccel;
  player.vx = approach(player.vx, target, acceleration * dt);
  if (!move && player.onGround) player.vx = approach(player.vx, 0, MOVE.groundBrake * dt);

  const gripping = player.wallDir && ((player.wallDir === 1 && keys.has('KeyD')) || (player.wallDir === -1 && keys.has('KeyA'))) && !player.onGround && player.vy > 0;
  if (gripping) { player.vy = Math.min(player.vy, MOVE.wallFall); player.wallTime = Math.min(1, player.wallTime + dt); }
  else { player.vy = Math.min(MOVE.maxFall, player.vy + MOVE.gravity * dt); player.wallTime = Math.max(0, player.wallTime - dt * 2); }

  collideHorizontal(player, player.vx * dt);
  collideVertical(player, player.vy * dt);
  if (!keys.has('Space') && player.vy < -180) player.vy += MOVE.gravity * dt * 1.15;

  if (player.y > WORLD_H + 60) {
    const checkpoint = checkpoints[state.checkpoint];
    Object.assign(player, { x: checkpoint.x, y: checkpoint.y, vx: 0, vy: 0, onGround: false, groundId: null });
    hurtPlayer(player.x + 50);
  }
}

function enemyGroundY(enemy) {
  const platform = platformById(enemy.platform);
  return platform ? platformRect(platform).t - enemy.h / 2 : enemy.y;
}
function updateLogger(enemy, dt) {
  enemy.y = enemyGroundY(enemy);
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = Math.abs(player.y - enemy.y);
  enemy.facing = dx < 0 ? -1 : 1;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  if (enemy.state === 'windup') {
    enemy.windup -= dt;
    if (enemy.windup <= 0) { enemy.state = 'strike'; enemy.clock = 0.12; enemy.attackSerial++; tone(120, 0.055, 0.028, 'square'); }
    return;
  }
  if (enemy.state === 'strike') {
    enemy.clock -= dt;
    if (enemy.clock > 0.035 && overlap(rect(enemy.x + enemy.facing * 38, enemy.y, 58, 48), playerRect(player))) hurtPlayer(enemy.x);
    if (enemy.clock <= 0) { enemy.state = 'recover'; enemy.recover = 0.42; }
    return;
  }
  if (enemy.state === 'recover') { enemy.recover -= dt; if (enemy.recover <= 0) enemy.state = 'idle'; return; }
  if (dy < 80 && Math.abs(dx) < 105) { enemy.state = 'windup'; enemy.windup = 0.34; return; }
  const direction = Math.abs(dx) < 280 ? Math.sign(dx) : enemy.facing;
  enemy.x = clamp(enemy.x + direction * 68 * dt, enemy.minX, enemy.maxX);
}
function fireNail(enemy) {
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const speed = COMBAT.nailSpeed;
  state.nails.push({ x: enemy.x + enemy.facing * 28, y: enemy.y - 8, vx: dx / magnitude * speed, vy: dy / magnitude * speed, r: 7, life: 4, friendly: false, owner: enemy.id, dead: false });
  tone(180, 0.04, 0.03, 'square');
}
function updateNailgun(enemy, dt) {
  const platform = platformById(enemy.platform);
  if (platform) enemy.y = platformRect(platform).t - enemy.h / 2;
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  enemy.facing = dx < 0 ? -1 : 1;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  if (enemy.state === 'aim') { enemy.windup -= dt; if (enemy.windup <= 0) { fireNail(enemy); enemy.state = 'recover'; enemy.recover = 1.05; } return; }
  if (enemy.state === 'recover') { enemy.recover -= dt; if (enemy.recover <= 0) enemy.state = 'idle'; return; }
  if (Math.abs(dx) < 900 && Math.abs(dy) < 420) { enemy.state = 'aim'; enemy.windup = 0.48; return; }
  enemy.x = clamp(enemy.x + Math.sign(dx) * 24 * dt, enemy.minX, enemy.maxX);
}
function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    if (enemy.kind === 'logger') updateLogger(enemy, dt); else updateNailgun(enemy, dt);
  }
  for (const nail of state.nails) {
    if (nail.dead) continue;
    nail.life -= dt;
    if (nail.life <= 0) { nail.dead = true; continue; }
    nail.x += nail.vx * dt;
    nail.y += nail.vy * dt;
    if (nail.friendly) {
      for (const enemy of state.enemies) {
        if (enemy.dead || !overlap(rect(nail.x, nail.y, nail.r * 2, nail.r * 2), rect(enemy.x, enemy.y, enemy.w, enemy.h))) continue;
        damageEnemy(enemy, 2, nail.vx > 0 ? 10 : -10);
        nail.dead = true;
        break;
      }
    } else if (overlap(rect(nail.x, nail.y, nail.r * 2, nail.r * 2), playerRect(state.player))) {
      hurtPlayer(nail.x);
      nail.dead = true;
    }
    for (const trunk of trunks) {
      if (overlap(rect(nail.x, nail.y, nail.r * 2, nail.r * 2), platformRect(trunk))) {
        nail.dead = true;
        spawnFx(nail.x, nail.y, '#a8895d', 5, 70);
        break;
      }
    }
  }
  state.nails = state.nails.filter((nail) => !nail.dead);
}

function updateCheckpoints() {
  const player = state.player;
  for (let index = state.checkpoint + 1; index < checkpoints.length; index++) {
    if (player.x <= checkpoints[index].x) continue;
    state.checkpoint = index;
    spawnFx(checkpoints[index].x, checkpoints[index].y, '#c4efad', 16, 95);
    tone(620, 0.08, 0.022);
    break;
  }
}
function updateFx(dt) {
  for (const particle of state.fx) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 260 * dt;
    particle.vx *= 0.986;
  }
  state.fx = state.fx.filter((particle) => particle.life > 0);
}
function updateCamera(dt) {
  const player = state.player;
  const look = player.facing * 150 + clamp(player.vx * 0.18, -100, 100);
  const targetX = clamp(player.x + look, VIEW_W / 2, WORLD_W - VIEW_W / 2);
  const targetY = clamp(player.y - 55, VIEW_H / 2, WORLD_H - VIEW_H / 2);
  state.camera.x = lerp(state.camera.x, targetX, 1 - Math.exp(-5.8 * dt));
  state.camera.y = lerp(state.camera.y, targetY, 1 - Math.exp(-4.8 * dt));
}
function update(dt) {
  if (state.mode !== 'playing') return;
  state.time += dt;
  state.roomTime += dt;
  state.flash = Math.max(0, state.flash - dt);
  state.shake = Math.max(0, state.shake - dt * 18);
  updateVines(dt);
  updateBranches(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateCheckpoints();
  updateFx(dt);
  updateCamera(dt);
  if (state.enemies.every((enemy) => enemy.dead) && state.player.x > 3380) {
    state.mode = 'complete';
    ui.complete.classList.remove('hidden');
    ui.stats.textContent = `${state.stats.reflects} reflected nails · ${state.stats.branchLaunches} branch rebounds · ${state.stats.wallLaunches} wall launches · ${state.stats.vineSwings} vine releases`;
    tone(660, 0.12, 0.03);
  }
  updateHud();
}

function updateHud() {
  const player = state.player;
  ui.health.textContent = `BARK ${'●'.repeat(Math.max(0, player.hp))}${'○'.repeat(Math.max(0, player.maxHp - player.hp))}`;
  const live = state.enemies.filter((enemy) => !enemy.dead);
  ui.objective.textContent = live.length ? `${live.length} clearcut threat${live.length === 1 ? '' : 's'} remain · reach the heartwood gate` : 'forest route open · reach the heartwood gate';
  let motion = 'airborne';
  if (player.vineId) motion = 'vine swing';
  else if (player.wallDir && !player.onGround) motion = 'bark grip';
  else if (player.onGround) { const ground = platformById(player.groundId); motion = ground && 'flex' in ground ? 'branch flex' : 'rooted'; }
  else if (player.dashTime > 0) motion = 'canopy step';
  ui.moveState.textContent = motion;
  ui.airStep.textContent = `CANOPY STEP ${player.airStep ? '●' : '○'}`;
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------
const sceneryRng = rngFrom(hash('sylvaria-v2-old-growth')); 
const distantTrees = Array.from({ length: 58 }, (_, index) => ({ x: index * 86 + sceneryRng() * 110, y: 170 + sceneryRng() * 170, h: 320 + sceneryRng() * 380, w: 25 + sceneryRng() * 55, a: 0.12 + sceneryRng() * 0.13 }));
const motes = Array.from({ length: 84 }, () => ({ x: sceneryRng() * WORLD_W, y: 100 + sceneryRng() * 760, phase: sceneryRng() * TAU, speed: 0.55 + sceneryRng() * 1.35 }));

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  gradient.addColorStop(0, '#06120f');
  gradient.addColorStop(0.48, '#10241b');
  gradient.addColorStop(1, '#1b2c1d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const moonX = 970 - state.camera.x * 0.025;
  ctx.fillStyle = '#dce9cf12';
  ctx.beginPath(); ctx.arc(moonX, 120, 118, 0, TAU); ctx.fill();
  for (const tree of distantTrees) {
    const x = tree.x - state.camera.x * 0.18;
    const y = VIEW_H - (WORLD_H - tree.y) * 0.08;
    ctx.globalAlpha = tree.a;
    ctx.fillStyle = '#07100c';
    ctx.fillRect(x - tree.w / 2, y - tree.h, tree.w, tree.h);
    ctx.beginPath(); ctx.moveTo(x, y - tree.h - 120); ctx.lineTo(x - tree.w * 2.4, y - tree.h * 0.45); ctx.lineTo(x + tree.w * 2.4, y - tree.h * 0.45); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function worldTransform() {
  const shakeX = state.shake ? Math.sin(state.time * 67) * state.shake : 0;
  const shakeY = state.shake ? Math.cos(state.time * 59) * state.shake * 0.55 : 0;
  ctx.translate(VIEW_W / 2 - state.camera.x + shakeX, VIEW_H / 2 - state.camera.y + shakeY);
}
function drawRoot(root) {
  const surface = platformRect(root);
  ctx.fillStyle = '#192618';
  ctx.fillRect(surface.l, surface.t, surface.r - surface.l, surface.b - surface.t);
  ctx.fillStyle = '#314127';
  ctx.fillRect(surface.l, surface.t, surface.r - surface.l, 9);
  ctx.strokeStyle = '#6d794933';
  ctx.lineWidth = 3;
  for (let x = surface.l + 24; x < surface.r; x += 54) { ctx.beginPath(); ctx.moveTo(x, surface.t + 4); ctx.quadraticCurveTo(x + 16, surface.t + 22, x - 4, surface.t + 54); ctx.stroke(); }
}
function drawTrunk(trunk) {
  const surface = platformRect(trunk);
  const gradient = ctx.createLinearGradient(surface.l, 0, surface.r, 0);
  gradient.addColorStop(0, '#161b12'); gradient.addColorStop(0.45, '#3a432b'); gradient.addColorStop(0.72, '#26311e'); gradient.addColorStop(1, '#111710');
  ctx.fillStyle = gradient; ctx.fillRect(surface.l, surface.t, surface.r - surface.l, surface.b - surface.t);
  ctx.strokeStyle = '#87906c29'; ctx.lineWidth = 4;
  for (let y = surface.t + 22; y < surface.b; y += 48) { ctx.beginPath(); ctx.moveTo(surface.l + 12, y); ctx.bezierCurveTo(surface.l + 34, y - 13, surface.r - 27, y + 17, surface.r - 10, y + 2); ctx.stroke(); }
}
function drawBranch(branch) {
  const y = branchTop(branch);
  const bend = branch.flex * 18;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#11180f'; ctx.lineWidth = branch.h + 8; ctx.beginPath(); ctx.moveTo(branch.x, y); ctx.quadraticCurveTo(branch.x + branch.w * 0.55, y + bend, branch.x + branch.w, y - 2); ctx.stroke();
  ctx.strokeStyle = '#3c4b2d'; ctx.lineWidth = branch.h; ctx.beginPath(); ctx.moveTo(branch.x, y); ctx.quadraticCurveTo(branch.x + branch.w * 0.55, y + bend, branch.x + branch.w, y - 2); ctx.stroke();
  ctx.strokeStyle = '#a0b87955'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(branch.x + 10, y - 5); ctx.quadraticCurveTo(branch.x + branch.w * 0.55, y + bend - 5, branch.x + branch.w - 10, y - 7); ctx.stroke();
}
function drawVine(vine) {
  const end = vineTip(vine);
  ctx.strokeStyle = '#456d3f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(vine.ax, vine.ay); ctx.quadraticCurveTo((vine.ax + end.x) / 2 + Math.sin(state.time + vine.angle) * 9, (vine.ay + end.y) / 2, end.x, end.y); ctx.stroke();
  ctx.fillStyle = '#9dc181'; ctx.beginPath(); ctx.arc(end.x, end.y, 11, 0, TAU); ctx.fill();
}
function drawCheckpoint(checkpoint, index) {
  ctx.globalAlpha = index <= state.checkpoint ? 0.85 : 0.2;
  ctx.strokeStyle = '#9fd086'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(checkpoint.x, checkpoint.y - 22, 15 + Math.sin(state.time * 2 + index) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
function drawLogger(enemy) {
  ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(enemy.facing, 1); ctx.globalAlpha = enemy.hitFlash > 0 ? 0.55 : 1;
  ctx.fillStyle = '#594432'; ctx.fillRect(-13, -11, 26, 32); ctx.fillStyle = '#b67f48'; ctx.beginPath(); ctx.arc(0, -24, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#d08d42'; ctx.fillRect(-12, -32, 24, 6); ctx.fillStyle = '#76846e'; ctx.fillRect(-15, 18, 10, 18); ctx.fillRect(5, 18, 10, 18);
  ctx.strokeStyle = enemy.state === 'windup' ? '#ffc46b' : '#beb5a0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(30, -20); ctx.lineTo(42, -7); ctx.stroke();
  if (enemy.state === 'windup') { ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ffb55b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(20, -2, 54, -1.05, 0.8); ctx.stroke(); }
  ctx.restore();
}
function drawNailgun(enemy) {
  ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(enemy.facing, 1); ctx.globalAlpha = enemy.hitFlash > 0 ? 0.55 : 1;
  ctx.fillStyle = '#334039'; ctx.fillRect(-14, -12, 28, 36); ctx.fillStyle = '#bd8a58'; ctx.beginPath(); ctx.arc(0, -25, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#d49a44'; ctx.fillRect(-13, -34, 26, 5); ctx.fillStyle = '#5a6260'; ctx.fillRect(8, -10, 35, 10); ctx.fillStyle = '#f6b44b'; ctx.fillRect(31, -8, 12, 6); ctx.restore();
  if (enemy.state === 'aim') { const player = state.player; ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffb252'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y - 8); ctx.lineTo(player.x, player.y); ctx.stroke(); ctx.globalAlpha = 1; }
}
function drawNail(nail) {
  ctx.save(); ctx.translate(nail.x, nail.y); ctx.rotate(Math.atan2(nail.vy, nail.vx)); ctx.fillStyle = nail.friendly ? '#dfffa9' : '#ffb760'; ctx.shadowColor = nail.friendly ? '#baff8d' : '#ff8b42'; ctx.shadowBlur = 10; ctx.fillRect(-10, -3, 20, 6); ctx.restore();
}
function drawPlayer(player) {
  ctx.save(); ctx.translate(player.x, player.y); ctx.scale(player.facing, 1); ctx.globalAlpha = player.invuln > 0 && Math.floor(state.time * 24) % 2 === 0 ? 0.35 : 1;
  ctx.fillStyle = '#0f1e15'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 20, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#345334'; ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(0, -24); ctx.lineTo(14, -4); ctx.lineTo(10, 17); ctx.lineTo(-10, 17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e1f1c7'; ctx.fillRect(5, -12, 3, 3); ctx.fillRect(10, -11, 3, 3); ctx.fillStyle = '#607d59'; ctx.fillRect(-10, 16, 7, 12); ctx.fillRect(5, 16, 7, 12); ctx.strokeStyle = '#d8efaa'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(24, -11); ctx.stroke();
  if (player.attack && (attackBox(player) || deflectBox(player))) { ctx.globalAlpha = 0.36; ctx.strokeStyle = '#e1ffad'; ctx.lineWidth = 8; ctx.beginPath(); if (player.attack.type === 'up') ctx.arc(0, -18, 39, Math.PI, TAU); else if (player.attack.type === 'down') ctx.arc(0, 18, 39, 0, Math.PI); else ctx.arc(8, -2, 42, -0.9, 0.9); ctx.stroke(); }
  ctx.restore();
  if (player.wallDir && !player.onGround) { ctx.fillStyle = '#b9d29a66'; ctx.fillRect(player.x + player.wallDir * 16, player.y - 16, 3, 32); }
}
function drawGate() {
  const open = state.enemies.every((enemy) => enemy.dead);
  ctx.save(); ctx.translate(3440, 820); ctx.fillStyle = '#21351f'; ctx.fillRect(-42, -110, 84, 110); ctx.strokeStyle = open ? '#c9eda4' : '#765f45'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -66, 30, 0, TAU); ctx.stroke(); ctx.fillStyle = open ? '#d9f6b033' : '#b58a5320'; ctx.beginPath(); ctx.arc(0, -66, 24, 0, TAU); ctx.fill(); ctx.fillStyle = '#9db687'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(open ? 'HEARTWOOD OPEN' : 'CLEAR THE CREW', 0, 18); ctx.restore();
}
function drawWorld() {
  ctx.save(); worldTransform();
  roots.forEach(drawRoot); trunks.forEach(drawTrunk); branches.forEach(drawBranch); vines.forEach(drawVine); checkpoints.forEach(drawCheckpoint); drawGate();
  for (const enemy of state.enemies) if (!enemy.dead) (enemy.kind === 'logger' ? drawLogger : drawNailgun)(enemy);
  state.nails.forEach(drawNail); drawPlayer(state.player);
  for (const particle of state.fx) { ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const mote of motes) { const x = mote.x, y = mote.y + Math.sin(state.time * mote.speed + mote.phase) * 8; if (x < state.camera.x - VIEW_W / 2 - 40 || x > state.camera.x + VIEW_W / 2 + 40) continue; ctx.fillStyle = '#cde7b233'; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawForeground() {
  const gradient = ctx.createLinearGradient(0, VIEW_H - 130, 0, VIEW_H); gradient.addColorStop(0, '#02060400'); gradient.addColorStop(1, '#010302c9'); ctx.fillStyle = gradient; ctx.fillRect(0, VIEW_H - 150, VIEW_W, 150);
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,210,150,${state.flash * 0.35})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

let scale = 1, offsetX = 0, offsetY = 0, dpr = 1;
function resize() {
  const bounds = canvas.getBoundingClientRect();
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  scale = Math.min(bounds.width / VIEW_W, bounds.height / VIEW_H);
  offsetX = (bounds.width - VIEW_W * scale) / 2;
  offsetY = (bounds.height - VIEW_H * scale) / 2;
}
addEventListener('resize', resize);
resize();
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  drawSky(); drawWorld(); drawForeground();
}

let last = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.05, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 8) { update(FIXED_DT); accumulator -= FIXED_DT; steps++; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.getElementById('start').addEventListener('click', () => { audioCtx ??= new AudioContext(); reset(true); });
document.getElementById('restart').addEventListener('click', () => reset(true));
document.getElementById('retry').addEventListener('click', () => reset(true));
reset(false);

window.__SYLVARIA_V2__ = {
  version: '2.0.0-alpha.2',
  fixedDt: FIXED_DT,
  state,
  config: { move: MOVE, combat: COMBAT },
  reset: () => reset(true),
  step: (ticks = 1) => { for (let index = 0; index < ticks; index++) update(FIXED_DT); return window.__SYLVARIA_V2__.snapshot(); },
  snapshot: () => ({
    mode: state.mode,
    time: state.time,
    player: { x: state.player.x, y: state.player.y, vx: state.player.vx, vy: state.player.vy, hp: state.player.hp, onGround: state.player.onGround, groundId: state.player.groundId, wallDir: state.player.wallDir, vineId: state.player.vineId, airStep: state.player.airStep, attack: state.player.attack?.type || null },
    enemies: state.enemies.filter((enemy) => !enemy.dead).map((enemy) => ({ id: enemy.id, kind: enemy.kind, hp: enemy.hp, state: enemy.state, x: enemy.x, y: enemy.y })),
    nails: state.nails.length,
    checkpoint: state.checkpoint,
    stats: { ...state.stats },
    branches: branches.map((branch) => ({ id: branch.id, flex: branch.flex, y: branchTop(branch) })),
    vines: vines.map((vine) => ({ id: vine.id, angle: vine.angle, tip: vineTip(vine) })),
    camera: { ...state.camera },
  }),
};
