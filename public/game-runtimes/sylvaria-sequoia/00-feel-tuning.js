(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { TUNE } = S;

  Object.assign(TUNE.run, {
    groundAccel: 3300,
    airAccel: 1450,
    maxSpeed: 640,
    groundFriction60Hz: 0.86,
    airDrag120Hz: 0.9982,
    reverseAirScale: 0.80,
    burstChargeSeconds: 0.26,
    burstMinSpeed: 250,
    burstImpulse: 92,
  });

  Object.assign(TUNE.jump, {
    base: 620,
    momentumGain: 0.52,
    momentumCap: 330,
    comboLift: 7,
    doubleBase: 475,
    doubleMomentumGain: 0.26,
    doubleMomentumCap: 150,
    doubleHorizontalImpulse: 142,
    doubleMaxVy: 820,
    wallRefreshSpeed: 185,
    burlBoost: 124,
    burlHorizontalBoost: 56,
    burlRadius: 82,
  });

  Object.assign(TUNE.rebound, {
    retention: 0.72,
    horizontalBonus: 22,
    verticalBase: 350,
    verticalGain: 0.55,
    verticalCap: 330,
    sweetSpotAmplitude: 0.07,
    comboSpeed: 185,
    clingGrace: 0.18,
    kickVertical: 650,
    kickHorizontal: 325,
  });

  Object.assign(TUNE.sap, {
    attachMax: 440,
    restRatio: 0.60,
    restMin: 72,
    restMax: 180,
    springK: 29,
    radialDamping: 4.2,
    pumpAccel: 1680,
    hyperPumpAccel: 2150,
    releaseStretchGain: 2.45,
    releaseCap: 340,
    releaseUpFraction: 0.48,
    comboReleaseGain: 12,
    surgeStretch: 34,
    surgeMultiplier: 1.34,
    hyperReleaseMultiplier: 1.18,
    surgeUpBonus: 100,
    snapRestScale: 0.78,
    snapTowardImpulse: 92,
    snapMinVy: 355,
    snapLiftBonus: 135,
    quickWindow: 0.24,
    quickMinVy: 610,
    quickForwardImpulse: 76,
    releaseFloorVy: 440,
  });

  Object.assign(TUNE.combo, {
    window: 3.45,
    ascentDecayScale: 0.34,
    saplineDecayScale: 0.22,
    highMomentumDecayScale: 0.62,
    hesitationSpeed: 108,
    hesitationDecayScale: 1.50,
    landingGrace: 1.55,
    recoveryBankDelay: 0.95,
    sapSurgeThreshold: 4,
    hyperThreshold: 6,
    hyperVariety: 3,
  });

  Object.assign(TUNE.ring, {
    baseRadius: 32,
    minRadius: 20,
    speedBonusStart: 260,
  });

  Object.assign(TUNE.threat, {
    baseSpeed: 24,
    timeGain: 0.36,
    floorGain: 0.20,
    targetGap: 520,
    rubberGain: 64,
    minSpeed: 18,
    maxSpeed: 178,
  });
})();
