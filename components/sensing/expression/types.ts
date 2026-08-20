export const EXPRESSION_SIGNALS = [
  'facialActivity',
  'smileActivation',
  'eyeOpenness',
  'browActivity',
  'mouthActivity',
  'expressionAsymmetry',
  'blinkActivation',
  'stillness',
] as const;

export type ExpressionSignal = (typeof EXPRESSION_SIGNALS)[number];
export type ExpressionVector = Record<ExpressionSignal, number>;
export type BlendshapeMap = Record<string, number>;

export interface HeadOrientation {
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Observable, local-only facial dynamics. These values describe visible
 * activations and intentionally do not infer emotion, intent, personality,
 * mental state, or any other psychological category.
 */
export interface ExpressionReading {
  signals: ExpressionVector;
  intensity: number;
  head: HeadOrientation;
}

export function neutralReading(): ExpressionReading {
  return {
    signals: {
      facialActivity: 0,
      smileActivation: 0,
      eyeOpenness: 0.5,
      browActivity: 0,
      mouthActivity: 0,
      expressionAsymmetry: 0,
      blinkActivation: 0,
      stillness: 1,
    },
    intensity: 0,
    head: { yaw: 0, pitch: 0, roll: 0 },
  };
}

export function strongestObservableSignal(reading: ExpressionReading): ExpressionSignal {
  const candidates = EXPRESSION_SIGNALS.filter((signal) => signal !== 'stillness' && signal !== 'eyeOpenness');
  return candidates.reduce((best, signal) =>
    reading.signals[signal] > reading.signals[best] ? signal : best,
  candidates[0]);
}
