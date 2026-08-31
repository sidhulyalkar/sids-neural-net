import { formatForItem } from './behavior';
import type { FrontierAmbientReaction } from './reaction';
import type {
  FrontierAmbientReactionKind,
  FrontierItem,
  FrontierLaneId,
  FrontierReaction,
  FrontierSourceKind,
} from './types';

const DB_NAME = 'frontier-longitudinal-v1';
const DB_VERSION = 1;
const EXPOSURE_STORE = 'exposures';
const REACTION_STORE = 'reactions';
const INTERACTION_STORE = 'interactions';
const CHECKIN_STORE = 'checkins';
const ROLLUP_STORE = 'rollups';
const CHANGE_EVENT = 'frontier-longitudinal-change';

export const LONGITUDINAL_RAW_RETENTION_DAYS = 120;
export const MIN_QUALIFIED_EXPOSURE_MS = 700;

export type LongitudinalReactionReview = 'confirmed' | 'contradicted';
export type LongitudinalInteractionKind = 'dwell' | 'expand' | 'open' | 'save' | 'unsave' | 'reaction';
export type LongitudinalRollupDimension = 'lane' | 'topic' | 'format';
export type LongitudinalScale = 1 | 2 | 3 | 4 | 5;

export type LongitudinalItemContext = {
  itemId: string;
  lane: FrontierLaneId;
  tags: string[];
  sourceKind: FrontierSourceKind;
  format: string;
};

export type LongitudinalExposure = LongitudinalItemContext & {
  id: string;
  sessionId: string;
  startedAt: number;
  endedAt: number;
  dayKey: string;
  durationMs: number;
  attributionMean: number;
  attributionMin: number;
  visibleFractionMean: number;
};

export type LongitudinalReactionEpisode = LongitudinalItemContext & {
  id: string;
  sessionId: string;
  exposureId: string;
  occurredAt: number;
  dayKey: string;
  kind: FrontierAmbientReactionKind;
  confidence: number;
  intensity: number;
  durationMs: number;
  latencyMs: number;
  targetScore: number;
  visibleFraction: number;
  trustAuthority: number;
  review?: LongitudinalReactionReview;
  reviewedAt?: number;
};

export type LongitudinalInteraction = LongitudinalItemContext & {
  id: string;
  sessionId: string;
  at: number;
  dayKey: string;
  kind: LongitudinalInteractionKind;
  dwellMs?: number;
  reaction?: FrontierReaction;
};

export type LongitudinalCheckin = {
  id: string;
  at: number;
  dayKey: string;
  mood: LongitudinalScale;
  energy: LongitudinalScale;
  focus: LongitudinalScale;
};

export type LongitudinalRollup = {
  id: string;
  batchId: string;
  dayKey: string;
  dimension: LongitudinalRollupDimension;
  key: string;
  exposureMs: number;
  exposures: number;
  reactions: number;
  explicitInteractions: number;
  confirmed: number;
  contradicted: number;
  affinity: number;
  interest: number;
  surprise: number;
  friction: number;
  confidenceSum: number;
  intensitySum: number;
  compactedAt: number;
};

export type LongitudinalArchive = {
  schema: 'frontier-longitudinal-v1';
  exportedAt: string;
  exposures: LongitudinalExposure[];
  reactions: LongitudinalReactionEpisode[];
  interactions: LongitudinalInteraction[];
  checkins: LongitudinalCheckin[];
  rollups: LongitudinalRollup[];
};

export type LongitudinalTopicSummary = {
  key: string;
  exposureMs: number;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
  reactivityPer10Min: number;
  reviewAgreement?: number;
};

export type LongitudinalSummary = {
  days: number;
  exposureMs: number;
  exposures: number;
  reactions: number;
  explicitInteractions: number;
  reviewed: number;
  confirmed: number;
  contradicted: number;
  reviewAgreement?: number;
  checkins: number;
  selfReported?: {
    mood: number;
    energy: number;
    focus: number;
  };
  topTopics: LongitudinalTopicSummary[];
  topLanes: LongitudinalTopicSummary[];
};

export type LongitudinalStorageHealth = {
  supported: boolean;
  usage?: number;
  quota?: number;
  persisted?: boolean;
};

export type LongitudinalDayWindow = {
  days: number;
  startDay: string;
  endDayExclusive: string;
};

type StoreName =
  | typeof EXPOSURE_STORE
  | typeof REACTION_STORE
  | typeof INTERACTION_STORE
  | typeof CHECKIN_STORE
  | typeof ROLLUP_STORE;

type MutableSummary = {
  exposureMs: number;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function boundedMs(value: number, max = 4 * 60 * 60_000): number {
  return Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
}

function eventId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function longitudinalDayKey(at: number): string {
  const date = new Date(at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return a stable local-calendar window. `days=1` means the current local day,
 * while larger values include today plus the preceding `days - 1` local days.
 * `endOffsetDays` shifts the entire window and is useful for adjacent trend
 * cohorts. Date#setDate is deliberate here: fixed 86,400,000 ms arithmetic is
 * not equivalent to local calendar days across DST changes.
 */
export function longitudinalDayWindow(
  days: number,
  now = Date.now(),
  endOffsetDays = 0,
): LongitudinalDayWindow {
  const boundedDays = Math.max(1, Math.min(3650, Math.round(days)));
  const currentDay = new Date(now);
  currentDay.setHours(0, 0, 0, 0);

  const endExclusive = new Date(currentDay);
  endExclusive.setDate(endExclusive.getDate() + 1 + endOffsetDays);

  const start = new Date(endExclusive);
  start.setDate(start.getDate() - boundedDays);

  return {
    days: boundedDays,
    startDay: longitudinalDayKey(start.getTime()),
    endDayExclusive: longitudinalDayKey(endExclusive.getTime()),
  };
}

export function dayKeyInLongitudinalWindow(day: string, window: LongitudinalDayWindow): boolean {
  return day >= window.startDay && day < window.endDayExclusive;
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)))
    .slice(0, 8);
}

export function longitudinalItemContext(item: FrontierItem): LongitudinalItemContext {
  return {
    itemId: item.id,
    lane: item.lane,
    tags: normalizeTags(item.tags),
    sourceKind: item.sourceKind,
    format: formatForItem(item),
  };
}

let sessionId: string | undefined;

export function currentLongitudinalSessionId(): string {
  if (!sessionId) sessionId = eventId('session');
  return sessionId;
}

export function createLongitudinalExposure(
  item: FrontierItem,
  input: {
    id?: string;
    sessionId?: string;
    startedAt: number;
    endedAt: number;
    attributionMean: number;
    attributionMin: number;
    visibleFractionMean: number;
  }
): LongitudinalExposure {
  const endedAt = Math.max(input.startedAt, input.endedAt);
  return {
    id: input.id ?? eventId('exposure'),
    sessionId: input.sessionId ?? currentLongitudinalSessionId(),
    ...longitudinalItemContext(item),
    startedAt: input.startedAt,
    endedAt,
    dayKey: longitudinalDayKey(input.startedAt),
    durationMs: boundedMs(endedAt - input.startedAt),
    attributionMean: clamp01(input.attributionMean),
    attributionMin: clamp01(input.attributionMin),
    visibleFractionMean: clamp01(input.visibleFractionMean),
  };
}

export function createLongitudinalReaction(
  item: FrontierItem,
  reaction: FrontierAmbientReaction,
  input: {
    id?: string;
    sessionId?: string;
    exposureId: string;
    occurredAt?: number;
    latencyMs: number;
    targetScore: number;
    visibleFraction: number;
    trustAuthority: number;
  }
): LongitudinalReactionEpisode {
  const occurredAt = input.occurredAt ?? Date.now();
  return {
    id: input.id ?? eventId('reaction'),
    sessionId: input.sessionId ?? currentLongitudinalSessionId(),
    exposureId: input.exposureId,
    ...longitudinalItemContext(item),
    occurredAt,
    dayKey: longitudinalDayKey(occurredAt),
    kind: reaction.kind,
    confidence: clamp01(reaction.confidence),
    intensity: clamp01(reaction.intensity),
    durationMs: boundedMs(reaction.durationMs, 30_000),
    latencyMs: boundedMs(input.latencyMs, 30 * 60_000),
    targetScore: clamp01(input.targetScore),
    visibleFraction: clamp01(input.visibleFraction),
    trustAuthority: Math.max(0, Math.min(2, Number.isFinite(input.trustAuthority) ? input.trustAuthority : 0)),
  };
}

export function createLongitudinalInteraction(
  item: FrontierItem,
  kind: LongitudinalInteractionKind,
  input: { at?: number; dwellMs?: number; reaction?: FrontierReaction } = {}
): LongitudinalInteraction {
  const at = input.at ?? Date.now();
  return {
    id: eventId('interaction'),
    sessionId: currentLongitudinalSessionId(),
    ...longitudinalItemContext(item),
    at,
    dayKey: longitudinalDayKey(at),
    kind,
    dwellMs: input.dwellMs === undefined ? undefined : boundedMs(input.dwellMs, 120_000),
    reaction: input.reaction,
  };
}

export function createLongitudinalCheckin(
  mood: LongitudinalScale,
  energy: LongitudinalScale,
  focus: LongitudinalScale,
  at = Date.now()
): LongitudinalCheckin {
  return { id: eventId('checkin'), at, dayKey: longitudinalDayKey(at), mood, energy, focus };
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

function createStore(
  db: IDBDatabase,
  name: StoreName,
  indexes: Array<[string, string]>
): IDBObjectStore {
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

function emptyMutableSummary(): MutableSummary {
  return { exposureMs: 0, exposures: 0, reactions: 0, confirmed: 0, contradicted: 0 };
}

export function buildLongitudinalRollups(
  exposures: LongitudinalExposure[],
  reactions: LongitudinalReactionEpisode[],
  interactions: LongitudinalInteraction[],
  compactedAt = Date.now(),
  batchId = eventId('compact')
): LongitudinalRollup[] {
  type RollupAccumulator = LongitudinalRollup;
  const byKey = new Map<string, RollupAccumulator>();

  const touch = (day: string, dimension: LongitudinalRollupDimension, key: string): RollupAccumulator => {
    const mapKey = `${day}|${dimension}|${key}`;
    const current = byKey.get(mapKey);
    if (current) return current;
    const created: LongitudinalRollup = {
      id: `${batchId}:${day}:${dimension}:${encodeURIComponent(key)}`,
      batchId,
      dayKey: day,
      dimension,
      key,
      exposureMs: 0,
      exposures: 0,
      reactions: 0,
      explicitInteractions: 0,
      confirmed: 0,
      contradicted: 0,
      affinity: 0,
      interest: 0,
      surprise: 0,
      friction: 0,
      confidenceSum: 0,
      intensitySum: 0,
      compactedAt,
    };
    byKey.set(mapKey, created);
    return created;
  };

  const eachDimension = (
    context: Pick<LongitudinalItemContext, 'lane' | 'tags' | 'format'>,
    day: string,
    update: (rollup: LongitudinalRollup) => void
  ) => {
    update(touch(day, 'lane', context.lane));
    update(touch(day, 'format', context.format));
    for (const tag of context.tags) update(touch(day, 'topic', tag));
  };

  for (const exposure of exposures) {
    eachDimension(exposure, exposure.dayKey, (rollup) => {
      rollup.exposureMs += exposure.durationMs;
      rollup.exposures += 1;
    });
  }
  for (const reaction of reactions) {
    eachDimension(reaction, reaction.dayKey, (rollup) => {
      rollup.reactions += 1;
      rollup[reaction.kind] += 1;
      rollup.confidenceSum += reaction.confidence;
      rollup.intensitySum += reaction.intensity;
      if (reaction.review === 'confirmed') rollup.confirmed += 1;
      if (reaction.review === 'contradicted') rollup.contradicted += 1;
    });
  }
  for (const interaction of interactions) {
    eachDimension(interaction, interaction.dayKey, (rollup) => {
      rollup.explicitInteractions += 1;
    });
  }
  return Array.from(byKey.values());
}

function topicSummary(key: string, value: MutableSummary): LongitudinalTopicSummary {
  const reviewed = value.confirmed + value.contradicted;
  const minutes = value.exposureMs / 60_000;
  return {
    key,
    exposureMs: value.exposureMs,
    exposures: value.exposures,
    reactions: value.reactions,
    confirmed: value.confirmed,
    contradicted: value.contradicted,
    reactivityPer10Min: minutes > 0 ? value.reactions / minutes * 10 : 0,
    reviewAgreement: reviewed ? value.confirmed / reviewed : undefined,
  };
}

export function summarizeLongitudinalData(input: {
  days: number;
  exposures: LongitudinalExposure[];
  reactions: LongitudinalReactionEpisode[];
  interactions: LongitudinalInteraction[];
  checkins: LongitudinalCheckin[];
  rollups: LongitudinalRollup[];
}): LongitudinalSummary {
  const topicMap = new Map<string, MutableSummary>();
  const laneMap = new Map<string, MutableSummary>();
  let exposureMs = 0;
  let exposuresCount = 0;
  let reactionsCount = 0;
  let explicitInteractions = input.interactions.length;
  let confirmed = 0;
  let contradicted = 0;

  const applyRaw = (map: Map<string, MutableSummary>, key: string, mutate: (summary: MutableSummary) => void) => {
    const current = map.get(key) ?? emptyMutableSummary();
    mutate(current);
    map.set(key, current);
  };

  for (const exposure of input.exposures) {
    exposureMs += exposure.durationMs;
    exposuresCount += 1;
    applyRaw(laneMap, exposure.lane, (summary) => {
      summary.exposureMs += exposure.durationMs;
      summary.exposures += 1;
    });
    for (const tag of exposure.tags) applyRaw(topicMap, tag, (summary) => {
      summary.exposureMs += exposure.durationMs;
      summary.exposures += 1;
    });
  }
  for (const reaction of input.reactions) {
    reactionsCount += 1;
    if (reaction.review === 'confirmed') confirmed += 1;
    if (reaction.review === 'contradicted') contradicted += 1;
    applyRaw(laneMap, reaction.lane, (summary) => {
      summary.reactions += 1;
      if (reaction.review === 'confirmed') summary.confirmed += 1;
      if (reaction.review === 'contradicted') summary.contradicted += 1;
    });
    for (const tag of reaction.tags) applyRaw(topicMap, tag, (summary) => {
      summary.reactions += 1;
      if (reaction.review === 'confirmed') summary.confirmed += 1;
      if (reaction.review === 'contradicted') summary.contradicted += 1;
    });
  }

  for (const rollup of input.rollups) {
    if (rollup.dimension === 'lane') {
      exposureMs += rollup.exposureMs;
      exposuresCount += rollup.exposures;
      reactionsCount += rollup.reactions;
      explicitInteractions += rollup.explicitInteractions;
      confirmed += rollup.confirmed;
      contradicted += rollup.contradicted;
      applyRaw(laneMap, rollup.key, (summary) => {
        summary.exposureMs += rollup.exposureMs;
        summary.exposures += rollup.exposures;
        summary.reactions += rollup.reactions;
        summary.confirmed += rollup.confirmed;
        summary.contradicted += rollup.contradicted;
      });
    }
    if (rollup.dimension === 'topic') {
      applyRaw(topicMap, rollup.key, (summary) => {
        summary.exposureMs += rollup.exposureMs;
        summary.exposures += rollup.exposures;
        summary.reactions += rollup.reactions;
        summary.confirmed += rollup.confirmed;
        summary.contradicted += rollup.contradicted;
      });
    }
  }

  const reviewed = confirmed + contradicted;
  const selfReported = input.checkins.length
    ? {
        mood: input.checkins.reduce((sum, checkin) => sum + checkin.mood, 0) / input.checkins.length,
        energy: input.checkins.reduce((sum, checkin) => sum + checkin.energy, 0) / input.checkins.length,
        focus: input.checkins.reduce((sum, checkin) => sum + checkin.focus, 0) / input.checkins.length,
      }
    : undefined;

  const rank = (entries: Array<[string, MutableSummary]>) => entries
    .map(([key, value]) => topicSummary(key, value))
    .filter((entry) => entry.exposureMs >= 30_000)
    .sort((left, right) => {
      const leftReliability = left.reactions >= 2 ? 1 : 0.55;
      const rightReliability = right.reactions >= 2 ? 1 : 0.55;
      return right.reactivityPer10Min * rightReliability - left.reactivityPer10Min * leftReliability
        || right.exposureMs - left.exposureMs;
    })
    .slice(0, 12);

  return {
    days: input.days,
    exposureMs,
    exposures: exposuresCount,
    reactions: reactionsCount,
    explicitInteractions,
    reviewed,
    confirmed,
    contradicted,
    reviewAgreement: reviewed ? confirmed / reviewed : undefined,
    checkins: input.checkins.length,
    selfReported,
    topTopics: rank(Array.from(topicMap.entries())),
    topLanes: rank(Array.from(laneMap.entries())),
  };
}

class FrontierLongitudinalStore {
  async recordExposure(exposure: LongitudinalExposure): Promise<boolean> {
    if (exposure.durationMs < MIN_QUALIFIED_EXPOSURE_MS) return false;
    await putRecord(EXPOSURE_STORE, exposure);
    notifyChanged();
    return true;
  }

  async recordReaction(reaction: LongitudinalReactionEpisode): Promise<void> {
    await putRecord(REACTION_STORE, reaction);
    notifyChanged();
  }

  async reviewReaction(id: string, review: LongitudinalReactionReview, reviewedAt = Date.now()): Promise<boolean> {
    // Keep the readonly lookup and mutation in separate transactions. IndexedDB may
    // auto-commit a transaction across an await boundary, especially in WebKit.
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

  async summary(days = 90, now = Date.now()): Promise<LongitudinalSummary> {
    const window = longitudinalDayWindow(days, now);
    const [exposures, reactions, interactions, checkins, rollups] = await Promise.all([
      readAll<LongitudinalExposure>(EXPOSURE_STORE),
      readAll<LongitudinalReactionEpisode>(REACTION_STORE),
      readAll<LongitudinalInteraction>(INTERACTION_STORE),
      readAll<LongitudinalCheckin>(CHECKIN_STORE),
      readAll<LongitudinalRollup>(ROLLUP_STORE),
    ]);
    return summarizeLongitudinalData({
      days: window.days,
      // Raw rows and compacted rows must share the same day-bucket admission
      // semantics, otherwise compaction itself can change a historical answer.
      exposures: exposures.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      reactions: reactions.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      interactions: interactions.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      checkins: checkins.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
      rollups: rollups.filter((entry) => dayKeyInLongitudinalWindow(entry.dayKey, window)),
    });
  }

  async compact(rawRetentionDays = LONGITUDINAL_RAW_RETENTION_DAYS, now = Date.now()): Promise<{ exposures: number; reactions: number; interactions: number; rollups: number }> {
    const retentionWindow = longitudinalDayWindow(Math.max(30, rawRetentionDays), now);
    const [allExposures, allReactions, allInteractions] = await Promise.all([
      readAll<LongitudinalExposure>(EXPOSURE_STORE),
      readAll<LongitudinalReactionEpisode>(REACTION_STORE),
      readAll<LongitudinalInteraction>(INTERACTION_STORE),
    ]);
    // Compact whole local-day buckets only. This avoids a half-raw/half-rollup day
    // at the retention edge and keeps the representation independent of DST day
    // length or the clock time at which maintenance happened to run.
    const exposures = allExposures.filter((entry) => entry.dayKey < retentionWindow.startDay);
    const reactions = allReactions.filter((entry) => entry.dayKey < retentionWindow.startDay);
    const interactions = allInteractions.filter((entry) => entry.dayKey < retentionWindow.startDay);
    if (!exposures.length && !reactions.length && !interactions.length) {
      return { exposures: 0, reactions: 0, interactions: 0, rollups: 0 };
    }
    const rollups = buildLongitudinalRollups(exposures, reactions, interactions, now);
    const db = await openDb();
    const transaction = db.transaction([EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, ROLLUP_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const exposureStore = transaction.objectStore(EXPOSURE_STORE);
    const reactionStore = transaction.objectStore(REACTION_STORE);
    const interactionStore = transaction.objectStore(INTERACTION_STORE);
    const rollupStore = transaction.objectStore(ROLLUP_STORE);
    for (const rollup of rollups) rollupStore.put(rollup);
    for (const entry of exposures) exposureStore.delete(entry.id);
    for (const entry of reactions) reactionStore.delete(entry.id);
    for (const entry of interactions) interactionStore.delete(entry.id);
    await done;
    notifyChanged();
    return { exposures: exposures.length, reactions: reactions.length, interactions: interactions.length, rollups: rollups.length };
  }

  async exportArchive(): Promise<LongitudinalArchive> {
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

  async importArchive(value: unknown): Promise<boolean> {
    if (!value || typeof value !== 'object') return false;
    const archive = value as Partial<LongitudinalArchive>;
    if (archive.schema !== 'frontier-longitudinal-v1') return false;
    if (!Array.isArray(archive.exposures) || !Array.isArray(archive.reactions)
      || !Array.isArray(archive.interactions) || !Array.isArray(archive.checkins)
      || !Array.isArray(archive.rollups)) return false;
    const db = await openDb();
    const transaction = db.transaction([EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, CHECKIN_STORE, ROLLUP_STORE], 'readwrite');
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
    return true;
  }

  async clear(): Promise<void> {
    const db = await openDb();
    const transaction = db.transaction([EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, CHECKIN_STORE, ROLLUP_STORE], 'readwrite');
    const done = transactionDone(transaction);
    for (const name of [EXPOSURE_STORE, REACTION_STORE, INTERACTION_STORE, CHECKIN_STORE, ROLLUP_STORE] as StoreName[]) {
      transaction.objectStore(name).clear();
    }
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
      // Storage capacity is advisory diagnostics only.
    }
    try {
      persisted = navigator.storage.persisted ? await navigator.storage.persisted() : undefined;
    } catch {
      // Persistence reporting is optional and browser-dependent.
    }
    return {
      supported: true,
      usage: estimate.usage,
      quota: estimate.quota,
      persisted,
    };
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
