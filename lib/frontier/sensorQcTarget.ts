import { selectReactionTarget } from './reactionTarget';
import type { FrontierHistoryEntry } from './types';

export type SensorQcTargetFrame = {
  visibleCandidates: number;
  targetAttributed: boolean;
};

function visibleFraction(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return Math.min(1, (visibleWidth * visibleHeight) / (rect.width * rect.height));
}

/**
 * Read-only mirror of FrontierReactionLoop's rendered target scoring. It uses
 * the same history eligibility boundary and selector, but returns aggregate QC
 * facts only. It never changes target state, ranking, or recommendation memory.
 */
export function measureSensorQcTargetFrame(history: Record<string, FrontierHistoryEntry>): SensorQcTargetFrame {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { visibleCandidates: 0, targetAttributed: false };
  }
  const active = document.activeElement;
  const candidates: Array<{ id: string; score: number; visibleFraction: number }> = [];
  for (const element of document.querySelectorAll<HTMLElement>('[data-frontier-fluid-card]')) {
    const id = element.dataset.frontierFluidCard;
    if (!id || !history[id]) continue;
    const fraction = visibleFraction(element);
    if (fraction < 0.22) continue;
    const rect = element.getBoundingClientRect();
    const viewportCenter = window.innerHeight * 0.46;
    const cardCenter = (rect.top + rect.bottom) * 0.5;
    const centerProximity = Math.max(0, 1 - Math.abs(cardCenter - viewportCenter) / Math.max(1, window.innerHeight * 0.6));
    const hovered = element.matches(':hover') ? 0.18 : 0;
    const focused = active instanceof Node && element.contains(active) ? 0.16 : 0;
    const expanded = element.querySelector('[aria-expanded="true"]') ? 0.12 : 0;
    candidates.push({
      id,
      visibleFraction: fraction,
      score: fraction * 0.55 + centerProximity * 0.35 + hovered + focused + expanded,
    });
  }
  return {
    visibleCandidates: candidates.length,
    targetAttributed: Boolean(selectReactionTarget(candidates)),
  };
}
