/** Discrete interest selection, separate from time spent reading or holding. */
export function validSignalScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

export function signalScoreLabel(value: number): string {
  if (value <= 2) return 'Not for me';
  if (value <= 4) return 'A little interesting';
  if (value <= 6) return 'Worth exploring';
  if (value <= 8) return 'Very interesting';
  return 'Exceptional';
}

/** One distinctive but restrained skyline across ten discrete score stops.
 * The SVG is decorative; the native HTML range owns input/semantics. */
export const SIGNAL_TRAIL_POINTS = [
  [20, 59], [56, 55], [91, 44], [127, 48], [163, 39],
  [198, 45], [234, 31], [269, 36], [305, 24], [340, 20],
] as const;

export const SIGNAL_TRAIL_PATH = SIGNAL_TRAIL_POINTS
  .map(([x, y]) => `${x},${y}`).join(' ');

/** Map the pointer to the actual SVG node centers, not an approximate
 * browser-dependent range thumb track. Works at narrow/mobile widths and
 * clamps intentional taps outside the first/last center to 1/10 or 10/10. */
export function signalScoreAtX(clientX: number, trailLeft: number, trailWidth: number): number {
  if (![clientX, trailLeft, trailWidth].every(Number.isFinite) || trailWidth <= 0) return 5;
  const first = (SIGNAL_TRAIL_POINTS[0][0] / 360) * trailWidth;
  const last = (SIGNAL_TRAIL_POINTS[SIGNAL_TRAIL_POINTS.length - 1][0] / 360) * trailWidth;
  const proportion = Math.max(0, Math.min(1, (clientX - trailLeft - first) / (last - first)));
  return 1 + Math.round(proportion * 9);
}
