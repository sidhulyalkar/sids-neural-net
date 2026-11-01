import type { FrontierFeedResponse, FrontierItem } from './types';

export const FRONTIER_SHARED_LATEST_TTL_SECONDS = 10 * 60;
export const FRONTIER_FOCUSED_TTL_SECONDS = 5 * 60;
export const FRONTIER_RECHECK_AFTER_MS = 30 * 60_000;
export const FRONTIER_MAX_LATEST_ITEMS = 144;
const MAX_AGE_MS = 10 * 24 * 60 * 60_000;
const RECENT_AGE_MS = 72 * 60 * 60_000;

export function frontierShouldCheckLatest(generatedAt: string, now = Date.now()): boolean {
  const at = Date.parse(generatedAt);
  return !Number.isFinite(at) || now - at > FRONTIER_RECHECK_AFTER_MS || at > now + 60_000;
}

export function frontierRecentItems(items: FrontierItem[], now = Date.now()): FrontierItem[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const output: FrontierItem[] = [];
  for (const item of items) {
    const published = Date.parse(item.publishedAt);
    if (!Number.isFinite(published) || published > now + 12 * 60 * 60_000 || now - published > MAX_AGE_MS) continue;
    if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url) || !item.title?.trim()) continue;
    let key: string;
    try {
      const url = new URL(item.url);
      url.hash = '';
      for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) url.searchParams.delete(name);
      key = url.toString().toLowerCase();
    } catch { continue; }
    if (seenIds.has(item.id) || seenUrls.has(key)) continue;
    seenIds.add(item.id);
    seenUrls.add(key);
    output.push(item);
    if (output.length >= FRONTIER_MAX_LATEST_ITEMS) break;
  }
  return output;
}

/**
 * A failed source sweep must never poison a shared cache or replace an
 * otherwise usable edition. A limited live result is valid only if at least
 * one article is actually recent, rather than an old source with a new fetch
 * timestamp.
 */
export function frontierHasUsableRecentFeed(feed: FrontierFeedResponse, now = Date.now()): boolean {
  const items = frontierRecentItems(feed.items, now);
  if (items.length < 8) return false;
  // A rapidly changing sports scoreboard is not proof that the research/news
  // discovery layer succeeded. Require three independently dated editorial
  // items across at least two source kinds before replacing the shared edition.
  const freshEditorial = items.filter((item) => {
    if (item.sourceKind === 'sports_state' || item.sportsState) return false;
    const published = Date.parse(item.publishedAt);
    return Number.isFinite(published) && published <= now
      && now - published <= RECENT_AGE_MS;
  });
  return freshEditorial.length >= 3
    && new Set(freshEditorial.map((item) => item.sourceKind)).size >= 2;
}

/** Protect a reader's place: no benefit in announcing a new edition with the same items. */
export function frontierHasNewStories(currentIds: readonly string[], candidateIds: readonly string[]): boolean {
  const old = new Set(currentIds);
  return candidateIds.some((id) => !old.has(id));
}


// Only stable, generic public subjects can become shared-cache keys. Arbitrary
// user-entered phrases stay uncached to avoid persisting sensitive search text
// and to bound cache cardinality on an unauthenticated public site.
const SHARED_PUBLIC_TOPICS = new Set([
  'ai', 'artificial intelligence', 'machine learning', 'large language models',
  'neuroscience', 'neuroai', 'neuroai neuroscience', 'bci', 'brain computer interface',
  'brain-computer interface', 'computer vision', 'robotics', 'bioengineering',
  'open source', 'open source machine learning', 'research', 'scientific visualization',
  'sports analytics', 'soccer', 'football', 'nfl', 'nba', 'gaming', 'music',
  'skateboarding', 'mountain biking', 'rock climbing', 'wearables',
]);

export function frontierIsSharedPublicFocus(topics: readonly string[]): boolean {
  return topics.length === 1 && SHARED_PUBLIC_TOPICS.has(topics[0]?.trim().toLowerCase() || '');
}
