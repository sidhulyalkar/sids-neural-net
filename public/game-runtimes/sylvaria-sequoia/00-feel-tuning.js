(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { TUNE } = S;

  // v0.3 skill pass: speed should be expressive, not self-driving. Running
  // builds a useful launch state, but passive wall ping-pong cannot compound it.
  Object.assign(TUNE.run, {
    groundAccel: 3250,
    airAccel: 1480,
    maxSpeed: 625,
    groundFriction60Hz: 0.885,
    airDrag120Hz: 0.9978,
    reverseAirScale: 0.79,
    burstChargeSeconds: 0.28,
    burstMinSpeed: 260,
    burstImpulse: 74,
    comboAccelPerLink: 0.018,
    comboAccelCap: 0.10,
    hyperAccelScale: 1.08,
    comboCarryBase: 10,
    comboCarryPerLink: 3,
    comboCarryCap: 28,
    wallRecoverySeconds: 0.18,
    wallRecoveryAccel: 420,
    strideMemoryDecay: 176,
    strideLaunchCarry: 0.62,
    strideMax: 660,
    skillSpeedBonusCap: 82,
  });

  Object.assign(TUNE.jump, {
    base: 610,
    momentumGain: 0.54,
    momentumCap: 330,
    comboLift: 4,
    cutDrag120Hz: 0.9968,
    bufferSeconds: 0.15,
    coyoteSeconds: 0.105,
    doubleBase: 480,
    doubleMomentumGain: 0.25,
    doubleMomentumCap: 145,
    doubleHorizontalImpulse: 132,
    doubleMaxVy: 820,
    // Passive bark never refreshes Air Kick. Deliberate Bark Kick does.
    wallRefreshSpeed: 99999,
    burlBoost: 126,
    burlHorizontalBoost: 52,
    burlRadius: 82,
  });

  Object.assign(TUNE.rebound, {
    // Passive wall contact is a low-energy redirect only. The valuable wall
    // interaction is the timed Bark Cling -> Bark Kick input.
    retention: 0.56,
    horizontalBonus: 14,
    verticalBase: 155,
    verticalGain: 0.22,
    verticalCap: 165,
    sweetSpotAmplitude: 0.035,
    comboSpeed: 99999,
    clingGrace: 0.22,
    clingHold: 0.26,
    clingFallCap: 70,
    kickVertical: 690,
    kickHorizontal: 365,
  });

  Object.assign(TUNE.sap, {
    attachMax: 430,
    restRatio: 0.61,
    restMin: 72,
    restMax: 180,
    springK: 29,
    radialDamping: 4.4,
    pumpAccel: 1700,
    hyperPumpAccel: 2140,
    releaseStretchGain: 2.45,
    releaseCap: 350,
    releaseUpFraction: 0.48,
    comboReleaseGain: 18,
    surgeStretch: 34,
    surgeMultiplier: 1.34,
    hyperReleaseMultiplier: 1.17,
    surgeUpBonus: 102,
    snapRestScale: 0.77,
    snapTowardImpulse: 96,
    snapMinVy: 390,
    snapLiftBonus: 150,
    quickWindow: 0.26,
    quickMinVy: 610,
    quickForwardImpulse: 70,
    releaseFloorVy: 455,
  });

  Object.assign(TUNE.combo, {
    window: 2.85,
    ascentDecayScale: 0.58,
    saplineDecayScale: 0.44,
    highMomentumDecayScale: 0.84,
    hesitationSpeed: 125,
    hesitationDecayScale: 1.9,
    landingGrace: 0.92,
    recoveryBankDelay: 0.76,
    sapSurgeThreshold: 5,
    hyperThreshold: 7,
    hyperVariety: 3,
    easyHyperThreshold: 10,
    hyperVarietyThreshold: 6,
  });

  Object.assign(TUNE.ring, {
    baseRadius: 31,
    minRadius: 19,
    speedBonusStart: 330,
  });

  Object.assign(TUNE.threat, {
    baseSpeed: 25,
    timeGain: 0.40,
    floorGain: 0.21,
    targetGap: 505,
    rubberGain: 66,
    minSpeed: 17,
    maxSpeed: 182,
  });
})();
