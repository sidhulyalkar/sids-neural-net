export const FRONTIER_AMBIENT_REACTION_KINDS = ['affinity', 'interest', 'surprise', 'friction'] as const;

export type FrontierAmbientReactionKind = (typeof FRONTIER_AMBIENT_REACTION_KINDS)[number];

export type FrontierExpressionVector = {
  smile: number;
  browRaise: number;
  browFurrow: number;
  eyeWide: number;
  eyeSquint: number;
  jawOpen: number;
  mouthPress: number;
};

export type FrontierReactionFaceInput = {
  active: boolean;
  yaw: number;
  pitch: number;
  stillness: number;
  expressions: FrontierExpressionVector;
};

export type FrontierAmbientReaction = {
  kind: FrontierAmbientReactionKind;
  confidence: number;
  intensity: number;
  durationMs: number;
  observedAt: number;
};

export type ReactionInferenceSnapshot = {
  phase: 'idle' | 'calibrating' | 'listening';
  calibration: number;
  dominant?: FrontierAmbientReactionKind;
  confidence: number;
  scores: Record<FrontierAmbientReactionKind, number>;
  reaction?: FrontierAmbientReaction;
};

export type ReactionInferenceConfig = {
  calibrationMs: number;
  minimumCalibrationSamples: number;
  emaAlpha: number;
  minConfidence: number;
  minMargin: number;
  minDurationMs: number;
  minimumTargetDwellMs: number;
  cooldownMs: number;
  globalCooldownMs: number;
};

export const DEFAULT_REACTION_INFERENCE_CONFIG: ReactionInferenceConfig = {
  calibrationMs: 2_400,
  minimumCalibrationSamples: 20,
  emaAlpha: 0.22,
  minConfidence: 0.7,
  minMargin: 0.11,
  minDurationMs: 1_000,
  minimumTargetDwellMs: 700,
  cooldownMs: 9_000,
  globalCooldownMs: 6_000,
};

const ZERO_EXPRESSIONS: FrontierExpressionVector = {
  smile: 0,
  browRaise: 0,
  browFurrow: 0,
  eyeWide: 0,
  eyeSquint: 0,
  jawOpen: 0,
  mouthPress: 0,
};

const ZERO_SCORES: Record<FrontierAmbientReactionKind, number> = {
  affinity: 0,
  interest: 0,
  surprise: 0,
  friction: 0,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function mean(left: number, right: number): number {
  return clamp((left + right) * 0.5);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) * 0.5;
}

function mix(previous: number, next: number, alpha: number): number {
  return previous + (next - previous) * alpha;
}

function copyExpressions(source: FrontierExpressionVector): FrontierExpressionVector {
  return {
    smile: clamp(source.smile),
    browRaise: clamp(source.browRaise),
    browFurrow: clamp(source.browFurrow),
    eyeWide: clamp(source.eyeWide),
    eyeSquint: clamp(source.eyeSquint),
    jawOpen: clamp(source.jawOpen),
    mouthPress: clamp(source.mouthPress),
  };
}

export function expressionVectorFromBlendshapes(
  blendshapes: Record<string, number | undefined>
): FrontierExpressionVector {
  const score = (name: string) => clamp(blendshapes[name] ?? 0);
  return {
    smile: mean(score('mouthSmileLeft'), score('mouthSmileRight')),
    browRaise: clamp(Math.max(score('browInnerUp'), mean(score('browOuterUpLeft'), score('browOuterUpRight')))),
    browFurrow: mean(score('browDownLeft'), score('browDownRight')),
    eyeWide: mean(score('eyeWideLeft'), score('eyeWideRight')),
    eyeSquint: mean(score('eyeSquintLeft'), score('eyeSquintRight')),
    jawOpen: score('jawOpen'),
    mouthPress: mean(score('mouthPressLeft'), score('mouthPressRight')),
  };
}

export function scoreReactionCues(
  face: FrontierReactionFaceInput,
  baseline: FrontierExpressionVector
): Record<FrontierAmbientReactionKind, number> {
  if (!face.active) return { ...ZERO_SCORES };
  const expression = face.expressions;
  const delta = {
    smile: Math.max(0, expression.smile - baseline.smile),
    browRaise: Math.max(0, expression.browRaise - baseline.browRaise),
    browFurrow: Math.max(0, expression.browFurrow - baseline.browFurrow),
    eyeWide: Math.max(0, expression.eyeWide - baseline.eyeWide),
    eyeSquint: Math.max(0, expression.eyeSquint - baseline.eyeSquint),
    jawOpen: Math.max(0, expression.jawOpen - baseline.jawOpen),
    mouthPress: Math.max(0, expression.mouthPress - baseline.mouthPress),
  };
  const forward = clamp(1 - (Math.abs(face.yaw) / 0.65 + Math.abs(face.pitch) / 0.55) * 0.5);
  const still = clamp(face.stillness);

  const affinity = clamp(delta.smile * 2.25 + delta.eyeSquint * 0.55 - delta.mouthPress * 0.25);
  const surprise = clamp(delta.eyeWide * 1.55 + delta.browRaise * 1.2 + delta.jawOpen * 0.72 - delta.smile * 0.12);
  const friction = clamp(delta.browFurrow * 1.7 + delta.mouthPress * 1.2 - delta.smile * 0.35);

  // Head pose is corroborating evidence only. A neutral person looking forward and
  // sitting still must never be classified as interested just for existing in
  // front of the camera.
  const activeAttention = clamp(
    delta.eyeSquint * 1.05
      + delta.browRaise * 0.5
      + delta.eyeWide * 0.16
      - surprise * 0.18
  );
  const postureSupport = activeAttention >= 0.08 ? forward * 0.18 + still * 0.12 : 0;
  const interest = clamp(activeAttention + postureSupport - affinity * 0.08);

  return { affinity, interest, surprise, friction };
}

function strongest(scores: Record<FrontierAmbientReactionKind, number>): {
  kind?: FrontierAmbientReactionKind;
  score: number;
  margin: number;
} {
  const ranked = FRONTIER_AMBIENT_REACTION_KINDS
    .map((kind) => ({ kind, score: scores[kind] }))
    .sort((a, b) => b.score - a.score);
  return {
    kind: ranked[0]?.kind,
    score: ranked[0]?.score ?? 0,
    margin: (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0),
  };
}

/**
 * Stabilizes derived face-expression cues into sparse, content-addressable events.
 * It never receives images, landmarks, identity embeddings, or biometric templates.
 */
export class ReactionInferenceEngine {
  private config: ReactionInferenceConfig;
  private calibrationStartedAt?: number;
  private calibrationSamples = 0;
  private calibrationWindow: FrontierExpressionVector[] = [];
  private baseline: FrontierExpressionVector = { ...ZERO_EXPRESSIONS };
  private smoothed: Record<FrontierAmbientReactionKind, number> = { ...ZERO_SCORES };
  private targetId = '';
  private targetStartedAt?: number;
  private candidate?: FrontierAmbientReactionKind;
  private candidateStartedAt?: number;
  private lastEmittedAt = -Infinity;
  private lastEmitted = new Map<string, number>();

  constructor(config: Partial<ReactionInferenceConfig> = {}) {
    this.config = { ...DEFAULT_REACTION_INFERENCE_CONFIG, ...config };
  }

  reset() {
    this.calibrationStartedAt = undefined;
    this.calibrationSamples = 0;
    this.calibrationWindow = [];
    this.baseline = { ...ZERO_EXPRESSIONS };
    this.smoothed = { ...ZERO_SCORES };
    this.targetId = '';
    this.targetStartedAt = undefined;
    this.candidate = undefined;
    this.candidateStartedAt = undefined;
    this.lastEmittedAt = -Infinity;
    this.lastEmitted.clear();
  }

  push(face: FrontierReactionFaceInput, targetId: string | undefined, now: number): ReactionInferenceSnapshot {
    if (!face.active) {
      this.clearCandidate();
      return { phase: 'idle', calibration: this.calibrationProgress(now), confidence: 0, scores: { ...this.smoothed } };
    }

    if (this.calibrationStartedAt === undefined) this.calibrationStartedAt = now;
    if (!this.isCalibrated(now)) {
      this.captureBaseline(face.expressions);
      return {
        phase: 'calibrating',
        calibration: this.calibrationProgress(now),
        confidence: 0,
        scores: { ...ZERO_SCORES },
      };
    }

    if (!targetId) {
      this.targetId = '';
      this.targetStartedAt = undefined;
      this.smoothed = { ...ZERO_SCORES };
      this.clearCandidate();
      this.adaptBaseline(face.expressions);
      return { phase: 'listening', calibration: 1, confidence: 0, scores: { ...this.smoothed } };
    }

    if (targetId !== this.targetId) {
      this.targetId = targetId;
      this.targetStartedAt = now;
      this.clearCandidate();
      this.smoothed = { ...ZERO_SCORES };
    }

    const raw = scoreReactionCues(face, this.baseline);
    for (const kind of FRONTIER_AMBIENT_REACTION_KINDS) {
      this.smoothed[kind] = mix(this.smoothed[kind], raw[kind], this.config.emaAlpha);
    }
    const top = strongest(this.smoothed);
    const targetDwellMs = Math.max(0, now - (this.targetStartedAt ?? now));
    if (targetDwellMs < this.config.minimumTargetDwellMs) {
      this.clearCandidate();
      return { phase: 'listening', calibration: 1, dominant: top.kind, confidence: top.score, scores: { ...this.smoothed } };
    }

    const qualifies = Boolean(top.kind) && top.score >= this.config.minConfidence && top.margin >= this.config.minMargin;
    if (!qualifies || !top.kind) {
      this.clearCandidate();
      this.adaptBaseline(face.expressions);
      return { phase: 'listening', calibration: 1, dominant: top.kind, confidence: top.score, scores: { ...this.smoothed } };
    }

    if (this.candidate !== top.kind) {
      this.candidate = top.kind;
      this.candidateStartedAt = now;
    }
    const durationMs = Math.max(0, now - (this.candidateStartedAt ?? now));
    const cooldownKey = `${targetId}:${top.kind}`;
    const targetCooledDown = now - (this.lastEmitted.get(cooldownKey) ?? -Infinity) >= this.config.cooldownMs;
    const globallyCooledDown = now - this.lastEmittedAt >= this.config.globalCooldownMs;
    const reaction = durationMs >= this.config.minDurationMs && targetCooledDown && globallyCooledDown
      ? {
          kind: top.kind,
          confidence: clamp(top.score),
          intensity: clamp((top.score - this.config.minConfidence) / Math.max(0.01, 1 - this.config.minConfidence)),
          durationMs,
          observedAt: now,
        } satisfies FrontierAmbientReaction
      : undefined;

    if (reaction) {
      this.lastEmitted.set(cooldownKey, now);
      this.lastEmittedAt = now;
      this.clearCandidate();
    }

    return {
      phase: 'listening',
      calibration: 1,
      dominant: top.kind,
      confidence: top.score,
      scores: { ...this.smoothed },
      reaction,
    };
  }

  private clearCandidate() {
    this.candidate = undefined;
    this.candidateStartedAt = undefined;
  }

  private captureBaseline(expressions: FrontierExpressionVector) {
    const next = copyExpressions(expressions);
    this.calibrationSamples += 1;
    this.calibrationWindow.push(next);
    if (this.calibrationWindow.length > 96) this.calibrationWindow.shift();
    for (const key of Object.keys(next) as Array<keyof FrontierExpressionVector>) {
      this.baseline[key] = median(this.calibrationWindow.map((sample) => sample[key]));
    }
  }

  private adaptBaseline(expressions: FrontierExpressionVector) {
    const next = copyExpressions(expressions);
    const alpha = 0.012;
    for (const key of Object.keys(next) as Array<keyof FrontierExpressionVector>) {
      this.baseline[key] = mix(this.baseline[key], next[key], alpha);
    }
  }

  private isCalibrated(now: number): boolean {
    if (this.calibrationStartedAt === undefined) return false;
    return this.calibrationSamples >= this.config.minimumCalibrationSamples
      && now - this.calibrationStartedAt >= this.config.calibrationMs;
  }

  private calibrationProgress(now: number): number {
    if (this.calibrationStartedAt === undefined) return 0;
    const timeProgress = clamp((now - this.calibrationStartedAt) / this.config.calibrationMs);
    const sampleProgress = clamp(this.calibrationSamples / this.config.minimumCalibrationSamples);
    return Math.min(timeProgress, sampleProgress);
  }
}