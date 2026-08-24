(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { state, player, TUNE, W, H, clamp, lerp, routeStat, recordEvent } = S;

  const ROUTE_GRAMMARS = {
    FLOW: [
      { dy: 60, side: 'same', length: 470, launch: true },
      { dy: 64, side: 'center', length: 500, ring: 'lane' },
      { dy: 66, side: 'swap', length: 430, knot: 'center' },
      { dy: 68, side: 'same', length: 420, launch: true },
      { dy: 72, side: 'swap', length: 400, ring: 'cross', knot: 'center' },
    ],
    CRUX: [
      { dy: 76, side: 'swap', length: 350, ring: 'lane' },
      { dy: 92, side: 'center', length: 360, knot: 'center', launch: true },
      { dy: 102, side: 'swap', length: 282, ring: 'crown', knot: 'cross' },
      { dy: 92, side: 'same', length: 310, knot: 'center' },
    ],
    RECOVERY: [
      { dy: 56, side: 'center', length: 560, launch: true },
      { dy: 60, side: 'same', length: 485, ring: 'lane' },
      { dy: 64, side: 'swap', length: 455, knot: 'center' },
    ],
    SLINGSHOT: [
      { dy: 70, side: 'same', length: 390, knot: 'center', ring: 'lane' },
      { dy: 86, side: 'swap', length: 330, knot: 'cross', launch: true },
      { dy: 96, side: 'center', length: 340, knot: 'center', ring: 'crown' },
      { dy: 82, side: 'swap', length: 332, knot: 'cross', ring: 'lane' },
    ],
  };

  const PHASES = [
    { name: 'ROOTWAYS', floor: 0, geometry: 0.00, pressure: 0.72, sequence: ['FLOW', 'RECOVERY', 'FLOW', 'FLOW'] },
    { name: 'REDWOOD RUN', floor: 36, geometry: 0.18, pressure: 0.88, sequence: ['FLOW', 'FLOW', 'SLINGSHOT', 'RECOVERY', 'CRUX'] },
    { name: 'SAPWORK', floor: 75, geometry: 0.40, pressure: 1.00, sequence: ['FLOW', 'SLINGSHOT', 'CRUX', 'FLOW', 'RECOVERY', 'SLINGSHOT'] },
    { name: 'HIGH CANOPY', floor: 120, geometry: 0.68, pressure: 1.12, sequence: ['CRUX', 'SLINGSHOT', 'FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT'] },
    { name: 'CROWNLINE', floor: 170, geometry: 1.00, pressure: 1.23, sequence: ['CRUX', 'SLINGSHOT', 'CRUX', 'SLINGSHOT', 'FLOW', 'CRUX', 'RECOVERY'] },
  ];

  function phaseForFloor(floor) {
    let phase = PHASES[0];
    for (const candidate of PHASES) {
      if (floor >= candidate.floor) phase = candidate;
      else break;
    }
    return phase;
  }

  function takeBranch() {
    return state.branchPool.pop() || {};
  }

  function takeKnot() {
    return state.knotPool.pop() || {};
  }

  function takeRing() {
    return state.ringPool.pop() || {};
  }

  function addBranch(floor, y, side, length, slope, chunk, launch = false) {
    const branch = takeBranch();
    branch.floor = floor;
    branch.y = y;
    branch.side = side;
    branch.slope = slope;
    branch.chunkId = chunk.id;
    branch.chunkType = chunk.type;
    branch.thickness = 9 + state.routeRng.next() * 4.5;
    branch.burl = state.routeRng.next();
    branch.launch = Boolean(launch);
    if (side === 'left') {
      branch.x1 = state.LEFT_WALL - 2;
      branch.x2 = Math.min(state.RIGHT_WALL - 48, state.LEFT_WALL + length);
      branch.launchX = branch.x2 - 32;
    } else if (side === 'right') {
      branch.x2 = state.RIGHT_WALL + 2;
      branch.x1 = Math.max(state.LEFT_WALL + 48, state.RIGHT_WALL - length);
      branch.launchX = branch.x1 + 32;
    } else {
      const half = length * 0.5;
      branch.x1 = W / 2 - half;
      branch.x2 = W / 2 + half;
      branch.launchX = W / 2;
    }
    state.branches.push(branch);
    return branch;
  }

  function knotPosition(role, side, branch) {
    const jitter = (state.routeRng.next() - 0.5) * 28;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 76 + jitter : state.LEFT_WALL + 76 + jitter,
        y: branch.y + 104 + state.routeRng.next() * 24,
      };
    }
    if (role === 'center') {
      return {
        x: W / 2 + jitter * 1.7,
        y: branch.y + 92 + state.routeRng.next() * 28,
      };
    }
    return {
      x: side === 'right' ? branch.x2 - 42 : branch.x1 + 42,
      y: branch.y + 86,
    };
  }

  function addKnot(x, y, floor, chunk, role) {
    const knot = takeKnot();
    knot.x = x;
    knot.y = y;
    knot.floor = floor;
    knot.chunkId = chunk.id;
    knot.chunkType = chunk.type;
    knot.role = role;
    knot.pulse = state.routeRng.next() * Math.PI * 2;
    state.knots.push(knot);
  }

  function ringPosition(role, side, branch) {
    const jitter = (state.routeRng.next() - 0.5) * 22;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 130 + jitter : state.LEFT_WALL + 130 + jitter,
        y: branch.y + 58 + state.routeRng.next() * 16,
      };
    }
    if (role === 'crown') {
      return {
        x: W / 2 + jitter * 1.5,
        y: branch.y + 72 + state.routeRng.next() * 18,
      };
    }
    const freeX = side === 'left' ? branch.x2 - 64 : side === 'right' ? branch.x1 + 64 : W / 2;
    return { x: freeX + jitter, y: branch.y + 52 + state.routeRng.next() * 12 };
  }

  function addRing(x, y, floor, chunk, role, difficulty) {
    const ring = takeRing();
    ring.x = x;
    ring.y = y;
    ring.floor = floor;
    ring.chunkId = chunk.id;
    ring.chunkType = chunk.type;
    ring.role = role;
    ring.hit = false;
    ring.pulse = state.routeRng.next() * Math.PI * 2;
    ring.radius = lerp(TUNE.ring.baseRadius, TUNE.ring.minRadius, difficulty);
    state.rings.push(ring);
  }

  function resolveSide(token) {
    if (token === 'center') return 'center';
    if (token === 'same') return state.lastSide;
    if (token === 'swap') {
      state.lastSide = state.lastSide === 'left' ? 'right' : 'left';
      return state.lastSide;
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
      const difficulty = clamp(Math.max(0, state.generatedFloor - 24) / 176, 0, 1);
      const geometry = Math.max(difficulty, phase.geometry * 0.84);
      const dyScale = 1 + geometry * 0.14;
      const lengthScale = 1 - geometry * 0.18;
      const yJitter = (state.routeRng.next() - 0.5) * lerp(3, 11, geometry);
      const lengthJitter = (state.routeRng.next() - 0.5) * lerp(10, 20, geometry);
      state.generatedY += step.dy * dyScale + yJitter;
      const side = resolveSide(step.side);
      const slope = (state.routeRng.next() - 0.5) * lerp(0.020, 0.084, geometry);
      const minLength = side === 'center' ? lerp(390, 310, geometry) : lerp(280, 195, geometry);
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
    const kill = state.cameraBottom - 390;
    while (state.branches.length && state.branches[0].y < kill) state.branchPool.push(state.branches.shift());
    while (state.knots.length && state.knots[0].y < kill) state.knotPool.push(state.knots.shift());
    while (state.rings.length && state.rings[0].y < kill) state.ringPool.push(state.rings.shift());
    while (state.chunks.length > 4 && state.chunks[0].endY < kill) state.chunks.shift();
    generateUntil(state.cameraBottom + H + 1040);
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
    const phase = y * 0.041 + (side === 'left' ? 0.8 : 2.4);
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
    const start = addBranch(0, 70, 'center', 610, 0, startChunk, true);
    generateUntil(H + 3300);
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