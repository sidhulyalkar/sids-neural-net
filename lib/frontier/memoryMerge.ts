import { createInitialBehaviorModel } from './behavior';
import { createInitialProfile, DEFAULT_COLLECTIONS } from './config';
import { migrateFrontierProfile } from './profileMigration';
import type {
  FrontierBehaviorAggregate,
  FrontierBehaviorModel,
  FrontierCollection,
  FrontierGameState,
  FrontierHistoryEntry,
  FrontierPersistedState,
  FrontierProfile,
} from './types';

const CLOUD_HISTORY_LIMIT = 900;

function objectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function parseFrontierPersistedState(value: unknown): FrontierPersistedState | null {
  if (!objectRecord(value)) return null;
  if (!objectRecord(value.profile) || !objectRecord(value.behavior)) return null;
  if (!objectRecord(value.saved) || !objectRecord(value.history)) return null;
  if (!Array.isArray(value.collections) || !objectRecord(value.game)) return null;
  return {
    version: 4,
    profile: migrateFrontierProfile(value.profile as FrontierProfile),
    behavior: value.behavior as FrontierBehaviorModel,
    saved: value.saved as FrontierPersistedState['saved'],
    collections: value.collections as FrontierCollection[],
    history: value.history as FrontierPersistedState['history'],
    game: value.game as FrontierGameState,
  };
}

function mergeNumericMap(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries(Array.from(keys).map((key) => {
    const a = left[key];
    const b = right[key];
    if (a === undefined) return [key, b ?? 0];
    if (b === undefined) return [key, a];
    return [key, Math.abs(a) >= Math.abs(b) ? a : b];
  }));
}

function mergeProfile(left: FrontierProfile, right: FrontierProfile): FrontierProfile {
  return migrateFrontierProfile({
    laneAffinity: mergeNumericMap(left.laneAffinity, right.laneAffinity) as FrontierProfile['laneAffinity'],
    topicAffinity: mergeNumericMap(left.topicAffinity, right.topicAffinity),
    sourceAffinity: mergeNumericMap(left.sourceAffinity, right.sourceAffinity),
    interestPairs: mergeNumericMap(left.interestPairs ?? {}, right.interestPairs ?? {}),
    knownTopics: mergeNumericMap(left.knownTopics, right.knownTopics),
    curiosity: Math.max(left.curiosity, right.curiosity),
    meaningfulInteractions: Math.max(left.meaningfulInteractions, right.meaningfulInteractions),
  });
}

function mergeAggregate(left?: FrontierBehaviorAggregate, right?: FrontierBehaviorAggregate): FrontierBehaviorAggregate | undefined {
  if (!left) return right;
  if (!right) return left;
  return {
    shown: Math.max(left.shown, right.shown),
    dwelled: Math.max(left.dwelled, right.dwelled),
    expanded: Math.max(left.expanded, right.expanded),
    opened: Math.max(left.opened, right.opened),
    saved: Math.max(left.saved, right.saved),
    positive: Math.max(left.positive, right.positive),
    negative: Math.max(left.negative, right.negative),
    dwellMs: Math.max(left.dwellMs, right.dwellMs),
    lastAt: [left.lastAt, right.lastAt].filter((value): value is string => Boolean(value)).sort().at(-1),
  };
}

function mergeAggregateMap(
  left: Record<string, FrontierBehaviorAggregate>,
  right: Record<string, FrontierBehaviorAggregate>
): Record<string, FrontierBehaviorAggregate> {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const out: Record<string, FrontierBehaviorAggregate> = {};
  for (const key of keys) {
    const merged = mergeAggregate(left[key], right[key]);
    if (merged) out[key] = merged;
  }
  return out;
}

function newestOptional(left?: string, right?: string): string | undefined {
  return [left, right].filter((value): value is string => Boolean(value)).sort().at(-1);
}

function mergeBehavior(left: FrontierBehaviorModel, right: FrontierBehaviorModel): FrontierBehaviorModel {
  const initial = createInitialBehaviorModel();
  const leftSnapshotAt = left.rankingSnapshot?.capturedAt ?? '';
  const rightSnapshotAt = right.rankingSnapshot?.capturedAt ?? '';
  return {
    implicitLearning: left.implicitLearning && right.implicitLearning,
    sessions: Math.max(left.sessions, right.sessions),
    sessionStartedAt: undefined,
    lastActiveAt: newestOptional(left.lastActiveAt, right.lastActiveAt),
    totalActiveMs: Math.max(left.totalActiveMs, right.totalActiveMs),
    laneStats: mergeAggregateMap(left.laneStats ?? initial.laneStats, right.laneStats ?? initial.laneStats),
    sourceStats: mergeAggregateMap(left.sourceStats ?? initial.sourceStats, right.sourceStats ?? initial.sourceStats),
    topicStats: mergeAggregateMap(left.topicStats ?? initial.topicStats, right.topicStats ?? initial.topicStats),
    formatStats: mergeAggregateMap(left.formatStats ?? initial.formatStats, right.formatStats ?? initial.formatStats),
    timeStats: mergeAggregateMap(left.timeStats ?? initial.timeStats, right.timeStats ?? initial.timeStats),
    contextStats: mergeAggregateMap(left.contextStats ?? initial.contextStats, right.contextStats ?? initial.contextStats),
    layoutUses: {
      desk: Math.max(left.layoutUses?.desk ?? 0, right.layoutUses?.desk ?? 0),
      feed: Math.max(left.layoutUses?.feed ?? 0, right.layoutUses?.feed ?? 0),
    },
    viewUses: {
      today: Math.max(left.viewUses?.today ?? 0, right.viewUses?.today ?? 0),
      explore: Math.max(left.viewUses?.explore ?? 0, right.viewUses?.explore ?? 0),
      saved: Math.max(left.viewUses?.saved ?? 0, right.viewUses?.saved ?? 0),
      history: Math.max(left.viewUses?.history ?? 0, right.viewUses?.history ?? 0),
      map: Math.max(left.viewUses?.map ?? 0, right.viewUses?.map ?? 0),
    },
    rankingSnapshot: rightSnapshotAt > leftSnapshotAt ? right.rankingSnapshot : left.rankingSnapshot,
  };
}

function reactionOwner(left: FrontierHistoryEntry, right: FrontierHistoryEntry): FrontierHistoryEntry | undefined {
  if (left.reactedAt && right.reactedAt) return right.reactedAt >= left.reactedAt ? right : left;
  if (left.reactedAt) return left;
  if (right.reactedAt) return right;
  // Backward compatibility for older history entries that may carry a reaction
  // without reactedAt. In that case only, fall back to the most recently seen
  // copy rather than discarding the reaction entirely.
  const latest = right.lastSeenAt >= left.lastSeenAt ? right : left;
  if (latest.reaction) return latest;
  if (left.reaction) return left;
  if (right.reaction) return right;
  return undefined;
}

function mergeHistoryEntry(left: FrontierHistoryEntry, right: FrontierHistoryEntry): FrontierHistoryEntry {
  const latest = right.lastSeenAt >= left.lastSeenAt ? right : left;
  const latestReaction = reactionOwner(left, right);
  return {
    ...latest,
    firstSeenAt: left.firstSeenAt <= right.firstSeenAt ? left.firstSeenAt : right.firstSeenAt,
    lastSeenAt: left.lastSeenAt >= right.lastSeenAt ? left.lastSeenAt : right.lastSeenAt,
    impressions: Math.max(left.impressions, right.impressions),
    dwellMs: Math.max(left.dwellMs ?? 0, right.dwellMs ?? 0) || undefined,
    openedAt: newestOptional(left.openedAt, right.openedAt),
    reactedAt: latestReaction?.reactedAt ?? newestOptional(left.reactedAt, right.reactedAt),
    reaction: latestReaction?.reaction,
    resurfacedCount: Math.max(left.resurfacedCount, right.resurfacedCount),
    rewarded: left.rewarded || right.rewarded,
  };
}

function mergeCollections(left: FrontierCollection[], right: FrontierCollection[]): FrontierCollection[] {
  const byId = new Map<string, FrontierCollection>();
  for (const collection of [...DEFAULT_COLLECTIONS, ...left, ...right]) {
    const existing = byId.get(collection.id);
    if (!existing) {
      byId.set(collection.id, { ...collection, itemIds: [...collection.itemIds] });
      continue;
    }
    byId.set(collection.id, {
      ...existing,
      ...collection,
      createdAt: existing.createdAt <= collection.createdAt ? existing.createdAt : collection.createdAt,
      itemIds: Array.from(new Set([...existing.itemIds, ...collection.itemIds])),
    });
  }
  return Array.from(byId.values());
}

function mergeGame(left: FrontierGameState, right: FrontierGameState): FrontierGameState {
  const dayKeys = new Set([...Object.keys(left.completedQuestDays), ...Object.keys(right.completedQuestDays)]);
  const completedQuestDays = Object.fromEntries(Array.from(dayKeys).map((day) => [
    day,
    Array.from(new Set([...(left.completedQuestDays[day] ?? []), ...(right.completedQuestDays[day] ?? [])])),
  ]));
  return {
    xp: Math.max(left.xp, right.xp),
    streak: Math.max(left.streak, right.streak),
    lastActiveDay: newestOptional(left.lastActiveDay, right.lastActiveDay),
    completedQuestDays,
  };
}

export function mergeFrontierMemory(
  leftValue: FrontierPersistedState | null | undefined,
  rightValue: FrontierPersistedState | null | undefined
): FrontierPersistedState {
  const initial: FrontierPersistedState = {
    version: 4,
    profile: createInitialProfile(),
    behavior: createInitialBehaviorModel(),
    saved: {},
    collections: DEFAULT_COLLECTIONS.map((collection) => ({ ...collection, itemIds: [] })),
    history: {},
    game: { xp: 0, streak: 0, completedQuestDays: {} },
  };
  const left = leftValue ?? initial;
  const right = rightValue ?? initial;
  const historyKeys = new Set([...Object.keys(left.history), ...Object.keys(right.history)]);
  const history: FrontierPersistedState['history'] = {};
  for (const key of historyKeys) {
    const a = left.history[key];
    const b = right.history[key];
    const entry = a && b ? mergeHistoryEntry(a, b) : (a ?? b);
    if (entry) history[key] = entry;
  }
  return {
    version: 4,
    profile: mergeProfile(left.profile, right.profile),
    behavior: mergeBehavior(left.behavior, right.behavior),
    saved: { ...left.saved, ...right.saved },
    collections: mergeCollections(left.collections, right.collections),
    history,
    game: mergeGame(left.game, right.game),
  };
}

export function compactFrontierCloudMemory(
  state: FrontierPersistedState,
  historyLimit = CLOUD_HISTORY_LIMIT
): FrontierPersistedState {
  const savedIds = new Set(Object.keys(state.saved));
  const entries = Object.entries(state.history)
    .sort(([, a], [, b]) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  const protectedEntries = entries.filter(([id, entry]) => savedIds.has(id) || Boolean(entry.reaction) || Boolean(entry.openedAt));
  const protectedIds = new Set(protectedEntries.slice(0, historyLimit).map(([id]) => id));
  const remainingSlots = Math.max(0, historyLimit - protectedIds.size);
  for (const [id] of entries) {
    if (protectedIds.size >= historyLimit || remainingSlots <= 0) break;
    protectedIds.add(id);
  }
  const history = Object.fromEntries(entries.filter(([id]) => protectedIds.has(id)).slice(0, historyLimit));
  return {
    ...state,
    history,
  };
}
