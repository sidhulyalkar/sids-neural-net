import {
  FRONTIER_LANE_IDS,
  FRONTIER_REACTIONS,
  type FrontierAmbientReactionSummary,
  type FrontierBehaviorAggregate,
  type FrontierBehaviorModel,
  type FrontierBehaviorSnapshot,
  type FrontierCollection,
  type FrontierGameState,
  type FrontierHistoryEntry,
  type FrontierItem,
  type FrontierPersistedState,
  type FrontierProfile,
  type FrontierReaction,
  type FrontierSourceKind,
} from './types';

const MAX_SAVED_ITEMS = 10_000;
const MAX_HISTORY_ITEMS = 20_000;
const MAX_COLLECTIONS = 1_000;
const MAX_MAP_KEYS = 20_000;
const MAX_ITEM_TAGS = 64;
const MAX_ITEM_AUTHORS = 128;
const MAX_COLLECTION_ITEMS = 20_000;
const MAX_STRING = 100_000;
const MAX_KEY = 512;
const MAX_JSON_NODES = 300_000;
const MAX_JSON_DEPTH = 16;
const MAX_COUNT = 1_000_000_000;
const MAX_MS = 10 ** 15;

const LANE_IDS = new Set<string>(FRONTIER_LANE_IDS);
const REACTIONS = new Set<string>(FRONTIER_REACTIONS);
const SOURCE_KINDS = new Set<FrontierSourceKind>([
  'hackernews', 'github', 'openalex', 'arxiv', 'huggingface', 'paperswithcode',
  'biorxiv', 'medrxiv', 'openreview', 'lobsters', 'nasa', 'vimeo', 'rss',
  'youtube', 'football_data', 'reddit', 'steam', 'social', 'brave_web', 'gdelt', 'local',
]);
const VIEWS = ['today', 'explore', 'saved', 'history', 'map'] as const;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validText(value: unknown, max = MAX_STRING): value is string {
  return typeof value === 'string' && value.length <= max;
}

function nonEmptyText(value: unknown, max = MAX_STRING): value is string {
  return validText(value, max) && value.length > 0;
}

function finite(value: unknown, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function integer(value: unknown, min = 0, max = MAX_COUNT): value is number {
  return finite(value, min, max) && Number.isInteger(value);
}

function iso(value: unknown): value is string {
  return validText(value, 80) && Number.isFinite(Date.parse(value));
}

function day(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const candidate = new Date(year, month - 1, date);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === date;
}

function safeJson(value: unknown): boolean {
  let nodes = 0;
  const visit = (current: unknown, depth: number): boolean => {
    nodes += 1;
    if (nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) return false;
    if (current === null || typeof current === 'boolean') return true;
    if (typeof current === 'number') return Number.isFinite(current);
    if (typeof current === 'string') return current.length <= MAX_STRING;
    if (Array.isArray(current)) {
      if (current.length > MAX_HISTORY_ITEMS) return false;
      return current.every((entry) => visit(entry, depth + 1));
    }
    if (!isObject(current)) return false;
    const keys = Object.keys(current);
    if (keys.length > MAX_MAP_KEYS) return false;
    for (const key of keys) {
      if (key.length > MAX_KEY || DANGEROUS_KEYS.has(key) || !visit(current[key], depth + 1)) return false;
    }
    return true;
  };
  return visit(value, 0);
}

function stringArray(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((entry) => nonEmptyText(entry, 2_048));
}

function numericRecord(value: unknown, maxKeys = MAX_MAP_KEYS): value is Record<string, number> {
  if (!isObject(value) || Object.keys(value).length > maxKeys) return false;
  return Object.entries(value).every(([key, entry]) => nonEmptyText(key, MAX_KEY) && finite(entry, -1_000_000, 1_000_000));
}

function validUrl(value: unknown, local = false): value is string {
  if (!nonEmptyText(value, 8_192)) return false;
  if (local && value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validMedia(value: unknown): boolean {
  if (!isObject(value) || !['image', 'youtube', 'video', 'chart', 'none'].includes(String(value.type))) return false;
  for (const key of ['url', 'proxyUrl', 'poster', 'posterProxyUrl', 'alt', 'blurHash', 'averageColor'] as const) {
    if (value[key] !== undefined && !validText(value[key], 8_192)) return false;
  }
  if (value.aspectRatio !== undefined && !['square', 'portrait', 'landscape', 'wide'].includes(String(value.aspectRatio))) return false;
  for (const key of ['width', 'height'] as const) {
    if (value[key] !== undefined && !finite(value[key], 0, 100_000)) return false;
  }
  if (value.duration !== undefined && !finite(value.duration, 0, 7 * 24 * 60 * 60)) return false;
  if (value.streams !== undefined && !Array.isArray(value.streams)) return false;
  return true;
}

function validItem(value: unknown): value is FrontierItem {
  if (!isObject(value)) return false;
  const sourceKind = value.sourceKind;
  const lane = value.lane;
  if (!nonEmptyText(value.id, 2_048) || !nonEmptyText(value.title, 20_000) || !validText(value.summary, MAX_STRING)
    || !nonEmptyText(value.source, 4_096) || !nonEmptyText(value.sourceLabel, 4_096)
    || typeof sourceKind !== 'string' || !SOURCE_KINDS.has(sourceKind as FrontierSourceKind)
    || !validUrl(value.url, sourceKind === 'local') || !iso(value.publishedAt)
    || typeof lane !== 'string' || !LANE_IDS.has(lane)
    || !stringArray(value.tags, MAX_ITEM_TAGS)) return false;

  for (const key of ['baseScore', 'importance', 'novelty', 'quality', 'momentum'] as const) {
    if (!finite(value[key], -100, 100)) return false;
  }
  if (value.authors !== undefined && !stringArray(value.authors, MAX_ITEM_AUTHORS)) return false;
  if (value.media !== undefined && !validMedia(value.media)) return false;
  if (value.metrics !== undefined) {
    if (!Array.isArray(value.metrics) || value.metrics.length > 64 || value.metrics.some((metric) => (
      !isObject(metric) || !nonEmptyText(metric.label, 2_048) || !validText(metric.value, 8_192)
      || (metric.detail !== undefined && !validText(metric.detail, 20_000))
    ))) return false;
  }
  if (value.readMinutes !== undefined && !finite(value.readMinutes, 0, 100_000)) return false;
  if (value.why !== undefined && !validText(value.why, 20_000)) return false;
  if (value.highPriority !== undefined && typeof value.highPriority !== 'boolean') return false;
  if (value.watchSignal !== undefined) {
    const signal = value.watchSignal;
    if (!isObject(signal) || !nonEmptyText(signal.intentId, 2_048) || !nonEmptyText(signal.label, 4_096)
      || !finite(signal.score, 0, 1) || !finite(signal.triggeredAt, 0)) return false;
  }
  if (value.convergence !== undefined) {
    const convergence = value.convergence;
    if (!isObject(convergence) || !Array.isArray(convergence.members) || convergence.members.length > 64
      || !Array.isArray(convergence.sourceKinds) || convergence.sourceKinds.length > 64
      || !finite(convergence.confidence, 0, 1) || !finite(convergence.windowHours, 0, 24 * 365)) return false;
    if (convergence.sourceKinds.some((kind) => typeof kind !== 'string' || !SOURCE_KINDS.has(kind as FrontierSourceKind))) return false;
    if (convergence.members.some((member) => {
      if (!isObject(member)) return true;
      return !nonEmptyText(member.id, 2_048) || !nonEmptyText(member.title, 20_000)
        || !validUrl(member.url) || !nonEmptyText(member.sourceLabel, 4_096)
        || typeof member.sourceKind !== 'string' || !SOURCE_KINDS.has(member.sourceKind as FrontierSourceKind)
        || !iso(member.publishedAt) || (member.excerpt !== undefined && !validText(member.excerpt, MAX_STRING));
    })) return false;
  }
  if (value.artifacts !== undefined) {
    if (!Array.isArray(value.artifacts) || value.artifacts.length > 64 || value.artifacts.some((artifact) => (
      !isObject(artifact) || !['formula', 'benchmark', 'repository', 'release', 'tracklist'].includes(String(artifact.kind))
      || !nonEmptyText(artifact.label, 4_096)
      || (artifact.value !== undefined && !validText(artifact.value, 20_000))
      || (artifact.url !== undefined && !validUrl(artifact.url))
    ))) return false;
  }
  if (value.velocitySignal !== undefined) {
    const velocity = value.velocitySignal;
    if (!isObject(velocity) || !nonEmptyText(velocity.concept, 4_096) || !finite(velocity.score, -100, 100)
      || !integer(velocity.recentCount) || !finite(velocity.baselineRate, 0, 1_000_000)
      || !integer(velocity.sourceCount) || !finite(velocity.detectedAt, 0)) return false;
  }
  return true;
}

function validAmbientSummary(value: unknown): value is FrontierAmbientReactionSummary {
  if (!isObject(value)) return false;
  for (const key of ['affinity', 'interest', 'surprise', 'friction', 'evidence'] as const) {
    if (!finite(value[key], 0, MAX_COUNT)) return false;
  }
  return value.lastAt === undefined || iso(value.lastAt);
}

function validAggregate(value: unknown): value is FrontierBehaviorAggregate {
  if (!isObject(value)) return false;
  for (const key of ['shown', 'dwelled', 'expanded', 'opened', 'saved', 'positive', 'negative'] as const) {
    if (!integer(value[key])) return false;
  }
  if (!finite(value.dwellMs, 0, MAX_MS)) return false;
  for (const key of ['ambientAffinity', 'ambientInterest', 'ambientSurprise', 'ambientFriction', 'ambientEvidence'] as const) {
    if (value[key] !== undefined && !finite(value[key], 0, MAX_COUNT)) return false;
  }
  return value.lastAt === undefined || iso(value.lastAt);
}

function aggregateMap(value: unknown): value is Record<string, FrontierBehaviorAggregate> {
  if (!isObject(value) || Object.keys(value).length > MAX_MAP_KEYS) return false;
  return Object.entries(value).every(([key, aggregate]) => nonEmptyText(key, MAX_KEY) && validAggregate(aggregate));
}

function validSnapshot(value: unknown): value is FrontierBehaviorSnapshot {
  return isObject(value)
    && aggregateMap(value.laneStats)
    && aggregateMap(value.sourceStats)
    && aggregateMap(value.topicStats)
    && aggregateMap(value.formatStats)
    && aggregateMap(value.contextStats)
    && iso(value.capturedAt);
}

function validBehavior(value: unknown): value is FrontierBehaviorModel {
  if (!isObject(value) || typeof value.implicitLearning !== 'boolean' || !integer(value.sessions)
    || !finite(value.totalActiveMs, 0, MAX_MS)) return false;
  if (value.sessionStartedAt !== undefined && !iso(value.sessionStartedAt)) return false;
  if (value.lastActiveAt !== undefined && !iso(value.lastActiveAt)) return false;
  for (const key of ['laneStats', 'sourceStats', 'topicStats', 'formatStats', 'timeStats', 'contextStats'] as const) {
    if (!aggregateMap(value[key])) return false;
  }
  if (!isObject(value.layoutUses) || !integer(value.layoutUses.desk) || !integer(value.layoutUses.feed)) return false;
  if (!isObject(value.viewUses) || VIEWS.some((view) => !integer(value.viewUses?.[view]))) return false;
  return value.rankingSnapshot === undefined || validSnapshot(value.rankingSnapshot);
}

function validProfile(value: unknown): value is FrontierProfile {
  if (!isObject(value) || !numericRecord(value.laneAffinity, FRONTIER_LANE_IDS.length + 8)
    || !numericRecord(value.topicAffinity) || !numericRecord(value.sourceAffinity) || !numericRecord(value.knownTopics)
    || !finite(value.curiosity, -100, 100) || !integer(value.meaningfulInteractions)) return false;
  return FRONTIER_LANE_IDS.every((lane) => finite((value.laneAffinity as Record<string, unknown>)[lane], -100, 100));
}

function validHistoryEntry(value: unknown): value is FrontierHistoryEntry {
  if (!isObject(value) || !validItem(value.item) || !iso(value.firstSeenAt) || !iso(value.lastSeenAt)
    || !integer(value.impressions) || !integer(value.resurfacedCount) || typeof value.rewarded !== 'boolean') return false;
  if (value.dwellMs !== undefined && !finite(value.dwellMs, 0, MAX_MS)) return false;
  if (value.openedAt !== undefined && !iso(value.openedAt)) return false;
  if (value.reactedAt !== undefined && !iso(value.reactedAt)) return false;
  if (value.reaction !== undefined && (typeof value.reaction !== 'string' || !REACTIONS.has(value.reaction))) return false;
  return value.ambientReaction === undefined || validAmbientSummary(value.ambientReaction);
}

function validCollection(value: unknown): value is FrontierCollection {
  return isObject(value)
    && nonEmptyText(value.id, 2_048)
    && nonEmptyText(value.name, 4_096)
    && (value.description === undefined || validText(value.description, 20_000))
    && stringArray(value.itemIds, MAX_COLLECTION_ITEMS)
    && new Set(value.itemIds as string[]).size === (value.itemIds as string[]).length
    && iso(value.createdAt);
}

function validGame(value: unknown): value is FrontierGameState {
  if (!isObject(value) || !integer(value.xp) || !integer(value.streak)
    || (value.lastActiveDay !== undefined && !day(value.lastActiveDay)) || !isObject(value.completedQuestDays)) return false;
  if (Object.keys(value.completedQuestDays).length > 10_000) return false;
  return Object.entries(value.completedQuestDays).every(([key, quests]) => day(key) && stringArray(quests, 1_000));
}

function validSaved(value: unknown): value is FrontierPersistedState['saved'] {
  if (!isObject(value) || Object.keys(value).length > MAX_SAVED_ITEMS) return false;
  return Object.entries(value).every(([key, item]) => validItem(item) && item.id === key);
}

function validHistory(value: unknown): value is FrontierPersistedState['history'] {
  if (!isObject(value) || Object.keys(value).length > MAX_HISTORY_ITEMS) return false;
  return Object.entries(value).every(([key, entry]) => validHistoryEntry(entry) && entry.item.id === key);
}

export function parsePrivateFrontierState(value: unknown): FrontierPersistedState | null {
  if (!safeJson(value) || !isObject(value) || value.version !== 2) return null;
  if (!validProfile(value.profile) || !validBehavior(value.behavior) || !validSaved(value.saved)
    || !Array.isArray(value.collections) || value.collections.length > MAX_COLLECTIONS
    || !value.collections.every(validCollection) || !validHistory(value.history) || !validGame(value.game)) return null;
  const collectionIds = value.collections.map((collection) => collection.id);
  if (new Set(collectionIds).size !== collectionIds.length) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as FrontierPersistedState;
  } catch {
    return null;
  }
}
