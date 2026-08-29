import { personalInterestConnection } from './interestGraph';
import type { FrontierItem, FrontierProfile } from './types';

const MAX_INTEREST_PAIRS = 320;
const MAX_PAIR_TAGS = 6;
const MAX_SEMANTIC_PAIRS = 24;
const SEMANTIC_UPDATE_WEIGHT = 0.46;
const SEMANTIC_READ_WEIGHT = 0.58;
const GENERIC_PAIR_TAGS = new Set([
  'video', 'watchable', 'research', 'paper', 'code', 'thread', 'web discovery',
  'targeted discovery', 'sports', 'sports state', 'project update',
]);
const DOMAIN_LIKE_TAG = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;

export type FrontierImplicitTasteKind = 'dwell' | 'expand' | 'open' | 'save';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function meaningfulTags(item: FrontierItem): string[] {
  const source = item.source.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const sourceLabel = item.sourceLabel.trim().toLowerCase();
  return Array.from(new Set(item.tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => (
      tag
      && !GENERIC_PAIR_TAGS.has(tag)
      && !DOMAIN_LIKE_TAG.test(tag)
      && tag !== source
      && tag !== sourceLabel
    ))))
    .slice(0, MAX_PAIR_TAGS);
}

export function canonicalTastePair(left: string, right: string): string {
  return [left.trim().toLowerCase(), right.trim().toLowerCase()]
    .sort((a, b) => a.localeCompare(b))
    .join(' × ');
}

export function tastePairsForItem(item: FrontierItem): string[] {
  const tags = meaningfulTags(item);
  const pairs: string[] = [];
  for (let left = 0; left < tags.length; left += 1) {
    for (let right = left + 1; right < tags.length; right += 1) {
      if (tags[left] !== tags[right]) pairs.push(canonicalTastePair(tags[left], tags[right]));
    }
  }
  return pairs;
}

function semanticTastePairsForItem(item: FrontierItem): string[] {
  const connection = personalInterestConnection(item);
  if (connection.score <= 0) return [];

  const topics = connection.topicIds.map((id) => `topic:${id}`);
  const domains = connection.domains.map((id) => `domain:${id}`);
  const facets = connection.facets.map((id) => `facet:${id}`);
  const pairs: string[] = [];

  for (const topic of topics) {
    for (const facet of facets) pairs.push(canonicalTastePair(topic, facet));
  }
  for (const domain of domains) {
    for (const facet of facets) pairs.push(canonicalTastePair(domain, facet));
  }
  for (let left = 0; left < domains.length; left += 1) {
    for (let right = left + 1; right < domains.length; right += 1) {
      pairs.push(canonicalTastePair(domains[left], domains[right]));
    }
  }
  for (let left = 0; left < topics.length; left += 1) {
    for (let right = left + 1; right < topics.length; right += 1) {
      pairs.push(canonicalTastePair(topics[left], topics[right]));
    }
  }

  return Array.from(new Set(pairs)).slice(0, MAX_SEMANTIC_PAIRS);
}

function trimPairMap(pairs: Record<string, number>): Record<string, number> {
  const entries = Object.entries(pairs);
  if (entries.length <= MAX_INTEREST_PAIRS) return pairs;
  return Object.fromEntries(entries
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, MAX_INTEREST_PAIRS));
}

function updateKeySet(next: Record<string, number>, keys: string[], delta: number): void {
  if (!delta) return;
  for (const pair of keys) next[pair] = clamp((next[pair] ?? 0) + delta, -0.8, 1.2);
}

function updatePairs(profile: FrontierProfile, item: FrontierItem, delta: number): Record<string, number> {
  if (!delta) return profile.interestPairs;
  const next = { ...profile.interestPairs };
  updateKeySet(next, tastePairsForItem(item), delta);
  // Hierarchical edges deliberately learn more slowly than literal tag pairs.
  // They should transfer evidence, not erase the distinction between hobbies.
  updateKeySet(next, semanticTastePairsForItem(item), delta * SEMANTIC_UPDATE_WEIGHT);
  return trimPairMap(next);
}

function affinityForKeys(keys: string[], profile: FrontierProfile): number {
  if (!keys.length) return 0;
  const values = keys
    .map((pair) => profile.interestPairs[pair] ?? 0)
    .filter((value) => value !== 0)
    .sort((a, b) => Math.abs(b) - Math.abs(a))
    .slice(0, 4);
  if (!values.length) return 0;
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length, -0.8, 1.2);
}

/**
 * Pairwise memory is deliberately weaker than direct topic preference. Literal
 * co-occurrence remains the strongest signal. A second, lower-authority layer
 * learns transferable semantic edges such as motion-sports × motion-science,
 * so evidence from skate pose analysis can cautiously generalize to climbing
 * biomechanics without treating skateboarding and climbing as synonyms.
 */
export function pairAffinityForItem(item: FrontierItem, profile: FrontierProfile): number {
  const literal = affinityForKeys(tastePairsForItem(item), profile);
  const semantic = affinityForKeys(semanticTastePairsForItem(item), profile);
  if (!literal && !semantic) return 0;
  if (!literal) return clamp(semantic * SEMANTIC_READ_WEIGHT, -0.8, 1.2);
  if (!semantic) return literal;

  // When levels disagree, literal evidence owns most of the answer. This is
  // particularly important for dislikes: a broad positive domain pattern must
  // not wash out a negative reaction to a specific intersection.
  return clamp(literal * 0.78 + semantic * 0.22, -0.8, 1.2);
}

function implicitStrength(kind: FrontierImplicitTasteKind, dwellMs = 0): number {
  switch (kind) {
    case 'dwell': {
      if (dwellMs < 12_000) return 0;
      const attention = clamp((dwellMs - 12_000) / 72_000, 0, 1);
      return 0.008 + attention * 0.018;
    }
    case 'expand': return 0.012;
    case 'open': return 0.024;
    case 'save': return 0.04;
  }
}

/**
 * The existing persisted behavior model already learns individual lane, source,
 * topic, format, and time preferences. This memory layer therefore owns only
 * co-interest structure. Keeping those responsibilities separate avoids
 * double-counting the same click and makes the inferred intersections easy to
 * inspect or forget without erasing explicit likes/dislikes.
 */
export function applyImplicitTasteSignal(
  profile: FrontierProfile,
  item: FrontierItem,
  kind: FrontierImplicitTasteKind,
  dwellMs = 0,
): FrontierProfile {
  const strength = implicitStrength(kind, dwellMs);
  if (!strength || item.sourceKind === 'local') return profile;
  const nextPairs = updatePairs(profile, item, strength * 0.52);
  if (nextPairs === profile.interestPairs) return profile;
  return { ...profile, interestPairs: nextPairs };
}

/** Explicit votes also train pair memory, with substantially higher authority. */
export function applyExplicitPairSignal(
  profile: FrontierProfile,
  item: FrontierItem,
  signedValue: number,
): FrontierProfile {
  if (!signedValue) return profile;
  return {
    ...profile,
    interestPairs: updatePairs(profile, item, clamp(signedValue, -1, 1) * 0.055),
  };
}
