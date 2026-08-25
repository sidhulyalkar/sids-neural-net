(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.update || !S?.resetRun || !S?.startRun || !S?.PHASES || !S?.phaseForFloor) return;

  const { state, player, clamp, recordEvent } = S;
  const baseUpdate = S.update;
  const baseResetRun = S.resetRun;
  const baseStartRun = S.startRun;
  const VERSION = 'canopy-director-v1';
  const CROWN_CYCLE = 25;
  const CATCH_GRACE_SECONDS = 2.35;

  // This is the final route-choreography authority. Earlier modules define their
  // mechanics; the director decides when the player is asked to combine them.
  // Seeded geometry remains untouched, so same-seed runs stay comparable.
  const ROUTE_CHOREOGRAPHY = {
    ROOTWAYS: ['FLOW', 'RECOVERY', 'GROVE', 'FLOW', 'SAPRUN'],
    'REDWOOD RUN': ['FLOW', 'GROVE', 'WINDLINE', 'RECOVERY', 'SLINGSHOT', 'CRUX'],
    SAPWORK: ['SAPRUN', 'BREAKAWAY', 'GROVE', 'WINDLINE', 'RECOVERY', 'SKYHOOK', 'CRUX'],
    'HIGH CANOPY': ['PENDULUM', 'GROVE', 'RECOVERY', 'SKYHOOK', 'CRUX', 'CROWNWEAVE', 'WINDLINE'],
    'STORM CANOPY': ['CONEFALL', 'GROVE', 'PENDULUM', 'RECOVERY', 'SKYHOOK', 'CONEFALL', 'CROWNWEAVE', 'WINDLINE'],
    CROWNLINE: ['CONEFALL', 'THUNDERCROWN', 'CROWNWEAVE', 'RECOVERY', 'PENDULUM', 'SKYHOOK', 'THUNDERCROWN', 'CRUX', 'WINDLINE', 'SAPRUN'],
  };

  const BASE_PRESSURE = {
    ROOTWAYS: 0.72,
    'REDWOOD RUN': 0.90,
    SAPWORK: 1.02,
    'HIGH CANOPY': 1.13,
    'STORM CANOPY': 1.19,
    CROWNLINE: 1.27,
  };

  const STAGES = [
    { id: 'BREATHE', start: 0, end: 5, multiplier: 0.84 },
    { id: 'BUILD', start: 6, end: 14, multiplier: 0.96 },
    { id: 'TEST', start: 15, end: 21, multiplier: 1.06 },
    { id: 'CROWN', start: 22, end: 24, multiplier: 1.13 },
  ];

  // Conefall previously became active at floor 132 while the named phase did not
  // change until 165. Give the mechanic its own readable band before Crownline
  // starts combining everything.
  if (!S.PHASES.some((phase) => phase.name === 'STORM CANOPY')) {
    const crownIndex = S.PHASES.findIndex((phase) => phase.name === 'CROWNLINE');
    const storm = {
      name: 'STORM CANOPY',
      floor: 132,
      geometry: 0.88,
      pressure: BASE_PRESSURE['STORM CANOPY'],
      sequence: ROUTE_CHOREOGRAPHY['STORM CANOPY'].slice(),
    };
    if (crownIndex >= 0) S.PHASES.splice(crownIndex, 0, storm);
    else S.PHASES.push(storm);
  }

  for (const phase of S.PHASES) {
    if (ROUTE_CHOREOGRAPHY[phase.name]) phase.sequence = ROUTE_CHOREOGRAPHY[phase.name].slice();
    if (BASE_PRESSURE[phase.name]) phase.pressure = BASE_PRESSURE[phase.name];
  }

  let lastStage = '';
  let lastPhase = '';
  let catchGrace = 0;
  let observedCatches = 0;
  let stageTransitions = 0;
  let graceActivations = 0;

  function stageForFloor(floor = player.highestFloor) {
    const local = ((Math.max(0, Math.floor(floor)) % CROWN_CYCLE) + CROWN_CYCLE) % CROWN_CYCLE;
    return STAGES.find((stage) => local >= stage.start && local <= stage.end) || STAGES[0];
  }

  function basePressureForFloor(floor = player.highestFloor) {
    const phase = S.phaseForFloor(floor);
    return BASE_PRESSURE[phase?.name] || Number(phase?.pressure) || 1;
  }

  function pressureForFloor(floor = player.highestFloor, graceSeconds = 0) {
    const stage = stageForFloor(floor);
    let multiplier = stage.multiplier;
    // The first dozen floors are a movement laboratory. New players should be
    // learning inputs, not discovering the threat wall through a death screen.
    if (floor < 12) multiplier = Math.min(multiplier, 0.88);
    const graceScale = graceSeconds > 0
      ? 0.72 + 0.28 * (1 - clamp(graceSeconds / CATCH_GRACE_SECONDS, 0, 1))
      : 1;
    return clamp(basePressureForFloor(floor) * multiplier * graceScale, 0.56, 1.48);
  }

  function applyPressure() {
    for (const phase of S.PHASES) {
      if (BASE_PRESSURE[phase.name]) phase.pressure = BASE_PRESSURE[phase.name];
    }
    const phase = S.phaseForFloor(player.highestFloor);
    if (phase) phase.pressure = pressureForFloor(player.highestFloor, catchGrace);
  }

  function enforceAuthoredTrialMeaning() {
    // BREAKAWAY is introduced at SAPWORK. Forced BREAKAWAY branches should behave
    // as advertised immediately rather than waiting for a later global density
    // threshold. This does not consume RNG or modify geometry.
    for (const branch of state.branches) {
      if (branch.chunkType === 'BREAKAWAY' && branch.floor >= 70 && branch.floor !== 0) {
        branch._trialFragile = true;
      }
    }
  }

  function observeDirectorState(dt) {
    const stage = stageForFloor();
    const phase = S.phaseForFloor(player.highestFloor)?.name || 'ROOTWAYS';
    if (state.mode === 'playing' && (stage.id !== lastStage || phase !== lastPhase)) {
      stageTransitions += 1;
      recordEvent('canopy-director-stage', {
        stage: stage.id,
        phase,
        floor: player.highestFloor,
        pressure: S.round(pressureForFloor(player.highestFloor, catchGrace), 3),
      });
    }
    lastStage = stage.id;
    lastPhase = phase;

    const catches = S.getTelemetry().counters.sapCatches || 0;
    if (catches > observedCatches) {
      catchGrace = CATCH_GRACE_SECONDS;
      graceActivations += catches - observedCatches;
      recordEvent('canopy-director-catch-grace', {
        floor: player.highestFloor,
        seconds: CATCH_GRACE_SECONDS,
      });
    }
    observedCatches = catches;
    catchGrace = Math.max(0, catchGrace - dt);
  }

  function update(dt) {
    applyPressure();
    baseUpdate(dt);
    enforceAuthoredTrialMeaning();
    observeDirectorState(dt);
  }

  function resetDirector() {
    lastStage = '';
    lastPhase = '';
    catchGrace = 0;
    observedCatches = 0;
    stageTransitions = 0;
    graceActivations = 0;
    for (const phase of S.PHASES) {
      if (ROUTE_CHOREOGRAPHY[phase.name]) phase.sequence = ROUTE_CHOREOGRAPHY[phase.name].slice();
      if (BASE_PRESSURE[phase.name]) phase.pressure = BASE_PRESSURE[phase.name];
    }
  }

  function resetRun(seed) {
    const result = baseResetRun(seed);
    resetDirector();
    return result;
  }

  function startRun(seed) {
    const result = baseStartRun(seed);
    resetDirector();
    return result;
  }

  S.update = update;
  S.resetRun = resetRun;
  S.startRun = startRun;
  S.canopyDirector = {
    version: VERSION,
    crownCycle: CROWN_CYCLE,
    catchGraceSeconds: CATCH_GRACE_SECONDS,
    ownsRouteChoreography: true,
    pressureForFloor: (floor) => pressureForFloor(floor, 0),
    getState: () => {
      const stage = stageForFloor();
      const phase = S.phaseForFloor(player.highestFloor)?.name || 'ROOTWAYS';
      return {
        version: VERSION,
        phase,
        stage: stage.id,
        stageFloor: player.highestFloor % CROWN_CYCLE,
        stageMultiplier: stage.multiplier,
        pressure: pressureForFloor(player.highestFloor, catchGrace),
        catchGraceRemaining: S.round(catchGrace, 3),
        stageTransitions,
        graceActivations,
        choreography: Object.fromEntries(Object.entries(ROUTE_CHOREOGRAPHY).map(([name, sequence]) => [name, sequence.slice()])),
      };
    },
  };
})();