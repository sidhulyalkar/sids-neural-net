import { cleanFrontierEditorialText } from './editorialQuality';
import type { FrontierItem } from './types';

/**
 * Evidence floor for the editorial surface, distinct from personalization and
 * upstream popularity/quality scores. High provider scores cannot turn a bare
 * link, an advertisement, or a generic description into an informative story.
 *
 * This is a deterministic content sufficiency check, NOT independent factual
 * verification. Primary-source cross-checking and editorial fact review are
 * separate obligations for consequential claims.
 */
export type FrontierEditorialAdmission = {
  admitted: boolean;
  reason:
    | 'structured-utility'
    | 'source-backed-detail'
    | 'specific-repository'
    | 'missing-title'
    | 'missing-substance'
    | 'generic-description'
    | 'promotional-copy'
    | 'unsupported-link-post';
};

const PROMOTIONAL_OPENING = /^(?:use (?:our|my) (?:code|link)|sponsored by|paid partnership|become a member|join (?:our|this|the) channel|subscribe(?: to)?|shop (?:our|the) merch|save \d{1,2}%|sign up for|click (?:here|the link)|support (?:us|at|on) patreon)\b/i;
const GENERIC_COPY = /^(?:recent(?:ly)? (?:substantive )?(?:development|update|open.source project)|worth (?:inspecting|checking) at the source|click (?:here|through) to (?:learn|read) more|read (?:the )?full (?:article|story)|no description (?:provided|available)|link only|watch (?:the )?full video)[^.!?]*[.!?]?$/i;
const URL = /https?:\/\/\S+/gi;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
const COMMUNITY = new Set(['hackernews', 'lobsters', 'reddit', 'social']);
const NEWS = new Set(['rss', 'brave_web', 'gdelt']);
const RESEARCH = new Set(['openalex', 'arxiv', 'biorxiv', 'medrxiv', 'openreview', 'paperswithcode', 'huggingface']);

function wordCount(value: string): number {
  return value.match(WORD)?.length ?? 0;
}

function meaningfulCopy(value: string): boolean {
  const words = value.toLowerCase().match(WORD) ?? [];
  const distinct = new Set(words.filter((word) => word.length >= 4));
  return distinct.size >= 5;
}

function rejected(reason: FrontierEditorialAdmission['reason']): FrontierEditorialAdmission {
  return { admitted: false, reason };
}

function admitted(reason: FrontierEditorialAdmission['reason']): FrontierEditorialAdmission {
  return { admitted: true, reason };
}

/**
 * Assess normalized source evidence, not the model's guess about the user's
 * interests. Short release notices can qualify on specific version/action
 * metadata, while community link-only posts must acquire a useful excerpt.
 */
export function assessFrontierEditorialAdmission(item: FrontierItem): FrontierEditorialAdmission {
  if (item.sportsState || item.sourceKind === 'sports_state') {
    return item.sportsState ? admitted('structured-utility') : rejected('missing-substance');
  }

  const title = item.title?.replace(/\s+/g, ' ').trim() ?? '';
  if (title.length < 8 || wordCount(title) < 2) return rejected('missing-title');

  const summary = cleanFrontierEditorialText(item.summary ?? '', item.sourceKind)
    .replace(/\s+/g, ' ').trim();
  if (!summary) return rejected('missing-substance');
  if (PROMOTIONAL_OPENING.test(summary)) return rejected('promotional-copy');

  // Multiple outbound links taking over a brief indicate the description was
  // not editorial copy. Never publish these as evidence-bearing analysis.
  const links = summary.match(URL)?.length ?? 0;
  if (links >= 2 && links * 35 > summary.length) return rejected('promotional-copy');
  if (GENERIC_COPY.test(summary)) return rejected('generic-description');

  if (COMMUNITY.has(item.sourceKind)) {
    return summary.length >= 80 && wordCount(summary) >= 12 && meaningfulCopy(summary)
      ? admitted('source-backed-detail') : rejected('unsupported-link-post');
  }

  if (item.sourceKind === 'youtube' || item.sourceKind === 'vimeo') {
    return summary.length >= 90 && wordCount(summary) >= 13 && meaningfulCopy(summary)
      ? admitted('source-backed-detail') : rejected('missing-substance');
  }

  if (NEWS.has(item.sourceKind)) {
    return summary.length >= 70 && wordCount(summary) >= 10 && meaningfulCopy(summary)
      ? admitted('source-backed-detail') : rejected('missing-substance');
  }

  if (item.sourceKind === 'github') {
    // A specific release/commit or a real project description can be short;
    // neither stars nor the source's preassigned score count as evidence.
    const versionOrChange = /(?:\bv?\d+\.\d+(?:\.\d+)?\b|\b(?:release|fix|add|introduce|support|implement|benchmark)\b)/i.test(title);
    const substantiveSummary = summary.length >= 42 && wordCount(summary) >= 7 && meaningfulCopy(summary);
    const conciseProject = summary.length >= 28 && wordCount(summary) >= 5
      && meaningfulCopy(summary) && /\//.test(title);
    return substantiveSummary || conciseProject || (versionOrChange && summary.length >= 35 && wordCount(summary) >= 6 && meaningfulCopy(summary))
      ? admitted('specific-repository') : rejected('missing-substance');
  }

  if (RESEARCH.has(item.sourceKind)) {
    return summary.length >= 70 && wordCount(summary) >= 11 && meaningfulCopy(summary)
      ? admitted('source-backed-detail') : rejected('missing-substance');
  }

  return summary.length >= 55 && wordCount(summary) >= 9 && meaningfulCopy(summary)
    ? admitted('source-backed-detail') : rejected('missing-substance');
}

export function isFrontierEditoriallyQualified(item: FrontierItem): boolean {
  return assessFrontierEditorialAdmission(item).admitted;
}
