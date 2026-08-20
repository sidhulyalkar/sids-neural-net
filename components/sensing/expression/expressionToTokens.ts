import type { ExpressionReading } from './types';

export type RGB = [number, number, number];
export const BASE_ACCENT: RGB = [102, 227, 255];
const WARM: RGB = [247, 198, 107];
const VIOLET: RGB = [167, 139, 250];
const BLUE: RGB = [91, 140, 255];

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((index) => Math.round(a[index] + (b[index] - a[index]) * clamp(t))) as RGB;
const brighten = (rgb: RGB, amount: number): RGB => mix(rgb, [255, 255, 255], clamp(amount) * 0.18);

export interface ExpressionTokens {
  primaryRGB: RGB;
  secondaryRGB: RGB;
  accentRGB: RGB;
  glow: number;
  activity: number;
}

export function expressionToTokens(reading: ExpressionReading): ExpressionTokens {
  const { facialActivity, smileActivation, browActivity, mouthActivity, eyeOpenness, expressionAsymmetry } = reading.signals;
  const activity = clamp(facialActivity);
  const warmMix = clamp(smileActivation * 0.62);
  const violetMix = clamp(browActivity * 0.28 + mouthActivity * 0.12);
  let primary = mix(BASE_ACCENT, WARM, warmMix);
  primary = mix(primary, VIOLET, violetMix);
  primary = brighten(primary, Math.max(0, eyeOpenness - 0.5));
  const secondary = mix(BLUE, VIOLET, clamp(expressionAsymmetry * 0.42 + browActivity * 0.18));
  const accentRGB = mix(BASE_ACCENT, primary, clamp(activity * 0.5));
  return {
    primaryRGB: primary,
    secondaryRGB: secondary,
    accentRGB,
    glow: Number((0.42 + activity * 0.72 + clamp(eyeOpenness - 0.5) * 0.12).toFixed(3)),
    activity,
  };
}

export function rgbTriplet(rgb: RGB): string { return rgb.join(', '); }
export function rgbToCss(rgb: RGB): string { return `rgb(${rgb.join(', ')})`; }
