import type { FrontierItem } from '../types';
import { filterUnseenFrontierItems, frontierItemIdentityKey } from './seenLedger';

const DB_NAME = 'frontier-live-candidates-v1';
const DB_VERSION = 1;
const STORE = 'candidate_pool';
const MAX_CANDIDATES = 512;
const MAX_AGE_MS = 72 * 60 * 60_000;

export type FrontierCandidateRecord = {
  key: string;
  item: FrontierItem;
  discoveredAt: number;
  lastOfferedAt: number;
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

function openCandidateDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('discoveredAt', 'discoveredAt');
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
      reject(request.error ?? new Error('Unable to open FRONTIER candidate pool'));
    };
  });
  return dbPromise;
}

async function allRecords(db: IDBDatabase): Promise<FrontierCandidateRecord[]> {
  const transaction = db.transaction(STORE, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestPromise(transaction.objectStore(STORE).getAll()) as FrontierCandidateRecord[];
  await done;
  return records;
}

async function prune(db: IDBDatabase, now = Date.now()): Promise<void> {
  const records = await allRecords(db);
  const keep = records
    .filter((record) => now - record.discoveredAt <= MAX_AGE_MS)
    .sort((left, right) => right.discoveredAt - left.discoveredAt || left.key.localeCompare(right.key))
    .slice(0, MAX_CANDIDATES);
  const keepKeys = new Set(keep.map((record) => record.key));
  const remove = records.filter((record) => !keepKeys.has(record.key));
  if (!remove.length) return;
  const transaction = db.transaction(STORE, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORE);
  for (const record of remove) store.delete(record.key);
  await done;
}

export async function addFrontierCandidates(items: FrontierItem[], now = Date.now()): Promise<FrontierItem[]> {
  if (!items.length || typeof indexedDB === 'undefined') return items;
  const unseen = await filterUnseenFrontierItems(items);
  if (!unseen.length) return [];
  try {
    const db = await openCandidateDb();
    const records = await allRecords(db);
    const existing = new Set(records.map((record) => record.key));
    const unique = new Map<string, FrontierItem>();
    for (const item of unseen) {
      const key = frontierItemIdentityKey(item);
      if (!existing.has(key) && !unique.has(key)) unique.set(key, item);
    }
    if (!unique.size) return [];
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    for (const [key, item] of unique) {
      store.put({ key, item, discoveredAt: now, lastOfferedAt: 0 } satisfies FrontierCandidateRecord);
    }
    await done;
    await prune(db, now);
    return Array.from(unique.values());
  } catch {
    // Candidate persistence is opportunistic. The caller can still broadcast the
    // in-memory unseen batch when IndexedDB is unavailable.
    return unseen;
  }
}

export async function readFrontierCandidates(limit = 96, now = Date.now()): Promise<FrontierItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openCandidateDb();
    await prune(db, now);
    const records = (await allRecords(db))
      .sort((left, right) => right.discoveredAt - left.discoveredAt || left.key.localeCompare(right.key))
      .slice(0, Math.max(0, Math.min(MAX_CANDIDATES, limit)));
    return filterUnseenFrontierItems(records.map((record) => record.item));
  } catch {
    return [];
  }
}

export async function clearFrontierCandidatePool(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openCandidateDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).clear();
    await done;
  } catch {}
}
