export const FRONTIER_SENSOR_MEASUREMENT_VERSION = 2 as const;
export const FRONTIER_SENSOR_MAX_SAMPLE_GAP_MS = 250;

export type SensorObservabilityAccumulator = {
  measurementVersion: typeof FRONTIER_SENSOR_MEASUREMENT_VERSION;
  startedAt: number;
  lastSampleAt: number;
  samples: number;
  faceObservedSamples: number;
  sampledMs: number;
  faceObservableMs: number;
  gapCount: number;
  outOfOrderSamples: number;
  maxRawGapMs: number;
};

export type SensorObservabilitySnapshot = SensorObservabilityAccumulator & {
  elapsedMs: number;
  samplingCoverage: number;
  faceCoverage: number;
};

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** Start a sensor-availability episode using a monotonic clock such as performance.now(). */
export function createSensorObservabilityAccumulator(
  sampleAt: number,
  faceObservable = false,
): SensorObservabilityAccumulator {
  const at = finiteNonNegative(sampleAt);
  return {
    measurementVersion: FRONTIER_SENSOR_MEASUREMENT_VERSION,
    startedAt: at,
    lastSampleAt: at,
    samples: 1,
    faceObservedSamples: faceObservable ? 1 : 0,
    sampledMs: 0,
    faceObservableMs: 0,
    gapCount: 0,
    outOfOrderSamples: 0,
    maxRawGapMs: 0,
  };
}

/**
 * Integrate one actual inference callback. Only a bounded interval between real
 * callbacks receives credit, so a suspended tab, worker stall, or model freeze is
 * explicit missingness rather than invented sensor exposure.
 */
export function observeSensorSample(
  current: SensorObservabilityAccumulator,
  sampleAt: number,
  faceObservable: boolean,
  maxSampleGapMs = FRONTIER_SENSOR_MAX_SAMPLE_GAP_MS,
): SensorObservabilityAccumulator {
  const at = finiteNonNegative(sampleAt);
  const gapLimit = Math.max(1, finiteNonNegative(maxSampleGapMs));
  if (at < current.lastSampleAt) {
    return {
      ...current,
      samples: current.samples + 1,
      faceObservedSamples: current.faceObservedSamples + (faceObservable ? 1 : 0),
      outOfOrderSamples: current.outOfOrderSamples + 1,
    };
  }

  const rawGap = at - current.lastSampleAt;
  const credited = Math.min(rawGap, gapLimit);
  return {
    ...current,
    lastSampleAt: at,
    samples: current.samples + 1,
    faceObservedSamples: current.faceObservedSamples + (faceObservable ? 1 : 0),
    sampledMs: current.sampledMs + credited,
    faceObservableMs: current.faceObservableMs + (faceObservable ? credited : 0),
    gapCount: current.gapCount + (rawGap > gapLimit ? 1 : 0),
    maxRawGapMs: Math.max(current.maxRawGapMs, rawGap),
  };
}

export function sensorObservabilitySnapshot(value: SensorObservabilityAccumulator): SensorObservabilitySnapshot {
  const elapsedMs = Math.max(0, value.lastSampleAt - value.startedAt);
  const sampledMs = Math.min(elapsedMs, Math.max(0, value.sampledMs));
  const faceObservableMs = Math.min(sampledMs, Math.max(0, value.faceObservableMs));
  return {
    ...value,
    sampledMs,
    faceObservableMs,
    elapsedMs,
    samplingCoverage: elapsedMs > 0 ? clamp01(sampledMs / elapsedMs) : 0,
    faceCoverage: sampledMs > 0 ? clamp01(faceObservableMs / sampledMs) : 0,
  };
}

/** Privacy-safe aggregate projection for longitudinal storage. */
export function sensorObservabilityArchiveFields(value: SensorObservabilityAccumulator): {
  measurementVersion: typeof FRONTIER_SENSOR_MEASUREMENT_VERSION;
  sensorSampledMs: number;
  faceObservableMs: number;
} {
  const snapshot = sensorObservabilitySnapshot(value);
  return {
    measurementVersion: FRONTIER_SENSOR_MEASUREMENT_VERSION,
    sensorSampledMs: snapshot.sampledMs,
    faceObservableMs: snapshot.faceObservableMs,
  };
}
