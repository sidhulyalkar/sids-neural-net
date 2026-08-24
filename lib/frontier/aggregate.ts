import frontierSnapshot from '@/content/frontier/latest.json';
import { getActiveSportsFeed } from './activeSportsSources';
import { normalizeFeedToEnglish } from './english';
import { getSharedExpandedPublicFeed } from './expandedSourcesShared';
import { getAdaptiveLiveDiscovery } from './liveDiscovery';
import { enrichFrontierMediaGeometry } from './media/geometry';
import { enrichFrontierSourceVisual } from './media/sourceVisuals';
import { getPersonalFrontierFeed } from './personalSources';
import { getSharedMultiSourceFrontierFeed } from './sourceIngestorShared';
import { getFrontierFeed } from './sources';
import { vetFrontierItems } from './sourceTrust';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';
import { getVimeoStaffPicksFeed } from './vimeoSource';

const DAY_MS = 86_400_000;
const MAX_FUTURE_SKEW_MS = 12 * 60 * 60_000;
const REQUEST_ADAPTER_DEADLINE_MS = 4_500;
const MAX_INTEGRATED_CANDIDATES = 320;

type IntegratedOptions = {
  includeSnapshot?: boolean;
  focusTopics?: string[];
  /**
   * Request-time source meshes are supplemental and must not hold the reading
   * surface hostage to one upstream. Daily snapshot generation explicitly sets
   * this to false so it can wait for adapters' own transport deadlines.
   */
  adapterDeadlineMs?: number | false;
};

export function isPlausibleFrontierCandidate(item: FrontierItem, now = Date.now()): boolean {
  if (!item.title?.trim()) return false;

  const publishedAt = Date.parse(item.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt > now + MAX_FUTURE_SKEW_MS) return false;

  try {
    const url = new URL(item.url);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function canonicalKey(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) url.searchParams.delete(key);
    return url.toString().toLowerCase();
  } catch {
    return item.title.toLowerCase().replace(/\W+/g, ' ').trim();
  }
}

function dedupe(items: FrontierItem[]): FrontierItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const urlKey = canonicalKey(item);
    const titleKey = item.title.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(urlKey) || seen.has(titleKey)) return false;
    seen.add(urlKey);
    seen.add(titleKey);
    return true;
  });
}

function enrichFormatSemantics(entry: FrontierItem): FrontierItem {
  const tags = new Set(entry.tags);
  if (['openalex', 'arxiv', 'huggingface', 'paperswithcode', 'biorxiv', 'medrxiv', 'openreview'].includes(entry.sourceKind)) {
    tags.add('paper');
    tags.add('research');
  }
  if (entry.sourceKind === 'paperswithcode' || entry.sourceKind === 'github') tags.add('code');
  if (entry.sourceKind === 'lobsters') tags.add('thread');
  if (entry.sourceKind === 'nasa') tags.add('visual science');
  if (entry.sourceKind === 'vimeo') tags.add('video');
  return tags.size === entry.tags.length ? entry : { ...entry, tags: [...tags] };
}

function enrichPresentation(entry: FrontierItem): FrontierItem {
  return enrichFrontierMediaGeometry(enrichFrontierSourceVisual(enrichFormatSemantics(entry)));
}

function mergeStatuses(statuses: FrontierSourceStatus[]): FrontierSourceStatus[] {
  const merged = new Map<string, FrontierSourceStatus>();
  for (const status of statuses) {
    const previous = merged.get(status.id);
    if (!previous) {
      merged.set(status.id, status);
      continue;
    }
    merged.set(status.id, {
      id: status.id,
      label: previous.label === status.label ? status.label : `${previous.label} + ${status.label}`,
      ok: previous.ok || status.ok,
      count: previous.count + status.count,
      message: previous.ok || status.ok ? undefined : [previous.message, status.message].filter(Boolean).join(' · '),
    });
  }
  return Array.from(merged.values());
}

function recentSnapshotItems(): FrontierItem[] {
  const snapshot = frontierSnapshot as FrontierFeedResponse;
  const now = Date.now();
  return (snapshot.items ?? []).filter((item) => {
    if (!isPlausibleFrontierCandidate(item, now)) return false;
    const ageDays = (now - new Date(item.publishedAt).getTime()) / DAY_MS;
    return Number.isFinite(ageDays) && ageDays <= 10;
  });
}

async function withinAdapterDeadline<T>(
  label: string,
  task: Promise<T>,
  deadlineMs: number | false,
): Promise<T> {
  if (deadlineMs === false) return task;
  const boundedMs = Math.max(1_500, Math.min(15_000, deadlineMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} request budget exceeded after ${boundedMs}ms`)),
          boundedMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getIntegratedFrontierFeed(options: IntegratedOptions = {}): Promise<FrontierFeedResponse> {
  const focusTopics = Array.from(new Set((options.focusTopics ?? []).map((topic) => topic.trim()).filter(Boolean))).slice(0, 10);
  const deadline = options.adapterDeadlineMs ?? REQUEST_ADAPTER_DEADLINE_MS;
  const emptyAdaptive: FrontierFeedResponse = { generatedAt: new Date().toISOString(), items: [], sources: [] };

  const [baseResult, personalResult, activeSportsResult, adaptiveResult, multiSourceResult, expandedResult, vimeoResult] = await Promise.allSettled([
    withinAdapterDeadline('core mesh', getFrontierFeed(), deadline),
    withinAdapterDeadline('personal mesh', getPersonalFrontierFeed(), deadline),
    withinAdapterDeadline('active sports mesh', getActiveSportsFeed(), deadline),
    withinAdapterDeadline(
      'adaptive live mesh',
      focusTopics.length ? getAdaptiveLiveDiscovery(focusTopics) : Promise.resolve(emptyAdaptive),
      deadline,
    ),
    withinAdapterDeadline('research ingestion mesh', getSharedMultiSourceFrontierFeed(focusTopics), deadline),
    withinAdapterDeadline('expanded public mesh', getSharedExpandedPublicFeed(focusTopics), deadline),
    withinAdapterDeadline('Vimeo discovery', getVimeoStaffPicksFeed(), deadline),
  ]);

  // Focused discovery and research meshes intentionally precede broad sources.
  // When adapters converge on one URL, the richer request-time normalization
  // survives deduplication while weaker duplicates disappear. Reject malformed
  // candidates, apply destination-aware source vetting, and collapse duplicates
  // before presentation enrichment so neither novelty nor an aggregator can
  // promote an unvetted publisher into the candidate pool.
  const orderedResults = [adaptiveResult, multiSourceResult, expandedResult, vimeoResult, baseResult, activeSportsResult, personalResult];
  const liveFeeds = orderedResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const rawLiveItems = vetFrontierItems(dedupe(
    liveFeeds
      .flatMap((feed) => feed.items)
      .filter((item) => isPlausibleFrontierCandidate(item))
  ))
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, MAX_INTEGRATED_CANDIDATES);
  const liveItems = rawLiveItems.map(enrichPresentation);

  const liveKeys = new Set(liveItems.flatMap((item) => [canonicalKey(item), item.title.toLowerCase()]));
  const archive = options.includeSnapshot === false
    ? []
    : vetFrontierItems(recentSnapshotItems()
        .filter((item) => !liveKeys.has(canonicalKey(item)) && !liveKeys.has(item.title.toLowerCase())))
        .map(enrichPresentation);

  const candidateItems = [...liveItems, ...archive].slice(0, MAX_INTEGRATED_CANDIDATES);
  const items = await normalizeFeedToEnglish(candidateItems);
  const sources = mergeStatuses(liveFeeds.flatMap((feed) => feed.sources));

  if (baseResult.status === 'rejected') sources.push({ id: 'local', label: 'Core mesh', ok: false, count: 0, message: 'core live source mesh unavailable' });
  if (personalResult.status === 'rejected') sources.push({ id: 'local', label: 'Personal mesh', ok: false, count: 0, message: 'personal live source mesh unavailable' });
  if (activeSportsResult.status === 'rejected') sources.push({ id: 'local', label: 'Active sports mesh', ok: false, count: 0, message: 'active sports source mesh unavailable' });
  if (adaptiveResult.status === 'rejected' && focusTopics.length) sources.push({ id: 'gdelt', label: 'Adaptive live mesh', ok: false, count: 0, message: 'focused request-time discovery unavailable' });
  if (multiSourceResult.status === 'rejected') sources.push({ id: 'local', label: 'Research ingestion mesh', ok: false, count: 0, message: 'multi-source ingestion unavailable' });
  if (expandedResult.status === 'rejected') sources.push({ id: 'local', label: 'Expanded public mesh', ok: false, count: 0, message: 'expanded public discovery unavailable' });
  if (vimeoResult.status === 'rejected') sources.push({ id: 'vimeo', label: 'Vimeo Staff Picks', ok: false, count: 0, message: 'Vimeo discovery unavailable' });

  return { generatedAt: new Date().toISOString(), items, sources: mergeStatuses(sources) };
}
