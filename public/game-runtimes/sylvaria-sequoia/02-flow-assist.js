(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  const { state, player, TUNE, W, clamp, recordEvent, announce, burst, tone } = S;
  const baseAttachSap = S.attachSap;
  const baseReleaseSap = S.releaseSap;
  const baseRequestJump = S.requestJump;
  const baseUpdate = S.update;
  const baseResetRun = S.resetRun;
  const baseStartRun = S.startRun;

  function ensureAssistState() {
    player.barkGrace ||= 0;
    player.barkSide ||= '';
    player.runCharge ||= 0;
    player.runChargeDirection ||= 0;
    player.lastBurstBranch ||= null;
  }

  function bumpCounter(name) {
    const counters = S.getTelemetry().counters;
    counters[name] = (counters[name] || 0) + 1;
  }

  function inputAxis() {
    let axis = 0;
    if (state.keys.has('ArrowLeft') || state.keys.has('KeyA')) axis -= 1;
    if (state.keys.has('ArrowRight') || state.keys.has('KeyD')) axis += 1;
    for (const action of state.pointers.values()) {
      if (action === 'left') axis -= 1;
      if (action === 'right') axis += 1;
    }
    return clamp(axis, -1, 1);
  }

  function resetAssist() {
    player.barkGrace = 0;
    player.barkSide = '';
    player.runCharge = 0;
    player.runChargeDirection = 0;
    player.lastBurstBranch = null;
  }

  function attachSap() {
    ensureAssistState();
    const before = player.sap;
    baseAttachSap();
    const sap = player.sap;
    if (before || !sap) return;

    const dx = sap.knot.x - player.x;
    const dy = sap.knot.y - player.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const above = clamp(ny, 0, 1);

    sap.rest = Math.max(TUNE.sap.restMin, sap.rest * TUNE.sap.snapRestScale);
    sap.snapEligible = dy > 8;
    sap.snapStartedAt = state.elapsed;

    if (sap.snapEligible) {
      player.vx += nx * TUNE.sap.snapTowardImpulse;
      player.vy = Math.max(
        player.vy + Math.max(0, ny * TUNE.sap.snapTowardImpulse),
        TUNE.sap.snapMinVy + above * TUNE.sap.snapLiftBonus
      );
      bumpCounter('sapSnaps');
      recordEvent('sap-snap', {
        vertical: S.round(player.vy, 1),
        toward: S.round(nx * TUNE.sap.snapTowardImpulse, 1),
      });
      announce('SAP SNAP', 0.42, 12);
      burst(player.x, player.y, 9, 'resin', 0.52);
      tone(470, 0.055, 0.028, 'triangle', 1.45);
    }
  }

  function releaseSap() {
    ensureAssistState();
    const sap = player.sap;
    if (!sap) {
      baseReleaseSap();
      return;
    }

    const age = sap.age || 0;
    const dy = sap.knot.y - player.y;
    const quick = Boolean(sap.snapEligible) && age <= TUNE.sap.quickWindow;
    const forward = Math.sign(player.vx || player.facing || 1);

    baseReleaseSap();

    if (dy > 0) player.vy = Math.max(player.vy, TUNE.sap.releaseFloorVy);
    if (!quick) return;

    player.vy = Math.max(player.vy, TUNE.sap.quickMinVy);
    player.vx += forward * TUNE.sap.quickForwardImpulse;
    player.airJumps = TUNE.jump.airJumps;
    bumpCounter('quickSlings');
    S.addComboLink('SAP', 'QUICK SLING', 1, 0.16);
    recordEvent('sap-quick-sling', {
      seconds: S.round(age, 3),
      vx: S.round(player.vx, 1),
      vy: S.round(player.vy, 1),
    });
    announce('QUICK SLING · AIR KICK READY', 0.58, 13);
    burst(player.x, player.y, 13, 'resin', 0.72);
    tone(620, 0.07, 0.032, 'triangle', 1.55);
  }

  function barkKick() {
    if (player.barkGrace <= 0 || player.grounded || player.sap) return false;
    const side = player.barkSide || (player.x < W / 2 ? 'left' : 'right');
    const direction = side === 'left' ? 1 : -1;
    player.jumpHeld = true;
    player.vx = direction * Math.max(Math.abs(player.vx), TUNE.rebound.kickHorizontal);
    player.vy = Math.max(player.vy, TUNE.rebound.kickVertical);
    player.airJumps = TUNE.jump.airJumps;
    player.barkGrace = 0;
    bumpCounter('barkKicks');
    recordEvent('bark-kick', { side, vx: S.round(player.vx, 1), vy: S.round(player.vy, 1) });
    announce('BARK KICK · AIR KICK READY', 0.5, 13);
    burst(player.x, player.y, 12, 'bark', 0.66);
    tone(330, 0.065, 0.03, 'square', 1.38);
    return true;
  }

  function requestJump() {
    ensureAssistState();
    if (barkKick()) return 0;
    return baseRequestJump();
  }

  function updateMomentumBurst(dt) {
    const axis = inputAxis();
    if (!player.grounded || axis === 0) {
      player.runCharge = 0;
      player.runChargeDirection = axis;
      return;
    }

    if (axis !== player.runChargeDirection) {
      player.runCharge = 0;
      player.runChargeDirection = axis;
    }
    player.runCharge += dt;

    if (
      player.runCharge >= TUNE.run.burstChargeSeconds &&
      Math.abs(player.vx) >= TUNE.run.burstMinSpeed &&
      player.lastBurstBranch !== player.grounded
    ) {
      player.vx += axis * TUNE.run.burstImpulse;
      const maxBurstSpeed = TUNE.run.maxSpeed + TUNE.run.burstImpulse;
      player.vx = clamp(player.vx, -maxBurstSpeed, maxBurstSpeed);
      player.lastBurstBranch = player.grounded;
      bumpCounter('momentumBursts');
      recordEvent('momentum-burst', { vx: S.round(player.vx, 1), floor: player.grounded.floor });
      announce('MOMENTUM BURST', 0.36, 11);
      burst(player.x, player.y - S.state.PLAYER_R, 6, 'leaf', 0.42);
      tone(285, 0.045, 0.022, 'triangle', 1.2);
    }
  }

  function update(dt) {
    ensureAssistState();
    player.barkGrace = Math.max(0, player.barkGrace - dt);
    const telemetry = S.getTelemetry();
    const wallBefore = telemetry.counters.wallBounces;

    baseUpdate(dt);

    if (telemetry.counters.wallBounces > wallBefore) {
      player.barkGrace = TUNE.rebound.clingGrace;
      player.barkSide = player.x < W / 2 ? 'left' : 'right';
    }
    updateMomentumBurst(dt);
  }

  function resetRun(seed) {
    const result = baseResetRun(seed);
    resetAssist();
    return result;
  }

  function startRun(seed) {
    const result = baseStartRun(seed);
    resetAssist();
    return result;
  }

  S.attachSap = attachSap;
  S.releaseSap = releaseSap;
  S.requestJump = requestJump;
  S.update = update;
  S.resetRun = resetRun;
  S.startRun = startRun;
  S.flowAssist = {
    reset: resetAssist,
    getState: () => ({
      barkGrace: player.barkGrace || 0,
      barkSide: player.barkSide || '',
      runCharge: player.runCharge || 0,
      burstFloor: player.lastBurstBranch?.floor ?? null,
    }),
  };
})();
