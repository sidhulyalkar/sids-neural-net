'use client';

export type FrontierReadingDensity = 'scan' | 'balanced' | 'deep';

/**
 * Retained as a pure policy helper for diagnostics and future non-geometric
 * adaptations. The live board must not apply these states to typography,
 * spacing, or masonry geometry while the user is scrolling.
 */
export function resolveFrontierReadingDensity(input: {
  speed: number;
  previous: FrontierReadingDensity;
  deepUntil: number;
  now: number;
}): FrontierReadingDensity {
  if (input.deepUntil > input.now && input.speed < 1.45) return 'deep';
  if (input.speed >= 0.95) return 'scan';
  if (input.previous === 'scan' && input.speed >= 0.48) return 'scan';
  return 'balanced';
}

/**
 * FRONTIER previously changed font size, line height, card padding, and grid
 * gaps directly from scroll velocity. That made the document contract its
 * height while the scroll thumb was moving, producing large bidirectional
 * jumps even after compact card geometry had been measured and locked.
 *
 * Reading pace remains available to telemetry/ranking systems elsewhere, but
 * presentation density is intentionally geometry-stable. Future adaptive
 * states must be compositor-only (color/opacity/etc.) or require an explicit
 * user action before they may alter layout.
 */
export function useAdaptiveReadingDensity(): FrontierReadingDensity {
  return 'balanced';
}
