import type { FrontierItem, FrontierLaneId, FrontierMetric, FrontierSourceFigure } from './types';
import { journalMediaPlan } from './journalMedia';

export type JournalRealm = 'research' | 'neural' | 'behavior' | 'systems' | 'nature' | 'motion' | 'culture';
export type JournalFormat = 'live' | 'watch' | 'measured' | 'visual' | 'technical' | 'brief';

const NEURAL_LANES: readonly FrontierLaneId[] = ['neuro_frontier'];
const SYSTEM_LANES: readonly FrontierLaneId[] = ['builder_signal', 'competitions', 'creative_tech'];
const MOTION_LANES: readonly FrontierLaneId[] = ['premier_league', 'world_soccer', 'team_pulse', 'sports'];
const CULTURE_LANES: readonly FrontierLaneId[] = ['gaming', 'screen', 'music', 'internet_culture'];

/** Strong domain hints from actual source tags, not unverified semantic inferences.
 * In particular a wildcard is never automatically classified as nature. */
const BEHAVIOR_HINT = /(?:\banimal behavior\b|\bhuman behavior\b|\bbehavioral neuroscience\b|\bethology\b|\bbehavior(?:al)? tracking\b|\bpose estimation\b|\bbehavior(?:al)? quantification\b)/i;
const NEURAL_HINT = /(?:\bneuroscience\b|\bconnectomics\b|\belectrophysiology\b|\bneuropixels\b|\bneural decoding\b|\bneural dynamics\b|\bbrain.computer interface\b|\bbrain atlas\b|\bcalcium imaging\b|\beeg\b|\bfmri\b|\bspike sorting\b)/i;
const NATURE_HINT = /(?:\becology\b|\bbiodiversity\b|\bmarine biology\b|\bcoral\b|\breef\b|\bwildlife\b|\boceanography\b|\bconservation\b|\bnatural history\b|\bastronomy\b|\bspace science\b|\bnasa\b)/i;
const MOTION_HINT = /(?:\bsoccer\b|\bfootball\b|\bbasketball\b|\bskating\b|\bskiing\b|\bmountain biking\b|\bmtb\b|\bclimbing\b|\bbouldering\b|\btrail running\b|\bsurfing\b|\bcycling\b|\bsports\b)/i;
const CULTURE_HINT = /(?:\banime\b|\bmetroidvania\b|\bgaming\b|\bgame update\b|\bmovie\b|\bmusic discovery\b|\bbass music\b|\bdubstep\b)/i;

export function journalRealm(item: Pick<FrontierItem, 'lane'> & Partial<Pick<FrontierItem, 'tags' | 'sourceKind'>>): JournalRealm {
  const tags = (item.tags ?? []).join(' | ');
  if (BEHAVIOR_HINT.test(tags)) return 'behavior';
  if (NEURAL_LANES.includes(item.lane) || NEURAL_HINT.test(tags)) return 'neural';
  if (MOTION_LANES.includes(item.lane) || MOTION_HINT.test(tags)) return 'motion';
  if (CULTURE_LANES.includes(item.lane) || CULTURE_HINT.test(tags) || item.sourceKind === 'steam') return 'culture';
  if (NATURE_HINT.test(tags) || item.sourceKind === 'nasa' || item.lane === 'life') return 'nature';
  if (SYSTEM_LANES.includes(item.lane) || item.sourceKind === 'github') return 'systems';
  return 'research';
}

/** Popularity and platform counters are context, not experimental results.
 * A metrics badge must not make an article appear to contain quantitative findings. */
const ACTIVITY_LABEL = /^(?:hf\s*)?(?:stars?|forks?|points?|comments?|upvotes?|downvotes?|likes?|favorites?|watchers?|followers?|subscribers?|views?|citations?|downloads?|live|final|upcoming)$/i;

export function journalIsActivityMetric(metric: Pick<FrontierMetric, 'label'>): boolean {
  return ACTIVITY_LABEL.test(metric.label.trim().replace(/[_-]/g, ' '));
}

export function journalMeasuredMetrics(item: Pick<FrontierItem, 'metrics'>): FrontierMetric[] {
  return (item.metrics ?? []).filter((metric) => Boolean(metric.label.trim() && metric.value.trim()) && !journalIsActivityMetric(metric));
}

export function journalSourceActivity(item: Pick<FrontierItem, 'metrics'>): FrontierMetric[] {
  return (item.metrics ?? []).filter((metric) => Boolean(metric.label.trim() && metric.value.trim()) && journalIsActivityMetric(metric));
}

/** Skip auto-generated social cover cards, which often just reprint the title.
 * Real publisher figures are retained. This only affects the Journal hero. */
export function journalSourceFigures(item: FrontierItem, figures: FrontierSourceFigure[]): FrontierSourceFigure[] {
  let retained = figures;
  if (item.media?.type === 'image') {
    const original = item.media.url?.toLowerCase() ?? '';
    const isGenericCover = original.includes('opengraph.githubassets.com/')
      || original.includes('cdn-thumbnails.huggingface.co/social-thumbnails/');
    if (isGenericCover) {
      const cardUrl = item.media.proxyUrl || item.media.url;
      retained = retained.filter((figure) => figure.url !== cardUrl);
    }
  }
  // The existing image gateway provides a bounded same-origin path with a
  // source-original fallback. Only canonical arXiv paper figure URLs qualify;
  // unrelated publisher images never enter the expanded proxy allowlist.
  if (item.sourceKind !== 'arxiv') return retained;
  return retained.map((figure) => {
    try {
      const source = new URL(figure.url);
      if (source.protocol !== 'https:' || source.hostname !== 'arxiv.org'
        || !/^\/html\/\d{4}\.\d{4,5}(?:v\d+)?\//.test(source.pathname)
        || !/\.(?:png|jpe?g|webp)$/i.test(source.pathname)) return figure;
      const proxy = '/api/frontier/media?url=' + encodeURIComponent(source.href);
      return {
        ...figure,
        url: proxy,
        fallbackUrl: source.href,
        fallbackUrls: [...new Set([source.href, figure.fallbackUrl, ...(figure.fallbackUrls ?? [])]
          .filter((url): url is string => Boolean(url && url !== proxy)))],
      };
    } catch {
      return figure;
    }
  });
}

export function journalFormat(item: FrontierItem, hasSourceFigure: boolean): JournalFormat {
  if (item.sportsState) return 'live';
  if (journalMediaPlan(item)) return 'watch';
  if (journalMeasuredMetrics(item).length) return 'measured';
  if (hasSourceFigure) return 'visual';
  if (item.sourceKind === 'github' || item.artifacts?.some((artifact) => ['formula', 'benchmark', 'repository', 'release'].includes(artifact.kind))) {
    return 'technical';
  }
  return 'brief';
}

export type JournalPresentation = {
  realm: JournalRealm;
  format: JournalFormat;
  heading: string;
  kindLabel: string;
  evidenceLabel: string;
  hasEvidence: boolean;
};

export function journalPresentation(item: FrontierItem, hasSourceFigure: boolean): JournalPresentation {
  const realm = journalRealm(item);
  const format = journalFormat(item, hasSourceFigure);
  const kindLabel = item.sportsState ? 'Event data'
    : item.sourceKind === 'github' ? 'Code & engineering'
    : ['arxiv', 'biorxiv', 'medrxiv', 'openreview', 'openalex', 'paperswithcode'].includes(item.sourceKind) ? 'Research paper'
    : item.sourceKind === 'youtube' || item.sourceKind === 'vimeo' ? 'Visual report'
    : realm === 'motion' ? 'Sport & movement'
    : realm === 'culture' ? 'Culture & ideas'
    : 'Field report';
  const heading = format === 'live' ? 'The current picture'
    : format === 'watch' ? 'What the footage shows'
    : format === 'measured' ? 'What the source reports'
    : format === 'visual' ? 'The story in context'
    : format === 'technical' ? 'The technical brief'
    : 'The essential context';
  const evidenceLabel = format === 'live' ? 'Scores & standings'
    : format === 'watch' ? 'Original footage'
    : format === 'measured' ? 'Reported measurements'
    : format === 'visual' ? 'Source figures & evidence'
    : format === 'technical' ? 'Technical references'
    : 'Source references';
  const hasEvidence = Boolean(journalMeasuredMetrics(item).length || item.sportsState || item.artifacts?.length || item.convergence?.members.length);
  return { realm, format, heading, kindLabel, evidenceLabel, hasEvidence };
}

function normalizedTags(item: FrontierItem): Set<string> {
  return new Set(item.tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length >= 3));
}

/** Only display topic links backed by literal shared source tags. A next-in-edition
 * fallback should be labeled sequential, never described as semantically related. */
export function journalSharedTopics(item: FrontierItem, other: FrontierItem): string[] {
  const sourceTags = normalizedTags(item);
  return [...normalizedTags(other)].filter((tag) => sourceTags.has(tag)).slice(0, 3);
}

export function journalRelatedItems(item: FrontierItem, edition: FrontierItem[], limit = 3) {
  return edition.filter((other) => other.id !== item.id)
    .map((other) => ({ item: other, sharedTopics: journalSharedTopics(item, other) }))
    .filter((result) => result.sharedTopics.length > 0)
    .sort((a, b) => b.sharedTopics.length - a.sharedTopics.length)
    .slice(0, limit);
}
