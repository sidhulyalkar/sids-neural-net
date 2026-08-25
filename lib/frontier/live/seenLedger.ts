import type { FrontierItem } from '../types';

const DB_NAME = 'frontier-seen-ledger-v1';
const DB_VERSION = 1;
const SEEN_STORE = 'seen_items_store';
const META_STORE = 'meta';
const REVISION_KEY = 'revision';
const HISTORY_MIGRATION_KEY = 'history-migration-v1';
const SEEN_CHANNEL = 'frontier-seen-ledger-v1';

export const FRONTIER_VIEWPORT_SEEN_MS = 2_500;
export const FRONTIER_BLOOM_BITS = 1 << 20;
export const FRONTIER_BLOOM_HASHES = 7;

type SeenReason = 'viewport' | 'open' | 'save' | 'reaction' | 'expand' | 'migration';

type SeenRecord = {
  key: string;
  itemId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  reason: SeenReason;
};

type MetaRecord = {
  key: string;
  value: string | boolean;
};

function fnv1a32(value: string, seed = 2166136261): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function secondHash(value: string): number {
  let hash = 0x9e3779b9;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash ^ (hash >>> 13), 0x85ebca6b);
  }
  hash ^= hash >>> 16;
  return (hash | 1) >>> 0;
}

export class FrontierBloomFilter {
  private readonly bytes: Uint8Array;

  constructor(
    readonly bitCount = FRONTIER_BLOOM_BITS,
    readonly hashCount = FRONTIER_BLOOM_HASHES
  ) {
    const normalizedBits = Math.max(64, Math.floor(bitCount / 8) * 8);
    this.bitCount = normalizedBits;
    this.hashCount = Math.max(1, Math.min(16, Math.floor(hashCount)));
    this.bytes = new Uint8Array(normalizedBits / 8);
  }

  add(value: string): void {
    const first = fnv1a32(value);
    const second = secondHash(value);
    for (let index = 0; index < this.hashCount; index += 1) {
      const bit = (first + Math.imul(index, second) + Math.imul(index * index, 0x27d4eb2d)) >>> 0;
      const offset = bit % this.bitCount;
      this.bytes[offset >>> 3] |= 1 << (offset & 7);
    }
  }

  mightContain(value: string): boolean {
    const first = fnv1a32(value);
    const second = secondHash(value);
    for (let index = 0; index < this.hashCount; index += 1) {
      const bit = (first + Math.imul(index, second) + Math.imul(index * index, 0x27d4eb2d)) >>> 0;
      const offset = bit % this.bitCount;
      if ((this.bytes[offset >>> 3] & (1 << (offset & 7))) === 0) return false;
    }
    return true;
  }
}

export function canonicalizeFrontierUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const tracking = [
      'fbclid', 'gclid', 'dclid', 'igshid', 'mc_cid', 'mc_eid', 'ref_src', 'ref_url',
      'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term',
    ];
    for (const key of tracking) url.searchParams.delete(key);
    const sorted = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    ));
    url.search = '';
    for (const [key, entryValue] of sorted) url.searchParams.append(key, entryValue);
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function canonicalizeFrontierTitle(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 320);
}

export function frontierStableHash(value: string): string {
  const left = fnv1a32(value, 2166136261).toString(36).padStart(7, '0');
  const right = fnv1a32(value, 0x811c9dc5 ^ 0x9e3779b9).toString(36).padStart(7, '0');
  return `${left}${right}`;
}

export function frontierSeenSignatures(item: Pick<FrontierItem, 'url' | 'title'>): string[] {
  const signatures: string[] = [];
  const canonicalUrl = canonicalizeFrontierUrl(item.url);
  if (canonicalUrl) signatures.push(`u:${frontierStableHash(canonicalUrl)}`);
  const canonicalTitle = canonicalizeFrontierTitle(item.title);
  // Short generic labels such as "Highlights" are too collision-prone to be
  // authoritative title identities. The canonical URL remains authoritative.
  if (canonicalTitle.length >= 20) signatures.push(`t:${frontierStableHash(canonicalTitle)}`);
  return Array.from(new Set(signatures));
}

export function frontierItemIdentityKey(item: Pick<FrontierItem, 'url' | 'title' | 'id'>): string {
  return frontierSeenSignatures(item)[0] ?? `i:${frontierStableHash(item.id)}`;
}

/**
 * Playback policy is applied at the client ledger boundary as well as server
 * aggregation. This prevents a previously cached rights-fragile NFL YouTube
 * card from flashing for up to 36 hours after the source policy changes.
 */
export function isFrontierPlaybackSafe(item: FrontierItem): boolean {
  if (item.sourceKind !== 'youtube' && item.media?.type !== 'youtube') return true;
  const text = [item.title, item.summary, item.sourceLabel, ...item.tags].join(' ').toLowerCase();
  return !/\bnfl\b|new england patriots|patriots/.test(text);
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

function openSeenDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SEEN_STORE)) db.createObjectStore(SEEN_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
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
      reject(request.error ?? new Error('Unable to open FRONTIER seen ledger'));
    };
  });
  return dbPromise;
}

function revisionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

async function readMeta(db: IDBDatabase, key: string): Promise<string | boolean | undefined> {
  const transaction = db.transaction(META_STORE, 'readonly');
  const done = transactionDone(transaction);
  const record = await requestPromise(transaction.objectStore(META_STORE).get(key)) as MetaRecord | undefined;
  await done;
  return record?.value;
}

async function readAllSeenKeys(db: IDBDatabase): Promise<string[]> {
  const transaction = db.transaction(SEEN_STORE, 'readonly');
  const done = transactionDone(transaction);
  const keys = await requestPromise(transaction.objectStore(SEEN_STORE).getAllKeys());
  await done;
  return keys.map(String);
}

let bloom = new FrontierBloomFilter();
let bloomRevision: string | boolean | undefined;
let bloomRefresh: Promise<void> | undefined;

async function ensureBloomCurrent(): Promise<void> {
  if (bloomRefresh) return bloomRefresh;
  bloomRefresh = (async () => {
    const db = await openSeenDb();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = await readMeta(db, REVISION_KEY);
      if (before === bloomRevision) return;
      const keys = await readAllSeenKeys(db);
      const after = await readMeta(db, REVISION_KEY);
      if (before !== after) continue;
      const next = new FrontierBloomFilter();
      for (const key of keys) next.add(key);
      bloom = next;
      bloomRevision = after;
      return;
    }
    // A highly active second tab may mutate the ledger during all three reads.
    // Leave the current Bloom stale rather than treating it as authoritative;
    // callers will fall through to exact IndexedDB checks on the next pass.
    bloomRevision = undefined;
  })().finally(() => { bloomRefresh = undefined; });
  return bloomRefresh;
}

async function exactSeenKeys(db: IDBDatabase, keys: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(keys));
  const output = new Set<string>();
  if (!unique.length) return output;
  const transaction = db.transaction(SEEN_STORE, 'readonly');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(SEEN_STORE);
  const records = await Promise.all(unique.map((key) => requestPromise(store.get(key)) as Promise<SeenRecord | undefined>));
  await done;
  records.forEach((record) => { if (record) output.add(record.key); });
  return output;
}

export async function filterUnseenFrontierItems(items: FrontierItem[]): Promise<FrontierItem[]> {
  const playbackSafe = items.filter(isFrontierPlaybackSafe);
  if (!playbackSafe.length || typeof indexedDB === 'undefined') return playbackSafe;
  try {
    await ensureBloomCurrent();
    const signatureSets = playbackSafe.map((item) => frontierSeenSignatures(item));
    const maybeKeys = signatureSets.flatMap((keys) => keys.filter((key) => bloom.mightContain(key)));
    if (!maybeKeys.length) return playbackSafe;
    const db = await openSeenDb();
    const exact = await exactSeenKeys(db, maybeKeys);
    return playbackSafe.filter((_item, index) => !signatureSets[index].some((key) => exact.has(key)));
  } catch {
    // Privacy modes can disable IndexedDB. FRONTIER degrades to the existing
    // in-session history rather than blocking discovery entirely, while still
    // enforcing presentation/playback safety.
    return playbackSafe;
  }
}

function notifySeen(signatures: string[]): void {
  if (typeof BroadcastChannel === 'undefined' || !signatures.length) return;
  try {
    const channel = new BroadcastChannel(SEEN_CHANNEL);
    channel.postMessage({ type: 'seen', signatures });
    channel.close();
  } catch {}
}

export function listenFrontierSeenSignatures(callback: (signatures: string[]) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(SEEN_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ type?: string; signatures?: string[] }>) => {
      if (event.data?.type === 'seen' && Array.isArray(event.data.signatures)) callback(event.data.signatures);
    };
  } catch {
    return () => undefined;
  }
  return () => channel?.close();
}

export async function markFrontierItemsSeen(
  items: FrontierItem[],
  reason: SeenReason,
  at = Date.now()
): Promise<void> {
  if (!items.length || typeof indexedDB === 'undefined') return;
  const records = items.flatMap((item) => frontierSeenSignatures(item).map((key): SeenRecord => ({
    key,
    itemId: item.id,
    firstSeenAt: at,
    lastSeenAt: at,
    reason,
  })));
  if (!records.length) return;
  try {
    const db = await openSeenDb();
    const existing = await exactSeenKeys(db, records.map((record) => record.key));
    const transaction = db.transaction([SEEN_STORE, META_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SEEN_STORE);
    for (const record of records) {
      if (existing.has(record.key)) {
        const previous = await requestPromise(store.get(record.key)) as SeenRecord | undefined;
        store.put(previous ? { ...previous, lastSeenAt: at, reason } : record);
      } else {
        store.put(record);
      }
      bloom.add(record.key);
    }
    const revision = revisionToken();
    transaction.objectStore(META_STORE).put({ key: REVISION_KEY, value: revision } satisfies MetaRecord);
    await done;
    bloomRevision = revision;
    notifySeen(records.map((record) => record.key));
  } catch {
    // Seen persistence is a guardrail, never a prerequisite for reading.
  }
}

export function markFrontierItemSeen(item: FrontierItem, reason: SeenReason, at = Date.now()): Promise<void> {
  return markFrontierItemsSeen([item], reason, at);
}

/** One-time Phase 5 migration of pre-ledger history. */
export async function migrateFrontierHistoryToSeenLedger(items: FrontierItem[]): Promise<void> {
  if (!items.length || typeof indexedDB === 'undefined') return;
  try {
    const db = await openSeenDb();
    if (await readMeta(db, HISTORY_MIGRATION_KEY)) return;
    await markFrontierItemsSeen(items, 'migration');
    const transaction = db.transaction(META_STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(META_STORE).put({ key: HISTORY_MIGRATION_KEY, value: true } satisfies MetaRecord);
    await done;
  } catch {}
}

export async function clearFrontierSeenLedger(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openSeenDb();
    const transaction = db.transaction([SEEN_STORE, META_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(SEEN_STORE).clear();
    const meta = transaction.objectStore(META_STORE);
    meta.clear();
    const revision = revisionToken();
    meta.put({ key: REVISION_KEY, value: revision } satisfies MetaRecord);
    await done;
    bloom = new FrontierBloomFilter();
    bloomRevision = revision;
  } catch {}
}
