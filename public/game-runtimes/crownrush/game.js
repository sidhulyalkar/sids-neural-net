(() => {
  'use strict';

  const canvas = document.querySelector('#c');
  const wrap = document.querySelector('#wrap');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;
  const FIXED_DT = 1 / 120;
  const MAX_STEPS = 8;
  const GRAVITY = -1900;
  const LEFT_WALL = 156;
  const RIGHT_WALL = 804;
  const PLAYER_R = 15;
  const touchMode = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const hypot = Math.hypot;

  let seed = 0x51a7f00d;
  function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }

  const stars = Array.from({ length: 90 }, () => ({
    x: random() * W,
    y: random() * H,
    r: 0.35 + random() * 1.4,
    a: 0.12 + random() * 0.58,
    p: 0.12 + random() * 0.4,
  }));

  const keys = new Set();
  const pointers = new Map();
  const particles = [];
  const branches = [];
  const knots = [];
  const branchPool = [];
  const knotPool = [];
  const messages = [];

  let audio = null;
  let mode = 'title';
  let pausedFrom = 'playing';
  let accumulator = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let cameraBottom = -80;
  let threatY = -260;
  let generatedY = 70;
  let generatedFloor = 0;
  let lastSide = 'left';
  let highScore = Number(localStorage.getItem('crownrush.highscore') || 0);
  let flash = 0;
  let shake = 0;
  let scorchCooldown = 0;
  let runSeed = 1;

  const player = {
    x: W / 2,
    y: 98,
    px: W / 2,
    py: 98,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: null,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    sapHeld: false,
    sap: null,
    wallTimer: 0,
    state: 'grounded',
    squash: 0,
    stretch: 0,
    heat: 0,
    score: 0,
    highestFloor: 0,
    lastFloor: 0,
    combo: 0,
    comboFloors: 0,
    comboTimer: 0,
    hyper: false,
    resin: 0,
    saves: 0,
    bestCombo: 0,
  };

  function tone(freq, duration = 0.07, gain = 0.035, type = 'sine', slide = 1) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      const now = audio.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + duration);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp).connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {}
  }

  function announce(text, life = 1.1, size = 22) {
    messages.push({ text, life, maxLife: life, size });
  }

  function burst(x, y, count, kind = 'leaf', power = 1) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = (70 + random() * 250) * power;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + 70,
        life: 0.35 + random() * 0.55,
        maxLife: 0.9,
        r: 1.5 + random() * 4,
        kind,
      });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function takeBranch() {
    return branchPool.pop() || {};
  }

  function takeKnot() {
    return knotPool.pop() || {};
  }

  function addBranch(floor, y, side, length, slope = 0) {
    const branch = takeBranch();
    branch.floor = floor;
    branch.y = y;
    branch.side = side;
    branch.slope = slope;
    branch.thickness = 8 + random() * 5;
    branch.burl = random();
    if (side === 'left') {
      branch.x1 = LEFT_WALL - 2;
      branch.x2 = Math.min(RIGHT_WALL - 55, LEFT_WALL + length);
    } else if (side === 'right') {
      branch.x2 = RIGHT_WALL + 2;
      branch.x1 = Math.max(LEFT_WALL + 55, RIGHT_WALL - length);
    } else {
      const half = length * 0.5;
      branch.x1 = W / 2 - half;
      branch.x2 = W / 2 + half;
    }
    branches.push(branch);
    return branch;
  }

  function addKnot(x, y, branchFloor) {
    const knot = takeKnot();
    knot.x = x;
    knot.y = y;
    knot.floor = branchFloor;
    knot.pulse = random() * Math.PI * 2;
    knots.push(knot);
  }

  function generateNext() {
    generatedFloor += 1;
    const altitude = generatedFloor;
    const difficulty = clamp(altitude / 220, 0, 1);
    generatedY += 68 + random() * (24 + difficulty * 12);

    let side;
    const roll = random();
    if (roll < 0.13) side = 'center';
    else if (roll < 0.78) side = lastSide === 'left' ? 'right' : 'left';
    else side = lastSide;
    if (side !== 'center') lastSide = side;

    const minLength = lerp(300, 205, difficulty);
    const maxLength = lerp(465, 330, difficulty);
    const length = side === 'center'
      ? 210 + random() * 145
      : minLength + random() * (maxLength - minLength);
    const slope = (random() - 0.5) * lerp(0.035, 0.09, difficulty);
    const branch = addBranch(generatedFloor, generatedY, side, length, slope);

    const knotChance = 0.35 + (generatedFloor % 4 === 0 ? 0.3 : 0);
    if (random() < knotChance) {
      const margin = 30;
      const x = lerp(branch.x1 + margin, branch.x2 - margin, 0.25 + random() * 0.5);
      addKnot(x, generatedY + 92 + random() * 92, generatedFloor);
    }
  }

  function generateUntil(y) {
    while (generatedY < y) generateNext();
  }

  function recycleWorld() {
    const kill = cameraBottom - 360;
    while (branches.length > 0 && branches[0].y < kill) branchPool.push(branches.shift());
    while (knots.length > 0 && knots[0].y < kill) knotPool.push(knots.shift());
    generateUntil(cameraBottom + H + 950);
  }

  function branchYAt(branch, x) {
    const mid = (branch.x1 + branch.x2) * 0.5;
    return branch.y + (x - mid) * branch.slope;
  }

  function resetRun() {
    runSeed += 1;
    seed = (0x51a7f00d ^ (runSeed * 2654435761)) >>> 0;
    branches.splice(0).forEach((b) => branchPool.push(b));
    knots.splice(0).forEach((k) => knotPool.push(k));
    particles.length = 0;
    messages.length = 0;
    elapsed = 0;
    cameraBottom = -80;
    threatY = -260;
    generatedY = 70;
    generatedFloor = 0;
    lastSide = 'left';
    flash = 0;
    shake = 0;
    scorchCooldown = 0;

    Object.assign(player, {
      x: W / 2,
      y: 98,
      px: W / 2,
      py: 98,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: null,
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      sapHeld: false,
      sap: null,
      wallTimer: 0,
      state: 'grounded',
      squash: 0,
      stretch: 0,
      heat: 0,
      score: 0,
      highestFloor: 0,
      lastFloor: 0,
      combo: 0,
      comboFloors: 0,
      comboTimer: 0,
      hyper: false,
      resin: 0,
      saves: 0,
      bestCombo: 0,
    });

    const start = addBranch(0, 70, 'center', 560, 0);
    player.grounded = start;
    generateUntil(H + 1000);
  }

  function startRun() {
    resetRun();
    mode = 'playing';
    wrap.dataset.playing = 'true';
    canvas.focus();
    tone(220, 0.12, 0.045, 'triangle', 1.8);
  }

  function endRun() {
    if (mode !== 'playing') return;
    mode = 'gameover';
    wrap.dataset.playing = 'false';
    player.sap = null;
    highScore = Math.max(highScore, Math.floor(player.score));
    localStorage.setItem('crownrush.highscore', String(highScore));
    burst(player.x, player.y, 30, 'ember', 1.2);
    tone(130, 0.35, 0.06, 'sawtooth', 0.35);
    announce('THE CANOPY KEEPS CLIMBING', 2.2, 18);
  }

  function bankCombo(reason = '') {
    if (player.combo <= 0) return;
    const gain = Math.min(0.72, player.comboFloors * 0.035 + player.combo * 0.025);
    player.resin += gain;
    while (player.resin >= 1 && player.saves < 2) {
      player.resin -= 1;
      player.saves += 1;
      announce('SAP CATCH READY', 1.25, 18);
      tone(520, 0.16, 0.04, 'triangle', 1.4);
    }
    player.bestCombo = Math.max(player.bestCombo, player.combo);
    if (reason && player.combo >= 2) announce(`${reason} +${player.combo}`, 0.8, 14);
    player.combo = 0;
    player.comboFloors = 0;
    player.comboTimer = 0;
    player.hyper = false;
  }

  function onLand(branch) {
    const delta = branch.floor - player.lastFloor;
    player.grounded = branch;
    player.coyote = 0.09;
    player.y = branchYAt(branch, player.x) + PLAYER_R;
    player.vy = 0;
    player.squash = 1;
    player.state = 'grounded';

    if (branch.floor > player.highestFloor) {
      player.highestFloor = branch.floor;
      player.score += 12 + branch.floor * 0.16;
    }

    if (delta >= 2) {
      player.combo += 1;
      player.comboFloors += delta;
      player.comboTimer = 2.85;
      player.bestCombo = Math.max(player.bestCombo, player.combo);
      const bonus = delta * 45 * (1 + player.combo * 0.45);
      player.score += bonus;
      if (player.combo === 1) announce(`SKIP ${delta}`, 0.62, 16);
      else if (player.combo === 4) announce('CROWNVELOCITY', 1.0, 28);
      else announce(`${player.combo}×  +${delta} FLOORS`, 0.58, 15);
      player.hyper = player.combo >= 4;
      tone(280 + player.combo * 32, 0.065, 0.03, 'triangle', 1.15);
      burst(player.x, player.y - PLAYER_R, 7 + Math.min(10, player.combo), player.hyper ? 'resin' : 'leaf', 0.55);
    } else if (delta === 1) {
      bankCombo('BANK');
      tone(180, 0.045, 0.02, 'triangle', 0.9);
    } else if (delta < 0) {
      bankCombo('DROP');
    }

    if (branch.floor > player.lastFloor) player.lastFloor = branch.floor;
  }

  function findSapTarget() {
    let best = null;
    let bestScore = Infinity;
    for (const knot of knots) {
      const dx = knot.x - player.x;
      const dy = knot.y - player.y;
      if (dy < -30 || dy > 330) continue;
      const d = hypot(dx, dy);
      if (d > 355 || d < 55) continue;
      const score = d - dy * 0.28;
      if (score < bestScore) {
        best = knot;
        bestScore = score;
      }
    }
    return best;
  }

  function attachSap() {
    if (player.sap || mode !== 'playing') return;
    const knot = findSapTarget();
    if (!knot) {
      tone(92, 0.035, 0.015, 'square', 0.8);
      return;
    }
    const dist = hypot(knot.x - player.x, knot.y - player.y);
    player.sap = {
      knot,
      rest: clamp(dist * 0.72, 92, 205),
      maxStretch: 0,
      age: 0,
    };
    player.grounded = null;
    player.state = 'sapline';
    tone(410, 0.06, 0.028, 'triangle', 1.28);
    burst(player.x, player.y, 5, 'resin', 0.35);
  }

  function releaseSap() {
    const sap = player.sap;
    if (!sap) return;
    const dx = sap.knot.x - player.x;
    const dy = sap.knot.y - player.y;
    const d = Math.max(1, hypot(dx, dy));
    const tx = -dy / d;
    const ty = dx / d;
    const tangentSpeed = player.vx * tx + player.vy * ty;
    const direction = Math.sign(tangentSpeed || player.facing);
    const stored = clamp(sap.maxStretch * 2.25, 0, 250);
    player.vx += tx * direction * stored;
    player.vy += ty * direction * stored + Math.max(0, stored * 0.28);
    player.sap = null;
    player.state = 'airborne';
    player.stretch = 1;
    shake = Math.max(shake, stored / 190);
    tone(300 + stored, 0.09, 0.035, 'sawtooth', 1.45);
    burst(player.x, player.y, 8, 'resin', 0.6 + stored / 350);
  }

  function requestJump() {
    player.jumpBuffer = 0.1;
    player.jumpHeld = true;
  }

  function doJump() {
    const speed = Math.abs(player.vx);
    const momentumLift = Math.min(330, speed * 0.49);
    const comboLift = Math.min(70, player.combo * 10);
    player.vy = 565 + momentumLift + comboLift;
    player.grounded = null;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.state = 'airborne';
    player.stretch = 0.9;
    tone(220 + speed * 0.13, 0.055, 0.025, 'triangle', 1.18);
    burst(player.x, player.y - PLAYER_R, 6, 'leaf', 0.35);
  }

  function rescueFromThreat() {
    if (player.saves <= 0) return false;
    player.saves -= 1;
    player.sap = null;
    player.x = player.x < W / 2 ? LEFT_WALL + 46 : RIGHT_WALL - 46;
    player.y = threatY + 185;
    player.vx = player.x < W / 2 ? 440 : -440;
    player.vy = 650;
    player.lastFloor = Math.max(0, player.highestFloor - 3);
    bankCombo();
    player.heat = 0;
    flash = 1;
    shake = 1.2;
    announce('SAP CATCH!', 1.1, 26);
    burst(player.x, player.y, 28, 'resin', 1.1);
    tone(210, 0.22, 0.055, 'sawtooth', 2.4);
    return true;
  }

  function getInputAxis() {
    let axis = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) axis -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) axis += 1;
    for (const action of pointers.values()) {
      if (action === 'left') axis -= 1;
      if (action === 'right') axis += 1;
    }
    return clamp(axis, -1, 1);
  }

  function updateSap(input, dt) {
    const sap = player.sap;
    if (!sap) return { ax: 0, ay: 0 };
    sap.age += dt;
    const dx = sap.knot.x - player.x;
    const dy = sap.knot.y - player.y;
    const d = Math.max(1, hypot(dx, dy));
    const nx = dx / d;
    const ny = dy / d;
    const tx = -ny;
    const ty = nx;
    const stretch = Math.max(0, d - sap.rest);
    sap.maxStretch = Math.max(sap.maxStretch, stretch);
    const spring = stretch * 24;
    const radialVelocity = player.vx * nx + player.vy * ny;
    const damping = Math.max(0, radialVelocity) * 5.2;
    const pump = input * (player.hyper ? 1760 : 1480);
    return {
      ax: nx * (spring - damping) + tx * pump,
      ay: ny * (spring - damping) + ty * pump,
    };
  }

  function collideBranches(previousY) {
    if (player.vy > 40) return;
    const prevBottom = previousY - PLAYER_R;
    const nowBottom = player.y - PLAYER_R;
    let landed = null;
    let landedY = -Infinity;

    for (const branch of branches) {
      if (player.x < branch.x1 - 7 || player.x > branch.x2 + 7) continue;
      const surface = branchYAt(branch, player.x);
      if (prevBottom + 2 >= surface && nowBottom <= surface + 3 && surface > landedY) {
        landed = branch;
        landedY = surface;
      }
    }

    if (landed) onLand(landed);
  }

  function collideWalls() {
    const left = LEFT_WALL + PLAYER_R;
    const right = RIGHT_WALL - PLAYER_R;
    if (player.x < left) {
      player.x = left;
      if (player.vx < -70) {
        const speed = Math.abs(player.vx);
        player.vx = speed * 0.92 + 38;
        player.vy = Math.max(player.vy, 170 + Math.min(310, speed * 0.38));
        player.facing = 1;
        player.grounded = null;
        player.wallTimer = 0.12;
        player.state = 'wall-bounce';
        shake = Math.max(shake, speed / 850);
        burst(player.x - PLAYER_R, player.y, 7, 'bark', 0.48);
        tone(150 + speed * 0.12, 0.055, 0.025, 'square', 1.32);
      }
    } else if (player.x > right) {
      player.x = right;
      if (player.vx > 70) {
        const speed = Math.abs(player.vx);
        player.vx = -(speed * 0.92 + 38);
        player.vy = Math.max(player.vy, 170 + Math.min(310, speed * 0.38));
        player.facing = -1;
        player.grounded = null;
        player.wallTimer = 0.12;
        player.state = 'wall-bounce';
        shake = Math.max(shake, speed / 850);
        burst(player.x + PLAYER_R, player.y, 7, 'bark', 0.48);
        tone(150 + speed * 0.12, 0.055, 0.025, 'square', 1.32);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.985, dt * 120);
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      messages[i].life -= dt;
      if (messages[i].life <= 0) messages.splice(i, 1);
    }
  }

  function update(dt) {
    if (mode !== 'playing') {
      updateParticles(dt);
      return;
    }

    elapsed += dt;
    flash = Math.max(0, flash - dt * 2.4);
    shake = Math.max(0, shake - dt * 2.8);
    scorchCooldown = Math.max(0, scorchCooldown - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyote = Math.max(0, player.coyote - dt);
    player.wallTimer = Math.max(0, player.wallTimer - dt);
    player.comboTimer = Math.max(0, player.comboTimer - dt);
    player.squash = Math.max(0, player.squash - dt * 7);
    player.stretch = Math.max(0, player.stretch - dt * 5);
    player.heat = Math.max(0, player.heat - dt * 0.75);

    if (player.combo > 0 && player.comboTimer <= 0) bankCombo('TIME');

    const input = getInputAxis();
    if (input !== 0) player.facing = input;

    player.px = player.x;
    player.py = player.y;
    const previousY = player.y;

    const onGround = Boolean(player.grounded);
    if (onGround) player.coyote = 0.09;
    if (player.jumpBuffer > 0 && (onGround || player.coyote > 0)) doJump();

    const maxSpeed = 520 + Math.min(220, player.combo * 22) + (player.hyper ? 45 : 0);
    const accel = onGround ? 2550 : 1250;
    player.vx += input * accel * dt;
    player.vx = clamp(player.vx, -maxSpeed, maxSpeed);

    if (onGround && input === 0) player.vx *= Math.pow(0.82, dt * 60);
    else if (!onGround) player.vx *= Math.pow(0.997, dt * 120);

    const sapForce = updateSap(input, dt);
    player.vx += sapForce.ax * dt;
    player.vy += (GRAVITY + sapForce.ay) * dt;

    if (!player.jumpHeld && player.vy > 280 && !player.sap) player.vy *= Math.pow(0.989, dt * 120);

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.grounded) {
      const branch = player.grounded;
      if (player.x < branch.x1 - 8 || player.x > branch.x2 + 8) {
        player.grounded = null;
        player.state = 'airborne';
      } else {
        player.y = branchYAt(branch, player.x) + PLAYER_R;
      }
    }

    collideWalls();
    if (!player.grounded) collideBranches(previousY);

    if (!player.grounded && !player.sap && player.state !== 'wall-bounce') player.state = player.vy > 20 ? 'airborne-up' : 'airborne-down';
    if (player.sap) player.state = 'sapline';

    const speed = hypot(player.vx, player.vy);
    player.score += dt * (1 + speed * 0.0025) * (player.combo > 0 ? 1 + player.combo * 0.08 : 1);

    const baseThreatSpeed = 42 + Math.min(105, elapsed * 0.56) + Math.min(65, player.highestFloor * 0.23);
    threatY += baseThreatSpeed * dt;

    if (player.y < threatY + 48 && scorchCooldown <= 0) {
      scorchCooldown = 0.72;
      player.heat = 1;
      player.vx *= 0.42;
      player.vy = Math.max(player.vy, 230);
      bankCombo('SCORCHED');
      shake = 0.8;
      flash = Math.max(flash, 0.35);
      announce('MOMENTUM BURN', 0.8, 17);
      tone(110, 0.14, 0.05, 'sawtooth', 0.62);
    }

    if (player.y < threatY - 28 && !rescueFromThreat() && player.y < threatY - 95) endRun();

    const lookAhead = clamp(Math.max(0, player.vy) * 0.085 + Math.abs(player.vx) * 0.018, 0, 92);
    const targetCamera = player.y - 180 - lookAhead;
    const pressureCamera = threatY - 18;
    cameraBottom = Math.max(cameraBottom, pressureCamera, lerp(cameraBottom, targetCamera, clamp(dt * 4.8, 0, 1)));

    recycleWorld();
    updateParticles(dt);
  }

  function worldToScreenY(y) {
    return H - (y - cameraBottom);
  }

  function drawBackground() {
    const heightFactor = clamp(player.highestFloor / 180, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${Math.round(5 + heightFactor * 8)}, ${Math.round(18 + heightFactor * 9)}, ${Math.round(18 + heightFactor * 22)})`);
    g.addColorStop(0.56, '#08150f');
    g.addColorStop(1, '#030806');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const starAlpha = clamp((player.highestFloor - 30) / 110, 0.02, 0.85);
    for (const s of stars) {
      const y = (s.y + cameraBottom * s.p * 0.08) % H;
      ctx.globalAlpha = s.a * starAlpha;
      ctx.fillStyle = '#dfffe8';
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const fog = ctx.createRadialGradient(W / 2, H * 0.78, 40, W / 2, H * 0.78, 430);
    fog.addColorStop(0, `rgba(63, 116, 78, ${0.09 * (1 - heightFactor)})`);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTrunk(x, width, flip = 1) {
    const grad = ctx.createLinearGradient(x, 0, x + width * flip, 0);
    grad.addColorStop(0, '#170d09');
    grad.addColorStop(0.22, '#4d2515');
    grad.addColorStop(0.5, '#6a331c');
    grad.addColorStop(0.78, '#32170f');
    grad.addColorStop(1, '#120b08');
    ctx.fillStyle = grad;
    ctx.fillRect(flip > 0 ? x : x - width, 0, width, H);

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#b26937';
    ctx.lineWidth = 2;
    for (let i = 0; i < 13; i += 1) {
      const offset = (i / 12) * width;
      ctx.beginPath();
      for (let y = -30; y <= H + 30; y += 24) {
        const wiggle = Math.sin((y + cameraBottom * 0.45) * 0.032 + i * 1.8) * (3 + (i % 3));
        const px = flip > 0 ? x + offset + wiggle : x - offset - wiggle;
        if (y === -30) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#0b0705';
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i += 1) {
      const offset = (i + 0.5) * width / 6;
      ctx.beginPath();
      ctx.moveTo(flip > 0 ? x + offset : x - offset, -10);
      ctx.bezierCurveTo(
        flip > 0 ? x + offset - 11 : x - offset + 11, H * 0.32,
        flip > 0 ? x + offset + 15 : x - offset - 15, H * 0.66,
        flip > 0 ? x + offset - 4 : x - offset + 4, H + 10
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBranch(branch) {
    const y1 = worldToScreenY(branchYAt(branch, branch.x1));
    const y2 = worldToScreenY(branchYAt(branch, branch.x2));
    if (Math.max(y1, y2) < -40 || Math.min(y1, y2) > H + 40) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b150d';
    ctx.lineWidth = branch.thickness + 8;
    ctx.beginPath();
    ctx.moveTo(branch.x1, y1);
    ctx.lineTo(branch.x2, y2);
    ctx.stroke();

    const grad = ctx.createLinearGradient(branch.x1, y1, branch.x2, y2);
    grad.addColorStop(0, '#70371d');
    grad.addColorStop(0.42, '#9a5127');
    grad.addColorStop(1, '#4b2416');
    ctx.strokeStyle = grad;
    ctx.lineWidth = branch.thickness;
    ctx.beginPath();
    ctx.moveTo(branch.x1, y1);
    ctx.lineTo(branch.x2, y2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(245,179,94,.25)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(branch.x1 + 4, y1 - 2);
    ctx.lineTo(branch.x2 - 4, y2 - 2);
    ctx.stroke();

    if (branch.floor > 0 && branch.floor % 10 === 0) {
      ctx.fillStyle = 'rgba(205,255,210,.28)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = branch.side === 'right' ? 'right' : 'left';
      ctx.fillText(String(branch.floor), branch.side === 'right' ? branch.x2 - 8 : branch.x1 + 8, Math.min(y1, y2) - 10);
    }
    ctx.restore();
  }

  function drawKnot(knot, time) {
    const y = worldToScreenY(knot.y);
    if (y < -50 || y > H + 50) return;
    const pulse = 1 + Math.sin(time * 3 + knot.pulse) * 0.12;
    const g = ctx.createRadialGradient(knot.x, y, 2, knot.x, y, 20 * pulse);
    g.addColorStop(0, 'rgba(255,246,164,.95)');
    g.addColorStop(0.25, 'rgba(255,180,73,.72)');
    g.addColorStop(1, 'rgba(255,132,37,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(knot.x, y, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6b84f';
    ctx.beginPath();
    ctx.arc(knot.x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,241,188,.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawSapline(alpha) {
    if (!player.sap) return;
    const sx = lerp(player.px, player.x, alpha);
    const sy = worldToScreenY(lerp(player.py, player.y, alpha));
    const ky = worldToScreenY(player.sap.knot.y);
    const dx = player.sap.knot.x - sx;
    const dy = ky - sy;
    const midX = sx + dx * 0.5 - dy * 0.06;
    const midY = sy + dy * 0.5 + dx * 0.04;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffbd55';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255,201,99,.88)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(midX, midY, player.sap.knot.x, ky);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,249,214,.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(alpha, time) {
    const x = lerp(player.px, player.x, alpha);
    const wy = lerp(player.py, player.y, alpha);
    const y = worldToScreenY(wy);
    const speed = hypot(player.vx, player.vy);
    const tilt = clamp(player.vx / 850, -0.48, 0.48);
    const airborne = !player.grounded;
    const squash = player.squash * 0.16;
    const stretch = player.stretch * 0.12 + (airborne ? clamp(Math.abs(player.vy) / 1400, 0, 0.08) : 0);
    const sx = 1 + squash - stretch * 0.4;
    const sy = 1 - squash + stretch;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(sx * player.facing, sy);

    if (player.hyper && !reducedMotion) {
      ctx.globalAlpha = 0.16;
      for (let i = 1; i <= 3; i += 1) {
        ctx.fillStyle = '#93ffbe';
        ctx.beginPath();
        ctx.ellipse(-player.facing * i * 11, i * 4, 14, 19, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Leaf scarf. Its direction makes speed readable before the HUD does.
    ctx.fillStyle = '#74d78f';
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.quadraticCurveTo(-18 - speed * 0.012, -8 + Math.sin(time * 10) * 2, -29 - speed * 0.016, 4);
    ctx.quadraticCurveTo(-15, 7, -4, 5);
    ctx.closePath();
    ctx.fill();

    // Acorn boots.
    ctx.fillStyle = '#372118';
    ctx.beginPath(); ctx.ellipse(-7, 16, 7, 4.5, -0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, 16, 7, 4.5, 0.16, 0, Math.PI * 2); ctx.fill();

    // Pip's body.
    const bodyGrad = ctx.createLinearGradient(0, -18, 0, 18);
    bodyGrad.addColorStop(0, '#f5d8a9');
    bodyGrad.addColorStop(1, '#bf7f55');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 1, 13.5, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leaf ears.
    ctx.fillStyle = '#9fe5a8';
    ctx.beginPath();
    ctx.moveTo(-9, -13); ctx.quadraticCurveTo(-20, -27, -15, -3); ctx.quadraticCurveTo(-10, -9, -9, -13); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -13); ctx.quadraticCurveTo(20, -27, 15, -3); ctx.quadraticCurveTo(10, -9, 9, -13); ctx.fill();

    // Face reacts to speed and danger.
    ctx.fillStyle = '#20140f';
    const eyeY = player.heat > 0.35 ? -4 : -5;
    ctx.beginPath(); ctx.arc(-5, eyeY, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, eyeY, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4c2c20';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (player.hyper) ctx.arc(0, 1, 5, 0.1, Math.PI - 0.1);
    else if (player.vy < -500) { ctx.moveTo(-3, 2); ctx.lineTo(3, 2); }
    else ctx.arc(0, 1, 3.2, 0.25, Math.PI - 0.25);
    ctx.stroke();

    // Sap stick. It is a traversal instrument, not a weapon.
    ctx.save();
    ctx.translate(9, 6);
    ctx.rotate(-0.48 + Math.sin(time * 7) * 0.04);
    ctx.strokeStyle = '#5e321c';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -17); ctx.stroke();
    ctx.shadowColor = '#ffc766';
    ctx.shadowBlur = player.sap ? 14 : 7;
    ctx.fillStyle = player.sap ? '#fff1a7' : '#e8a94f';
    ctx.beginPath(); ctx.arc(0, -19, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const y = worldToScreenY(p.y);
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'resin') ctx.fillStyle = '#ffca65';
      else if (p.kind === 'ember') ctx.fillStyle = '#ff663f';
      else if (p.kind === 'bark') ctx.fillStyle = '#a45a2b';
      else ctx.fillStyle = '#89d696';
      ctx.beginPath();
      if (p.kind === 'leaf') ctx.ellipse(p.x, y, p.r * 1.5, p.r * 0.65, p.x * 0.01, 0, Math.PI * 2);
      else ctx.arc(p.x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawThreat(time) {
    const y = worldToScreenY(threatY);
    if (y < -120 || y > H + 160) return;
    const g = ctx.createLinearGradient(0, y - 90, 0, H);
    g.addColorStop(0, 'rgba(255,108,48,0)');
    g.addColorStop(0.38, 'rgba(255,87,39,.28)');
    g.addColorStop(1, 'rgba(110,16,8,.84)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 90, W, H - y + 90);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,176,62,.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const wave = Math.sin(x * 0.048 + time * 5.5) * 8 + Math.sin(x * 0.019 - time * 3) * 5;
      const py = y + wave;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSpeedLines() {
    if (reducedMotion) return;
    const speed = hypot(player.vx, player.vy);
    const intensity = clamp((speed - 620) / 520 + (player.hyper ? 0.45 : 0), 0, 1);
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalAlpha = intensity * 0.23;
    ctx.strokeStyle = '#c8ffe0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i += 1) {
      const x = (i * 73 + cameraBottom * 0.17) % W;
      const y = (i * 41 + elapsed * 440) % H;
      const len = 20 + intensity * 70;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - player.vx * 0.025, y + Math.sign(player.vy || 1) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(235,255,239,.48)';
    ctx.fillText(`FLOOR ${player.highestFloor}`, 22, 18);
    ctx.fillText(`SCORE ${Math.floor(player.score).toString().padStart(6, '0')}`, 22, 35);
    ctx.fillText(`BEST ${Math.floor(highScore).toString().padStart(6, '0')}`, 22, 52);

    if (player.combo > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = player.hyper ? '#a8ffc9' : 'rgba(255,232,164,.88)';
      ctx.font = `${player.hyper ? 22 : 17}px ui-monospace, monospace`;
      ctx.fillText(`${player.combo}× COMBO`, W - 22, 18);
      ctx.font = '9px ui-monospace, monospace';
      const width = 122;
      const t = clamp(player.comboTimer / 2.85, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(W - 22 - width, 47, width, 3);
      ctx.fillStyle = player.hyper ? '#8dffb8' : '#f1c66a';
      ctx.fillRect(W - 22 - width, 47, width * t, 3);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(235,255,239,.42)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('SAP CATCH', 22, H - 36);
    for (let i = 0; i < 2; i += 1) {
      ctx.strokeStyle = 'rgba(255,195,91,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(91 + i * 18, H - 31, 5.5, 0, Math.PI * 2); ctx.stroke();
      if (i < player.saves) {
        ctx.fillStyle = '#ffc461';
        ctx.beginPath(); ctx.arc(91 + i * 18, H - 31, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (player.saves < 2) {
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      ctx.fillRect(128, H - 34, 72, 4);
      ctx.fillStyle = '#d49745';
      ctx.fillRect(128, H - 34, 72 * clamp(player.resin, 0, 1), 4);
    }
    ctx.restore();
  }

  function drawMessages() {
    let y = H * 0.26;
    for (const message of messages.slice(-3)) {
      const t = message.life / message.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 5 + 0.25);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${message.size}px ui-monospace, monospace`;
      ctx.fillStyle = '#edffe8';
      ctx.shadowColor = '#68ff9c';
      ctx.shadowBlur = 16;
      ctx.fillText(message.text, W / 2, y);
      ctx.restore();
      y += message.size + 8;
    }
  }

  function drawTouchControls() {
    if (!touchMode || mode !== 'playing') return;
    const items = [
      { x: 76, label: '◀', action: 'left' },
      { x: 154, label: '▶', action: 'right' },
      { x: W - 154, label: 'JUMP', action: 'jump' },
      { x: W - 70, label: 'SAP', action: 'sap' },
    ];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of items) {
      const active = [...pointers.values()].includes(item.action);
      ctx.fillStyle = active ? 'rgba(174,255,197,.18)' : 'rgba(255,255,255,.06)';
      ctx.strokeStyle = active ? 'rgba(174,255,197,.55)' : 'rgba(255,255,255,.13)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(item.x, H - 74, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = active ? '#d9ffe3' : 'rgba(255,255,255,.48)';
      ctx.font = item.label.length > 2 ? '8px ui-monospace, monospace' : '16px ui-monospace, monospace';
      ctx.fillText(item.label, item.x, H - 74);
    }
    ctx.restore();
  }

  function drawOverlay() {
    if (mode === 'playing') return;
    ctx.fillStyle = 'rgba(2,7,5,.58)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (mode === 'title') {
      const g = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
      g.addColorStop(0, '#8cffad');
      g.addColorStop(0.55, '#efffcf');
      g.addColorStop(1, '#ffbc62');
      ctx.fillStyle = g;
      ctx.font = '700 56px ui-monospace, monospace';
      ctx.fillText('CROWNRUSH', W / 2, H * 0.34);
      ctx.fillStyle = 'rgba(232,255,239,.62)';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('TWIN SEQUOIA KINETIC CLIMBER', W / 2, H * 0.42);
      ctx.fillStyle = 'rgba(232,255,239,.42)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('run to bank speed · skip branches · bounce bark · pump the sapline', W / 2, H * 0.52);
      ctx.fillText('4 consecutive skips ignites CROWNVELOCITY', W / 2, H * 0.56);
      ctx.fillStyle = '#dfffe7';
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillText(touchMode ? 'TAP TO CLIMB' : 'SPACE TO CLIMB', W / 2, H * 0.67);
    } else if (mode === 'paused') {
      ctx.fillStyle = '#eaffef';
      ctx.font = '700 32px ui-monospace, monospace';
      ctx.fillText('PAUSED IN THE BARK', W / 2, H * 0.45);
      ctx.fillStyle = 'rgba(232,255,239,.55)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('P or Space to resume', W / 2, H * 0.53);
    } else if (mode === 'gameover') {
      ctx.fillStyle = '#fff0d1';
      ctx.font = '700 34px ui-monospace, monospace';
      ctx.fillText('FALL ENDS. RHYTHM DOESN’T.', W / 2, H * 0.36);
      ctx.fillStyle = 'rgba(232,255,239,.72)';
      ctx.font = '14px ui-monospace, monospace';
      ctx.fillText(`floor ${player.highestFloor} · score ${Math.floor(player.score)} · best combo ${player.bestCombo}×`, W / 2, H * 0.45);
      ctx.fillStyle = 'rgba(232,255,239,.46)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`best score ${Math.floor(highScore)}`, W / 2, H * 0.50);
      ctx.fillStyle = '#dfffe7';
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillText(touchMode ? 'TAP TO RUN AGAIN' : 'SPACE TO RUN AGAIN', W / 2, H * 0.62);
    }
  }

  function render(alpha, now) {
    ctx.save();
    const speed = hypot(player.vx, player.vy);
    const hyperZoom = reducedMotion ? 1 : 1 + clamp((speed - 720) / 1400, 0, 0.025) + (player.hyper ? 0.018 : 0);
    const sx = shake > 0 && !reducedMotion ? (random() - 0.5) * shake * 8 : 0;
    const sy = shake > 0 && !reducedMotion ? (random() - 0.5) * shake * 7 : 0;
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(hyperZoom, hyperZoom);
    ctx.translate(-W / 2, -H / 2);

    drawBackground();
    drawSpeedLines();
    drawTrunk(0, LEFT_WALL, 1);
    drawTrunk(W, W - RIGHT_WALL, -1);
    for (const branch of branches) drawBranch(branch);
    for (const knot of knots) drawKnot(knot, now * 0.001);
    drawThreat(now * 0.001);
    drawSapline(alpha);
    drawParticles();
    drawPlayer(alpha, now * 0.001);
    ctx.restore();

    drawHud();
    drawMessages();
    drawTouchControls();
    drawOverlay();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,211,139,${flash * 0.2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function handleKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat && ['Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyP'].includes(event.code)) return;

    if (event.code === 'Escape') return;
    if (event.code === 'KeyP') {
      if (mode === 'playing') {
        pausedFrom = mode;
        mode = 'paused';
        wrap.dataset.playing = 'false';
      } else if (mode === 'paused') {
        mode = pausedFrom;
        wrap.dataset.playing = 'true';
      }
      return;
    }

    if (mode === 'title' || mode === 'gameover') {
      if (event.code === 'Space' || event.code === 'Enter') startRun();
      return;
    }
    if (mode === 'paused') {
      if (event.code === 'Space' || event.code === 'Enter') {
        mode = 'playing';
        wrap.dataset.playing = 'true';
      }
      return;
    }

    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') requestJump();
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyE') {
      player.sapHeld = true;
      attachSap();
    }
  }

  function handleKeyUp(event) {
    keys.delete(event.code);
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') player.jumpHeld = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyE') {
      player.sapHeld = false;
      releaseSap();
    }
  }

  function pointerAction(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * W / rect.width;
    if (x < W * 0.24) return 'left';
    if (x < W * 0.48) return 'right';
    if (x < W * 0.76) return 'jump';
    return 'sap';
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus();
    if (mode === 'title' || mode === 'gameover') {
      startRun();
      return;
    }
    if (mode === 'paused') {
      mode = 'playing';
      wrap.dataset.playing = 'true';
      return;
    }
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const action = pointerAction(event);
    pointers.set(event.pointerId, action);
    if (action === 'jump') requestJump();
    if (action === 'sap') {
      player.sapHeld = true;
      attachSap();
    }
  });

  function endPointer(event) {
    const action = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (action === 'jump') player.jumpHeld = false;
    if (action === 'sap' && ![...pointers.values()].includes('sap')) {
      player.sapHeld = false;
      releaseSap();
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', () => {
    keys.clear();
    pointers.clear();
    player.jumpHeld = false;
    if (player.sapHeld) releaseSap();
    player.sapHeld = false;
  });

  function frame(now) {
    const frameDt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps === MAX_STEPS) accumulator = 0;
    render(accumulator / FIXED_DT, now);
    requestAnimationFrame(frame);
  }

  resetRun();
  window.CROWNRUSH_DEBUG = {
    version: '0.1.0',
    fixedHz: 120,
    getState: () => ({
      mode,
      floor: player.highestFloor,
      score: Math.floor(player.score),
      combo: player.combo,
      hyper: player.hyper,
      saves: player.saves,
      branchCount: branches.length,
      knotCount: knots.length,
      player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, state: player.state },
    }),
    start: startRun,
  };
  requestAnimationFrame(frame);
})();
