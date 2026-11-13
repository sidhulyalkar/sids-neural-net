import type { FrontierItem, FrontierLaneId, FrontierMetric, FrontierSourceFigure } from './types';

export type JournalRealm = 'research' | 'neural' | 'systems' | 'nature' | 'motion' | 'culture';
export type JournalFormat = 'live' | 'measured' | 'visual' | 'technical' | 'brief';

const NEURAL_LANES: readonly FrontierLaneId[] = ['neuro_frontier'];
const SYSTEM_LANES: readonly FrontierLaneId[] = ['builder_signal', 'competitions', 'creative_tech'];
const MOTION_LANES: readonly FrontierLaneId[] = ['premier_league', 'world_soccer', 'team_pulse', 'sports'];
const CULTURE_LANES: readonly FrontierLaneId[] = ['gaming', 'screen', 'music', 'internet_culture'];
const NATURE_LANES: readonly FrontierLaneId[] = ['life', 'wildcards', 'world_pulse'];

export function journalRealm(item: Pick<FrontierItem, 'lane'>): JournalRealm {
  if (NEURAL_LANES.includes(item.lane)) return 'neural';
  if (SYSTEM_LANES.includes(item.lane)) return 'systems';
  if (MOTION_LANES.includes(item.lane)) return 'motion';
  if (CULTURE_LANES.includes(item.lane)) return 'culture';
  if (NATURE_LANES.includes(item.lane)) return 'nature';
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
  if (item.media?.type !== 'image') return figures;
  const original = item.media.url?.toLowerCase() ?? '';
  const isGenericCover = original.includes('opengraph.githubassets.com/')
    || original.includes('cdn-thumbnails.huggingface.co/social-thumbnails/');
  if (!isGenericCover) return figures;
  const cardUrl = item.media.proxyUrl || item.media.url;
  return figures.filter((figure) => figure.url !== cardUrl);
}

export function journalFormat(item: FrontierItem, hasSourceFigure: boolean): JournalFormat {
  if (item.sportsState) return 'live';
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
    : format === 'measured' ? 'What the source reports'
    : format === 'visual' ? 'The story in context'
    : format === 'technical' ? 'The technical brief'
    : 'The essential context';
  const evidenceLabel = format === 'live' ? 'Scores & standings'
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
