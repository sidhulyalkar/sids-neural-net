import {
  personalInterestConnection,
  type FrontierConnectionFacet,
  type FrontierInterestDomain,
} from './interestGraph';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from './types';

const HOUR_MS = 3_600_000;
const SESSION_HALF_LIFE_HOURS = 2.75;
const SESSION_MAX_AGE_HOURS = 18;

// These are useful abstractions, but too broad to become the identity of a
// session merely because one item matched them. Concrete topics retain more
// authority while these nodes still contribute weak transfer context.
const TRANSFER_ONLY_TOPIC_IDS = new Set([
  'active-sports',
  'sports-data',
  'ml-data-methods',
  'scientific-software',
  'creative-compute',
]);

export type FrontierSessionIntent = {
  topicWeights: Record<string, number>;
  domainWeights: Partial<Record<FrontierInterestDomain, number>>;
  facetWeights: Partial<Record<FrontierConnectionFacet, number>>;
  confidence: number;
  evidenceCount: number;
  dominantTopicIds: string[];
  dominantDomains: FrontierInterestDomain[];
  dominantFacets: FrontierConnectionFacet[];
};

export type FrontierSessionIntentAdjustment = {
  score: number;
  topicMatch: number;
  domainMatch: number;
  facetMatch: number;
  confidence: number;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function positiveReactionStrength(reaction: FrontierReaction): number {
  switch (reaction) {
    case 'love': return 1;
    case 'important': return 0.94;
    case 'up': return 0.86;
    case 'useful': return 0.8;
    case 'surprise': return 0.72;
    case 'later': return 0.42;
    case 'read': return 0.24;
    case 'known':
    case 'meh':
    case 'down':
    case 'hide': return 0;
  }
}

function strongestRecentEngagement(
  entry: FrontierHistoryEntry,
  now: Date,
): { weight: number; timestamp: string } | undefined {
  const candidates: Array<{ weight: number; timestamp?: string }> = [];

  if (entry.reaction && entry.reactedAt) {
    candidates.push({ weight: positiveReactionStrength(entry.reaction), timestamp: entry.reactedAt });
  }
  if (entry.openedAt) candidates.push({ weight: 0.48, timestamp: entry.openedAt });
  if ((entry.dwellMs ?? 0) >= 12_000) {
    const attention = clamp(((entry.dwellMs ?? 0) - 12_000) / 72_000);
    candidates.push({ weight: 0.22 + attention * 0.2, timestamp: entry.lastSeenAt });
  }

  const strongest = candidates
    .filter((candidate): candidate is { weight: number; timestamp: string } => Boolean(candidate.timestamp) && candidate.weight > 0)
    .sort((left, right) => right.weight - left.weight)[0];
  if (!strongest) return undefined;

  const timestampMs = new Date(strongest.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) return undefined;
  const ageHours = Math.max(0, (now.getTime() - timestampMs) / HOUR_MS);
  if (ageHours > SESSION_MAX_AGE_HOURS) return undefined;
  const recency = Math.exp(-Math.LN2 * ageHours / SESSION_HALF_LIFE_HOURS);
  const weight = strongest.weight * recency;
  if (weight < 0.025) return undefined;
  return { weight, timestamp: strongest.timestamp };
}

function increment(map: Record<string, number>, key: string, value: number): void {
  map[key] = (map[key] ?? 0) + value;
}

function normalizedMap<T extends string>(map: Record<string, number>): Partial<Record<T, number>> {
  const max = Math.max(0, ...Object.values(map));
  if (max <= 0) return {};
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, clamp(value / max)])) as Partial<Record<T, number>>;
}

function dominantKeys<T extends string>(map: Partial<Record<T, number>>, limit: number): T[] {
  return (Object.entries(map) as Array<[T, number]>)
    .filter(([, weight]) => weight >= 0.34)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);
}

/**
 * Build an ephemeral activation map from recent meaningful engagement. The
 * result is derived from canonical history, but it is intentionally never
 * persisted as durable preference state. Long-term taste answers "what does the
 * user generally value?"; session intent answers "which region of that map is
 * active right now?".
 */
export function buildSessionIntent(
  history: Record<string, FrontierHistoryEntry>,
  now = new Date(),
): FrontierSessionIntent {
  const topics: Record<string, number> = {};
  const domains: Record<string, number> = {};
  const facets: Record<string, number> = {};
  let totalEvidence = 0;
  let evidenceCount = 0;

  for (const entry of Object.values(history)) {
    if (entry.item.sourceKind === 'local') continue;
    const engagement = strongestRecentEngagement(entry, now);
    if (!engagement) continue;

    const connection = personalInterestConnection(entry.item);
    if (!connection.topicIds.length && !connection.domains.length && !connection.facets.length) continue;

    evidenceCount += 1;
    totalEvidence += engagement.weight;

    for (const topic of connection.topicIds) {
      increment(topics, topic, engagement.weight * (TRANSFER_ONLY_TOPIC_IDS.has(topic) ? 0.42 : 1));
    }
    for (const domain of connection.domains) increment(domains, domain, engagement.weight * 0.58);
    for (const facet of connection.facets) increment(facets, facet, engagement.weight * 0.46);
  }

  const topicWeights = normalizedMap<string>(topics) as Record<string, number>;
  const domainWeights = normalizedMap<FrontierInterestDomain>(domains);
  const facetWeights = normalizedMap<FrontierConnectionFacet>(facets);
  const volumeConfidence = 1 - Math.exp(-totalEvidence / 1.35);
  const breadthPenalty = evidenceCount <= 1 ? 0.82 : 1;
  const confidence = clamp(volumeConfidence * breadthPenalty, 0, 0.92);

  return {
    topicWeights,
    domainWeights,
    facetWeights,
    confidence,
    evidenceCount,
    dominantTopicIds: dominantKeys(topicWeights, 4),
    dominantDomains: dominantKeys(domainWeights, 3),
    dominantFacets: dominantKeys(facetWeights, 3),
  };
}

function strongestMatch(keys: readonly string[], weights: Record<string, number> | Partial<Record<string, number>>): number {
  return keys.reduce((best, key) => Math.max(best, weights[key] ?? 0), 0);
}

/**
 * Session intent is a bounded reranking feature, not a filter. Direct topic
 * continuity is strongest; domain and method continuity are weaker so a focused
 * session can still surface a useful adjacent bridge instead of becoming a
 * tunnel. The durable profile, evidence-aware pair memory, source trust, global
 * importance, and slate allocator remain authoritative.
 */
export function sessionIntentAdjustment(
  item: FrontierItem,
  intent: FrontierSessionIntent,
): FrontierSessionIntentAdjustment {
  if (intent.confidence < 0.12) {
    return { score: 0, topicMatch: 0, domainMatch: 0, facetMatch: 0, confidence: intent.confidence };
  }

  const connection = personalInterestConnection(item);
  const topicMatch = strongestMatch(connection.topicIds, intent.topicWeights);
  const domainMatch = strongestMatch(connection.domains, intent.domainWeights);
  const facetMatch = strongestMatch(connection.facets, intent.facetWeights);

  // A broad domain alone earns very little. We want continuity of a concrete
  // interest or a concrete transferable method, not "science because science".
  const raw = topicMatch * 0.05
    + domainMatch * 0.012
    + facetMatch * 0.011
    + (topicMatch >= 0.45 && facetMatch >= 0.35 ? 0.008 : 0);
  const score = Math.min(0.065, raw * intent.confidence);

  return { score, topicMatch, domainMatch, facetMatch, confidence: intent.confidence };
}
