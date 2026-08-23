import type { FrontierItem, FrontierVelocitySignal } from '../types';
import { cosineSimilarity } from '../vector/math';
import { projectEmbeddingToSequence } from '../vector/sequenceModel';

const DB_NAME = 'frontier-semantic-velocity-v1';
const DB_VERSION = 1;
const STORE = 'observations';
const MAX_OBSERVATIONS = 640;
const MAX_AGE_MS = 48 * 60 * 60_000;
const RECENT_WINDOW_MS = 2 * 60 * 60_000;
const BASELINE_WINDOW_MS = 22 * 60 * 60_000;
const NEIGHBOR_COSINE = 0.81;

export type FrontierVelocityObservation = {
  id: string;
  at: number;
  sourceLabel: string;
  title: string;
  vector: ArrayBuffer;
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

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('at', 'at');
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
      reject(request.error ?? new Error('Unable to open FRONTIER velocity store'));
    };
  });
  return dbPromise;
}

function identity(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    return url.toString().toLowerCase();
  } catch {
    return item.id;
  }
}

function conceptLabel(item: FrontierItem): string {
  const usefulTag = item.tags.find((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized.length >= 4 && !['paper', 'study', 'research', 'github', 'release', 'discussion', 'news'].includes(normalized);
  });
  return (usefulTag || item.title.split(/[:|–—-]/)[0] || item.title).replace(/\s+/g, ' ').trim().slice(0, 64);
}

async function allRecords(db: IDBDatabase): Promise<FrontierVelocityObservation[]> {
  const transaction = db.transaction(STORE, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestPromise(transaction.objectStore(STORE).getAll()) as FrontierVelocityObservation[];
  await done;
  return records;
}

async function prune(db: IDBDatabase, now: number): Promise<void> {
  const records = await allRecords(db);
  const keep = records
    .filter((record) => now - record.at <= MAX_AGE_MS)
    .sort((left, right) => right.at - left.at)
    .slice(0, MAX_OBSERVATIONS);
  const keepIds = new Set(keep.map((record) => record.id));
  const remove = records.filter((record) => !keepIds.has(record.id));
  if (!remove.length) return;
  const transaction = db.transaction(STORE, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORE);
  for (const record of remove) store.delete(record.id);
  await done;
}

export function scoreFrontierVelocityNeighborhood(
  item: FrontierItem,
  itemVector: Float32Array,
  observations: FrontierVelocityObservation[],
  now = Date.now()
): FrontierVelocitySignal | undefined {
  const projected = projectEmbeddingToSequence(itemVector);
  let recentCount = 0;
  let baselineCount = 0;
  const recentSources = new Set<string>();

  for (const observation of observations) {
    const age = now - observation.at;
    if (age < 0 || age > RECENT_WINDOW_MS + BASELINE_WINDOW_MS) continue;
    const vector = new Float32Array(observation.vector);
    if (vector.length !== projected.length || cosineSimilarity(projected, vector) < NEIGHBOR_COSINE) continue;
    if (age <= RECENT_WINDOW_MS) {
      recentCount += 1;
      recentSources.add(observation.sourceLabel.toLowerCase());
    } else {
      baselineCount += 1;
    }
  }

  if (recentCount < 4 || recentSources.size < 3) return undefined;
  const baselineRate = baselineCount * (RECENT_WINDOW_MS / BASELINE_WINDOW_MS);
  const acceleration = recentCount / Math.max(0.75, baselineRate + 0.5);
  const diversity = Math.min(1, recentSources.size / 5);
  const magnitude = Math.min(1, recentCount / 10);
  const score = Math.max(0, Math.min(1, 0.48 * Math.min(1, acceleration / 4) + 0.3 * diversity + 0.22 * magnitude));
  if (acceleration < 2.15 || score < 0.62) return undefined;
  return {
    concept: conceptLabel(item),
    score,
    recentCount,
    baselineRate,
    sourceCount: recentSources.size,
    detectedAt: now,
  };
}

export async function recordAndScoreFrontierVelocity(
  items: FrontierItem[],
  vectors: Map<string, Float32Array>,
  now = Date.now()
): Promise<Map<string, FrontierVelocitySignal>> {
  const output = new Map<string, FrontierVelocitySignal>();
  if (!items.length || typeof indexedDB === 'undefined') return output;
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    for (const item of items.slice(0, 96)) {
      const vector = vectors.get(item.id);
      if (!vector) continue;
      const projected = projectEmbeddingToSequence(vector);
      store.put({
        id: identity(item),
        at: Number.isFinite(new Date(item.publishedAt).getTime()) ? new Date(item.publishedAt).getTime() : now,
        sourceLabel: item.sourceLabel,
        title: item.title.slice(0, 180),
        vector: projected.buffer as ArrayBuffer,
      } satisfies FrontierVelocityObservation);
    }
    await done;
    await prune(db, now);
    const observations = await allRecords(db);
    for (const item of items.slice(0, 96)) {
      const vector = vectors.get(item.id);
      if (!vector) continue;
      const signal = scoreFrontierVelocityNeighborhood(item, vector, observations, now);
      if (signal) output.set(item.id, signal);
    }
    return output;
  } catch {
    return output;
  }
}

export async function clearFrontierVelocityHistory(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).clear();
    await done;
  } catch {}
}
