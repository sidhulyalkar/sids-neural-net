(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  const { state, player, canvas, wrap, W } = S;
  const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
  const SHIFT_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
  const START_JUMP_GUARD_MS = 80;
  // WebKit can surface a late same-key edge after a completed keyboard.press()
  // crosses iframe focus boundaries. Keep this per physical code so advanced
  // players may still alternate jump keys rapidly without an artificial global
  // Air Kick cooldown.
  const SAME_KEY_JUMP_REARM_MS = 82;
  const PHYSICAL_STALE_MS = 900;

  // state.keys is allowed to clear on iframe blur for movement safety. physicalDown
  // is deliberately separate and survives blur, preventing one held key from
  // resurfacing as a second press when focus moves between host and runtime.
  const physicalDown = new Map();
  const lastReleasedAt = new Map();
  const suppressedJumpKeys = new Map();
  let rejectedJumpRepresses = 0;
  let rejectedJumpQuarantines = 0;
  let sapChordCount = 0;
  let lastSapChordAt = -Infinity;
  let pendingActivation = null;

  // Runtime feel telemetry is deliberately tiny and allocation-free in the RAF
  // path. It tells browser evidence whether a bad-feeling run came from physics,
  // input gating, rendering cost, or repeated simulation catch-up.
  let frameCount = 0;
  let frameMsEwma = 16.67;
  let maxFrameMs = 0;
  let longFrameCount = 0;
  let catchupFrameCount = 0;
  let accumulatorDropCount = 0;
  let maxStepsInFrame = 0;

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

  function acceptPhysicalDown(code, now = performance.now()) {
    const previous = physicalDown.get(code);
    if (previous != null && now - previous < PHYSICAL_STALE_MS) return false;
    physicalDown.set(code, now);
    return true;
  }

  function quarantineStartKey(code) {
    if (!JUMP_KEYS.has(code)) return;
    suppressedJumpKeys.set(code, performance.now() + START_JUMP_GUARD_MS);
    state.keys.add(code);
  }

  function isJumpQuarantined(code, now = performance.now()) {
    const until = suppressedJumpKeys.get(code);
    if (until == null) return false;
    if (now < until) return true;
    suppressedJumpKeys.delete(code);
    return false;
  }

  function isTooSoonAfterRelease(code, now = performance.now()) {
    const releasedAt = lastReleasedAt.get(code);
    return releasedAt != null && now - releasedAt < SAME_KEY_JUMP_REARM_MS;
  }

  function shiftHeld() {
    return state.keys.has('ShiftLeft') || state.keys.has('ShiftRight');
  }

  function triggerSapStick() {
    sapChordCount += 1;
    lastSapChordAt = performance.now();
    player.jumpHeld = false;
    return Boolean(S.castSapStick?.());
  }

  function handleKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Escape') return;
    const now = performance.now();

    // Sanitize a completed physical jump edge before admitting it into
    // physicalDown. Doing this first is important: a rejected browser echo must
    // never poison the held-key map and suppress the player's next real tap.
    const gameplayJump = state.mode === 'playing' && JUMP_KEYS.has(event.code);
    if (gameplayJump && isJumpQuarantined(event.code, now)) {
      rejectedJumpQuarantines += 1;
      return;
    }
    if (gameplayJump && isTooSoonAfterRelease(event.code, now)) {
      rejectedJumpRepresses += 1;
      return;
    }
    if (!acceptPhysicalDown(event.code, now)) return;

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

    if (state.mode === 'title' || state.mode === 'gameover' || state.mode === 'paused') {
      if (event.code === 'Space' || event.code === 'Enter') {
        // Activation commits on keyup, after this physical press has ended. Starting
        // on keydown used to move iframe focus mid-press and could surface a second
        // Space edge as an unintended Air Kick in some browser engines.
        pendingActivation = { code: event.code, mode: state.mode };
        if (JUMP_KEYS.has(event.code)) state.keys.add(event.code);
      } else if (SHIFT_KEYS.has(event.code)) {
        state.keys.add(event.code);
      }
      return;
    }

    if (SHIFT_KEYS.has(event.code)) {
      state.keys.add(event.code);
      return;
    }

    if (JUMP_KEYS.has(event.code)) {
      state.keys.add(event.code);

      // Canonical v0.4 chord: hold Shift, then tap Space. The chord is consumed
      // before the jump contract, so one Sap Stick press can never also Air Kick.
      if (event.code === 'Space' && shiftHeld()) {
        triggerSapStick();
        return;
      }

      S.requestJump();
      return;
    }

    state.keys.add(event.code);
  }

  function handleKeyUp(event) {
    const now = performance.now();
    physicalDown.delete(event.code);
    lastReleasedAt.set(event.code, now);
    state.keys.delete(event.code);
    if (JUMP_KEYS.has(event.code)) player.jumpHeld = false;

    if (pendingActivation?.code === event.code) {
      const activation = pendingActivation;
      pendingActivation = null;
      if (activation.mode === 'paused' && state.mode === 'paused') {
        state.mode = state.pausedFrom || 'playing';
        wrap.dataset.playing = 'true';
      } else if ((activation.mode === 'title' || activation.mode === 'gameover') && state.mode === activation.mode) {
        S.startRun(state.runSeed + 1);
      }
      // A tiny post-release quarantine rejects a same-press browser echo without
      // making the first intentional gameplay jump feel laggy.
      quarantineStartKey(event.code);
      state.keys.delete(event.code);
      player.jumpHeld = false;
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
      sapChordCount += 1;
      lastSapChordAt = performance.now();
      S.castSapStick?.();
    }
  });

  function endPointer(event) {
    const action = state.pointers.get(event.pointerId);
    state.pointers.delete(event.pointerId);
    if (action === 'jump') player.jumpHeld = false;
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', () => {
    // Do not clear physicalDown here. Focus churn inside the Game Network iframe
    // must not turn a held Space into another physical press.
    state.keys.clear();
    state.pointers.clear();
    player.jumpHeld = false;
  });

  function frame(now) {
    const rawFrameMs = Math.max(0, now - state.lastTime);
    const frameDt = Math.min(0.05, rawFrameMs / 1000);
    state.lastTime = now;

    frameCount += 1;
    frameMsEwma += (Math.min(120, rawFrameMs || 16.67) - frameMsEwma) * 0.06;
    maxFrameMs = Math.max(maxFrameMs, rawFrameMs);
    if (rawFrameMs > 25) longFrameCount += 1;

    state.accumulator += frameDt;
    let steps = 0;
    while (state.accumulator >= state.FIXED_DT && steps < state.MAX_STEPS) {
      S.update(state.FIXED_DT);
      state.accumulator -= state.FIXED_DT;
      steps += 1;
    }
    maxStepsInFrame = Math.max(maxStepsInFrame, steps);
    if (steps > 2) catchupFrameCount += 1;
    if (steps === state.MAX_STEPS) {
      state.accumulator = 0;
      accumulatorDropCount += 1;
    }
    S.render(state.accumulator / state.FIXED_DT, now);
    requestAnimationFrame(frame);
  }

  function framePacingState() {
    return {
      frames: frameCount,
      frameMs: Number(frameMsEwma.toFixed(2)),
      estimatedFps: Number((1000 / Math.max(1, frameMsEwma)).toFixed(1)),
      maxFrameMs: Number(maxFrameMs.toFixed(2)),
      longFrameCount,
      longFrameRatio: frameCount ? Number((longFrameCount / frameCount).toFixed(4)) : 0,
      catchupFrameCount,
      catchupFrameRatio: frameCount ? Number((catchupFrameCount / frameCount).toFixed(4)) : 0,
      accumulatorDropCount,
      maxStepsInFrame,
    };
  }

  S.resetRun(state.runSeed);
  window.SYLVARIA_SEQUOIA_DEBUG = {
    version: '0.4.0',
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
      inputGate: {
        startJumpGuardMs: START_JUMP_GUARD_MS,
        pendingActivation: pendingActivation ? { ...pendingActivation } : null,
        sameKeyJumpRearmMs: SAME_KEY_JUMP_REARM_MS,
        physicalDown: [...physicalDown.keys()],
        suppressedJumpKeys: [...suppressedJumpKeys.entries()].map(([code, until]) => ({
          code,
          remainingMs: Math.max(0, until - performance.now()),
        })),
        rejectedJumpRepresses,
        rejectedJumpQuarantines,
        sapChordCount,
        lastSapChordAgoMs: Number.isFinite(lastSapChordAt) ? Math.max(0, performance.now() - lastSapChordAt) : null,
      },
      flowAssist: S.flowAssist?.getState() || null,
      controlAuthority: S.controlAuthority?.getState?.() || null,
      sapStick: S.sapStick?.getState?.() || null,
      renderer: S.canopyRenderer || null,
      renderPerformance: S.renderPerformance?.getState?.() || null,
      framePacing: framePacingState(),
      saves: player.saves,
      branchCount: state.branches.length,
      knotCount: state.knots.length,
      sapAnchorCount: state.knots.filter((knot) => knot.anchorKind === 'sap-stick').length,
      ringCount: state.rings.filter((ring) => !ring.hit).length,
      route: S.activeRouteChunk()?.type || null,
      player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, state: player.state },
      threat: { y: state.threatY, gap: player.y - state.threatY, speed: S.threatSpeed() },
    }),
    getTelemetry: S.summarizeTelemetry,
    getTuning: () => JSON.parse(JSON.stringify(S.TUNE)),
    getRouteGrammars: () => Object.keys(S.ROUTE_GRAMMARS),
    getPhases: () => S.PHASES.map((phase) => ({ name: phase.name, floor: phase.floor })),
    getSapTarget: () => {
      const target = S.sapStick?.getTargetPreview?.();
      return target ? { x: target.x, y: target.y, floor: target.floor, kind: target.anchorKind || 'branch' } : null;
    },
    setTuning: S.setTuning,
    start: (seed) => S.startRun(Number.isFinite(seed) ? seed : state.runSeed + 1),
    retry: () => S.startRun(state.runSeed),
    nextRoute: () => S.startRun(state.runSeed + 1),
  };

  requestAnimationFrame(frame);
})();