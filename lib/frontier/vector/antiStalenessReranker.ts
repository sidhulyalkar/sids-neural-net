import type { FrontierItem } from '../types';
import { cosineSimilarity } from './math';
import { hybridFrontierScores, type FrontierInterestResolver } from './ranker';
import { projectEmbeddingToSequence } from './sequenceModel';

export type FrontierAntiStalenessScore = {
  item: FrontierItem;
  baseline: number;
  exploration: number;
  semanticDistance: number;
  repetitionPenalty: number;
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
  contextStateForItem?: FrontierContextStateResolver
): FrontierAntiStalenessScore[] {
  const tau = Math.max(0, Math.min(1, explorationTemperature));
  const baseline = hybridFrontierScores(items, vectors, rankingTarget, query, now, rankingTargetForItem);
  return baseline.map((entry) => {
    const resolvedState = contextStateForItem?.(entry.item) ?? contextState;
    const distance = frontierSemanticDistance64(vectors.get(entry.item.id), resolvedState);
    const exploration = distance * (0.72 + 0.28 * Math.max(0, Math.min(1, entry.item.quality)));
    const repetitionPenalty = frontierRepetitionPenalty(entry.item, visibleItems, repetitionAlpha);
    return {
      item: entry.item,
      baseline: entry.score,
      exploration,
      semanticDistance: distance,
      repetitionPenalty,
      finalScore: (1 - tau) * entry.score + tau * exploration - repetitionPenalty,
    };
  });
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
  contextStateForItem?: FrontierContextStateResolver
): FrontierItem[] {
  return scoreFrontierAntiStaleness(
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
    contextStateForItem
  )
    .sort((left, right) => right.finalScore - left.finalScore || right.item.baseScore - left.item.baseScore || left.item.id.localeCompare(right.item.id))
    .map((entry) => entry.item);
}
