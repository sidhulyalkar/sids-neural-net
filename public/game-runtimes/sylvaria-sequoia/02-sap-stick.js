(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  const { state, player, TUNE, clamp, recordEvent, announce, burst, tone } = S;
  const baseUpdate = S.update;
  const baseResetRun = S.resetRun;
  const baseStartRun = S.startRun;
  const baseReleaseSap = S.releaseSap;

  let castCooldown = 0;
  let lastTarget = null;
  const anchorLockouts = new Map();

  function bumpCounter(name) {
    const counters = S.getTelemetry().counters;
    counters[name] = (counters[name] || 0) + 1;
  }

  function anchorId(knot) {
    return `${knot.chunkId || 'route'}:${knot.floor}:${Math.round(knot.x)}:${Math.round(knot.y)}`;
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

  function isRescueState() {
    const threatGap = player.y - state.threatY;
    return player.vy < -170 || threatGap < 245;
  }

  function findTarget({ includeLocked = false } = {}) {
    if (state.mode !== 'playing') return null;
    const axis = inputAxis();
    const direction = axis || Math.sign(player.vx || player.facing || 1);
    const rescue = isRescueState();
    let best = null;
    let bestScore = Infinity;

    for (const knot of state.knots) {
      const id = anchorId(knot);
      if (!includeLocked && (anchorLockouts.get(id) || 0) > 0) continue;
      const dx = knot.x - player.x;
      const dy = knot.y - player.y;
      if (dy < -TUNE.sap.stickMaxBelow || dy > TUNE.sap.stickMaxAbove) continue;
      const distance = Math.hypot(dx, dy);
      if (distance < TUNE.sap.stickMinDistance || distance > TUNE.sap.stickRange) continue;

      const forward = dx * direction;
      const behindPenalty = !rescue && forward < -70 ? Math.abs(forward + 70) * 0.58 : 0;
      const belowPenalty = dy < 0 ? Math.abs(dy) * (rescue ? 0.36 : 1.15) : 0;
      const verticalReward = Math.max(0, dy) * (rescue ? 0.42 : 0.29);
      const routeReward = knot.anchorKind === 'sap-stick' ? TUNE.sap.stickAnchorPriority : 0;
      const forwardReward = Math.max(0, forward) * 0.10;
      const score = distance + behindPenalty + belowPenalty - verticalReward - routeReward - forwardReward;

      if (score < bestScore) {
        bestScore = score;
        best = knot;
      }
    }

    return best;
  }

  function updateAnchorLockouts(dt) {
    for (const [id, remaining] of anchorLockouts.entries()) {
      const next = remaining - dt;
      if (next <= 0) anchorLockouts.delete(id);
      else anchorLockouts.set(id, next);
    }
  }

  function attachTarget(knot) {
    if (!knot || state.mode !== 'playing') return false;
    const telemetry = S.getTelemetry();
    const dx = knot.x - player.x;
    const dy = knot.y - player.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const tx = -ny;
    const ty = nx;
    const axis = inputAxis();
    const forward = axis || Math.sign(player.vx || player.facing || dx || 1);
    const tangentVelocity = player.vx * tx + player.vy * ty;
    const tangentSign = Math.sign(tangentVelocity || forward * tx || 1);
    const speed = Math.hypot(player.vx, player.vy);
    const rescue = isRescueState();

    telemetry.counters.sapAttempts += 1;
    telemetry.counters.sapAttaches += 1;
    bumpCounter('sapStickCasts');
    if (rescue) bumpCounter('sapStickRescues');

    player.sap = {
      knot,
      rest: clamp(distance * TUNE.sap.stickRestRatio, TUNE.sap.stickRestMin, TUNE.sap.stickRestMax),
      maxStretch: 0,
      age: 0,
      snapEligible: false,
      stickMode: true,
      stickStartedAt: state.elapsed,
    };
    player.grounded = null;
    player.groundedTime = 0;
    player.coyote = 0;
    player.state = 'sap-stick';

    const tangentBoost = TUNE.sap.stickTangentBoost + Math.min(92, speed * 0.12);
    player.vx = clamp(
      player.vx * 0.58 + nx * TUNE.sap.stickPullImpulse + tx * tangentBoost * tangentSign,
      -TUNE.sap.stickReleaseSpeedCap,
      TUNE.sap.stickReleaseSpeedCap
    );
    player.vy = Math.max(
      player.vy * 0.28
        + Math.max(0, ny) * TUNE.sap.stickPullImpulse
        + ty * tangentBoost * tangentSign
        + (rescue ? TUNE.sap.stickRescueBonus : 0),
      TUNE.sap.stickMinVy + Math.max(0, dy) * 0.10
    );
    player.airJumps = TUNE.jump.airJumps;
    player.strideMomentum = Math.max(player.strideMomentum || 0, Math.min(TUNE.run.strideMax, Math.abs(player.vx) + 55));

    anchorLockouts.set(anchorId(knot), TUNE.sap.stickReuseLockSeconds);
    castCooldown = TUNE.sap.stickCooldownSeconds;
    lastTarget = knot;
    recordEvent('sap-stick-cast', {
      floor: knot.floor,
      route: knot.chunkType,
      anchorKind: knot.anchorKind || 'branch',
      distance: S.round(distance, 1),
      rescue,
      vx: S.round(player.vx, 1),
      vy: S.round(player.vy, 1),
    });
    announce(rescue ? 'SAP STICK SAVE!' : 'SAP STICK · LOCK', 0.36, rescue ? 15 : 12);
    burst(knot.x, knot.y, rescue ? 14 : 10, 'resin', 0.66);
    tone(rescue ? 610 : 520, 0.06, 0.03, 'triangle', 1.45);
    return true;
  }

  function releaseStick(reason = 'AUTO') {
    const sap = player.sap;
    if (!sap?.stickMode) return false;
    const knot = sap.knot;
    const comboLinksBefore = S.getTelemetry().counters.comboLinks;
    const rescue = isRescueState();
    const away = Math.sign(player.x - knot.x || player.vx || player.facing || 1);

    baseReleaseSap();
    player.vx = clamp(
      player.vx + away * TUNE.sap.stickReleaseForward,
      -TUNE.sap.stickReleaseSpeedCap,
      TUNE.sap.stickReleaseSpeedCap
    );
    player.vy = Math.max(
      player.vy,
      TUNE.sap.stickReleaseMinVy + (rescue ? TUNE.sap.stickRescueBonus * 0.42 : 0)
    );
    player.airJumps = TUNE.jump.airJumps;
    player.state = 'airborne-up';
    player.stretch = 1;
    player.strideMomentum = Math.max(player.strideMomentum || 0, Math.min(TUNE.run.strideMax, Math.abs(player.vx) + 70));

    const comboLinksAfter = S.getTelemetry().counters.comboLinks;
    if (comboLinksAfter === comboLinksBefore) S.addComboLink('SAP', 'SAP STICK', 1, 0.14);
    bumpCounter('sapStickVaults');
    recordEvent('sap-stick-release', {
      reason,
      floor: knot.floor,
      vx: S.round(player.vx, 1),
      vy: S.round(player.vy, 1),
    });
    announce('SAP STICK VAULT · AIR KICK READY', 0.42, 13);
    burst(player.x, player.y, 12, 'resin', 0.72);
    tone(660, 0.07, 0.032, 'triangle', 1.5);
    return true;
  }

  function castSapStick() {
    if (state.mode !== 'playing') return false;
    if (player.sap?.stickMode) return releaseStick('RECAST');
    if (castCooldown > 0) return false;
    if (player.sap) baseReleaseSap();

    const target = findTarget();
    if (!target) {
      const telemetry = S.getTelemetry();
      telemetry.counters.sapAttempts += 1;
      telemetry.counters.sapMisses += 1;
      bumpCounter('sapStickMisses');
      lastTarget = null;
      recordEvent('sap-stick-miss', { vx: S.round(player.vx, 1), vy: S.round(player.vy, 1) });
      announce('NO AMBER LOCK', 0.26, 10);
      tone(105, 0.035, 0.014, 'square', 0.78);
      return false;
    }

    return attachTarget(target);
  }

  function update(dt) {
    castCooldown = Math.max(0, castCooldown - dt);
    updateAnchorLockouts(dt);
    baseUpdate(dt);

    const sap = player.sap;
    if (sap?.stickMode && sap.age >= TUNE.sap.stickHoldSeconds) releaseStick('AUTO');
    if (state.mode !== 'playing') lastTarget = null;
  }

  function resetSapStick() {
    castCooldown = 0;
    lastTarget = null;
    anchorLockouts.clear();
  }

  function resetRun(seed) {
    const result = baseResetRun(seed);
    resetSapStick();
    return result;
  }

  function startRun(seed) {
    const result = baseStartRun(seed);
    resetSapStick();
    return result;
  }

  S.update = update;
  S.resetRun = resetRun;
  S.startRun = startRun;
  S.castSapStick = castSapStick;
  S.releaseSapStick = releaseStick;
  S.sapStick = {
    cast: castSapStick,
    release: releaseStick,
    getTargetPreview: () => findTarget(),
    getState: () => ({
      active: Boolean(player.sap?.stickMode),
      cooldown: castCooldown,
      range: TUNE.sap.stickRange,
      holdSeconds: TUNE.sap.stickHoldSeconds,
      autoReleaseIn: player.sap?.stickMode ? Math.max(0, TUNE.sap.stickHoldSeconds - (player.sap.age || 0)) : 0,
      targetFloor: player.sap?.stickMode ? player.sap.knot.floor : lastTarget?.floor ?? null,
      targetKind: player.sap?.stickMode ? player.sap.knot.anchorKind || 'branch' : lastTarget?.anchorKind || null,
      lockedAnchors: anchorLockouts.size,
    }),
  };
})();
