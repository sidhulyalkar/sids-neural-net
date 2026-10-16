import type { FrontierHistoryEntry, FrontierItem, FrontierProfile, FrontierReaction } from './types';

const DAY_MS = 86_400_000;
const EXPLICIT_HALF_LIFE_DAYS = 120;
const OPEN_HALF_LIFE_DAYS = 45;
const DWELL_HALF_LIFE_DAYS = 30;
const MAX_ITEM_TOPICS = 7;
// Durable taste should not visibly change because of one ambiguous reaction.
// A single fresh `meh` produces roughly 0.27 confidence, while a direct `down`
// is strong enough to cross this boundary. This creates hysteresis between
// ordinary uncertainty and evidence that is authoritative enough to arbitrate
// an established prior.
const MIN_CONTRADICTION_CONFIDENCE = 0.32;

export type FrontierDirectPreferenceDimension = 'lane' | 'topic' | 'source';

export type FrontierDirectPreferenceEvidence = {
  key: string;
  dimension: FrontierDirectPreferenceDimension;
  positive: number;
  negative: number;
  supportCount: number;
  contradictionCount: number;
  confidence: number;
  affinity: number;
  lastEvidenceAt?: string;
};

export type FrontierDirectPreferenceEvidenceIndex = Map<string, FrontierDirectPreferenceEvidence>;

type MutableEvidence = {
  dimension: FrontierDirectPreferenceDimension;
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

const DIMENSION_EVIDENCE_WEIGHT: Record<FrontierDirectPreferenceDimension, number> = {
  lane: 0.76,
  topic: 1,
  source: 0.46,
};

const EVIDENCE_TARGET_SCALE: Record<FrontierDirectPreferenceDimension, number> = {
  lane: 0.72,
  topic: 0.62,
  source: 0.36,
};

const DIMENSION_LIMITS: Record<FrontierDirectPreferenceDimension, [number, number]> = {
  lane: [-0.75, 1.25],
  topic: [-0.8, 1.4],
  source: [-0.5, 0.8],
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return String(value ?? '').toLowerCase().trim();
}

function normalizedUniqueTopics(tags: string[], limit = MAX_ITEM_TOPICS): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = normalize(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
    if (unique.length >= limit) break;
  }
  return unique;
}

function evidenceKey(dimension: FrontierDirectPreferenceDimension, value: string): string {
  return `${dimension}:${normalize(value)}`;
}

function decay(timestamp: string, halfLifeDays: number, now: Date): number {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return 0;
  const ageDays = Math.max(0, (now.getTime() - time) / DAY_MS);
  return Math.exp(-Math.LN2 * ageDays / halfLifeDays);
}

function reactionStrength(reaction: FrontierReaction): number {
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
    const strength = reactionStrength(entry.reaction);
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

function addEvidence(
  map: Map<string, MutableEvidence>,
  dimension: FrontierDirectPreferenceDimension,
  value: string,
  signed: number,
  timestamp: string,
): void {
  const normalized = normalize(value);
  if (!normalized) return;
  const magnitude = Math.abs(signed) * DIMENSION_EVIDENCE_WEIGHT[dimension];
  if (magnitude <= 0) return;
  const key = evidenceKey(dimension, normalized);
  const current = map.get(key) ?? {
    dimension,
    positive: 0,
    negative: 0,
    positiveCount: 0,
    negativeCount: 0,
  };
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

function finalizeEvidence(key: string, raw: MutableEvidence): FrontierDirectPreferenceEvidence {
  const total = raw.positive + raw.negative;
  const signed = raw.positive - raw.negative;
  const agreement = total > 0 ? Math.abs(signed) / total : 0;
  // Direct topic/lane/source evidence is intentionally a little more
  // conservative than pair evidence: broad dimensions require repeated,
  // directionally consistent examples before they may arbitrate a durable
  // explicit prior.
  const volumeConfidence = 1 - Math.exp(-total / 1.6);
  const confidence = clamp(volumeConfidence * (0.55 + agreement * 0.45), 0, 0.97);
  const affinity = total > 0 ? clamp((signed / total) * confidence, -0.9, 0.9) : 0;
  const positiveDirection = affinity >= 0;
  return {
    key,
    dimension: raw.dimension,
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
 * Derive direct taste evidence from canonical item history. This state is never
 * persisted separately, so cloud/browser merges cannot double-count a second
 * preference database. Each canonical history item contributes at most one
 * signed evidence event to each lane/source/topic dimension it represents.
 */
export function buildDirectPreferenceEvidenceIndex(
  history: Record<string, FrontierHistoryEntry>,
  now = new Date(),
): FrontierDirectPreferenceEvidenceIndex {
  const raw = new Map<string, MutableEvidence>();
  for (const entry of Object.values(history)) {
    if (entry.item.sourceKind === 'local') continue;
    const evidence = strongestEvidenceForEntry(entry, now);
    if (!evidence) continue;
    addEvidence(raw, 'lane', entry.item.lane, evidence.signed, evidence.timestamp);
    addEvidence(raw, 'source', entry.item.sourceKind, evidence.signed, evidence.timestamp);
    for (const topic of normalizedUniqueTopics(entry.item.tags)) {
      addEvidence(raw, 'topic', topic, evidence.signed, evidence.timestamp);
    }
  }
  return new Map(Array.from(raw.entries()).map(([key, value]) => [key, finalizeEvidence(key, value)]));
}

export function directPreferenceEvidenceFor(
  index: FrontierDirectPreferenceEvidenceIndex | undefined,
  dimension: FrontierDirectPreferenceDimension,
  value: string,
): FrontierDirectPreferenceEvidence | undefined {
  return index?.get(evidenceKey(dimension, value));
}

/**
 * Legacy direct affinities are treated as compatibility priors, not additional
 * evidence. Confirming history does not amplify them because the behavior model
 * already represents repeated engagement. Only sufficiently confident
 * contradiction attenuates and may eventually reverse the old prior.
 *
 * The explicit confidence dead zone is deliberate hysteresis. Evidence inside
 * it is still retained for learning-health diagnostics and can accumulate with
 * future observations, but it cannot yet perturb ranking, retrieval, search
 * suggestions, or explanations. That keeps one ambiguous reaction from moving
 * a finite recommendation budget while preserving fast response to stronger
 * explicit rejection and repeated contradiction.
 */
export function effectiveDirectPreferenceAffinity(
  legacyAffinity: number,
  dimension: FrontierDirectPreferenceDimension,
  value: string,
  index?: FrontierDirectPreferenceEvidenceIndex,
): number {
  if (!Number.isFinite(legacyAffinity)) return 0;
  const evidence = directPreferenceEvidenceFor(index, dimension, value);
  if (!evidence || evidence.confidence < MIN_CONTRADICTION_CONFIDENCE || Math.abs(legacyAffinity) < 0.005) {
    return legacyAffinity;
  }
  const legacyDirection = Math.sign(legacyAffinity);
  const evidenceDirection = Math.sign(evidence.affinity);
  if (!evidenceDirection || evidenceDirection === legacyDirection) return legacyAffinity;

  const directionalStrength = evidence.confidence * clamp(Math.abs(evidence.affinity) / 0.35);
  if (directionalStrength <= 0.12) return legacyAffinity;
  const switchWeight = clamp((directionalStrength - 0.12) / 0.72, 0, 0.95);
  const evidenceTarget = evidence.affinity * EVIDENCE_TARGET_SCALE[dimension];
  const [min, max] = DIMENSION_LIMITS[dimension];
  return clamp(legacyAffinity * (1 - switchWeight) + evidenceTarget * switchWeight, min, max);
}

export function directPreferenceSignalsForItem(
  item: FrontierItem,
  profile: FrontierProfile,
  index?: FrontierDirectPreferenceEvidenceIndex,
): { laneAffinity: number; sourceAffinity: number; topicSignal: number } {
  const laneAffinity = effectiveDirectPreferenceAffinity(
    profile.laneAffinity[item.lane] ?? 0,
    'lane',
    item.lane,
    index,
  );
  const sourceAffinity = effectiveDirectPreferenceAffinity(
    profile.sourceAffinity[item.sourceKind] ?? 0,
    'source',
    item.sourceKind,
    index,
  );
  const topics = normalizedUniqueTopics(item.tags);
  const topicSignal = topics.length
    ? topics.reduce((sum, topic) => sum + effectiveDirectPreferenceAffinity(
      profile.topicAffinity[topic] ?? 0,
      'topic',
      topic,
      index,
    ), 0) / topics.length
    : 0;
  return { laneAffinity, sourceAffinity, topicSignal };
}
