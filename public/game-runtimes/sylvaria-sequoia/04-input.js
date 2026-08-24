(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { state, player, canvas, wrap, W } = S;
  const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
  const SAP_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);

  async function copyTelemetry() {
    const text = JSON.stringify(S.summarizeTelemetry(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      S.announce('TELEMETRY COPIED', 0.9, 15);
    } catch {
      console.log(text);
      S.announce('TELEMETRY → CONSOLE', 0.9, 15);
    }
  }

  function handleKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat && ['Space', 'ArrowUp', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyP', 'KeyR', 'KeyN', 'KeyT', 'KeyJ'].includes(event.code)) return;
    if (event.code === 'Escape') return;

    if (event.code === 'KeyT') {
      state.telemetryVisible = !state.telemetryVisible;
      return;
    }
    if (event.code === 'KeyJ') {
      void copyTelemetry();
      return;
    }
    if (event.code === 'KeyR') {
      S.startRun(state.runSeed);
      return;
    }
    if (event.code === 'KeyN') {
      S.startRun(state.runSeed + 1);
      return;
    }
    if (event.code === 'KeyP') {
      if (state.mode === 'playing') {
        state.pausedFrom = state.mode;
        state.mode = 'paused';
        wrap.dataset.playing = 'false';
      } else if (state.mode === 'paused') {
        state.mode = state.pausedFrom;
        wrap.dataset.playing = 'true';
      }
      return;
    }

    if (state.mode === 'title' || state.mode === 'gameover') {
      if (event.code === 'Space' || event.code === 'Enter') S.startRun(state.runSeed + 1);
      return;
    }
    if (state.mode === 'paused') {
      if (event.code === 'Space' || event.code === 'Enter') {
        state.mode = 'playing';
        wrap.dataset.playing = 'true';
      }
      return;
    }

    const wasDown = state.keys.has(event.code);
    state.keys.add(event.code);
    if (JUMP_KEYS.has(event.code) && !wasDown) S.requestJump();
    if (SAP_KEYS.has(event.code) && !wasDown) {
      player.sapHeld = true;
      S.attachSap();
    }
  }

  function handleKeyUp(event) {
    state.keys.delete(event.code);
    if (JUMP_KEYS.has(event.code)) player.jumpHeld = false;
    if (SAP_KEYS.has(event.code)) {
      player.sapHeld = false;
      S.releaseSap();
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
    if (state.mode === 'title' || state.mode === 'gameover') {
      S.startRun(state.runSeed + 1);
      return;
    }
    if (state.mode === 'paused') {
      state.mode = 'playing';
      wrap.dataset.playing = 'true';
      return;
    }
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const action = pointerAction(event);
    if ([...state.pointers.values()].includes(action) && (action === 'jump' || action === 'sap')) return;
    state.pointers.set(event.pointerId, action);
    if (action === 'jump') S.requestJump();
    if (action === 'sap') {
      player.sapHeld = true;
      S.attachSap();
    }
  });

  function endPointer(event) {
    const action = state.pointers.get(event.pointerId);
    state.pointers.delete(event.pointerId);
    if (action === 'jump') player.jumpHeld = false;
    if (action === 'sap' && ![...state.pointers.values()].includes('sap')) {
      player.sapHeld = false;
      S.releaseSap();
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', () => {
    state.keys.clear();
    state.pointers.clear();
    player.jumpHeld = false;
    if (player.sapHeld) S.releaseSap();
    player.sapHeld = false;
  });

  function frame(now) {
    const frameDt = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    state.accumulator += frameDt;
    let steps = 0;
    while (state.accumulator >= state.FIXED_DT && steps < state.MAX_STEPS) {
      S.update(state.FIXED_DT);
      state.accumulator -= state.FIXED_DT;
      steps += 1;
    }
    if (steps === state.MAX_STEPS) state.accumulator = 0;
    S.render(state.accumulator / state.FIXED_DT, now);
    requestAnimationFrame(frame);
  }

  S.resetRun(state.runSeed);
  window.SYLVARIA_SEQUOIA_DEBUG = {
    version: '0.3.0',
    fixedHz: 120,
    getState: () => ({
      mode: state.mode,
      seed: state.runSeed,
      floor: player.highestFloor,
      phase: S.phaseForFloor(player.highestFloor).name,
      score: Math.floor(player.score),
      combo: player.combo,
      comboTimer: player.comboTimer,
      comboVariety: player.comboKindsMask,
      hyper: player.hyper,
      airJumps: player.airJumps,
      jumpInput: S.jumpInputContract?.getState() || null,
      saves: player.saves,
      branchCount: state.branches.length,
      knotCount: state.knots.length,
      ringCount: state.rings.filter((ring) => !ring.hit).length,
      route: S.activeRouteChunk()?.type || null,
      player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, state: player.state },
      threat: { y: state.threatY, gap: player.y - state.threatY, speed: S.threatSpeed() },
    }),
    getTelemetry: S.summarizeTelemetry,
    getTuning: () => JSON.parse(JSON.stringify(S.TUNE)),
    getRouteGrammars: () => Object.keys(S.ROUTE_GRAMMARS),
    getPhases: () => S.PHASES.map((phase) => ({ name: phase.name, floor: phase.floor })),
    setTuning: S.setTuning,
    start: (seed) => S.startRun(Number.isFinite(seed) ? seed : state.runSeed + 1),
    retry: () => S.startRun(state.runSeed),
    nextRoute: () => S.startRun(state.runSeed + 1),
  };

  requestAnimationFrame(frame);
})();
