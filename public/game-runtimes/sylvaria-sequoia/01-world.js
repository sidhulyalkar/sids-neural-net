(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { state, player, TUNE, W, H, clamp, lerp, routeStat, recordEvent } = S;

  const ROUTE_GRAMMARS = {
    FLOW: [
      { dy: 72, side: 'swap', length: 410, launch: true },
      { dy: 76, side: 'swap', length: 390, ring: 'lane' },
      { dy: 80, side: 'swap', length: 365, knot: 'center' },
      { dy: 80, side: 'swap', length: 360, launch: true },
      { dy: 84, side: 'swap', length: 345, ring: 'cross', knot: 'cross' },
    ],
    CRUX: [
      { dy: 84, side: 'swap', length: 310, ring: 'lane' },
      { dy: 106, side: 'swap', length: 260, knot: 'cross', launch: true },
      { dy: 118, side: 'swap', length: 225, ring: 'crown', knot: 'center' },
      { dy: 102, side: 'swap', length: 278, knot: 'cross' },
    ],
    RECOVERY: [
      { dy: 70, side: 'center', length: 520, launch: true },
      { dy: 72, side: 'swap', length: 438, ring: 'lane' },
      { dy: 76, side: 'swap', length: 408, knot: 'center' },
    ],
    SLINGSHOT: [
      { dy: 84, side: 'swap', length: 336, knot: 'cross', ring: 'lane' },
      { dy: 114, side: 'swap', length: 250, knot: 'center', launch: true },
      { dy: 116, side: 'swap', length: 236, knot: 'cross', ring: 'crown' },
      { dy: 94, side: 'swap', length: 300, knot: 'center', ring: 'cross' },
    ],
  };

  const PHASES = [
    { name: 'ROOTWAYS', floor: 0, geometry: 0.00, pressure: 0.88, sequence: ['FLOW', 'RECOVERY', 'FLOW', 'SLINGSHOT'] },
    { name: 'REDWOOD RUN', floor: 24, geometry: 0.22, pressure: 0.98, sequence: ['FLOW', 'FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT'] },
    { name: 'SAPWORK', floor: 60, geometry: 0.45, pressure: 1.06, sequence: ['FLOW', 'SLINGSHOT', 'CRUX', 'FLOW', 'RECOVERY', 'CRUX'] },
    { name: 'HIGH CANOPY', floor: 105, geometry: 0.70, pressure: 1.14, sequence: ['CRUX', 'SLINGSHOT', 'FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT'] },
    { name: 'CROWNLINE', floor: 155, geometry: 1.00, pressure: 1.23, sequence: ['CRUX', 'SLINGSHOT', 'CRUX', 'SLINGSHOT', 'FLOW', 'CRUX', 'RECOVERY'] },
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
    const jitter = (state.routeRng.next() - 0.5) * 34;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 54 + jitter : state.LEFT_WALL + 54 + jitter,
        y: branch.y + 112 + state.routeRng.next() * 28,
      };
    }
    if (role === 'center') {
      return {
        x: W / 2 + jitter * 2,
        y: branch.y + 102 + state.routeRng.next() * 34,
      };
    }
    return {
      x: side === 'right' ? branch.x2 - 36 : branch.x1 + 36,
      y: branch.y + 92,
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
    const jitter = (state.routeRng.next() - 0.5) * 24;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 118 + jitter : state.LEFT_WALL + 118 + jitter,
        y: branch.y + 62 + state.routeRng.next() * 18,
      };
    }
    if (role === 'crown') {
      return {
        x: W / 2 + jitter * 1.7,
        y: branch.y + 78 + state.routeRng.next() * 20,
      };
    }
    const freeX = side === 'left' ? branch.x2 - 58 : side === 'right' ? branch.x1 + 58 : W / 2;
    return { x: freeX + jitter, y: branch.y + 56 + state.routeRng.next() * 14 };
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
      const difficulty = clamp(state.generatedFloor / 180, 0, 1);
      const geometry = Math.max(difficulty, phase.geometry * 0.88);
      const dyScale = 1 + geometry * 0.13;
      const lengthScale = 1 - geometry * 0.17;
      const yJitter = (state.routeRng.next() - 0.5) * lerp(6, 12, geometry);
      const lengthJitter = (state.routeRng.next() - 0.5) * 18;
      state.generatedY += step.dy * dyScale + yJitter;
      const side = resolveSide(step.side);
      const slope = (state.routeRng.next() - 0.5) * lerp(0.032, 0.088, geometry);
      const minLength = side === 'center' ? lerp(350, 310, geometry) : lerp(215, 192, geometry);
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
    const start = addBranch(0, 70, 'center', 570, 0, startChunk, true);
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
