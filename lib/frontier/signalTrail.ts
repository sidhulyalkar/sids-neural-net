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
