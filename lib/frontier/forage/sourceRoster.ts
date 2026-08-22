import type { FrontierForageEvaluation, FrontierForageEvidence } from './sourceForager';

const DB_NAME = 'frontier-source-forage-v1';
const DB_VERSION = 1;
const SOURCE_STORE = 'poll_sources';
const DOMAIN_STORE = 'domain_observations';
export const FRONTIER_FORAGED_SOURCE_LIMIT = 50;
export const FRONTIER_FORAGED_SOURCE_CHANNEL = 'frontier-source-roster-v1';
const BASE_POLL_INTERVAL_MS = 12 * 60_000;
const DOMAIN_PROBE_INTERVAL_MS = 12 * 60 * 60_000;

export type FrontierForagedSource = {
  id: string;
  endpoint: string;
  domain: string;
  label: string;
  contextText: string;
  semanticSimilarity: number;
  credibility: number;
  evidence: FrontierForageEvidence[];
  active: boolean;
  discoveredAt: number;
  updatedAt: number;
  lastPolledAt: number;
  lastUsefulAt: number;
  totalPolls: number;
  totalDiscovered: number;
  totalUnseen: number;
  yieldQuality: number;
  consecutiveFailures: number;
};

export type FrontierForagedDomainObservation = {
  domain: string;
  contextText: string;
  observationCount: number;
  firstObservedAt: number;
  lastObservedAt: number;
  lastProbedAt: number;
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

function publishRosterChange(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(FRONTIER_FORAGED_SOURCE_CHANNEL);
    channel.postMessage({ type: 'changed', at: Date.now() });
    channel.close();
  } catch {}
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openForageDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SOURCE_STORE)) {
        const store = db.createObjectStore(SOURCE_STORE, { keyPath: 'id' });
        store.createIndex('lastPolledAt', 'lastPolledAt');
        store.createIndex('yieldQuality', 'yieldQuality');
      }
      if (!db.objectStoreNames.contains(DOMAIN_STORE)) {
        const store = db.createObjectStore(DOMAIN_STORE, { keyPath: 'domain' });
        store.createIndex('lastObservedAt', 'lastObservedAt');
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
      reject(request.error ?? new Error('Unable to open FRONTIER source-forage store'));
    };
  });
  return dbPromise;
}

function recencyScore(at: number, now: number, halfLifeMs: number): number {
  if (!Number.isFinite(at) || at <= 0) return 0;
  const age = Math.max(0, now - at);
  return Math.pow(0.5, age / Math.max(1, halfLifeMs));
}

export function frontierForagedSourceRetentionScore(record: FrontierForagedSource, now = Date.now()): number {
  const usefulRecency = recencyScore(record.lastUsefulAt || record.discoveredAt, now, 14 * 86_400_000);
  const accessRecency = recencyScore(record.lastPolledAt || record.discoveredAt, now, 3 * 86_400_000);
  return record.yieldQuality * 2.4
    + record.semanticSimilarity * 1.55
    + record.credibility * 1.25
    + usefulRecency * 0.75
    + accessRecency * 0.28
    - Math.min(1.2, record.consecutiveFailures * 0.16);
}

export function retainFrontierForagedSources(records: FrontierForagedSource[], max = FRONTIER_FORAGED_SOURCE_LIMIT, now = Date.now()): FrontierForagedSource[] {
  return [...records]
    .sort((left, right) => frontierForagedSourceRetentionScore(right, now) - frontierForagedSourceRetentionScore(left, now)
      || right.lastUsefulAt - left.lastUsefulAt
      || left.id.localeCompare(right.id))
    .slice(0, Math.max(0, max));
}

async function allSources(db: IDBDatabase): Promise<FrontierForagedSource[]> {
  const transaction = db.transaction(SOURCE_STORE, 'readonly');
  const done = transactionDone(transaction);
  const records = await requestPromise(transaction.objectStore(SOURCE_STORE).getAll()) as FrontierForagedSource[];
  await done;
  return records;
}

async function pruneSources(db: IDBDatabase, now = Date.now()): Promise<void> {
  const records = await allSources(db);
  if (records.length <= FRONTIER_FORAGED_SOURCE_LIMIT) return;
  const keep = new Set(retainFrontierForagedSources(records, FRONTIER_FORAGED_SOURCE_LIMIT, now).map((record) => record.id));
  const transaction = db.transaction(SOURCE_STORE, 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(SOURCE_STORE);
  for (const record of records) if (!keep.has(record.id)) store.delete(record.id);
  await done;
}

export async function listFrontierForagedSources(): Promise<FrontierForagedSource[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openForageDb();
    return retainFrontierForagedSources(await allSources(db));
  } catch {
    return [];
  }
}

export async function upsertFrontierForagedSources(evaluations: FrontierForageEvaluation[], now = Date.now()): Promise<FrontierForagedSource[]> {
  const accepted = evaluations.filter((evaluation) => evaluation.accepted && evaluation.candidate.kind === 'feed');
  if (!accepted.length || typeof indexedDB === 'undefined') return [];
  try {
    const db = await openForageDb();
    const existing = new Map((await allSources(db)).map((record) => [record.id, record]));
    const written: FrontierForagedSource[] = [];
    const transaction = db.transaction(SOURCE_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SOURCE_STORE);
    for (const evaluation of accepted) {
      const candidate = evaluation.candidate;
      const previous = existing.get(candidate.id);
      const record: FrontierForagedSource = {
        id: candidate.id,
        endpoint: candidate.url,
        domain: candidate.domain,
        label: candidate.label.slice(0, 160),
        contextText: candidate.contextText.slice(0, 3_200),
        semanticSimilarity: Math.max(previous?.semanticSimilarity ?? -1, evaluation.similarity),
        credibility: Math.max(previous?.credibility ?? 0, candidate.credibility),
        evidence: Array.from(new Set([...(previous?.evidence ?? []), ...candidate.evidence])),
        active: true,
        discoveredAt: previous?.discoveredAt ?? now,
        updatedAt: now,
        lastPolledAt: previous?.lastPolledAt ?? 0,
        lastUsefulAt: previous?.lastUsefulAt ?? 0,
        totalPolls: previous?.totalPolls ?? 0,
        totalDiscovered: previous?.totalDiscovered ?? 0,
        totalUnseen: previous?.totalUnseen ?? 0,
        yieldQuality: previous?.yieldQuality ?? 0.45,
        consecutiveFailures: previous?.consecutiveFailures ?? 0,
      };
      store.put(record);
      written.push(record);
    }
    await done;
    await pruneSources(db, now);
    publishRosterChange();
    return written;
  } catch {
    return [];
  }
}

export function frontierForagedSourceDueAt(record: FrontierForagedSource): number {
  const failureBackoff = Math.pow(2, Math.min(5, Math.max(0, record.consecutiveFailures)));
  const lowYieldBackoff = record.yieldQuality < 0.18 ? 3 : record.yieldQuality < 0.35 ? 2 : 1;
  return (record.lastPolledAt || 0) + BASE_POLL_INTERVAL_MS * failureBackoff * lowYieldBackoff;
}

export async function readDueFrontierForagedSources(limit = 3, now = Date.now()): Promise<FrontierForagedSource[]> {
  const sources = await listFrontierForagedSources();
  return sources
    .filter((source) => source.active && frontierForagedSourceDueAt(source) <= now)
    .sort((left, right) => frontierForagedSourceDueAt(left) - frontierForagedSourceDueAt(right)
      || frontierForagedSourceRetentionScore(right, now) - frontierForagedSourceRetentionScore(left, now))
    .slice(0, Math.max(0, Math.min(6, limit)));
}

export async function recordFrontierForagedSourceYield(id: string, result: { discovered: number; unseen: number; success: boolean }, now = Date.now()): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openForageDb();
    const transaction = db.transaction(SOURCE_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SOURCE_STORE);
    const previous = await requestPromise(store.get(id)) as FrontierForagedSource | undefined;
    if (previous) {
      const discovered = Math.max(0, Math.round(result.discovered));
      const unseen = Math.max(0, Math.min(discovered || result.unseen, Math.round(result.unseen)));
      const sample = result.success ? (discovered > 0 ? unseen / discovered : 0) : 0;
      store.put({
        ...previous,
        updatedAt: now,
        lastPolledAt: now,
        lastUsefulAt: unseen > 0 ? now : previous.lastUsefulAt,
        totalPolls: previous.totalPolls + 1,
        totalDiscovered: previous.totalDiscovered + discovered,
        totalUnseen: previous.totalUnseen + unseen,
        yieldQuality: previous.yieldQuality * 0.82 + sample * 0.18,
        consecutiveFailures: result.success ? 0 : previous.consecutiveFailures + 1,
      } satisfies FrontierForagedSource);
    }
    await done;
  } catch {}
}

export async function noteFrontierForagedDomain(domain: string, contextText: string, now = Date.now()): Promise<FrontierForagedDomainObservation | undefined> {
  const normalized = domain.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!normalized || typeof indexedDB === 'undefined') return undefined;
  try {
    const db = await openForageDb();
    const transaction = db.transaction(DOMAIN_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(DOMAIN_STORE);
    const previous = await requestPromise(store.get(normalized)) as FrontierForagedDomainObservation | undefined;
    const record: FrontierForagedDomainObservation = {
      domain: normalized,
      contextText: [previous?.contextText, contextText].filter(Boolean).join(' · ').slice(-3_200),
      observationCount: (previous?.observationCount ?? 0) + 1,
      firstObservedAt: previous?.firstObservedAt ?? now,
      lastObservedAt: now,
      lastProbedAt: previous?.lastProbedAt ?? 0,
    };
    store.put(record);
    await done;
    return record;
  } catch {
    return undefined;
  }
}

export function shouldProbeFrontierForagedDomain(observation: FrontierForagedDomainObservation, now = Date.now()): boolean {
  return observation.observationCount >= 2 && now - observation.lastProbedAt >= DOMAIN_PROBE_INTERVAL_MS;
}

export async function markFrontierForagedDomainProbed(domain: string, now = Date.now()): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openForageDb();
    const transaction = db.transaction(DOMAIN_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(DOMAIN_STORE);
    const previous = await requestPromise(store.get(domain)) as FrontierForagedDomainObservation | undefined;
    if (previous) store.put({ ...previous, lastProbedAt: now } satisfies FrontierForagedDomainObservation);
    await done;
  } catch {}
}

export async function clearFrontierForagedSources(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openForageDb();
    const transaction = db.transaction([SOURCE_STORE, DOMAIN_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(SOURCE_STORE).clear();
    transaction.objectStore(DOMAIN_STORE).clear();
    await done;
    publishRosterChange();
  } catch {}
}
