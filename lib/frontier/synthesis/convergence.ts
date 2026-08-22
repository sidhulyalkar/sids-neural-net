import type { FrontierConvergenceMember, FrontierItem } from '../types';
import { frontierTrajectoryContextForItem } from '../trajectory/contextTrajectories';
import { cosineSimilarity } from '../vector/math';

const DEFAULT_WINDOW_HOURS = 72;
const STRICT_COSINE = 0.83;
const LOOSE_COSINE = 0.76;

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'because', 'before', 'being', 'between', 'could', 'first', 'from', 'have', 'into', 'more', 'most', 'new', 'over', 'paper', 'release', 'study', 'that', 'their', 'there', 'these', 'this', 'through', 'using', 'with', 'would',
]);

function salientTokens(item: FrontierItem): Set<string> {
  const text = `${item.title} ${item.tags.slice(0, 5).join(' ')}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9+#.-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
  return new Set(text.slice(0, 30));
}

function tokenOverlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(1, Math.min(left.size, right.size));
}

function publishedAt(item: FrontierItem): number {
  const value = new Date(item.publishedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function host(item: FrontierItem): string {
  try { return new URL(item.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return item.source.toLowerCase(); }
}

function member(item: FrontierItem): FrontierConvergenceMember {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    sourceLabel: item.sourceLabel,
    sourceKind: item.sourceKind,
    publishedAt: item.publishedAt,
  };
}

function representativeScore(item: FrontierItem): number {
  return item.baseScore * 0.34
    + item.quality * 0.28
    + item.importance * 0.2
    + item.novelty * 0.1
    + (item.highPriority ? 0.18 : 0)
    + (item.media && item.media.type !== 'none' ? 0.04 : 0);
}

export function frontierConvergencePairScore(
  left: FrontierItem,
  right: FrontierItem,
  vectors: Map<string, Float32Array>,
  windowHours = DEFAULT_WINDOW_HOURS
): number {
  if (left.id === right.id) return 1;
  if (frontierTrajectoryContextForItem(left) !== frontierTrajectoryContextForItem(right)) return 0;
  const leftAt = publishedAt(left);
  const rightAt = publishedAt(right);
  if (leftAt && rightAt && Math.abs(leftAt - rightAt) > windowHours * 60 * 60_000) return 0;
  const leftVector = vectors.get(left.id);
  const rightVector = vectors.get(right.id);
  if (!leftVector?.length || !rightVector?.length) return 0;
  const cosine = cosineSimilarity(leftVector, rightVector);
  if (cosine >= STRICT_COSINE) return cosine;
  if (cosine < LOOSE_COSINE) return 0;
  const overlap = tokenOverlap(salientTokens(left), salientTokens(right));
  return overlap >= 0.22 ? cosine * (0.88 + overlap * 0.12) : 0;
}

export function collapseFrontierConvergence(
  orderedItems: FrontierItem[],
  vectors: Map<string, Float32Array>,
  options: { windowHours?: number; minMembers?: number; minDistinctSources?: number } = {}
): FrontierItem[] {
  const windowHours = Math.max(6, Math.min(168, options.windowHours ?? DEFAULT_WINDOW_HOURS));
  const minMembers = Math.max(3, Math.min(6, options.minMembers ?? 3));
  const minDistinctSources = Math.max(2, Math.min(5, options.minDistinctSources ?? 3));
  if (orderedItems.length < minMembers) return orderedItems;

  const parent = orderedItems.map((_, index) => index);
  const pairScores = new Map<string, number>();
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number) => {
    const l = find(left);
    const r = find(right);
    if (l !== r) parent[r] = l;
  };

  for (let left = 0; left < orderedItems.length; left += 1) {
    for (let right = left + 1; right < orderedItems.length; right += 1) {
      const score = frontierConvergencePairScore(orderedItems[left], orderedItems[right], vectors, windowHours);
      if (score <= 0) continue;
      pairScores.set(`${left}:${right}`, score);
      union(left, right);
    }
  }

  const groups = new Map<number, number[]>();
  for (let index = 0; index < orderedItems.length; index += 1) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(index);
    groups.set(root, group);
  }

  const replacementById = new Map<string, FrontierItem>();
  const hidden = new Set<string>();

  for (const indices of groups.values()) {
    if (indices.length < minMembers) continue;
    const candidates = indices.map((index) => orderedItems[index]);
    const sourceKinds = new Set(candidates.map((item) => item.sourceKind));
    const domains = new Set(candidates.map(host));
    if (Math.max(sourceKinds.size, domains.size) < minDistinctSources) continue;

    const representative = [...candidates].sort((left, right) => representativeScore(right) - representativeScore(left))[0];
    const pairValues: number[] = [];
    for (let a = 0; a < indices.length; a += 1) {
      for (let b = a + 1; b < indices.length; b += 1) {
        const left = Math.min(indices[a], indices[b]);
        const right = Math.max(indices[a], indices[b]);
        const value = pairScores.get(`${left}:${right}`);
        if (value) pairValues.push(value);
      }
    }
    const meanSimilarity = pairValues.length
      ? pairValues.reduce((sum, value) => sum + value, 0) / pairValues.length
      : STRICT_COSINE;
    const diversity = Math.min(1, Math.max(sourceKinds.size, domains.size) / 4);
    const confidence = Math.max(0, Math.min(1, meanSimilarity * 0.86 + diversity * 0.14));
    const members = candidates
      .sort((left, right) => representativeScore(right) - representativeScore(left))
      .slice(0, 8)
      .map(member);

    replacementById.set(representative.id, {
      ...representative,
      convergence: {
        members,
        sourceKinds: Array.from(sourceKinds),
        confidence,
        windowHours,
      },
      importance: Math.min(1, representative.importance + Math.min(0.12, (members.length - 1) * 0.025)),
      momentum: Math.min(1, representative.momentum + Math.min(0.16, (members.length - 1) * 0.035)),
    });
    for (const item of candidates) if (item.id !== representative.id) hidden.add(item.id);
  }

  return orderedItems.flatMap((item) => {
    if (hidden.has(item.id)) return [];
    return [replacementById.get(item.id) ?? item];
  });
}
