import { cosineSimilarity, FRONTIER_VECTOR_DIMENSION, normalizeVector } from '../vector/math';
import type { FrontierItem } from '../types';

export const FRONTIER_WATCH_INTENT_EVENT = 'frontier:watch-intents';
export const FRONTIER_WATCH_INTENT_CHANNEL = 'frontier-watch-intents-v1';
export const FRONTIER_WATCH_INTENT_THRESHOLD = 0.92;
export const FRONTIER_WATCH_NOVELTY_MIN = 0.76;
export const FRONTIER_WATCH_QUALITY_MIN = 0.70;

const DB_NAME = 'frontier-watch-intents-v1';
const DB_VERSION = 1;
const STORE = 'watch_intents';
const MAX_INTENTS = 48;

export type FrontierIntentEmbeddingBackend = 'minilm' | 'feature-hash';

export type FrontierWatchIntent = {
  id: string;
  label: string;
  vector: Float32Array;
  embeddingBackend: FrontierIntentEmbeddingBackend;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

type StoredWatchIntent = Omit<FrontierWatchIntent, 'vector' | 'embeddingBackend'> & {
  vector: ArrayBuffer;
  embeddingBackend?: FrontierIntentEmbeddingBackend;
};

export type FrontierWatchMatch = {
  intentId: string;
  label: string;
  score: number;
  highPriority: boolean;
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

function openIntentDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
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
      reject(request.error ?? new Error('Unable to open FRONTIER watch intent store'));
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

export function normalizeWatchIntentLabel(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export function watchIntentId(label: string): string {
  return `watch-${stableHash(normalizeWatchIntentLabel(label).toLowerCase())}`;
}

function fromStored(record: StoredWatchIntent): FrontierWatchIntent {
  return {
    ...record,
    embeddingBackend: record.embeddingBackend === 'minilm' ? 'minilm' : 'feature-hash',
    vector: normalizeVector(new Float32Array(record.vector)),
  };
}

function toStored(intent: FrontierWatchIntent): StoredWatchIntent {
  const vector = normalizeVector(intent.vector);
  return {
    ...intent,
    vector: vector.slice().buffer as ArrayBuffer,
  };
}

function publishWatchIntentChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FRONTIER_WATCH_INTENT_EVENT));
  }
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(FRONTIER_WATCH_INTENT_CHANNEL);
      channel.postMessage({ type: 'changed', at: Date.now() });
      channel.close();
    } catch {}
  }
}

export function listenFrontierWatchIntentChanges(callback: () => void): () => void {
  const onWindow = () => callback();
  if (typeof window !== 'undefined') window.addEventListener(FRONTIER_WATCH_INTENT_EVENT, onWindow);
  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(FRONTIER_WATCH_INTENT_CHANNEL);
      channel.onmessage = () => callback();
    } catch {}
  }
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener(FRONTIER_WATCH_INTENT_EVENT, onWindow);
    channel?.close();
  };
}

export async function listFrontierWatchIntents(): Promise<FrontierWatchIntent[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openIntentDb();
    const transaction = db.transaction(STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await requestPromise(transaction.objectStore(STORE).getAll()) as StoredWatchIntent[];
    await done;
    return records
      .map(fromStored)
      .sort((left, right) => Number(right.active) - Number(left.active) || right.updatedAt - left.updatedAt || left.label.localeCompare(right.label));
  } catch {
    return [];
  }
}

export async function putFrontierWatchIntent(
  label: string,
  vector: Float32Array,
  embeddingBackend: FrontierIntentEmbeddingBackend,
  now = Date.now()
): Promise<FrontierWatchIntent> {
  const normalizedLabel = normalizeWatchIntentLabel(label);
  if (!normalizedLabel) throw new Error('Watch intent cannot be empty');
  if (vector.length !== FRONTIER_VECTOR_DIMENSION) throw new Error(`Watch intent vector must be ${FRONTIER_VECTOR_DIMENSION}D`);
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
  const db = await openIntentDb();
  const existing = await listFrontierWatchIntents();
  const previous = existing.find((intent) => intent.id === watchIntentId(normalizedLabel));
  const intent: FrontierWatchIntent = {
    id: watchIntentId(normalizedLabel),
    label: normalizedLabel,
    vector: normalizeVector(vector),
    embeddingBackend,
    active: true,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };

  const transaction = db.transaction(STORE, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(STORE).put(toStored(intent));
  await done;

  const all = await listFrontierWatchIntents();
  if (all.length > MAX_INTENTS) {
    const remove = all
      .filter((entry) => entry.id !== intent.id)
      .sort((left, right) => Number(left.active) - Number(right.active) || left.updatedAt - right.updatedAt)
      .slice(0, all.length - MAX_INTENTS);
    if (remove.length) {
      const pruneTransaction = db.transaction(STORE, 'readwrite');
      const pruneDone = transactionDone(pruneTransaction);
      const store = pruneTransaction.objectStore(STORE);
      for (const entry of remove) store.delete(entry.id);
      await pruneDone;
    }
  }
  publishWatchIntentChange();
  return intent;
}

export async function setFrontierWatchIntentActive(id: string, active: boolean, now = Date.now()): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openIntentDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const previous = await requestPromise(store.get(id)) as StoredWatchIntent | undefined;
    if (previous) store.put({ ...previous, active, updatedAt: now } satisfies StoredWatchIntent);
    await done;
    if (previous) publishWatchIntentChange();
  } catch {}
}

export async function removeFrontierWatchIntent(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openIntentDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).delete(id);
    await done;
    publishWatchIntentChange();
  } catch {}
}

export async function clearFrontierWatchIntents(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openIntentDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).clear();
    await done;
    publishWatchIntentChange();
  } catch {}
}

/**
 * Converts cosine from [-1, 1] to a stable [0, 1] semantic match score.
 * A threshold of .92 therefore still requires a raw cosine of .84, which is
 * deliberately strict for MiniLM-style normalized sentence embeddings.
 */
export function normalizedWatchIntentScore(itemVector: Float32Array, intentVector: Float32Array): number {
  const cosine = cosineSimilarity(itemVector, intentVector);
  return Math.max(0, Math.min(1, (cosine + 1) * 0.5));
}

export function bestFrontierWatchMatch(
  item: Pick<FrontierItem, 'novelty' | 'quality'>,
  itemVector: Float32Array,
  intents: FrontierWatchIntent[],
  threshold = FRONTIER_WATCH_INTENT_THRESHOLD
): FrontierWatchMatch | undefined {
  let best: FrontierWatchMatch | undefined;
  for (const intent of intents) {
    if (!intent.active || intent.vector.length !== itemVector.length) continue;
    const score = normalizedWatchIntentScore(itemVector, intent.vector);
    if (!best || score > best.score || (score === best.score && intent.label < best.label)) {
      best = {
        intentId: intent.id,
        label: intent.label,
        score,
        highPriority: score >= threshold && item.novelty >= FRONTIER_WATCH_NOVELTY_MIN && item.quality >= FRONTIER_WATCH_QUALITY_MIN,
      };
    }
  }
  return best;
}
