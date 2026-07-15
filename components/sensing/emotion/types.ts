// Core types + constants for the in-browser emotion sensing layer.
// Pure data only — no DOM, no MediaPipe imports. Safe to unit test.

export const EMOTIONS = ['joy', 'calm', 'surprise', 'sadness', 'anger', 'fear'] as const;

export type Emotion = (typeof EMOTIONS)[number];

/** Normalized emotion distribution — scores sum to ~1. */
export type EmotionVector = Record<Emotion, number>;

/** Result of interpreting a single frame of blendshapes. */
export interface EmotionReading {
  /** Normalized distribution over the 6 emotions (sums to ~1). */
  scores: EmotionVector;
  /** Highest-scoring emotion. */
  dominant: Emotion;
  /** How strongly the expression is being made (0 = resting, 1 = extreme). */
  intensity: number;
}

/**
 * The ARKit-style blendshapes we actually read. MediaPipe FaceLandmarker emits
 * 52 of these; we only need a focused subset for a 6-emotion heuristic.
 */
export type BlendshapeMap = Record<string, number>;

/** A resting-face reading — used as the initial/fallback state. */
export function neutralReading(): EmotionReading {
  return {
    scores: { joy: 0, calm: 1, surprise: 0, sadness: 0, anger: 0, fear: 0 },
    dominant: 'calm',
    intensity: 0,
  };
}
