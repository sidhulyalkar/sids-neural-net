import { createInitialProfile } from './config';
import { rankFrontierItems, selectDailyRun } from './scoring';
import type { FrontierItem } from './types';

/**
 * Rank EVERY source-vetted, editorially admitted candidate before choosing the
 * small first-paint payload. This keeps the browser lightweight without letting
 * a provider-ordered top-36 shortcut erase niche research before ranking.
 *
 * Only admitted candidates should enter this function. Server callers obtain
 * that inventory from getFrontierColdSnapshotFeed().
 */
export function selectFrontierColdEdition(
  candidates: readonly FrontierItem[],
  limit = 36,
  now = new Date(),
): FrontierItem[] {
  if (limit <= 0) return [];
  const ranked = rankFrontierItems([...candidates], createInitialProfile(), {}, now);
  return selectDailyRun(ranked, {}, limit, now);
}
