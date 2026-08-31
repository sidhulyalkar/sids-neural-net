import { qualifiedLongitudinalExposureIds } from './longitudinalAggregation';
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
const DEFAULT_MIN_TREND_EXPOSURE_MS = 10 * 60_000;
const DEFAULT_MIN_TREND_DAYS = 2;
const DEFAULT_MIN_TREND_EVENTS = 4;
const DEFAULT_MIN_VALIDATION_REVIEWS = 8;
const DEFAULT_MIN_VALIDATION_AGREEMENT = 0.65;
const DEFAULT_MIN_OBSERVABILITY_COVERAGE = 0.65;
const DEFAULT_FDR = 0.1;
const CREDIBLE_INTERVAL = 0.95;

export type LongitudinalMeasurementStatus = 'unvalidated' | 'supported' | 'questionable';

export type LongitudinalMeasurementQuality = {
  observed: number;
  reviewed: number;
  confirmed: number;
  contradicted: number;
  reviewCoverage: number;
  /** Precision of reviewed detected cues only. It does not estimate missed-cue recall. */
  reviewAgreement?: number;
  attributedExposureMs: number;
  sensorObservableMs: number;
  observabilityCoverage: number;
  observabilityKnown: boolean;
  status: LongitudinalMeasurementStatus;
};

export type LongitudinalRateEstimate = {
  key: string;
  /** Effective cue-rate denominator: sensor-observable time when known, legacy attributed time otherwise. */
  exposureMs: number;
  attributedExposureMs: number;
  sensorObservableMs: number;
  observabilityCoverage: number;
  observabilityKnown: boolean;
  exposures: number;
  observedDays: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
  reviewCoverage: number;
  reviewAgreement?: number;
  /** Empirical-Bayes detected-cue rate per ten minutes of the effective denominator. */
  ratePer10Min: number;
  /** Unique-observation baseline used for shrinkage, never multiplied by tag density. */
  baselinePer10Min: number;
  rateRatio: number;
  /** Equal-tail Bayesian credible interval. */
  lowerPer10Min: number;
  upperPer10Min: number;
  intervalLevel: number;
  evidenceStrength: number;
};

export type LongitudinalTrendDirection = 'rising' | 'cooling' | 'stable' | 'insufficient';
export type LongitudinalTrendReason =
  | 'detected'
  | 'sensor-uninstrumented'
  | 'sensor-coverage-low'
  | 'measurement-unvalidated'
  | 'measurement-questionable'
  | 'low-exposure'
  | 'single-day'
  | 'few-events'
  | 'small-effect'
  | 'multiplicity'
  | 'stable';

export type LongitudinalTopicTrend = {
  key: string;
  windowDays: number;
  direction: LongitudinalTrendDirection;
  reason: LongitudinalTrendReason;
  recent: LongitudinalRateEstimate;
  previous: LongitudinalRateEstimate;
  relativeChange: number;
  signalStrength: number;
  evidenceStrength: number;
  /** Approximate two-sided posterior mean-difference tail area. */
  pValue: number;
  /** Benjamini-Hochberg adjusted value across simultaneously eligible topic scans. */
  qValue: number;
  measurement: LongitudinalMeasurementQuality;
};

type TopicAccumulator = {
  exposureMs: number;
  attributedExposureMs: number;
  sensorObservableMs: number;
  observabilityKnown: boolean;
  exposures: number;
  reactions: number;
  confirmed: number;
  contradicted: number;
  days: Set<string>;
};

type PopulationAccumulator = {
  exposureMs: number;
  attributedExposureMs: number;
  sensorObservableMs: number;
  observabilityKnown: boolean;
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

type TrendDraft = {
  key: string;
  recent: LongitudinalRateEstimate;
  previous: LongitudinalRateEstimate;
  relativeChange: number;
  signalStrength: number;
  pValue: number;
  prelimReason: LongitudinalTrendReason;
  eligibleForMultiplicity: boolean;
};

function emptyAccumulator(): TopicAccumulator {
  return {
    exposureMs: 0,
    attributedExposureMs: 0,
    sensorObservableMs: 0,
    observabilityKnown: true,
    exposures: 0,
    reactions: 0,
    confirmed: 0,
    contradicted: 0,
    days: new Set<string>(),
  };
}

function emptyPopulation(): PopulationAccumulator {
  return {
    exposureMs: 0,
    attributedExposureMs: 0,
    sensorObservableMs: 0,
    observabilityKnown: true,
    reactions: 0,
    confirmed: 0,
    contradicted: 0,
  };
}

function touch(map: Map<string, TopicAccumulator>, key: string): TopicAccumulator {
  const normalized = key.trim().toLowerCase();
  const existing = map.get(normalized);
  if (existing) return existing;
  const created = emptyAccumulator();
  map.set(normalized, created);
  return created;
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function addExposureDenominator(
  target: Pick<TopicAccumulator, 'exposureMs' | 'attributedExposureMs' | 'sensorObservableMs' | 'observabilityKnown'>,
  durationMs: number,
  sensorObservableMs: number | undefined,
): void {
  const attributed = Math.max(0, durationMs);
  target.attributedExposureMs += attributed;
  if (sensorObservableMs === undefined) {
    target.observabilityKnown = false;
    target.exposureMs += attributed;
  } else {
    const observable = Math.max(0, Math.min(attributed, sensorObservableMs));
    target.sensorObservableMs += observable;
    target.exposureMs += observable;
  }
}

function addExposure(map: Map<string, TopicAccumulator>, exposure: Pick<LongitudinalExposure, 'tags' | 'durationMs' | 'sensorObservableMs' | 'dayKey'>): void {
  for (const tag of uniqueTags(exposure.tags)) {
    const value = touch(map, tag);
    addExposureDenominator(value, exposure.durationMs, exposure.sensorObservableMs);
    value.exposures += 1;
    value.days.add(exposure.dayKey);
  }
}

function addReaction(map: Map<string, TopicAccumulator>, reaction: Pick<LongitudinalReactionEpisode, 'tags' | 'review' | 'dayKey'>): void {
  for (const tag of uniqueTags(reaction.tags)) {
    const value = touch(map, tag);
    value.reactions += 1;
    value.days.add(reaction.dayKey);
    if (reaction.review === 'confirmed') value.confirmed += 1;
    if (reaction.review === 'contradicted') value.contradicted += 1;
  }
}

function addRollup(map: Map<string, TopicAccumulator>, rollup: LongitudinalRollup): void {
  if (rollup.dimension !== 'topic') return;
  const value = touch(map, rollup.key);
  addExposureDenominator(value, rollup.exposureMs, rollup.sensorObservableMs);
  value.exposures += rollup.exposures;
  value.reactions += rollup.reactions;
  value.confirmed += rollup.confirmed;
  value.contradicted += rollup.contradicted;
  value.days.add(rollup.dayKey);
}

function topicWindow(archive: LongitudinalArchive, window: LongitudinalDayWindow): Map<string, TopicAccumulator> {
  const map = new Map<string, TopicAccumulator>();
  const qualifiedIds = qualifiedLongitudinalExposureIds(archive.exposures);

  for (const exposure of archive.exposures) {
    if (qualifiedIds.has(exposure.id) && dayKeyInLongitudinalWindow(exposure.dayKey, window)) addExposure(map, exposure);
  }
  for (const reaction of archive.reactions) {
    if (qualifiedIds.has(reaction.exposureId) && dayKeyInLongitudinalWindow(reaction.dayKey, window)) addReaction(map, reaction);
  }
  for (const rollup of archive.rollups) {
    if (dayKeyInLongitudinalWindow(rollup.dayKey, window)) addRollup(map, rollup);
  }
  return map;
}

function addPopulationDenominator(
  population: PopulationAccumulator,
  durationMs: number,
  sensorObservableMs: number | undefined,
): void {
  const attributed = Math.max(0, durationMs);
  population.attributedExposureMs += attributed;
  if (sensorObservableMs === undefined) {
    population.observabilityKnown = false;
    population.exposureMs += attributed;
  } else {
    const observable = Math.max(0, Math.min(attributed, sensorObservableMs));
    population.sensorObservableMs += observable;
    population.exposureMs += observable;
  }
}

/**
 * Unique observation population for the empirical prior. Raw observations are
 * counted once regardless of tag count. After compaction, lane rollups recover
 * that unique population because every event belongs to exactly one lane.
 */
function populationWindow(archive: LongitudinalArchive, window: LongitudinalDayWindow): PopulationAccumulator {
  const population = emptyPopulation();
  const qualifiedIds = qualifiedLongitudinalExposureIds(archive.exposures);

  for (const exposure of archive.exposures) {
    if (!qualifiedIds.has(exposure.id) || !dayKeyInLongitudinalWindow(exposure.dayKey, window)) continue;
    addPopulationDenominator(population, exposure.durationMs, exposure.sensorObservableMs);
  }
  for (const reaction of archive.reactions) {
    if (!qualifiedIds.has(reaction.exposureId) || !dayKeyInLongitudinalWindow(reaction.dayKey, window)) continue;
    population.reactions += 1;
    if (reaction.review === 'confirmed') population.confirmed += 1;
    if (reaction.review === 'contradicted') population.contradicted += 1;
  }
  for (const rollup of archive.rollups) {
    if (rollup.dimension !== 'lane' || !dayKeyInLongitudinalWindow(rollup.dayKey, window)) continue;
    addPopulationDenominator(population, rollup.exposureMs, rollup.sensorObservableMs);
    population.reactions += rollup.reactions;
    population.confirmed += rollup.confirmed;
    population.contradicted += rollup.contradicted;
  }
  return population;
}

function populationRate(population: PopulationAccumulator): number {
  const exposureUnits = population.exposureMs / TEN_MINUTES_MS;
  if (exposureUnits <= 0) return 0.2;
  return Math.max(0.05, Math.min(12, population.reactions / exposureUnits));
}

function measurementQuality(population: PopulationAccumulator): LongitudinalMeasurementQuality {
  const reviewed = population.confirmed + population.contradicted;
  const reviewAgreement = reviewed ? population.confirmed / reviewed : undefined;
  const observabilityCoverage = population.attributedExposureMs > 0
    ? population.sensorObservableMs / population.attributedExposureMs
    : 0;
  let status: LongitudinalMeasurementStatus = 'unvalidated';
  if (population.observabilityKnown && reviewed >= DEFAULT_MIN_VALIDATION_REVIEWS && reviewAgreement !== undefined) {
    status = reviewAgreement >= DEFAULT_MIN_VALIDATION_AGREEMENT && observabilityCoverage >= DEFAULT_MIN_OBSERVABILITY_COVERAGE
      ? 'supported'
      : 'questionable';
  }
  const result: LongitudinalMeasurementQuality = {
    observed: population.reactions,
    reviewed,
    confirmed: population.confirmed,
    contradicted: population.contradicted,
    reviewCoverage: population.reactions ? Math.min(1, reviewed / population.reactions) : 0,
    attributedExposureMs: population.attributedExposureMs,
    sensorObservableMs: population.sensorObservableMs,
    observabilityCoverage,
    observabilityKnown: population.observabilityKnown,
    status,
  };
  if (reviewAgreement !== undefined) result.reviewAgreement = reviewAgreement;
  return result;
}

const LANCZOS_COEFFICIENTS = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
] as const;

function logGamma(value: number): number {
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let x = 0.99999999999980993;
  for (let index = 0; index < LANCZOS_COEFFICIENTS.length; index += 1) {
    x += LANCZOS_COEFFICIENTS[index] / (z + index + 1);
  }
  const t = z + LANCZOS_COEFFICIENTS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedGammaP(shape: number, x: number): number {
  if (!(shape > 0) || !(x > 0)) return 0;
  const epsilon = 1e-13;
  const tiny = 1e-300;
  const exponent = -x + shape * Math.log(x) - logGamma(shape);

  if (x < shape + 1) {
    let term = 1 / shape;
    let sum = term;
    let denominator = shape;
    for (let iteration = 1; iteration <= 300; iteration += 1) {
      denominator += 1;
      term *= x / denominator;
      sum += term;
      if (Math.abs(term) <= Math.abs(sum) * epsilon) break;
    }
    return Math.max(0, Math.min(1, sum * Math.exp(exponent)));
  }

  let b = x + 1 - shape;
  let c = 1 / tiny;
  let d = 1 / Math.max(tiny, b);
  let h = d;
  for (let iteration = 1; iteration <= 300; iteration += 1) {
    const an = -iteration * (iteration - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) <= epsilon) break;
  }
  const q = Math.exp(exponent) * h;
  return Math.max(0, Math.min(1, 1 - q));
}

function gammaQuantile(shape: number, rate: number, probability: number): number {
  if (!(shape > 0) || !(rate > 0)) return 0;
  const target = Math.max(1e-9, Math.min(1 - 1e-9, probability));
  let low = 0;
  let high = Math.max(1 / rate, shape / rate);
  while (regularizedGammaP(shape, high * rate) < target && high < 1e9) high *= 2;
  for (let iteration = 0; iteration < 72; iteration += 1) {
    const mid = (low + high) / 2;
    if (regularizedGammaP(shape, mid * rate) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
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
  const alpha = (1 - CREDIBLE_INTERVAL) / 2;
  return {
    mean: shape / rate,
    lower: gammaQuantile(shape, rate, alpha),
    upper: gammaQuantile(shape, rate, 1 - alpha),
    variance: shape / (rate * rate),
  };
}

function estimate(key: string, value: TopicAccumulator | undefined, priorRate: number): LongitudinalRateEstimate {
  const safe = value ?? emptyAccumulator();
  const posterior = posteriorRate(safe.reactions, safe.exposureMs, priorRate);
  const reviewed = safe.confirmed + safe.contradicted;
  const exposureUnits = safe.exposureMs / TEN_MINUTES_MS;
  const evidenceStrength = Math.max(0, Math.min(1,
    1 - Math.exp(-(exposureUnits + safe.reactions * 0.55 + safe.days.size * 0.8 + reviewed * 0.2) / 6),
  ));
  const observabilityCoverage = safe.attributedExposureMs > 0
    ? safe.sensorObservableMs / safe.attributedExposureMs
    : 0;
  const result: LongitudinalRateEstimate = {
    key,
    exposureMs: safe.exposureMs,
    attributedExposureMs: safe.attributedExposureMs,
    sensorObservableMs: safe.sensorObservableMs,
    observabilityCoverage,
    observabilityKnown: safe.observabilityKnown,
    exposures: safe.exposures,
    observedDays: safe.days.size,
    reactions: safe.reactions,
    confirmed: safe.confirmed,
    contradicted: safe.contradicted,
    reviewCoverage: safe.reactions ? Math.min(1, reviewed / safe.reactions) : 0,
    ratePer10Min: posterior.mean,
    baselinePer10Min: priorRate,
    rateRatio: priorRate > 0 ? posterior.mean / priorRate : 1,
    lowerPer10Min: posterior.lower,
    upperPer10Min: posterior.upper,
    intervalLevel: CREDIBLE_INTERVAL,
    evidenceStrength,
  };
  if (reviewed) result.reviewAgreement = safe.confirmed / reviewed;
  return result;
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function twoSidedNormalP(z: number): number {
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
}

function benjaminiHochberg(entries: Array<{ index: number; pValue: number }>): Map<number, number> {
  if (!entries.length) return new Map<number, number>();
  const sorted = [...entries].sort((left, right) => left.pValue - right.pValue);
  const adjusted = new Array<number>(sorted.length);
  let running = 1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const rank = index + 1;
    running = Math.min(running, sorted[index].pValue * sorted.length / rank);
    adjusted[index] = Math.max(0, Math.min(1, running));
  }
  return new Map(sorted.map((entry, index) => [entry.index, adjusted[index]]));
}

export function inferLongitudinalMeasurementQuality(
  archive: LongitudinalArchive,
  days = 90,
  now = Date.now(),
): LongitudinalMeasurementQuality {
  const window = longitudinalDayWindow(days, now);
  return measurementQuality(populationWindow(archive, window));
}

export function inferLongitudinalTopicRates(
  archive: LongitudinalArchive,
  days = 90,
  now = Date.now(),
): LongitudinalRateEstimate[] {
  const window = longitudinalDayWindow(days, now);
  const map = topicWindow(archive, window);
  const prior = populationRate(populationWindow(archive, window));
  return Array.from(map.entries())
    .map(([key, value]) => estimate(key, value, prior))
    .filter((entry) => entry.attributedExposureMs >= 30_000)
    .sort((left, right) => (
      right.evidenceStrength - left.evidenceStrength
      || right.lowerPer10Min - left.lowerPer10Min
      || right.attributedExposureMs - left.attributedExposureMs
    ));
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
  const combinedPopulation = populationWindow(archive, {
    days: boundedWindow * 2,
    startDay: previousWindow.startDay,
    endDayExclusive: recentWindow.endDayExclusive,
  });
  const prior = populationRate(combinedPopulation);
  const measurement = measurementQuality(combinedPopulation);
  const keys = new Set([...recentMap.keys(), ...previousMap.keys()]);
  const drafts: TrendDraft[] = [];

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
    const pValue = twoSidedNormalP(signalStrength);

    let prelimReason: LongitudinalTrendReason = 'stable';
    if (!measurement.observabilityKnown) prelimReason = 'sensor-uninstrumented';
    else if (measurement.observabilityCoverage < DEFAULT_MIN_OBSERVABILITY_COVERAGE) prelimReason = 'sensor-coverage-low';
    else if (measurement.status === 'unvalidated') prelimReason = 'measurement-unvalidated';
    else if (measurement.status === 'questionable') prelimReason = 'measurement-questionable';
    else if (recent.exposureMs < minWindowExposureMs || previous.exposureMs < minWindowExposureMs) prelimReason = 'low-exposure';
    else if (recent.observedDays < DEFAULT_MIN_TREND_DAYS || previous.observedDays < DEFAULT_MIN_TREND_DAYS) prelimReason = 'single-day';
    else if (recent.reactions + previous.reactions < DEFAULT_MIN_TREND_EVENTS) prelimReason = 'few-events';
    else if (Math.abs(relativeChange) < 0.35) prelimReason = 'small-effect';

    drafts.push({
      key,
      recent,
      previous,
      relativeChange,
      signalStrength,
      pValue,
      prelimReason,
      eligibleForMultiplicity: prelimReason === 'stable',
    });
  }

  const qValues = benjaminiHochberg(drafts
    .map((draft, index) => ({ index, pValue: draft.pValue, eligible: draft.eligibleForMultiplicity }))
    .filter((entry) => entry.eligible)
    .map(({ index, pValue }) => ({ index, pValue })));

  const trends = drafts.map((draft, index): LongitudinalTopicTrend => {
    const qValue = qValues.get(index) ?? 1;
    let direction: LongitudinalTrendDirection = 'stable';
    let reason = draft.prelimReason;
    if (draft.prelimReason !== 'stable') direction = 'insufficient';
    else if (qValue <= DEFAULT_FDR) {
      direction = draft.relativeChange > 0 ? 'rising' : 'cooling';
      reason = 'detected';
    } else {
      reason = 'multiplicity';
    }

    const evidenceStrength = Math.min(draft.recent.evidenceStrength, draft.previous.evidenceStrength)
      * (1 - Math.exp(-draft.signalStrength / 2))
      * (measurement.status === 'supported' ? 1 : 0.35);

    return {
      key: draft.key,
      windowDays: boundedWindow,
      direction,
      reason,
      recent: draft.recent,
      previous: draft.previous,
      relativeChange: draft.relativeChange,
      signalStrength: draft.signalStrength,
      evidenceStrength: Math.max(0, Math.min(1, evidenceStrength)),
      pValue: draft.pValue,
      qValue,
      measurement,
    };
  });

  return trends.sort((left, right) => {
    const leftActive = left.direction === 'rising' || left.direction === 'cooling' ? 1 : 0;
    const rightActive = right.direction === 'rising' || right.direction === 'cooling' ? 1 : 0;
    return rightActive - leftActive
      || right.evidenceStrength - left.evidenceStrength
      || right.recent.observedDays - left.recent.observedDays
      || right.recent.attributedExposureMs - left.recent.attributedExposureMs;
  });
}
