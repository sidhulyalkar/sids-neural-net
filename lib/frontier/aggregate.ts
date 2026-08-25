import frontierSnapshot from '@/content/frontier/latest.json';
import { getActiveSportsFeed } from './activeSportsSources';
import { needsEnglishTranslation, normalizeFeedToEnglish } from './english';
import { getSharedExpandedPublicFeed } from './expandedSourcesShared';
import { getAdaptiveLiveDiscovery } from './liveDiscovery';
import { enrichFrontierMediaGeometry } from './media/geometry';
import { enrichFrontierSourceVisual } from './media/sourceVisuals';
import { getPersonalFrontierFeed } from './personalSources';
import { personalTasteRankingPrior, personalTasteTags } from './personalTaste';
import { getPersonalTasteFrontierFeed } from './personalTasteSources';
import { getScreenOrbitFeed } from './screenSources';
import { getSharedMultiSourceFrontierFeed } from './sourceIngestorShared';
import { getFrontierFeed } from './sources';
import { getSportsAnalyticsFeed } from './sportsAnalyticsSources';
import { getSportsClipFeed } from './sportsClipSources';
import { getSportsStateFeed } from './sportsStateSources';
import { vetFrontierItems } from './sourceTrust';
import { getToolingRadarFeed } from './toolingRadarSources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';
import { getVimeoStaffPicksFeed } from './vimeoSource';
import { getWatchableFrontierFeed } from './watchableSources';

const DAY_MS = 86_400_000;
const MAX_FUTURE_SKEW_MS = 12 * 60 * 60_000;
const REQUEST_ADAPTER_DEADLINE_MS = 2_400;
const MAX_INTEGRATED_CANDIDATES = 320;
const CANDIDATE_TASTE_WEIGHT = 0.55;

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

function isRightsFragileNflYoutube(item: FrontierItem): boolean {
  if (item.sourceKind !== 'youtube' && item.media?.type !== 'youtube') return false;
  const text = [item.title, item.summary, item.sourceLabel, ...item.tags].join(' ').toLowerCase();
  return /\bnfl\b|new england patriots|patriots/.test(text);
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

/**
 * Semantic enrichment is intentionally presentation-independent and runs before
 * candidate truncation. Otherwise a broad research flood can evict a smaller
 * NFL/fantasy/visualization/screen signal before the personalized recommender
 * sees it.
 */
export function enrichFrontierSemantics(entry: FrontierItem): FrontierItem {
  const tags = new Set(entry.tags);
  if (['openalex', 'arxiv', 'huggingface', 'paperswithcode', 'biorxiv', 'medrxiv', 'openreview'].includes(entry.sourceKind)) {
    tags.add('paper');
    tags.add('research');
  }
  if (entry.sourceKind === 'paperswithcode' || entry.sourceKind === 'github') tags.add('code');
  if (entry.sourceKind === 'lobsters') tags.add('thread');
  if (entry.sourceKind === 'nasa') tags.add('visual science');
  if (entry.sourceKind === 'vimeo' || entry.sourceKind === 'youtube') tags.add('video');
  if (entry.sourceKind === 'sports_state') tags.add('sports state');
  if (entry.lane === 'screen') tags.add('screen orbit');

  const tasteText = [entry.title, entry.summary, entry.sourceLabel, ...entry.tags].filter(Boolean).join(' ');
  for (const tag of personalTasteTags(tasteText)) tags.add(tag);

  return tags.size === entry.tags.length ? entry : { ...entry, tags: [...tags].slice(0, 14) };
}

/**
 * This is a bounded cold-start inventory prior, not final recommendation score.
 * Learned behavior still owns final ranking in scoring.ts. The server merely
 * prevents high-fit candidates from being deleted before that learner runs.
 */
export function frontierCandidatePriority(item: FrontierItem): number {
  return item.baseScore + personalTasteRankingPrior(item) * CANDIDATE_TASTE_WEIGHT;
}

function prepareCandidatePool(items: FrontierItem[]): FrontierItem[] {
  return vetFrontierItems(dedupe(
    items
      .filter((item) => isPlausibleFrontierCandidate(item) && !isRightsFragileNflYoutube(item))
      .map(enrichFrontierSemantics)
  ))
    .sort((a, b) => frontierCandidatePriority(b) - frontierCandidatePriority(a))
    .slice(0, MAX_INTEGRATED_CANDIDATES);
}

function enrichPresentation(entry: FrontierItem): FrontierItem {
  return enrichFrontierMediaGeometry(enrichFrontierSourceVisual(entry));
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
    if (!isPlausibleFrontierCandidate(item, now) || isRightsFragileNflYoutube(item)) return false;
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

/**
 * First-paint requests never make a second network hop merely to translate a
 * supplemental candidate. The daily archive builder still performs bounded
 * translation, while request-time foreign copy is omitted until a background
 * discovery pass can normalize it. This keeps the committed personalized
 * snapshot available as an immediate English fallback.
 */
export function requestTimeEnglishItems(items: FrontierItem[]): FrontierItem[] {
  return items.filter((item) => !needsEnglishTranslation(item.title) && !needsEnglishTranslation(item.summary));
}

export async function getIntegratedFrontierFeed(options: IntegratedOptions = {}): Promise<FrontierFeedResponse> {
  const focusTopics = Array.from(new Set((options.focusTopics ?? []).map((topic) => topic.trim()).filter(Boolean))).slice(0, 10);
  const deadline = options.adapterDeadlineMs ?? REQUEST_ADAPTER_DEADLINE_MS;
  const emptyAdaptive: FrontierFeedResponse = { generatedAt: new Date().toISOString(), items: [], sources: [] };

  // The explicit taste map affects every request through adaptive focus and
  // ranking. The deeper Brave taste crawl is intentionally different: it fans
  // out several targeted searches and belongs in the archive-building path,
  // never in the user's first-paint critical path. The snapshot builder is the
  // one caller that opts out of request deadlines (`adapterDeadlineMs: false`).
  const tasteDiscoveryTask = options.adapterDeadlineMs === false
    ? getPersonalTasteFrontierFeed()
    : Promise.resolve(emptyAdaptive);
  const deepScreenOrbit = options.adapterDeadlineMs === false;

  const [
    baseResult,
    personalResult,
    tasteResult,
    activeSportsResult,
    sportsStateResult,
    sportsAnalyticsResult,
    sportsClipResult,
    screenResult,
    watchableResult,
    toolingResult,
    adaptiveResult,
    multiSourceResult,
    expandedResult,
    vimeoResult,
  ] = await Promise.allSettled([
    withinAdapterDeadline('core mesh', getFrontierFeed(), deadline),
    withinAdapterDeadline('personal mesh', getPersonalFrontierFeed(), deadline),
    withinAdapterDeadline('personal taste mesh', tasteDiscoveryTask, deadline),
    withinAdapterDeadline('active sports mesh', getActiveSportsFeed(), deadline),
    withinAdapterDeadline('live sports state', getSportsStateFeed(), deadline),
    withinAdapterDeadline('sports analytics mesh', getSportsAnalyticsFeed(), deadline),
    withinAdapterDeadline('sports clip radar', getSportsClipFeed(), deadline),
    withinAdapterDeadline('Screen Orbit radar', getScreenOrbitFeed({ deep: deepScreenOrbit }), deadline),
    withinAdapterDeadline('watch radar', getWatchableFrontierFeed(), deadline),
    withinAdapterDeadline('visualization tooling radar', getToolingRadarFeed(), deadline),
    withinAdapterDeadline(
      'adaptive live mesh',
      focusTopics.length ? getAdaptiveLiveDiscovery(focusTopics) : Promise.resolve(emptyAdaptive),
      deadline,
    ),
    withinAdapterDeadline('research ingestion mesh', getSharedMultiSourceFrontierFeed(focusTopics), deadline),
    withinAdapterDeadline('expanded public mesh', getSharedExpandedPublicFeed(focusTopics), deadline),
    withinAdapterDeadline('Vimeo discovery', getVimeoStaffPicksFeed(), deadline),
  ]);

  // Utility sports state and focused personal discovery precede broad sources
  // for dedupe authority. Presentation enrichment remains after inventory
  // selection so a poster or video can never purchase a recommendation slot.
  const orderedResults = [
    sportsStateResult,
    sportsAnalyticsResult,
    sportsClipResult,
    screenResult,
    watchableResult,
    toolingResult,
    adaptiveResult,
    multiSourceResult,
    expandedResult,
    tasteResult,
    vimeoResult,
    baseResult,
    activeSportsResult,
    personalResult,
  ];
  const liveFeeds = orderedResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const rawLiveItems = prepareCandidatePool(liveFeeds.flatMap((feed) => feed.items));
  const liveItems = rawLiveItems.map(enrichPresentation);

  const liveKeys = new Set(liveItems.flatMap((item) => [canonicalKey(item), item.title.toLowerCase()]));
  const archive = options.includeSnapshot === false
    ? []
    : prepareCandidatePool(recentSnapshotItems()
        .filter((item) => !liveKeys.has(canonicalKey(item)) && !liveKeys.has(item.title.toLowerCase())))
        .map(enrichPresentation);

  const candidateItems = [...liveItems, ...archive].slice(0, MAX_INTEGRATED_CANDIDATES);
  const items = deadline === false
    ? await normalizeFeedToEnglish(candidateItems)
    : requestTimeEnglishItems(candidateItems);
  const sources = mergeStatuses(liveFeeds.flatMap((feed) => feed.sources));

  if (baseResult.status === 'rejected') sources.push({ id: 'local', label: 'Core mesh', ok: false, count: 0, message: 'core live source mesh unavailable' });
  if (personalResult.status === 'rejected') sources.push({ id: 'local', label: 'Personal mesh', ok: false, count: 0, message: 'personal live source mesh unavailable' });
  if (tasteResult.status === 'rejected') sources.push({ id: 'brave_web', label: 'Personal taste search', ok: false, count: 0, message: 'targeted personal taste discovery unavailable' });
  if (activeSportsResult.status === 'rejected') sources.push({ id: 'local', label: 'Active sports mesh', ok: false, count: 0, message: 'active sports source mesh unavailable' });
  if (sportsStateResult.status === 'rejected') sources.push({ id: 'sports_state', label: 'Live sports state', ok: false, count: 0, message: 'live sports state unavailable' });
  if (sportsAnalyticsResult.status === 'rejected') sources.push({ id: 'rss', label: 'Sports analytics radar', ok: false, count: 0, message: 'sports analytics source mesh unavailable' });
  if (sportsClipResult.status === 'rejected') sources.push({ id: 'social', label: 'Sports clip radar', ok: false, count: 0, message: 'sports clip discovery unavailable' });
  if (screenResult.status === 'rejected') sources.push({ id: 'rss', label: 'Screen Orbit radar', ok: false, count: 0, message: 'screen discovery unavailable' });
  if (watchableResult.status === 'rejected') sources.push({ id: 'youtube', label: 'Watch radar', ok: false, count: 0, message: 'watch radar unavailable' });
  if (toolingResult.status === 'rejected') sources.push({ id: 'github', label: 'Visualization tooling radar', ok: false, count: 0, message: 'visualization tooling radar unavailable' });
  if (adaptiveResult.status === 'rejected' && focusTopics.length) sources.push({ id: 'gdelt', label: 'Adaptive live mesh', ok: false, count: 0, message: 'focused request-time discovery unavailable' });
  if (multiSourceResult.status === 'rejected') sources.push({ id: 'local', label: 'Research ingestion mesh', ok: false, count: 0, message: 'multi-source ingestion unavailable' });
  if (expandedResult.status === 'rejected') sources.push({ id: 'local', label: 'Expanded public mesh', ok: false, count: 0, message: 'expanded public discovery unavailable' });
  if (vimeoResult.status === 'rejected') sources.push({ id: 'vimeo', label: 'Vimeo Staff Picks', ok: false, count: 0, message: 'Vimeo discovery unavailable' });

  return { generatedAt: new Date().toISOString(), items, sources: mergeStatuses(sources) };
}
