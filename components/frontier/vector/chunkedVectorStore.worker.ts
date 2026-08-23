/// <reference lib="webworker" />

import {
  FRONTIER_CHUNK_DB_NAME,
  FRONTIER_CHUNK_SIZE,
  dequantizeFrontierVector,
  frontierChunkCentroid,
  frontierSpatialGridKey,
  mergeChunkNeighborhood,
  quantizeFrontierVector,
  rankFrontierChunkManifests,
  type FrontierChunkManifest,
  type FrontierChunkMetadata,
  type FrontierChunkVector,
} from '@/lib/frontier/vector/chunkedVectorStore';

const DB_VERSION = 1;
const CHUNKS = 'chunks';
const DIRECTORY = 'directory';
const MANIFESTS = 'manifests';

type EncodedEntry = FrontierChunkMetadata & {
  id: string;
  data: ArrayBuffer;
  scale: number;
  dimensions: number;
  textHash: string;
  createdAt: number;
  lastAccessedAt: number;
};

type StoredChunk = {
  chunkId: string;
  gridKey: string;
  entries: EncodedEntry[];
  updatedAt: number;
  lastAccessedAt: number;
};

type StoredManifest = Omit<FrontierChunkManifest, 'centroid'> & { centroid: ArrayBuffer };
type DirectoryRecord = { id: string; chunkId: string };

type PutEntry = {
  id: string;
  buffer: ArrayBuffer;
  textHash: string;
  metadata?: FrontierChunkMetadata;
  at?: number;
};

type Request =
  | { type: 'putMany'; requestId: string; entries: PutEntry[] }
  | { type: 'getIds'; requestId: string; ids: string[] }
  | { type: 'neighborhood'; requestId: string; target: ArrayBuffer; maxChunks?: number; maxItems?: number }
  | { type: 'stats'; requestId: string }
  | { type: 'clear'; requestId: string };

type EncodedResponseEntry = FrontierChunkMetadata & {
  id: string;
  buffer: ArrayBuffer;
  textHash: string;
  createdAt: number;
  lastAccessedAt: number;
};

type Response =
  | { type: 'ok'; requestId: string; count?: number; chunks?: number }
  | { type: 'vectors'; requestId: string; entries: EncodedResponseEntry[] }
  | { type: 'error'; requestId: string; message: string };

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('chunk index request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('chunk index transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('chunk index transaction failed'));
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(FRONTIER_CHUNK_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: 'chunkId' });
      if (!db.objectStoreNames.contains(DIRECTORY)) db.createObjectStore(DIRECTORY, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(MANIFESTS)) {
        const manifests = db.createObjectStore(MANIFESTS, { keyPath: 'chunkId' });
        manifests.createIndex('gridKey', 'gridKey');
        manifests.createIndex('lastAccessedAt', 'lastAccessedAt');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error('unable to open chunked vector index'));
    };
  });
  return databasePromise;
}

async function readRecord<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const tx = db.transaction(storeName, 'readonly');
  const done = transactionDone(tx);
  const value = await requestPromise(tx.objectStore(storeName).get(key)) as T | undefined;
  await done;
  return value;
}

async function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  const tx = db.transaction(storeName, 'readonly');
  const done = transactionDone(tx);
  const values = await requestPromise(tx.objectStore(storeName).getAll()) as T[];
  await done;
  return values;
}

function decodeEntry(entry: EncodedEntry): FrontierChunkVector {
  return {
    id: entry.id,
    vector: dequantizeFrontierVector({ scale: entry.scale, data: new Int8Array(entry.data.slice(0)) }),
    textHash: entry.textHash,
    createdAt: entry.createdAt,
    lastAccessedAt: entry.lastAccessedAt,
    title: entry.title,
    sourceLabel: entry.sourceLabel,
    lane: entry.lane,
    publishedAt: entry.publishedAt,
    engagement: entry.engagement,
    lastSignalAt: entry.lastSignalAt,
  };
}

function encodeResponse(entries: FrontierChunkVector[]): { entries: EncodedResponseEntry[]; transfers: Transferable[] } {
  const transfers: Transferable[] = [];
  const output = entries.map((entry) => {
    const buffer = entry.vector.slice().buffer as ArrayBuffer;
    transfers.push(buffer);
    return {
      id: entry.id,
      buffer,
      textHash: entry.textHash,
      createdAt: entry.createdAt,
      lastAccessedAt: entry.lastAccessedAt,
      title: entry.title,
      sourceLabel: entry.sourceLabel,
      lane: entry.lane,
      publishedAt: entry.publishedAt,
      engagement: entry.engagement,
      lastSignalAt: entry.lastSignalAt,
    };
  });
  return { entries: output, transfers };
}

async function manifestsForGrid(db: IDBDatabase, gridKey: string): Promise<StoredManifest[]> {
  const tx = db.transaction(MANIFESTS, 'readonly');
  const done = transactionDone(tx);
  const request = tx.objectStore(MANIFESTS).index('gridKey').getAll(gridKey);
  const result = await requestPromise(request) as StoredManifest[];
  await done;
  return result;
}

async function chooseChunkId(db: IDBDatabase, gridKey: string): Promise<string> {
  const matches = await manifestsForGrid(db, gridKey);
  const available = matches
    .filter((manifest) => manifest.count < FRONTIER_CHUNK_SIZE)
    .sort((a, b) => b.count - a.count || a.chunkId.localeCompare(b.chunkId))[0];
  if (available) return available.chunkId;
  const page = matches.length ? Math.max(...matches.map((manifest) => Number(manifest.chunkId.split(':').at(-1)) || 0)) + 1 : 0;
  return `${gridKey}:p:${page}`;
}

async function writeChunk(db: IDBDatabase, chunk: StoredChunk): Promise<void> {
  const vectors = chunk.entries.map(decodeEntry).map((entry) => entry.vector);
  const centroid = frontierChunkCentroid(vectors);
  const manifest: StoredManifest = {
    chunkId: chunk.chunkId,
    gridKey: chunk.gridKey,
    count: chunk.entries.length,
    centroid: centroid.buffer as ArrayBuffer,
    updatedAt: chunk.updatedAt,
    lastAccessedAt: chunk.lastAccessedAt,
  };
  const tx = db.transaction([CHUNKS, MANIFESTS, DIRECTORY], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore(CHUNKS).put(chunk);
  tx.objectStore(MANIFESTS).put(manifest);
  for (const entry of chunk.entries) tx.objectStore(DIRECTORY).put({ id: entry.id, chunkId: chunk.chunkId } satisfies DirectoryRecord);
  await done;
}

async function putEntry(db: IDBDatabase, input: PutEntry): Promise<void> {
  const vector = new Float32Array(input.buffer);
  if (!vector.length) return;
  const now = input.at ?? Date.now();
  const existingDirectory = await readRecord<DirectoryRecord>(db, DIRECTORY, input.id);
  let chunkId = existingDirectory?.chunkId;
  let chunk = chunkId ? await readRecord<StoredChunk>(db, CHUNKS, chunkId) : undefined;
  const gridKey = frontierSpatialGridKey(vector);

  if (!chunk || chunk.gridKey !== gridKey) {
    if (chunk) {
      chunk.entries = chunk.entries.filter((entry) => entry.id !== input.id);
      chunk.updatedAt = now;
      await writeChunk(db, chunk);
    }
    chunkId = await chooseChunkId(db, gridKey);
    chunk = await readRecord<StoredChunk>(db, CHUNKS, chunkId) ?? {
      chunkId,
      gridKey,
      entries: [],
      updatedAt: now,
      lastAccessedAt: now,
    };
  }

  const previous = chunk.entries.find((entry) => entry.id === input.id);
  const encoded = quantizeFrontierVector(vector);
  const next: EncodedEntry = {
    ...previous,
    ...input.metadata,
    id: input.id,
    data: encoded.data.buffer as ArrayBuffer,
    scale: encoded.scale,
    dimensions: vector.length,
    textHash: input.textHash,
    createdAt: previous?.createdAt ?? now,
    lastAccessedAt: now,
  };
  chunk.entries = [...chunk.entries.filter((entry) => entry.id !== input.id), next];
  chunk.updatedAt = now;
  chunk.lastAccessedAt = now;
  await writeChunk(db, chunk);
}

async function getIds(db: IDBDatabase, ids: string[]): Promise<FrontierChunkVector[]> {
  const wanted = new Set(ids.slice(0, 256));
  const directories = (await Promise.all([...wanted].map((id) => readRecord<DirectoryRecord>(db, DIRECTORY, id))))
    .filter((record): record is DirectoryRecord => Boolean(record));
  const chunks = new Map<string, StoredChunk>();
  for (const chunkId of new Set(directories.map((record) => record.chunkId))) {
    const chunk = await readRecord<StoredChunk>(db, CHUNKS, chunkId);
    if (chunk) chunks.set(chunkId, chunk);
  }
  const output: FrontierChunkVector[] = [];
  for (const directory of directories) {
    const encoded = chunks.get(directory.chunkId)?.entries.find((entry) => entry.id === directory.id);
    if (encoded) output.push(decodeEntry(encoded));
  }
  return output;
}

async function neighborhood(db: IDBDatabase, target: Float32Array, maxChunks = 6, maxItems = 192): Promise<FrontierChunkVector[]> {
  const stored = await readAll<StoredManifest>(db, MANIFESTS);
  const manifests: FrontierChunkManifest[] = stored.map((manifest) => ({
    ...manifest,
    centroid: new Float32Array(manifest.centroid.slice(0)),
  }));
  const selected = rankFrontierChunkManifests(manifests, target, Math.max(1, Math.min(12, maxChunks)));
  const chunks: FrontierChunkVector[][] = [];
  for (const manifest of selected) {
    const chunk = await readRecord<StoredChunk>(db, CHUNKS, manifest.chunkId);
    if (chunk) chunks.push(chunk.entries.map(decodeEntry));
  }
  return mergeChunkNeighborhood(chunks, target, Math.max(1, Math.min(384, maxItems)));
}

async function clearDb(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([CHUNKS, DIRECTORY, MANIFESTS], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore(CHUNKS).clear();
  tx.objectStore(DIRECTORY).clear();
  tx.objectStore(MANIFESTS).clear();
  await done;
}

async function handle(request: Request): Promise<void> {
  try {
    const db = await openDb();
    if (request.type === 'putMany') {
      for (const entry of request.entries.slice(0, 48)) await putEntry(db, entry);
      self.postMessage({ type: 'ok', requestId: request.requestId, count: request.entries.length } satisfies Response);
      return;
    }
    if (request.type === 'getIds') {
      const result = encodeResponse(await getIds(db, request.ids));
      self.postMessage({ type: 'vectors', requestId: request.requestId, entries: result.entries } satisfies Response, { transfer: result.transfers });
      return;
    }
    if (request.type === 'neighborhood') {
      const target = new Float32Array(request.target);
      const result = encodeResponse(await neighborhood(db, target, request.maxChunks, request.maxItems));
      self.postMessage({ type: 'vectors', requestId: request.requestId, entries: result.entries } satisfies Response, { transfer: result.transfers });
      return;
    }
    if (request.type === 'stats') {
      const manifests = await readAll<StoredManifest>(db, MANIFESTS);
      const count = manifests.reduce((sum, manifest) => sum + manifest.count, 0);
      self.postMessage({ type: 'ok', requestId: request.requestId, count, chunks: manifests.length } satisfies Response);
      return;
    }
    await clearDb(db);
    self.postMessage({ type: 'ok', requestId: request.requestId, count: 0, chunks: 0 } satisfies Response);
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'chunked vector store failed',
    } satisfies Response);
  }
}

let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
  queue = queue.then(() => handle(event.data)).catch(() => undefined);
};

export {};
