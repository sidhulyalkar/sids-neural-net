import { isQualifiedLongitudinalExposure } from './longitudinalEvents';
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
  /** Attributed content exposure. */
  exposureMs: number;
  /** Sensor-observable subset when every contributing exposure had coverage instrumentation. */
  sensorObservableMs?: number;
  observabilityCoverage?: number;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
  /** Detected-cue rate per ten minutes of sensor-observable time when known, otherwise legacy attributed time. */
  reactivityPer10Min: number;
  reviewAgreement?: number;
};

export type LongitudinalSummary = {
  days: number;
  exposureMs: number;
  sensorObservableMs?: number;
  observabilityCoverage?: number;
  exposures: number;
  reactions: number;
  explicitInteractions: number;
  reviewed: number;
  confirmed: number;
  contradicted: number;
  reviewAgreement?: number;
  checkins: number;
  selfReported?: { mood: number; energy: number; focus: number };
  topTopics: LongitudinalTopicSummary[];
  topLanes: LongitudinalTopicSummary[];
};

type MutableSummary = {
  exposureMs: number;
  sensorObservableMs: number;
  observabilityKnown: boolean;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
};

function eventId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function canonicalKeys(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean))];
}

export function qualifiedLongitudinalExposureIds(exposures: LongitudinalExposure[]): Set<string> {
  return new Set(exposures.filter(isQualifiedLongitudinalExposure).map((exposure) => exposure.id));
}

/**
 * Pure raw-to-rollup compaction. Only reactions attached to qualified exposure
 * enter aggregate cue counts. Sensor observability is retained only when every
 * contributing exposure in a semantic cell had explicit instrumentation.
 */
export function buildLongitudinalRollups(
  exposures: LongitudinalExposure[],
  reactions: LongitudinalReactionEpisode[],
  interactions: LongitudinalInteraction[],
  compactedAt = Date.now(),
  batchId = eventId('compact'),
): LongitudinalRollup[] {
  const byKey = new Map<string, LongitudinalRollup>();
  const observabilityIncomplete = new WeakSet<LongitudinalRollup>();
  const qualifiedExposureIds = qualifiedLongitudinalExposureIds(exposures);

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
    eachDimension(exposure, exposure.dayKey, (rollup) => {
      rollup.exposureMs += Math.max(0, exposure.durationMs);
      rollup.exposures += 1;
      if (exposure.sensorObservableMs === undefined) {
        observabilityIncomplete.add(rollup);
        delete rollup.sensorObservableMs;
      } else if (!observabilityIncomplete.has(rollup)) {
        rollup.sensorObservableMs = (rollup.sensorObservableMs ?? 0)
          + Math.max(0, Math.min(exposure.durationMs, exposure.sensorObservableMs));
      }
    });
  }
  for (const reaction of reactions) {
    if (!qualifiedExposureIds.has(reaction.exposureId)) continue;
    eachDimension(reaction, reaction.dayKey, (rollup) => {
      rollup.reactions += 1;
      rollup[reaction.kind] += 1;
      rollup.confidenceSum += Math.max(0, Math.min(1, reaction.confidence));
      rollup.intensitySum += Math.max(0, Math.min(1, reaction.intensity));
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

function emptyMutableSummary(): MutableSummary {
  return {
    exposureMs: 0,
    sensorObservableMs: 0,
    observabilityKnown: true,
    exposures: 0,
    reactions: 0,
    confirmed: 0,
    contradicted: 0,
  };
}

function addObservability(summary: MutableSummary, exposureMs: number, sensorObservableMs: number | undefined): void {
  summary.exposureMs += exposureMs;
  if (sensorObservableMs === undefined) summary.observabilityKnown = false;
  else summary.sensorObservableMs += Math.max(0, Math.min(exposureMs, sensorObservableMs));
}

function topicSummary(key: string, value: MutableSummary): LongitudinalTopicSummary {
  const reviewed = value.confirmed + value.contradicted;
  const denominatorMs = value.observabilityKnown ? value.sensorObservableMs : value.exposureMs;
  const minutes = denominatorMs / 60_000;
  const summary: LongitudinalTopicSummary = {
    key,
    exposureMs: value.exposureMs,
    exposures: value.exposures,
    reactions: value.reactions,
    confirmed: value.confirmed,
    contradicted: value.contradicted,
    reactivityPer10Min: minutes > 0 ? value.reactions / minutes * 10 : 0,
  };
  if (value.observabilityKnown) {
    summary.sensorObservableMs = value.sensorObservableMs;
    summary.observabilityCoverage = value.exposureMs > 0 ? value.sensorObservableMs / value.exposureMs : 0;
  }
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
}): LongitudinalSummary {
  const topicMap = new Map<string, MutableSummary>();
  const laneMap = new Map<string, MutableSummary>();
  const qualifiedIds = input.qualifiedExposureIds ?? qualifiedLongitudinalExposureIds(input.exposures);
  let exposureMs = 0;
  let sensorObservableMs = 0;
  let observabilityKnown = true;
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
    if (exposure.sensorObservableMs === undefined) observabilityKnown = false;
    else sensorObservableMs += Math.max(0, Math.min(exposure.durationMs, exposure.sensorObservableMs));
    apply(laneMap, exposure.lane, (summary) => {
      addObservability(summary, exposure.durationMs, exposure.sensorObservableMs);
      summary.exposures += 1;
    });
    for (const tag of canonicalKeys(exposure.tags)) apply(topicMap, tag, (summary) => {
      addObservability(summary, exposure.durationMs, exposure.sensorObservableMs);
      summary.exposures += 1;
    });
  }
  for (const reaction of input.reactions) {
    if (!qualifiedIds.has(reaction.exposureId)) continue;
    reactionsCount += 1;
    if (reaction.review === 'confirmed') confirmed += 1;
    if (reaction.review === 'contradicted') contradicted += 1;
    apply(laneMap, reaction.lane, (summary) => {
      summary.reactions += 1;
      if (reaction.review === 'confirmed') summary.confirmed += 1;
      if (reaction.review === 'contradicted') summary.contradicted += 1;
    });
    for (const tag of canonicalKeys(reaction.tags)) apply(topicMap, tag, (summary) => {
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
      if (rollup.sensorObservableMs === undefined) observabilityKnown = false;
      else sensorObservableMs += Math.max(0, Math.min(rollup.exposureMs, rollup.sensorObservableMs));
      apply(laneMap, rollup.key, (summary) => {
        addObservability(summary, rollup.exposureMs, rollup.sensorObservableMs);
        summary.exposures += rollup.exposures;
        summary.reactions += rollup.reactions;
        summary.confirmed += rollup.confirmed;
        summary.contradicted += rollup.contradicted;
      });
    }
    if (rollup.dimension === 'topic') {
      apply(topicMap, rollup.key, (summary) => {
        addObservability(summary, rollup.exposureMs, rollup.sensorObservableMs);
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

  const result: LongitudinalSummary = {
    days: input.days,
    exposureMs,
    exposures: exposuresCount,
    reactions: reactionsCount,
    explicitInteractions,
    reviewed,
    confirmed,
    contradicted,
    checkins: input.checkins.length,
    topTopics: rank(Array.from(topicMap.entries())),
    topLanes: rank(Array.from(laneMap.entries())),
  };
  if (observabilityKnown) {
    result.sensorObservableMs = sensorObservableMs;
    result.observabilityCoverage = exposureMs > 0 ? sensorObservableMs / exposureMs : 0;
  }
  if (reviewed) result.reviewAgreement = confirmed / reviewed;
  if (selfReported) result.selfReported = selfReported;
  return result;
}
