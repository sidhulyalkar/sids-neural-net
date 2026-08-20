export const GESTURE_CALIBRATION_VERSION = 2;
export const GESTURE_CALIBRATION_STORAGE_KEY = 'sids.gesture-calibration.v2';

export type CalibrationStepId =
  | 'aim'
  | 'pinch'
  | 'back'
  | 'scroll-down'
  | 'scroll-up';

export const CALIBRATION_STEPS: ReadonlyArray<{
  id: CalibrationStepId;
  title: string;
  short: string;
}> = [
  { id: 'aim', title: 'Aim', short: 'Hold the cursor on the calibration target.' },
  { id: 'pinch', title: 'Click', short: 'Pinch the locked target, then release.' },
  { id: 'back', title: 'Back', short: 'Make a closed fist and hold it briefly.' },
  { id: 'scroll-down', title: 'Scroll down', short: 'Hold up two fingers and move them downward.' },
  { id: 'scroll-up', title: 'Scroll up', short: 'Keep two fingers up and move them upward.' },
] as const;

export interface GestureCalibrationProfile {
  version: typeof GESTURE_CALIBRATION_VERSION;
  calibratedAt: number;
  targetProbeRadiusPx: number;
  targetLockMs: number;
  pinchHoldMs: number;
  releaseArmMs: number;
  /** Robust radial pointer jitter measured while holding the calibration target. */
  pointerJitterPx: number;
  /** User's observed pinch-and-release duration during calibration. */
  pinchDurationMs: number;
}

export interface GestureCalibrationEvidence {
  pointerSamples: ReadonlyArray<{ x: number; y: number }>;
  pinchDurationMs: number;
  calibratedAt?: number;
}

export const DEFAULT_GESTURE_CALIBRATION: GestureCalibrationProfile = {
  version: GESTURE_CALIBRATION_VERSION,
  calibratedAt: 0,
  targetProbeRadiusPx: 20,
  targetLockMs: 120,
  pinchHoldMs: 150,
  releaseArmMs: 100,
  pointerJitterPx: 0,
  pinchDurationMs: 300,
};

/** Slightly forgiving values used only inside the calibration sandbox. */
export const CALIBRATION_BOOTSTRAP_PROFILE: GestureCalibrationProfile = {
  ...DEFAULT_GESTURE_CALIBRATION,
  targetProbeRadiusPx: 30,
  targetLockMs: 110,
  pinchHoldMs: 130,
  releaseArmMs: 90,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp((sorted.length - 1) * q, 0, sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * Build a conservative per-browser profile from derived cursor motion only.
 * No camera frames or landmarks are retained.
 *
 * The calibrated profile tunes target acquisition and pinch cadence. Fist-back
 * and two-finger scroll must still pass the global production recognizer, so
 * calibration verifies them without silently weakening their identity gates.
 */
export function deriveGestureCalibration(
  evidence: GestureCalibrationEvidence,
): GestureCalibrationProfile {
  const samples = evidence.pointerSamples.filter(
    (sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y),
  );

  let pointerJitterPx = 0;
  if (samples.length >= 2) {
    const centerX = quantile(samples.map((sample) => sample.x), 0.5);
    const centerY = quantile(samples.map((sample) => sample.y), 0.5);
    const radial = samples.map((sample) => Math.hypot(sample.x - centerX, sample.y - centerY));
    pointerJitterPx = quantile(radial, 0.8);
  }

  pointerJitterPx = clamp(pointerJitterPx, 0, 30);
  const pinchDurationMs = clamp(
    Number.isFinite(evidence.pinchDurationMs) ? evidence.pinchDurationMs : 300,
    140,
    800,
  );

  return {
    version: GESTURE_CALIBRATION_VERSION,
    calibratedAt: evidence.calibratedAt ?? Date.now(),
    targetProbeRadiusPx: Math.round(clamp(18 + pointerJitterPx * 1.55, 20, 42)),
    targetLockMs: Math.round(clamp(105 + pointerJitterPx * 2.8, 105, 190)),
    pinchHoldMs: Math.round(clamp(pinchDurationMs * 0.45, 115, 190)),
    releaseArmMs: Math.round(clamp(90 + pointerJitterPx * 1.7, 90, 145)),
    pointerJitterPx: Math.round(pointerJitterPx * 10) / 10,
    pinchDurationMs: Math.round(pinchDurationMs),
  };
}

function validRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function parseGestureCalibration(value: unknown): GestureCalibrationProfile | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GestureCalibrationProfile>;
  if (candidate.version !== GESTURE_CALIBRATION_VERSION) return null;
  if (!validRange(candidate.calibratedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (!validRange(candidate.targetProbeRadiusPx, 16, 48)) return null;
  if (!validRange(candidate.targetLockMs, 80, 240)) return null;
  if (!validRange(candidate.pinchHoldMs, 90, 260)) return null;
  if (!validRange(candidate.releaseArmMs, 70, 220)) return null;
  if (!validRange(candidate.pointerJitterPx, 0, 50)) return null;
  if (!validRange(candidate.pinchDurationMs, 100, 1200)) return null;
  return candidate as GestureCalibrationProfile;
}

export function loadGestureCalibration(): GestureCalibrationProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const serialized = window.localStorage.getItem(GESTURE_CALIBRATION_STORAGE_KEY);
    return serialized ? parseGestureCalibration(JSON.parse(serialized)) : null;
  } catch {
    return null;
  }
}

export function saveGestureCalibration(profile: GestureCalibrationProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GESTURE_CALIBRATION_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Calibration still applies for this session if storage is unavailable.
  }
}

export function clearGestureCalibration(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GESTURE_CALIBRATION_STORAGE_KEY);
  } catch {
    // Private browsing/storage restrictions should never break gesture control.
  }
}
