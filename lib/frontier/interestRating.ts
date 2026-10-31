import type { FrontierReaction } from './types';

/** A deliberate hold, not raw reading time. A quick tap is not a vote. */
export const INTEREST_MIN_HOLD_MS = 220;
export const INTEREST_MAX_HOLD_MS = 3000;

export function holdToInterestScore(elapsedMs: number): number | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < INTEREST_MIN_HOLD_MS) return null;
  const progress = Math.min(1, (elapsedMs - INTEREST_MIN_HOLD_MS) / (INTEREST_MAX_HOLD_MS - INTEREST_MIN_HOLD_MS));
  return Math.min(10, 1 + Math.floor(progress * 9 + 1e-8));
}

export function interestScoreReaction(score: number): FrontierReaction {
  if (score <= 2) return 'down';
  if (score <= 4) return 'meh';
  if (score === 5) return 'read';
  if (score === 6) return 'useful';
  if (score <= 8) return 'up';
  return 'love';
}

export function validInterestScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}
