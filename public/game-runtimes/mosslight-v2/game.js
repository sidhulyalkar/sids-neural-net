(() => {
  'use strict';

  const W = 960;
  const H = 640;
  const TAU = Math.PI * 2;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const rooms = window.MosslightContent.rooms;
  const $ = (id) => document.getElementById(id);

  const ABILITIES = {
    rain: { name: 'Rain', icon: '🌧️', color: '#6bdcff', freq: 340 },
    sun: { name: 'Sun', icon: '☀️', color: '#ffd66b', freq: 520 },
    seed: { name: 'Seed', icon: '🌱', color: '#7bf19d', freq: 410 },
    wind: { name: 'Wind', icon: '🍃', color: '#c8f7ed', freq: 620 },
    mend: { name: 'Mend', icon: '💚', color: '#ff8ebc', freq: 455 },
    gather: { name: 'Gather', icon: '🍎', color: '#ffb66e', freq: 570 },
  };
  const ABILITY_IDS = Object.keys(ABILITIES);

  const ui = {
    title: $('title'), pause: $('pauseScreen'), victory: $('victory'), start: $('start'), challenge: $('challenge'), resume: $('resume'), again: $('again'), flowAgain: $('flowAgain'),
    roomKicker: $('roomKicker'), roomTitle: $('roomTitle'), roomTask: $('roomTask'), hint: $('hintCard'), chain: $('chain'), fruit: $('fruit'), time: $('time'), dash: $('dashState'), toast: $('toast'), intro: $('roomIntro'),
    abilities: [...document.querySelectorAll('.ability')], sumTime: $('sumTime'), sumChain: $('sumChain'), sumHits: $('sumHits'), sumAccuracy: $('sumAccuracy'),
  };

  const keys = new Set();
  const pointer = { x: W * .5, y: H * .5, down: false, seen: false };
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
    projectiles: [], particles: [], trails: [], ripples: [],
    totalTime: 0, roomTime: 0, shootCd: 0, dashCd: 0, dashTime: 0, hitCd: 0,
    chain: 0, bestChain: 0, chainTimer: 0, fruit: 0,
    stats: { casts: 0, correct: 0, wasted: 0, hits: 0, fruit: 0, dashes: 0 },
    roomStats: [],
    hudClock: 0,
  };

  function cloneRoom(source) {
    return {
      ...source,
      palette: { ...source.palette },
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
      obstacles: source.obstacles.map((obstacle) => ({ ...obstacle })),
      hazards: source.hazards.map((hazard) => ({ ...hazard })),
      complete: false,
    };
  }

  function resetPlayer() {
    state.player = { x: 92, y: H / 2, vx: 0, vy: 0, r: 14, walk: 0, blink: 0, blinkAt: 2.4 + Math.random() * 3, facing: 0 };
  }

  function startGame(difficulty = state.difficulty) {
    state.difficulty = difficulty;
    state.mode = 'playing';
    state.roomIndex = 0;
    state.totalTime = 0;
    state.bestChain = 0;
    state.chain = 0;
    state.chainTimer = 0;
    state.fruit = 0;
    state.stats = { casts: 0, correct: 0, wasted: 0, hits: 0, fruit: 0, dashes: 0 };
    state.roomStats = [];
    state.projectiles = [];
    state.particles = [];
    state.trails = [];
    state.ripples = [];
    ui.title.classList.add('hidden');
    ui.victory.classList.add('hidden');
    ui.pause.classList.add('hidden');
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
    state.dashCd = 0;
    resetPlayer();
    const first = nextUsefulAbility();
    if (first) selectAbility(first, false);
    showIntro();
    syncHud(true);
  }

  function nextRoom() {
    state.roomStats.push({ id: state.room.id, time: state.roomTime, hits: state.stats.hits });
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
    enterRoom(state.roomIndex);
    state.fruit = keepFruit;
    toast('room reset · nothing lost outside this room', 900);
  }

  function winGame() {
    state.mode = 'victory';
    state.roomStats.push({ id: state.room.id, time: state.roomTime, hits: state.stats.hits });
    ui.sumTime.textContent = formatTime(state.totalTime, false);
    ui.sumChain.textContent = `×${state.bestChain}`;
    ui.sumHits.textContent = String(state.stats.hits);
    const accuracy = state.stats.casts ? Math.round((state.stats.correct / state.stats.casts) * 100) : 100;
    ui.sumAccuracy.textContent = `${Math.min(100, accuracy)}%`;
    ui.victory.classList.remove('hidden');
    roomChord(true);
  }

  function pause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      ui.pause.classList.remove('hidden');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      ui.pause.classList.add('hidden');
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
    if (nearest) return targetExpected(nearest);
    return state.room.unlock[0];
  }

  function smartSelect() {
    const useful = nextUsefulAbility();
    if (useful && useful !== state.selected) {
      selectAbility(useful, false);
      toast(`${ABILITIES[useful].icon} ${ABILITIES[useful].name} selected for the next step`, 650);
    }
  }

  function nearestTarget(list = state.room?.targets.filter((target) => !target.done) || []) {
    if (!state.player || !list.length) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const target of list) {
      const d = dist(state.player.x, state.player.y, target.x, target.y);
      if (d < bestDistance) {
        best = target;
        bestDistance = d;
      }
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
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const point = canvasPoint(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.down = true;
    pointer.seen = true;
    ensureAudio();
    fire();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });

  window.addEventListener('keydown', (event) => {
    const lower = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(lower)) event.preventDefault();
    keys.add(lower);
    if (event.key >= '1' && event.key <= '6') selectAbility(ABILITY_IDS[Number(event.key) - 1]);
    if (lower === 'q') cycleAbility(-1);
    if (lower === 'e') cycleAbility(1);
    if (lower === 'r') restartRoom();
    if (lower === 'p') pause();
    if (lower === 'shift' && !event.repeat) tryDash();
    if (lower === 'enter' && state.mode === 'title') startGame('gentle');
    if (lower === 'enter' && state.mode === 'playing' && state.room?.complete) nextRoom();
    if (lower === ' ' && state.mode === 'playing') fire();
  }, { passive: false });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); pointer.down = false; if (state.mode === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'playing') pause(); });

  ui.abilities.forEach((button) => button.addEventListener('click', () => selectAbility(button.dataset.a)));
  ui.start.addEventListener('click', () => startGame('gentle'));
  ui.challenge.addEventListener('click', () => startGame('flow'));
  ui.resume.addEventListener('click', pause);
  ui.again.addEventListener('click', () => startGame('gentle'));
  ui.flowAgain.addEventListener('click', () => startGame('flow'));

  function aimVector() {
    let ax = (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0);
    let ay = (keys.has('arrowdown') ? 1 : 0) - (keys.has('arrowup') ? 1 : 0);
    if (ax || ay) {
      const length = Math.hypot(ax, ay);
      state.lastAim = { x: ax / length, y: ay / length };
    } else if (pointer.seen && state.player) {
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
      if (distance > 330 || distance < 1) continue;
      const tx = dx / distance;
      const ty = dy / distance;
      const dot = base.x * tx + base.y * ty;
      if (dot < .82) continue;
      const score = dot * 2 - distance / 500;
      if (score > bestScore) {
        bestScore = score;
        best = { x: tx, y: ty };
      }
    }
    if (!best) return base;
    const blend = .44;
    const x = base.x * (1 - blend) + best.x * blend;
    const y = base.y * (1 - blend) + best.y * blend;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function tryDash() {
    if (state.mode !== 'playing' || state.dashCd > 0) return;
    let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    if (!dx && !dy) ({ x: dx, y: dy } = aimVector());
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    state.player.vx = dx * 530;
    state.player.vy = dy * 530;
    state.dashTime = .13;
    state.dashCd = state.difficulty === 'gentle' ? .72 : .9;
    state.stats.dashes++;
    burst(state.player.x, state.player.y, '#d9fff2', 14, 170, 'leaf');
    tone(190, .05, 'sawtooth', .015);
    tone(390, .07, 'sine', .012, .018);
  }

  function fire() {
    if (state.mode !== 'playing' || state.shootCd > 0) return;
    const ability = state.selected;
    const base = aimVector();
    const vector = assistedAim(base, ability);
    const player = state.player;
    state.projectiles.push({
      x: player.x + vector.x * 22,
      y: player.y + vector.y * 22,
      vx: vector.x * 590,
      vy: vector.y * 590,
      r: ability === 'wind' ? 9 : 7,
      ability,
      life: 1.18,
      trailClock: 0,
    });
    state.shootCd = ability === 'wind' ? .14 : .16;
    state.stats.casts++;
    tone(ABILITIES[ability].freq, .032, ability === 'wind' ? 'triangle' : 'sine', .011);
  }

  function update(dt, now) {
    const room = state.room;
    const player = state.player;
    state.totalTime += dt;
    state.roomTime += dt;
    state.shootCd = Math.max(0, state.shootCd - dt);
    state.dashCd = Math.max(0, state.dashCd - dt);
    state.dashTime = Math.max(0, state.dashTime - dt);
    state.hitCd = Math.max(0, state.hitCd - dt);
    state.chainTimer = Math.max(0, state.chainTimer - dt);
    if (state.chainTimer === 0) state.chain = 0;

    let mx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let my = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const length = Math.hypot(mx, my);
    if (length) { mx /= length; my /= length; }
    const accel = state.dashTime > 0 ? 720 : 1380;
    const maxSpeed = state.dashTime > 0 ? 545 : 225;
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
    resolveBounds(player);
    for (const obstacle of room.obstacles) resolveObstacle(player, obstacle);

    if (pointer.down && state.shootCd <= 0) fire();

    for (const projectile of state.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      projectile.trailClock -= dt;
      if (projectile.trailClock <= 0) {
        projectile.trailClock = .035;
        state.trails.push({ x: projectile.x, y: projectile.y, ability: projectile.ability, life: .28, r: projectile.r * .72 });
      }
    }

    for (const target of room.targets) {
      if (target.kind === 'animal' && !target.done) {
        const wander = target.wander || 0;
        const seed = hash(target.id);
        target.x = target.baseX + Math.sin(now * .00072 + seed * 8) * wander;
        target.y = target.baseY + Math.cos(now * .00058 + seed * 11) * wander * .55;
      }
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

    for (const projectile of state.projectiles) {
      if (projectile.life <= 0) continue;
      for (const target of room.targets) {
        if (target.done) continue;
        const hitPadding = state.difficulty === 'gentle' ? 12 : 5;
        if (dist(projectile.x, projectile.y, target.x, target.y) < projectile.r + target.r + hitPadding) {
          hitTarget(target, projectile);
          projectile.life = 0;
          break;
        }
      }
    }
    state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -30 && projectile.x < W + 30 && projectile.y > -30 && projectile.y < H + 30);

    const progress = roomProgress();
    const hazardSpeed = (state.difficulty === 'gentle' ? .62 : 1) * (.36 + .64 * (1 - progress));
    for (const hazard of room.hazards) {
      hazard.x += hazard.vx * dt * hazardSpeed;
      hazard.y += hazard.vy * dt * hazardSpeed;
      if (hazard.x < hazard.r + 46 || hazard.x > W - hazard.r - 46) hazard.vx *= -1;
      if (hazard.y < hazard.r + 72 || hazard.y > H - hazard.r - 55) hazard.vy *= -1;
      hazard.x = clamp(hazard.x, hazard.r + 46, W - hazard.r - 46);
      hazard.y = clamp(hazard.y, hazard.r + 72, H - hazard.r - 55);
      if (state.hitCd <= 0 && dist(player.x, player.y, hazard.x, hazard.y) < player.r + hazard.r) {
        const dx = player.x - hazard.x;
        const dy = player.y - hazard.y;
        const l = Math.hypot(dx, dy) || 1;
        player.vx = dx / l * 290;
        player.vy = dy / l * 290;
        state.hitCd = .7;
        state.stats.hits++;
        if (state.difficulty === 'flow') { state.chain = 0; state.chainTimer = 0; }
        burst(player.x, player.y, hazardColor(hazard.type), 14, 120, 'spark');
        wrongTone();
        toast(state.difficulty === 'gentle' ? 'soft bump · keep restoring' : 'stress front · chain reset', 650);
      }
    }

    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(.2, dt);
      particle.vy *= Math.pow(.2, dt);
      particle.life -= dt;
      particle.r *= Math.pow(.58, dt);
    }
    for (const trail of state.trails) trail.life -= dt;
    for (const ripple of state.ripples) { ripple.life -= dt; ripple.r += 70 * dt; }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    state.trails = state.trails.filter((trail) => trail.life > 0);
    state.ripples = state.ripples.filter((ripple) => ripple.life > 0);

    if (!room.complete && room.targets.every((target) => target.done)) {
      room.complete = true;
      roomChord();
      burst(W - 64, H / 2, room.palette.accent, 36, 220, 'leaf');
      toast('room breathing · walk through the eastern light', 1600);
    }
    if (room.complete && player.x > 904 && Math.abs(player.y - H / 2) < 92) nextRoom();

    state.hudClock += dt;
    if (state.hudClock > .08) {
      state.hudClock = 0;
      syncHud();
    }
  }

  function hitTarget(target, projectile) {
    const ability = projectile.ability;
    if (target.kind === 'cloud' && target.step === 0) {
      if (ability !== 'wind') { wrong(target, ability); return; }
      target.primed = true;
      const l = Math.hypot(projectile.vx, projectile.vy) || 1;
      target.vx += projectile.vx / l * (state.difficulty === 'gentle' ? 210 : 250);
      target.vy += projectile.vy / l * (state.difficulty === 'gentle' ? 210 : 250);
      burst(target.x, target.y, ABILITIES.wind.color, 8, 80, 'leaf');
      tone(ABILITIES.wind.freq, .04, 'triangle', .016);
      return;
    }

    if (target.kind === 'sluice' && !target.done) {
      if (ability !== 'rain') { wrong(target, ability); return; }
      target.orientation = (target.orientation + 1) % 4;
      state.stats.correct++;
      state.chain++;
      state.bestChain = Math.max(state.bestChain, state.chain);
      state.chainTimer = chainWindow();
      ripple(target.x, target.y, ABILITIES.rain.color);
      tone(ABILITIES.rain.freq, .05, 'triangle', .022);
      if (target.orientation === target.goal) {
        target.done = true;
        correct(target, 'flow aligned', true, 'rain');
        smartSelect();
      } else {
        toast('sluice turned · follow the pale arrow', 560);
      }
      return;
    }

    const expected = targetExpected(target);
    if (ability !== expected) { wrong(target, ability); return; }

    if ((target.kind === 'animal' || target.kind === 'heart') && ability === 'gather' && state.fruit <= 0) {
      toast(`${target.label} is ready · restore a fruit tree first`, 900);
      wrongTone();
      return;
    }

    if ((target.kind === 'animal' || target.kind === 'heart') && ability === 'gather') state.fruit--;
    target.step++;

    if (target.step >= target.sequence.length) {
      target.done = true;
      if (target.kind === 'fruit') {
        const amount = target.yield || 2;
        state.fruit += amount;
        state.stats.fruit += amount;
        toast(`+${amount} fruit · a healthy tree feeds the next relationship`, 900);
      }
      correct(target, `${target.label} restored`, true, ability);
      smartSelect();
    } else {
      correct(target, `${ABILITIES[ability].name} accepted`, false, ability);
      if (state.difficulty === 'gentle') {
        const next = targetExpected(target);
        if (next && next !== state.selected) {
          selectAbility(next, false);
          toast(`${ABILITIES[next].icon} ${target.label} needs ${ABILITIES[next].name} next`, 720);
        }
      }
    }
  }

  function chainWindow() { return state.difficulty === 'gentle' ? 3.45 : 2.35; }

  function correct(target, label, finish = false, ability = state.selected) {
    state.stats.correct++;
    state.chain++;
    state.chainTimer = chainWindow();
    state.bestChain = Math.max(state.bestChain, state.chain);
    const color = ABILITIES[ability]?.color || state.room.palette.accent;
    burst(target.x, target.y, color, finish ? 20 : 11, finish ? 145 : 92, ability === 'rain' ? 'drop' : ability === 'seed' ? 'leaf' : 'spark');
    ripple(target.x, target.y, color);
    tone((ABILITIES[ability]?.freq || 440) * (1 + Math.min(7, state.chain) * .022), finish ? .11 : .055, 'sine', finish ? .028 : .018);
    if (finish) toast(label, 690);
  }

  function wrong(target, ability) {
    state.stats.wasted++;
    if (state.difficulty === 'flow') {
      state.chain = Math.max(0, state.chain - 1);
      state.chainTimer = Math.min(state.chainTimer, .6);
    }
    wrongTone();
    burst(target.x, target.y, '#789086', 5, 50, 'spark');
    const need = targetExpected(target);
    toast(`${ABILITIES[ability].name} drifts away · ${target.label} needs ${ABILITIES[need]?.name || 'another step'}`, 760);
  }

  function roomProgress() {
    const room = state.room;
    if (!room) return 0;
    let done = 0;
    let total = 0;
    for (const target of room.targets) {
      const steps = Math.max(1, target.sequence.length);
      total += steps;
      done += target.done ? steps : target.step;
      if (target.kind === 'cloud' && target.primed && target.step === 0) done += .3;
      if (target.kind === 'sluice' && !target.done) done += Math.min(.6, target.orientation === target.goal ? .6 : 0);
    }
    return clamp(done / Math.max(1, total), 0, 1);
  }

  function resolveBounds(player) {
    player.x = clamp(player.x, player.r + 36, W - player.r - 28);
    player.y = clamp(player.y, player.r + 66, H - player.r - 38);
    if (!state.room.complete && player.x > 892) { player.x = 892; player.vx = Math.min(0, player.vx); }
  }

  function resolveObstacle(player, obstacle) {
    const nx = clamp(player.x, obstacle.x, obstacle.x + obstacle.w);
    const ny = clamp(player.y, obstacle.y, obstacle.y + obstacle.h);
    const dx = player.x - nx;
    const dy = player.y - ny;
    const distance = Math.hypot(dx, dy);
    if (distance >= player.r || distance === 0) return;
    const push = player.r - distance + 1;
    player.x += dx / distance * push;
    player.y += dy / distance * push;
    const dot = player.vx * dx / distance + player.vy * dy / distance;
    if (dot < 0) {
      player.vx -= dot * dx / distance * 1.15;
      player.vy -= dot * dy / distance * 1.15;
    }
  }

  function syncHud(force = false) {
    if (!state.room) return;
    const progress = Math.round(roomProgress() * 100);
    ui.roomKicker.textContent = `room ${String(state.roomIndex + 1).padStart(2, '0')} · restoration ${progress}% · ${state.difficulty}`;
    ui.roomTitle.textContent = state.room.title;
    ui.roomTask.textContent = state.room.task;
    ui.chain.textContent = `×${state.chain}`;
    ui.fruit.textContent = String(state.fruit);
    ui.time.textContent = formatTime(state.totalTime, true);
    ui.dash.textContent = state.dashCd <= 0 ? 'READY' : `${state.dashCd.toFixed(1)}s`;
    ui.dash.style.color = state.dashCd <= 0 ? '#d9fff1' : 'rgba(217,255,241,.38)';
    const nearest = nearestTarget();
    if (state.room.complete) {
      ui.hint.innerHTML = '<strong>Room restored:</strong> follow the eastern light, or press Enter.';
    } else if (nearest && dist(state.player.x, state.player.y, nearest.x, nearest.y) < 245) {
      const need = targetExpected(nearest);
      ui.hint.innerHTML = `<strong>${nearest.label}:</strong> ${ABILITIES[need]?.icon || ''} ${ABILITIES[need]?.name || 'observe'} is the next useful action.`;
    } else {
      ui.hint.innerHTML = `<strong>${state.room.subtitle}:</strong> ${state.room.teaching}`;
    }
    for (const button of ui.abilities) {
      const enabled = state.room.unlock.includes(button.dataset.a);
      button.disabled = !enabled;
      button.classList.toggle('active', button.dataset.a === state.selected);
    }
    if (force) document.documentElement.style.setProperty('--accent', state.room.palette.accent);
  }

  function showIntro() {
    ui.intro.querySelector('.n').textContent = `room ${String(state.roomIndex + 1).padStart(2, '0')} · ${state.room.subtitle}`;
    ui.intro.querySelector('h2').textContent = state.room.title;
    ui.intro.querySelector('p').textContent = `${state.room.task}  ${state.room.mechanic}.`;
    ui.intro.classList.add('show');
    clearTimeout(introTimer);
    introTimer = setTimeout(() => ui.intro.classList.remove('show'), 1350);
  }

  function toast(message, duration = 600) {
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
    const start = ac.currentTime + delay;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
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
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const velocity = speed * (.3 + Math.random() * .75);
      state.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, r: 1.6 + Math.random() * 3, life: .36 + Math.random() * .6, color, shape, spin: Math.random() * TAU });
    }
  }

  function ripple(x, y, color) {
    state.ripples.push({ x, y, color, r: 8, life: .55 });
  }

  function draw(now) {
    const room = state.room || cloneRoom(rooms[0]);
    const player = state.player || { x: 92, y: H / 2, vx: 0, vy: 0, r: 14, walk: 0, blink: 0, blinkAt: 3 };
    const progress = state.room ? roomProgress() : 0;
    ctx.save();
    drawBackdrop(room, progress, now, player);
    drawRoomFloor(room, progress, now, player);
    drawDoor(room, state.room?.complete || false, now);
    for (const obstacle of room.obstacles) drawObstacle(obstacle, room, progress);
    if (state.room) {
      for (const target of room.targets) drawTarget(target, room, now);
      for (const hazard of room.hazards) drawHazard(hazard, progress, now);
      for (const trail of state.trails) drawTrail(trail);
      for (const projectile of state.projectiles) drawProjectile(projectile);
      for (const rippleState of state.ripples) drawRipple(rippleState);
      for (const particle of state.particles) drawParticle(particle);
    }
    drawPlayer(player, now);
    drawAimReticle(player, room, now);
    drawVignette();
    ctx.restore();
  }

  function drawBackdrop(room, progress, now, player) {
    const bg = mixHex(room.palette.bg, '#0a2418', progress * .28);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createRadialGradient(W * .52, H * .46, 70, W * .52, H * .46, 570);
    gradient.addColorStop(0, hexAlpha(room.palette.accent, .07 + progress * .09));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    const ox = player.vx * .008;
    const oy = player.vy * .008;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = .16 + progress * .12;
    for (let i = 0; i < 34; i++) {
      const x = 34 + ((i * 173) % 900);
      const y = 70 + ((i * 91) % 510);
      const pulse = 1 + Math.sin(now * .001 + i) * .08;
      ctx.fillStyle = i % 4 ? room.palette.accent : room.palette.warm;
      ctx.beginPath();
      ctx.arc(x, y, (1.2 + (i % 3)) * pulse, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRoomFloor(room, progress, now, player) {
    const floor = mixHex(room.palette.floor, room.palette.accent, progress * .08);
    ctx.fillStyle = floor;
    roundedRect(32, 58, W - 64, H - 94, 18);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(room.palette.accent, .24 + progress * .24);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    roundedRect(34, 60, W - 68, H - 98, 16);
    ctx.clip();
    const driftX = player.vx * .012;
    const driftY = player.vy * .012;
    ctx.translate(driftX, driftY);

    if (room.decor === 'garden') drawGardenDecor(room, progress, now);
    if (room.decor === 'orchard') drawOrchardDecor(room, progress, now);
    if (room.decor === 'hollow') drawHollowDecor(room, progress, now);
    if (room.decor === 'river') drawRiverDecor(room, progress, now);
    if (room.decor === 'meadow') drawMeadowDecor(room, progress, now);
    if (room.decor === 'burn') drawBurnDecor(room, progress, now);
    if (room.decor === 'glasshouse') drawGlasshouseDecor(room, progress, now);
    if (room.decor === 'alpine') drawAlpineDecor(room, progress, now);
    if (room.decor === 'tide') drawTideDecor(room, progress, now);
    if (room.decor === 'heart') drawHeartDecor(room, progress, now);
    ctx.restore();
  }

  function drawGardenDecor(room, progress, now) {
    for (let i = 0; i < 62; i++) {
      const x = 55 + ((i * 137) % 850);
      const y = 82 + ((i * 83) % 480);
      const sway = Math.sin(now * .0015 + i) * 2.5;
      ctx.strokeStyle = hexAlpha(i % 3 ? room.palette.accent : room.palette.water, .22 + progress * .22);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.quadraticCurveTo(x + sway, y, x + sway * .5, y - 7 - (i % 5));
      ctx.stroke();
    }
    drawPond(155, 445, 85, 42, room.palette.water, progress, now);
  }

  function drawOrchardDecor(room, progress, now) {
    for (let y = 120; y < 560; y += 105) {
      for (let x = 120; x < 900; x += 150) {
        ctx.strokeStyle = hexAlpha(room.palette.accent, .13 + progress * .17);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + 17); ctx.lineTo(x, y + 31); ctx.stroke();
      }
    }
    ctx.strokeStyle = hexAlpha(room.palette.warm, .14);
    for (let x = 90; x < 900; x += 95) { ctx.beginPath(); ctx.moveTo(x, 85); ctx.lineTo(x + 35, 555); ctx.stroke(); }
  }

  function drawHollowDecor(room, progress, now) {
    for (let i = 0; i < 12; i++) {
      const x = 78 + i * 76;
      const y = 105 + (i % 3) * 174;
      ctx.strokeStyle = hexAlpha(room.palette.accent, .16 + progress * .16);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 20 + (i % 4) * 6, 0, TAU); ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = hexAlpha(room.palette.warm, .18 + progress * .18);
      ctx.beginPath(); ctx.arc(60 + ((i * 151) % 830), 90 + ((i * 111) % 450), 1.3 + (i % 3), 0, TAU); ctx.fill();
    }
  }

  function drawRiverDecor(room, progress, now) {
    ctx.lineCap = 'round';
    for (let lane = 0; lane < 3; lane++) {
      ctx.strokeStyle = hexAlpha(room.palette.water, .25 + progress * .3);
      ctx.lineWidth = 8 + progress * 3;
      ctx.beginPath();
      for (let x = 45; x < W - 40; x += 18) {
        const y = 150 + lane * 150 + Math.sin(x * .018 + lane + now * .0005) * 17;
        if (x === 45) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = hexAlpha('#d8fbff', .08 + progress * .15);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawMeadowDecor(room, progress, now) {
    for (let i = 0; i < 86; i++) {
      const x = 48 + ((i * 97) % 860);
      const y = 88 + ((i * 53) % 475);
      const sway = Math.sin(now * .0018 + i * .7) * (2 + progress * 2);
      ctx.strokeStyle = hexAlpha(room.palette.accent, .18 + progress * .26);
      ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.quadraticCurveTo(x + sway, y, x + sway, y - 8 - (i % 7)); ctx.stroke();
    }
  }

  function drawBurnDecor(room, progress, now) {
    for (let i = 0; i < 28; i++) {
      const x = 60 + ((i * 163) % 830);
      const y = 90 + ((i * 91) % 465);
      ctx.strokeStyle = hexAlpha(progress > .5 ? room.palette.accent : '#c46d49', .2 + progress * .18);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 8); ctx.lineTo(x + 9, y + 19); ctx.stroke();
      if (progress > .35 && i % 3 === 0) {
        ctx.fillStyle = hexAlpha(room.palette.accent, (progress - .35) * .6);
        ctx.beginPath(); ctx.arc(x + 8, y - 2, 2 + progress * 2, 0, TAU); ctx.fill();
      }
    }
  }

  function drawGlasshouseDecor(room, progress, now) {
    ctx.strokeStyle = hexAlpha('#d7f8ff', .08 + progress * .1);
    ctx.lineWidth = 1;
    for (let x = 70; x < 930; x += 62) { ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, 570); ctx.stroke(); }
    for (let y = 95; y < 570; y += 58) { ctx.beginPath(); ctx.moveTo(45, y); ctx.lineTo(915, y); ctx.stroke(); }
    for (let i = 0; i < Math.floor(progress * 28); i++) {
      const x = 60 + ((i * 149 + now * .01) % 840);
      const y = 100 + ((i * 79 + Math.sin(now * .001 + i) * 30) % 420);
      ctx.fillStyle = hexAlpha(room.palette.warm, .36);
      ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
    }
  }

  function drawAlpineDecor(room, progress, now) {
    ctx.strokeStyle = hexAlpha(room.palette.accent, .2 + progress * .18);
    for (let i = 0; i < 14; i++) {
      const x = 55 + i * 65;
      const height = 40 + (i % 5) * 19;
      ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x + 34, 560 - height); ctx.lineTo(x + 70, 560); ctx.stroke();
    }
    if (progress > .25) drawPond(470, 165, 105, 31, room.palette.water, progress, now);
  }

  function drawTideDecor(room, progress, now) {
    const tide = 12 + Math.sin(now * .0011) * 7;
    ctx.strokeStyle = hexAlpha(room.palette.water, .18 + progress * .24);
    for (let y = 115; y < 555; y += 70) {
      ctx.beginPath();
      for (let x = 45; x < 920; x += 20) {
        const yy = y + Math.sin(x * .025 + now * .001 + y) * tide;
        if (x === 45) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  function drawHeartDecor(room, progress, now) {
    ctx.strokeStyle = hexAlpha(room.palette.accent, .1 + progress * .26);
    for (let i = 0; i < 28; i++) {
      const angle = i / 28 * TAU;
      const x = 510 + Math.cos(angle) * 230;
      const y = 320 + Math.sin(angle) * 170;
      ctx.beginPath(); ctx.moveTo(510, 320); ctx.quadraticCurveTo(510 + Math.cos(angle + .6) * 120, 320 + Math.sin(angle + .6) * 105, x, y); ctx.stroke();
    }
    const pulse = 1 + Math.sin(now * .004) * .06;
    ctx.fillStyle = hexAlpha(room.palette.accent, .05 + progress * .08);
    ctx.beginPath(); ctx.arc(510, 320, 125 * pulse, 0, TAU); ctx.fill();
  }

  function drawPond(x, y, rx, ry, color, progress, now) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = hexAlpha(color, .08 + progress * .16); ctx.strokeStyle = hexAlpha(color, .22 + progress * .22); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(Math.sin(now * .001 + i) * 12, 0, rx * (.25 + i * .2), ry * (.12 + i * .08), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  function drawDoor(room, open, now) {
    const y = H / 2;
    const glow = .5 + .5 * Math.sin(now * .004);
    ctx.save();
    ctx.fillStyle = open ? hexAlpha(room.palette.accent, .16 + .13 * glow) : 'rgba(2,7,7,.74)';
    roundedRect(898, y - 87, 31, 174, 9); ctx.fill();
    ctx.strokeStyle = open ? hexAlpha(room.palette.accent, .9) : 'rgba(255,255,255,.14)'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = open ? hexAlpha(room.palette.accent, .28 + i * .09) : 'rgba(255,255,255,.04)'; ctx.beginPath(); ctx.moveTo(905 + i * 4, y - 68); ctx.lineTo(905 + i * 4, y + 68); ctx.stroke(); }
    if (open) { ctx.fillStyle = '#effff7'; ctx.font = '700 9px ui-monospace,monospace'; ctx.textAlign = 'right'; ctx.fillText('NEXT ROOM →', 891, y - 98); }
    ctx.restore();
  }

  function drawObstacle(obstacle, room, progress) {
    ctx.save();
    if (obstacle.kind === 'glass') { ctx.fillStyle = 'rgba(194,244,255,.045)'; ctx.strokeStyle = 'rgba(203,248,255,.24)'; }
    else if (obstacle.kind === 'ice') { ctx.fillStyle = 'rgba(166,228,255,.13)'; ctx.strokeStyle = 'rgba(208,246,255,.42)'; }
    else if (obstacle.kind === 'char') { ctx.fillStyle = mixHex('#1a100d', '#314428', progress * .75); ctx.strokeStyle = hexAlpha(room.palette.accent, .2); }
    else if (['mangrove','root','log','tree'].includes(obstacle.kind)) { ctx.fillStyle = '#352819'; ctx.strokeStyle = hexAlpha(room.palette.accent, .25); }
    else if (obstacle.kind === 'hedge') { ctx.fillStyle = hexAlpha(room.palette.accent, .12); ctx.strokeStyle = hexAlpha(room.palette.accent, .28); }
    else { ctx.fillStyle = 'rgba(17,25,25,.76)'; ctx.strokeStyle = hexAlpha(room.palette.accent, .2); }
    ctx.lineWidth = 2; roundedRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 9); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawTarget(target, room, now) {
    ctx.save();
    const done = target.done;
    const need = targetExpected(target);
    const pulse = .5 + .5 * Math.sin(now * .006 + hash(target.id) * 8);
    if (target.zone && !done) {
      ctx.strokeStyle = hexAlpha(ABILITIES.rain.color, .2 + .18 * pulse);
      ctx.setLineDash([5, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(target.zone.x, target.zone.y, target.zone.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(205,241,255,.42)'; ctx.font = '700 8px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('DRY BASIN', target.zone.x, target.zone.y - target.zone.r - 9);
    }
    ctx.translate(target.x, target.y);
    if (target.kind === 'plant' || target.kind === 'patch' || target.kind === 'pollinator') drawPlant(target, room, done, now);
    else if (target.kind === 'fruit') drawTree(target, room, done, now);
    else if (target.kind === 'animal') drawAnimal(target, room, done, now);
    else if (target.kind === 'cloud') drawCloud(target, room, done, now);
    else if (target.kind === 'sluice') drawSluice(target, room, done);
    else if (target.kind === 'ember') drawEmber(target, room, done, now);
    else if (target.kind === 'ice') drawIce(target, room, done, now);
    else if (target.kind === 'coral') drawCoral(target, room, done, now);
    else if (target.kind === 'mangrove') drawMangrove(target, room, done, now);
    else if (target.kind === 'heart') drawEarthheart(target, room, done, now);

    if (!done && need) {
      const near = state.player && dist(state.player.x, state.player.y, target.x, target.y) < 245;
      ctx.fillStyle = near ? 'rgba(2,8,7,.92)' : 'rgba(2,8,7,.76)';
      ctx.strokeStyle = hexAlpha(ABILITIES[need].color, near ? .9 : .55);
      ctx.lineWidth = near ? 2 : 1.4;
      ctx.beginPath(); ctx.arc(0, -target.r - 23, near ? 16 : 14, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.font = `${near ? 17 : 15}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ABILITIES[need].icon, 0, -target.r - 23);
      if (near) { ctx.font = '700 7px ui-monospace,monospace'; ctx.fillStyle = hexAlpha(ABILITIES[need].color, .9); ctx.fillText(ABILITIES[need].name.toUpperCase(), 0, -target.r - 45); }
    }

    const sequence = target.sequence;
    const width = sequence.length * 9;
    for (let i = 0; i < sequence.length; i++) {
      ctx.fillStyle = i < target.step || done ? ABILITIES[sequence[i]].color : 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.arc(-width / 2 + i * 9 + 4.5, target.r + 14, 2.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlant(target, room, done, now) {
    const growth = done ? 1 : .28 + target.step / Math.max(1, target.sequence.length) * .58;
    const sway = Math.sin(now * .002 + hash(target.id) * 10) * 3;
    ctx.strokeStyle = done ? room.palette.accent : 'rgba(115,151,126,.72)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(-4 + sway, 2, sway * .4, -18 * growth); ctx.stroke();
    ctx.fillStyle = done ? room.palette.accent : 'rgba(105,141,116,.66)';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 8 + sway * .2, -3, 8 * growth, 4 * growth, side * .45, 0, TAU); ctx.fill(); }
    if (done) {
      ctx.fillStyle = '#f5ffd6';
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 7 + sway * .2, -20 + Math.sin(a) * 7, 4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd16a'; ctx.beginPath(); ctx.arc(sway * .2, -20, 4, 0, TAU); ctx.fill();
    }
  }

  function drawTree(target, room, done, now) {
    const sway = Math.sin(now * .0015 + hash(target.id) * 5) * 2;
    ctx.strokeStyle = '#896441'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 25); ctx.quadraticCurveTo(sway, 3, sway, -14); ctx.stroke();
    ctx.fillStyle = done ? room.palette.accent : '#52674f';
    for (const [x, y, radius] of [[0,-26,21],[-16,-16,15],[17,-14,16]]) { ctx.beginPath(); ctx.arc(x + sway, y, radius, 0, TAU); ctx.fill(); }
    if (target.step >= Math.min(2, target.sequence.length - 1) || done) {
      ctx.fillStyle = '#ff9a65';
      for (const [x,y] of [[-12,-26],[12,-16],[3,-34],[-4,-11]]) { ctx.beginPath(); ctx.arc(x + sway, y, 4.3, 0, TAU); ctx.fill(); }
    }
  }

  function drawAnimal(target, room, done, now) {
    const species = target.species || 'fox';
    const bob = Math.sin(now * .006 + hash(target.id) * 7) * 1.5;
    ctx.save(); ctx.translate(0, bob);
    if (species === 'fox') drawFox(done, room, now);
    else if (species === 'owl') drawOwl(done, room, now);
    else if (species === 'deer') drawDeer(done, room, now);
    else if (species === 'marmot') drawMarmot(done, room, now);
    else drawMarmot(done, room, now);
    if (done) { ctx.fillStyle = '#ff9fc2'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('♥', 0, -34 - Math.sin(now * .006) * 2); }
    ctx.restore();
  }

  function drawFox(done, room, now) {
    const fur = done ? '#dc9a63' : '#8c796c';
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(-3, 4, 19, 11, -.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -7, 9, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10,-13); ctx.lineTo(12,-24); ctx.lineTo(17,-14); ctx.fill(); ctx.beginPath(); ctx.moveTo(17,-14); ctx.lineTo(23,-22); ctx.lineTo(22,-10); ctx.fill();
    ctx.strokeStyle = fur; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-19,5); ctx.quadraticCurveTo(-34,-3,-28,-15); ctx.stroke();
    ctx.strokeStyle = fur; ctx.lineWidth = 4; for (const x of [-10,7]) { ctx.beginPath(); ctx.moveTo(x,11); ctx.lineTo(x,21); ctx.stroke(); }
    ctx.fillStyle = '#1b1916'; ctx.beginPath(); ctx.arc(17,-8,1.6,0,TAU); ctx.fill(); ctx.fillStyle = '#f5e6d4'; ctx.beginPath(); ctx.arc(22,-4,2,0,TAU); ctx.fill();
  }

  function drawOwl(done, room, now) {
    const feather = done ? '#c6b58d' : '#7f7d78';
    ctx.fillStyle = feather; ctx.beginPath(); ctx.ellipse(0, 3, 15, 20, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-12,14,0,TAU); ctx.fill();
    ctx.fillStyle = '#f4e9ca'; for (const x of [-5,5]) { ctx.beginPath(); ctx.arc(x,-13,4,0,TAU); ctx.fill(); ctx.fillStyle='#17201a'; ctx.beginPath(); ctx.arc(x,-13,1.6,0,TAU); ctx.fill(); ctx.fillStyle='#f4e9ca'; }
    ctx.fillStyle = '#dba85c'; ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(-3,-2); ctx.lineTo(3,-2); ctx.closePath(); ctx.fill();
    const flap = Math.sin(now * .008) * (done ? 4 : 2); ctx.strokeStyle = feather; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-10,1); ctx.lineTo(-19,8+flap); ctx.moveTo(10,1); ctx.lineTo(19,8-flap); ctx.stroke();
  }

  function drawDeer(done, room, now) {
    const fur = done ? '#b99b73' : '#81796e';
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(-3, 5, 21, 11, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(15,-8,8,11,.2,0,TAU); ctx.fill();
    ctx.strokeStyle = fur; ctx.lineWidth = 4; for (const x of [-12,8]) { ctx.beginPath(); ctx.moveTo(x,12); ctx.lineTo(x,25); ctx.stroke(); }
    ctx.fillStyle=fur; ctx.beginPath(); ctx.moveTo(12,-17); ctx.lineTo(9,-26); ctx.lineTo(16,-18); ctx.fill(); ctx.beginPath(); ctx.moveTo(18,-17); ctx.lineTo(24,-25); ctx.lineTo(22,-15); ctx.fill();
    ctx.fillStyle='#161b17'; ctx.beginPath(); ctx.arc(18,-10,1.5,0,TAU); ctx.fill();
    ctx.strokeStyle = done ? '#d9c49d' : '#8f887d'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(13,-18); ctx.lineTo(9,-28); ctx.moveTo(10,-24); ctx.lineTo(5,-27); ctx.moveTo(17,-18); ctx.lineTo(21,-29); ctx.moveTo(20,-25); ctx.lineTo(25,-28); ctx.stroke();
  }

  function drawMarmot(done, room, now) {
    const fur = done ? '#a98d6a' : '#77746e';
    ctx.fillStyle=fur; ctx.beginPath(); ctx.ellipse(-2,6,18,15,0,0,TAU); ctx.fill(); ctx.beginPath(); ctx.arc(11,-6,9,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(7,-14,4,0,TAU); ctx.fill(); ctx.beginPath(); ctx.arc(15,-14,4,0,TAU); ctx.fill();
    ctx.fillStyle='#181a17'; ctx.beginPath(); ctx.arc(14,-7,1.5,0,TAU); ctx.fill();
    ctx.strokeStyle=fur; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-15,13); ctx.lineTo(-18,22); ctx.moveTo(8,15); ctx.lineTo(10,23); ctx.stroke();
  }

  function drawCloud(target, room, done, now) {
    const color = done ? 'rgba(230,255,248,.95)' : target.step > 0 ? 'rgba(211,238,242,.9)' : 'rgba(176,203,210,.82)';
    ctx.fillStyle = color;
    const stretch = 1 + Math.sin(now * .002 + hash(target.id)) * .035;
    ctx.save(); ctx.scale(stretch, 1 / stretch);
    for (const [x,y,radius] of [[-17,2,16],[0,-8,20],[19,1,15],[0,9,22]]) { ctx.beginPath(); ctx.arc(x,y,radius,0,TAU); ctx.fill(); }
    ctx.restore();
    if (target.step >= 2 || done) { ctx.strokeStyle=ABILITIES.rain.color; ctx.lineWidth=2; for(const x of [-12,0,12]){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x-4,32);ctx.stroke();} }
  }

  function drawSluice(target, room, done) {
    ctx.strokeStyle = hexAlpha(room.palette.water, .8); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-31,0); ctx.lineTo(31,0); ctx.stroke();
    ctx.save(); ctx.rotate(target.orientation * Math.PI / 2); ctx.strokeStyle = done ? room.palette.accent : '#f5e3bd'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(18,0); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(8,-6); ctx.lineTo(8,6); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(target.goal * Math.PI / 2); ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.moveTo(24,0); ctx.lineTo(38,0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }

  function drawEmber(target, room, done, now) {
    const factor = done ? .18 : 1 - target.step / target.sequence.length * .65;
    ctx.fillStyle = `rgba(255,${95 + target.step * 28},55,${.32 + .18 * Math.sin(now * .009)})`;
    for (let i=0;i<5;i++){const angle=i/5*TAU+now*.0005;const radius=(12+i*2)*factor;ctx.beginPath();ctx.arc(Math.cos(angle)*9,Math.sin(angle)*8,radius*.5,0,TAU);ctx.fill();}
    if(done) drawPlant(target,room,true,now);
  }

  function drawIce(target, room, done, now) {
    if(done){drawPlant(target,room,true,now);return;} ctx.fillStyle='rgba(177,230,255,.3)';ctx.strokeStyle='#d6f5ff';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<8;i++){const angle=-Math.PI/2+i/8*TAU;const radius=i%2?20:28;const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
  }

  function drawCoral(target, room, done, now) {
    const sway=Math.sin(now*.002)*2;ctx.strokeStyle=done?room.palette.accent:'#856c74';ctx.lineWidth=5;ctx.lineCap='round';for(const x of [-13,0,13]){ctx.beginPath();ctx.moveTo(0,21);ctx.quadraticCurveTo(x*.5+sway,0,x+sway,-21);ctx.stroke();ctx.beginPath();ctx.moveTo(x*.5,-4);ctx.lineTo(x+8+sway,-13);ctx.stroke();}
  }

  function drawMangrove(target, room, done, now) {
    ctx.strokeStyle=done?'#7d5a3e':'#5b4c3b';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(0,10);ctx.stroke();for(const x of [-18,-9,9,18]){ctx.beginPath();ctx.moveTo(0,5);ctx.quadraticCurveTo(x*.6,15,x,25);ctx.stroke();}ctx.fillStyle=done?room.palette.accent:'#4b6b55';for(const x of [-12,0,13]){ctx.beginPath();ctx.arc(x,-27-Math.abs(x)*.15,10,0,TAU);ctx.fill();}
  }

  function drawEarthheart(target, room, done, now) {
    const pulse=1+.07*Math.sin(now*.006);ctx.scale(pulse,pulse);ctx.strokeStyle=done?'#c9ffda':room.palette.accent;ctx.lineWidth=3;for(let i=0;i<7;i++){const angle=i/7*TAU;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.cos(angle+.55)*24,Math.sin(angle+.55)*24,Math.cos(angle)*40,Math.sin(angle)*40);ctx.stroke();}ctx.fillStyle=done?'#e6fff0':'#7ddfa2';ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.fill();
  }

  function drawHazard(hazard, progress, now) {
    ctx.save(); ctx.translate(hazard.x,hazard.y); ctx.globalAlpha=.14+.48*(1-progress); const color=hazardColor(hazard.type); ctx.fillStyle=hexAlpha(color,.14);ctx.strokeStyle=hexAlpha(color,.68);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,hazard.r*(1+.07*Math.sin(now*.008+hazard.x)),0,TAU);ctx.fill();ctx.stroke();
    if(hazard.type==='current'){ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.lineTo(4,-5);ctx.moveTo(10,0);ctx.lineTo(4,5);ctx.stroke();}
    else{for(let i=0;i<3;i++){const angle=now*.001*(i+1)+i*2;ctx.beginPath();ctx.arc(Math.cos(angle)*hazard.r*.48,Math.sin(angle)*hazard.r*.42,3+i,0,TAU);ctx.fill();}}
    ctx.restore();
  }

  function hazardColor(type){return type==='heat'?'#ff7048':type==='smoke'?'#aaa8b4':type==='cold'?'#90dfff':type==='current'?'#69c7f2':'#d57ca1';}

  function drawTrail(trail){ctx.save();ctx.globalAlpha=clamp(trail.life/.28,0,1)*.5;ctx.fillStyle=ABILITIES[trail.ability].color;ctx.beginPath();ctx.arc(trail.x,trail.y,trail.r,0,TAU);ctx.fill();ctx.restore();}

  function drawProjectile(projectile) {
    ctx.save(); ctx.translate(projectile.x,projectile.y); const ability=projectile.ability;const angle=Math.atan2(projectile.vy,projectile.vx);ctx.rotate(angle);ctx.fillStyle=ABILITIES[ability].color;ctx.strokeStyle=ABILITIES[ability].color;ctx.shadowColor=ABILITIES[ability].color;ctx.shadowBlur=13;
    if(ability==='wind'){ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,0,9,-1.15,1.15);ctx.stroke();ctx.beginPath();ctx.arc(-5,0,6,-1.1,1.1);ctx.stroke();}
    else if(ability==='seed'){ctx.beginPath();ctx.ellipse(0,0,8,3.5,0,0,TAU);ctx.fill();ctx.fillStyle='#d8ffd9';ctx.beginPath();ctx.ellipse(-4,-3,4,2,-.6,0,TAU);ctx.fill();}
    else if(ability==='sun'){ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.fill();for(let i=0;i<4;i++){ctx.fillRect(8,-1,5,2);ctx.rotate(Math.PI/2);}}
    else if(ability==='rain'){ctx.rotate(-.15);ctx.beginPath();ctx.ellipse(0,0,5,8,0,0,TAU);ctx.fill();}
    else if(ability==='mend'){ctx.font='15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♥',0,0);}
    else if(ability==='gather'){ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.fill();ctx.fillStyle='#6b3e27';ctx.fillRect(-1,-8,2,4);}
    ctx.restore();
  }

  function drawRipple(rippleState){ctx.save();ctx.globalAlpha=clamp(rippleState.life/.55,0,1)*.5;ctx.strokeStyle=rippleState.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(rippleState.x,rippleState.y,rippleState.r,0,TAU);ctx.stroke();ctx.restore();}

  function drawParticle(particle){ctx.save();ctx.globalAlpha=clamp(particle.life*1.7,0,1);ctx.fillStyle=particle.color;ctx.strokeStyle=particle.color;ctx.translate(particle.x,particle.y);ctx.rotate(particle.spin+particle.life*2);if(particle.shape==='leaf'){ctx.beginPath();ctx.ellipse(0,0,particle.r*1.7,particle.r*.7,.5,0,TAU);ctx.fill();}else if(particle.shape==='drop'){ctx.beginPath();ctx.ellipse(0,0,particle.r*.7,particle.r*1.6,0,0,TAU);ctx.fill();}else{ctx.beginPath();ctx.arc(0,0,particle.r,0,TAU);ctx.fill();}ctx.restore();}

  function drawPlayer(player, now) {
    const aim=aimVector();const angle=Math.atan2(aim.y,aim.x);const speed=Math.hypot(player.vx,player.vy);const moving=clamp(speed/220,0,1);const step=Math.sin(player.walk)*moving;const dashStretch=state.dashTime>0?1.18:1;const blink=player.blink<.1;ctx.save();ctx.translate(player.x,player.y);
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,17,17+moving*2,7,0,0,TAU);ctx.fill();
    ctx.rotate(angle*.08);ctx.scale(dashStretch,1/dashStretch);
    ctx.strokeStyle='rgba(208,255,236,.19)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,21+(state.dashCd<=0?2.5*Math.sin(now*.006):0),0,TAU);ctx.stroke();
    ctx.strokeStyle='#607f63';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-7,12);ctx.lineTo(-8+step*3,20);ctx.moveTo(7,12);ctx.lineTo(8-step*3,20);ctx.stroke();
    ctx.fillStyle='#78b783';ctx.shadowColor='#8effd0';ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(0,2,14,16,-.1,0,TAU);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#9ed49f';ctx.beginPath();ctx.arc(4,-10,11,0,TAU);ctx.fill();
    ctx.fillStyle='#c8e8ac';ctx.beginPath();ctx.ellipse(-6,-16,8,4,-.8,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(4,-20,8,4,-1.25,0,TAU);ctx.fill();
    ctx.fillStyle='#15231b';ctx.beginPath();ctx.ellipse(7,-11,blink?2.2:2.2,blink?.45:2.6,0,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(0,-12,blink?2:2,blink?.45:2.4,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#355b44';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(4,-7,4,.35,1.7);ctx.stroke();
    ctx.fillStyle=ABILITIES[state.selected].color;ctx.beginPath();ctx.moveTo(aim.x*20,aim.y*20);ctx.lineTo(aim.x*11-aim.y*5,aim.y*11+aim.x*5);ctx.lineTo(aim.x*11+aim.y*5,aim.y*11-aim.x*5);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  function drawAimReticle(player, room, now) {
    const aim=aimVector();const distance=68;const x=player.x+aim.x*distance;const y=player.y+aim.y*distance;ctx.save();ctx.strokeStyle=hexAlpha(ABILITIES[state.selected].color,.42);ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,8+Math.sin(now*.006)*1.5,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x-6,y);ctx.moveTo(x+6,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y-6);ctx.moveTo(x,y+6);ctx.lineTo(x,y+12);ctx.stroke();ctx.restore();
  }

  function drawVignette(){const gradient=ctx.createRadialGradient(W/2,H/2,230,W/2,H/2,570);gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,'rgba(0,0,0,.38)');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);}

  function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by);}
  function hash(value){let result=0;for(let i=0;i<value.length;i++)result=(result*31+value.charCodeAt(i))|0;return Math.abs(result%1000)/1000;}
  function hexAlpha(hex,alpha){if(!hex.startsWith('#'))return hex;let h=hex.slice(1);if(h.length===3)h=h.split('').map((x)=>x+x).join('');const n=parseInt(h,16);return `rgba(${n>>16},${n>>8&255},${n&255},${alpha})`;}
  function mixHex(a,b,t){const ar=hexRgb(a),br=hexRgb(b);const mix=(x,y)=>Math.round(x+(y-x)*clamp(t,0,1));return `rgb(${mix(ar[0],br[0])},${mix(ar[1],br[1])},${mix(ar[2],br[2])})`;}
  function hexRgb(hex){let h=hex.replace('#','');if(h.length===3)h=h.split('').map((x)=>x+x).join('');const n=parseInt(h,16);return [n>>16,n>>8&255,n&255];}

  function completeTargetForPlaytest(target) {
    target.step = target.sequence.length;
    target.done = true;
    if (target.kind === 'fruit') state.fruit += target.yield || 2;
  }

  window.__MOSSLIGHT_PLAYTEST__ = {
    version: '0.2.0',
    roomCount: rooms.length,
    roomTitles: rooms.map((room) => room.title),
    setRoom(index) {
      state.mode = 'playing';
      ui.title.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.victory.classList.add('hidden');
      enterRoom(clamp(Number(index) || 0, 0, rooms.length - 1));
      return this.snapshot();
    },
    completeRoom() {
      state.room.targets.forEach(completeTargetForPlaytest);
      state.room.complete = true;
      syncHud(true);
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
        player: state.player ? { x: state.player.x, y: state.player.y, vx: state.player.vx, vy: state.player.vy } : null,
        fps,
      };
    },
    setDifficulty(mode) { state.difficulty = mode === 'flow' ? 'flow' : 'gentle'; return state.difficulty; },
  };

  function loop(now) {
    const dt = Math.min(.033, Math.max(.001, (now - last) / 1000));
    last = now;
    fpsFrames++;
    if (now - fpsWindow >= 1000) { fps = fpsFrames * 1000 / (now - fpsWindow); fpsFrames = 0; fpsWindow = now; }
    if (state.mode === 'playing') update(dt, now);
    draw(now);
    requestAnimationFrame(loop);
  }

  resetPlayer();
  state.room = cloneRoom(rooms[0]);
  syncHud(true);
  requestAnimationFrame(loop);
})();
