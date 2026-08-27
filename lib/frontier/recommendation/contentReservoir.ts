import type { FrontierItem, FrontierReaction } from '../types';
import { assessFrontierSource, isFrontierSourceAdmitted } from '../sourceTrust';
import { filterUnseenFrontierItems, frontierItemIdentityKey } from '../live/seenLedger';

const DB_NAME = 'frontier-content-reservoir-v2';
const DB_VERSION = 1;
const STORE = 'validated_content';
const MAX_RECORDS = 2048;
const MIN_AUTOMATIC_VALIDATION = 0.56;
const DAY_MS = 86_400_000;

export type FrontierReservoirSignal = 'open' | 'save' | 'dwell' | FrontierReaction;

export type FrontierReservoirRecord = {
  key: string;
  item: FrontierItem;
  discoveredAt: number;
  validatedAt: number;
  validationScore: number;
  positiveSignals: number;
  negativeSignals: number;
  lastFeedbackAt: number;
  lastOfferedAt: number;
  offerCount: number;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function parsedPublishedAt(item: FrontierItem, fallback: number): number {
  const value = new Date(item.publishedAt).getTime();
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Durable research/code/methods can remain useful for weeks. Live state and
 * editorial pulse material ages aggressively so the reservoir can never turn a
 * stale score or breaking story into a "personalized" recommendation.
 */
export function frontierReservoirShelfLifeMs(item: FrontierItem): number {
  if (item.sourceKind === 'sports_state' || item.sportsState) return 18 * 60 * 60_000;
  if (item.lane === 'world_pulse' || item.lane === 'must_know') return 3 * DAY_MS;
  if (['team_pulse', 'premier_league', 'world_soccer', 'sports'].includes(item.lane)) return 5 * DAY_MS;
  if (['internet_culture', 'music', 'screen', 'gaming', 'life'].includes(item.lane)) return 14 * DAY_MS;
  if (['builder_signal', 'methods', 'creative_tech'].includes(item.lane) || item.sourceKind === 'github') return 35 * DAY_MS;
  if (['ai_frontier', 'ml_data', 'neuro_frontier', 'broad_science'].includes(item.lane)
      || ['arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode', 'huggingface'].includes(item.sourceKind)) {
    return 45 * DAY_MS;
  }
  return 21 * DAY_MS;
}

export function frontierReservoirValidationScore(item: FrontierItem): number {
  if (!isFrontierSourceAdmitted(item) || item.sourceKind === 'local') return 0;
  const trust = assessFrontierSource(item).score;
  const durableBonus = ['github', 'arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode', 'huggingface']
    .includes(item.sourceKind) ? 0.045 : 0;
  return clamp(
    item.quality * 0.31
    + item.importance * 0.22
    + item.baseScore * 0.17
    + item.novelty * 0.12
    + item.momentum * 0.06
    + trust * 0.12
    + durableBonus
  );
}

export function isFrontierReservoirRecordEligible(record: FrontierReservoirRecord, now = Date.now()): boolean {
  if (record.negativeSignals >= 2 && record.negativeSignals > record.positiveSignals) return false;
  const published = parsedPublishedAt(record.item, record.discoveredAt);
  if (now - published > frontierReservoirShelfLifeMs(record.item)) return false;
  return record.validationScore >= MIN_AUTOMATIC_VALIDATION || record.positiveSignals > record.negativeSignals;
}

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

function openReservoirDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('validatedAt', 'validatedAt');
        store.createIndex('validationScore', 'validationScore');
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
      reject(request.error ?? new Error('Unable to open FRONTIER content reservoir'));
    };
  });
  return dbPromise;
}

async function allRecords(db: IDBDatabase): Promise<FrontierReservoirRecord[]> {
  const transaction = db.transaction(STORE, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestPromise(transaction.objectStore(STORE).getAll()) as FrontierReservoirRecord[];
  await done;
  return records;
}

async function pruneReservoir(db: IDBDatabase, now = Date.now()): Promise<void> {
  const records = await allRecords(db);
  const keep = records
    .filter((record) => isFrontierReservoirRecordEligible(record, now))
    .sort((left, right) => {
      const scoreDelta = right.validationScore - left.validationScore;
      if (Math.abs(scoreDelta) > 1e-6) return scoreDelta;
      return right.validatedAt - left.validatedAt || left.key.localeCompare(right.key);
    })
    .slice(0, MAX_RECORDS);
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
 * Promote trusted, intrinsically strong candidates into the long-lived shelf.
 * This never changes ranking authority by itself: the reservoir only expands
 * the candidate universe. The normal personalized ranker still decides whether
 * an older candidate earns a slot today.
 */
export async function ingestFrontierReservoir(items: FrontierItem[], now = Date.now()): Promise<number> {
  if (!items.length || typeof indexedDB === 'undefined') return 0;
  const eligible = items
    .map((item) => ({ item, score: frontierReservoirValidationScore(item) }))
    .filter(({ score }) => score >= MIN_AUTOMATIC_VALIDATION);
  if (!eligible.length) return 0;

  try {
    const db = await openReservoirDb();
    const records = await allRecords(db);
    const existing = new Map(records.map((record) => [record.key, record]));
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    let changed = 0;

    for (const { item, score } of eligible) {
      const key = frontierItemIdentityKey(item);
      const previous = existing.get(key);
      const next: FrontierReservoirRecord = previous
        ? {
            ...previous,
            item,
            validationScore: Math.max(previous.validationScore, score),
            validatedAt: now,
          }
        : {
            key,
            item,
            discoveredAt: now,
            validatedAt: now,
            validationScore: score,
            positiveSignals: 0,
            negativeSignals: 0,
            lastFeedbackAt: 0,
            lastOfferedAt: 0,
            offerCount: 0,
          };
      store.put(next);
      changed += 1;
    }
    await done;
    await pruneReservoir(db, now);
    return changed;
  } catch {
    return 0;
  }
}

export async function readFrontierReservoir(limit = 768, now = Date.now()): Promise<FrontierItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openReservoirDb();
    await pruneReservoir(db, now);
    const records = (await allRecords(db))
      .filter((record) => isFrontierReservoirRecordEligible(record, now))
      .sort((left, right) => {
        const publishedLeft = parsedPublishedAt(left.item, left.discoveredAt);
        const publishedRight = parsedPublishedAt(right.item, right.discoveredAt);
        const leftAge = Math.max(0, now - publishedLeft) / Math.max(1, frontierReservoirShelfLifeMs(left.item));
        const rightAge = Math.max(0, now - publishedRight) / Math.max(1, frontierReservoirShelfLifeMs(right.item));
        const leftUtility = left.validationScore + left.positiveSignals * 0.035 - left.negativeSignals * 0.08 - leftAge * 0.1;
        const rightUtility = right.validationScore + right.positiveSignals * 0.035 - right.negativeSignals * 0.08 - rightAge * 0.1;
        return rightUtility - leftUtility || right.validatedAt - left.validatedAt;
      })
      .slice(0, Math.max(0, Math.min(MAX_RECORDS, limit)));
    return filterUnseenFrontierItems(records.map((record) => record.item));
  } catch {
    return [];
  }
}

function signalDelta(signal: FrontierReservoirSignal): { positive: number; negative: number; score: number } {
  switch (signal) {
    case 'love': return { positive: 3, negative: 0, score: 0.18 };
    case 'important': return { positive: 3, negative: 0, score: 0.16 };
    case 'useful': return { positive: 2, negative: 0, score: 0.13 };
    case 'surprise': return { positive: 2, negative: 0, score: 0.12 };
    case 'up': return { positive: 2, negative: 0, score: 0.1 };
    case 'save': return { positive: 2, negative: 0, score: 0.12 };
    case 'open': return { positive: 1, negative: 0, score: 0.045 };
    case 'dwell': return { positive: 1, negative: 0, score: 0.025 };
    case 'read': return { positive: 1, negative: 0, score: 0.035 };
    case 'later': return { positive: 1, negative: 0, score: 0.025 };
    case 'known': return { positive: 0, negative: 0, score: -0.02 };
    case 'meh': return { positive: 0, negative: 1, score: -0.1 };
    case 'down': return { positive: 0, negative: 2, score: -0.18 };
    case 'hide': return { positive: 0, negative: 4, score: -0.5 };
  }
}

export async function recordFrontierReservoirSignal(
  item: FrontierItem,
  signal: FrontierReservoirSignal,
  now = Date.now()
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openReservoirDb();
    const key = frontierItemIdentityKey(item);
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const previous = await requestPromise(store.get(key)) as FrontierReservoirRecord | undefined;
    const delta = signalDelta(signal);
    const base = previous?.validationScore ?? frontierReservoirValidationScore(item);
    const next: FrontierReservoirRecord = previous
      ? {
          ...previous,
          item,
          validationScore: clamp(base + delta.score),
          positiveSignals: previous.positiveSignals + delta.positive,
          negativeSignals: previous.negativeSignals + delta.negative,
          validatedAt: delta.positive > 0 ? now : previous.validatedAt,
          lastFeedbackAt: now,
        }
      : {
          key,
          item,
          discoveredAt: now,
          validatedAt: now,
          validationScore: clamp(base + delta.score),
          positiveSignals: delta.positive,
          negativeSignals: delta.negative,
          lastFeedbackAt: now,
          lastOfferedAt: 0,
          offerCount: 0,
        };
    if (signal === 'hide') store.delete(key);
    else store.put(next);
    await done;
    await pruneReservoir(db, now);
  } catch {}
}

export async function markFrontierReservoirOffered(items: FrontierItem[], now = Date.now()): Promise<void> {
  if (!items.length || typeof indexedDB === 'undefined') return;
  try {
    const db = await openReservoirDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    for (const item of items) {
      const key = frontierItemIdentityKey(item);
      const previous = await requestPromise(store.get(key)) as FrontierReservoirRecord | undefined;
      if (!previous) continue;
      store.put({ ...previous, lastOfferedAt: now, offerCount: previous.offerCount + 1 });
    }
    await done;
  } catch {}
}

export async function clearFrontierReservoir(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openReservoirDb();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE).clear();
    await done;
  } catch {}
}
