// Transparent heuristic: 52 ARKit blendshapes -> 6-emotion reading.
// This is an explainable rule-based mapper, NOT a trained classifier. Every
// weight below is a design decision you can read and tune. Pure function.

import { clamp } from './color';
import type { BlendshapeMap, Emotion, EmotionReading, EmotionVector } from './types';
import { EMOTIONS } from './types';

/** Safe lookup — missing blendshapes read as 0. */
function b(map: BlendshapeMap, name: string): number {
  return map[name] ?? 0;
}

/** Average of the left/right pair of a symmetric blendshape. */
function pair(map: BlendshapeMap, base: string): number {
  return (b(map, `${base}Left`) + b(map, `${base}Right`)) / 2;
}

/**
 * Raw (un-normalized, clamped 0..1) activation per expressive emotion.
 * Neutral/"calm" is derived afterwards from overall activation.
 */
function rawScores(map: BlendshapeMap): Record<Exclude<Emotion, 'calm'>, number> {
  const smile = pair(map, 'mouthSmile');
  const frown = pair(map, 'mouthFrown');
  const browDown = pair(map, 'browDown');
  const browOuterUp = pair(map, 'browOuterUp');
  const browInnerUp = b(map, 'browInnerUp');
  const cheekSquint = pair(map, 'cheekSquint');
  const eyeWide = pair(map, 'eyeWide');
  const jawOpen = b(map, 'jawOpen');
  const jawForward = b(map, 'jawForward');
  const mouthPress = pair(map, 'mouthPress');
  const noseSneer = pair(map, 'noseSneer');
  const mouthStretch = pair(map, 'mouthStretch');
  const mouthLowerDown = pair(map, 'mouthLowerDown');

  const joy = smile * 1.0 + cheekSquint * 0.6 - frown * 0.5;
  const surprise = browOuterUp * 0.5 + browInnerUp * 0.4 + jawOpen * 0.7 + eyeWide * 0.5 - smile * 0.3;
  const sadness = frown * 0.9 + browInnerUp * 0.5 + mouthLowerDown * 0.3 - smile * 0.6 - jawOpen * 0.4;
  const anger = browDown * 0.9 + mouthPress * 0.4 + noseSneer * 0.5 + jawForward * 0.3 - browOuterUp * 0.4;
  const fear = eyeWide * 0.5 + mouthStretch * 0.7 + browInnerUp * 0.4 + jawOpen * 0.3 - smile * 0.3;

  return {
    joy: clamp(joy),
    surprise: clamp(surprise),
    sadness: clamp(sadness),
    anger: clamp(anger),
    fear: clamp(fear),
  };
}

/**
 * Map a frame of blendshapes to a normalized emotion reading.
 * `intensity` reflects how strongly the dominant expression is made, which the
 * color layer uses to make extreme emotions pop.
 */
export function blendshapesToEmotion(map: BlendshapeMap): EmotionReading {
  const raw = rawScores(map);
  const expressive = Object.values(raw);
  const activation = Math.max(0, ...expressive);

  // Calm rises as expressive activation falls.
  const calm = clamp(1 - activation * 1.3);

  const combined: EmotionVector = {
    calm,
    joy: raw.joy,
    surprise: raw.surprise,
    sadness: raw.sadness,
    anger: raw.anger,
    fear: raw.fear,
  };

  // Normalize to a distribution.
  const total = EMOTIONS.reduce((sum, e) => sum + combined[e], 0) || 1;
  const scores = {} as EmotionVector;
  for (const e of EMOTIONS) scores[e] = combined[e] / total;

  // Dominant emotion (argmax over normalized scores).
  let dominant: Emotion = 'calm';
  for (const e of EMOTIONS) {
    if (scores[e] > scores[dominant]) dominant = e;
  }

  // Intensity: 0 when calm/resting, otherwise the raw activation of the
  // dominant expressive emotion (pre-normalization, so it reflects real effort).
  const intensity = dominant === 'calm' ? 0 : clamp(raw[dominant as Exclude<Emotion, 'calm'>]);

  return { scores, dominant, intensity };
}
