import type { FrontierItem, FrontierLaneId } from '../types';
import { normalizeVector } from '../vector/math';
import {
  FRONTIER_SEQUENCE_DIMENSION,
  emptySequenceState,
  updateSequenceState,
  type FrontierSequenceState,
} from '../vector/sequenceModel';

export const FRONTIER_TRAJECTORY_EVENT = 'frontier:trajectory-update';
export const FRONTIER_TRAJECTORY_CHANNEL = 'frontier-trajectories-v1';

const DB_NAME = 'frontier-parallel-trajectories-v1';
const DB_VERSION = 1;
const STORE = 'trajectories';
const ACTIVE_CONTEXT_MAX_AGE_MS = 36 * 60 * 60_000;

export const FRONTIER_TRAJECTORY_CONTEXTS = [
  'research',
  'algorithms',
  'spectator-sports',
  'outdoor-motion',
  'games',
  'music',
  'culture',
] as const;

export type FrontierTrajectoryContext = (typeof FRONTIER_TRAJECTORY_CONTEXTS)[number];

const LANE_CONTEXT: Record<FrontierLaneId, FrontierTrajectoryContext> = {
  must_know: 'research',
  ml_data: 'research',
  ai_frontier: 'research',
  neuro_frontier: 'research',
  methods: 'algorithms',
  builder_signal: 'algorithms',
  competitions: 'algorithms',
  broad_science: 'research',
  creative_tech: 'algorithms',
  world_pulse: 'research',
  premier_league: 'spectator-sports',
  world_soccer: 'spectator-sports',
  team_pulse: 'spectator-sports',
  sports: 'outdoor-motion',
  gaming: 'games',
  screen: 'culture',
  music: 'music',
  internet_culture: 'culture',
  life: 'outdoor-motion',
  wildcards: 'culture',
};

export type FrontierTrajectoryRecord = FrontierSequenceState & {
  context: FrontierTrajectoryContext;
};

type StoredTrajectoryRecord = {
  context: FrontierTrajectoryContext;
  state: ArrayBuffer;
  target: ArrayBuffer;
  updatedAt: number;
  interactions: number;
};

export type FrontierTrajectoryMap = Partial<Record<FrontierTrajectoryContext, FrontierTrajectoryRecord>>;

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openTrajectoryDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'context' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = undefined;
      reject(request.error ?? new Error('Unable to open FRONTIER trajectory store'));
    };
  });
  return dbPromise;
}

function fromStored(record: StoredTrajectoryRecord): FrontierTrajectoryRecord {
  const state = new Float32Array(record.state);
  const target = new Float32Array(record.target);
  return {
    context: record.context,
    state: state.length === FRONTIER_SEQUENCE_DIMENSION ? state : emptySequenceState(record.updatedAt).state,
    target: normalizeVector(target),
    updatedAt: record.updatedAt,
    interactions: Math.max(0, Math.floor(record.interactions)),
  };
}

function toStored(record: FrontierTrajectoryRecord): StoredTrajectoryRecord {
  return {
    context: record.context,
    state: record.state.slice().buffer as ArrayBuffer,
    target: record.target.slice().buffer as ArrayBuffer,
    updatedAt: record.updatedAt,
    interactions: record.interactions,
  };
}

function publishTrajectoryUpdate(context: FrontierTrajectoryContext): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRONTIER_TRAJECTORY_EVENT, { detail: context }));
  }
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(FRONTIER_TRAJECTORY_CHANNEL);
      channel.postMessage({ type: 'changed', context, at: Date.now() });
      channel.close();
    } catch {}
  }
}

export function listenFrontierTrajectoryChanges(callback: (context?: FrontierTrajectoryContext) => void): () => void {
  const onWindow = (event: Event) => callback((event as CustomEvent<FrontierTrajectoryContext>).detail);
  if (typeof window !== 'undefined') window.addEventListener(FRONTIER_TRAJECTORY_EVENT, onWindow);
  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(FRONTIER_TRAJECTORY_CHANNEL);
      channel.onmessage = (event: MessageEvent<{ context?: FrontierTrajectoryContext }>) => callback(event.data?.context);
    } catch {}
  }
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener(FRONTIER_TRAJECTORY_EVENT, onWindow);
    channel?.close();
  };
}

export function frontierTrajectoryContextForLane(lane: FrontierLaneId): FrontierTrajectoryContext {
  return LANE_CONTEXT[lane];
}

export function frontierTrajectoryContextForItem(item: Pick<FrontierItem, 'lane'>): FrontierTrajectoryContext {
  return frontierTrajectoryContextForLane(item.lane);
}

export async function listFrontierTrajectories(): Promise<FrontierTrajectoryMap> {
  if (typeof indexedDB === 'undefined') return {};
  try {
    const db = await openTrajectoryDb();
    const transaction = db.transaction(STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await requestPromise(transaction.objectStore(STORE).getAll()) as StoredTrajectoryRecord[];
    await done;
    return Object.fromEntries(records.map((record) => [record.context, fromStored(record)])) as FrontierTrajectoryMap;
  } catch {
    return {};
  }
}

export async function updateFrontierTrajectory(
  item: Pick<FrontierItem, 'lane'>,
  vector: Float32Array,
  weight: number,
  now = Date.now()
): Promise<FrontierTrajectoryRecord | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  const context = frontierTrajectoryContextForItem(item);
  try {
    const db = await openTrajectoryDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const stored = await requestPromise(store.get(context)) as StoredTrajectoryRecord | undefined;
    const previous = stored ? fromStored(stored) : undefined;
    const nextSequence = updateSequenceState(previous, vector, weight, now);
    const next: FrontierTrajectoryRecord = { context, ...nextSequence };
    store.put(toStored(next));
    await done;
    publishTrajectoryUpdate(context);
    return next;
  } catch {
    return undefined;
  }
}

export function frontierTrajectoryTarget(
  item: Pick<FrontierItem, 'lane'>,
  trajectories: FrontierTrajectoryMap,
  fallback: Float32Array | undefined,
  now = Date.now()
): Float32Array | undefined {
  const trajectory = trajectories[frontierTrajectoryContextForItem(item)];
  if (!trajectory?.target.length || now - trajectory.updatedAt > ACTIVE_CONTEXT_MAX_AGE_MS) return fallback;
  if (!fallback?.length || trajectory.interactions >= 3) return trajectory.target;
  const alpha = trajectory.interactions === 1 ? 0.62 : 0.82;
  const length = Math.min(trajectory.target.length, fallback.length);
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    output[index] = trajectory.target[index] * alpha + fallback[index] * (1 - alpha);
  }
  return normalizeVector(output);
}

export function frontierTrajectoryState(
  item: Pick<FrontierItem, 'lane'>,
  trajectories: FrontierTrajectoryMap,
  fallback: Float32Array | undefined,
  now = Date.now()
): Float32Array | undefined {
  const trajectory = trajectories[frontierTrajectoryContextForItem(item)];
  if (!trajectory?.state.length || now - trajectory.updatedAt > ACTIVE_CONTEXT_MAX_AGE_MS) return fallback;
  return trajectory.state;
}

export async function clearFrontierTrajectories(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openTrajectoryDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).clear();
    await done;
    for (const context of FRONTIER_TRAJECTORY_CONTEXTS) publishTrajectoryUpdate(context);
  } catch {}
}
