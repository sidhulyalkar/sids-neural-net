// Small, pure color utilities for mood token generation.
// RGB channels are 0-255; HSL is h:0-360, s/l:0-1.

export type RGB = [number, number, number];

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear interpolation between two numbers. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Blend two RGB colors. t=0 -> a, t=1 -> b. */
export function blendRGB(a: RGB, b: RGB, t: number): RGB {
  const k = clamp(t);
  return [
    Math.round(lerp(a[0], b[0], k)),
    Math.round(lerp(a[1], b[1], k)),
    Math.round(lerp(a[2], b[2], k)),
  ];
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;
  const channel = (t: number): number => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return [
    Math.round(channel(hk + 1 / 3) * 255),
    Math.round(channel(hk) * 255),
    Math.round(channel(hk - 1 / 3) * 255),
  ];
}

/**
 * Push a color's saturation (and slightly its lightness) so extreme emotions
 * "pop" while keeping the same hue family. amount 0 = unchanged, 1 = maxed.
 */
export function intensify(rgb: RGB, amount: number): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  const k = clamp(amount);
  const nextS = clamp(s + (1 - s) * k * 0.85);
  // Nudge lightness toward a vivid mid-high so it reads as "brighter", not washed out.
  const nextL = clamp(lerp(l, Math.max(l, 0.6), k * 0.4));
  return hslToRgb([h, nextS, nextL]);
}

export function rgbToCss([r, g, b]: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** "r, g, b" — the shape our `--*-rgb` custom properties expect. */
export function rgbTriplet([r, g, b]: RGB): string {
  return `${r}, ${g}, ${b}`;
}
