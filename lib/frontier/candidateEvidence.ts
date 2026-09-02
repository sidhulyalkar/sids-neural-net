import { FRONTIER_LANE_MAP } from './config';
import type { FrontierItem } from './types';

export type FrontierCandidateEvidenceDisposition = 'retain' | 'demote' | 'suppress';

export type FrontierCandidateEvidence = {
  score: number;
  disposition: FrontierCandidateEvidenceDisposition;
  sourceKind: FrontierItem['sourceKind'];
  distinctLaneHits: string[];
  specificLaneHits: string[];
  titleHits: string[];
  summaryHits: string[];
  tagHits: string[];
  stars: number | null;
  forks: number | null;
  reasons: string[];
};

const GENERIC_LANE_TERMS = new Set([
  'agent',
  'alignment',
  'benchmark',
  'dataset',
  'evaluation',
  'framework',
  'github',
  'inference',
  'library',
  'open source',
  'platform',
  'release',
  'repository',
  'space',
  'statistics',
  'tracking',
  'transfer',
  'visualization',
]);

const GENERIC_TECH_PHRASES = new Set([
  'data analysis',
  'data science',
  'machine learning',
  'open source',
]);

const SYNTHETIC_TAGS = new Set([
  'paper',
  'research',
  'code',
  'thread',
  'discussion',
  'web discovery',
  'live web',
  'trending repository',
]);

const GITHUB_FALLBACK_SUMMARIES = new Set([
  'recently active open-source project worth inspecting at the source.',
  'recently active open source project worth inspecting at the source.',
]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesTerm(text: string, term: string): boolean {
  const haystack = ` ${normalize(text)} `;
  const needle = ` ${normalize(term)} `;
  return needle.trim().length > 0 && haystack.includes(needle);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function metricNumber(item: FrontierItem, label: string): number | null {
  const entry = item.metrics?.find((metric) => metric.label.toLowerCase() === label.toLowerCase());
  if (!entry) return null;
  const parsed = Number(String(entry.value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function semanticEvidence(item: FrontierItem) {
  const lane = FRONTIER_LANE_MAP[item.lane];
  const laneLabel = normalize(item.lane.replaceAll('_', ' '));
  const title = item.title ?? '';
  const summary = item.summary ?? '';
  const tags = (item.tags ?? []).filter((tag) => {
    const normalized = normalize(tag);
    return normalized && normalized !== laneLabel && !SYNTHETIC_TAGS.has(normalized);
  });

  const titleHits = lane.keywords.filter((term) => includesTerm(title, term));
  const summaryHits = lane.keywords.filter((term) => includesTerm(summary, term));
  const tagHits = lane.keywords.filter((term) => tags.some((tag) => includesTerm(tag, term)));
  const distinctLaneHits = unique([...titleHits, ...summaryHits, ...tagHits]);
  const specificLaneHits = distinctLaneHits.filter((term) => {
    const normalized = normalize(term);
    if (GENERIC_LANE_TERMS.has(normalized) || GENERIC_TECH_PHRASES.has(normalized)) return false;
    const words = normalized.split(' ').filter(Boolean);
    return words.length >= 2 || normalized.length >= 12;
  });

  return {
    distinctLaneHits,
    specificLaneHits,
    titleHits,
    summaryHits,
    tagHits,
    substantiveTags: tags,
  };
}

function assessOpenAlex(item: FrontierItem): FrontierCandidateEvidence {
  const semantic = semanticEvidence(item);
  const citations = metricNumber(item, 'citations');
  const strongTextHit = unique([...semantic.titleHits, ...semantic.summaryHits])
    .some((term) => semantic.specificLaneHits.includes(term));
  const textChannels = Number(semantic.titleHits.length > 0) + Number(semantic.summaryHits.length > 0);
  const coherent = semantic.distinctLaneHits.length >= 2 || strongTextHit;

  // Citations are deliberately not an admission requirement. Newly published
  // work starts at zero by construction. They provide only a tiny corroborating
  // signal after semantic evidence has already established topical coherence.
  let score = 0.28;
  score += Math.min(0.42, semantic.distinctLaneHits.length * 0.14);
  score += strongTextHit ? 0.18 : 0;
  score += textChannels >= 2 ? 0.08 : 0;
  score += citations && citations > 0 ? Math.min(0.04, Math.log10(citations + 1) * 0.02) : 0;
  score = clamp(score);

  const reasons: string[] = [];
  if (coherent) reasons.push('multiple or specific lane signals support the scholarly match');
  else reasons.push('scholarly provenance is strong but topical evidence is only a weak lane collision');
  if ((citations ?? 0) === 0) reasons.push('zero citations are neutral for fresh work');

  return {
    score,
    disposition: coherent ? 'retain' : 'suppress',
    sourceKind: item.sourceKind,
    distinctLaneHits: semantic.distinctLaneHits,
    specificLaneHits: semantic.specificLaneHits,
    titleHits: semantic.titleHits,
    summaryHits: semantic.summaryHits,
    tagHits: semantic.tagHits,
    stars: null,
    forks: null,
    reasons,
  };
}

function assessGithub(item: FrontierItem): FrontierCandidateEvidence {
  const semantic = semanticEvidence(item);
  const stars = metricNumber(item, 'stars');
  const forks = metricNumber(item, 'forks');
  const summary = normalize(item.summary ?? '');
  const fallbackSummary = !summary || GITHUB_FALLBACK_SUMMARIES.has(summary);
  const socialEvidence = Math.log10((stars ?? 0) + 1) + 0.75 * Math.log10((forks ?? 0) + 1);
  const strongSemantic = semantic.specificLaneHits.length > 0
    && (semantic.summaryHits.length > 0 || semantic.titleHits.length > 0);
  const richDescription = !fallbackSummary && (item.summary?.trim().length ?? 0) >= 80;
  const topicBreadth = semantic.substantiveTags.length >= 4;
  const noSocialEvidence = (stars ?? 0) === 0 && (forks ?? 0) === 0;
  const weak = noSocialEvidence && !strongSemantic && !(richDescription && topicBreadth && semantic.distinctLaneHits.length >= 3);

  let score = 0.34;
  score += Math.min(0.28, semantic.distinctLaneHits.length * 0.07);
  score += Math.min(0.18, semantic.specificLaneHits.length * 0.09);
  score += richDescription ? 0.08 : 0;
  score += topicBreadth ? 0.05 : 0;
  score += Math.min(0.18, socialEvidence * 0.08);
  if (fallbackSummary) score -= 0.12;
  score = clamp(score);

  const reasons: string[] = [];
  if (noSocialEvidence) reasons.push('brand-new repository has no star/fork corroboration yet');
  else reasons.push('repository has independent star/fork corroboration');
  if (strongSemantic) reasons.push('specific technical lane evidence protects niche zero-star discoveries');
  if (weak) reasons.push('generic or weakly supported repository should spend less exploration budget');

  return {
    score,
    // GitHub remains a demotion-only policy in shadow v1. Popularity is an
    // imperfect proxy and hard rejection would erase genuinely new niche tools.
    disposition: weak ? 'demote' : 'retain',
    sourceKind: item.sourceKind,
    distinctLaneHits: semantic.distinctLaneHits,
    specificLaneHits: semantic.specificLaneHits,
    titleHits: semantic.titleHits,
    summaryHits: semantic.summaryHits,
    tagHits: semantic.tagHits,
    stars,
    forks,
    reasons,
  };
}

export function assessFrontierCandidateEvidence(item: FrontierItem): FrontierCandidateEvidence {
  if (item.sourceKind === 'openalex') return assessOpenAlex(item);
  if (item.sourceKind === 'github') return assessGithub(item);

  return {
    score: 1,
    disposition: 'retain',
    sourceKind: item.sourceKind,
    distinctLaneHits: [],
    specificLaneHits: [],
    titleHits: [],
    summaryHits: [],
    tagHits: [],
    stars: null,
    forks: null,
    reasons: ['candidate-evidence shadow v1 does not alter this source kind'],
  };
}

export function candidateEvidenceShadowAdjustment(item: FrontierItem): number {
  const evidence = assessFrontierCandidateEvidence(item);
  if (evidence.disposition === 'suppress') return -1;
  if (evidence.disposition === 'demote') return -0.14;
  return 0;
}
