(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { state, player, TUNE, W, H, clamp, lerp, routeStat, recordEvent } = S;

  // Give the twin-sequoia arena more breathing room. The physical bark walls
  // remain honest collision surfaces, but the interior now reads as a forest
  // shaft rather than a narrow pinball lane.
  state.LEFT_WALL = 118;
  state.RIGHT_WALL = 842;

  const ROUTE_GRAMMARS = {
    FLOW: [
      { dy: 58, side: 'center', length: 520, launch: true },
      { dy: 70, side: 'same', length: 405, ring: 'lane' },
      { dy: 68, side: 'swap', length: 390 },
      { dy: 80, side: 'center', length: 455, knot: 'center' },
      { dy: 76, side: 'same', length: 370, ring: 'cross', knot: 'center' },
    ],
    GROVE: [
      { dy: 64, side: 'center', length: 610, launch: true },
      { dy: 94, side: 'left', length: 300, ring: 'cross' },
      { dy: 102, side: 'right', length: 300, knot: 'cross' },
      { dy: 84, side: 'center', length: 560, ring: 'crown', knot: 'center' },
    ],
    CRUX: [
      { dy: 82, side: 'same', length: 350, ring: 'lane' },
      { dy: 96, side: 'swap', length: 315, knot: 'center', launch: true },
      { dy: 110, side: 'center', length: 335, ring: 'crown', knot: 'cross' },
      { dy: 98, side: 'same', length: 295, knot: 'center' },
    ],
    RECOVERY: [
      { dy: 56, side: 'center', length: 560, launch: true },
      { dy: 64, side: 'same', length: 430, ring: 'lane' },
      { dy: 62, side: 'center', length: 510, knot: 'center' },
    ],
    SLINGSHOT: [
      { dy: 74, side: 'same', length: 385, knot: 'center', ring: 'lane' },
      { dy: 90, side: 'swap', length: 335, knot: 'cross', launch: true },
      { dy: 104, side: 'center', length: 350, knot: 'center', ring: 'crown' },
      { dy: 92, side: 'same', length: 325, knot: 'cross', ring: 'lane' },
    ],
  };

  const PHASES = [
    { name: 'ROOTWAYS', floor: 0, geometry: 0.04, pressure: 0.72, sequence: ['FLOW', 'RECOVERY', 'FLOW', 'GROVE'] },
    { name: 'REDWOOD RUN', floor: 30, geometry: 0.22, pressure: 0.90, sequence: ['FLOW', 'GROVE', 'SLINGSHOT', 'RECOVERY', 'CRUX'] },
    { name: 'SAPWORK', floor: 70, geometry: 0.44, pressure: 1.00, sequence: ['GROVE', 'SLINGSHOT', 'FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT'] },
    { name: 'HIGH CANOPY', floor: 115, geometry: 0.70, pressure: 1.12, sequence: ['CRUX', 'GROVE', 'SLINGSHOT', 'CRUX', 'RECOVERY', 'FLOW'] },
    { name: 'CROWNLINE', floor: 165, geometry: 1.00, pressure: 1.24, sequence: ['CRUX', 'SLINGSHOT', 'GROVE', 'CRUX', 'SLINGSHOT', 'RECOVERY'] },
  ];

  function phaseForFloor(floor) {
    let phase = PHASES[0];
    for (const candidate of PHASES) {
      if (floor >= candidate.floor) phase = candidate;
      else break;
    }
    return phase;
  }

  function takeBranch() { return state.branchPool.pop() || {}; }
  function takeKnot() { return state.knotPool.pop() || {}; }
  function takeRing() { return state.ringPool.pop() || {}; }

  function addBranch(floor, y, side, length, slope, chunk, launch = false) {
    const branch = takeBranch();
    branch.floor = floor;
    branch.y = y;
    branch.side = side;
    branch.slope = slope;
    branch.chunkId = chunk.id;
    branch.chunkType = chunk.type;
    branch.thickness = 10 + state.routeRng.next() * 5.2;
    branch.burl = state.routeRng.next();
    branch.launch = Boolean(launch);
    if (side === 'left') {
      branch.x1 = state.LEFT_WALL - 3;
      branch.x2 = Math.min(state.RIGHT_WALL - 62, state.LEFT_WALL + length);
      branch.launchX = branch.x2 - 40;
    } else if (side === 'right') {
      branch.x2 = state.RIGHT_WALL + 3;
      branch.x1 = Math.max(state.LEFT_WALL + 62, state.RIGHT_WALL - length);
      branch.launchX = branch.x1 + 40;
    } else {
      const half = Math.min(length, state.RIGHT_WALL - state.LEFT_WALL - 28) * 0.5;
      branch.x1 = W / 2 - half;
      branch.x2 = W / 2 + half;
      branch.launchX = W / 2 + (state.routeRng.next() - 0.5) * Math.min(120, half * 0.45);
    }
    state.branches.push(branch);
    return branch;
  }

  function knotPosition(role, side, branch) {
    const jitter = (state.routeRng.next() - 0.5) * 32;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 104 + jitter : state.LEFT_WALL + 104 + jitter,
        y: branch.y + 112 + state.routeRng.next() * 28,
      };
    }
    if (role === 'center') {
      return { x: W / 2 + jitter * 1.8, y: branch.y + 94 + state.routeRng.next() * 30 };
    }
    return { x: side === 'right' ? branch.x2 - 52 : branch.x1 + 52, y: branch.y + 90 };
  }

  function addKnot(x, y, floor, chunk, role) {
    const knot = takeKnot();
    Object.assign(knot, {
      x, y, floor, chunkId: chunk.id, chunkType: chunk.type, role,
      pulse: state.routeRng.next() * Math.PI * 2,
    });
    state.knots.push(knot);
  }

  function ringPosition(role, side, branch) {
    const jitter = (state.routeRng.next() - 0.5) * 28;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 155 + jitter : state.LEFT_WALL + 155 + jitter,
        y: branch.y + 64 + state.routeRng.next() * 18,
      };
    }
    if (role === 'crown') {
      return { x: W / 2 + jitter * 1.7, y: branch.y + 78 + state.routeRng.next() * 20 };
    }
    const freeX = side === 'left' ? branch.x2 - 82 : side === 'right' ? branch.x1 + 82 : W / 2;
    return { x: freeX + jitter, y: branch.y + 56 + state.routeRng.next() * 14 };
  }

  function addRing(x, y, floor, chunk, role, difficulty) {
    const ring = takeRing();
    Object.assign(ring, {
      x, y, floor, chunkId: chunk.id, chunkType: chunk.type, role, hit: false,
      pulse: state.routeRng.next() * Math.PI * 2,
      radius: lerp(TUNE.ring.baseRadius, TUNE.ring.minRadius, difficulty),
    });
    state.rings.push(ring);
  }

  function resolveSide(token) {
    if (token === 'center') return 'center';
    if (token === 'same') return state.lastSide;
    if (token === 'swap') {
      state.lastSide = state.lastSide === 'left' ? 'right' : 'left';
      return state.lastSide;
    }
    if (token === 'left' || token === 'right') {
      state.lastSide = token;
      return token;
    }
    return token;
  }

  function routeTypeForChunk() {
    const phase = phaseForFloor(state.generatedFloor);
    return phase.sequence[state.routeChunkIndex % phase.sequence.length];
  }

  function generateChunk() {
    const type = routeTypeForChunk();
    state.routeChunkIndex += 1;
    const grammar = ROUTE_GRAMMARS[type];
    const startFloor = state.generatedFloor + 1;
    const chunk = {
      id: `${state.routeChunkIndex}-${type}`,
      type,
      phase: phaseForFloor(startFloor).name,
      startFloor,
      endFloor: startFloor + grammar.length - 1,
      startY: state.generatedY,
      endY: state.generatedY,
      attempted: false,
      completed: false,
      failed: false,
      attemptStartedAt: 0,
    };
    state.chunks.push(chunk);
    routeStat(type).generated += 1;

    for (const step of grammar) {
      state.generatedFloor += 1;
      const phase = phaseForFloor(state.generatedFloor);
      const difficulty = clamp(Math.max(0, state.generatedFloor - 26) / 160, 0, 1);
      const geometry = Math.max(difficulty, phase.geometry * 0.82);
      const dyScale = 1 + geometry * 0.12;
      const lengthScale = 1 - geometry * 0.16;
      const yJitter = (state.routeRng.next() - 0.5) * lerp(3, 12, geometry);
      const lengthJitter = (state.routeRng.next() - 0.5) * lerp(10, 24, geometry);
      state.generatedY += step.dy * dyScale + yJitter;
      const side = resolveSide(step.side);
      const slope = (state.routeRng.next() - 0.5) * lerp(0.022, 0.095, geometry);
      const minLength = side === 'center' ? lerp(390, 275, geometry) : lerp(270, 185, geometry);
      const length = Math.max(minLength, step.length * lengthScale + lengthJitter);
      const branch = addBranch(state.generatedFloor, state.generatedY, side, length, slope, chunk, step.launch);
      if (step.knot) {
        const pos = knotPosition(step.knot, side, branch);
        addKnot(pos.x, pos.y, state.generatedFloor, chunk, step.knot);
      }
      if (step.ring) {
        const pos = ringPosition(step.ring, side, branch);
        addRing(pos.x, pos.y, state.generatedFloor, chunk, step.ring, geometry);
      }
    }
    chunk.endY = state.generatedY;
  }

  function generateUntil(worldY) {
    while (state.generatedY < worldY) generateChunk();
  }

  function recycleWorld() {
    const kill = state.cameraBottom - 420;
    while (state.branches.length && state.branches[0].y < kill) state.branchPool.push(state.branches.shift());
    while (state.knots.length && state.knots[0].y < kill) state.knotPool.push(state.knots.shift());
    while (state.rings.length && state.rings[0].y < kill) state.ringPool.push(state.rings.shift());
    while (state.chunks.length > 5 && state.chunks[0].endY < kill) state.chunks.shift();
    generateUntil(state.cameraBottom + H + 1180);
  }

  function branchYAt(branch, x) {
    const mid = (branch.x1 + branch.x2) * 0.5;
    return branch.y + (x - mid) * branch.slope;
  }

  function markRouteProgress(floor) {
    for (const chunk of state.chunks) {
      if (!chunk.attempted && floor >= chunk.startFloor) {
        chunk.attempted = true;
        chunk.attemptStartedAt = state.elapsed;
        routeStat(chunk.type).attempts += 1;
        recordEvent('route-enter', { route: chunk.type, phase: chunk.phase, id: chunk.id });
      }
      if (chunk.attempted && !chunk.completed && floor >= chunk.endFloor) {
        chunk.completed = true;
        const duration = Math.max(0, state.elapsed - chunk.attemptStartedAt);
        const stat = routeStat(chunk.type);
        stat.completions += 1;
        stat.durationTotal += duration;
        recordEvent('route-complete', { route: chunk.type, phase: chunk.phase, id: chunk.id, seconds: S.round(duration, 3) });
      }
    }
  }

  function activeRouteChunk() {
    return state.chunks.find((chunk) => player.highestFloor >= chunk.startFloor && player.highestFloor <= chunk.endFloor) || null;
  }

  function barkSweetness(y, side) {
    const phase = y * 0.033 + (side === 'left' ? 0.7 : 2.1);
    return 1 + Math.sin(phase) * TUNE.rebound.sweetSpotAmplitude;
  }

  function resetWorld(seed) {
    state.routeRng = S.makeRng((0x51a7f00d ^ Math.imul(seed, 2654435761)) >>> 0);
    state.fxRng = S.makeRng((0xa51ce55 ^ Math.imul(seed + 19, 2246822519)) >>> 0);
    state.branches.splice(0).forEach((item) => state.branchPool.push(item));
    state.knots.splice(0).forEach((item) => state.knotPool.push(item));
    state.rings.splice(0).forEach((item) => state.ringPool.push(item));
    state.chunks.length = 0;
    state.generatedY = 70;
    state.generatedFloor = 0;
    state.routeChunkIndex = 0;
    state.lastSide = 'left';
    const startChunk = { id: 'start', type: 'RECOVERY', phase: 'ROOTWAYS', startFloor: 0, endFloor: 0 };
    const start = addBranch(0, 70, 'center', 560, 0, startChunk, true);
    generateUntil(H + 3600);
    return start;
  }

  S.ROUTE_GRAMMARS = ROUTE_GRAMMARS;
  S.PHASES = PHASES;
  S.phaseForFloor = phaseForFloor;
  S.addBranch = addBranch;
  S.generateUntil = generateUntil;
  S.recycleWorld = recycleWorld;
  S.branchYAt = branchYAt;
  S.markRouteProgress = markRouteProgress;
  S.activeRouteChunk = activeRouteChunk;
  S.barkSweetness = barkSweetness;
  S.resetWorld = resetWorld;
})();
