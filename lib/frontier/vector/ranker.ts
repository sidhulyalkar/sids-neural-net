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
  exploration: boolean;
};

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
  now = Date.now()
): FrontierHybridScore[] {
  const lexical = bm25Scores(items, query);
  return items.map((item) => {
    const vector = vectors.get(item.id);
    const cosine = interestVector && vector ? cosineSimilarity(vector, interestVector) : 0;
    const semantic = interestVector && vector ? (cosine + 1) / 2 : 0.5;
    const freshness = freshnessDecay(item.publishedAt, now);
    const credibility = Math.max(0, Math.min(1, item.quality));
    const bm25 = lexical.get(item.id) ?? 0;
    // Product contract: dense preference, recency, source credibility, then
    // sparse lexical match. Existing FRONTIER scores are retained only as a
    // stable tie-breaker outside this formula.
    const score = 0.4 * semantic + 0.3 * freshness + 0.2 * credibility + 0.1 * bm25;
    return { item, score, semantic, freshness, credibility, bm25, exploration: false };
  });
}

export function applyEpsilonGreedyExploration(
  ranked: FrontierHybridScore[],
  epsilon = 0.15,
  seed = new Date().toISOString().slice(0, 10)
): FrontierHybridScore[] {
  if (ranked.length < 8 || epsilon <= 0) return ranked;
  const sorted = [...ranked].sort((left, right) => right.score - left.score || right.item.baseScore - left.item.baseScore);
  const exploreCount = Math.max(1, Math.min(Math.floor(sorted.length * 0.25), Math.round(sorted.length * epsilon)));
  const protectedCount = Math.min(3, sorted.length);
  const selected = new Set(sorted.slice(0, protectedCount).map((entry) => entry.item.id));
  const random = seededRandom(seed);

  const candidates = sorted
    .slice(protectedCount)
    .map((entry) => ({
      entry,
      noveltyScore: entry.item.novelty * 0.5 + (1 - entry.semantic) * 0.3 + random() * 0.2,
    }))
    .sort((left, right) => right.noveltyScore - left.noveltyScore)
    .slice(0, exploreCount)
    .map(({ entry }) => ({ ...entry, exploration: true }));

  const explorations = new Map(candidates.map((entry) => [entry.item.id, entry]));
  const base = sorted.filter((entry) => !explorations.has(entry.item.id));
  const output: FrontierHybridScore[] = [];
  let exploreIndex = 0;
  const interval = Math.max(4, Math.round(1 / Math.max(0.01, epsilon)));

  for (const entry of base) {
    output.push(entry);
    selected.add(entry.item.id);
    if (output.length >= protectedCount && (output.length - protectedCount + 1) % interval === 0 && exploreIndex < candidates.length) {
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
  seed?: string
): FrontierItem[] {
  const scores = hybridFrontierScores(items, vectors, interestVector, query, now);
  const ranked = scores.sort((left, right) => right.score - left.score || right.item.baseScore - left.item.baseScore);
  return applyEpsilonGreedyExploration(ranked, epsilon, seed).map((entry) => entry.item);
}
