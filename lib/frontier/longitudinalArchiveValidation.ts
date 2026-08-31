import type {
  LongitudinalArchive,
  LongitudinalCheckin,
  LongitudinalExposure,
  LongitudinalInteraction,
  LongitudinalInteractionKind,
  LongitudinalItemContext,
  LongitudinalReactionEpisode,
  LongitudinalReactionReview,
  LongitudinalRollup,
  LongitudinalRollupDimension,
  LongitudinalScale,
} from './longitudinal';
import {
  FRONTIER_LANE_IDS,
  FRONTIER_REACTIONS,
  type FrontierAmbientReactionKind,
  type FrontierReaction,
  type FrontierSourceKind,
} from './types';

export const LONGITUDINAL_ARCHIVE_LIMITS = {
  exposures: 100_000,
  reactions: 100_000,
  interactions: 100_000,
  checkins: 20_000,
  rollups: 100_000,
  totalRecords: 250_000,
} as const;

const MAX_TEXT = 512;
const MAX_TAG = 128;
const MAX_SESSION_TEXT = 256;
const MAX_RAW_EXPOSURE_MS = 4 * 60 * 60_000;
const MAX_REACTION_DURATION_MS = 30_000;
const MAX_REACTION_LATENCY_MS = 30 * 60_000;
const MAX_INTERACTION_DWELL_MS = 120_000;
const MAX_ROLLUP_EXPOSURE_MS = 7 * 24 * 60 * 60_000;

const LANE_IDS = new Set<string>(FRONTIER_LANE_IDS);
const EXPLICIT_REACTIONS = new Set<string>(FRONTIER_REACTIONS);
const AMBIENT_KINDS = new Set<FrontierAmbientReactionKind>(['affinity', 'interest', 'surprise', 'friction']);
const INTERACTION_KINDS = new Set<LongitudinalInteractionKind>(['dwell', 'expand', 'open', 'save', 'unsave', 'reaction']);
const ROLLUP_DIMENSIONS = new Set<LongitudinalRollupDimension>(['lane', 'topic', 'format']);
const SOURCE_KINDS = new Set<FrontierSourceKind>([
  'hackernews', 'github', 'openalex', 'arxiv', 'huggingface', 'paperswithcode',
  'biorxiv', 'medrxiv', 'openreview', 'lobsters', 'nasa', 'vimeo', 'rss',
  'youtube', 'football_data', 'reddit', 'steam', 'social', 'brave_web', 'gdelt', 'local',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) return null;
  return value;
}

function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  const parsed = finite(value, min, max);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function scale(value: unknown): LongitudinalScale | null {
  const parsed = integer(value, 1, 5);
  return parsed === null ? null : parsed as LongitudinalScale;
}

function day(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const candidate = new Date(year, month - 1, date);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== date) return null;
  return value;
}

function iso(value: unknown): string | null {
  const parsed = text(value, 80);
  return parsed !== null && Number.isFinite(Date.parse(parsed)) ? parsed : null;
}

function tags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const parsed = text(entry, MAX_TAG);
    if (!parsed || parsed.trim() !== parsed || seen.has(parsed)) return null;
    seen.add(parsed);
    result.push(parsed);
  }
  return result;
}

function context(value: Record<string, unknown>): LongitudinalItemContext | null {
  const itemId = text(value.itemId, MAX_SESSION_TEXT);
  const lane = text(value.lane, 64);
  const parsedTags = tags(value.tags);
  const sourceKind = text(value.sourceKind, 64);
  const format = text(value.format, 64);
  if (!itemId || !lane || !LANE_IDS.has(lane) || !parsedTags || !sourceKind || !SOURCE_KINDS.has(sourceKind as FrontierSourceKind) || !format) return null;
  return {
    itemId,
    lane: lane as LongitudinalItemContext['lane'],
    tags: parsedTags,
    sourceKind: sourceKind as FrontierSourceKind,
    format,
  };
}

function parseExposure(value: unknown): LongitudinalExposure | null {
  if (!isObject(value)) return null;
  const shared = context(value);
  const id = text(value.id, MAX_SESSION_TEXT);
  const sessionId = text(value.sessionId, MAX_SESSION_TEXT);
  const startedAt = finite(value.startedAt);
  const endedAt = finite(value.endedAt);
  const dayKey = day(value.dayKey);
  const durationMs = finite(value.durationMs, 0, MAX_RAW_EXPOSURE_MS);
  const attributionMean = finite(value.attributionMean, 0, 1);
  const attributionMin = finite(value.attributionMin, 0, 1);
  const visibleFractionMean = finite(value.visibleFractionMean, 0, 1);
  if (!shared || !id || !sessionId || startedAt === null || endedAt === null || endedAt < startedAt || !dayKey
    || durationMs === null || attributionMean === null || attributionMin === null || attributionMin > attributionMean
    || visibleFractionMean === null) return null;
  return { id, sessionId, ...shared, startedAt, endedAt, dayKey, durationMs, attributionMean, attributionMin, visibleFractionMean };
}

function parseReaction(value: unknown): LongitudinalReactionEpisode | null {
  if (!isObject(value)) return null;
  const shared = context(value);
  const id = text(value.id, MAX_SESSION_TEXT);
  const sessionId = text(value.sessionId, MAX_SESSION_TEXT);
  const exposureId = text(value.exposureId, MAX_SESSION_TEXT);
  const occurredAt = finite(value.occurredAt);
  const dayKey = day(value.dayKey);
  const kind = text(value.kind, 32);
  const confidence = finite(value.confidence, 0, 1);
  const intensity = finite(value.intensity, 0, 1);
  const durationMs = finite(value.durationMs, 0, MAX_REACTION_DURATION_MS);
  const latencyMs = finite(value.latencyMs, 0, MAX_REACTION_LATENCY_MS);
  const targetScore = finite(value.targetScore, 0, 1);
  const visibleFraction = finite(value.visibleFraction, 0, 1);
  const trustAuthority = finite(value.trustAuthority, 0, 2);
  if (!shared || !id || !sessionId || !exposureId || occurredAt === null || !dayKey || !kind
    || !AMBIENT_KINDS.has(kind as FrontierAmbientReactionKind) || confidence === null || intensity === null
    || durationMs === null || latencyMs === null || targetScore === null || visibleFraction === null || trustAuthority === null) return null;

  let review: LongitudinalReactionReview | undefined;
  if (value.review !== undefined) {
    if (value.review !== 'confirmed' && value.review !== 'contradicted') return null;
    review = value.review;
  }
  let reviewedAt: number | undefined;
  if (value.reviewedAt !== undefined) {
    const parsed = finite(value.reviewedAt);
    if (parsed === null) return null;
    reviewedAt = parsed;
  }
  if ((review === undefined) !== (reviewedAt === undefined)) return null;

  const parsed: LongitudinalReactionEpisode = {
    id, sessionId, exposureId, ...shared, occurredAt, dayKey,
    kind: kind as FrontierAmbientReactionKind,
    confidence, intensity, durationMs, latencyMs, targetScore, visibleFraction, trustAuthority,
  };
  if (review !== undefined && reviewedAt !== undefined) {
    parsed.review = review;
    parsed.reviewedAt = reviewedAt;
  }
  return parsed;
}

function parseInteraction(value: unknown): LongitudinalInteraction | null {
  if (!isObject(value)) return null;
  const shared = context(value);
  const id = text(value.id, MAX_SESSION_TEXT);
  const sessionId = text(value.sessionId, MAX_SESSION_TEXT);
  const at = finite(value.at);
  const dayKey = day(value.dayKey);
  const kind = text(value.kind, 32);
  if (!shared || !id || !sessionId || at === null || !dayKey || !kind || !INTERACTION_KINDS.has(kind as LongitudinalInteractionKind)) return null;

  let dwellMs: number | undefined;
  if (value.dwellMs !== undefined) {
    const parsed = finite(value.dwellMs, 0, MAX_INTERACTION_DWELL_MS);
    if (parsed === null) return null;
    dwellMs = parsed;
  }
  let reaction: FrontierReaction | undefined;
  if (value.reaction !== undefined) {
    if (typeof value.reaction !== 'string' || !EXPLICIT_REACTIONS.has(value.reaction)) return null;
    reaction = value.reaction as FrontierReaction;
  }
  const parsedKind = kind as LongitudinalInteractionKind;
  if ((parsedKind === 'dwell') !== (dwellMs !== undefined)) return null;
  if ((parsedKind === 'reaction') !== (reaction !== undefined)) return null;

  const parsed: LongitudinalInteraction = { id, sessionId, ...shared, at, dayKey, kind: parsedKind };
  if (dwellMs !== undefined) parsed.dwellMs = dwellMs;
  if (reaction !== undefined) parsed.reaction = reaction;
  return parsed;
}

function parseCheckin(value: unknown): LongitudinalCheckin | null {
  if (!isObject(value)) return null;
  const id = text(value.id, MAX_SESSION_TEXT);
  const at = finite(value.at);
  const dayKey = day(value.dayKey);
  const mood = scale(value.mood);
  const energy = scale(value.energy);
  const focus = scale(value.focus);
  if (!id || at === null || !dayKey || mood === null || energy === null || focus === null) return null;
  return { id, at, dayKey, mood, energy, focus };
}

function parseRollup(value: unknown): LongitudinalRollup | null {
  if (!isObject(value)) return null;
  const id = text(value.id);
  const batchId = text(value.batchId, MAX_SESSION_TEXT);
  const dayKey = day(value.dayKey);
  const dimension = text(value.dimension, 32);
  const key = text(value.key);
  const exposureMs = finite(value.exposureMs, 0, MAX_ROLLUP_EXPOSURE_MS);
  const exposures = integer(value.exposures, 0, 1_000_000);
  const reactions = integer(value.reactions, 0, 1_000_000);
  const explicitInteractions = integer(value.explicitInteractions, 0, 1_000_000);
  const confirmed = integer(value.confirmed, 0, 1_000_000);
  const contradicted = integer(value.contradicted, 0, 1_000_000);
  const affinity = integer(value.affinity, 0, 1_000_000);
  const interest = integer(value.interest, 0, 1_000_000);
  const surprise = integer(value.surprise, 0, 1_000_000);
  const friction = integer(value.friction, 0, 1_000_000);
  const confidenceSum = finite(value.confidenceSum, 0, 1_000_000);
  const intensitySum = finite(value.intensitySum, 0, 1_000_000);
  const compactedAt = finite(value.compactedAt);
  if (!id || !batchId || !dayKey || !dimension || !ROLLUP_DIMENSIONS.has(dimension as LongitudinalRollupDimension) || !key
    || exposureMs === null || exposures === null || reactions === null || explicitInteractions === null
    || confirmed === null || contradicted === null || affinity === null || interest === null || surprise === null || friction === null
    || confidenceSum === null || intensitySum === null || compactedAt === null) return null;
  if (confirmed + contradicted > reactions) return null;
  if (affinity + interest + surprise + friction !== reactions) return null;
  if (confidenceSum > reactions + 1e-9 || intensitySum > reactions + 1e-9) return null;
  return {
    id, batchId, dayKey, dimension: dimension as LongitudinalRollupDimension, key,
    exposureMs, exposures, reactions, explicitInteractions, confirmed, contradicted,
    affinity, interest, surprise, friction, confidenceSum, intensitySum, compactedAt,
  };
}

function parseArray<T extends { id: string }>(
  value: unknown,
  max: number,
  parser: (entry: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const result: T[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    const parsed = parser(entry);
    if (!parsed || seenIds.has(parsed.id)) return null;
    seenIds.add(parsed.id);
    result.push(parsed);
  }
  return result;
}

export function parseLongitudinalArchive(value: unknown): LongitudinalArchive | null {
  if (!isObject(value) || value.schema !== 'frontier-longitudinal-v1') return null;
  const exportedAt = iso(value.exportedAt);
  if (!exportedAt) return null;
  if (![value.exposures, value.reactions, value.interactions, value.checkins, value.rollups].every(Array.isArray)) return null;
  const total = (value.exposures as unknown[]).length + (value.reactions as unknown[]).length
    + (value.interactions as unknown[]).length + (value.checkins as unknown[]).length + (value.rollups as unknown[]).length;
  if (total > LONGITUDINAL_ARCHIVE_LIMITS.totalRecords) return null;

  const exposures = parseArray(value.exposures, LONGITUDINAL_ARCHIVE_LIMITS.exposures, parseExposure);
  const reactions = parseArray(value.reactions, LONGITUDINAL_ARCHIVE_LIMITS.reactions, parseReaction);
  const interactions = parseArray(value.interactions, LONGITUDINAL_ARCHIVE_LIMITS.interactions, parseInteraction);
  const checkins = parseArray(value.checkins, LONGITUDINAL_ARCHIVE_LIMITS.checkins, parseCheckin);
  const rollups = parseArray(value.rollups, LONGITUDINAL_ARCHIVE_LIMITS.rollups, parseRollup);
  if (!exposures || !reactions || !interactions || !checkins || !rollups) return null;
  return { schema: 'frontier-longitudinal-v1', exportedAt, exposures, reactions, interactions, checkins, rollups };
}
