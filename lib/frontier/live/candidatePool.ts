import type { FrontierItem } from '../types';
import {
  FRONTIER_RESERVOIR_CAPACITY,
  FRONTIER_RESERVOIR_MIN_VALIDATION,
  frontierReservoirEligible,
  frontierReservoirValidationScore,
  sampleFrontierReservoirForDay,
  type FrontierReservoirCandidate,
} from '../recommendation/reservoirPolicy';
import { filterUnseenFrontierItems, frontierItemIdentityKey } from './seenLedger';

const DB_NAME = 'frontier-live-candidates-v1';
const DB_VERSION = 2;
const STORE = 'candidate_pool';

export type FrontierCandidateRecord = FrontierReservoirCandidate;

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
      const store = db.objectStoreNames.contains(STORE)
        ? request.transaction?.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: 'key' });
      if (store && !store.indexNames.contains('discoveredAt')) store.createIndex('discoveredAt', 'discoveredAt');
      if (store && !store.indexNames.contains('validationScore')) store.createIndex('validationScore', 'validationScore');
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
      reject(request.error ?? new Error('Unable to open FRONTIER candidate reservoir'));
    };
  });
  return dbPromise;
}

function normalizeRecord(record: Partial<FrontierCandidateRecord> & Pick<FrontierCandidateRecord, 'key' | 'item' | 'discoveredAt'>): FrontierCandidateRecord {
  return {
    key: record.key,
    item: record.item,
    discoveredAt: record.discoveredAt,
    validationScore: Number.isFinite(record.validationScore)
      ? Number(record.validationScore)
      : frontierReservoirValidationScore(record.item),
    lastOfferedAt: Number.isFinite(record.lastOfferedAt) ? Number(record.lastOfferedAt) : 0,
    offerCount: Number.isFinite(record.offerCount) ? Number(record.offerCount) : 0,
  };
}

async function allRecords(db: IDBDatabase): Promise<FrontierCandidateRecord[]> {
  const transaction = db.transaction(STORE, 'readonly');
  const done = transactionDone(transaction);
  const raw = await requestPromise(transaction.objectStore(STORE).getAll()) as Array<Partial<FrontierCandidateRecord> & Pick<FrontierCandidateRecord, 'key' | 'item' | 'discoveredAt'>>;
  await done;
  return raw.map(normalizeRecord);
}

async function prune(db: IDBDatabase, now = Date.now()): Promise<void> {
  const records = await allRecords(db);
  const keep = records
    .filter((record) => frontierReservoirEligible(record.item, record.discoveredAt, now))
    .sort((left, right) => right.validationScore - left.validationScore || right.discoveredAt - left.discoveredAt || left.key.localeCompare(right.key))
    .slice(0, FRONTIER_RESERVOIR_CAPACITY);
  const keepKeys = new Set(keep.map((record) => record.key));
  const remove = records.filter((record) => !keepKeys.has(record.key));
  if (!remove.length) return;
  const transaction = db.transaction(STORE, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(STORE);
  for (const record of remove) store.delete(record.key);
  await done;
}

/**
 * Live delivery and durable retention are intentionally separate authorities.
 * Every genuinely new unseen candidate remains eligible for the normal live
 * recommender immediately. Only the quality-vetted subset is persisted into
 * the multi-week reservoir. This prevents a retention threshold from silently
 * shrinking a real-time discovery batch while still keeping the long-lived
 * shelf clean.
 */
export async function addFrontierCandidates(items: FrontierItem[], now = Date.now()): Promise<FrontierItem[]> {
  if (!items.length || typeof indexedDB === 'undefined') return items;
  const unseen = await filterUnseenFrontierItems(items);
  if (!unseen.length) return [];
  try {
    const db = await openCandidateDb();
    const records = await allRecords(db);
    const existing = new Map(records.map((record) => [record.key, record]));
    const liveCandidates = unseen.filter((item) => !existing.has(frontierItemIdentityKey(item)));
    const accepted = new Map<string, { item: FrontierItem; score: number }>();
    for (const item of unseen) {
      const score = frontierReservoirValidationScore(item);
      if (score < FRONTIER_RESERVOIR_MIN_VALIDATION) continue;
      const key = frontierItemIdentityKey(item);
      if (!accepted.has(key)) accepted.set(key, { item, score });
    }

    if (accepted.size) {
      const transaction = db.transaction(STORE, 'readwrite');
      const done = transactionDone(transaction);
      const store = transaction.objectStore(STORE);
      for (const [key, { item, score }] of accepted) {
        const previous = existing.get(key);
        const record: FrontierCandidateRecord = previous
          ? {
              ...previous,
              item,
              validationScore: Math.max(previous.validationScore, score),
            }
          : {
              key,
              item,
              discoveredAt: now,
              validationScore: score,
              lastOfferedAt: 0,
              offerCount: 0,
            };
        store.put(record);
      }
      await done;
      await prune(db, now);
    }
    return liveCandidates;
  } catch {
    // Persistence is opportunistic. Failure to maintain the durable shelf may
    // not suppress otherwise valid real-time discoveries.
    return unseen;
  }
}

/**
 * Replay a broad but stable daily cross-section. We oversample before the seen
 * filter so old viewed items cannot shrink the returned batch to a handful.
 */
export async function readFrontierCandidates(limit = 96, now = Date.now()): Promise<FrontierItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openCandidateDb();
    await prune(db, now);
    const records = await allRecords(db);
    const sampled = sampleFrontierReservoirForDay(
      records,
      Math.min(FRONTIER_RESERVOIR_CAPACITY, Math.max(limit, limit * 4)),
      now,
    );
    const unseen = await filterUnseenFrontierItems(sampled.map((record) => record.item));
    const selected = unseen.slice(0, Math.max(0, Math.min(FRONTIER_RESERVOIR_CAPACITY, limit)));

    if (selected.length) {
      const selectedKeys = new Set(selected.map((item) => frontierItemIdentityKey(item)));
      const transaction = db.transaction(STORE, 'readwrite');
      const done = transactionDone(transaction);
      const store = transaction.objectStore(STORE);
      for (const record of sampled) {
        if (!selectedKeys.has(record.key)) continue;
        store.put({ ...record, lastOfferedAt: now, offerCount: record.offerCount + 1 });
      }
      await done;
    }
    return selected;
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
