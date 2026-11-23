import type { FrontierHistoryEntry } from './types';

/** Aggregate local-only gameplay diagnostics.
 * Playfulness is not article relevance, so none of these counts feed ranking.
 * Guided and unguided hits should not be compared as equivalent difficulty.
 */
export type FrontierLightningEngagement = {
  articleCount: number;
  shots: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  guidedShots: number;
  guidedHits: number;
  unguidedShots: number;
  unguidedHits: number;
  articlesAlsoOpened: number;
};

/** Pure aggregation, suitable for a private analytics view or a future
 * consented A/B evaluation. Historical co-occurrence is NOT causal uplift. */
export function summarizeFrontierLightningEngagement(
  entries: Iterable<FrontierHistoryEntry>,
): FrontierLightningEngagement {
  const totals: FrontierLightningEngagement = {
    articleCount:0,shots:0,hits:0,misses:0,hitRate:null,
    guidedShots:0,guidedHits:0,unguidedShots:0,unguidedHits:0,
    articlesAlsoOpened:0,
  };
  for (const entry of entries) {
    const shots=Math.max(0,Math.min(500,Math.trunc(entry.lightningShots ?? 0)));
    if (!shots || !Number.isFinite(shots)) continue;
    const hits=Math.max(0,Math.min(shots,Math.trunc(entry.lightningHits ?? 0)));
    const guidedShots=Math.max(0,Math.min(shots,Math.trunc(entry.lightningGuidedShots ?? 0)));
    const guidedHits=Math.max(0,Math.min(guidedShots,hits,Math.trunc(entry.lightningGuidedHits ?? 0)));
    totals.articleCount+=1;
    totals.shots+=shots;
    totals.hits+=hits;
    totals.guidedShots+=guidedShots;
    totals.guidedHits+=guidedHits;
    if (entry.openedAt) totals.articlesAlsoOpened+=1;
  }
  totals.misses=totals.shots-totals.hits;
  totals.hitRate=totals.shots ? totals.hits/totals.shots : null;
  totals.unguidedShots=totals.shots-totals.guidedShots;
  totals.unguidedHits=totals.hits-totals.guidedHits;
  return totals;
}
