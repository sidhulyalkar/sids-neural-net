import { buildLongitudinalRollups, summarizeLongitudinalData, type LongitudinalSummary } from './longitudinalAggregation';
import { isQualifiedLongitudinalExposure } from './longitudinalEvents';
import {
  dayKeyInLongitudinalWindow,
  longitudinalDayWindow,
  type LongitudinalArchive,
  type LongitudinalCheckin,
  type LongitudinalExposure,
  type LongitudinalInteraction,
  type LongitudinalReactionEpisode,
  type LongitudinalReactionReview,
  type LongitudinalRollup,
} from './longitudinalModel';

const DB_NAME = 'frontier-longitudinal-v1';
const DB_VERSION = 1;
const EXPOSURE_STORE = 'exposures';
const REACTION_STORE = 'reactions';
const INTERACTION_STORE = 'interactions';
const CHECKIN_STORE = 'checkins';
const ROLLUP_STORE = 'rollups';
const CHANGE_EVENT = 'frontier-longitudinal-change';

export const LONGITUDINAL_RAW_RETENTION_DAYS = 120;

export type LongitudinalStorageHealth = {
  supported: boolean;
  usage?: number;
  quota?: number;
  persisted?: boolean;
};

type StoreName =
  | typeof EXPOSURE_STORE
  | typeof REACTION_STORE
  | typeof INTERACTION_STORE
  | typeof CHECKIN_STORE
  | typeof ROLLUP_STORE;

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

function createStore(db: IDBDatabase, name: StoreName, indexes: Array<[string, string]>): IDBObjectStore {
  const store = db.createObjectStore(name, { keyPath: 'id' });
  for (const [indexName, path] of indexes) store.createIndex(indexName, path);
  return store;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXPOSURE_STORE)) {
        createStore(db, EXPOSURE_STORE, [['endedAt', 'endedAt'], ['itemId', 'itemId'], ['dayKey', 'dayKey'], ['lane', 'lane']]);
      }
      if (!db.objectStoreNames.contains(REACTION_STORE)) {
        createStore(db, REACTION_STORE, [['occurredAt', 'occurredAt'], ['itemId', 'itemId'], ['dayKey', 'dayKey'], ['kind', 'kind']]);
      }
      if (!db.objectStoreNames.contains(INTERACTION_STORE)) {
        createStore(db, INTERACTION_STORE, [['at', 'at'], ['itemId', 'itemId'], ['dayKey', 'dayKey'], ['kind', 'kind']]);
      }
      if (!db.objectStoreNames.contains(CHECKIN_STORE)) {
        createStore(db, CHECKIN_STORE, [['at', 'at'], ['dayKey', 'dayKey']]);
      }
      if (!db.objectStoreNames.contains(ROLLUP_STORE)) {
        createStore(db, ROLLUP_STORE, [['dayKey', 'dayKey'], ['dimension', 'dimension'], ['key', 'key']]);
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
      reject(request.error ?? new Error('Unable to open FRONTIER longitudinal memory'));
    };
    request.onblocked = () => {
      dbPromise = undefined;
      reject(new Error('FRONTIER longitudinal memory upgrade is blocked by another tab'));
    };
  });
  return dbPromise;
}

async function readAll<T>(name: StoreName): Promise<T[]> {
  const db = await openDb();
  const transaction = db.transaction(name, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestPromise(transaction.objectStore(name).getAll()) as T[];
  await done;
  return records;
}

async function readRecord<T>(name: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  const transaction = db.transaction(name, 'readonly');
  const done = transactionDone(transaction);
  const record = await requestPromise(transaction.objectStore(name).get(id)) as T | undefined;
  await done;
  return record;
}

async function putRecord<T>(name: StoreName, record: T): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(name, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore(name).put(record);
  await done;
}

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

export class FrontierLongitudinalStore {
  async recordExposure(exposure: LongitudinalExposure): Promise<boolean> {
    if (!isQualifiedLongitudinalExposure(exposure)) return false;
    await putRecord(EXPOSURE_STORE, exposure);
    notifyChanged();
    return true;
  }

  async recordReaction(reaction: LongitudinalReactionEpisode): Promise<void> {
    await putRecord(REACTION_STORE, reaction);
    notifyChanged();
  }

  async reviewReaction(id: string, review: LongitudinalReactionReview, reviewedAt = Date.now()): Promise<boolean> {
    // Keep lookup and mutation in separate transactions. IndexedDB may auto-commit
    // across an await boundary, particularly in WebKit.
    const current = await readRecord<LongitudinalReactionEpisode>(REACTION_STORE, id);
    if (!current) return false;
    await putRecord(REACTION_STORE, { ...current, review, reviewedAt });
    notifyChanged();
    return true;
  }

  async recordInteraction(interaction: LongitudinalInteraction): Promise<void> {
    await putRecord(INTERACTION_STORE, interaction);
    notifyChanged();
  }

  async recordCheckin(checkin: LongitudinalCheckin): Promise<void> {
    await putRecord(CHECKIN_STORE, checkin);
    notifyChanged();
  }

  async archive(): Promise<LongitudinalArchive> {
    const [exposures, reactions, interactions, checkins, rollups] = await Promise.all([
      readAll<LongitudinalExposure>(EXPOSURE_STORE),
      readAll<LongitudinalReactionEpisode>(REACTION_STORE),
      readAll<LongitudinalInteraction>(INTERACTION_STORE),
      readAll<LongitudinalCheckin>(CHECKIN_STORE),
      readAll<LongitudinalRollup>(ROLLUP_STORE),
    ]);
    return {
      schema: 'frontier-longitudinal-v1',
      exportedAt: new Date().toISOString(),
      exposures,
      reactions,
      interactions,
      checkins,
      rollups,
    };
  }

  async summary(days = 90, now = Date.now()): Promise<LongitudinalSummary> {
    const window = longitudinalDayWindow(days, now);
    const archive = await this.archive();
    return summarizeLongitudinalData({
      days: window.days,
      exposures: archive.exposures.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      reactions: archive.reactions.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      interactions: archive.interactions.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      checkins: archive.checkins.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      rollups: archive.rollups.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
    });
  }

  async compact(
    rawRetentionDays = LONGITUDINAL_RAW_RETENTION_DAYS,
    now = Date.now(),
  ): Promise<{ exposures: number; reactions: number; interactions: number; rollups: number; orphanReactions: number }> {
    const retentionWindow = longitudinalDayWindow(Math.max(30, rawRetentionDays), now);
    const [allExposures, allReactions, allInteractions] = await Promise.all([
      readAll<LongitudinalExposure>(EXPOSURE_STORE),
      readAll<LongitudinalReactionEpisode>(REACTION_STORE),
      readAll<LongitudinalInteraction>(INTERACTION_STORE),
    ]);
    const exposures = allExposures.filter((entry) => entry.dayKey < retentionWindow.startDay);
    const reactions = allReactions.filter((entry) => entry.dayKey < retentionWindow.startDay);
    const interactions = allInteractions.filter((entry) => entry.dayKey < retentionWindow.startDay);
    if (!exposures.length && !reactions.length && !interactions.length) {
      return { exposures: 0, reactions: 0, interactions: 0, rollups: 0, orphanReactions: 0 };
    }

    const qualifiedExposureIds = new Set(exposures.filter(isQualifiedLongitudinalExposure).map((entry) => entry.id));
    const attributableReactions = reactions.filter((entry) => qualifiedExposureIds.has(entry.exposureId));
    const orphanReactions = reactions.length - attributableReactions.length;
    const rollups = buildLongitudinalRollups(exposures, attributableReactions, interactions, now);

    const db = await openDb();
    const transaction = db.transaction([EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, ROLLUP_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const exposureStore = transaction.objectStore(EXPOSURE_STORE);
    const reactionStore = transaction.objectStore(REACTION_STORE);
    const interactionStore = transaction.objectStore(INTERACTION_STORE);
    const rollupStore = transaction.objectStore(ROLLUP_STORE);
    for (const rollup of rollups) rollupStore.put(rollup);
    for (const entry of exposures) exposureStore.delete(entry.id);
    // Orphan reactions are intentionally removed from high-resolution storage at
    // the retention boundary without gaining aggregate rate authority.
    for (const entry of reactions) reactionStore.delete(entry.id);
    for (const entry of interactions) interactionStore.delete(entry.id);
    await done;
    notifyChanged();
    return {
      exposures: exposures.length,
      reactions: reactions.length,
      interactions: interactions.length,
      rollups: rollups.length,
      orphanReactions,
    };
  }

  /**
   * Replace all stores with an already validated canonical archive. Validation is
   * intentionally not owned by persistence, so arbitrary unknown input can never
   * be written simply by calling this adapter.
   */
  async replaceValidatedArchive(archive: LongitudinalArchive): Promise<void> {
    const db = await openDb();
    const transaction = db.transaction(
      [EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, CHECKIN_STORE, ROLLUP_STORE],
      'readwrite',
    );
    const done = transactionDone(transaction);
    const entries: Array<[StoreName, unknown[]]> = [
      [EXPOSURE_STORE, archive.exposures],
      [REACTION_STORE, archive.reactions],
      [INTERACTION_STORE, archive.interactions],
      [CHECKIN_STORE, archive.checkins],
      [ROLLUP_STORE, archive.rollups],
    ];
    for (const [name, records] of entries) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const record of records) store.put(record);
    }
    await done;
    notifyChanged();
  }

  async clear(): Promise<void> {
    const db = await openDb();
    const names: StoreName[] = [EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, CHECKIN_STORE, ROLLUP_STORE];
    const transaction = db.transaction(names, 'readwrite');
    const done = transactionDone(transaction);
    for (const name of names) transaction.objectStore(name).clear();
    await done;
    notifyChanged();
  }

  async storageHealth(): Promise<LongitudinalStorageHealth> {
    if (typeof navigator === 'undefined' || !navigator.storage) return { supported: false };
    let estimate: StorageEstimate = {};
    let persisted: boolean | undefined;
    try {
      estimate = await navigator.storage.estimate();
    } catch {
      // Advisory diagnostics only.
    }
    try {
      persisted = navigator.storage.persisted ? await navigator.storage.persisted() : undefined;
    } catch {
      // Optional/browser-dependent.
    }
    const result: LongitudinalStorageHealth = { supported: true };
    if (estimate.usage !== undefined) result.usage = estimate.usage;
    if (estimate.quota !== undefined) result.quota = estimate.quota;
    if (persisted !== undefined) result.persisted = persisted;
    return result;
  }

  async requestPersistence(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
}

export const frontierLongitudinalStore = new FrontierLongitudinalStore();
export { CHANGE_EVENT as FRONTIER_LONGITUDINAL_CHANGE_EVENT };
