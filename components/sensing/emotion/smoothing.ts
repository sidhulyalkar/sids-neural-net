// Exponential moving average over emotion readings, so the site's color
// eases between moods instead of strobing frame-to-frame. Pure.

import { clamp } from './color';
import type { Emotion, EmotionReading, EmotionVector } from './types';
import { EMOTIONS } from './types';

/** Default smoothing factor. Lower = smoother/slower, higher = snappier. */
export const DEFAULT_ALPHA = 0.14;

/**
 * Blend a previous reading toward the next one by `alpha`.
 * dominant is recomputed from the smoothed distribution so the label stays
 * consistent with the colors being shown.
 */
export function smoothReading(
  prev: EmotionReading,
  next: EmotionReading,
  alpha: number = DEFAULT_ALPHA,
): EmotionReading {
  const a = clamp(alpha, 0, 1);
  const scores = {} as EmotionVector;
  for (const e of EMOTIONS) {
    scores[e] = prev.scores[e] + (next.scores[e] - prev.scores[e]) * a;
  }

  let dominant: Emotion = 'calm';
  for (const e of EMOTIONS) {
    if (scores[e] > scores[dominant]) dominant = e;
  }

  const intensity = prev.intensity + (next.intensity - prev.intensity) * a;

  return { scores, dominant, intensity };
}
