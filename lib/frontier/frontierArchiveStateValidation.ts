import {
  FRONTIER_ACQUISITION_QUERY_KINDS,
  FRONTIER_LANE_IDS,
  FRONTIER_REACTIONS,
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
  type FrontierVideoStream,
} from './types';

const MAX_SAVED_ITEMS = 10_000;
const MAX_HISTORY_ITEMS = 20_000;
const MAX_COLLECTIONS = 1_000;
const MAX_MAP_KEYS = 20_000;
const MAX_ITEM_TAGS = 64;
const MAX_ITEM_AUTHORS = 128;
const MAX_ITEM_ACQUISITION_QUERIES = 8;
const MAX_ITEM_ACQUISITION_QUERY_LENGTH = 2_048;
const MAX_COLLECTION_ITEMS = 20_000;
const MAX_STRING = 100_000;
const MAX_KEY = 512;
const MAX_JSON_NODES = 300_000;
const MAX_JSON_DEPTH = 18;
const MAX_COUNT = 1_000_000_000;
const MAX_MS = 10 ** 15;
const MAX_MEDIA_STREAMS = 32;
const MAX_MEDIA_SEGMENTS = 20_000;

const LANE_IDS = new Set<string>(FRONTIER_LANE_IDS);
const REACTIONS = new Set<string>(FRONTIER_REACTIONS);
const ACQUISITION_QUERY_KINDS = new Set<string>(FRONTIER_ACQUISITION_QUERY_KINDS);
const SOURCE_KINDS = new Set<FrontierSourceKind>([
  'hackernews', 'github', 'openalex', 'arxiv', 'huggingface', 'paperswithcode',
  'biorxiv', 'medrxiv', 'openreview', 'lobsters', 'nasa', 'vimeo', 'rss',
  'youtube', 'football_data', 'sports_state', 'reddit', 'steam', 'social',
  'brave_web', 'gdelt', 'local',
]);
const VIEWS = ['today', 'explore', 'saved', 'history', 'map'] as const;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type AmbientAggregateFields = {
  ambientAffinity?: number;
  ambientInterest?: number;
  ambientSurprise?: number;
  ambientFriction?: number;
  ambientEvidence?: number;
};

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
  return Object.entries(value).every(([key, entry]) => (
    nonEmptyText(key, MAX_KEY) && !DANGEROUS_KEYS.has(key) && finite(entry, -1_000_000, 1_000_000)
  ));
}

function validUrl(value: unknown, local = false): value is string {
  if (!nonEmptyText(value, 8_192)) return false;
  if (local && value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validSegment(value: unknown): boolean {
  return isObject(value)
    && validUrl(value.url)
    && finite(value.duration, 0, 24 * 60 * 60)
    && (value.byteLength === undefined || integer(value.byteLength, 0, 10 ** 12));
}

function validVideoStream(value: unknown): value is FrontierVideoStream {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'progressive') {
    return validUrl(value.url) && (value.mimeType === undefined || validText(value.mimeType, 256));
  }
  if (value.kind === 'hls') return validUrl(value.manifestUrl);
  if (value.kind !== 'frontier-fmp4' || !validUrl(value.initUrl) || !Array.isArray(value.variants)
    || value.variants.length > MAX_MEDIA_STREAMS) return false;
  return value.variants.every((variant) => {
    if (!isObject(variant) || !nonEmptyText(variant.id, 512) || !finite(variant.width, 1, 100_000)
      || !finite(variant.height, 1, 100_000) || !finite(variant.bitrate, 0, 10 ** 10)
      || !nonEmptyText(variant.codec, 512) || !nonEmptyText(variant.mimeType, 512)
      || (variant.fps !== undefined && !finite(variant.fps, 0, 1_000))
      || !Array.isArray(variant.segments) || variant.segments.length > MAX_MEDIA_SEGMENTS) return false;
    return variant.segments.every(validSegment);
  });
}

function validMedia(value: unknown): boolean {
  if (!isObject(value) || !['image', 'youtube', 'video', 'chart', 'none'].includes(String(value.type))) return false;
  for (const key of ['url', 'proxyUrl', 'poster', 'posterProxyUrl'] as const) {
    if (value[key] !== undefined && !validUrl(value[key], true)) return false;
  }
  for (const key of ['alt', 'blurHash', 'averageColor'] as const) {
    if (value[key] !== undefined && !validText(value[key], 8_192)) return false;
  }
  if (value.aspectRatio !== undefined && !['square', 'portrait', 'landscape', 'wide'].includes(String(value.aspectRatio))) return false;
  for (const key of ['width', 'height'] as const) {
    if (value[key] !== undefined && !finite(value[key], 0, 100_000)) return false;
  }
  if (value.duration !== undefined && !finite(value.duration, 0, 7 * 24 * 60 * 60)) return false;
  if (value.streams !== undefined) {
    if (!Array.isArray(value.streams) || value.streams.length > MAX_MEDIA_STREAMS || !value.streams.every(validVideoStream)) return false;
  }
  return true;
}

function validSportsState(value: unknown): boolean {
  if (!isObject(value) || typeof value.kind !== 'string' || !nonEmptyText(value.league, 256) || !nonEmptyText(value.leagueLabel, 1_024)) return false;
  if (value.kind === 'scoreboard') {
    if (!Array.isArray(value.games) || value.games.length > 1_000) return false;
    return value.games.every((game) => {
      if (!isObject(game) || !nonEmptyText(game.id, 1_024) || !iso(game.date) || !nonEmptyText(game.status, 1_024)
        || typeof game.live !== 'boolean' || typeof game.completed !== 'boolean'
        || !Array.isArray(game.competitors) || game.competitors.length > 32
        || (game.detail !== undefined && !validText(game.detail, 8_192))
        || (game.url !== undefined && !validUrl(game.url))) return false;
      return game.competitors.every((competitor) => isObject(competitor)
        && nonEmptyText(competitor.name, 2_048) && nonEmptyText(competitor.shortName, 2_048)
        && nonEmptyText(competitor.abbreviation, 128));
    });
  }
  if (value.kind === 'standings') {
    if (!Array.isArray(value.standings) || value.standings.length > 1_000) return false;
    return value.standings.every((standing) => isObject(standing)
      && integer(standing.rank, 0, 1_000_000) && nonEmptyText(standing.team, 2_048)
      && nonEmptyText(standing.abbreviation, 128));
  }
  return false;
}

function validAcquisition(value: unknown): boolean {
  if (!isObject(value)) return false;
  const rootKeys = Object.keys(value);
  if (rootKeys.length !== 1 || rootKeys[0] !== 'queries') return false;
  if (!Array.isArray(value.queries) || value.queries.length === 0 || value.queries.length > MAX_ITEM_ACQUISITION_QUERIES) return false;

  const unique = new Set<string>();
  for (const observation of value.queries) {
    if (!isObject(observation)) return false;
    const keys = Object.keys(observation);
    if (keys.length !== 2 || keys.some((key) => key !== 'kind' && key !== 'query')) return false;
    if (typeof observation.kind !== 'string' || !ACQUISITION_QUERY_KINDS.has(observation.kind)) return false;
    if (!nonEmptyText(observation.query, MAX_ITEM_ACQUISITION_QUERY_LENGTH)) return false;
    const canonical = observation.query.normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (canonical !== observation.query) return false;
    const identity = `${observation.kind}\u0000${canonical.toLocaleLowerCase('en-US')}`;
    if (unique.has(identity)) return false;
    unique.add(identity);
  }
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
    || !stringArray(value.tags, MAX_ITEM_TAGS) || new Set((value.tags as string[]).map((tag) => tag.trim().toLowerCase())).size !== (value.tags as string[]).length) return false;

  for (const key of ['baseScore', 'importance', 'novelty', 'quality', 'momentum'] as const) {
    if (!finite(value[key], -100, 100)) return false;
  }
  if (value.acquisition !== undefined && (sourceKind !== 'openalex' || !validAcquisition(value.acquisition))) return false;
  if (value.authors !== undefined && !stringArray(value.authors, MAX_ITEM_AUTHORS)) return false;
  if (value.media !== undefined && !validMedia(value.media)) return false;
  if (value.metrics !== undefined) {
    if (!Array.isArray(value.metrics) || value.metrics.length > 64 || value.metrics.some((metric) => (
      !isObject(metric) || !nonEmptyText(metric.label, 2_048) || !validText(metric.value, 8_192)
      || (metric.detail !== undefined && !validText(metric.detail, 20_000))
    ))) return false;
  }
  if (value.sportsState !== undefined && !validSportsState(value.sportsState)) return false;
  if (value.actionLabel !== undefined && !validText(value.actionLabel, 4_096)) return false;
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

function validAggregate(value: unknown): value is FrontierBehaviorAggregate {
  if (!isObject(value)) return false;
  for (const key of ['shown', 'dwelled', 'expanded', 'opened', 'saved', 'positive', 'negative'] as const) {
    if (!integer(value[key])) return false;
  }
  if (!finite(value.dwellMs, 0, MAX_MS)) return false;
  const ambient = value as Record<keyof AmbientAggregateFields, unknown>;
  for (const key of ['ambientAffinity', 'ambientInterest', 'ambientSurprise', 'ambientFriction', 'ambientEvidence'] as const) {
    if (ambient[key] !== undefined && !finite(ambient[key], 0, MAX_COUNT)) return false;
  }
  return value.lastAt === undefined || iso(value.lastAt);
}

function aggregateMap(value: unknown): value is Record<string, FrontierBehaviorAggregate> {
  if (!isObject(value) || Object.keys(value).length > MAX_MAP_KEYS) return false;
  return Object.entries(value).every(([key, aggregate]) => nonEmptyText(key, MAX_KEY) && !DANGEROUS_KEYS.has(key) && validAggregate(aggregate));
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
  const viewUses = value.viewUses;
  if (!isObject(viewUses) || VIEWS.some((view) => !integer(viewUses[view]))) return false;
  return value.rankingSnapshot === undefined || validSnapshot(value.rankingSnapshot);
}

function validProfile(value: unknown): value is FrontierProfile {
  if (!isObject(value) || !numericRecord(value.laneAffinity, FRONTIER_LANE_IDS.length + 8)
    || !numericRecord(value.topicAffinity) || !numericRecord(value.sourceAffinity)
    || !numericRecord(value.interestPairs) || !numericRecord(value.knownTopics)
    || !finite(value.curiosity, -100, 100) || !integer(value.meaningfulInteractions)) return false;
  return FRONTIER_LANE_IDS.every((lane) => finite((value.laneAffinity as Record<string, unknown>)[lane], -100, 100));
}

function validHistoryEntry(value: unknown): value is FrontierHistoryEntry {
  if (!isObject(value) || !validItem(value.item) || !iso(value.firstSeenAt) || !iso(value.lastSeenAt)
    || Date.parse(value.lastSeenAt as string) < Date.parse(value.firstSeenAt as string)
    || !integer(value.impressions) || !integer(value.resurfacedCount) || typeof value.rewarded !== 'boolean') return false;
  if (value.dwellMs !== undefined && !finite(value.dwellMs, 0, MAX_MS)) return false;
  if (value.openedAt !== undefined && !iso(value.openedAt)) return false;
  if (value.reactedAt !== undefined && !iso(value.reactedAt)) return false;
  if (value.reaction !== undefined && (typeof value.reaction !== 'string' || !REACTIONS.has(value.reaction))) return false;
  return true;
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
  return Object.entries(value.completedQuestDays).every(([key, quests]) => (
    day(key) && stringArray(quests, 1_000) && new Set(quests as string[]).size === (quests as string[]).length
  ));
}

function validSaved(value: unknown): value is FrontierPersistedState['saved'] {
  if (!isObject(value) || Object.keys(value).length > MAX_SAVED_ITEMS) return false;
  return Object.entries(value).every(([key, item]) => validItem(item) && item.id === key);
}

function validHistory(value: unknown): value is FrontierPersistedState['history'] {
  if (!isObject(value) || Object.keys(value).length > MAX_HISTORY_ITEMS) return false;
  return Object.entries(value).every(([key, entry]) => validHistoryEntry(entry) && entry.item.id === key);
}

/**
 * Strict parser for complete private archives. This does not replace the legacy
 * compatibility migration used by the older FRONTIER-only backup importer.
 */
export function parsePrivateFrontierState(value: unknown): FrontierPersistedState | null {
  if (!safeJson(value) || !isObject(value) || value.version !== 4) return null;
  if (!validProfile(value.profile) || !validBehavior(value.behavior) || !validSaved(value.saved)
    || !Array.isArray(value.collections) || value.collections.length > MAX_COLLECTIONS
    || !value.collections.every(validCollection) || !validHistory(value.history) || !validGame(value.game)) return null;
  const collectionIds = value.collections.map((collection) => collection.id);
  if (new Set(collectionIds).size !== collectionIds.length) return null;
  const savedIds = new Set(Object.keys(value.saved as Record<string, unknown>));
  for (const collection of value.collections as FrontierCollection[]) {
    if (collection.itemIds.some((itemId) => !savedIds.has(itemId))) return null;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as FrontierPersistedState;
  } catch {
    return null;
  }
}
