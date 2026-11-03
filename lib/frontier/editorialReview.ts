import { assessFrontierEditorialAdmission } from './editorialAdmission';
import { FRONTIER_EDITORIAL_PREFERENCES, frontierEditorialTasteSignals, frontierQualifiedExploration } from './editorialTaste';
import { personalTasteRankingPrior } from './personalTaste';
import { cleanFrontierItem, isFrontierEditoriallyUsable } from './editorialQuality';
import type { FrontierItem } from './types';

export type FrontierEditorialReviewLabel = {
  id: string;
  /** Was this worth an edition slot after inspecting the ORIGINAL source? */
  worthwhile: boolean | null;
  /** Relevant to the intended reader's research or leisure interests? */
  relevant: boolean | null;
  /** Adds a new fact, method, finding, or substantive perspective? */
  novel: boolean | null;
  /** Does the URL lead to the attributed publisher or original work? */
  sourceTraceable: boolean | null;
  /** Does the source substantiate the precise claim represented by the card? */
  claimsSupported: boolean | null;
  /** Optional second-pass preference calibration fields; never auto-labeled. */
  conceptualInsight?: boolean | null;
  practicalUtility?: boolean | null;
  avoidsNoise?: boolean | null;
  unexpectedWorthwhile?: boolean | null;
  notes?: string;
};

export type FrontierEditorialReviewRow = {
  id: string;
  title: string;
  url: string;
  sourceKind: string;
  lane: string;
  summary: string;
  admitted: boolean;
  reason: string;
  flags: string[];
  baselineRank: number | null;
  qualifiedRank: number | null;
  baselineTop14: boolean;
  qualifiedTop14: boolean;
  qualifiedExploration: boolean;
};

export type FrontierReviewRate = {
  positive: number;
  reviewed: number;
  expected: number;
  /** Never publish partial review as a completed quality metric. */
  rate: number | null;
  observedRate: number | null;
};

export type FrontierEditorialReviewReport = {
  sampled: number;
  labeled: number;
  baselineTop14Ids: string[];
  qualifiedTop14Ids: string[];
  metrics: {
    worthwhileAt14: FrontierReviewRate;
    relevantAt14: FrontierReviewRate;
    novelAt14: FrontierReviewRate;
    sourceTraceableAt14: FrontierReviewRate;
    claimsSupportedAt14: FrontierReviewRate;
    falseExclusions: FrontierReviewRate;
    conceptualInsightAt14: FrontierReviewRate;
    practicalUtilityAt14: FrontierReviewRate;
    avoidsNoiseAt14: FrontierReviewRate;
    worthwhileExplorationAt14: FrontierReviewRate;
  };
  calibration: {
    preferenceVersion: string;
    explorationTargetShare: number;
    qualifiedExplorationCountAt14: number;
    realizedExplorationShareAt14: number;
  };
  tasteReviewComplete: boolean;
  reasons: Record<string, number>;
  bySource: Record<string, { sampled: number; admitted: number; rejected: number }>;
  reviewComplete: boolean;
  /** The benchmark has NO independent verification until reviews are filled. */
  evidence: 'human-reviewed' | 'awaiting-human-labels';
};

const ADVERTISING = /\b(?:sponsored by|presented by|use our code|affiliate link|join (?:our|this) (?:channel|discord)|subscribe (?:now|to)|sign up for (?:the|our|a)|newsletter|patreon|discount code|limited.time offer)\b/i;
const GENERIC_TEASER = /^(?:in this (?:video|post|article|episode)|this (?:video|post|article|episode)|we (?:discuss|talk about|cover|explore)|learn (?:more|how)|find out)\b/i;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

function tokens(text: string): string[] {
  return text.toLowerCase().split(NON_WORD).filter((word) => word.length >= 4);
}

/**
 * Triage flags are hypotheses for editors, not truth judgments or hard gates.
 * A strong release may have short copy; a long description can still be empty
 * marketing. Source inspection is required to adjudicate those cases.
 */
export function frontierEditorialReviewFlags(item: FrontierItem): string[] {
  const summary = cleanFrontierItem(item).summary;
  const flags: string[] = [];
  if (ADVERTISING.test(summary) || ADVERTISING.test(item.title)) flags.push('promotional-language');
  if (GENERIC_TEASER.test(summary)) flags.push('generic-teaser');
  if (!summary.trim()) flags.push('no-source-detail');
  if (summary.length > 0 && summary.length < 95) flags.push('short-source-detail');

  const titleTokens = new Set(tokens(item.title));
  const summaryTokens = new Set(tokens(summary));
  const overlap = [...summaryTokens].filter((word) => titleTokens.has(word)).length;
  if (summaryTokens.size >= 3 && overlap / summaryTokens.size >= 0.78) {
    flags.push('headline-restatement');
  }
  if (item.quality >= 0.84 && summary.length < 85 && !item.sportsState) {
    flags.push('high-provider-score-low-evidence');
  }
  if (item.lane === 'must_know' || item.lane === 'world_pulse') {
    flags.push('verify-consequential-claims');
  }
  const taste = frontierEditorialTasteSignals(item);
  if (taste.conceptual) flags.push('conceptual-angle');
  if (taste.practical) flags.push('practical-angle');
  for (const risk of taste.risks) flags.push('review-' + risk);
  return flags;
}

function hashKey(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildFrontierEditorialReviewRows(
  items: readonly FrontierItem[],
  baselineRankedIds: readonly string[],
  qualifiedRankedIds: readonly string[],
): FrontierEditorialReviewRow[] {
  const baseline = new Map(baselineRankedIds.map((id, i) => [id, i + 1]));
  const qualified = new Map(qualifiedRankedIds.map((id, i) => [id, i + 1]));
  return items.map((original) => {
    const item = cleanFrontierItem(original);
    const admission = assessFrontierEditorialAdmission(item);
    const usable = isFrontierEditoriallyUsable(item);
    const baselineRank = baseline.get(item.id) ?? null;
    const qualifiedRank = qualified.get(item.id) ?? null;
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      sourceKind: item.sourceKind,
      lane: item.lane,
      summary: item.summary,
      admitted: admission.admitted && usable,
      reason: usable ? admission.reason : 'source-copy-unusable',
      flags: frontierEditorialReviewFlags(item),
      baselineRank,
      qualifiedRank,
      baselineTop14: baselineRank !== null && baselineRank <= 14,
      qualifiedTop14: qualifiedRank !== null && qualifiedRank <= 14,
      qualifiedExploration: admission.admitted && usable
        && frontierQualifiedExploration(item, personalTasteRankingPrior(item)),
    };
  });
}

/**
 * Fixed-key round robin over source/admission strata, after preserving every
 * baseline/current top-14 candidate. This avoids benchmarking only the items
 * the new policy already likes and permits measured false-negative rates.
 */
export function sampleFrontierEditorialReview(
  rows: readonly FrontierEditorialReviewRow[],
  target = 100,
): FrontierEditorialReviewRow[] {
  const limit = Math.min(rows.length, Math.max(0, Math.floor(target)));
  if (!limit) return [];
  const mandatory = rows.filter((row) => row.baselineTop14 || row.qualifiedTop14)
    .sort((a, b) => Math.min(a.baselineRank ?? Infinity, a.qualifiedRank ?? Infinity)
      - Math.min(b.baselineRank ?? Infinity, b.qualifiedRank ?? Infinity)
      || a.id.localeCompare(b.id));
  const used = new Set(mandatory.slice(0, limit).map((row) => row.id));
  const selected = mandatory.slice(0, limit);
  const buckets = new Map<string, FrontierEditorialReviewRow[]>();
  for (const row of rows) {
    if (used.has(row.id)) continue;
    const key = row.sourceKind + ':' + (row.admitted ? 'admitted' : 'rejected');
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => hashKey(a.url + ':' + a.id) - hashKey(b.url + ':' + b.id)
      || a.id.localeCompare(b.id));
  }
  const keys = [...buckets.keys()].sort();
  while (selected.length < limit && keys.length) {
    for (let i = 0; i < keys.length && selected.length < limit;) {
      const bucket = buckets.get(keys[i])!;
      const next = bucket.shift();
      if (next) {
        selected.push(next);
        used.add(next.id);
      }
      if (!bucket.length) keys.splice(i, 1);
      else i += 1;
    }
  }
  return selected;
}

const LABEL_FIELDS = ['worthwhile', 'relevant', 'novel', 'sourceTraceable', 'claimsSupported'] as const;
const TASTE_LABEL_FIELDS = ['conceptualInsight', 'practicalUtility', 'avoidsNoise', 'unexpectedWorthwhile'] as const;
type LabelField = (typeof LABEL_FIELDS)[number] | (typeof TASTE_LABEL_FIELDS)[number];

export function validateFrontierEditorialLabels(
  labels: readonly FrontierEditorialReviewLabel[],
  sample: readonly FrontierEditorialReviewRow[],
): Map<string, FrontierEditorialReviewLabel> {
  const allowed = new Set(sample.map((row) => row.id));
  const map = new Map<string, FrontierEditorialReviewLabel>();
  for (const entry of labels) {
    if (!allowed.has(entry.id)) throw new Error('Unknown review candidate ID: ' + entry.id);
    if (map.has(entry.id)) throw new Error('Duplicate review candidate ID: ' + entry.id);
    for (const field of [...LABEL_FIELDS, ...TASTE_LABEL_FIELDS]) {
      if (TASTE_LABEL_FIELDS.includes(field as (typeof TASTE_LABEL_FIELDS)[number])
        && entry[field] === undefined) continue; // compatibility with older frozen review templates
      if (entry[field] !== true && entry[field] !== false && entry[field] !== null) {
        throw new Error('Review label must be true, false, or null: ' + entry.id + ' / ' + field);
      }
    }
    map.set(entry.id, entry);
  }
  return map;
}

function metric(
  rows: readonly FrontierEditorialReviewRow[],
  labels: ReadonlyMap<string, FrontierEditorialReviewLabel>,
  field: LabelField,
): FrontierReviewRate {
  const responses = rows.map((row) => labels.get(row.id)?.[field])
    .filter((value): value is boolean => typeof value === 'boolean');
  const positive = responses.filter(Boolean).length;
  const reviewed = responses.length;
  const expected = rows.length;
  return {
    positive,
    reviewed,
    expected,
    rate: expected > 0 && reviewed === expected ? positive / expected : null,
    observedRate: reviewed > 0 ? positive / reviewed : null,
  };
}

export function evaluateFrontierEditorialReview(
  sample: readonly FrontierEditorialReviewRow[],
  labels: readonly FrontierEditorialReviewLabel[],
): FrontierEditorialReviewReport {
  const labelIndex = validateFrontierEditorialLabels(labels, sample);
  const qualified14 = sample.filter((row) => row.qualifiedTop14);
  const rejected = sample.filter((row) => !row.admitted);
  const errors = rejected.map((row) => {
    const label = labelIndex.get(row.id);
    return label ? {
      ...label,
      // A false exclusion requires substantive content verified against source,
      // not merely preference for an unsupported/advertising-only item.
      worthwhile: label.worthwhile === null || label.sourceTraceable === null || label.claimsSupported === null
        ? null : label.worthwhile && label.sourceTraceable && label.claimsSupported,
    } : { id: row.id, worthwhile: null } as FrontierEditorialReviewLabel;
  });
  const falseExclusionMap = new Map(errors.map((x) => [x.id, x]));
  const reasons: Record<string, number> = {};
  const bySource: Record<string, { sampled: number; admitted: number; rejected: number }> = {};
  for (const row of sample) {
    reasons[row.reason] = (reasons[row.reason] ?? 0) + 1;
    const source = bySource[row.sourceKind] ?? { sampled: 0, admitted: 0, rejected: 0 };
    source.sampled += 1;
    if (row.admitted) source.admitted += 1;
    else source.rejected += 1;
    bySource[row.sourceKind] = source;
  }
  const baseMetrics = {
    worthwhileAt14: metric(qualified14, labelIndex, 'worthwhile'),
    relevantAt14: metric(qualified14, labelIndex, 'relevant'),
    novelAt14: metric(qualified14, labelIndex, 'novel'),
    sourceTraceableAt14: metric(qualified14, labelIndex, 'sourceTraceable'),
    claimsSupportedAt14: metric(qualified14, labelIndex, 'claimsSupported'),
    falseExclusions: metric(rejected, falseExclusionMap, 'worthwhile'),
  };
  const tasteMetrics = {
    conceptualInsightAt14: metric(qualified14, labelIndex, 'conceptualInsight'),
    practicalUtilityAt14: metric(qualified14, labelIndex, 'practicalUtility'),
    avoidsNoiseAt14: metric(qualified14, labelIndex, 'avoidsNoise'),
    worthwhileExplorationAt14: metric(qualified14.filter((row) => row.qualifiedExploration),
      labelIndex, 'unexpectedWorthwhile'),
  };
  const explorationCount = qualified14.filter((row) => row.qualifiedExploration).length;
  const metrics = { ...baseMetrics, ...tasteMetrics };
  return {
    sampled: sample.length,
    labeled: [...labelIndex.values()].filter((label) => LABEL_FIELDS.some((field) => label[field] !== null)).length,
    baselineTop14Ids: sample.filter((row) => row.baselineTop14).map((row) => row.id),
    qualifiedTop14Ids: qualified14.map((row) => row.id),
    metrics,
    calibration: {
      preferenceVersion: FRONTIER_EDITORIAL_PREFERENCES.version,
      explorationTargetShare: FRONTIER_EDITORIAL_PREFERENCES.explorationTargetShare,
      qualifiedExplorationCountAt14: explorationCount,
      realizedExplorationShareAt14: qualified14.length ? explorationCount / qualified14.length : 0,
    },
    tasteReviewComplete: Object.values(tasteMetrics).every((value) => value.rate !== null),
    reasons,
    bySource,
    reviewComplete: Object.values(baseMetrics).every((value) => value.rate !== null),
    evidence: labels.some((label) => LABEL_FIELDS.some((field) => label[field] !== null))
      ? 'human-reviewed' : 'awaiting-human-labels',
  };
}
