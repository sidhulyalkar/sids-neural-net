import type { FrontierAmbientReactionKind } from './reaction';
import { FRONTIER_SENSOR_MEASUREMENT_VERSION } from './sensorObservability';
import type { FrontierLaneId, FrontierReaction, FrontierSourceKind } from './types';

export type LongitudinalReactionReview = 'confirmed' | 'contradicted';
export type LongitudinalInteractionKind = 'dwell' | 'expand' | 'open' | 'save' | 'unsave' | 'reaction';
export type LongitudinalRollupDimension = 'lane' | 'topic' | 'format';
export type LongitudinalScale = 1 | 2 | 3 | 4 | 5;
export type LongitudinalMeasurementVersion = typeof FRONTIER_SENSOR_MEASUREMENT_VERSION;

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
  /** Target-attributed wall duration. */
  durationMs: number;
  attributionMean: number;
  attributionMin: number;
  visibleFractionMean: number;
  /** Absent means legacy v1 camera-on denominator semantics. */
  measurementVersion?: LongitudinalMeasurementVersion;
  /** Bounded time between actual local vision callbacks while this target was attributable. */
  sensorSampledMs?: number;
  /** Subset of sensorSampledMs for which the local face model returned a usable face. */
  faceObservableMs?: number;
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
  /** v2 measurement subset. Undefined means historical rollup predating observability accounting. */
  sensorMeasuredWallMs?: number;
  sensorSampledMs?: number;
  faceObservableMs?: number;
  sensorMeasuredExposures?: number;
  sensorMeasuredReactions?: number;
  sensorMeasuredConfirmed?: number;
  sensorMeasuredContradicted?: number;
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

export type LongitudinalDayWindow = {
  days: number;
  startDay: string;
  endDayExclusive: string;
};

export function longitudinalDayKey(at: number): string {
  const date = new Date(at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Stable local-calendar window. Date#setDate is intentional across DST changes. */
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
