import { personalInterestConnection } from './interestGraph';
import type { FrontierHistoryEntry, FrontierItem } from './types';

const DAY_MS = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 4.5;
const MAX_SIGNATURES = 18;
const EXACT_SIGNATURE_THRESHOLD = 0.8;
const TRANSFER_EXPOSURE_CAP = 0.22;
const SPECIFIC_MOTION_TOPIC_IDS = new Set([
  'rock-climbing',
  'mountain-biking',
  'skiing',
  'disc-golf',
  'skate-progression',
  'freestyle-scooter',
]);

const TRANSFER_ONLY_TOPIC_IDS = new Set([
  'active-sports',
  'sports-data',
  'ml-data-methods',
  'scientific-software',
  'creative-compute',
]);

export type FrontierConnectionSignature = {
  key: string;
  weight: number;
};

export type FrontierConnectionPortfolioAdjustment = {
  exposure: number;
  bonus: number;
  penalty: number;
  net: number;
  signatures: FrontierConnectionSignature[];
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function canonical(left: string, right: string): string {
  return [left, right].sort((a, b) => a.localeCompare(b)).join(' × ');
}

/**
 * Portfolio signatures describe the kind of connection rather than the item.
 * Concrete interest × method edges carry full fatigue authority. Parent topics,
 * domains, and shared methods are deliberately weak transfer evidence so seeing
 * five skate-pose projects does not make climbing-biomechanics feel exhausted.
 */
export function interestConnectionSignatures(item: FrontierItem): FrontierConnectionSignature[] {
  const connection = personalInterestConnection(item);
  if (connection.score < 0.035 || connection.confidence < 0.5) return [];

  const signatures = new Map<string, number>();
  const hasSpecificMotionTopic = connection.topicIds.some((topic) => SPECIFIC_MOTION_TOPIC_IDS.has(topic));
  for (const topic of connection.topicIds) {
    let topicWeight = TRANSFER_ONLY_TOPIC_IDS.has(topic) ? 0.14 : 1;
    if (topic === 'active-sports' && hasSpecificMotionTopic) topicWeight = 0.12;
    for (const facet of connection.facets) {
      signatures.set(canonical(`topic:${topic}`, `facet:${facet}`), topicWeight);
    }
  }
  for (let left = 0; left < connection.domains.length; left += 1) {
    for (let right = left + 1; right < connection.domains.length; right += 1) {
      signatures.set(canonical(`domain:${connection.domains[left]}`, `domain:${connection.domains[right]}`), 0.1);
    }
  }
  for (const domain of connection.domains) {
    for (const facet of connection.facets) {
      const key = canonical(`domain:${domain}`, `facet:${facet}`);
      signatures.set(key, Math.max(signatures.get(key) ?? 0, 0.08));
    }
  }

  return Array.from(signatures.entries())
    .map(([key, weight]) => ({ key, weight }))
    .sort((left, right) => right.weight - left.weight || left.key.localeCompare(right.key))
    .slice(0, MAX_SIGNATURES);
}

function reactionExposureFactor(entry: FrontierHistoryEntry): number {
  switch (entry.reaction) {
    case 'hide':
    case 'down':
    case 'meh': return 1.25;
    case 'love':
    case 'up':
    case 'useful':
    case 'important': return 0.82;
    default: return 1;
  }
}

function historyExposureWeight(entry: FrontierHistoryEntry, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(entry.lastSeenAt).getTime()) / DAY_MS);
  const recency = Math.exp(-Math.LN2 * ageDays / RECENCY_HALF_LIFE_DAYS);
  const impressions = Math.min(2.2, 0.7 + Math.log1p(Math.max(1, entry.impressions)) * 0.45);
  return recency * impressions * reactionExposureFactor(entry);
}

export function buildConnectionExposureIndex(
  history: Record<string, FrontierHistoryEntry>,
  now = new Date(),
): Map<string, number> {
  const exposure = new Map<string, number>();
  for (const entry of Object.values(history)) {
    if (entry.item.sourceKind === 'local') continue;
    const weight = historyExposureWeight(entry, now);
    if (weight < 0.035) continue;
    for (const signature of interestConnectionSignatures(entry.item)) {
      exposure.set(signature.key, (exposure.get(signature.key) ?? 0) + weight * signature.weight);
    }
  }
  return exposure;
}

function weightedExposure(
  signatures: FrontierConnectionSignature[],
  exposureIndex: Map<string, number>,
): number {
  const rankWeights = [0.55, 0.25, 0.13, 0.07];
  return signatures
    .map(({ key, weight }) => (exposureIndex.get(key) ?? 0) * weight)
    .filter((value) => value > 0)
    .sort((left, right) => right - left)
    .slice(0, rankWeights.length)
    .reduce((sum, value, index) => sum + value * rankWeights[index], 0);
}

/**
 * Exact repetition and transferable similarity are intentionally different
 * currencies. An exact concrete-interest × method match can accumulate enough
 * exposure to suppress another near-duplicate. Parent/domain/method overlap may
 * only contribute a small capped shadow. This preserves useful transfer without
 * letting five skate-pose cards make climbing-biomechanics feel already seen.
 */
function portfolioExposure(
  signatures: FrontierConnectionSignature[],
  exposureIndex: Map<string, number>,
): number {
  const exact = signatures.filter(({ weight }) => weight >= EXACT_SIGNATURE_THRESHOLD);
  const transfer = signatures.filter(({ weight }) => weight < EXACT_SIGNATURE_THRESHOLD);
  const exactExposure = weightedExposure(exact, exposureIndex);
  const transferExposure = Math.min(TRANSFER_EXPOSURE_CAP, weightedExposure(transfer, exposureIndex) * 0.35);
  return exactExposure + transferExposure;
}

export function connectionPortfolioAdjustment(
  item: FrontierItem,
  exposureIndex: Map<string, number>,
  learnedPairAffinity = 0,
  learnedPairConfidence = 0,
): FrontierConnectionPortfolioAdjustment {
  const signatures = interestConnectionSignatures(item);
  if (!signatures.length) return { exposure: 0, bonus: 0, penalty: 0, net: 0, signatures };

  const exposure = portfolioExposure(signatures, exposureIndex);
  const connection = personalInterestConnection(item);

  if (item.highPriority || item.watchSignal || item.importance >= 0.88) {
    return { exposure, bonus: 0, penalty: 0, net: 0, signatures };
  }

  const preferenceUncertainty = clamp((0.72 - learnedPairConfidence) / 0.72);
  const bonus = learnedPairAffinity > -0.12
    && exposure < 0.35
    && connection.confidence >= 0.6
    && preferenceUncertainty > 0
    ? Math.min(0.018, connection.score * connection.confidence * 0.17) * preferenceUncertainty
    : 0;
  const penalty = exposure > 0.8
    ? Math.min(0.075, (exposure - 0.8) * 0.022)
    : 0;

  return {
    exposure,
    bonus,
    penalty,
    net: clamp(bonus - penalty, -0.075, 0.018),
    signatures,
  };
}
