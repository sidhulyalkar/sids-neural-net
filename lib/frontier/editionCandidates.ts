import { frontierInformationValue } from './informativeEdition';
import { isFrontierUtilityItem } from './adaptiveSlate';
import type { FrontierItem } from './types';

/**
 * Build the PUBLIC, cold-start 36-item transport pool from the entire
 * admitted snapshot. This does not perform personalized ranking: the client
 * still applies the existing learned scorer and diverse slate policy.
 *
 * Without this pass, slicing the source-ordered snapshot before ranking
 * excludes all the research papers clustered after the first 36 entries.
 */
export type EditionChannel = 'papers' | 'building' | 'sports' | 'culture' | 'nature' | 'discover';

const PAPER_SOURCES = new Set(['arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode', 'huggingface']);
const SPORTS_LANES = new Set(['sports', 'premier_league', 'world_soccer', 'team_pulse']);
const CULTURE_LANES = new Set(['screen', 'gaming', 'music', 'internet_culture']);

export function frontierEditionChannel(item: FrontierItem): EditionChannel {
  if (PAPER_SOURCES.has(item.sourceKind)) return 'papers';
  if (isFrontierUtilityItem(item) || SPORTS_LANES.has(item.lane)) return 'sports';
  if (CULTURE_LANES.has(item.lane)) return 'culture';
  if (item.sourceKind === 'nasa' ||
    item.tags.some((tag) => /ecology|wildlife|marine|biodiversity|conservation|earth observation|nature/i.test(tag)))
    return 'nature';
  if (item.sourceKind === 'github' || ['methods', 'builder_signal', 'creative_tech', 'competitions'].includes(item.lane))
    return 'building';
  return 'discover';
}

function editorialValue(item: FrontierItem, index: number, total: number): number {
  const cleanLength = (item.summary ?? '').replace(/\s+/g, ' ').trim().length;
  const context = Math.min(1, cleanLength / 300);
  const thin = /^(?:Recent substantive development in |Open the original source|Sign up for|Subscribe to)/i.test(item.summary)
    || /^(?:Sign up for|Subscribe to|Newsletter:)/i.test(item.title);
  return frontierInformationValue(item).value * .52 +
    Math.min(1, Math.max(0, item.quality)) * .14 +
    Math.min(1, Math.max(0, item.importance)) * .12 +
    Math.min(1, Math.max(0, item.novelty)) * .08 +
    context * .11 +
    (1 - index / Math.max(1, total)) * .03 -
    (thin ? .25 : 0) -
    (cleanLength < 55 && !isFrontierUtilityItem(item) ? .13 : 0);
}

function sourceKey(item: FrontierItem): string {
  try {
    const parsed = new URL(item.url);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    // Research archives hold many independent papers; the publisher host
    // should not count as one author or editorial desk for diversity.
    if (PAPER_SOURCES.has(item.sourceKind)) return `${item.sourceKind}:${host}`;
    if (host === 'github.com') return `github:${parsed.pathname.split('/').filter(Boolean)[0] ?? 'unknown'}`;
    return host;
  } catch { return item.sourceKind; }
}

export function buildFrontierEditionCandidates(items: FrontierItem[], limit = 36): FrontierItem[] {
  const bounded = Math.max(0, Math.floor(limit));
  if (!bounded || !items.length) return [];
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const buckets: Record<EditionChannel, FrontierItem[]> = {
    papers: [], building: [], sports: [], culture: [], nature: [], discover: [],
  };
  const scores = new Map<string, number>();
  unique.forEach((item, index) => {
    scores.set(item.id, editorialValue(item, index, unique.length));
    buckets[frontierEditionChannel(item)].push(item);
  });
  for (const group of Object.values(buckets))
    group.sort((a,b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));

  // These are bounded acquisition opportunities, not permanent topic quotas
  // or a substitute for the personalized ranking and slate policy.
  const allocation: Record<EditionChannel, number> = {
    papers: Math.max(2, Math.round(bounded * .27)),
    building: Math.round(bounded * .20),
    sports: Math.round(bounded * .19),
    culture: Math.round(bounded * .11),
    nature: Math.round(bounded * .06),
    discover: Math.round(bounded * .17),
  };
  const output: FrontierItem[] = [];
  const picked = new Set<string>();
  const perSource = new Map<string, number>();
  const attempt = (item: FrontierItem) => {
    if (picked.has(item.id) || output.length >= bounded) return false;
    const key = sourceKey(item);
    const cap = PAPER_SOURCES.has(item.sourceKind) ? 7 : 4;
    if ((perSource.get(key) ?? 0) >= cap) return false;
    picked.add(item.id);
    perSource.set(key, (perSource.get(key) ?? 0) + 1);
    output.push(item);
    return true;
  };
  for (const channel of ['papers','building','sports','culture','nature','discover'] as const) {
    for (const candidate of buckets[channel]) {
      if ((output.filter((item) => frontierEditionChannel(item) === channel)).length >= allocation[channel]) break;
      attempt(candidate);
    }
  }
  const remaining = unique
    .filter((item) => !picked.has(item.id))
    .sort((a,b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  for (const candidate of remaining) attempt(candidate);
  return output;
}

/**
 * The slate selector intentionally reserves sports utility near the top, but
 * the publication's visual lead is an actual substantive article. Reposition,
 * don't remove, the utility entry. Papers with sufficient primary-source text
 * are preferred; otherwise preserve the normal list order.
 */
export function featureFrontierEditionStory(items: FrontierItem[]): FrontierItem[] {
  if (items.length < 2) return items;
  const paper = items.findIndex((item) =>
    PAPER_SOURCES.has(item.sourceKind) &&
    (item.summary?.trim().length ?? 0) >= 200 &&
    frontierInformationValue(item).value >= .35
  );
  const first = paper >= 0 ? paper : items.findIndex((item) =>
    !isFrontierUtilityItem(item) && (item.summary?.trim().length ?? 0) >= 160
  );
  if (first <= 0) return items;
  return [items[first], ...items.slice(0, first), ...items.slice(first+1)];
}
