import type { FrontierItem } from './types';

export const FRONTIER_AMBIENT_EXPLORATION_EVENT = 'frontier:ambient-exploration';

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert the actually surfaced recommendation set into one bounded visual state.
 *
 * FRONTIER's semantic reranker has already ordered this list, so the ambient
 * layer intentionally does not run a second recommendation model. It reads the
 * novelty of the visible head plus lane diversity, giving the background a quiet
 * distinction between a tightly focused exploitation surface and a wider,
 * serendipitous exploration surface.
 */
export function ambientExplorationVector(items: FrontierItem[], limit = 12): number {
  const sample = items.slice(0, Math.max(1, limit));
  if (!sample.length) return 0.28;

  let weightedNovelty = 0;
  let weightTotal = 0;
  const lanes = new Set<string>();

  sample.forEach((item, index) => {
    const positionWeight = 1 / (1 + index * 0.14);
    const wildcardLift = item.lane === 'wildcards' ? 0.12 : 0;
    weightedNovelty += clamp(item.novelty + wildcardLift) * positionWeight;
    weightTotal += positionWeight;
    lanes.add(item.lane);
  });

  const novelty = weightedNovelty / Math.max(0.0001, weightTotal);
  const diversity = clamp(lanes.size / Math.min(6, sample.length));
  return clamp(novelty * 0.84 + diversity * 0.16);
}

export function emitFrontierAmbientExploration(value: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(FRONTIER_AMBIENT_EXPLORATION_EVENT, {
    detail: clamp(value),
  }));
}
