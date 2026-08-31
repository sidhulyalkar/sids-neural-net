import { isQualifiedLongitudinalExposure, isSensorMeasuredLongitudinalExposure } from './longitudinalEvents';
import type {
  LongitudinalCheckin,
  LongitudinalExposure,
  LongitudinalInteraction,
  LongitudinalItemContext,
  LongitudinalReactionEpisode,
  LongitudinalRollup,
  LongitudinalRollupDimension,
} from './longitudinalModel';

export type LongitudinalTopicSummary = {
  key: string;
  exposureMs: number;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
  sensorMeasuredWallMs: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  sensorMeasuredExposures: number;
  sensorMeasuredReactions: number;
  sensorSamplingCoverage?: number;
  faceObservability?: number;
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
  sensorMeasuredWallMs: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  sensorMeasuredExposures: number;
  sensorMeasuredReactions: number;
  sensorSamplingCoverage?: number;
  faceObservability?: number;
  checkins: number;
  selfReported?: { mood: number; energy: number; focus: number };
  topTopics: LongitudinalTopicSummary[];
  topLanes: LongitudinalTopicSummary[];
};

type SensorTotals = {
  sensorMeasuredWallMs: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  sensorMeasuredExposures: number;
  sensorMeasuredReactions: number;
  sensorMeasuredConfirmed: number;
  sensorMeasuredContradicted: number;
};

type MutableSummary = SensorTotals & {
  exposureMs: number;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function eventId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function canonicalKeys(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean))];
}

function emptySensorTotals(): SensorTotals {
  return {
    sensorMeasuredWallMs: 0,
    sensorSampledMs: 0,
    faceObservableMs: 0,
    sensorMeasuredExposures: 0,
    sensorMeasuredReactions: 0,
    sensorMeasuredConfirmed: 0,
    sensorMeasuredContradicted: 0,
  };
}

function emptyMutableSummary(): MutableSummary {
  return { exposureMs: 0, exposures: 0, reactions: 0, confirmed: 0, contradicted: 0, ...emptySensorTotals() };
}

export function qualifiedLongitudinalExposureIds(exposures: LongitudinalExposure[]): Set<string> {
  return new Set(exposures.filter(isQualifiedLongitudinalExposure).map((exposure) => exposure.id));
}

export function sensorMeasuredLongitudinalExposureIds(exposures: LongitudinalExposure[]): Set<string> {
  return new Set(exposures
    .filter((exposure) => isQualifiedLongitudinalExposure(exposure) && isSensorMeasuredLongitudinalExposure(exposure))
    .map((exposure) => exposure.id));
}

/**
 * Pure raw-to-rollup compaction. Total historical counts stay available while a
 * parallel v2 measured subset preserves bounded sampling and face-observable
 * denominators. That subset lets inference exclude legacy v1 rows without losing
 * them from descriptive history.
 */
export function buildLongitudinalRollups(
  exposures: LongitudinalExposure[],
  reactions: LongitudinalReactionEpisode[],
  interactions: LongitudinalInteraction[],
  compactedAt = Date.now(),
  batchId = eventId('compact'),
): LongitudinalRollup[] {
  const byKey = new Map<string, LongitudinalRollup>();
  const qualifiedExposureIds = qualifiedLongitudinalExposureIds(exposures);
  const sensorMeasuredExposureIds = sensorMeasuredLongitudinalExposureIds(exposures);

  const touch = (day: string, dimension: LongitudinalRollupDimension, rawKey: string): LongitudinalRollup => {
    const key = rawKey.trim().toLowerCase();
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
    update: (rollup: LongitudinalRollup) => void,
  ) => {
    update(touch(day, 'lane', context.lane));
    update(touch(day, 'format', context.format));
    for (const tag of canonicalKeys(context.tags)) update(touch(day, 'topic', tag));
  };

  for (const exposure of exposures) {
    if (!qualifiedExposureIds.has(exposure.id)) continue;
    const measured = sensorMeasuredExposureIds.has(exposure.id);
    eachDimension(exposure, exposure.dayKey, (rollup) => {
      rollup.exposureMs += Math.max(0, exposure.durationMs);
      rollup.exposures += 1;
      if (measured) {
        rollup.sensorMeasuredWallMs = (rollup.sensorMeasuredWallMs ?? 0) + exposure.durationMs;
        rollup.sensorSampledMs = (rollup.sensorSampledMs ?? 0) + (exposure.sensorSampledMs ?? 0);
        rollup.faceObservableMs = (rollup.faceObservableMs ?? 0) + (exposure.faceObservableMs ?? 0);
        rollup.sensorMeasuredExposures = (rollup.sensorMeasuredExposures ?? 0) + 1;
      }
    });
  }
  for (const reaction of reactions) {
    if (!qualifiedExposureIds.has(reaction.exposureId)) continue;
    const measured = sensorMeasuredExposureIds.has(reaction.exposureId);
    eachDimension(reaction, reaction.dayKey, (rollup) => {
      rollup.reactions += 1;
      rollup[reaction.kind] += 1;
      rollup.confidenceSum += Math.max(0, Math.min(1, reaction.confidence));
      rollup.intensitySum += Math.max(0, Math.min(1, reaction.intensity));
      if (reaction.review === 'confirmed') rollup.confirmed += 1;
      if (reaction.review === 'contradicted') rollup.contradicted += 1;
      if (measured) {
        rollup.sensorMeasuredReactions = (rollup.sensorMeasuredReactions ?? 0) + 1;
        if (reaction.review === 'confirmed') rollup.sensorMeasuredConfirmed = (rollup.sensorMeasuredConfirmed ?? 0) + 1;
        if (reaction.review === 'contradicted') rollup.sensorMeasuredContradicted = (rollup.sensorMeasuredContradicted ?? 0) + 1;
      }
    });
  }
  for (const interaction of interactions) {
    eachDimension(interaction, interaction.dayKey, (rollup) => {
      rollup.explicitInteractions += 1;
    });
  }
  return Array.from(byKey.values());
}

function addSensorExposure(summary: SensorTotals, exposure: LongitudinalExposure): void {
  if (!isSensorMeasuredLongitudinalExposure(exposure)) return;
  summary.sensorMeasuredWallMs += exposure.durationMs;
  summary.sensorSampledMs += exposure.sensorSampledMs ?? 0;
  summary.faceObservableMs += exposure.faceObservableMs ?? 0;
  summary.sensorMeasuredExposures += 1;
}

function addSensorReaction(summary: SensorTotals, reaction: LongitudinalReactionEpisode, measured: boolean): void {
  if (!measured) return;
  summary.sensorMeasuredReactions += 1;
  if (reaction.review === 'confirmed') summary.sensorMeasuredConfirmed += 1;
  if (reaction.review === 'contradicted') summary.sensorMeasuredContradicted += 1;
}

function addSensorRollup(summary: SensorTotals, rollup: LongitudinalRollup): void {
  summary.sensorMeasuredWallMs += rollup.sensorMeasuredWallMs ?? 0;
  summary.sensorSampledMs += rollup.sensorSampledMs ?? 0;
  summary.faceObservableMs += rollup.faceObservableMs ?? 0;
  summary.sensorMeasuredExposures += rollup.sensorMeasuredExposures ?? 0;
  summary.sensorMeasuredReactions += rollup.sensorMeasuredReactions ?? 0;
  summary.sensorMeasuredConfirmed += rollup.sensorMeasuredConfirmed ?? 0;
  summary.sensorMeasuredContradicted += rollup.sensorMeasuredContradicted ?? 0;
}

function topicSummary(key: string, value: MutableSummary): LongitudinalTopicSummary {
  const reviewed = value.confirmed + value.contradicted;
  const denominatorMs = value.sensorMeasuredExposures > 0 ? value.faceObservableMs : value.exposureMs;
  const minutes = denominatorMs / 60_000;
  const summary: LongitudinalTopicSummary = {
    key,
    exposureMs: value.exposureMs,
    exposures: value.exposures,
    reactions: value.reactions,
    confirmed: value.confirmed,
    contradicted: value.contradicted,
    sensorMeasuredWallMs: value.sensorMeasuredWallMs,
    sensorSampledMs: value.sensorSampledMs,
    faceObservableMs: value.faceObservableMs,
    sensorMeasuredExposures: value.sensorMeasuredExposures,
    sensorMeasuredReactions: value.sensorMeasuredReactions,
    reactivityPer10Min: minutes > 0
      ? (value.sensorMeasuredExposures > 0 ? value.sensorMeasuredReactions : value.reactions) / minutes * 10
      : 0,
  };
  if (value.sensorMeasuredWallMs > 0) summary.sensorSamplingCoverage = clamp01(value.sensorSampledMs / value.sensorMeasuredWallMs);
  if (value.sensorSampledMs > 0) summary.faceObservability = clamp01(value.faceObservableMs / value.sensorSampledMs);
  if (reviewed) summary.reviewAgreement = value.confirmed / reviewed;
  return summary;
}

export function summarizeLongitudinalData(input: {
  days: number;
  exposures: LongitudinalExposure[];
  reactions: LongitudinalReactionEpisode[];
  interactions: LongitudinalInteraction[];
  checkins: LongitudinalCheckin[];
  rollups: LongitudinalRollup[];
  /** May include qualified exposures outside the display window for cross-midnight linkage. */
  qualifiedExposureIds?: ReadonlySet<string>;
  sensorMeasuredExposureIds?: ReadonlySet<string>;
}): LongitudinalSummary {
  const topicMap = new Map<string, MutableSummary>();
  const laneMap = new Map<string, MutableSummary>();
  const qualifiedIds = input.qualifiedExposureIds ?? qualifiedLongitudinalExposureIds(input.exposures);
  const sensorMeasuredIds = input.sensorMeasuredExposureIds ?? sensorMeasuredLongitudinalExposureIds(input.exposures);
  const sensorTotals = emptySensorTotals();
  let exposureMs = 0;
  let exposuresCount = 0;
  let reactionsCount = 0;
  let explicitInteractions = input.interactions.length;
  let confirmed = 0;
  let contradicted = 0;

  const apply = (map: Map<string, MutableSummary>, rawKey: string, mutate: (summary: MutableSummary) => void) => {
    const key = rawKey.trim().toLowerCase();
    if (!key) return;
    const current = map.get(key) ?? emptyMutableSummary();
    mutate(current);
    map.set(key, current);
  };

  for (const exposure of input.exposures) {
    if (!qualifiedIds.has(exposure.id)) continue;
    exposureMs += exposure.durationMs;
    exposuresCount += 1;
    addSensorExposure(sensorTotals, exposure);
    apply(laneMap, exposure.lane, (summary) => {
      summary.exposureMs += exposure.durationMs;
      summary.exposures += 1;
      addSensorExposure(summary, exposure);
    });
    for (const tag of canonicalKeys(exposure.tags)) apply(topicMap, tag, (summary) => {
      summary.exposureMs += exposure.durationMs;
      summary.exposures += 1;
      addSensorExposure(summary, exposure);
    });
  }
  for (const reaction of input.reactions) {
    if (!qualifiedIds.has(reaction.exposureId)) continue;
    const measured = sensorMeasuredIds.has(reaction.exposureId);
    reactionsCount += 1;
    if (reaction.review === 'confirmed') confirmed += 1;
    if (reaction.review === 'contradicted') contradicted += 1;
    addSensorReaction(sensorTotals, reaction, measured);
    apply(laneMap, reaction.lane, (summary) => {
      summary.reactions += 1;
      if (reaction.review === 'confirmed') summary.confirmed += 1;
      if (reaction.review === 'contradicted') summary.contradicted += 1;
      addSensorReaction(summary, reaction, measured);
    });
    for (const tag of canonicalKeys(reaction.tags)) apply(topicMap, tag, (summary) => {
      summary.reactions += 1;
      if (reaction.review === 'confirmed') summary.confirmed += 1;
      if (reaction.review === 'contradicted') summary.contradicted += 1;
      addSensorReaction(summary, reaction, measured);
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
      addSensorRollup(sensorTotals, rollup);
      apply(laneMap, rollup.key, (summary) => {
        summary.exposureMs += rollup.exposureMs;
        summary.exposures += rollup.exposures;
        summary.reactions += rollup.reactions;
        summary.confirmed += rollup.confirmed;
        summary.contradicted += rollup.contradicted;
        addSensorRollup(summary, rollup);
      });
    }
    if (rollup.dimension === 'topic') {
      apply(topicMap, rollup.key, (summary) => {
        summary.exposureMs += rollup.exposureMs;
        summary.exposures += rollup.exposures;
        summary.reactions += rollup.reactions;
        summary.confirmed += rollup.confirmed;
        summary.contradicted += rollup.contradicted;
        addSensorRollup(summary, rollup);
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

  const result: LongitudinalSummary = {
    days: input.days,
    exposureMs,
    exposures: exposuresCount,
    reactions: reactionsCount,
    explicitInteractions,
    reviewed,
    confirmed,
    contradicted,
    sensorMeasuredWallMs: sensorTotals.sensorMeasuredWallMs,
    sensorSampledMs: sensorTotals.sensorSampledMs,
    faceObservableMs: sensorTotals.faceObservableMs,
    sensorMeasuredExposures: sensorTotals.sensorMeasuredExposures,
    sensorMeasuredReactions: sensorTotals.sensorMeasuredReactions,
    checkins: input.checkins.length,
    topTopics: rank(Array.from(topicMap.entries())),
    topLanes: rank(Array.from(laneMap.entries())),
  };
  if (reviewed) result.reviewAgreement = confirmed / reviewed;
  if (sensorTotals.sensorMeasuredWallMs > 0) {
    result.sensorSamplingCoverage = clamp01(sensorTotals.sensorSampledMs / sensorTotals.sensorMeasuredWallMs);
  }
  if (sensorTotals.sensorSampledMs > 0) {
    result.faceObservability = clamp01(sensorTotals.faceObservableMs / sensorTotals.sensorSampledMs);
  }
  if (selfReported) result.selfReported = selfReported;
  return result;
}
