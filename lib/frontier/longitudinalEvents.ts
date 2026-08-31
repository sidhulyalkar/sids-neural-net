import { formatForItem } from './behavior';
import type { FrontierAmbientReaction } from './reaction';
import type { FrontierItem, FrontierReaction } from './types';
import {
  longitudinalDayKey,
  type LongitudinalCheckin,
  type LongitudinalExposure,
  type LongitudinalInteraction,
  type LongitudinalInteractionKind,
  type LongitudinalItemContext,
  type LongitudinalReactionEpisode,
  type LongitudinalScale,
} from './longitudinalModel';

export const MIN_QUALIFIED_EXPOSURE_MS = 700;
export const MIN_SENSOR_OBSERVABLE_EXPOSURE_MS = 700;
export const MIN_SENSOR_OBSERVABILITY_COVERAGE = 0.55;

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

export function normalizeLongitudinalTags(tags: string[], limit = 8): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = String(tag ?? '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function longitudinalItemContext(item: FrontierItem): LongitudinalItemContext {
  return {
    itemId: item.id,
    lane: item.lane,
    tags: normalizeLongitudinalTags(item.tags),
    sourceKind: item.sourceKind,
    format: formatForItem(item),
  };
}

let sessionId: string | undefined;

export function currentLongitudinalSessionId(): string {
  if (!sessionId) sessionId = eventId('session');
  return sessionId;
}

/** Test-only seam and explicit session boundary hook. */
export function resetLongitudinalSessionId(): void {
  sessionId = undefined;
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
    /** Fraction of attributed samples where the face sensor produced a usable face. */
    sensorObservableFraction?: number;
  },
): LongitudinalExposure {
  const startedAt = Number.isFinite(input.startedAt) ? input.startedAt : Date.now();
  const endedAt = Math.max(startedAt, Number.isFinite(input.endedAt) ? input.endedAt : startedAt);
  const durationMs = boundedMs(endedAt - startedAt);
  const exposure: LongitudinalExposure = {
    id: input.id ?? eventId('exposure'),
    sessionId: input.sessionId ?? currentLongitudinalSessionId(),
    ...longitudinalItemContext(item),
    startedAt,
    endedAt,
    dayKey: longitudinalDayKey(startedAt),
    durationMs,
    attributionMean: clamp01(input.attributionMean),
    attributionMin: clamp01(input.attributionMin),
    visibleFractionMean: clamp01(input.visibleFractionMean),
  };
  if (input.sensorObservableFraction !== undefined) {
    exposure.sensorObservableMs = durationMs * clamp01(input.sensorObservableFraction);
  }
  return exposure;
}

export function isQualifiedLongitudinalExposure(exposure: LongitudinalExposure): boolean {
  return exposure.durationMs >= MIN_QUALIFIED_EXPOSURE_MS
    && exposure.attributionMean >= 0.38
    && exposure.attributionMin >= 0.2
    && exposure.visibleFractionMean >= 0.34;
}

/**
 * Stronger admission gate used only before passive sensor evidence can touch the
 * preference model. Historical storage still retains attributed exposure with low
 * observability so coverage failures remain measurable instead of disappearing.
 */
export function isSensorObservableLongitudinalExposure(exposure: LongitudinalExposure): boolean {
  if (!isQualifiedLongitudinalExposure(exposure) || exposure.sensorObservableMs === undefined) return false;
  const coverage = exposure.durationMs > 0 ? exposure.sensorObservableMs / exposure.durationMs : 0;
  return exposure.sensorObservableMs >= MIN_SENSOR_OBSERVABLE_EXPOSURE_MS
    && coverage >= MIN_SENSOR_OBSERVABILITY_COVERAGE;
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
  },
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
  input: { at?: number; dwellMs?: number; reaction?: FrontierReaction } = {},
): LongitudinalInteraction {
  const at = input.at ?? Date.now();
  const interaction: LongitudinalInteraction = {
    id: eventId('interaction'),
    sessionId: currentLongitudinalSessionId(),
    ...longitudinalItemContext(item),
    at,
    dayKey: longitudinalDayKey(at),
    kind,
  };
  if (input.dwellMs !== undefined) interaction.dwellMs = boundedMs(input.dwellMs, 120_000);
  if (input.reaction !== undefined) interaction.reaction = input.reaction;
  return interaction;
}

export function createLongitudinalCheckin(
  mood: LongitudinalScale,
  energy: LongitudinalScale,
  focus: LongitudinalScale,
  at = Date.now(),
): LongitudinalCheckin {
  return { id: eventId('checkin'), at, dayKey: longitudinalDayKey(at), mood, energy, focus };
}
