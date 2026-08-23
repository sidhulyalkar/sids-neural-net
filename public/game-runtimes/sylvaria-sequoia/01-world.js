(() => {
  'use strict';
  const S = window.SylvariaSequoia;
  const { state, player, TUNE, W, H, clamp, lerp, routeStat, recordEvent } = S;

  const ROUTE_GRAMMARS = {
    FLOW: [
      { dy: 76, side: 'swap', length: 395 },
      { dy: 78, side: 'swap', length: 375 },
      { dy: 82, side: 'swap', length: 355, knot: 'center' },
      { dy: 80, side: 'swap', length: 365 },
      { dy: 84, side: 'swap', length: 340, knot: 'cross' },
    ],
    CRUX: [
      { dy: 82, side: 'swap', length: 305 },
      { dy: 104, side: 'swap', length: 255, knot: 'cross' },
      { dy: 116, side: 'swap', length: 220, knot: 'center' },
      { dy: 98, side: 'swap', length: 275, knot: 'cross' },
    ],
    RECOVERY: [
      { dy: 72, side: 'center', length: 505 },
      { dy: 74, side: 'swap', length: 420 },
      { dy: 76, side: 'swap', length: 395, knot: 'center' },
    ],
    SLINGSHOT: [
      { dy: 86, side: 'swap', length: 330, knot: 'cross' },
      { dy: 116, side: 'swap', length: 235, knot: 'center' },
      { dy: 112, side: 'swap', length: 230, knot: 'cross' },
      { dy: 92, side: 'swap', length: 295, knot: 'center' },
    ],
  };

  const ROUTE_SEQUENCE = ['FLOW', 'FLOW', 'CRUX', 'RECOVERY', 'FLOW', 'SLINGSHOT', 'CRUX', 'RECOVERY'];

  function takeBranch() {
    return state.branchPool.pop() || {};
  }

  function takeKnot() {
    return state.knotPool.pop() || {};
  }

  function addBranch(floor, y, side, length, slope, chunk) {
    const branch = takeBranch();
    branch.floor = floor;
    branch.y = y;
    branch.side = side;
    branch.slope = slope;
    branch.chunkId = chunk.id;
    branch.chunkType = chunk.type;
    branch.thickness = 9 + state.routeRng.next() * 4.5;
    branch.burl = state.routeRng.next();
    if (side === 'left') {
      branch.x1 = state.LEFT_WALL - 2;
      branch.x2 = Math.min(state.RIGHT_WALL - 48, state.LEFT_WALL + length);
    } else if (side === 'right') {
      branch.x2 = state.RIGHT_WALL + 2;
      branch.x1 = Math.max(state.LEFT_WALL + 48, state.RIGHT_WALL - length);
    } else {
      const half = length * 0.5;
      branch.x1 = W / 2 - half;
      branch.x2 = W / 2 + half;
    }
    state.branches.push(branch);
    return branch;
  }

  function knotPosition(role, side, branch) {
    const jitter = (state.routeRng.next() - 0.5) * 34;
    if (role === 'cross') {
      return {
        x: side === 'left' ? state.RIGHT_WALL - 52 + jitter : state.LEFT_WALL + 52 + jitter,
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

  function resolveSide(token) {
    if (token === 'center') return 'center';
    if (token === 'same') return state.lastSide;
    if (token === 'swap') {
      state.lastSide = state.lastSide === 'left' ? 'right' : 'left';
      return state.lastSide;
    }
    return token;
  }

  function generateChunk() {
    const type = ROUTE_SEQUENCE[state.routeChunkIndex % ROUTE_SEQUENCE.length];
    state.routeChunkIndex += 1;
    const grammar = ROUTE_GRAMMARS[type];
    const startFloor = state.generatedFloor + 1;
    const chunk = {
      id: `${state.routeChunkIndex}-${type}`,
      type,
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
      const difficulty = clamp(state.generatedFloor / 220, 0, 1);
      const dyScale = 1 + difficulty * 0.095;
      const lengthScale = 1 - difficulty * 0.115;
      const yJitter = (state.routeRng.next() - 0.5) * 8;
      const lengthJitter = (state.routeRng.next() - 0.5) * 18;
      state.generatedY += step.dy * dyScale + yJitter;
      const side = resolveSide(step.side);
      const slope = (state.routeRng.next() - 0.5) * lerp(0.035, 0.075, difficulty);
      const length = Math.max(side === 'center' ? 330 : 200, step.length * lengthScale + lengthJitter);
      const branch = addBranch(state.generatedFloor, state.generatedY, side, length, slope, chunk);
      if (step.knot) {
        const pos = knotPosition(step.knot, side, branch);
        addKnot(pos.x, pos.y, state.generatedFloor, chunk, step.knot);
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
    while (state.chunks.length > 3 && state.chunks[0].endY < kill) state.chunks.shift();
    generateUntil(state.cameraBottom + H + 980);
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
        recordEvent('route-enter', { route: chunk.type, id: chunk.id });
      }
      if (chunk.attempted && !chunk.completed && floor >= chunk.endFloor) {
        chunk.completed = true;
        const duration = Math.max(0, state.elapsed - chunk.attemptStartedAt);
        const stat = routeStat(chunk.type);
        stat.completions += 1;
        stat.durationTotal += duration;
        recordEvent('route-complete', { route: chunk.type, id: chunk.id, seconds: S.round(duration, 3) });
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
    state.chunks.length = 0;
    state.generatedY = 70;
    state.generatedFloor = 0;
    state.routeChunkIndex = 0;
    state.lastSide = 'left';
    const startChunk = { id: 'start', type: 'RECOVERY', startFloor: 0, endFloor: 0 };
    const start = addBranch(0, 70, 'center', 570, 0, startChunk);
    generateUntil(H + 1080);
    return start;
  }

  S.ROUTE_GRAMMARS = ROUTE_GRAMMARS;
  S.ROUTE_SEQUENCE = ROUTE_SEQUENCE;
  S.addBranch = addBranch;
  S.generateUntil = generateUntil;
  S.recycleWorld = recycleWorld;
  S.branchYAt = branchYAt;
  S.markRouteProgress = markRouteProgress;
  S.activeRouteChunk = activeRouteChunk;
  S.barkSweetness = barkSweetness;
  S.resetWorld = resetWorld;
})();
