import frontierSnapshot from '@/content/frontier/latest.json';
import { getActiveSportsFeed } from './activeSportsSources';
import { normalizeFeedToEnglish } from './english';
import { getAdaptiveLiveDiscovery } from './liveDiscovery';
import { getPersonalFrontierFeed } from './personalSources';
import { getMultiSourceFrontierFeed } from './sourceIngestor';
import { getFrontierFeed } from './sources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const DAY_MS = 86_400_000;

type IntegratedOptions = {
  includeSnapshot?: boolean;
  focusTopics?: string[];
};

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
    const ageDays = (now - new Date(item.publishedAt).getTime()) / DAY_MS;
    return Number.isFinite(ageDays) && ageDays <= 10;
  });
}

export async function getIntegratedFrontierFeed(options: IntegratedOptions = {}): Promise<FrontierFeedResponse> {
  const focusTopics = Array.from(new Set((options.focusTopics ?? []).map((topic) => topic.trim()).filter(Boolean))).slice(0, 10);
  const [baseResult, personalResult, activeSportsResult, adaptiveResult, multiSourceResult] = await Promise.allSettled([
    getFrontierFeed(),
    getPersonalFrontierFeed(),
    getActiveSportsFeed(),
    focusTopics.length ? getAdaptiveLiveDiscovery(focusTopics) : Promise.resolve({ generatedAt: new Date().toISOString(), items: [], sources: [] }),
    getMultiSourceFrontierFeed(focusTopics),
  ]);

  // Focused discovery and the multi-source research/code mesh intentionally
  // precede broad sources. If adapters converge on the same URL, the richer
  // request-time normalization survives deduplication.
  const orderedResults = [adaptiveResult, multiSourceResult, baseResult, activeSportsResult, personalResult];
  const liveFeeds = orderedResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const liveItems = dedupe(liveFeeds.flatMap((feed) => feed.items)).sort((a, b) => b.baseScore - a.baseScore);

  const liveKeys = new Set(liveItems.flatMap((item) => [canonicalKey(item), item.title.toLowerCase()]));
  const archive = options.includeSnapshot === false
    ? []
    : recentSnapshotItems().filter((item) => !liveKeys.has(canonicalKey(item)) && !liveKeys.has(item.title.toLowerCase()));

  const candidateItems = [...liveItems, ...archive].slice(0, 280);
  const items = await normalizeFeedToEnglish(candidateItems);
  const sources = mergeStatuses(liveFeeds.flatMap((feed) => feed.sources));

  if (baseResult.status === 'rejected') sources.push({ id: 'local', label: 'Core mesh', ok: false, count: 0, message: 'core live source mesh unavailable' });
  if (personalResult.status === 'rejected') sources.push({ id: 'local', label: 'Personal mesh', ok: false, count: 0, message: 'personal live source mesh unavailable' });
  if (activeSportsResult.status === 'rejected') sources.push({ id: 'local', label: 'Active sports mesh', ok: false, count: 0, message: 'active sports source mesh unavailable' });
  if (adaptiveResult.status === 'rejected' && focusTopics.length) sources.push({ id: 'gdelt', label: 'Adaptive live mesh', ok: false, count: 0, message: 'focused request-time discovery unavailable' });
  if (multiSourceResult.status === 'rejected') sources.push({ id: 'local', label: 'Research ingestion mesh', ok: false, count: 0, message: 'multi-source ingestion unavailable' });

  return { generatedAt: new Date().toISOString(), items, sources: mergeStatuses(sources) };
}
