import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance as monotonicClock } from 'node:perf_hooks';
import vm from 'node:vm';

import {
  SYLVARIA_ENGINE_VERSION,
  SYLVARIA_MAX_REPLAY_TICKS,
  SYLVARIA_OFFICIAL_SEED,
  SYLVARIA_REPLAY_SCHEMA,
  decodeSylvariaReplayEvents,
  encodeSylvariaReplayEvents,
  sylvariaReplayBytesFromBase64Url,
  sylvariaReplayBytesToBase64Url,
  validateSylvariaReplayEnvelope,
  type SylvariaReplayActionCode,
  type SylvariaReplayEnvelope,
  type SylvariaReplayEvent,
} from './replay';

const ROOT = 'public/game-runtimes/mosslight-v2';
export const SYLVARIA_AUTHORITATIVE_SOURCE_PATHS = [
  `${ROOT}/v091/model.js`,
  `${ROOT}/v011/rooms-v011.js`,
  `${ROOT}/v091/world.js`,
  `${ROOT}/v091/movement.js`,
  `${ROOT}/v091/battle-core.js`,
  `${ROOT}/v091/synergy-v010.js`,
] as const;
export const SYLVARIA_RANKED_VERIFY_MAX_WALL_MS = 8_000;

export type SylvariaReplaySummary = {
  engineVersion: typeof SYLVARIA_ENGINE_VERSION;
  engineHash: string;
  tick: number;
  ended: boolean;
  endReason: string | null;
  mode: string;
  score: number;
  worldDepth: number;
  worldsCleared: number;
  player: null | { x: number; y: number; hp: number; flow: number };
  stats: Record<string, number>;
  stateHash: string;
};

export type SylvariaReplayVerification = SylvariaReplaySummary & {
  replayHash: string;
  claimedScore: number;
};

export type SylvariaSimulationOptions = {
  allowIncomplete?: boolean;
  stopOnGameOver?: boolean;
  maxWallMs?: number;
};

type RuntimeBundle = {
  sources: Array<{ path: string; content: string }>;
  hash: string;
};

type EngineContext = {
  G: any;
  F: any;
  state: any;
  endReason: string | null;
};

let cachedBundle: RuntimeBundle | null = null;

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 1e9) / 1e9 : String(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, canonicalize(object[key])]));
  }
  return String(value);
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function loadSylvariaAuthoritativeBundle(): RuntimeBundle {
  if (cachedBundle) return cachedBundle;
  const sources = [
    { path: SYLVARIA_AUTHORITATIVE_SOURCE_PATHS[0], content: readFileSync(join(process.cwd(), 'public', 'game-runtimes', 'mosslight-v2', 'v091', 'model.js'), 'utf8') },
    { path: SYLVARIA_AUTHORITATIVE_SOURCE_PATHS[1], content: readFileSync(join(process.cwd(), 'public', 'game-runtimes', 'mosslight-v2', 'v011', 'rooms-v011.js'), 'utf8') },
    { path: SYLVARIA_AUTHORITATIVE_SOURCE_PATHS[2], content: readFileSync(join(process.cwd(), 'public', 'game-runtimes', 'mosslight-v2', 'v091', 'world.js'), 'utf8') },
    { path: SYLVARIA_AUTHORITATIVE_SOURCE_PATHS[3], content: readFileSync(join(process.cwd(), 'public', 'game-runtimes', 'mosslight-v2', 'v091', 'movement.js'), 'utf8') },
    { path: SYLVARIA_AUTHORITATIVE_SOURCE_PATHS[4], content: readFileSync(join(process.cwd(), 'public', 'game-runtimes', 'mosslight-v2', 'v091', 'battle-core.js'), 'utf8') },
    { path: SYLVARIA_AUTHORITATIVE_SOURCE_PATHS[5], content: readFileSync(join(process.cwd(), 'public', 'game-runtimes', 'mosslight-v2', 'v091', 'synergy-v010.js'), 'utf8') },
  ];
  const framed = sources.map(({ path, content }) => `${path.length}:${path}\0${content.length}:${content}`).join('\0');
  cachedBundle = { sources, hash: sha256(framed) };
  return cachedBundle;
}

export function sylvariaAuthoritativeEngineHash() {
  return loadSylvariaAuthoritativeBundle().hash;
}

function createNoopCanvasContext() {
  const gradient = { addColorStop() {} };
  const target: Record<PropertyKey, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: (text: string) => ({ width: text.length * 7 }),
  };
  return new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      const noop = () => undefined;
      object[property] = noop;
      return noop;
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    },
  });
}

function createHeadlessDocument() {
  const context = createNoopCanvasContext();
  const classList = { add() {}, remove() {}, contains() { return false; } };
  const generic = () => ({ hidden: false, textContent: '', classList, style: {}, focus() {}, addEventListener() {}, querySelectorAll() { return []; } });
  const canvas = {
    ...generic(), id: 'c', width: 960, height: 640,
    getContext: () => context,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 960, height: 640 }),
  };
  return {
    canvas,
    document: {
      getElementById(id: string) { return id === 'c' ? canvas : generic(); },
      createElement(tag: string) { return tag === 'canvas' ? { ...canvas, id: '' } : generic(); },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
  };
}

function createHeadlessEngine(): EngineContext {
  const { canvas, document } = createHeadlessDocument();
  const storage = new Map<string, string>();
  const sandbox: Record<string, any> = {
    console,
    document,
    localStorage: {
      getItem(key: string) { return storage.get(key) ?? null; },
      setItem(key: string, value: string) { storage.set(key, String(value)); },
      removeItem(key: string) { storage.delete(key); },
      clear() { storage.clear(); },
    },
    queueMicrotask(callback: () => void) { callback(); },
    setTimeout() { return 0; }, clearTimeout() {},
    Uint8Array, Uint8ClampedArray, Set, Map, Math, JSON, Date,
    performance: { now: () => 0 },
    navigator: { userAgent: 'SylvariaHeadlessVerifier/0.11.1' },
    canvas,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox, { name: 'sylvaria-headless-v0111' });

  for (const source of loadSylvariaAuthoritativeBundle().sources) {
    if (source.path.endsWith('/synergy-v010.js')) {
      const G = sandbox.Sylvaria091;
      if (!G?.fn) throw new Error('Sylvaria core modules did not initialize before synergy');
      G.fn.render ??= () => undefined;
      G.fn.updateHud ??= () => undefined;
    }
    vm.runInContext(`(()=>{\n${source.content}\n})()`, context, { filename: source.path, timeout: 1_000 });
  }

  const G = sandbox.Sylvaria091;
  if (!G?.fn || !G?.state) throw new Error('Sylvaria authoritative engine failed to initialize');
  const F = G.fn;
  const state = G.state;
  const engine: EngineContext = { G, F, state, endReason: null };
  F.endRun = (reason: string) => {
    if (state.mode === 'gameover') return;
    state.mode = 'gameover';
    engine.endReason = String(reason || 'run ended');
  };
  F.advanceRoom = () => advanceRoom(engine);
  state.mode = 'playing';
  state.runMode = 'ranked-replay';
  state.score = 0;
  state.totalTime = 0;
  state.worldsCleared = 0;
  state.stats = G.freshStats();
  F.setupRoom(1);
  state.mode = 'playing';
  return engine;
}

function advanceRoom(engine: EngineContext) {
  const { state, F } = engine;
  const alive = state.trees.filter((tree: any) => tree.alive).length;
  state.stats.treesSaved += alive;
  const perfect = alive === state.trees.length && alive > 0;
  if (perfect) {
    state.stats.fullGroves += 1;
    state.score += 220 + state.worldDepth * 20;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
    F.addCallout?.(state.player.x, state.player.y - 32, 'PERFECT GROVE · +1 HEARTWOOD', '#a6ffb4');
  }
  const carry = { hp: state.player.hp, flow: state.player.flow * 0.35 };
  state.worldsCleared += 1;
  F.setupRoom(state.worldDepth + 1, carry);
}

function applyMovementDown(engine: EngineContext, key: 'w' | 'a' | 's' | 'd') {
  const { state, F } = engine;
  if (state.heldMoves.has(key)) throw new Error(`invalid replay: repeated ${key.toUpperCase()} down while key is held`);
  state.heldMoves.add(key);
  state.heldOrder = state.heldOrder.filter((entry: string) => entry !== key);
  state.heldOrder.push(key);
  F.requestDash(key, true);
}

function applyMovementUp(engine: EngineContext, key: 'w' | 'a' | 's' | 'd') {
  const { state } = engine;
  if (!state.heldMoves.has(key)) throw new Error(`invalid replay: ${key.toUpperCase()} up without matching down`);
  state.heldMoves.delete(key);
  state.heldOrder = state.heldOrder.filter((entry: string) => entry !== key);
}

function applyAction(engine: EngineContext, action: SylvariaReplayActionCode) {
  if (engine.state.mode !== 'playing') throw new Error('invalid replay: gameplay input occurs after run end');
  switch (action) {
    case 0: applyMovementDown(engine, 'w'); break;
    case 1: applyMovementUp(engine, 'w'); break;
    case 2: applyMovementDown(engine, 'a'); break;
    case 3: applyMovementUp(engine, 'a'); break;
    case 4: applyMovementDown(engine, 's'); break;
    case 5: applyMovementUp(engine, 's'); break;
    case 6: applyMovementDown(engine, 'd'); break;
    case 7: applyMovementUp(engine, 'd'); break;
    case 8: engine.F.cut('up'); break;
    case 9: engine.F.cut('down'); break;
    case 10: engine.F.cut('left'); break;
    case 11: engine.F.cut('right'); break;
  }
}

function simulateTick(engine: EngineContext) {
  const { G, F, state } = engine;
  if (state.mode !== 'playing') return;
  const dt = G.FIXED_DT;
  state.totalTime += dt;
  state.roomTime += dt;
  if (state.slowTimer > 0) state.slowTimer -= dt;
  if (state.flash > 0) state.flash -= dt;
  state.shake = Math.max(0, state.shake - dt * 18);
  if (state.forageChainTimer > 0) state.forageChainTimer -= dt;
  else state.forageChain = 0;
  F.updateMovement(dt);
  F.updatePendingShots(dt);
  F.updateEnemies(dt);
  F.updateBoss(dt);
  F.updateShots(dt);
  F.updateSlashes(dt);
  F.updateGas(dt);
  F.updatePickups(dt);
  F.updateParticles(dt);
  if (F.roomCleared()) {
    state.roomClearTimer += dt;
    if (state.roomClearTimer > 0.8) advanceRoom(engine);
  } else state.roomClearTimer = 0;
}

function digestState(state: any) {
  const player = state.player;
  const payload = {
    mode: state.mode, worldDepth: state.worldDepth, worldsCleared: state.worldsCleared,
    score: state.score, totalTime: state.totalTime, roomTime: state.roomTime, roomClearTimer: state.roomClearTimer,
    synergyChain: state.synergyChain ?? 0, synergyTimer: state.synergyTimer ?? 0, verdantTimer: state.verdantTimer ?? 0,
    player: player ? {
      x: player.x, y: player.y, hp: player.hp, flow: player.flow,
      dashCooldown: player.dashCooldown, cutCooldown: player.cutCooldown,
      dash: player.dash ? { ...player.dash, dir: player.dash.dir ? { x: player.dash.dir.x, y: player.dash.dir.y } : null } : null,
      buffs: { ...player.buffs }, shieldCharges: player.shieldCharges,
    } : null,
    moveQueue: state.moveQueue ? { ...state.moveQueue } : null,
    heldMoves: [...state.heldMoves].sort(), heldOrder: [...state.heldOrder], stats: { ...state.stats },
    trees: state.trees.map((tree: any) => ({ id: tree.id, hp: tree.hp, alive: tree.alive, x: tree.x, y: tree.y })),
    enemies: state.enemies.map((enemy: any) => ({
      id: enemy.id, type: enemy.type, x: enemy.x, y: enemy.y, hp: enemy.hp, dead: enemy.dead,
      state: enemy.state, clock: enemy.clock, telegraph: enemy.telegraph, rngState: enemy.rngState, counterStagger: enemy.counterStagger,
    })),
    boss: state.boss ? {
      id: state.boss.id, x: state.boss.x, y: state.boss.y, hp: state.boss.hp, dead: state.boss.dead,
      phase: state.boss.phase, state: state.boss.state, clock: state.boss.clock, rngState: state.boss.rngState,
    } : null,
    terrain: state.terrain.map((patch: any) => ({ id: patch.id, type: patch.type, active: patch.active, cracked: patch.cracked, x: patch.x, y: patch.y, r: patch.r })),
    mushrooms: state.mushrooms.map((mushroom: any) => ({ id: mushroom.id, type: mushroom.type, cut: mushroom.cut, x: mushroom.x, y: mushroom.y })),
    gasClouds: state.gasClouds.map((cloud: any) => ({ x: cloud.x, y: cloud.y, r: cloud.r, maxR: cloud.maxR, life: cloud.life, type: cloud.type })),
    shots: state.shots.map((shot: any) => ({
      x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, life: shot.life, kind: shot.kind, pattern: shot.pattern,
      originPattern: shot.originPattern ?? null, friendly: shot.friendly, originalOwnerId: shot.originalOwnerId ?? null,
      counterQuality: shot.counterQuality ?? null, reflectedTravel: shot.reflectedTravel ?? 0, pierces: shot.pierces ?? 0,
    })),
  };
  return sha256(stableJson(payload));
}

function summarize(engine: EngineContext, tick: number): SylvariaReplaySummary {
  const { state } = engine;
  return {
    engineVersion: SYLVARIA_ENGINE_VERSION,
    engineHash: sylvariaAuthoritativeEngineHash(),
    tick,
    ended: state.mode === 'gameover',
    endReason: engine.endReason,
    mode: String(state.mode),
    score: Math.floor(state.score),
    worldDepth: Number(state.worldDepth),
    worldsCleared: Number(state.worldsCleared),
    player: state.player ? { x: Number(state.player.x), y: Number(state.player.y), hp: Number(state.player.hp), flow: Number(state.player.flow) } : null,
    stats: Object.fromEntries(Object.entries(state.stats).map(([key, value]) => [key, Number(value)])),
    stateHash: digestState(state),
  };
}

function assertWithinWallBudget(startedAt: number, maxWallMs: number | undefined) {
  if (maxWallMs === undefined) return;
  if (!Number.isFinite(maxWallMs) || maxWallMs < 0) throw new Error('Sylvaria replay CPU budget must be a non-negative finite number');
  if (monotonicClock.now() - startedAt > maxWallMs) throw new Error('Sylvaria replay verification exceeded CPU budget');
}

export function simulateSylvariaReplay(events: readonly SylvariaReplayEvent[], durationTicks: number, options: SylvariaSimulationOptions = {}): SylvariaReplaySummary {
  if (!Number.isSafeInteger(durationTicks) || durationTicks < 1 || durationTicks > SYLVARIA_MAX_REPLAY_TICKS) {
    throw new Error(`Sylvaria replay duration must be 1..${SYLVARIA_MAX_REPLAY_TICKS} ticks`);
  }
  const startedAt = monotonicClock.now();
  const engine = createHeadlessEngine();
  assertWithinWallBudget(startedAt, options.maxWallMs);
  let eventIndex = 0;
  let actualTick = 0;
  for (let tick = 1; tick <= durationTicks; tick += 1) {
    actualTick = tick;
    while (eventIndex < events.length && events[eventIndex].tick === tick) {
      applyAction(engine, events[eventIndex].action);
      eventIndex += 1;
    }
    if (eventIndex < events.length && events[eventIndex].tick < tick) throw new Error('replay input events are not monotonic');
    simulateTick(engine);
    if ((tick & 255) === 0) assertWithinWallBudget(startedAt, options.maxWallMs);
    if (engine.state.mode === 'gameover') {
      if (options.stopOnGameOver) break;
      if (tick !== durationTicks) throw new Error(`run ended at tick ${tick}, before declared duration ${durationTicks}`);
    }
  }
  assertWithinWallBudget(startedAt, options.maxWallMs);
  if (eventIndex !== events.length) throw new Error('replay contains input after simulated duration');
  const summary = summarize(engine, actualTick);
  if (!options.allowIncomplete && !summary.ended) throw new Error('ranked Sylvaria replay did not reach an authoritative end state');
  return summary;
}

export function verifySylvariaReplay(envelopeValue: unknown, claimedScore: number, options: SylvariaSimulationOptions = {}): SylvariaReplayVerification {
  if (!Number.isSafeInteger(claimedScore) || claimedScore < 0) throw new Error('claimed Sylvaria score must be a non-negative integer');
  const envelope = validateSylvariaReplayEnvelope(envelopeValue);
  const engineHash = sylvariaAuthoritativeEngineHash();
  if (envelope.engineHash !== engineHash) throw new Error('Sylvaria replay engine hash is not current');
  const bytes = sylvariaReplayBytesFromBase64Url(envelope.input);
  const events = decodeSylvariaReplayEvents(bytes);
  const summary = simulateSylvariaReplay(events, envelope.durationTicks, {
    ...options,
    maxWallMs: options.maxWallMs ?? SYLVARIA_RANKED_VERIFY_MAX_WALL_MS,
  });
  if (summary.score !== claimedScore) throw new Error(`claimed score ${claimedScore} does not match authoritative score ${summary.score}`);
  return { ...summary, replayHash: sha256(bytes), claimedScore };
}

export function makeSylvariaReplayEnvelope(events: readonly SylvariaReplayEvent[], durationTicks: number): SylvariaReplayEnvelope {
  return {
    schema: SYLVARIA_REPLAY_SCHEMA,
    engineVersion: SYLVARIA_ENGINE_VERSION,
    engineHash: sylvariaAuthoritativeEngineHash(),
    seed: SYLVARIA_OFFICIAL_SEED,
    durationTicks,
    input: sylvariaReplayBytesToBase64Url(encodeSylvariaReplayEvents(events)),
  };
}
