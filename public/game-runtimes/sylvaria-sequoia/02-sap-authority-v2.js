(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.pressSapStick || !S?.releaseSapStick || !S?.sapStick || !S?.update) return;

  const { state, player, TUNE, clamp, announce, recordEvent, tone } = S;
  const basePress = S.pressSapStick;
  const baseRelease = S.releaseSapStick;
  const baseUpdate = S.update;
  const baseResetRun = S.resetRun;
  const baseStartRun = S.startRun;
  const baseSapState = S.sapStick.getState;

  const VERSION = 'nearest-sap-authority-v2';
  const MIN_GROUNDED_REARM_SECONDS = 0.035;
  const MAX_ATTACH_VX_GAIN = 95;
  const MAX_ATTACH_VY_GAIN = 120;
  const MAX_RELEASE_VX_GAIN = 105;
  const MAX_RELEASE_VY_GAIN = 145;
  const BLOCK_NOTICE_SECONDS = 0.36;

  Object.assign(TUNE.sap, {
    stickAcquireBufferSeconds: 0,
    stickRange: Math.min(TUNE.sap.stickRange, 525),
    stickMaxBelow: Math.min(TUNE.sap.stickMaxBelow, 28),
    stickMaxAbove: Math.min(TUNE.sap.stickMaxAbove, 340),
    stickPullImpulse: 72,
    stickTangentBoost: 78,
    stickMinVy: 95,
    stickReleaseMinVy: 125,
    stickReleaseForward: 58,
    stickReleaseSpeedCap: Math.min(TUNE.sap.stickReleaseSpeedCap, 735),
    stickRescueBonus: 54,
    stickAnchorPriority: 0,
    releaseStretchGain: Math.min(TUNE.sap.releaseStretchGain, 0.72),
    releaseCap: Math.min(TUNE.sap.releaseCap, 118),
    releaseUpFraction: Math.min(TUNE.sap.releaseUpFraction, 0.18),
  });

  let armed = true;
  let spentAtFloor = -1;
  let highestPhysicalFloor = 0;
  let lastGroundedBranch = null;
  let activeLeaseId = '';
  let blockedPresses = 0;
  let nearestSelections = 0;
  let nodeUses = 0;
  let recharges = 0;
  let noticeCooldown = 0;
  let releaseBaseline = null;
  const usedAnchorIds = new Set();

  function bumpCounter(name) {
    const counters = S.getTelemetry().counters;
    counters[name] = (counters[name] || 0) + 1;
  }

  function anchorId(knot) {
    return `${knot?.chunkId || 'route'}:${Number(knot?.floor) || 0}:${Math.round(knot?.x || 0)}:${Math.round(knot?.y || 0)}`;
  }

  function isAuthoredAnchor(knot) {
    return knot?.anchorKind === 'sap-stick';
  }

  function eligibleAnchor(knot) {
    if (!isAuthoredAnchor(knot)) return false;
    const id = anchorId(knot);
    if (usedAnchorIds.has(id)) return false;
    if ((Number(knot.floor) || 0) <= highestPhysicalFloor) return false;

    const dx = knot.x - player.x;
    const dy = knot.y - player.y;
    if (dy < -TUNE.sap.stickMaxBelow || dy > TUNE.sap.stickMaxAbove) return false;
    const distance = Math.hypot(dx, dy);
    return distance >= TUNE.sap.stickMinDistance && distance <= TUNE.sap.stickRange;
  }

  function nearestEligibleAnchor() {
    if (!armed || state.mode !== 'playing') return null;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const knot of state.knots) {
      if (!eligibleAnchor(knot)) continue;
      const distance = Math.hypot(knot.x - player.x, knot.y - player.y);
      if (distance < nearestDistance - 0.0001) {
        nearest = knot;
        nearestDistance = distance;
      } else if (nearest && Math.abs(distance - nearestDistance) <= 0.0001 && knot.floor < nearest.floor) {
        nearest = knot;
      }
    }
    return nearest;
  }

  function withOnlyTarget(target, fn) {
    const original = state.knots.slice();
    state.knots.splice(0, state.knots.length, target);
    try {
      return fn();
    } finally {
      state.knots.splice(0, state.knots.length, ...original);
    }
  }

  function capAttachImpulse(before) {
    player.vx = before.vx + clamp(player.vx - before.vx, -MAX_ATTACH_VX_GAIN, MAX_ATTACH_VX_GAIN);
    player.vy = before.vy + clamp(player.vy - before.vy, -MAX_ATTACH_VY_GAIN, MAX_ATTACH_VY_GAIN);
  }

  function capReleaseImpulse(before) {
    if (!before) return;
    player.vx = before.vx + clamp(player.vx - before.vx, -MAX_RELEASE_VX_GAIN, MAX_RELEASE_VX_GAIN);
    player.vy = before.vy + clamp(player.vy - before.vy, -MAX_RELEASE_VY_GAIN, MAX_RELEASE_VY_GAIN);
  }

  function block(reason) {
    blockedPresses += 1;
    bumpCounter('sapAuthorityBlockedPresses');
    if (noticeCooldown <= 0) {
      noticeCooldown = BLOCK_NOTICE_SECONDS;
      announce(reason === 'SPENT' ? 'SAP SPENT · LAND HIGHER' : 'NO SAP NODE IN RANGE', 0.30, 10);
      tone(112, 0.025, 0.01, 'square', 0.8);
    }
    recordEvent('sap-authority-blocked', {
      reason,
      spentAtFloor,
      highestPhysicalFloor,
      blockedPresses,
    });
    return false;
  }

  function pressSapStick() {
    if (state.mode !== 'playing') return false;
    if (player.sap?.stickMode) return true;
    if (!armed) return block('SPENT');

    const target = nearestEligibleAnchor();
    if (!target) return block('NO_TARGET');

    const before = { vx: player.vx, vy: player.vy };
    const attached = Boolean(withOnlyTarget(target, () => basePress()));
    if (!attached || !player.sap?.stickMode) return false;

    capAttachImpulse(before);
    const id = anchorId(target);
    usedAnchorIds.add(id);
    activeLeaseId = id;
    armed = false;
    spentAtFloor = highestPhysicalFloor;
    nodeUses += 1;
    nearestSelections += 1;
    bumpCounter('nearestSapSelections');
    bumpCounter('sapAuthorityUses');
    recordEvent('sap-authority-acquired', {
      id,
      floor: target.floor,
      distance: S.round(Math.hypot(target.x - player.x, target.y - player.y), 1),
      spentAtFloor,
      vx: S.round(player.vx, 1),
      vy: S.round(player.vy, 1),
    });
    return true;
  }

  function releaseSapStick(reason = 'SHIFT_RELEASE') {
    if (!player.sap?.stickMode) return false;
    releaseBaseline = { vx: player.vx, vy: player.vy };
    const released = Boolean(baseRelease(reason));
    if (!player.sap?.stickMode) {
      capReleaseImpulse(releaseBaseline);
      releaseBaseline = null;
      activeLeaseId = '';
    }
    return released;
  }

  function observeGrounding() {
    const branch = player.grounded;
    if (!branch) {
      lastGroundedBranch = null;
      return;
    }

    const floor = Number(branch.floor) || 0;
    if (floor > highestPhysicalFloor) highestPhysicalFloor = floor;

    // Do not consume the landing edge until it has been physically held for a few
    // fixed ticks. onLand starts groundedTime at zero, so marking it immediately
    // would prevent the next frame from ever rearming Sap.
    if (!armed && floor > spentAtFloor && player.groundedTime < MIN_GROUNDED_REARM_SECONDS) return;
    if (branch === lastGroundedBranch) return;
    lastGroundedBranch = branch;

    if (armed || floor <= spentAtFloor) return;
    armed = true;
    recharges += 1;
    bumpCounter('sapAuthorityRecharges');
    recordEvent('sap-authority-recharged', { floor, recharges });
    announce('SAP READY', 0.34, 10);
  }

  function update(dt) {
    noticeCooldown = Math.max(0, noticeCooldown - dt);
    const wasActive = Boolean(player.sap?.stickMode);
    const leaseBefore = activeLeaseId;
    baseUpdate(dt);
    const isActive = Boolean(player.sap?.stickMode);

    if (!wasActive && isActive && !activeLeaseId) {
      baseRelease('AUTHORITY_REJECT');
      player.sap = null;
      bumpCounter('sapAuthorityRejectedAttaches');
      recordEvent('sap-authority-rejected-attach', {});
    }

    if (wasActive && !isActive && leaseBefore) {
      capReleaseImpulse(releaseBaseline);
      releaseBaseline = null;
      activeLeaseId = '';
    }

    observeGrounding();
  }

  function resetAuthority() {
    armed = true;
    spentAtFloor = -1;
    highestPhysicalFloor = Number(player.grounded?.floor) || 0;
    lastGroundedBranch = player.grounded || null;
    activeLeaseId = '';
    blockedPresses = 0;
    nearestSelections = 0;
    nodeUses = 0;
    recharges = 0;
    noticeCooldown = 0;
    releaseBaseline = null;
    usedAnchorIds.clear();
  }

  function resetRun(seed) {
    const result = baseResetRun(seed);
    resetAuthority();
    return result;
  }

  function startRun(seed) {
    const result = baseStartRun(seed);
    resetAuthority();
    return result;
  }

  function getState() {
    const nearest = nearestEligibleAnchor();
    return {
      version: VERSION,
      armed,
      needsHigherLog: !armed,
      spentAtFloor,
      highestPhysicalFloor,
      activeLeaseId: activeLeaseId || null,
      usedAnchors: usedAnchorIds.size,
      blockedPresses,
      nearestSelections,
      nodeUses,
      recharges,
      nearestTarget: nearest ? {
        id: anchorId(nearest),
        floor: nearest.floor,
        x: nearest.x,
        y: nearest.y,
        distance: S.round(Math.hypot(nearest.x - player.x, nearest.y - player.y), 1),
      } : null,
      pressTimeAcquisition: true,
      bufferedAcquisitionSeconds: TUNE.sap.stickAcquireBufferSeconds,
      maxAttachVelocityGain: { x: MAX_ATTACH_VX_GAIN, y: MAX_ATTACH_VY_GAIN },
      maxReleaseVelocityGain: { x: MAX_RELEASE_VX_GAIN, y: MAX_RELEASE_VY_GAIN },
      useInvariant: nodeUses <= recharges + 1,
    };
  }

  S.update = update;
  S.resetRun = resetRun;
  S.startRun = startRun;
  S.pressSapStick = pressSapStick;
  S.releaseSapStick = releaseSapStick;
  S.sapAuthority = { version: VERSION, getState, getTargetPreview: nearestEligibleAnchor };
  S.sapStick.press = pressSapStick;
  S.sapStick.release = releaseSapStick;
  S.sapStick.getTargetPreview = nearestEligibleAnchor;
  S.sapStick.getState = () => ({
    ...baseSapState(),
    authority: getState(),
    ready: armed,
    needsHigherLog: !armed,
  });
})();
