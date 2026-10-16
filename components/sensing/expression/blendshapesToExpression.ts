import { neutralReading, type BlendshapeMap, type ExpressionReading } from './types';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const value = (map: BlendshapeMap, key: string) => clamp(map[key] ?? 0);
const pairMean = (map: BlendshapeMap, left: string, right: string) => (value(map, left) + value(map, right)) / 2;
const pairDiff = (map: BlendshapeMap, left: string, right: string) => Math.abs(value(map, left) - value(map, right));

/** Convert MediaPipe/ARKit-style blendshape activations into directly observable dynamics. */
export function blendshapesToExpression(blendshapes: BlendshapeMap): ExpressionReading {
  if (Object.keys(blendshapes).length === 0) return neutralReading();

  const smileActivation = clamp(
    pairMean(blendshapes, 'mouthSmileLeft', 'mouthSmileRight') * 0.75 +
    pairMean(blendshapes, 'cheekSquintLeft', 'cheekSquintRight') * 0.25,
  );
  const blinkActivation = clamp(pairMean(blendshapes, 'eyeBlinkLeft', 'eyeBlinkRight'));
  const eyeWide = pairMean(blendshapes, 'eyeWideLeft', 'eyeWideRight');
  const eyeSquint = pairMean(blendshapes, 'eyeSquintLeft', 'eyeSquintRight');
  const eyeOpenness = clamp(0.5 + eyeWide * 0.5 - blinkActivation * 0.65 - eyeSquint * 0.2);

  const browActivity = clamp(Math.max(
    pairMean(blendshapes, 'browDownLeft', 'browDownRight'),
    pairMean(blendshapes, 'browOuterUpLeft', 'browOuterUpRight'),
    value(blendshapes, 'browInnerUp'),
  ));
  const mouthActivity = clamp(Math.max(
    value(blendshapes, 'jawOpen'),
    value(blendshapes, 'mouthPucker'),
    value(blendshapes, 'mouthFunnel'),
    pairMean(blendshapes, 'mouthPressLeft', 'mouthPressRight'),
    pairMean(blendshapes, 'mouthStretchLeft', 'mouthStretchRight'),
    pairMean(blendshapes, 'mouthShrugLower', 'mouthShrugUpper'),
  ));
  const expressionAsymmetry = clamp(Math.max(
    pairDiff(blendshapes, 'mouthSmileLeft', 'mouthSmileRight'),
    pairDiff(blendshapes, 'mouthPressLeft', 'mouthPressRight'),
    pairDiff(blendshapes, 'browDownLeft', 'browDownRight'),
    pairDiff(blendshapes, 'eyeBlinkLeft', 'eyeBlinkRight'),
  ));

  const facialActivity = clamp(Math.max(
    smileActivation,
    browActivity,
    mouthActivity,
    blinkActivation * 0.8,
    Math.abs(eyeOpenness - 0.5) * 1.6,
  ));

  return {
    signals: {
      facialActivity,
      smileActivation,
      eyeOpenness,
      browActivity,
      mouthActivity,
      expressionAsymmetry,
      blinkActivation,
      stillness: clamp(1 - facialActivity),
    },
    intensity: facialActivity,
    // Head orientation belongs here conceptually, but FaceLandmarker blendshape
    // output alone does not justify inventing pose. It stays neutral until a
    // transformation-matrix adapter supplies measured pose values.
    head: { yaw: 0, pitch: 0, roll: 0 },
  };
}
