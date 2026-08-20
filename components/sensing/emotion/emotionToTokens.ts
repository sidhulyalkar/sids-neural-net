// Emotion reading -> mood tokens the DOM layer applies as CSS custom properties.
// Hues stay inside the site's existing brand families; only saturation, lightness,
// and glow strength are pushed so extreme emotions pop. Pure (no DOM).

import { blendRGB, clamp, intensify, type RGB } from './color';
import type { Emotion, EmotionReading } from './types';

/** Site default accent (brand cyan) — the resting target we blend away from. */
export const BASE_ACCENT: RGB = [102, 227, 255];

interface Palette {
  /** Primary atmosphere color (brand hue family for this emotion). */
  primary: RGB;
  /** Secondary atmosphere color for the far gradient. */
  secondary: RGB;
  /** Baseline glow strength before intensity scaling. */
  baseGlow: number;
  /** Whether this emotion should pop hard (saturation/glow) as it intensifies. */
  popsHard: boolean;
}

/** Brand-aligned palette per emotion. All hues drawn from existing site tokens. */
const PALETTES: Record<Emotion, Palette> = {
  // Resting state == current site look (cyan/blue).
  calm: { primary: [102, 227, 255], secondary: [91, 140, 255], baseGlow: 0.45, popsHard: false },
  // Euphoria/excitement: warm gold -> green, pushes bright.
  joy: { primary: [247, 198, 107], secondary: [102, 240, 194], baseGlow: 0.7, popsHard: true },
  // Surprise: punchy violet.
  surprise: { primary: [167, 139, 250], secondary: [102, 227, 255], baseGlow: 0.6, popsHard: false },
  // Sadness: deep brand blue, atmosphere cools.
  sadness: { primary: [91, 140, 255], secondary: [70, 92, 168], baseGlow: 0.55, popsHard: true },
  // Anger: rose -> red, raises saturation + glow hard.
  anger: { primary: [255, 122, 162], secondary: [247, 140, 107], baseGlow: 0.75, popsHard: true },
  // Fear: cooler dim violet.
  fear: { primary: [130, 110, 200], secondary: [91, 140, 255], baseGlow: 0.55, popsHard: false },
};

export interface MoodTokens {
  /** "r, g, b" for --mood-primary. */
  primaryRGB: RGB;
  /** "r, g, b" for --mood-secondary. */
  secondaryRGB: RGB;
  /** Atmosphere strength multiplier for --mood-glow (0..~1.6). */
  glow: number;
  /** Blended accent that overrides --cyan for a restrained UI accent shift. */
  accentRGB: RGB;
  dominant: Emotion;
  /** 0..1, echoed for the debug HUD. */
  intensity: number;
}

/**
 * Convert a smoothed emotion reading into mood tokens.
 *
 * Extreme-intensity curve: as an emotion strengthens, popsHard emotions gain
 * saturation and a bigger glow; the accent shifts further from brand cyan.
 * Neutral/low-confidence readings stay near the default palette.
 */
export function emotionToTokens(reading: EmotionReading): MoodTokens {
  const { dominant, intensity } = reading;
  const palette = PALETTES[dominant];
  const t = clamp(intensity);

  const popBoost = palette.popsHard ? t : t * 0.4;
  const primary = intensify(palette.primary, popBoost);
  const secondary = intensify(palette.secondary, popBoost * 0.6);

  const glow = palette.baseGlow * (1 + t * (palette.popsHard ? 1.1 : 0.5));

  // Accent shift: blend brand cyan toward the mood primary, capped so UI text
  // and borders stay legible. Stronger emotion => further shift.
  const accentMix = clamp(0.12 + t * 0.5, 0, 0.6);
  const accentRGB = dominant === 'calm' ? BASE_ACCENT : blendRGB(BASE_ACCENT, primary, accentMix);

  return {
    primaryRGB: primary,
    secondaryRGB: secondary,
    glow: Number(glow.toFixed(3)),
    accentRGB,
    dominant,
    intensity: t,
  };
}
