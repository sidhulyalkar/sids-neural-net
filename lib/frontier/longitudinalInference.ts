import {
  inferLongitudinalMeasurementQuality,
  inferLongitudinalTopicRates,
  inferLongitudinalTopicTrends as inferCohortBaseTopicTrends,
  type LongitudinalMeasurementMode,
  type LongitudinalMeasurementQuality,
  type LongitudinalMeasurementStatus,
  type LongitudinalRateEstimate,
  type LongitudinalTopicTrend,
  type LongitudinalTrendDirection,
  type LongitudinalTrendReason,
} from './longitudinalInferenceCohortBase';
import {
  benjaminiHochbergQValues,
  exactConditionalPoissonRatePValue,
} from './longitudinalStatistics';
import type { LongitudinalArchive } from './longitudinalModel';

/**
 * FRONTIER v20 public longitudinal-inference facade.
 *
 * The cohort-integrity base is retained byte-for-byte from the qualified v20a
 * reconciliation for descriptive Gamma-Poisson estimates, credible intervals,
 * cohort construction and evidence strength. Its provisional p/q/direction
 * fields are intentionally ignored here. v20 replaces only the public
 * hypothesis-test layer: exact conditional rate tests, a measurement-eligible
 * BH family, then post-BH event-count and materiality gates.
 */

export type {
  LongitudinalMeasurementMode,
  LongitudinalMeasurementQuality,
  LongitudinalMeasurementStatus,
  LongitudinalRateEstimate,
  LongitudinalTopicTrend,
  LongitudinalTrendDirection,
  LongitudinalTrendReason,
};
export { inferLongitudinalMeasurementQuality, inferLongitudinalTopicRates };

const DEFAULT_MIN_TREND_EXPOSURE_MS = 10 * 60_000;
const DEFAULT_MIN_TREND_DAYS = 2;
const DEFAULT_MIN_TREND_EVENTS = 4;
const DEFAULT_MIN_SENSOR_SAMPLING_COVERAGE = 0.65;
const DEFAULT_MIN_FACE_OBSERVABILITY = 0.5;
const DEFAULT_FDR = 0.1;
const DEFAULT_MIN_MATERIAL_RELATIVE_CHANGE = 0.35;

type CalibratedDraft = {
  base: LongitudinalTopicTrend;
  pValue: number;
  eligibilityReason: LongitudinalTrendReason;
  postMultiplicityReason: LongitudinalTrendReason;
  eligibleForMultiplicity: boolean;
};

function multiplicityEligibilityReason(
  trend: LongitudinalTopicTrend,
  minWindowExposureMs: number,
): LongitudinalTrendReason {
  if (trend.recent.measurementMode === 'legacy-v1' && trend.previous.measurementMode === 'legacy-v1') return 'sensor-uninstrumented';
  if (trend.recent.measurementMode !== 'sensor-v2' || trend.previous.measurementMode !== 'sensor-v2') return 'measurement-transition';
  if (trend.measurement.sensorSamplingCoverage < DEFAULT_MIN_SENSOR_SAMPLING_COVERAGE) return 'sensor-sampling-low';
  if (trend.measurement.faceObservability < DEFAULT_MIN_FACE_OBSERVABILITY) return 'face-observability-low';
  if (trend.measurement.status === 'unvalidated') return 'measurement-unvalidated';
  if (trend.measurement.status === 'questionable') return 'measurement-questionable';
  if (trend.recent.exposureMs < minWindowExposureMs || trend.previous.exposureMs < minWindowExposureMs) return 'low-exposure';
  // observedDays is exposure-derived for sensor-v2 cohorts, so this filter does
  // not inspect the direction or magnitude of the tested cue-rate outcome.
  if (trend.recent.observedDays < DEFAULT_MIN_TREND_DAYS || trend.previous.observedDays < DEFAULT_MIN_TREND_DAYS) return 'single-day';
  return 'stable';
}

function postMultiplicityReason(trend: LongitudinalTopicTrend): LongitudinalTrendReason {
  if (trend.recent.reactions + trend.previous.reactions < DEFAULT_MIN_TREND_EVENTS) return 'few-events';
  if (Math.abs(trend.relativeChange) < DEFAULT_MIN_MATERIAL_RELATIVE_CHANGE) return 'small-effect';
  return 'stable';
}

export function inferLongitudinalTopicTrends(
  archive: LongitudinalArchive,
  windowDays = 14,
  now = Date.now(),
  minWindowExposureMs = DEFAULT_MIN_TREND_EXPOSURE_MS,
): LongitudinalTopicTrend[] {
  const baseTrends = inferCohortBaseTopicTrends(archive, windowDays, now, minWindowExposureMs);
  const drafts: CalibratedDraft[] = baseTrends.map((base) => {
    const eligibilityReason = multiplicityEligibilityReason(base, minWindowExposureMs);
    return {
      base,
      pValue: exactConditionalPoissonRatePValue(
        base.recent.reactions,
        base.recent.exposureMs,
        base.previous.reactions,
        base.previous.exposureMs,
      ),
      eligibilityReason,
      postMultiplicityReason: postMultiplicityReason(base),
      eligibleForMultiplicity: eligibilityReason === 'stable',
    };
  });

  const eligible = drafts
    .map((draft, index) => ({ draft, index }))
    .filter(({ draft }) => draft.eligibleForMultiplicity);
  const adjusted = benjaminiHochbergQValues(eligible.map(({ draft }) => draft.pValue));
  const qValues = new Map(eligible.map(({ index }, eligibleIndex) => [index, adjusted[eligibleIndex]]));

  const calibrated = drafts.map((draft, index): LongitudinalTopicTrend => {
    const qValue = qValues.get(index) ?? 1;
    let direction: LongitudinalTrendDirection = 'stable';
    let reason: LongitudinalTrendReason = 'multiplicity';

    if (!draft.eligibleForMultiplicity) {
      direction = 'insufficient';
      reason = draft.eligibilityReason;
    } else if (draft.postMultiplicityReason !== 'stable') {
      direction = 'insufficient';
      reason = draft.postMultiplicityReason;
    } else if (qValue <= DEFAULT_FDR) {
      direction = draft.base.relativeChange > 0 ? 'rising' : 'cooling';
      reason = 'detected';
    }

    return {
      ...draft.base,
      direction,
      reason,
      pValue: draft.pValue,
      qValue,
    };
  });

  return calibrated.sort((left, right) => {
    const leftActive = left.direction === 'rising' || left.direction === 'cooling' ? 1 : 0;
    const rightActive = right.direction === 'rising' || right.direction === 'cooling' ? 1 : 0;
    return rightActive - leftActive || right.evidenceStrength - left.evidenceStrength
      || right.recent.observedDays - left.recent.observedDays
      || right.recent.attributedExposureMs - left.recent.attributedExposureMs;
  });
}
