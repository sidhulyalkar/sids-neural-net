import { getExpandedPublicFeed } from './expandedSources';
import type { FrontierFeedResponse } from './types';

const CACHE_TTL_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 12;

type CacheEntry = {
  createdAt: number;
  value: FrontierFeedResponse;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<FrontierFeedResponse>>();

function focusKey(topics: string[]): string {
  return Array.from(new Set(topics.map((topic) => topic.trim().toLowerCase()).filter(Boolean)))
    .slice(0, 8)
    .sort()
    .join('|');
}

function trimCache(): void {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...cache.entries()]
    .sort((left, right) => left[1].createdAt - right[1].createdAt)
    .slice(0, cache.size - MAX_CACHE_ENTRIES);
  for (const [key] of oldest) cache.delete(key);
}

/**
 * De-duplicates concurrent requests and keeps a very short in-process cache.
 * Two minutes is long enough to protect public upstreams from bursts while
 * remaining much fresher than FRONTIER's four-minute browser refresh cadence.
 */
export async function getSharedExpandedPublicFeed(topics: string[] = []): Promise<FrontierFeedResponse> {
  const key = focusKey(topics);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CACHE_TTL_MS) return existing.value;

  const active = inflight.get(key);
  if (active) return active;

  const request = getExpandedPublicFeed(topics)
    .then((value) => {
      cache.set(key, { createdAt: Date.now(), value });
      trimCache();
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}
