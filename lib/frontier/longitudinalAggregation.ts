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
  selfReported?: { mood: number; energy: number; focus: number };
  topTopics: LongitudinalTopicSummary[];
  topLanes: LongitudinalTopicSummary[];
};

type MutableSummary = {
  exposureMs: number;
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

/**
 * Pure raw-to-rollup compaction. The function is storage-agnostic so compaction
 * semantics can be tested independently from IndexedDB transactions.
 */
export function buildLongitudinalRollups(
  exposures: LongitudinalExposure[],
  reactions: LongitudinalReactionEpisode[],
  interactions: LongitudinalInteraction[],
  compactedAt = Date.now(),
  batchId = eventId('compact'),
): LongitudinalRollup[] {
  const byKey = new Map<string, LongitudinalRollup>();

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
    eachDimension(exposure, exposure.dayKey, (rollup) => {
      rollup.exposureMs += Math.max(0, exposure.durationMs);
      rollup.exposures += 1;
    });
  }
  for (const reaction of reactions) {
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
  return { exposureMs: 0, exposures: 0, reactions: 0, confirmed: 0, contradicted: 0 };
}

function topicSummary(key: string, value: MutableSummary): LongitudinalTopicSummary {
  const reviewed = value.confirmed + value.contradicted;
  const minutes = value.exposureMs / 60_000;
  const summary: LongitudinalTopicSummary = {
    key,
    exposureMs: value.exposureMs,
    exposures: value.exposures,
    reactions: value.reactions,
    confirmed: value.confirmed,
    contradicted: value.contradicted,
    reactivityPer10Min: minutes > 0 ? value.reactions / minutes * 10 : 0,
  };
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
}): LongitudinalSummary {
  const topicMap = new Map<string, MutableSummary>();
  const laneMap = new Map<string, MutableSummary>();
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
    exposureMs += exposure.durationMs;
    exposuresCount += 1;
    apply(laneMap, exposure.lane, (summary) => {
      summary.exposureMs += exposure.durationMs;
      summary.exposures += 1;
    });
    for (const tag of canonicalKeys(exposure.tags)) apply(topicMap, tag, (summary) => {
      summary.exposureMs += exposure.durationMs;
      summary.exposures += 1;
    });
  }
  for (const reaction of input.reactions) {
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
      apply(laneMap, rollup.key, (summary) => {
        summary.exposureMs += rollup.exposureMs;
        summary.exposures += rollup.exposures;
        summary.reactions += rollup.reactions;
        summary.confirmed += rollup.confirmed;
        summary.contradicted += rollup.contradicted;
      });
    }
    if (rollup.dimension === 'topic') {
      apply(topicMap, rollup.key, (summary) => {
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
  if (reviewed) result.reviewAgreement = confirmed / reviewed;
  if (selfReported) result.selfReported = selfReported;
  return result;
}
