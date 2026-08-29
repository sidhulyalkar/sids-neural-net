import { FRONTIER_LANE_MAP } from './config';
import { interestConnectionSignatures } from './connectionPortfolio';
import { personalInterestConnection } from './interestGraph';
import {
  frontierEditorialFamily,
  frontierRerankWindowSize,
  frontierSourceBucket,
  slateCompositionDiagnostics,
  type FrontierSlateFamilyDiagnostic,
} from './adaptiveSlate';
import type { FrontierItem } from './types';

export type FrontierSlateShapeMetrics = {
  count: number;
  uniqueSources: number;
  maxSourceShare: number;
  sourceHhi: number;
  uniqueFamilies: number;
  maxFamilyShare: number;
  familyHhi: number;
  uniqueLanes: number;
  learnCount: number;
  playCount: number;
  connectedCount: number;
  uniqueConnectionSignatures: number;
  maxConnectionShare: number;
  connectionHhi: number;
  meanConnectionConfidence: number;
};

export type FrontierSlateCounterfactual = {
  requestedLimit: number;
  rerankWindowSize: number;
  selectedCount: number;
  rawTopCount: number;
  overlapCount: number;
  overrideCount: number;
  overrideRate: number;
  ordinaryPromotionCount: number;
  policyInterruptPromotionCount: number;
  maxSelectedRank: number;
  maxOrdinaryPromotionDepth: number;
  rankUtilityRetention: number;
  raw: FrontierSlateShapeMetrics;
  adaptive: FrontierSlateShapeMetrics;
  sourceConcentrationImprovement: number;
  familyConcentrationImprovement: number;
  connectionConcentrationImprovement: number;
  connectionBreadthDelta: number;
  laneBreadthDelta: number;
  familyDiagnostics: FrontierSlateFamilyDiagnostic[];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function shareMetrics(keys: string[]): { unique: number; maxShare: number; hhi: number } {
  if (!keys.length) return { unique: 0, maxShare: 0, hhi: 0 };
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const shares = [...counts.values()].map((value) => value / keys.length);
  return {
    unique: counts.size,
    maxShare: Math.max(...shares),
    hhi: shares.reduce((sum, share) => sum + share * share, 0),
  };
}

function exactConnectionSignatureKeys(item: FrontierItem): string[] {
  // Audit the exact topic-method and cross-domain repertoire. We intentionally
  // omit low-weight domain-method transfer signatures here because those are a
  // learning bridge, not independent evidence that the slate is truly varied.
  return interestConnectionSignatures(item)
    .filter(({ weight }) => weight >= 0.9)
    .map(({ key }) => key);
}

export function frontierSlateShape(items: FrontierItem[]): FrontierSlateShapeMetrics {
  const sources = shareMetrics(items.map(frontierSourceBucket));
  const families = shareMetrics(items.map((item) => frontierEditorialFamily(item)));
  const connectionKeys = items.flatMap(exactConnectionSignatureKeys);
  const connections = shareMetrics(connectionKeys);
  let learnCount = 0;
  let playCount = 0;
  let connectedCount = 0;
  let connectionConfidence = 0;
  for (const item of items) {
    if (FRONTIER_LANE_MAP[item.lane].realm === 'learn') learnCount += 1;
    else playCount += 1;
    const connection = personalInterestConnection(item);
    if (connection.score >= 0.035 && connection.confidence >= 0.5) {
      connectedCount += 1;
      connectionConfidence += connection.confidence;
    }
  }
  return {
    count: items.length,
    uniqueSources: sources.unique,
    maxSourceShare: sources.maxShare,
    sourceHhi: sources.hhi,
    uniqueFamilies: families.unique,
    maxFamilyShare: families.maxShare,
    familyHhi: families.hhi,
    uniqueLanes: new Set(items.map((item) => item.lane)).size,
    learnCount,
    playCount,
    connectedCount,
    uniqueConnectionSignatures: connections.unique,
    maxConnectionShare: connections.maxShare,
    connectionHhi: connections.hhi,
    meanConnectionConfidence: connectedCount ? connectionConfidence / connectedCount : 0,
  };
}

function isPolicyInterrupt(item: FrontierItem): boolean {
  return (
    item.lane === 'must_know'
    || item.importance >= 0.82
    || item.sourceKind === 'sports_state'
    || Boolean(item.sportsState)
  );
}

function rankDiscount(index: number): number {
  return 1 / Math.log2(index + 2);
}

/**
 * Compare an adaptive slate against the raw learned top-N. This function is
 * instrumentation only: none of these measurements feed back into selection.
 */
export function evaluateSlateCounterfactual(
  ranked: FrontierItem[],
  selected: FrontierItem[],
  requestedLimit: number,
): FrontierSlateCounterfactual {
  const limit = Math.max(0, Math.floor(requestedLimit));
  const rawTop = ranked.slice(0, Math.min(limit, ranked.length));
  const rawIds = new Set(rawTop.map((item) => item.id));
  const rankById = new Map(ranked.map((item, index) => [item.id, index]));

  let overlapCount = 0;
  let ordinaryPromotionCount = 0;
  let policyInterruptPromotionCount = 0;
  let maxSelectedRank = 0;
  let maxOrdinaryPromotionDepth = 0;
  let selectedRankUtility = 0;

  for (const item of selected) {
    const index = rankById.get(item.id);
    if (rawIds.has(item.id)) overlapCount += 1;
    if (index === undefined) continue;
    const oneBasedRank = index + 1;
    maxSelectedRank = Math.max(maxSelectedRank, oneBasedRank);
    selectedRankUtility += rankDiscount(index);
    if (index >= rawTop.length) {
      if (isPolicyInterrupt(item)) policyInterruptPromotionCount += 1;
      else {
        ordinaryPromotionCount += 1;
        maxOrdinaryPromotionDepth = Math.max(maxOrdinaryPromotionDepth, oneBasedRank - rawTop.length);
      }
    }
  }

  const rawRankUtility = rawTop.reduce((sum, _item, index) => sum + rankDiscount(index), 0);
  const raw = frontierSlateShape(rawTop);
  const adaptive = frontierSlateShape(selected);
  const overrideCount = Math.max(0, selected.length - overlapCount);

  return {
    requestedLimit: limit,
    rerankWindowSize: frontierRerankWindowSize(limit, ranked.length),
    selectedCount: selected.length,
    rawTopCount: rawTop.length,
    overlapCount,
    overrideCount,
    overrideRate: selected.length ? overrideCount / selected.length : 0,
    ordinaryPromotionCount,
    policyInterruptPromotionCount,
    maxSelectedRank,
    maxOrdinaryPromotionDepth,
    rankUtilityRetention: rawRankUtility ? clamp01(selectedRankUtility / rawRankUtility) : 1,
    raw,
    adaptive,
    sourceConcentrationImprovement: raw.sourceHhi - adaptive.sourceHhi,
    familyConcentrationImprovement: raw.familyHhi - adaptive.familyHhi,
    connectionConcentrationImprovement: raw.connectionHhi - adaptive.connectionHhi,
    connectionBreadthDelta: adaptive.uniqueConnectionSignatures - raw.uniqueConnectionSignatures,
    laneBreadthDelta: adaptive.uniqueLanes - raw.uniqueLanes,
    familyDiagnostics: slateCompositionDiagnostics(ranked, selected, limit),
  };
}
