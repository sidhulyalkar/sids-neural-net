(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.update || !S?.markRouteProgress) return;

  const { state, player, announce, recordEvent, tone, crownDrop } = S;
  const baseUpdate = S.update;
  const baseResetRun = S.resetRun;
  const baseStartRun = S.startRun;
  const baseMarkRouteProgress = S.markRouteProgress;
  const VERSION = 'crown-trail-v1';
  const CROWN_INTERVAL = 25;

  const storage = {
    read(key, fallback = 0) {
      try {
        const value = Number(localStorage.getItem(key));
        return Number.isFinite(value) ? value : fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try { localStorage.setItem(key, String(value)); } catch { /* private mode / quota */ }
    },
  };

  let bestFloor = storage.read('sylvaria.sequoia.bestFloor', 0);
  let bestCombo = storage.read('sylvaria.sequoia.bestCombo', 0);
  let runCrownMarks = 0;
  let lastCrownFloor = 0;
  let lastPhaseName = 'ROOTWAYS';
  let phaseBanner = null;
  let crownBanner = null;
  let pbBanner = null;
  let previousFloor = 0;

  function nextCrownFloor(floor = player.highestFloor) {
    return (Math.floor(Math.max(0, floor) / CROWN_INTERVAL) + 1) * CROWN_INTERVAL;
  }

  function phaseGoal() {
    const current = S.phaseForFloor(player.highestFloor);
    const index = S.PHASES.indexOf(current);
    const next = S.PHASES[index + 1];
    return next ? { name: next.name, floor: next.floor, remaining: Math.max(0, next.floor - player.highestFloor) } : null;
  }

  function awardCrownMark(floor) {
    runCrownMarks += 1;
    lastCrownFloor = floor;
    player.score += 520 + floor * 3.2 + Math.min(620, player.combo * 18);
    crownBanner = { floor, age: 0, life: 2.2 };
    state.shake = Math.max(state.shake, 0.48);
    crownDrop?.();
    tone(610 + Math.min(180, floor), 0.13, 0.038, 'triangle', 1.42);
    announce(`CROWN MARK · ${floor}`, 1.0, 18);
    const telemetry = S.getTelemetry();
    telemetry.counters.crownMarks = (telemetry.counters.crownMarks || 0) + 1;
    recordEvent('crown-mark', { floor, runCrownMarks, score: Math.floor(player.score) });
  }

  function updatePersonalBest() {
    if (player.highestFloor > bestFloor) {
      const previousBest = bestFloor;
      bestFloor = player.highestFloor;
      storage.write('sylvaria.sequoia.bestFloor', bestFloor);
      if (bestFloor >= Math.max(10, previousBest + 5)) {
        pbBanner = { floor: bestFloor, age: 0, life: 1.7 };
      }
      const telemetry = S.getTelemetry();
      telemetry.counters.personalBestFloors = (telemetry.counters.personalBestFloors || 0) + 1;
    }
    if (player.bestCombo > bestCombo) {
      bestCombo = player.bestCombo;
      storage.write('sylvaria.sequoia.bestCombo', bestCombo);
    }
  }

  function updatePhase() {
    const current = S.phaseForFloor(player.highestFloor).name;
    if (current === lastPhaseName) return;
    lastPhaseName = current;
    phaseBanner = { name: current, age: 0, life: 2.4 };
    player.score += 280;
    tone(330, 0.10, 0.026, 'sine', 1.34);
    recordEvent('canopy-phase-enter', { phase: current, floor: player.highestFloor });
  }

  function tickBanner(banner, dt) {
    if (!banner) return null;
    banner.age += dt;
    return banner.age >= banner.life ? null : banner;
  }

  function update(dt) {
    baseUpdate(dt);
    if (state.mode !== 'playing') return;

    const floor = player.highestFloor;
    if (floor > previousFloor) {
      const previousMark = Math.floor(previousFloor / CROWN_INTERVAL);
      const currentMark = Math.floor(floor / CROWN_INTERVAL);
      if (currentMark > previousMark && floor >= CROWN_INTERVAL) {
        for (let mark = previousMark + 1; mark <= currentMark; mark += 1) awardCrownMark(mark * CROWN_INTERVAL);
      }
      previousFloor = floor;
    }

    updatePersonalBest();
    updatePhase();
    phaseBanner = tickBanner(phaseBanner, dt);
    crownBanner = tickBanner(crownBanner, dt);
    pbBanner = tickBanner(pbBanner, dt);
  }

  function markRouteProgress(floor) {
    const before = new Map(state.chunks.map((chunk) => [chunk.id, Boolean(chunk.completed)]));
    const result = baseMarkRouteProgress(floor);
    for (const chunk of state.chunks) {
      if (chunk.completed && !before.get(chunk.id)) {
        const telemetry = S.getTelemetry();
        telemetry.counters.routesCleared = (telemetry.counters.routesCleared || 0) + 1;
        const routeBonus = 80 + Math.min(260, Math.max(0, player.combo) * 12);
        player.score += routeBonus;
        recordEvent('route-clear-bonus', { route: chunk.type, phase: chunk.phase, bonus: routeBonus });
      }
    }
    return result;
  }

  function resetProgress() {
    runCrownMarks = 0;
    lastCrownFloor = 0;
    lastPhaseName = S.phaseForFloor(0).name;
    phaseBanner = null;
    crownBanner = null;
    pbBanner = null;
    previousFloor = 0;
  }

  function resetRun(seed) {
    const result = baseResetRun(seed);
    resetProgress();
    return result;
  }

  function startRun(seed) {
    const result = baseStartRun(seed);
    resetProgress();
    return result;
  }

  S.update = update;
  S.resetRun = resetRun;
  S.startRun = startRun;
  S.markRouteProgress = markRouteProgress;
  S.canopyProgress = {
    version: VERSION,
    crownInterval: CROWN_INTERVAL,
    getState: () => ({
      bestFloor,
      bestCombo,
      runCrownMarks,
      lastCrownFloor,
      nextCrownFloor: nextCrownFloor(),
      crownRemaining: Math.max(0, nextCrownFloor() - player.highestFloor),
      phase: S.phaseForFloor(player.highestFloor).name,
      phaseGoal: phaseGoal(),
      phaseBanner: phaseBanner ? { ...phaseBanner } : null,
      crownBanner: crownBanner ? { ...crownBanner } : null,
      pbBanner: pbBanner ? { ...pbBanner } : null,
    }),
  };
})();
