import { updateInterestEwma, type FrontierInterestState } from './math';

const DB_NAME = 'frontier-vector-index-v1';
const DB_VERSION = 1;
const VECTOR_STORE = 'vectors';
const PROFILE_STORE = 'profile';
const PROFILE_KEY = 'interest';
export const FRONTIER_VECTOR_LIMIT = 1_000;

export type StoredFrontierVector = {
  id: string;
  vector: ArrayBuffer;
  dimensions: number;
  textHash: string;
  createdAt: number;
  lastAccessedAt: number;
};

type StoredInterestProfile = {
  key: typeof PROFILE_KEY;
  vector: ArrayBuffer;
  dimensions: number;
  mass: number;
  updatedAt: number;
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

function openVectorDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VECTOR_STORE)) {
        const vectors = db.createObjectStore(VECTOR_STORE, { keyPath: 'id' });
        vectors.createIndex('lastAccessedAt', 'lastAccessedAt');
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: 'key' });
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
      reject(request.error ?? new Error('Unable to open FRONTIER vector index'));
    };
  });
  return dbPromise;
}

function cloneVectorBuffer(vector: Float32Array): ArrayBuffer {
  return vector.slice().buffer;
}

export type LruRecord = { id: string; lastAccessedAt: number };

export function selectLruEvictions(records: LruRecord[], limit = FRONTIER_VECTOR_LIMIT): string[] {
  if (records.length <= limit) return [];
  return [...records]
    .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt || left.id.localeCompare(right.id))
    .slice(0, records.length - limit)
    .map((record) => record.id);
}

async function evictToLimit(db: IDBDatabase, limit = FRONTIER_VECTOR_LIMIT): Promise<void> {
  const read = db.transaction(VECTOR_STORE, 'readonly');
  const records = await requestPromise(read.objectStore(VECTOR_STORE).getAll()) as StoredFrontierVector[];
  await transactionDone(read);
  const evictions = selectLruEvictions(records, limit);
  if (!evictions.length) return;
  const write = db.transaction(VECTOR_STORE, 'readwrite');
  const store = write.objectStore(VECTOR_STORE);
  for (const id of evictions) store.delete(id);
  await transactionDone(write);
}

export class FrontierVectorStore {
  async get(id: string): Promise<Float32Array | undefined> {
    const db = await openVectorDb();
    const transaction = db.transaction(VECTOR_STORE, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE);
    const record = await requestPromise(store.get(id)) as StoredFrontierVector | undefined;
    if (record) {
      record.lastAccessedAt = Date.now();
      store.put(record);
    }
    await transactionDone(transaction);
    return record ? new Float32Array(record.vector.slice(0)) : undefined;
  }

  async getMany(ids: string[]): Promise<Map<string, Float32Array>> {
    const output = new Map<string, Float32Array>();
    if (!ids.length) return output;
    const db = await openVectorDb();
    const transaction = db.transaction(VECTOR_STORE, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE);
    const now = Date.now();
    for (const id of ids) {
      const record = await requestPromise(store.get(id)) as StoredFrontierVector | undefined;
      if (!record) continue;
      record.lastAccessedAt = now;
      store.put(record);
      output.set(id, new Float32Array(record.vector.slice(0)));
    }
    await transactionDone(transaction);
    return output;
  }

  async put(id: string, vector: Float32Array, textHash: string, now = Date.now()): Promise<void> {
    const db = await openVectorDb();
    const transaction = db.transaction(VECTOR_STORE, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE);
    const previous = await requestPromise(store.get(id)) as StoredFrontierVector | undefined;
    const record: StoredFrontierVector = {
      id,
      vector: cloneVectorBuffer(vector),
      dimensions: vector.length,
      textHash,
      createdAt: previous?.createdAt ?? now,
      lastAccessedAt: now,
    };
    store.put(record);
    await transactionDone(transaction);
    await evictToLimit(db);
  }

  async putMany(entries: Array<{ id: string; vector: Float32Array; textHash: string }>): Promise<void> {
    if (!entries.length) return;
    const db = await openVectorDb();
    const transaction = db.transaction(VECTOR_STORE, 'readwrite');
    const store = transaction.objectStore(VECTOR_STORE);
    const now = Date.now();
    for (const entry of entries) {
      const record: StoredFrontierVector = {
        id: entry.id,
        vector: cloneVectorBuffer(entry.vector),
        dimensions: entry.vector.length,
        textHash: entry.textHash,
        createdAt: now,
        lastAccessedAt: now,
      };
      store.put(record);
    }
    await transactionDone(transaction);
    await evictToLimit(db);
  }

  async getInterest(): Promise<FrontierInterestState | undefined> {
    const db = await openVectorDb();
    const transaction = db.transaction(PROFILE_STORE, 'readonly');
    const record = await requestPromise(transaction.objectStore(PROFILE_STORE).get(PROFILE_KEY)) as StoredInterestProfile | undefined;
    await transactionDone(transaction);
    if (!record) return undefined;
    return {
      vector: new Float32Array(record.vector.slice(0)),
      mass: record.mass,
      updatedAt: record.updatedAt,
    };
  }

  async setInterest(profile: FrontierInterestState): Promise<void> {
    const db = await openVectorDb();
    const transaction = db.transaction(PROFILE_STORE, 'readwrite');
    const record: StoredInterestProfile = {
      key: PROFILE_KEY,
      vector: cloneVectorBuffer(profile.vector),
      dimensions: profile.vector.length,
      mass: profile.mass,
      updatedAt: profile.updatedAt,
    };
    transaction.objectStore(PROFILE_STORE).put(record);
    await transactionDone(transaction);
  }

  async updateInterest(itemVector: Float32Array, signal: number, now = Date.now()): Promise<FrontierInterestState> {
    const current = await this.getInterest();
    const next = updateInterestEwma(current, itemVector, signal, now);
    await this.setInterest(next);
    return next;
  }

  async clear(): Promise<void> {
    const db = await openVectorDb();
    const transaction = db.transaction([VECTOR_STORE, PROFILE_STORE], 'readwrite');
    transaction.objectStore(VECTOR_STORE).clear();
    transaction.objectStore(PROFILE_STORE).clear();
    await transactionDone(transaction);
  }
}

export const frontierVectorStore = new FrontierVectorStore();
