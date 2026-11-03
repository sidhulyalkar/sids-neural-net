import type { FrontierItem } from './types';

/**
 * Owner-configured FRONTIER editorial defaults. The public site's discovery
 * defaults already reflect Sid's subject interests; these configure how a
 * candidate should communicate value, without overriding explicit reactions.
 *
 * These settings are editorial PRIORITIES, not verified statements about any
 * particular article and never supersede source admission.
 */
export const FRONTIER_EDITORIAL_PREFERENCES = {
  version: 'sid-conceptual-balanced-2026-11-02',
  discoveryPriority: 'balanced',
  depth: 'conceptual',
  practicalRelevance: 'balanced',
  explorationTargetShare: 0.25,
  avoid: [
    'repetitive-stories',
    'unsupported-hype',
    'celebrity-gossip',
    'shallow-summaries',
    'unverified-speculation',
    'generic-ai-product-news',
  ],
} as const;

export type FrontierEditorialRisk =
  | 'hype-without-specifics'
  | 'speculative-wording'
  | 'generic-ai-product-announcement'
  | 'celebrity-gossip'
  | 'thin-description';

export type FrontierEditorialTasteSignals = {
  conceptual: boolean;
  practical: boolean;
  credibleNovelty: boolean;
  risks: FrontierEditorialRisk[];
  /** Small soft reranking adjustment; never a new eligibility requirement. */
  adjustment: number;
};

const HYPE = /\b(?:game[\s-]?chang(?:er|ing)|revolutionary|mind[\s-]?blowing|insane|will change everything|secret trick|breaks the internet|you won't believe|ultimate ai|best ever|unprecedented)\b/i;
const SPECULATIVE = /\b(?:rumou?rs?|unconfirmed|allegedly|reportedly|leaked?|speculation|might be planning|could be about to)\b/i;
const GOSSIP = /\b(?:celebrity gossip|dating rumours?|dating rumors?|red carpet drama|celebrity feud|celebrity breakup|paparazzi|tabloid scandal|who is dating whom)\b/i;
const GENERIC_AI = /\b(?:new|launch(?:es|ed)?|unveil(?:s|ed)?|introduc(?:e|es|ed)|release(?:s|d)?|announce(?:s|d)?)\b/i;
const GENERIC_AI_PRODUCT = /\b(?:ai (?:app|assistant|chatbot|product|platform|tool|startup)|chatbot app|generative ai app|ai-powered assistant)\b/i;
const EVIDENCE = /\b(?:measur(?:ed|ement|es)|evaluat(?:ed|ion|es)|benchmark|dataset|experiment(?:al)?|method(?:ology|s)?|results?|limitations?|uncertainty|replicat(?:ed|ion)|study|comparison|ablation|clinical trial|primary source|implementation details)\b/i;
const CONCEPTUAL = /\b(?:explains?|understand(?:ing)?|mechanis(?:m|ms|tic)|causal|why|how|insight|concept(?:ual)?|theor(?:y|etical)|underlying|fundamental|interpretation|implications?|perspective|architecture|trade[\s-]?offs?|analysis|analys(?:e|is|es)|model(?:ing|ling)?)\b/i;
const PRACTICAL = /\b(?:implementation|open[\s-]?source|library|software|code|reproducib(?:le|ility)|workflow|toolkit|prototype|deploy|released?|benchmark|guide|engineering|technique|method|dataset)\b/i;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'the', 'this', 'that', 'to', 'was', 'were',
  'with', 'new', 'how', 'why', 'what', 'over', 'after', 'about', 'more',
]);

function titleTokens(title: string): Set<string> {
  return new Set((title.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

/** Conservative near-duplicate title detection. Preserve separate studies with
 * different sample names, models or meaningful qualifiers. */
export function frontierSameStoryHeadline(a: FrontierItem, b: FrontierItem): boolean {
  if (a.id === b.id) return true;
  if (a.url === b.url) return true;
  const left = titleTokens(a.title);
  const right = titleTokens(b.title);
  if (left.size < 4 || right.size < 4) return false;
  const shared = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return shared >= 4 && union > 0 && shared / union >= 0.84;
}

export function frontierEditorialTasteSignals(item: FrontierItem): FrontierEditorialTasteSignals {
  if (item.sportsState || item.sourceKind === 'sports_state') {
    return { conceptual: false, practical: false, credibleNovelty: false, risks: [], adjustment: 0 };
  }

  const text = [item.title, item.summary].join(' ');
  const summary = item.summary?.trim() ?? '';
  const hasEvidenceLanguage = EVIDENCE.test(summary);
  const credibleNovelty = item.novelty >= 0.68 && item.quality >= 0.72 && hasEvidenceLanguage;
  const conceptual = CONCEPTUAL.test(text) && summary.length >= 110;
  const practical = PRACTICAL.test(text) && summary.length >= 100;
  const risks: FrontierEditorialRisk[] = [];

  // These flags describe *visible copy*, NOT fact-checking outcomes. A claim
  // must be checked at its publisher before labeling it objectively false.
  if (HYPE.test(text) && !hasEvidenceLanguage) risks.push('hype-without-specifics');
  if (SPECULATIVE.test(item.title) && !hasEvidenceLanguage) risks.push('speculative-wording');
  if (GOSSIP.test(text)) risks.push('celebrity-gossip');
  if (GENERIC_AI.test(item.title) && GENERIC_AI_PRODUCT.test(text)
      && !hasEvidenceLanguage && !conceptual) {
    risks.push('generic-ai-product-announcement');
  }
  if (summary.length < 125 && item.sourceKind !== 'github'
      && !['arxiv', 'biorxiv', 'medrxiv', 'openalex', 'openreview'].includes(item.sourceKind)) {
    risks.push('thin-description');
  }

  // Balanced novelty and practical value, with stronger conceptual reward.
  // Small enough that quality, source trust, explicit ratings and personal
  // topic affinities remain dominant. Negative patterns are demotions, not
  // automatic exclusion or assertions of inaccuracy.
  const bonus = (conceptual ? 0.044 : 0)
    + (practical ? 0.015 : 0)
    + (credibleNovelty ? 0.025 : 0);
  const penalties: Record<FrontierEditorialRisk, number> = {
    'hype-without-specifics': 0.13,
    'speculative-wording': 0.10,
    'generic-ai-product-announcement': 0.12,
    'celebrity-gossip': 0.17,
    'thin-description': 0.06,
  };
  const penalty = risks.reduce((sum, risk) => sum + penalties[risk], 0);
  return {
    conceptual, practical, credibleNovelty, risks,
    adjustment: Math.max(-0.26, Math.min(0.085, bonus - penalty)),
  };
}

/** Qualified exploration means a novel, well-sourced discovery outside Sid's
 * established topic radar. It is not a wildcard quota or a source-trust bypass. */
export function frontierQualifiedExploration(item: FrontierItem, personalTastePrior: number): boolean {
  if (item.sportsState || item.sourceKind === 'sports_state') return false;
  const signals = frontierEditorialTasteSignals(item);
  return personalTastePrior < 0.065
    && item.quality >= 0.76
    && item.novelty >= 0.7
    && item.summary.trim().length >= 120
    && !signals.risks.includes('hype-without-specifics')
    && !signals.risks.includes('speculative-wording')
    && !signals.risks.includes('generic-ai-product-announcement')
    && !signals.risks.includes('celebrity-gossip');
}
