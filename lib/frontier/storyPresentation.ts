import type { FrontierItem, FrontierMetric, FrontierSourceKind } from './types';

export type FrontierStoryFormat =
  | 'research' | 'repository' | 'video' | 'sports'
  | 'discussion' | 'game' | 'article';

export type FrontierMetricCategory = 'activity' | 'reported';
export type FrontierMetricSection = {
  kind: FrontierMetricCategory;
  title: string;
  metrics: FrontierMetric[];
};

export type FrontierStoryPresentation = {
  format: FrontierStoryFormat;
  summaryLabel: string;
  detailLabel: string;
  sourceActionLabel: string;
  sourceMetaLabel: string;
  metricSections: FrontierMetricSection[];
  evidenceLabel: string;
  sportsPriority: boolean;
  /** Editorial display strings based on known metadata, NOT factual synthesis. */
  evidenceNote?: string;
};

const RESEARCH = new Set<FrontierSourceKind>([
  'arxiv', 'openalex', 'biorxiv', 'medrxiv', 'openreview', 'paperswithcode', 'huggingface',
]);
const DISCUSSION = new Set<FrontierSourceKind>(['hackernews', 'lobsters', 'reddit', 'social']);
const PREPRINT = new Set<FrontierSourceKind>(['arxiv', 'biorxiv', 'medrxiv']);
const ACTIVITY_METRIC_LABELS = new Set([
  'stars', 'forks', 'watchers', 'issues', 'hf upvotes', 'upvotes',
  'citations', 'citation count', 'cited by',
  'points', 'score', 'comments', 'replies', 'likes',
  'views', 'subscribers',
]);
const SPORTS_METRIC_LABELS = new Set([
  'live', 'final', 'upcoming', 'scheduled', 'postponed',
]);

export function frontierStoryFormat(item: FrontierItem): FrontierStoryFormat {
  if (item.sportsState || item.sourceKind === 'sports_state') return 'sports';
  if (RESEARCH.has(item.sourceKind)) return 'research';
  if (item.sourceKind === 'github') return 'repository';
  if (item.sourceKind === 'youtube' || item.sourceKind === 'vimeo') return 'video';
  if (DISCUSSION.has(item.sourceKind)) return 'discussion';
  if (item.sourceKind === 'steam') return 'game';
  return 'article';
}

function normalizedMetricLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sourceMetricGroups(item: FrontierItem): FrontierMetricSection[] {
  const activity: FrontierMetric[] = [];
  const reported: FrontierMetric[] = [];
  for (const metric of (item.metrics ?? []).slice(0, 12)) {
    // Publisher-supplied metadata, not verified experimental outcomes. Avoid
    // interpreting citations, votes and Github stars as performance results.
    if (!metric.label?.trim() || !metric.value?.trim()) continue;
    const label = normalizedMetricLabel(metric.label);
    if (ACTIVITY_METRIC_LABELS.has(label) || SPORTS_METRIC_LABELS.has(label)) {
      activity.push(metric);
    } else {
      reported.push(metric);
    }
  }
  const groups: FrontierMetricSection[] = [];
  if (reported.length) groups.push({
    kind: 'reported',
    title: 'Numbers reported by the source',
    metrics: reported.slice(0, 6),
  });
  if (activity.length) groups.push({
    kind: 'activity',
    title: item.sportsState ? 'Schedule status' : item.sourceKind === 'github'
      ? 'Repository activity' : item.sourceKind === 'openalex'
        ? 'Citation activity' : 'Source activity',
    metrics: activity.slice(0, 6),
  });
  return groups;
}

/** No LLM, claim rewriting, synthetic findings or inferred editorial verdicts. */
export function buildFrontierStoryPresentation(item: FrontierItem): FrontierStoryPresentation {
  const format = frontierStoryFormat(item);
  const metricSections = sourceMetricGroups(item);
  const sections = {
    research: ['Abstract / source excerpt', 'More research context', 'Open research source', 'Research source'],
    repository: ['Repository description', 'More technical context', 'View repository', 'Repository'],
    video: ['Creator description', 'More creator context', 'Watch original', 'Creator'],
    sports: ['Source coverage', 'More source context', 'View score source', 'Scores / standings'],
    discussion: ['Linked discussion excerpt', 'More discussion context', 'Open discussion', 'Community'],
    game: ['Source description', 'More source context', 'View original', 'Game source'],
    article: ['Source overview', 'More source context', 'Read original', 'Publisher'],
  } as const;
  const [summaryLabel, detailLabel, defaultSourceActionLabel, sourceMetaLabel] = sections[format];
  const sourceActionLabel = item.sourceKind === 'openalex'
    ? 'Open research record' : defaultSourceActionLabel;
  let evidenceNote: string | undefined;
  if (PREPRINT.has(item.sourceKind)) {
    evidenceNote = 'Preprint source · peer review not established by this record';
  } else if (item.sourceKind === 'openalex') {
    evidenceNote = 'Research metadata record · inspect the original publication';
  } else if (format === 'video') {
    evidenceNote = 'Description supplied by the creator, not an independent transcript';
  } else if (format === 'discussion') {
    evidenceNote = 'Community activity is not independent verification';
  } else if (format === 'repository') {
    evidenceNote = 'Stars and forks indicate activity, not validated performance';
  }
  return {
    format, summaryLabel, detailLabel, sourceActionLabel, sourceMetaLabel,
    metricSections, evidenceLabel: format === 'sports' ? 'Source details' : 'Data & references',
    sportsPriority: format === 'sports' && Boolean(item.sportsState),
    ...(evidenceNote ? { evidenceNote } : {}),
  };
}
