import { personalizedScore } from '../scoring';
import { personalTasteRankingPrior } from '../personalTaste';
import type {
  FrontierBehaviorModel,
  FrontierHistoryEntry,
  FrontierItem,
  FrontierProfile,
} from '../types';

export type FrontierSessionRank = {
  item: FrontierItem;
  baseScore: number;
  sessionScore: number;
  randomDelta: number;
  diversityDelta: number;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitNoise(value: string): number {
  return hashString(value) / 0xffffffff;
}

function laneCounts(items: FrontierItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.lane, (counts.get(item.lane) ?? 0) + 1);
  return counts;
}

/**
 * Stable daily stochasticity. FRONTIER should expose different corners of a
 * broad taste map on different days without behaving like a slot machine on
 * every poll. The seed is therefore intentionally supplied by the local day,
 * and live discovery only appends beneath the already-visible run.
 *
 * Randomness is bounded by relevance. Important/must-know items barely move;
 * exploratory, novel candidates receive a larger perturbation. Scarce lanes get
 * a tiny diversity bonus so a large reservoir cannot become an AI-paper monoculture.
 */
export function rankFrontierItemsForSession(
  items: FrontierItem[],
  profile: FrontierProfile,
  history: Record<string, FrontierHistoryEntry>,
  sessionSeed: string,
  now = new Date(),
  behavior?: FrontierBehaviorModel,
): FrontierSessionRank[] {
  const counts = laneCounts(items);
  return items
    .filter((item) => history[item.id]?.reaction !== 'hide')
    .map((item) => {
      const baseScore = personalizedScore(item, profile, history[item.id], now, behavior);
      const randomUnit = unitNoise(`${sessionSeed}:${item.id}:${item.url}`) - 0.5;
      const protectedItem = item.lane === 'must_know' || item.importance >= 0.84;
      const taste = personalTasteRankingPrior(item);
      const amplitude = protectedItem
        ? 0.008
        : 0.035 + item.novelty * 0.035 + Math.max(0, profile.curiosity - 0.18) * 0.035;
      const randomDelta = randomUnit * 2 * amplitude;
      const laneCount = Math.max(1, counts.get(item.lane) ?? 1);
      const scarcity = 1 / Math.sqrt(laneCount);
      const diversityDelta = Math.min(0.026, scarcity * 0.055) * (0.55 + Math.max(0, taste));
      return {
        item,
        baseScore,
        randomDelta,
        diversityDelta,
        sessionScore: baseScore + randomDelta + diversityDelta,
      };
    })
    .sort((left, right) => {
      const delta = right.sessionScore - left.sessionScore;
      if (Math.abs(delta) > 1e-9) return delta;
      return left.item.id.localeCompare(right.item.id);
    });
}

export function sessionRankedItems(
  items: FrontierItem[],
  profile: FrontierProfile,
  history: Record<string, FrontierHistoryEntry>,
  sessionSeed: string,
  now = new Date(),
  behavior?: FrontierBehaviorModel,
): FrontierItem[] {
  return rankFrontierItemsForSession(items, profile, history, sessionSeed, now, behavior)
    .map((entry) => entry.item);
}
