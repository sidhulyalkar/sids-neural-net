import {
  dayKeyInLongitudinalWindow,
  longitudinalDayWindow,
  type LongitudinalArchive,
  type LongitudinalDayWindow,
  type LongitudinalExposure,
  type LongitudinalReactionEpisode,
  type LongitudinalRollup,
} from './longitudinalModel';

const TEN_MINUTES_MS = 10 * 60_000;
const DEFAULT_PRIOR_EXPOSURE_UNITS = 1.5;
const DEFAULT_MIN_TREND_EXPOSURE_MS = 3 * 60_000;

export type LongitudinalRateEstimate = {
  key: string;
  exposureMs: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
  reviewAgreement?: number;
  /** Shrunk reaction rate per ten minutes of qualified exposure. */
  ratePer10Min: number;
  /** Approximate 90% posterior uncertainty band. */
  lowerPer10Min: number;
  upperPer10Min: number;
  evidenceStrength: number;
};

export type LongitudinalTrendDirection = 'rising' | 'cooling' | 'stable' | 'insufficient';

export type LongitudinalTopicTrend = {
  key: string;
  windowDays: number;
  direction: LongitudinalTrendDirection;
  recent: LongitudinalRateEstimate;
  previous: LongitudinalRateEstimate;
  relativeChange: number;
  signalStrength: number;
  evidenceStrength: number;
};

type TopicAccumulator = {
  exposureMs: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
};

type Posterior = {
  mean: number;
  lower: number;
  upper: number;
  variance: number;
};

function emptyAccumulator(): TopicAccumulator {
  return { exposureMs: 0, reactions: 0, confirmed: 0, contradicted: 0 };
}

function touch(map: Map<string, TopicAccumulator>, key: string): TopicAccumulator {
  const normalized = key.trim().toLowerCase();
  const existing = map.get(normalized);
  if (existing) return existing;
  const created = emptyAccumulator();
  map.set(normalized, created);
  return created;
}

function addExposure(map: Map<string, TopicAccumulator>, exposure: Pick<LongitudinalExposure, 'tags' | 'durationMs'>): void {
  for (const tag of exposure.tags) touch(map, tag).exposureMs += exposure.durationMs;
}

function addReaction(map: Map<string, TopicAccumulator>, reaction: Pick<LongitudinalReactionEpisode, 'tags' | 'review'>): void {
  for (const tag of reaction.tags) {
    const value = touch(map, tag);
    value.reactions += 1;
    if (reaction.review === 'confirmed') value.confirmed += 1;
    if (reaction.review === 'contradicted') value.contradicted += 1;
  }
}

function addRollup(map: Map<string, TopicAccumulator>, rollup: LongitudinalRollup): void {
  if (rollup.dimension !== 'topic') return;
  const value = touch(map, rollup.key);
  value.exposureMs += rollup.exposureMs;
  value.reactions += rollup.reactions;
  value.confirmed += rollup.confirmed;
  value.contradicted += rollup.contradicted;
}

function topicWindow(
  archive: LongitudinalArchive,
  window: LongitudinalDayWindow,
): Map<string, TopicAccumulator> {
  const map = new Map<string, TopicAccumulator>();
  for (const exposure of archive.exposures) {
    if (dayKeyInLongitudinalWindow(exposure.dayKey, window)) addExposure(map, exposure);
  }
  for (const reaction of archive.reactions) {
    if (dayKeyInLongitudinalWindow(reaction.dayKey, window)) addReaction(map, reaction);
  }
  for (const rollup of archive.rollups) {
    if (dayKeyInLongitudinalWindow(rollup.dayKey, window)) addRollup(map, rollup);
  }
  return map;
}

function globalRate(map: Map<string, TopicAccumulator>): number {
  let exposureUnits = 0;
  let reactions = 0;
  for (const value of map.values()) {
    exposureUnits += value.exposureMs / TEN_MINUTES_MS;
    reactions += value.reactions;
  }
  if (exposureUnits <= 0) return 0.2;
  return Math.max(0.05, Math.min(12, reactions / exposureUnits));
}

function gammaQuantileApprox(shape: number, rate: number, z: number): number {
  if (!(shape > 0) || !(rate > 0)) return 0;
  const base = Math.max(0.01, 1 - 1 / (9 * shape) + z / (3 * Math.sqrt(shape)));
  return shape * base ** 3 / rate;
}

function posteriorRate(
  reactions: number,
  exposureMs: number,
  priorRate: number,
  priorExposureUnits = DEFAULT_PRIOR_EXPOSURE_UNITS,
): Posterior {
  const exposureUnits = Math.max(0, exposureMs) / TEN_MINUTES_MS;
  const priorShape = Math.max(0.5, priorRate * priorExposureUnits);
  const shape = priorShape + Math.max(0, reactions);
  const rate = priorExposureUnits + exposureUnits;
  const mean = shape / rate;
  return {
    mean,
    lower: gammaQuantileApprox(shape, rate, -1.6448536269514722),
    upper: gammaQuantileApprox(shape, rate, 1.6448536269514722),
    variance: shape / (rate * rate),
  };
}

function estimate(
  key: string,
  value: TopicAccumulator | undefined,
  priorRate: number,
): LongitudinalRateEstimate {
  const safe = value ?? emptyAccumulator();
  const posterior = posteriorRate(safe.reactions, safe.exposureMs, priorRate);
  const reviewed = safe.confirmed + safe.contradicted;
  const exposureUnits = safe.exposureMs / TEN_MINUTES_MS;
  const evidenceStrength = Math.max(0, Math.min(1, 1 - Math.exp(-(exposureUnits + safe.reactions * 0.7 + reviewed * 0.25) / 4)));
  return {
    key,
    exposureMs: safe.exposureMs,
    reactions: safe.reactions,
    confirmed: safe.confirmed,
    contradicted: safe.contradicted,
    reviewAgreement: reviewed ? safe.confirmed / reviewed : undefined,
    ratePer10Min: posterior.mean,
    lowerPer10Min: posterior.lower,
    upperPer10Min: posterior.upper,
    evidenceStrength,
  };
}

export function inferLongitudinalTopicRates(
  archive: LongitudinalArchive,
  days = 90,
  now = Date.now(),
): LongitudinalRateEstimate[] {
  const window = longitudinalDayWindow(days, now);
  const map = topicWindow(archive, window);
  const prior = globalRate(map);
  return Array.from(map.entries())
    .map(([key, value]) => estimate(key, value, prior))
    .filter((entry) => entry.exposureMs >= 30_000)
    .sort((left, right) => (
      right.ratePer10Min * (0.35 + right.evidenceStrength * 0.65)
      - left.ratePer10Min * (0.35 + left.evidenceStrength * 0.65)
    ) || right.exposureMs - left.exposureMs);
}

export function inferLongitudinalTopicTrends(
  archive: LongitudinalArchive,
  windowDays = 14,
  now = Date.now(),
  minWindowExposureMs = DEFAULT_MIN_TREND_EXPOSURE_MS,
): LongitudinalTopicTrend[] {
  const boundedWindow = Math.max(3, Math.min(365, Math.round(windowDays)));
  const recentWindow = longitudinalDayWindow(boundedWindow, now);
  const previousWindow = longitudinalDayWindow(boundedWindow, now, -boundedWindow);
  const recentMap = topicWindow(archive, recentWindow);
  const previousMap = topicWindow(archive, previousWindow);
  const combined = new Map<string, TopicAccumulator>();

  for (const [key, value] of [...previousMap.entries(), ...recentMap.entries()]) {
    const target = touch(combined, key);
    target.exposureMs += value.exposureMs;
    target.reactions += value.reactions;
    target.confirmed += value.confirmed;
    target.contradicted += value.contradicted;
  }

  const prior = globalRate(combined);
  const keys = new Set([...recentMap.keys(), ...previousMap.keys()]);
  const trends: LongitudinalTopicTrend[] = [];

  for (const key of keys) {
    const recentValue = recentMap.get(key) ?? emptyAccumulator();
    const previousValue = previousMap.get(key) ?? emptyAccumulator();
    const recent = estimate(key, recentValue, prior);
    const previous = estimate(key, previousValue, prior);
    const recentPosterior = posteriorRate(recentValue.reactions, recentValue.exposureMs, prior);
    const previousPosterior = posteriorRate(previousValue.reactions, previousValue.exposureMs, prior);
    const delta = recentPosterior.mean - previousPosterior.mean;
    const scale = Math.max(0.2, (recentPosterior.mean + previousPosterior.mean) / 2);
    const relativeChange = delta / scale;
    const standardError = Math.sqrt(recentPosterior.variance + previousPosterior.variance);
    const signalStrength = standardError > 0 ? Math.abs(delta) / standardError : 0;
    const enoughExposure = recent.exposureMs >= minWindowExposureMs && previous.exposureMs >= minWindowExposureMs;
    const enoughEvents = recent.reactions + previous.reactions >= 2;
    const effectIsMaterial = Math.abs(relativeChange) >= 0.3;
    const evidenceStrength = Math.min(recent.evidenceStrength, previous.evidenceStrength)
      * (1 - Math.exp(-signalStrength / 1.5));

    let direction: LongitudinalTrendDirection = 'stable';
    if (!enoughExposure || !enoughEvents) direction = 'insufficient';
    else if (effectIsMaterial && signalStrength >= 1.15) direction = delta > 0 ? 'rising' : 'cooling';

    trends.push({
      key,
      windowDays: boundedWindow,
      direction,
      recent,
      previous,
      relativeChange,
      signalStrength,
      evidenceStrength: Math.max(0, Math.min(1, evidenceStrength)),
    });
  }

  return trends.sort((left, right) => {
    const leftActive = left.direction === 'rising' || left.direction === 'cooling' ? 1 : 0;
    const rightActive = right.direction === 'rising' || right.direction === 'cooling' ? 1 : 0;
    return rightActive - leftActive
      || right.evidenceStrength - left.evidenceStrength
      || right.recent.exposureMs - left.recent.exposureMs;
  });
}
