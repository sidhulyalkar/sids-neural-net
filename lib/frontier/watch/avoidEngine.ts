import { cosineSimilarity, FRONTIER_VECTOR_DIMENSION, normalizeVector } from '../vector/math';
import type { FrontierIntentEmbeddingBackend } from './intentEngine';

export const FRONTIER_AVOID_EVENT = 'frontier:avoid-anchors';
export const FRONTIER_AVOID_CHANNEL = 'frontier-avoid-anchors-v1';
export const FRONTIER_AVOID_THRESHOLD = 0.74;
export const FRONTIER_AVOID_MAX_PENALTY = 0.34;

const DB_NAME = 'frontier-avoid-anchors-v1';
const DB_VERSION = 1;
const STORE = 'avoid_anchors';
const MAX_ANCHORS = 48;

export type FrontierAvoidAnchor = {
  id: string;
  label: string;
  vector: Float32Array;
  embeddingBackend: FrontierIntentEmbeddingBackend;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

type StoredAvoidAnchor = Omit<FrontierAvoidAnchor, 'vector'> & { vector: ArrayBuffer };

export type FrontierAvoidMatch = {
  anchorId: string;
  label: string;
  score: number;
  penalty: number;
};

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

function openAvoidDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
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
      reject(request.error ?? new Error('Unable to open FRONTIER avoid store'));
    };
  });
  return dbPromise;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeAvoidLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 140);
}

export function frontierAvoidId(label: string): string {
  return `avoid-${stableHash(normalizeAvoidLabel(label).toLowerCase())}`;
}

function fromStored(record: StoredAvoidAnchor): FrontierAvoidAnchor {
  return { ...record, vector: normalizeVector(new Float32Array(record.vector)) };
}

function toStored(anchor: FrontierAvoidAnchor): StoredAvoidAnchor {
  return { ...anchor, vector: normalizeVector(anchor.vector).slice().buffer as ArrayBuffer };
}

function publishAvoidChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FRONTIER_AVOID_EVENT));
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(FRONTIER_AVOID_CHANNEL);
      channel.postMessage({ type: 'changed', at: Date.now() });
      channel.close();
    } catch {}
  }
}

export function listenFrontierAvoidChanges(callback: () => void): () => void {
  const onWindow = () => callback();
  if (typeof window !== 'undefined') window.addEventListener(FRONTIER_AVOID_EVENT, onWindow);
  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(FRONTIER_AVOID_CHANNEL);
      channel.onmessage = () => callback();
    } catch {}
  }
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener(FRONTIER_AVOID_EVENT, onWindow);
    channel?.close();
  };
}

export async function listFrontierAvoidAnchors(): Promise<FrontierAvoidAnchor[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openAvoidDb();
    const transaction = db.transaction(STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await requestPromise(transaction.objectStore(STORE).getAll()) as StoredAvoidAnchor[];
    await done;
    return records.map(fromStored)
      .sort((left, right) => Number(right.active) - Number(left.active) || right.updatedAt - left.updatedAt || left.label.localeCompare(right.label));
  } catch {
    return [];
  }
}

export async function putFrontierAvoidAnchor(
  label: string,
  vector: Float32Array,
  embeddingBackend: FrontierIntentEmbeddingBackend,
  now = Date.now()
): Promise<FrontierAvoidAnchor> {
  const normalized = normalizeAvoidLabel(label);
  if (!normalized) throw new Error('Avoid anchor cannot be empty');
  if (vector.length !== FRONTIER_VECTOR_DIMENSION) throw new Error(`Avoid vector must be ${FRONTIER_VECTOR_DIMENSION}D`);
  const existing = await listFrontierAvoidAnchors();
  const previous = existing.find((anchor) => anchor.id === frontierAvoidId(normalized));
  const anchor: FrontierAvoidAnchor = {
    id: frontierAvoidId(normalized),
    label: normalized,
    vector: normalizeVector(vector),
    embeddingBackend,
    active: true,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  const db = await openAvoidDb();
  const transaction = db.transaction(STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(STORE).put(toStored(anchor));
  await done;

  const all = await listFrontierAvoidAnchors();
  if (all.length > MAX_ANCHORS) {
    const remove = all
      .filter((entry) => entry.id !== anchor.id)
      .sort((left, right) => Number(left.active) - Number(right.active) || left.updatedAt - right.updatedAt)
      .slice(0, all.length - MAX_ANCHORS);
    if (remove.length) {
      const prune = db.transaction(STORE, 'readwrite');
      const pruneDone = transactionDone(prune);
      const store = prune.objectStore(STORE);
      for (const entry of remove) store.delete(entry.id);
      await pruneDone;
    }
  }
  publishAvoidChange();
  return anchor;
}

export async function setFrontierAvoidAnchorActive(id: string, active: boolean, now = Date.now()): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAvoidDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const previous = await requestPromise(store.get(id)) as StoredAvoidAnchor | undefined;
    if (previous) store.put({ ...previous, active, updatedAt: now } satisfies StoredAvoidAnchor);
    await done;
    if (previous) publishAvoidChange();
  } catch {}
}

export async function removeFrontierAvoidAnchor(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAvoidDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).delete(id);
    await done;
    publishAvoidChange();
  } catch {}
}

export function bestFrontierAvoidMatch(
  itemVector: Float32Array,
  anchors: FrontierAvoidAnchor[],
  threshold = FRONTIER_AVOID_THRESHOLD
): FrontierAvoidMatch | undefined {
  let best: FrontierAvoidMatch | undefined;
  for (const anchor of anchors) {
    if (!anchor.active || anchor.vector.length !== itemVector.length) continue;
    const score = Math.max(0, Math.min(1, (cosineSimilarity(itemVector, anchor.vector) + 1) * 0.5));
    const severity = Math.max(0, Math.min(1, (score - threshold) / Math.max(0.001, 1 - threshold)));
    const penalty = severity * FRONTIER_AVOID_MAX_PENALTY;
    if (!best || penalty > best.penalty || (penalty === best.penalty && score > best.score)) {
      best = { anchorId: anchor.id, label: anchor.label, score, penalty };
    }
  }
  return best?.penalty ? best : undefined;
}

export async function clearFrontierAvoidAnchors(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAvoidDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).clear();
    await done;
    publishAvoidChange();
  } catch {}
}
