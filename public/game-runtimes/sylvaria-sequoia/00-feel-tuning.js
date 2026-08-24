(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { TUNE } = S;

  // Icy-Tower-inspired principle: ordinary running must be enough to enter the
  // large-jump loop. Advanced tools extend and rescue Flow, rather than gate it.
  Object.assign(TUNE.run, {
    groundAccel: 3680,
    airAccel: 1760,
    maxSpeed: 700,
    groundFriction60Hz: 0.91,
    airDrag120Hz: 0.9990,
    reverseAirScale: 0.90,
    burstChargeSeconds: 0.18,
    burstMinSpeed: 175,
    burstImpulse: 112,
    comboAccelPerLink: 0.055,
    comboAccelCap: 0.38,
    hyperAccelScale: 1.20,
    comboCarryBase: 34,
    comboCarryPerLink: 8,
    comboCarryCap: 96,
    wallRecoverySeconds: 0.34,
    wallRecoveryAccel: 1120,
    strideMemoryDecay: 68,
    strideLaunchCarry: 0.90,
    strideMax: 760,
  });

  Object.assign(TUNE.jump, {
    base: 650,
    momentumGain: 0.65,
    momentumCap: 455,
    comboLift: 9,
    cutDrag120Hz: 0.9993,
    bufferSeconds: 0.19,
    coyoteSeconds: 0.12,
    doubleBase: 520,
    doubleMomentumGain: 0.30,
    doubleMomentumCap: 180,
    doubleHorizontalImpulse: 158,
    doubleMaxVy: 900,
    wallRefreshSpeed: 170,
    burlBoost: 138,
    burlHorizontalBoost: 64,
    burlRadius: 90,
  });

  Object.assign(TUNE.rebound, {
    // Keep the physical rebound compact enough for this narrower tower, while
    // Stride memory preserves the incoming speed state for the next launch.
    retention: 0.80,
    horizontalBonus: 20,
    verticalBase: 390,
    verticalGain: 0.50,
    verticalCap: 350,
    sweetSpotAmplitude: 0.065,
    comboSpeed: 165,
    clingGrace: 0.22,
    kickVertical: 700,
    kickHorizontal: 350,
  });

  Object.assign(TUNE.sap, {
    attachMax: 468,
    restRatio: 0.56,
    restMin: 68,
    restMax: 172,
    springK: 31,
    radialDamping: 4.0,
    pumpAccel: 1820,
    hyperPumpAccel: 2320,
    releaseStretchGain: 2.60,
    releaseCap: 372,
    releaseUpFraction: 0.54,
    comboReleaseGain: 8,
    surgeStretch: 30,
    surgeMultiplier: 1.38,
    hyperReleaseMultiplier: 1.20,
    surgeUpBonus: 118,
    snapRestScale: 0.72,
    snapTowardImpulse: 118,
    snapMinVy: 480,
    snapLiftBonus: 180,
    quickWindow: 0.30,
    quickMinVy: 690,
    quickForwardImpulse: 92,
    releaseFloorVy: 520,
  });

  Object.assign(TUNE.combo, {
    window: 3.70,
    ascentDecayScale: 0.24,
    saplineDecayScale: 0.16,
    highMomentumDecayScale: 0.48,
    hesitationSpeed: 94,
    hesitationDecayScale: 1.30,
    landingGrace: 1.75,
    recoveryBankDelay: 1.15,
    sapSurgeThreshold: 5,
    hyperThreshold: 7,
    hyperVariety: 3,
    easyHyperThreshold: 6,
    hyperVarietyThreshold: 4,
  });

  Object.assign(TUNE.ring, {
    baseRadius: 36,
    minRadius: 22,
    speedBonusStart: 235,
  });

  Object.assign(TUNE.threat, {
    baseSpeed: 18,
    timeGain: 0.31,
    floorGain: 0.18,
    targetGap: 545,
    rubberGain: 58,
    minSpeed: 12,
    maxSpeed: 174,
  });
})();
