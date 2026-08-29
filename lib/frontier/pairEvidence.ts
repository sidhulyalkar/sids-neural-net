import { personalInterestConnection } from './interestGraph';
import { canonicalTastePair, tastePairsForItem } from './tasteLearning';
import type { FrontierHistoryEntry, FrontierItem, FrontierReaction } from './types';

const DAY_MS = 86_400_000;
const EXPLICIT_HALF_LIFE_DAYS = 120;
const OPEN_HALF_LIFE_DAYS = 45;
const DWELL_HALF_LIFE_DAYS = 30;
const SEMANTIC_EVIDENCE_WEIGHT = 0.38;
const MAX_SEMANTIC_PAIRS = 24;

export type FrontierPairEvidence = {
  key: string;
  positive: number;
  negative: number;
  supportCount: number;
  contradictionCount: number;
  confidence: number;
  affinity: number;
  lastEvidenceAt?: string;
};

export type FrontierPairEvidenceIndex = Map<string, FrontierPairEvidence>;

type MutableEvidence = {
  positive: number;
  negative: number;
  positiveCount: number;
  negativeCount: number;
  lastEvidenceAt?: string;
};

type ItemEvidence = {
  signed: number;
  timestamp: string;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function decay(timestamp: string, halfLifeDays: number, now: Date): number {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return 0;
  const ageDays = Math.max(0, (now.getTime() - time) / DAY_MS);
  return Math.exp(-Math.LN2 * ageDays / halfLifeDays);
}

function explicitReactionStrength(reaction: FrontierReaction): number {
  switch (reaction) {
    case 'love': return 1;
    case 'important': return 0.9;
    case 'up': return 0.86;
    case 'surprise': return 0.72;
    case 'useful': return 0.66;
    case 'later': return 0.32;
    case 'read': return 0.16;
    case 'known': return 0;
    case 'meh': return -0.5;
    case 'down': return -0.82;
    case 'hide': return -1;
  }
}

function strongestEvidenceForEntry(entry: FrontierHistoryEntry, now: Date): ItemEvidence | undefined {
  if (entry.reaction && entry.reactedAt) {
    const strength = explicitReactionStrength(entry.reaction);
    if (!strength) return undefined;
    const weight = decay(entry.reactedAt, EXPLICIT_HALF_LIFE_DAYS, now);
    if (weight < 0.015) return undefined;
    return { signed: strength * weight, timestamp: entry.reactedAt };
  }

  if (entry.openedAt) {
    const weight = decay(entry.openedAt, OPEN_HALF_LIFE_DAYS, now);
    if (weight >= 0.015) return { signed: 0.2 * weight, timestamp: entry.openedAt };
  }

  if ((entry.dwellMs ?? 0) >= 12_000) {
    const attention = clamp(((entry.dwellMs ?? 0) - 12_000) / 72_000);
    const weight = decay(entry.lastSeenAt, DWELL_HALF_LIFE_DAYS, now);
    if (weight >= 0.015) return { signed: (0.07 + attention * 0.08) * weight, timestamp: entry.lastSeenAt };
  }

  return undefined;
}

function semanticPairsForItem(item: FrontierItem): string[] {
  // Match the durable learner's vetted-semantic contract. Long-lived evidence
  // comes from normalized tags, not arbitrary title/summary prose.
  const connection = personalInterestConnection({ ...item, title: '', summary: '' });
  if (connection.score <= 0) return [];
  const topics = connection.topicIds.map((id) => `topic:${id}`);
  const domains = connection.domains.map((id) => `domain:${id}`);
  const facets = connection.facets.map((id) => `facet:${id}`);
  const pairs: string[] = [];

  for (const topic of topics) for (const facet of facets) pairs.push(canonicalTastePair(topic, facet));
  for (const domain of domains) for (const facet of facets) pairs.push(canonicalTastePair(domain, facet));
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

function addEvidence(
  map: Map<string, MutableEvidence>,
  key: string,
  signed: number,
  timestamp: string,
  weight = 1,
): void {
  const magnitude = Math.abs(signed) * weight;
  if (magnitude <= 0) return;
  const current = map.get(key) ?? { positive: 0, negative: 0, positiveCount: 0, negativeCount: 0 };
  if (signed > 0) {
    current.positive += magnitude;
    current.positiveCount += 1;
  } else {
    current.negative += magnitude;
    current.negativeCount += 1;
  }
  if (!current.lastEvidenceAt || timestamp > current.lastEvidenceAt) current.lastEvidenceAt = timestamp;
  map.set(key, current);
}

function finalizeEvidence(key: string, raw: MutableEvidence): FrontierPairEvidence {
  const total = raw.positive + raw.negative;
  const signed = raw.positive - raw.negative;
  const agreement = total > 0 ? Math.abs(signed) / total : 0;
  // Confidence grows with independent evidence but contradiction deliberately
  // slows it. A single strong click can guide exploration; repeated consistent
  // examples are required before the history ledger dominates legacy memory.
  const volumeConfidence = 1 - Math.exp(-total / 1.25);
  const confidence = clamp(volumeConfidence * (0.55 + agreement * 0.45), 0, 0.98);
  const affinity = total > 0 ? clamp((signed / total) * confidence, -0.9, 0.9) : 0;
  const positiveDirection = affinity >= 0;

  return {
    key,
    positive: raw.positive,
    negative: raw.negative,
    supportCount: positiveDirection ? raw.positiveCount : raw.negativeCount,
    contradictionCount: positiveDirection ? raw.negativeCount : raw.positiveCount,
    confidence,
    affinity,
    lastEvidenceAt: raw.lastEvidenceAt,
  };
}

/**
 * Derive merge-safe preference evidence from canonical history. Nothing here is
 * persisted separately, so browser/cloud reconciliation cannot double-count a
 * new confidence database or require a storage-version migration.
 */
export function buildPairEvidenceIndex(
  history: Record<string, FrontierHistoryEntry>,
  now = new Date(),
): FrontierPairEvidenceIndex {
  const raw = new Map<string, MutableEvidence>();
  for (const entry of Object.values(history)) {
    if (entry.item.sourceKind === 'local') continue;
    const evidence = strongestEvidenceForEntry(entry, now);
    if (!evidence) continue;

    for (const key of tastePairsForItem(entry.item)) addEvidence(raw, key, evidence.signed, evidence.timestamp);
    for (const key of semanticPairsForItem(entry.item)) {
      addEvidence(raw, key, evidence.signed, evidence.timestamp, SEMANTIC_EVIDENCE_WEIGHT);
    }
  }

  return new Map(Array.from(raw.entries()).map(([key, value]) => [key, finalizeEvidence(key, value)]));
}

function evidenceAffinity(keys: string[], index: FrontierPairEvidenceIndex): { affinity: number; confidence: number } {
  const matches = keys
    .flatMap((key) => index.get(key) ? [index.get(key)!] : [])
    .sort((left, right) => right.confidence - left.confidence || Math.abs(right.affinity) - Math.abs(left.affinity))
    .slice(0, 4);
  if (!matches.length) return { affinity: 0, confidence: 0 };

  const confidenceWeight = matches.reduce((sum, match) => sum + Math.max(0.08, match.confidence), 0);
  const affinity = matches.reduce((sum, match) => sum + match.affinity * Math.max(0.08, match.confidence), 0) / confidenceWeight;
  const confidence = clamp(matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length, 0, 0.98);
  return { affinity: clamp(affinity, -0.9, 0.9), confidence };
}

export function pairEvidenceForItem(
  item: FrontierItem,
  index: FrontierPairEvidenceIndex,
): { affinity: number; confidence: number } {
  const literal = evidenceAffinity(tastePairsForItem(item), index);
  const semantic = evidenceAffinity(semanticPairsForItem(item), index);
  if (!literal.confidence && !semantic.confidence) return { affinity: 0, confidence: 0 };
  if (!literal.confidence) return { affinity: semantic.affinity * 0.58, confidence: semantic.confidence * 0.58 };
  if (!semantic.confidence) return literal;
  return {
    affinity: clamp(literal.affinity * 0.8 + semantic.affinity * 0.2, -0.9, 0.9),
    confidence: clamp(literal.confidence * 0.8 + semantic.confidence * 0.2, 0, 0.98),
  };
}

/**
 * Existing scalar pair memory remains a compatibility prior for historic saves,
 * expansions, and backups that predate evidence-aware ranking. As ledger
 * confidence grows it relinquishes authority smoothly instead of winning by
 * absolute magnitude forever.
 */
export function effectivePairAffinityForItem(
  item: FrontierItem,
  legacyAffinity: number,
  index?: FrontierPairEvidenceIndex,
): number {
  if (!index) return legacyAffinity;
  const evidence = pairEvidenceForItem(item, index);
  if (evidence.confidence <= 0.02) return legacyAffinity;
  const legacyWeight = (1 - evidence.confidence) * 0.35;
  return clamp(evidence.affinity * (1 - legacyWeight) + legacyAffinity * legacyWeight, -0.9, 1.2);
}

export function positiveLiteralPairEvidence(index: FrontierPairEvidenceIndex): FrontierPairEvidence[] {
  return Array.from(index.values())
    .filter((entry) => (
      !entry.key.includes('topic:')
      && !entry.key.includes('domain:')
      && !entry.key.includes('facet:')
      && entry.affinity >= 0.16
      && entry.confidence >= 0.3
      && entry.positive > entry.negative * 1.35
    ))
    .sort((left, right) => (
      right.affinity * right.confidence - left.affinity * left.confidence
      || (right.lastEvidenceAt ?? '').localeCompare(left.lastEvidenceAt ?? '')
    ));
}
