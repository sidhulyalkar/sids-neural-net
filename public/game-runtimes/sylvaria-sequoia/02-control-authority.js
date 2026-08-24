(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  if (!S?.update) return;

  const { state, player, TUNE, clamp } = S;
  const baseUpdate = S.update;
  const CONTROL_VERSION = 'velocity-authority-v1';

  const CONTROL = {
    groundReverseAssist: 1120,
    airReverseAssist: 920,
    reverseDeadzone: 38,
    launchSnapThreshold: 125,
    launchSteerCap: 96,
  };

  let correctedLaunchSnaps = 0;
  let groundReverseSeconds = 0;
  let airReverseSeconds = 0;
  let peakCorrection = 0;

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

  function velocityCap() {
    const flowBonus = Math.min(TUNE.run.skillSpeedBonusCap || 0, Math.max(0, player.combo - 1) * 4);
    return TUNE.run.maxSpeed + flowBonus + (player.hyper ? 42 : 0);
  }

  function sign(value) {
    return Math.abs(value) < 0.0001 ? 0 : Math.sign(value);
  }

  function launchBurlImpulse(branch, x, vx, axis) {
    if (!branch?.launch || Math.abs(x - branch.launchX) > TUNE.jump.burlRadius) return 0;
    const direction = sign(vx) || axis || (branch.side === 'right' ? -1 : 1);
    return direction * TUNE.jump.burlHorizontalBoost;
  }

  function restorePlayerOwnedLaunch(before, axis, dt) {
    if (!before.grounded || !before.jumpBuffered || player.grounded || player.vy <= 0) return;
    if (before.stride <= Math.abs(before.vx) + 90) return;

    // Stride is allowed to preserve *jump height*, but it must not silently flip
    // horizontal velocity to the newly pressed direction. The player should feel
    // the reversal they actually authored, not a hidden 500 px/s teleport across zero.
    const expected = before.vx
      + axis * TUNE.run.groundAccel * dt
      + launchBurlImpulse(before.branch, before.x, before.vx, axis);
    const artificialSignFlip = sign(before.vx) !== 0
      && axis !== 0
      && sign(before.vx) !== axis
      && sign(player.vx) === axis;
    const correction = player.vx - expected;
    const artificialSnap = Math.abs(correction) > CONTROL.launchSnapThreshold;
    if (!artificialSignFlip && !artificialSnap) return;

    const boundedExpected = clamp(
      expected,
      before.vx - CONTROL.launchSteerCap,
      before.vx + CONTROL.launchSteerCap
    );
    const previous = player.vx;
    player.vx = clamp(boundedExpected, -velocityCap(), velocityCap());
    correctedLaunchSnaps += 1;
    peakCorrection = Math.max(peakCorrection, Math.abs(previous - player.vx));
    S.recordEvent?.('launch-velocity-authority', {
      beforeVx: S.round?.(before.vx, 1) ?? before.vx,
      hiddenVx: S.round?.(previous, 1) ?? previous,
      controlledVx: S.round?.(player.vx, 1) ?? player.vx,
    });
  }

  function applyReverseAuthority(axis, dt) {
    if (axis === 0 || Math.abs(player.vx) < CONTROL.reverseDeadzone) return;
    if (sign(player.vx) === axis) return;

    // Reversing is a deliberate braking action. Give it *more* authority than
    // same-direction acceleration so the player can place Pip precisely without
    // making ordinary forward acceleration twitchy.
    const grounded = Boolean(player.grounded);
    const assist = grounded ? CONTROL.groundReverseAssist : CONTROL.airReverseAssist;
    player.vx += axis * assist * dt;
    player.vx = clamp(player.vx, -velocityCap(), velocityCap());
    if (grounded) groundReverseSeconds += dt;
    else airReverseSeconds += dt;
  }

  function update(dt) {
    const axis = inputAxis();
    const before = {
      x: player.x,
      vx: player.vx,
      grounded: Boolean(player.grounded),
      branch: player.grounded,
      jumpBuffered: player.jumpBuffer > 0,
      stride: player.strideMomentum || 0,
    };

    baseUpdate(dt);
    if (state.mode !== 'playing') return;

    restorePlayerOwnedLaunch(before, axis, dt);
    applyReverseAuthority(axis, dt);
  }

  S.update = update;
  S.controlAuthority = {
    version: CONTROL_VERSION,
    model: 'player-owned horizontal velocity; Stride boosts height without hidden direction snaps',
    getState: () => ({
      correctedLaunchSnaps,
      groundReverseSeconds,
      airReverseSeconds,
      peakCorrection,
      reverseDeadzone: CONTROL.reverseDeadzone,
      groundReverseAssist: CONTROL.groundReverseAssist,
      airReverseAssist: CONTROL.airReverseAssist,
    }),
  };
})();
