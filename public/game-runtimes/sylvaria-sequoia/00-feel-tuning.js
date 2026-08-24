(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { TUNE } = S;

  // v0.4 canopy pass: preserve earned speed, but make the difficult routes about
  // deliberate line choice and Sap Stick timing rather than passive acceleration.
  Object.assign(TUNE.run, {
    groundAccel: 3220,
    airAccel: 1460,
    maxSpeed: 630,
    groundFriction60Hz: 0.884,
    airDrag120Hz: 0.9977,
    reverseAirScale: 0.79,
    burstChargeSeconds: 0.29,
    burstMinSpeed: 270,
    burstImpulse: 72,
    comboAccelPerLink: 0.017,
    comboAccelCap: 0.095,
    hyperAccelScale: 1.08,
    comboCarryBase: 9,
    comboCarryPerLink: 3,
    comboCarryCap: 26,
    wallRecoverySeconds: 0.18,
    wallRecoveryAccel: 420,
    strideMemoryDecay: 182,
    strideLaunchCarry: 0.61,
    strideMax: 660,
    skillSpeedBonusCap: 78,
  });

  Object.assign(TUNE.jump, {
    base: 612,
    momentumGain: 0.54,
    momentumCap: 330,
    comboLift: 4,
    cutDrag120Hz: 0.9968,
    bufferSeconds: 0.15,
    coyoteSeconds: 0.105,
    doubleBase: 485,
    doubleMomentumGain: 0.25,
    doubleMomentumCap: 145,
    doubleHorizontalImpulse: 132,
    doubleMaxVy: 825,
    // Passive bark never refreshes Air Kick. Deliberate Bark Kick does.
    wallRefreshSpeed: 99999,
    burlBoost: 122,
    burlHorizontalBoost: 50,
    burlRadius: 82,
  });

  Object.assign(TUNE.rebound, {
    // Passive wall contact is a low-energy redirect only. The valuable wall
    // interaction remains the timed Bark Cling -> Bark Kick input.
    retention: 0.55,
    horizontalBonus: 13,
    verticalBase: 150,
    verticalGain: 0.21,
    verticalCap: 160,
    sweetSpotAmplitude: 0.03,
    comboSpeed: 99999,
    clingGrace: 0.22,
    clingHold: 0.26,
    clingFallCap: 70,
    kickVertical: 690,
    kickHorizontal: 365,
  });

  Object.assign(TUNE.sap, {
    // Legacy spring values remain for the deterministic rope solver, but v0.4
    // drives that solver with a fixed-duration Sap Stick cast. There is no charge.
    attachMax: 460,
    restRatio: 0.61,
    restMin: 72,
    restMax: 180,
    springK: 30,
    radialDamping: 4.6,
    pumpAccel: 1600,
    hyperPumpAccel: 2050,
    releaseStretchGain: 2.30,
    releaseCap: 320,
    releaseUpFraction: 0.45,
    comboReleaseGain: 22,
    surgeStretch: 38,
    surgeMultiplier: 1.30,
    hyperReleaseMultiplier: 1.14,
    surgeUpBonus: 90,
    snapRestScale: 0.78,
    snapTowardImpulse: 90,
    snapMinVy: 365,
    snapLiftBonus: 130,
    quickWindow: 0.24,
    quickMinVy: 585,
    quickForwardImpulse: 64,
    releaseFloorVy: 445,

    // Sap Stick: one Shift+Space chord -> assisted amber lock -> short tether ->
    // deterministic momentum vault. Authored anchor spacing is validated in CI.
    stickRange: 640,
    stickMinDistance: 62,
    stickMaxBelow: 72,
    stickMaxAbove: 455,
    stickHoldSeconds: 0.22,
    stickCooldownSeconds: 0.11,
    stickReuseLockSeconds: 0.82,
    stickRestRatio: 0.48,
    stickRestMin: 58,
    stickRestMax: 152,
    stickPullImpulse: 218,
    stickTangentBoost: 174,
    stickMinVy: 430,
    stickReleaseMinVy: 610,
    stickReleaseForward: 116,
    stickReleaseSpeedCap: 770,
    stickRescueBonus: 118,
    stickAnchorPriority: 108,
  });

  Object.assign(TUNE.combo, {
    window: 2.80,
    ascentDecayScale: 0.58,
    saplineDecayScale: 0.46,
    highMomentumDecayScale: 0.84,
    hesitationSpeed: 125,
    hesitationDecayScale: 1.9,
    landingGrace: 0.90,
    recoveryBankDelay: 0.76,
    sapSurgeThreshold: 5,
    hyperThreshold: 7,
    hyperVariety: 3,
    easyHyperThreshold: 10,
    hyperVarietyThreshold: 6,
  });

  Object.assign(TUNE.ring, {
    baseRadius: 30,
    minRadius: 19,
    speedBonusStart: 335,
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
