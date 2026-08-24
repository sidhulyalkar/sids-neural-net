import type { FrontierItem, FrontierProfile } from './types';

const MAX_INTEREST_PAIRS = 256;
const MAX_PAIR_TAGS = 6;
const GENERIC_PAIR_TAGS = new Set([
  'video', 'watchable', 'research', 'paper', 'code', 'thread', 'web discovery',
  'targeted discovery', 'sports', 'sports state', 'project update',
]);

export type FrontierImplicitTasteKind = 'dwell' | 'expand' | 'open' | 'save';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function meaningfulTags(item: FrontierItem): string[] {
  return Array.from(new Set(item.tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag && !GENERIC_PAIR_TAGS.has(tag))))
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

function trimPairMap(pairs: Record<string, number>): Record<string, number> {
  const entries = Object.entries(pairs);
  if (entries.length <= MAX_INTEREST_PAIRS) return pairs;
  return Object.fromEntries(entries
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, MAX_INTEREST_PAIRS));
}

function updatePairs(profile: FrontierProfile, item: FrontierItem, delta: number): Record<string, number> {
  if (!delta) return profile.interestPairs;
  const next = { ...profile.interestPairs };
  for (const pair of tastePairsForItem(item)) {
    next[pair] = clamp((next[pair] ?? 0) + delta, -0.8, 1.2);
  }
  return trimPairMap(next);
}

/**
 * Pairwise memory is deliberately weaker than direct topic preference. It lets
 * FRONTIER notice combinations such as NFL + visualization or neuroscience +
 * scientific software without allowing one co-occurrence to dominate ranking.
 */
export function pairAffinityForItem(item: FrontierItem, profile: FrontierProfile): number {
  const pairs = tastePairsForItem(item);
  if (!pairs.length) return 0;
  const values = pairs
    .map((pair) => profile.interestPairs[pair] ?? 0)
    .filter((value) => value !== 0)
    .sort((a, b) => Math.abs(b) - Math.abs(a))
    .slice(0, 4);
  if (!values.length) return 0;
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length, -0.8, 1.2);
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
 * Slow memory ratchet for implicit behavior. Impressions never modify durable
 * taste. Meaningful attention nudges the profile by tiny bounded amounts, while
 * explicit reactions remain several times stronger and can reverse the trend.
 */
export function applyImplicitTasteSignal(
  profile: FrontierProfile,
  item: FrontierItem,
  kind: FrontierImplicitTasteKind,
  dwellMs = 0,
): FrontierProfile {
  const strength = implicitStrength(kind, dwellMs);
  if (!strength || item.sourceKind === 'local') return profile;

  const laneAffinity = {
    ...profile.laneAffinity,
    [item.lane]: clamp((profile.laneAffinity[item.lane] ?? 0) + strength * 0.45, -0.75, 1.25),
  };
  const sourceKey = item.sourceKind;
  const sourceAffinity = {
    ...profile.sourceAffinity,
    [sourceKey]: clamp((profile.sourceAffinity[sourceKey] ?? 0) + strength * 0.3, -0.5, 0.8),
  };
  const topicAffinity = { ...profile.topicAffinity };
  for (const tag of meaningfulTags(item)) {
    topicAffinity[tag] = clamp((topicAffinity[tag] ?? 0) + strength, -0.8, 1.4);
  }

  return {
    ...profile,
    laneAffinity,
    sourceAffinity,
    topicAffinity,
    interestPairs: updatePairs(profile, item, strength * 0.52),
  };
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
