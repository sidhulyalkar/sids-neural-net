import type { FrontierItem } from '@/lib/frontier/types';
import { cosineSimilarity } from './math';

const DAY_MS = 86_400_000;

export type FrontierHybridScore = {
  item: FrontierItem;
  score: number;
  semantic: number;
  freshness: number;
  credibility: number;
  bm25: number;
  avoidPenalty: number;
  exploration: boolean;
};

export type FrontierInterestResolver = (item: FrontierItem) => Float32Array | undefined;
export type FrontierScorePenaltyResolver = (item: FrontierItem) => number;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9+#.-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .slice(0, 320);
}

function itemText(item: FrontierItem): string {
  return `${item.title} ${item.summary} ${item.tags.join(' ')}`;
}

export function bm25Scores(items: FrontierItem[], query: string, k1 = 1.25, b = 0.72): Map<string, number> {
  const queryTerms = Array.from(new Set(tokenize(query)));
  const output = new Map<string, number>();
  if (!items.length || !queryTerms.length) return output;

  const documents = items.map((item) => tokenize(itemText(item)));
  const avgLength = documents.reduce((sum, document) => sum + document.length, 0) / Math.max(1, documents.length);
  const documentFrequency = new Map<string, number>();

  for (const document of documents) {
    const unique = new Set(document);
    for (const term of queryTerms) if (unique.has(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }

  let maxScore = 0;
  items.forEach((item, index) => {
    const document = documents[index];
    const counts = new Map<string, number>();
    for (const token of document) if (queryTerms.includes(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const tf = counts.get(term) ?? 0;
      if (!tf) continue;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (items.length - df + 0.5) / (df + 0.5));
      const lengthNorm = k1 * (1 - b + b * document.length / Math.max(1, avgLength));
      score += idf * ((tf * (k1 + 1)) / (tf + lengthNorm));
    }
    output.set(item.id, score);
    maxScore = Math.max(maxScore, score);
  });

  if (maxScore > 0) {
    for (const [id, score] of output) output.set(id, score / maxScore);
  }
  return output;
}

export function freshnessDecay(publishedAt: string, now = Date.now(), halfLifeDays = 3.5): number {
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published)) return 0.35;
  const ageDays = Math.max(0, (now - published) / DAY_MS);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Different information classes age on different clocks. A live score becomes
 * stale in hours, while a strong paper, repository, or scientific tool can stay
 * useful for weeks. This keeps freshness from silently becoming a news bias.
 */
export function frontierFreshnessHalfLifeDays(item: FrontierItem): number {
  if (item.sourceKind === 'sports_state' || item.sportsState) return 0.55;
  if (item.lane === 'must_know') return 1.5;
  if (['sports', 'team_pulse', 'premier_league', 'world_soccer'].includes(item.lane)) return 2.75;
  if (['screen', 'music', 'gaming', 'internet_culture'].includes(item.lane)) return 6;
  if (['ml_data', 'ai_frontier', 'neuro_frontier', 'broad_science', 'methods', 'builder_signal', 'creative_tech'].includes(item.lane)) return 12;
  return 5;
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hybridFrontierScores(
  items: FrontierItem[],
  vectors: Map<string, Float32Array>,
  interestVector: Float32Array | undefined,
  query = '',
  now = Date.now(),
  interestForItem?: FrontierInterestResolver,
  penaltyForItem?: FrontierScorePenaltyResolver
): FrontierHybridScore[] {
  const lexical = bm25Scores(items, query);
  return items.map((item) => {
    const vector = vectors.get(item.id);
    const resolvedInterest = interestForItem?.(item) ?? interestVector;
    const cosine = resolvedInterest && vector ? cosineSimilarity(vector, resolvedInterest) : 0;
    const semantic = resolvedInterest && vector ? (cosine + 1) / 2 : 0.5;
    const freshness = freshnessDecay(item.publishedAt, now, frontierFreshnessHalfLifeDays(item));
    const credibility = Math.max(0, Math.min(1, item.quality));
    const bm25 = lexical.get(item.id) ?? 0;
    const avoidPenalty = Math.max(0, Math.min(0.45, penaltyForItem?.(item) ?? 0));
    const score = 0.4 * semantic + 0.3 * freshness + 0.2 * credibility + 0.1 * bm25 - avoidPenalty;
    return { item, score, semantic, freshness, credibility, bm25, avoidPenalty, exploration: false };
  });
}

function explorationValue(entry: FrontierHybridScore, jitter: number): number {
  // The most informative probe is neither a perfect match nor an unrelated
  // outlier. Favor the semantic boundary around a plausible adjacent interest.
  const sigma = 0.2;
  const boundary = Math.exp(-Math.pow(entry.semantic - 0.58, 2) / (2 * sigma * sigma));
  const intrinsic =
    entry.item.quality * 0.36
    + entry.item.importance * 0.25
    + entry.item.baseScore * 0.19
    + entry.item.novelty * 0.2;
  const qualityFloorPenalty = Math.max(0, 0.68 - entry.item.quality) * 0.8;
  return intrinsic * 0.46
    + boundary * 0.27
    + entry.item.novelty * 0.22
    + jitter * 0.05
    - entry.avoidPenalty * 1.8
    - qualityFloorPenalty;
}

/**
 * Kept under the historical export name for API compatibility, but this is no
 * longer blind epsilon-greedy exploration. It inserts only a few deterministic,
 * high-quality boundary probes so exploration buys information instead of noise.
 */
export function applyEpsilonGreedyExploration(
  ranked: FrontierHybridScore[],
  epsilon = 0.15,
  seed = new Date().toISOString().slice(0, 10)
): FrontierHybridScore[] {
  if (ranked.length < 8 || epsilon <= 0) return ranked;
  const sorted = [...ranked].sort((left, right) => right.score - left.score || right.item.baseScore - left.item.baseScore);
  const protectedCount = Math.min(4, sorted.length);
  const random = seededRandom(seed);
  const exploreCount = Math.max(1, Math.min(3, Math.round(sorted.length * epsilon * 0.45)));

  const candidates = sorted
    .slice(protectedCount)
    .filter((entry) => entry.item.quality >= 0.56 && entry.item.baseScore >= 0.42 && entry.avoidPenalty < 0.2)
    .map((entry) => ({ entry, value: explorationValue(entry, random()) }))
    .sort((left, right) => right.value - left.value || right.entry.score - left.entry.score)
    .slice(0, exploreCount)
    .map(({ entry }) => ({ ...entry, exploration: true }));

  if (!candidates.length) return sorted;
  const explorationIds = new Set(candidates.map((entry) => entry.item.id));
  const base = sorted.filter((entry) => !explorationIds.has(entry.item.id));
  const output: FrontierHybridScore[] = [];
  let exploreIndex = 0;
  const bodyLength = Math.max(1, base.length - protectedCount);
  const interval = Math.max(5, Math.floor(bodyLength / Math.max(1, candidates.length)));

  for (const entry of base) {
    output.push(entry);
    if (
      output.length >= protectedCount
      && (output.length - protectedCount + 1) % interval === 0
      && exploreIndex < candidates.length
    ) {
      output.push(candidates[exploreIndex]);
      exploreIndex += 1;
    }
  }
  while (exploreIndex < candidates.length) {
    output.push(candidates[exploreIndex]);
    exploreIndex += 1;
  }
  return output.slice(0, ranked.length);
}

export function rerankFrontierItems(
  items: FrontierItem[],
  vectors: Map<string, Float32Array>,
  interestVector: Float32Array | undefined,
  query = '',
  epsilon = 0.15,
  now = Date.now(),
  seed?: string,
  interestForItem?: FrontierInterestResolver,
  penaltyForItem?: FrontierScorePenaltyResolver
): FrontierItem[] {
  const scores = hybridFrontierScores(items, vectors, interestVector, query, now, interestForItem, penaltyForItem);
  const ranked = scores.sort((left, right) => right.score - left.score || right.item.baseScore - left.item.baseScore);
  return applyEpsilonGreedyExploration(ranked, epsilon, seed).map((entry) => entry.item);
}
