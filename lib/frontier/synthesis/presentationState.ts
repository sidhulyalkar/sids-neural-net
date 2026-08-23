import type { FrontierItem } from '../types';

export type FrontierSynthesisSnapshot = {
  inputSignature: string;
  items: FrontierItem[];
};

/**
 * Identifies the exact source-backed item set that a synthesis result was built
 * from. Presentation may only consume synthesized output when this signature
 * still matches the current authoritative inputs.
 */
export function frontierSynthesisInputSignature(items: FrontierItem[]): string {
  return items
    .slice(0, 96)
    .map((item) => `${item.id}:${item.title}:${item.summary.length}`)
    .join('|');
}

/**
 * Synthesis is supplemental. A stale async synthesis result must never hide or
 * delay a newer source-backed item set. Until enrichment for the current input
 * is ready, FRONTIER renders the current deterministic items directly.
 */
export function frontierSynthesisPresentationItems(
  currentItems: FrontierItem[],
  currentSignature: string,
  snapshot: FrontierSynthesisSnapshot,
  enabled = true,
): FrontierItem[] {
  if (!enabled) return currentItems;
  return snapshot.inputSignature === currentSignature ? snapshot.items : currentItems;
}
