import frontierSnapshot from '@/content/frontier/latest.json';
import { getActiveSportsFeed } from './activeSportsSources';
import { getPersonalFrontierFeed } from './personalSources';
import { getFrontierFeed } from './sources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const DAY_MS = 86_400_000;

type IntegratedOptions = {
  includeSnapshot?: boolean;
};

function canonicalKey(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) {
      url.searchParams.delete(key);
    }
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

export async function getIntegratedFrontierFeed(
  options: IntegratedOptions = {}
): Promise<FrontierFeedResponse> {
  const [baseResult, personalResult, activeSportsResult] = await Promise.allSettled([
    getFrontierFeed(),
    getPersonalFrontierFeed(),
    getActiveSportsFeed(),
  ]);

  const liveFeeds = [baseResult, personalResult, activeSportsResult].flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );
  const liveItems = dedupe(liveFeeds.flatMap((feed) => feed.items))
    .sort((a, b) => b.baseScore - a.baseScore);

  const liveKeys = new Set(liveItems.flatMap((item) => [canonicalKey(item), item.title.toLowerCase()]));
  const archive = options.includeSnapshot === false
    ? []
    : recentSnapshotItems().filter((item) =>
        !liveKeys.has(canonicalKey(item)) && !liveKeys.has(item.title.toLowerCase())
      );

  const items = [...liveItems, ...archive]
    .slice(0, 180);

  const sources = mergeStatuses(liveFeeds.flatMap((feed) => feed.sources));
  if (baseResult.status === 'rejected') {
    sources.push({ id: 'local', label: 'Core mesh', ok: false, count: 0, message: 'core live source mesh unavailable' });
  }
  if (personalResult.status === 'rejected') {
    sources.push({ id: 'local', label: 'Personal mesh', ok: false, count: 0, message: 'personal live source mesh unavailable' });
  }
  if (activeSportsResult.status === 'rejected') {
    sources.push({ id: 'local', label: 'Active sports mesh', ok: false, count: 0, message: 'active sports source mesh unavailable' });
  }

  return {
    generatedAt: new Date().toISOString(),
    items,
    sources: mergeStatuses(sources),
  };
}
