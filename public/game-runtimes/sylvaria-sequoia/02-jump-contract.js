(() => {
  'use strict';

  const S = window.SylvariaSequoia;
  const { player, TUNE, recordEvent } = S;
  const baseRequestJump = S.requestJump;
  const baseUpdate = S.update;
  const baseResetRun = S.resetRun;
  const baseStartRun = S.startRun;
  const duplicateEdgeMs = 48;
  let nextRequestId = 0;
  let lastRequestAt = -Infinity;

  function resetJumpContract() {
    nextRequestId = 0;
    lastRequestAt = -Infinity;
    player.jumpRequestId = 0;
    player.consumedJumpRequestId = 0;
    player.jumpBuffer = 0;
  }

  function requestJump() {
    const now = performance.now();
    const hasPendingRequest =
      player.jumpRequestId > player.consumedJumpRequestId &&
      player.jumpBuffer > 0;

    // One physical press may surface twice through focus/iframe/browser plumbing.
    // Ignore an unresolved duplicate edge, and also reject implausibly-fast duplicate
    // delivery after the first fixed step has already consumed the request.
    if (hasPendingRequest || now - lastRequestAt < duplicateEdgeMs) {
      return player.jumpRequestId;
    }

    nextRequestId += 1;
    player.jumpRequestId = nextRequestId;
    lastRequestAt = now;
    baseRequestJump();
    recordEvent('jump-request', { requestId: nextRequestId });
    return nextRequestId;
  }

  function update(dt) {
    // A consumed request must never survive as a buffered request into another 120 Hz tick.
    if (
      player.jumpBuffer > 0 &&
      player.jumpRequestId > 0 &&
      player.jumpRequestId === player.consumedJumpRequestId
    ) {
      player.jumpBuffer = 0;
    }

    const telemetry = S.getTelemetry();
    const beforeGroundJumps = telemetry.counters.jumps;
    const beforeAirJumps = telemetry.counters.doubleJumps;
    const activeRequestId = player.jumpRequestId;

    baseUpdate(dt);

    const groundJumped = telemetry.counters.jumps > beforeGroundJumps;
    const airJumped = telemetry.counters.doubleJumps > beforeAirJumps;
    if ((groundJumped || airJumped) && activeRequestId > player.consumedJumpRequestId) {
      player.consumedJumpRequestId = activeRequestId;
      player.jumpBuffer = 0;
      recordEvent('jump-request-consumed', {
        requestId: activeRequestId,
        action: airJumped ? 'AIR_KICK' : 'GROUND_JUMP',
      });
    }
  }

  function resetRun(seed) {
    const result = baseResetRun(seed);
    resetJumpContract();
    return result;
  }

  function startRun(seed) {
    const result = baseStartRun(seed);
    resetJumpContract();
    return result;
  }

  S.requestJump = requestJump;
  S.update = update;
  S.resetRun = resetRun;
  S.startRun = startRun;
  S.resetJumpContract = resetJumpContract;
  S.jumpInputContract = {
    duplicateEdgeMs,
    getState: () => ({
      nextRequestId,
      jumpRequestId: player.jumpRequestId,
      consumedJumpRequestId: player.consumedJumpRequestId,
      pending: player.jumpRequestId > player.consumedJumpRequestId,
      bufferSeconds: TUNE.jump.bufferSeconds,
    }),
  };
})();
