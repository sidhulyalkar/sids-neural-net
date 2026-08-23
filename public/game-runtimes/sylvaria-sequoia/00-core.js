(() => {
  'use strict';

  const canvas = document.querySelector('#c');
  const wrap = document.querySelector('#wrap');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;

  const TUNE = {
    run: {
      groundAccel: 2700,
      airAccel: 1180,
      maxSpeed: 570,
      groundFriction60Hz: 0.82,
      airDrag120Hz: 0.997,
      reverseAirScale: 0.72,
    },
    jump: {
      base: 555,
      momentumGain: 0.50,
      momentumCap: 325,
      comboLift: 9,
      cutDrag120Hz: 0.989,
      bufferSeconds: 0.10,
      coyoteSeconds: 0.09,
    },
    rebound: {
      retention: 0.915,
      horizontalBonus: 34,
      verticalBase: 175,
      verticalGain: 0.37,
      verticalCap: 305,
      sweetSpotAmplitude: 0.085,
    },
    sap: {
      attachMax: 365,
      restRatio: 0.72,
      restMin: 90,
      restMax: 205,
      springK: 24,
      radialDamping: 5.1,
      pumpAccel: 1490,
      hyperPumpAccel: 1810,
      releaseStretchGain: 2.18,
      releaseCap: 265,
      releaseUpFraction: 0.30,
    },
    combo: {
      window: 2.72,
      ascentDecayScale: 0.52,
      hesitationSpeed: 135,
      hesitationDecayScale: 1.90,
      hyperThreshold: 4,
    },
    threat: {
      baseSpeed: 37,
      timeGain: 0.48,
      floorGain: 0.22,
      targetGap: 455,
      rubberGain: 74,
      minSpeed: 26,
      maxSpeed: 172,
      burnGap: 48,
      rescueDepth: 74,
      deathDepth: 102,
      burnCooldown: 0.72,
    },
    camera: {
      verticalAnchor: 182,
      verticalLookahead: 0.088,
      horizontalLookahead: 0.020,
      maxLookahead: 96,
      follow: 4.8,
      hyperWideView: 0.028,
      speedWideView: 0.022,
    },
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const round = (value, digits = 2) => Number(value.toFixed(digits));

  function makeRng(seed) {
    let state = seed >>> 0 || 1;
    return {
      next() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 4294967296;
      },
      get seed() {
        return state >>> 0;
      },
    };
  }

  const visualRng = makeRng(0x7193bd1);
  const stars = Array.from({ length: 96 }, () => ({
    x: visualRng.next() * W,
    y: visualRng.next() * H,
    r: 0.35 + visualRng.next() * 1.35,
    alpha: 0.12 + visualRng.next() * 0.58,
    parallax: 0.12 + visualRng.next() * 0.42,
  }));

  const state = {
    FIXED_DT: 1 / 120,
    MAX_STEPS: 8,
    GRAVITY: -1900,
    LEFT_WALL: 154,
    RIGHT_WALL: 806,
    PLAYER_R: 15,
    touchMode: matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    routeRng: makeRng(0x51a7f00d),
    fxRng: makeRng(0xa51ce55),
    runSeed: 1,
    mode: 'title',
    pausedFrom: 'playing',
    accumulator: 0,
    lastTime: performance.now(),
    elapsed: 0,
    cameraBottom: -82,
    threatY: -270,
    generatedY: 70,
    generatedFloor: 0,
    routeChunkIndex: 0,
    lastSide: 'left',
    flash: 0,
    shake: 0,
    scorchCooldown: 0,
    telemetryVisible: false,
    highScore: Number(localStorage.getItem('sylvaria.sequoia.highscore') || 0),
    audio: null,
    keys: new Set(),
    pointers: new Map(),
    branches: [],
    knots: [],
    particles: [],
    messages: [],
    branchPool: [],
    knotPool: [],
    chunks: [],
    stars,
  };

  const player = {
    x: W / 2,
    y: 98,
    px: W / 2,
    py: 98,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: null,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    sapHeld: false,
    sap: null,
    wallTimer: 0,
    state: 'grounded',
    squash: 0,
    stretch: 0,
    heat: 0,
    score: 0,
    highestFloor: 0,
    lastFloor: 0,
    combo: 0,
    comboFloors: 0,
    comboTimer: 0,
    comboStartedAt: 0,
    hyper: false,
    hyperStartedAt: 0,
    resin: 0,
    saves: 0,
    bestCombo: 0,
  };

  function freshTelemetry(seed) {
    return {
      seed,
      version: '0.2.0',
      startedAt: performance.now(),
      finishedAt: null,
      counters: {
        jumps: 0,
        landings: 0,
        multiFloorSkips: 0,
        wallBounces: 0,
        sapAttempts: 0,
        sapAttaches: 0,
        sapReleases: 0,
        sapMisses: 0,
        comboBanks: 0,
        comboTimeouts: 0,
        comboDrops: 0,
        crownvelocityEntries: 0,
        momentumBurns: 0,
        sapCatches: 0,
      },
      time: {
        airborne: 0,
        grounded: 0,
        sapline: 0,
        hyper: 0,
        lowMomentum: 0,
        nearThreat: 0,
      },
      sums: {
        speed: 0,
        absVx: 0,
        threatGap: 0,
        sampleTime: 0,
      },
      maxima: {
        speed: 0,
        absVx: 0,
        upwardVy: 0,
        combo: 0,
        floor: 0,
      },
      samples: {
        airtimeDurations: [],
        jumpLaunchSpeeds: [],
        reboundRetention: [],
        reboundVerticalLift: [],
        sapReleaseGain: [],
        sapStretch: [],
        sapDurations: [],
        branchSkips: [],
        comboDurations: [],
      },
      routeStats: {},
      events: [],
      lastGrounded: true,
      airborneStartedAt: null,
      minThreatGap: Infinity,
    };
  }

  let telemetry = freshTelemetry(state.runSeed);

  function boundedPush(array, value, max = 96) {
    array.push(value);
    if (array.length > max) array.shift();
  }

  function recordEvent(type, data = {}) {
    telemetry.events.push({ t: round(state.elapsed, 3), type, ...data });
    if (telemetry.events.length > 320) telemetry.events.shift();
  }

  function routeStat(type) {
    telemetry.routeStats[type] ||= {
      generated: 0,
      attempts: 0,
      completions: 0,
      failures: 0,
      burns: 0,
      catches: 0,
      durationTotal: 0,
    };
    return telemetry.routeStats[type];
  }

  function summarizeTelemetry() {
    const activeTime = Math.max(0.001, telemetry.sums.sampleTime);
    const routeStats = Object.fromEntries(Object.entries(telemetry.routeStats).map(([name, stat]) => [name, {
      ...stat,
      completionRate: stat.attempts ? round(stat.completions / stat.attempts, 3) : 0,
      avgCompletionSeconds: stat.completions ? round(stat.durationTotal / stat.completions, 3) : 0,
    }]));
    return {
      version: telemetry.version,
      seed: telemetry.seed,
      runSeconds: round(state.elapsed, 3),
      floor: player.highestFloor,
      score: Math.floor(player.score),
      bestCombo: player.bestCombo,
      counters: { ...telemetry.counters },
      movement: {
        airborneRatio: round(telemetry.time.airborne / activeTime, 3),
        groundedRatio: round(telemetry.time.grounded / activeTime, 3),
        saplineRatio: round(telemetry.time.sapline / activeTime, 3),
        crownvelocityRatio: round(telemetry.time.hyper / activeTime, 3),
        lowMomentumRatio: round(telemetry.time.lowMomentum / activeTime, 3),
        nearThreatRatio: round(telemetry.time.nearThreat / activeTime, 3),
        avgSpeed: round(telemetry.sums.speed / activeTime, 1),
        avgAbsVx: round(telemetry.sums.absVx / activeTime, 1),
        peakSpeed: round(telemetry.maxima.speed, 1),
        peakAbsVx: round(telemetry.maxima.absVx, 1),
        peakUpwardVy: round(telemetry.maxima.upwardVy, 1),
        avgAirtimeSeconds: round(mean(telemetry.samples.airtimeDurations), 3),
        minThreatGap: Number.isFinite(telemetry.minThreatGap) ? round(telemetry.minThreatGap, 1) : null,
        avgThreatGap: round(telemetry.sums.threatGap / activeTime, 1),
      },
      rebound: {
        avgRetention: round(mean(telemetry.samples.reboundRetention), 3),
        avgVerticalLift: round(mean(telemetry.samples.reboundVerticalLift), 1),
      },
      sapline: {
        attachRate: telemetry.counters.sapAttempts ? round(telemetry.counters.sapAttaches / telemetry.counters.sapAttempts, 3) : 0,
        avgReleaseSpeedGain: round(mean(telemetry.samples.sapReleaseGain), 1),
        avgMaxStretch: round(mean(telemetry.samples.sapStretch), 1),
        avgAttachedSeconds: round(mean(telemetry.samples.sapDurations), 3),
      },
      combo: {
        avgSkipFloors: round(mean(telemetry.samples.branchSkips), 2),
        avgComboSeconds: round(mean(telemetry.samples.comboDurations), 3),
        maxCombo: telemetry.maxima.combo,
      },
      routeStats,
      tuning: JSON.parse(JSON.stringify(TUNE)),
      events: [...telemetry.events],
    };
  }

  function replaceTelemetry(seed) {
    telemetry = freshTelemetry(seed);
  }

  function tone(freq, duration = 0.07, gain = 0.035, type = 'sine', slide = 1) {
    try {
      if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
      if (state.audio.state === 'suspended') state.audio.resume();
      const oscillator = state.audio.createOscillator();
      const amp = state.audio.createGain();
      const now = state.audio.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(38, freq * slide), now + duration);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(amp).connect(state.audio.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.025);
    } catch {}
  }

  function crownDrop() {
    tone(74, 0.24, 0.07, 'sine', 0.62);
    setTimeout(() => tone(148, 0.13, 0.045, 'triangle', 1.35), 35);
    setTimeout(() => tone(296, 0.10, 0.028, 'sine', 1.15), 80);
  }

  function announce(text, life = 1.0, size = 18) {
    state.messages.push({ text, life, maxLife: life, size });
    if (state.messages.length > 8) state.messages.shift();
  }

  function burst(x, y, count, kind = 'leaf', power = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = state.fxRng.next() * Math.PI * 2;
      const speed = (65 + state.fxRng.next() * 245) * power;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 70,
        life: 0.32 + state.fxRng.next() * 0.58,
        maxLife: 0.9,
        r: 1.4 + state.fxRng.next() * 4,
        kind,
      });
    }
    if (state.particles.length > 280) state.particles.splice(0, state.particles.length - 280);
  }

  function setTuning(section, key, value) {
    if (!Object.prototype.hasOwnProperty.call(TUNE, section)) return false;
    if (!Object.prototype.hasOwnProperty.call(TUNE[section], key)) return false;
    if (typeof TUNE[section][key] !== 'number' || !Number.isFinite(value)) return false;
    TUNE[section][key] = Number(value);
    recordEvent('tuning-change', { section, key, value: Number(value) });
    return true;
  }

  window.SylvariaSequoia = {
    canvas,
    wrap,
    ctx,
    W,
    H,
    TUNE,
    state,
    player,
    clamp,
    lerp,
    mean,
    round,
    makeRng,
    boundedPush,
    recordEvent,
    routeStat,
    summarizeTelemetry,
    replaceTelemetry,
    getTelemetry: () => telemetry,
    tone,
    crownDrop,
    announce,
    burst,
    setTuning,
  };
})();
