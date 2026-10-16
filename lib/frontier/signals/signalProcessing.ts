export type FrontierSignalFeatures = {
  load: number;
  mean: number;
  standardDeviation: number;
  derivativeRms: number;
  sampleCount: number;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export class FloatRingBuffer {
  private readonly values: Float32Array;
  private cursor = 0;
  private lengthValue = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new Error('ring buffer capacity must be >= 2');
    this.values = new Float32Array(capacity);
  }

  get capacity(): number { return this.values.length; }
  get length(): number { return this.lengthValue; }

  push(value: number): void {
    if (!Number.isFinite(value)) return;
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.lengthValue = Math.min(this.values.length, this.lengthValue + 1);
  }

  pushMany(values: ArrayLike<number>): void {
    for (let index = 0; index < values.length; index += 1) this.push(values[index]);
  }

  snapshot(): Float32Array {
    const output = new Float32Array(this.lengthValue);
    const start = (this.cursor - this.lengthValue + this.values.length) % this.values.length;
    for (let index = 0; index < this.lengthValue; index += 1) {
      output[index] = this.values[(start + index) % this.values.length];
    }
    return output;
  }

  clear(): void {
    this.cursor = 0;
    this.lengthValue = 0;
    this.values.fill(0);
  }
}

export function signalWindowFeatures(values: Float32Array): Omit<FrontierSignalFeatures, 'load'> {
  if (!values.length) return { mean: 0, standardDeviation: 0, derivativeRms: 0, sampleCount: 0 };
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) sum += values[index];
  const mean = sum / values.length;
  let variance = 0;
  let derivativeEnergy = 0;
  for (let index = 0; index < values.length; index += 1) {
    const delta = values[index] - mean;
    variance += delta * delta;
    if (index) {
      const derivative = values[index] - values[index - 1];
      derivativeEnergy += derivative * derivative;
    }
  }
  return {
    mean,
    standardDeviation: Math.sqrt(variance / values.length),
    derivativeRms: values.length > 1 ? Math.sqrt(derivativeEnergy / (values.length - 1)) : 0,
    sampleCount: values.length,
  };
}

/**
 * Generic, non-diagnostic signal-load estimator. It measures how temporally
 * unstable the current window is relative to a slowly learned local baseline.
 * A device-specific bridge may supply heart-rate intervals, skin-conductance,
 * EEG features, fNIRS features, or another scalar stream, but FRONTIER does not
 * interpret this value as a medical diagnosis or validated fatigue measure.
 */
export class FrontierSignalLoadEstimator {
  private readonly ring: FloatRingBuffer;
  private baselineDeviation = 0;
  private baselineDerivative = 0;
  private initialized = false;
  private smoothedLoad = 0;

  constructor(capacity = 512) {
    this.ring = new FloatRingBuffer(capacity);
  }

  push(values: ArrayLike<number>): FrontierSignalFeatures {
    this.ring.pushMany(values);
    const features = signalWindowFeatures(this.ring.snapshot());
    if (features.sampleCount < 8) return { ...features, load: this.smoothedLoad };

    if (!this.initialized) {
      this.baselineDeviation = Math.max(1e-6, features.standardDeviation);
      this.baselineDerivative = Math.max(1e-6, features.derivativeRms);
      this.initialized = true;
    } else {
      const alpha = 0.015;
      this.baselineDeviation = this.baselineDeviation * (1 - alpha) + Math.max(1e-6, features.standardDeviation) * alpha;
      this.baselineDerivative = this.baselineDerivative * (1 - alpha) + Math.max(1e-6, features.derivativeRms) * alpha;
    }

    const deviationRatio = features.standardDeviation / Math.max(1e-6, this.baselineDeviation);
    const derivativeRatio = features.derivativeRms / Math.max(1e-6, this.baselineDerivative);
    const activity = Math.log1p(Math.max(0, deviationRatio - 0.8)) * 0.42
      + Math.log1p(Math.max(0, derivativeRatio - 0.8)) * 0.58;
    const instantaneous = clamp(activity / 1.25);
    this.smoothedLoad = this.smoothedLoad * 0.86 + instantaneous * 0.14;
    return { ...features, load: clamp(this.smoothedLoad) };
  }

  reset(): void {
    this.ring.clear();
    this.baselineDeviation = 0;
    this.baselineDerivative = 0;
    this.initialized = false;
    this.smoothedLoad = 0;
  }
}

/** Only positive implicit evidence is attenuated. Explicit intent is sovereign. */
export function modulateImplicitSignalWeight(weight: number, load: number, explicit = false): number {
  if (explicit || weight <= 0) return weight;
  const boundedLoad = clamp(load);
  return weight * (1 - 0.45 * boundedLoad);
}
