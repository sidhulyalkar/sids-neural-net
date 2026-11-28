/** Interest input is a user preference, never an assessment of
 * publication significance. Pure helpers are shared with the rating tests. */
export function boundInterestScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function nextWheelInterestScore(current: number, wheelDirection: number): number {
  return boundInterestScore(current + (wheelDirection < 0 ? 1 : wheelDirection > 0 ? -1 : 0));
}

export function interestScoreLabel(score: number): string {
  if (score <= 2) return 'Not for me';
  if (score <= 4) return 'Low interest';
  if (score <= 6) return 'Worth a look';
  if (score <= 8) return 'Explore further';
  return 'A favorite';
}
