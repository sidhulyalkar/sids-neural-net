import type { FrontierItem } from '../types';
import { cosineSimilarity } from './math';
import {
  hybridFrontierScores,
  type FrontierInterestResolver,
  type FrontierScorePenaltyResolver,
} from './ranker';
import { projectEmbeddingToSequence } from './sequenceModel';

export type FrontierAntiStalenessScore = {
  item: FrontierItem;
  baseline: number;
  exploration: number;
  semanticDistance: number;
  repetitionPenalty: number;
  avoidPenalty: number;
  finalScore: number;
};

type ExposureCounts = {
  domains: Map<string, number>;
  authors: Map<string, number>;
  tags: Map<string, number>;
};

export type FrontierContextStateResolver = (item: FrontierItem) => Float32Array | undefined;

function host(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function normalizedLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

function exposureCounts(items: FrontierItem[]): ExposureCounts {
  const domains = new Map<string, number>();
  const authors = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const item of items) {
    const domain = host(item.url);
    if (domain) domains.set(domain, (domains.get(domain) ?? 0) + 1);
    for (const author of item.authors?.slice(0, 6) ?? []) {
      const key = normalizedLabel(author);
      if (key) authors.set(key, (authors.get(key) ?? 0) + 1);
    }
    for (const tag of item.tags.slice(0, 8)) {
      const key = normalizedLabel(tag);
      if (key.length >= 3) tags.set(key, (tags.get(key) ?? 0) + 1);
    }
  }
  return { domains, authors, tags };
}

export function frontierRepetitionPenalty(
  item: FrontierItem,
  visibleItems: FrontierItem[],
  alpha = 0.045
): number {
  if (!visibleItems.length || alpha <= 0) return 0;
  const counts = exposureCounts(visibleItems);
  const domainCount = counts.domains.get(host(item.url)) ?? 0;
  const authorCount = Math.max(0, ...(item.authors ?? []).map((author) => counts.authors.get(normalizedLabel(author)) ?? 0));
  const tagHits = item.tags
    .slice(0, 8)
    .map((tag) => counts.tags.get(normalizedLabel(tag)) ?? 0)
    .sort((left, right) => right - left);
  const tagCount = tagHits.slice(0, 3).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.min(3, tagHits.length));

  const domainPenalty = alpha * Math.log1p(domainCount);
  const authorPenalty = alpha * 0.55 * Math.log1p(authorCount);
  const tagPenalty = alpha * 0.45 * Math.log1p(tagCount);
  return domainPenalty + authorPenalty + tagPenalty;
}

export function frontierSemanticDistance64(
  vector: Float32Array | undefined,
  contextState: Float32Array | undefined
): number {
  if (!vector?.length || !contextState?.length) return 0.5;
  const projected = projectEmbeddingToSequence(vector, contextState.length);
  const cosine = cosineSimilarity(projected, contextState);
  return Math.max(0, Math.min(1, (1 - cosine) / 2));
}

/**
 * Exploration should probe the boundary of a plausible interest region, not
 * maximize distance from it. The target moves outward as the user explicitly
 * raises exploration temperature, while quality/importance still gate the bet.
 */
export function frontierExplorationOpportunity(
  item: FrontierItem,
  semanticDistance: number,
  explorationTemperature: number
): number {
  const tau = Math.max(0, Math.min(1, explorationTemperature));
  const targetDistance = 0.28 + tau * 0.31;
  const sigma = 0.17 + tau * 0.09;
  const boundary = Math.exp(-Math.pow(semanticDistance - targetDistance, 2) / (2 * sigma * sigma));
  const intrinsic =
    item.quality * 0.38
    + item.importance * 0.24
    + item.novelty * 0.23
    + item.baseScore * 0.15;
  const noveltyGate = 0.68 + 0.32 * Math.max(0, Math.min(1, item.novelty));
  return Math.max(0, Math.min(1, boundary * intrinsic * noveltyGate));
}

function tagJaccard(left: FrontierItem, right: FrontierItem): number {
  const a = new Set(left.tags.slice(0, 8).map(normalizedLabel).filter((tag) => tag.length >= 3));
  const b = new Set(right.tags.slice(0, 8).map(normalizedLabel).filter((tag) => tag.length >= 3));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const tag of a) if (b.has(tag)) intersection += 1;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

export function frontierSlateSimilarity(
  left: FrontierItem,
  right: FrontierItem,
  vectors: Map<string, Float32Array>
): number {
  const leftVector = vectors.get(left.id);
  const rightVector = vectors.get(right.id);
  const semantic = leftVector && rightVector
    ? Math.max(0, Math.min(1, (cosineSimilarity(leftVector, rightVector) + 1) / 2))
    : 0.5;
  const tags = tagJaccard(left, right);
  const sameHost = host(left.url) && host(left.url) === host(right.url) ? 1 : 0;
  const sameLane = left.lane === right.lane ? 1 : 0;
  return Math.max(0, Math.min(1,
    semantic * 0.55
    + tags * 0.25
    + sameHost * 0.12
    + sameLane * 0.08
  ));
}

export function scoreFrontierAntiStaleness(
  items: FrontierItem[],
  vectors: Map<string, Float32Array>,
  rankingTarget: Float32Array | undefined,
  contextState: Float32Array | undefined,
  query: string,
  visibleItems: FrontierItem[],
  explorationTemperature: number,
  now = Date.now(),
  repetitionAlpha = 0.045,
  rankingTargetForItem?: FrontierInterestResolver,
  contextStateForItem?: FrontierContextStateResolver,
  penaltyForItem?: FrontierScorePenaltyResolver
): FrontierAntiStalenessScore[] {
  const tau = Math.max(0, Math.min(1, explorationTemperature));
  const baseline = hybridFrontierScores(items, vectors, rankingTarget, query, now, rankingTargetForItem, penaltyForItem);
  return baseline.map((entry) => {
    const resolvedState = contextStateForItem?.(entry.item) ?? contextState;
    const distance = frontierSemanticDistance64(vectors.get(entry.item.id), resolvedState);
    const exploration = frontierExplorationOpportunity(entry.item, distance, tau);
    const repetitionPenalty = frontierRepetitionPenalty(entry.item, visibleItems, repetitionAlpha);
    return {
      item: entry.item,
      baseline: entry.score,
      exploration,
      semanticDistance: distance,
      repetitionPenalty,
      avoidPenalty: entry.avoidPenalty,
      // Explicit avoid authority survives exploration spikes. The positive score
      // is restored before blending so avoid is subtracted exactly once below.
      finalScore: (1 - tau) * (entry.score + entry.avoidPenalty)
        + tau * exploration
        - repetitionPenalty
        - entry.avoidPenalty,
    };
  });
}

/**
 * Greedy MMR-style pass over the already-scored slate. The first three cards are
 * protected recommendation anchors. After that, highly redundant candidates pay
 * a small semantic/topic/source penalty so the page explores several interests
 * instead of repeating the same neighborhood with different headlines.
 */
export function diversifyFrontierSlate(
  scored: FrontierAntiStalenessScore[],
  vectors: Map<string, Float32Array>,
  explorationTemperature: number,
  protectedCount = 3
): FrontierAntiStalenessScore[] {
  if (scored.length <= protectedCount + 1) return scored;
  const sorted = [...scored].sort((left, right) =>
    right.finalScore - left.finalScore
    || right.item.baseScore - left.item.baseScore
    || left.item.id.localeCompare(right.item.id)
  );
  const protectedItems = sorted.slice(0, Math.max(0, Math.min(protectedCount, sorted.length)));
  const pool = sorted.slice(protectedItems.length);
  const selected = [...protectedItems];
  const tau = Math.max(0, Math.min(1, explorationTemperature));
  const diversityWeight = 0.045 + tau * 0.075;

  while (pool.length) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const maxSimilarity = selected.length
        ? Math.max(...selected.map((chosen) => frontierSlateSimilarity(candidate.item, chosen.item, vectors)))
        : 0;
      const utility = candidate.finalScore - maxSimilarity * diversityWeight;
      if (utility > bestUtility + 1e-12) {
        bestUtility = utility;
        bestIndex = index;
      } else if (Math.abs(utility - bestUtility) <= 1e-12) {
        const current = pool[bestIndex];
        if (candidate.finalScore > current.finalScore || (
          candidate.finalScore === current.finalScore && candidate.item.id.localeCompare(current.item.id) < 0
        )) bestIndex = index;
      }
    }
    selected.push(pool.splice(bestIndex, 1)[0]);
  }
  return selected;
}

export function rerankFrontierAntiStaleness(
  items: FrontierItem[],
  vectors: Map<string, Float32Array>,
  rankingTarget: Float32Array | undefined,
  contextState: Float32Array | undefined,
  query: string,
  visibleItems: FrontierItem[],
  explorationTemperature: number,
  now = Date.now(),
  rankingTargetForItem?: FrontierInterestResolver,
  contextStateForItem?: FrontierContextStateResolver,
  penaltyForItem?: FrontierScorePenaltyResolver
): FrontierItem[] {
  const scored = scoreFrontierAntiStaleness(
    items,
    vectors,
    rankingTarget,
    contextState,
    query,
    visibleItems,
    explorationTemperature,
    now,
    0.045,
    rankingTargetForItem,
    contextStateForItem,
    penaltyForItem
  );
  return diversifyFrontierSlate(scored, vectors, explorationTemperature)
    .map((entry) => entry.item);
}
