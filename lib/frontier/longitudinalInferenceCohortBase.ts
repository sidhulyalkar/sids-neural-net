import {
  qualifiedLongitudinalExposureIds,
  sensorMeasuredLongitudinalExposureIds,
} from './longitudinalAggregation';
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
const DEFAULT_MIN_SENSOR_SAMPLING_COVERAGE = 0.65;
const DEFAULT_MIN_FACE_OBSERVABILITY = 0.5;
const DEFAULT_FDR = 0.1;
const CREDIBLE_INTERVAL = 0.95;

export type LongitudinalMeasurementMode = 'none' | 'legacy-v1' | 'sensor-v2' | 'mixed';
export type LongitudinalMeasurementStatus = 'unvalidated' | 'supported' | 'questionable';

export type LongitudinalMeasurementQuality = {
  mode: LongitudinalMeasurementMode;
  observed: number;
  reviewed: number;
  confirmed: number;
  contradicted: number;
  reviewCoverage: number;
  /** Precision of reviewed v2 detected cues only. It does not estimate missed-cue recall. */
  reviewAgreement?: number;
  sensorMeasuredWallMs: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  sensorSamplingCoverage: number;
  faceObservability: number;
  status: LongitudinalMeasurementStatus;
};

export type LongitudinalRateEstimate = {
  key: string;
  measurementMode: LongitudinalMeasurementMode;
  /** Effective denominator: v2 face-observable time when v2 exists, otherwise legacy attributed time. */
  exposureMs: number;
  attributedExposureMs: number;
  sensorMeasuredWallMs: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  sensorSamplingCoverage: number;
  faceObservability: number;
  legacyExposureMs: number;
  exposures: number;
  measuredExposures: number;
  observedDays: number;
  reactions: number;
  totalReactions: number;
  measuredReactions: number;
  legacyReactions: number;
  confirmed: number;
  contradicted: number;
  reviewCoverage: number;
  reviewAgreement?: number;
  ratePer10Min: number;
  baselinePer10Min: number;
  rateRatio: number;
  lowerPer10Min: number;
  upperPer10Min: number;
  intervalLevel: number;
  evidenceStrength: number;
};

export type LongitudinalTrendDirection = 'rising' | 'cooling' | 'stable' | 'insufficient';
export type LongitudinalTrendReason =
  | 'detected'
  | 'sensor-uninstrumented'
  | 'measurement-transition'
  | 'sensor-sampling-low'
  | 'face-observability-low'
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
  pValue: number;
  qValue: number;
  measurement: LongitudinalMeasurementQuality;
};

type ObservationAccumulator = {
  totalExposureMs: number;
  totalExposures: number;
  totalReactions: number;
  totalConfirmed: number;
  totalContradicted: number;
  sensorMeasuredWallMs: number;
  sensorSampledMs: number;
  faceObservableMs: number;
  measuredExposures: number;
  measuredReactions: number;
  measuredConfirmed: number;
  measuredContradicted: number;
  days: Set<string>;
  measuredDays: Set<string>;
};

type Posterior = { mean: number; lower: number; upper: number; variance: number };
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

function emptyAccumulator(): ObservationAccumulator {
  return {
    totalExposureMs: 0,
    totalExposures: 0,
    totalReactions: 0,
    totalConfirmed: 0,
    totalContradicted: 0,
    sensorMeasuredWallMs: 0,
    sensorSampledMs: 0,
    faceObservableMs: 0,
    measuredExposures: 0,
    measuredReactions: 0,
    measuredConfirmed: 0,
    measuredContradicted: 0,
    days: new Set<string>(),
    measuredDays: new Set<string>(),
  };
}

function touch(map: Map<string, ObservationAccumulator>, rawKey: string): ObservationAccumulator {
  const key = rawKey.trim().toLowerCase();
  const existing = map.get(key);
  if (existing) return existing;
  const created = emptyAccumulator();
  map.set(key, created);
  return created;
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function addExposure(target: ObservationAccumulator, exposure: LongitudinalExposure, measured: boolean): void {
  target.totalExposureMs += exposure.durationMs;
  target.totalExposures += 1;
  target.days.add(exposure.dayKey);
  if (!measured) return;
  target.sensorMeasuredWallMs += exposure.durationMs;
  target.sensorSampledMs += exposure.sensorSampledMs ?? 0;
  target.faceObservableMs += exposure.faceObservableMs ?? 0;
  target.measuredExposures += 1;
  target.measuredDays.add(exposure.dayKey);
}

function addReaction(
  target: ObservationAccumulator,
  reaction: LongitudinalReactionEpisode,
  measured: boolean,
  analyticDayKey: string,
): void {
  target.totalReactions += 1;
  if (reaction.review === 'confirmed') target.totalConfirmed += 1;
  if (reaction.review === 'contradicted') target.totalContradicted += 1;
  target.days.add(analyticDayKey);
  if (!measured) return;
  target.measuredReactions += 1;
  if (reaction.review === 'confirmed') target.measuredConfirmed += 1;
  if (reaction.review === 'contradicted') target.measuredContradicted += 1;
  target.measuredDays.add(analyticDayKey);
}

function addRollup(target: ObservationAccumulator, rollup: LongitudinalRollup): void {
  target.totalExposureMs += rollup.exposureMs;
  target.totalExposures += rollup.exposures;
  target.totalReactions += rollup.reactions;
  target.totalConfirmed += rollup.confirmed;
  target.totalContradicted += rollup.contradicted;
  target.days.add(rollup.dayKey);
  const measuredExposures = rollup.sensorMeasuredExposures ?? 0;
  if (measuredExposures <= 0) return;
  target.sensorMeasuredWallMs += rollup.sensorMeasuredWallMs ?? 0;
  target.sensorSampledMs += rollup.sensorSampledMs ?? 0;
  target.faceObservableMs += rollup.faceObservableMs ?? 0;
  target.measuredExposures += measuredExposures;
  target.measuredReactions += rollup.sensorMeasuredReactions ?? 0;
  target.measuredConfirmed += rollup.sensorMeasuredConfirmed ?? 0;
  target.measuredContradicted += rollup.sensorMeasuredContradicted ?? 0;
  target.measuredDays.add(rollup.dayKey);
}

function measurementMode(value: ObservationAccumulator): LongitudinalMeasurementMode {
  if (value.totalExposureMs <= 0 && value.totalReactions <= 0) return 'none';
  if (value.sensorMeasuredWallMs <= 0 && value.measuredExposures <= 0) return 'legacy-v1';
  const legacyExposureMs = Math.max(0, value.totalExposureMs - value.sensorMeasuredWallMs);
  const legacyReactions = Math.max(0, value.totalReactions - value.measuredReactions);
  return legacyExposureMs > 1 || legacyReactions > 0 ? 'mixed' : 'sensor-v2';
}

function effectiveExposureMs(value: ObservationAccumulator): number {
  const mode = measurementMode(value);
  return mode === 'sensor-v2' || mode === 'mixed' ? value.faceObservableMs : value.totalExposureMs;
}

function effectiveReactions(value: ObservationAccumulator): number {
  const mode = measurementMode(value);
  return mode === 'sensor-v2' || mode === 'mixed' ? value.measuredReactions : value.totalReactions;
}

function qualifiedExposureMap(
  archive: LongitudinalArchive,
  qualified: Set<string>,
): Map<string, LongitudinalExposure> {
  return new Map(archive.exposures
    .filter((exposure) => qualified.has(exposure.id))
    .map((exposure) => [exposure.id, exposure]));
}

function topicWindow(archive: LongitudinalArchive, window: LongitudinalDayWindow): Map<string, ObservationAccumulator> {
  const map = new Map<string, ObservationAccumulator>();
  const qualified = qualifiedLongitudinalExposureIds(archive.exposures);
  const measured = sensorMeasuredLongitudinalExposureIds(archive.exposures);
  const exposureById = qualifiedExposureMap(archive, qualified);

  for (const exposure of archive.exposures) {
    if (!qualified.has(exposure.id) || !dayKeyInLongitudinalWindow(exposure.dayKey, window)) continue;
    for (const tag of uniqueTags(exposure.tags)) addExposure(touch(map, tag), exposure, measured.has(exposure.id));
  }
  for (const reaction of archive.reactions) {
    const linkedExposure = exposureById.get(reaction.exposureId);
    if (!linkedExposure || !dayKeyInLongitudinalWindow(linkedExposure.dayKey, window)) continue;
    for (const tag of uniqueTags(reaction.tags)) {
      addReaction(touch(map, tag), reaction, measured.has(reaction.exposureId), linkedExposure.dayKey);
    }
  }
  for (const rollup of archive.rollups) {
    if (rollup.dimension === 'topic' && dayKeyInLongitudinalWindow(rollup.dayKey, window)) addRollup(touch(map, rollup.key), rollup);
  }
  return map;
}

function populationWindow(archive: LongitudinalArchive, window: LongitudinalDayWindow): ObservationAccumulator {
  const population = emptyAccumulator();
  const qualified = qualifiedLongitudinalExposureIds(archive.exposures);
  const measured = sensorMeasuredLongitudinalExposureIds(archive.exposures);
  const exposureById = qualifiedExposureMap(archive, qualified);

  for (const exposure of archive.exposures) {
    if (!qualified.has(exposure.id) || !dayKeyInLongitudinalWindow(exposure.dayKey, window)) continue;
    addExposure(population, exposure, measured.has(exposure.id));
  }
  for (const reaction of archive.reactions) {
    const linkedExposure = exposureById.get(reaction.exposureId);
    if (!linkedExposure || !dayKeyInLongitudinalWindow(linkedExposure.dayKey, window)) continue;
    addReaction(population, reaction, measured.has(reaction.exposureId), linkedExposure.dayKey);
  }
  for (const rollup of archive.rollups) {
    if (rollup.dimension === 'lane' && dayKeyInLongitudinalWindow(rollup.dayKey, window)) addRollup(population, rollup);
  }
  return population;
}

function populationRate(population: ObservationAccumulator): number {
  const units = effectiveExposureMs(population) / TEN_MINUTES_MS;
  if (units <= 0) return 0.2;
  return Math.max(0.05, Math.min(12, effectiveReactions(population) / units));
}

function measurementQuality(population: ObservationAccumulator): LongitudinalMeasurementQuality {
  const mode = measurementMode(population);
  const observed = mode === 'sensor-v2' || mode === 'mixed' ? population.measuredReactions : population.totalReactions;
  const confirmed = mode === 'sensor-v2' || mode === 'mixed' ? population.measuredConfirmed : population.totalConfirmed;
  const contradicted = mode === 'sensor-v2' || mode === 'mixed' ? population.measuredContradicted : population.totalContradicted;
  const reviewed = confirmed + contradicted;
  const reviewAgreement = reviewed ? confirmed / reviewed : undefined;
  const sensorSamplingCoverage = population.sensorMeasuredWallMs > 0
    ? Math.max(0, Math.min(1, population.sensorSampledMs / population.sensorMeasuredWallMs))
    : 0;
  const faceObservability = population.sensorSampledMs > 0
    ? Math.max(0, Math.min(1, population.faceObservableMs / population.sensorSampledMs))
    : 0;

  let status: LongitudinalMeasurementStatus = 'unvalidated';
  if ((mode === 'sensor-v2' || mode === 'mixed') && reviewed >= DEFAULT_MIN_VALIDATION_REVIEWS && reviewAgreement !== undefined) {
    status = reviewAgreement >= DEFAULT_MIN_VALIDATION_AGREEMENT
      && sensorSamplingCoverage >= DEFAULT_MIN_SENSOR_SAMPLING_COVERAGE
      && faceObservability >= DEFAULT_MIN_FACE_OBSERVABILITY
      ? 'supported'
      : 'questionable';
  }

  const result: LongitudinalMeasurementQuality = {
    mode,
    observed,
    reviewed,
    confirmed,
    contradicted,
    reviewCoverage: observed ? Math.min(1, reviewed / observed) : 0,
    sensorMeasuredWallMs: population.sensorMeasuredWallMs,
    sensorSampledMs: population.sensorSampledMs,
    faceObservableMs: population.faceObservableMs,
    sensorSamplingCoverage,
    faceObservability,
    status,
  };
  if (reviewAgreement !== undefined) result.reviewAgreement = reviewAgreement;
  return result;
}

const LANCZOS_COEFFICIENTS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
] as const;

function logGamma(value: number): number {
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let x = 0.99999999999980993;
  for (let index = 0; index < LANCZOS_COEFFICIENTS.length; index += 1) x += LANCZOS_COEFFICIENTS[index] / (z + index + 1);
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

function posteriorRate(reactions: number, exposureMs: number, priorRate: number): Posterior {
  const exposureUnits = Math.max(0, exposureMs) / TEN_MINUTES_MS;
  const priorShape = Math.max(0.5, priorRate * DEFAULT_PRIOR_EXPOSURE_UNITS);
  const shape = priorShape + Math.max(0, reactions);
  const rate = DEFAULT_PRIOR_EXPOSURE_UNITS + exposureUnits;
  const alpha = (1 - CREDIBLE_INTERVAL) / 2;
  return {
    mean: shape / rate,
    lower: gammaQuantile(shape, rate, alpha),
    upper: gammaQuantile(shape, rate, 1 - alpha),
    variance: shape / (rate * rate),
  };
}

function estimate(key: string, value: ObservationAccumulator | undefined, priorRate: number): LongitudinalRateEstimate {
  const safe = value ?? emptyAccumulator();
  const mode = measurementMode(safe);
  const exposureMs = effectiveExposureMs(safe);
  const reactions = effectiveReactions(safe);
  const confirmed = mode === 'sensor-v2' || mode === 'mixed' ? safe.measuredConfirmed : safe.totalConfirmed;
  const contradicted = mode === 'sensor-v2' || mode === 'mixed' ? safe.measuredContradicted : safe.totalContradicted;
  const reviewed = confirmed + contradicted;
  const posterior = posteriorRate(reactions, exposureMs, priorRate);
  const observedDays = mode === 'sensor-v2' || mode === 'mixed' ? safe.measuredDays.size : safe.days.size;
  const evidenceStrength = Math.max(0, Math.min(1,
    1 - Math.exp(-(exposureMs / TEN_MINUTES_MS + reactions * 0.55 + observedDays * 0.8 + reviewed * 0.2) / 6),
  ));
  const sensorSamplingCoverage = safe.sensorMeasuredWallMs > 0
    ? Math.max(0, Math.min(1, safe.sensorSampledMs / safe.sensorMeasuredWallMs)) : 0;
  const faceObservability = safe.sensorSampledMs > 0
    ? Math.max(0, Math.min(1, safe.faceObservableMs / safe.sensorSampledMs)) : 0;
  const legacyExposureMs = Math.max(0, safe.totalExposureMs - safe.sensorMeasuredWallMs);
  const legacyReactions = Math.max(0, safe.totalReactions - safe.measuredReactions);

  const result: LongitudinalRateEstimate = {
    key,
    measurementMode: mode,
    exposureMs,
    attributedExposureMs: safe.totalExposureMs,
    sensorMeasuredWallMs: safe.sensorMeasuredWallMs,
    sensorSampledMs: safe.sensorSampledMs,
    faceObservableMs: safe.faceObservableMs,
    sensorSamplingCoverage,
    faceObservability,
    legacyExposureMs,
    exposures: safe.totalExposures,
    measuredExposures: safe.measuredExposures,
    observedDays,
    reactions,
    totalReactions: safe.totalReactions,
    measuredReactions: safe.measuredReactions,
    legacyReactions,
    confirmed,
    contradicted,
    reviewCoverage: reactions ? Math.min(1, reviewed / reactions) : 0,
    ratePer10Min: posterior.mean,
    baselinePer10Min: priorRate,
    rateRatio: priorRate > 0 ? posterior.mean / priorRate : 1,
    lowerPer10Min: posterior.lower,
    upperPer10Min: posterior.upper,
    intervalLevel: CREDIBLE_INTERVAL,
    evidenceStrength,
  };
  if (reviewed) result.reviewAgreement = confirmed / reviewed;
  return result;
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}
function normalCdf(value: number): number { return 0.5 * (1 + erf(value / Math.SQRT2)); }
function twoSidedNormalP(z: number): number { return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z))))); }

function benjaminiHochberg(entries: Array<{ index: number; pValue: number }>): Map<number, number> {
  if (!entries.length) return new Map<number, number>();
  const sorted = [...entries].sort((left, right) => left.pValue - right.pValue);
  const adjusted = new Array<number>(sorted.length);
  let running = 1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    running = Math.min(running, sorted[index].pValue * sorted.length / (index + 1));
    adjusted[index] = Math.max(0, Math.min(1, running));
  }
  return new Map(sorted.map((entry, index) => [entry.index, adjusted[index]]));
}

export function inferLongitudinalMeasurementQuality(archive: LongitudinalArchive, days = 90, now = Date.now()): LongitudinalMeasurementQuality {
  return measurementQuality(populationWindow(archive, longitudinalDayWindow(days, now)));
}

export function inferLongitudinalTopicRates(archive: LongitudinalArchive, days = 90, now = Date.now()): LongitudinalRateEstimate[] {
  const window = longitudinalDayWindow(days, now);
  const map = topicWindow(archive, window);
  const prior = populationRate(populationWindow(archive, window));
  return Array.from(map.entries())
    .map(([key, value]) => estimate(key, value, prior))
    .filter((entry) => entry.attributedExposureMs >= 30_000)
    .sort((left, right) => right.evidenceStrength - left.evidenceStrength
      || right.lowerPer10Min - left.lowerPer10Min
      || right.attributedExposureMs - left.attributedExposureMs);
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
    const recentPosterior = posteriorRate(recent.reactions, recent.exposureMs, prior);
    const previousPosterior = posteriorRate(previous.reactions, previous.exposureMs, prior);
    const delta = recentPosterior.mean - previousPosterior.mean;
    const scale = Math.max(0.2, (recentPosterior.mean + previousPosterior.mean) / 2);
    const relativeChange = delta / scale;
    const standardError = Math.sqrt(recentPosterior.variance + previousPosterior.variance);
    const signalStrength = standardError > 0 ? Math.abs(delta) / standardError : 0;
    const pValue = twoSidedNormalP(signalStrength);

    let prelimReason: LongitudinalTrendReason = 'stable';
    if (recent.measurementMode === 'legacy-v1' && previous.measurementMode === 'legacy-v1') prelimReason = 'sensor-uninstrumented';
    else if (recent.measurementMode !== 'sensor-v2' || previous.measurementMode !== 'sensor-v2') prelimReason = 'measurement-transition';
    else if (measurement.sensorSamplingCoverage < DEFAULT_MIN_SENSOR_SAMPLING_COVERAGE) prelimReason = 'sensor-sampling-low';
    else if (measurement.faceObservability < DEFAULT_MIN_FACE_OBSERVABILITY) prelimReason = 'face-observability-low';
    else if (measurement.status === 'unvalidated') prelimReason = 'measurement-unvalidated';
    else if (measurement.status === 'questionable') prelimReason = 'measurement-questionable';
    else if (recent.exposureMs < minWindowExposureMs || previous.exposureMs < minWindowExposureMs) prelimReason = 'low-exposure';
    else if (recent.observedDays < DEFAULT_MIN_TREND_DAYS || previous.observedDays < DEFAULT_MIN_TREND_DAYS) prelimReason = 'single-day';
    else if (recent.reactions + previous.reactions < DEFAULT_MIN_TREND_EVENTS) prelimReason = 'few-events';
    else if (Math.abs(relativeChange) < 0.35) prelimReason = 'small-effect';

    drafts.push({ key, recent, previous, relativeChange, signalStrength, pValue, prelimReason, eligibleForMultiplicity: prelimReason === 'stable' });
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
    } else reason = 'multiplicity';

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
    return rightActive - leftActive || right.evidenceStrength - left.evidenceStrength
      || right.recent.observedDays - left.recent.observedDays
      || right.recent.attributedExposureMs - left.recent.attributedExposureMs;
  });
}
