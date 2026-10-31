import { unstable_cache } from 'next/cache';
import {
  FRONTIER_FOCUSED_TTL_SECONDS,
  FRONTIER_SHARED_LATEST_TTL_SECONDS,
  frontierHasUsableRecentFeed,
  frontierRecentItems,
} from './liveFeedPolicy';
import type { FrontierObservableFeedResponse } from './pipelineDiagnostics';

/**
 * Next's shared Data/Runtime Cache survives across requests and deployments.
 * Keep it entirely public: no browser profile, cookies, ratings or history
 * enter cache keys or cached values. Persist validated results, never adapter
 * failures or a synthetic "fresh" timestamp masking stale stories.
 */
const cachedLatest = unstable_cache(
  async (): Promise<FrontierObservableFeedResponse> => {
    const { getIntegratedFrontierFeed } = await import('./aggregate');
    const feed = await getIntegratedFrontierFeed({
      includeSnapshot: false,
      adapterDeadlineMs: 3_500,
      pipelineMode: 'fresh-live',
    });
    if (!frontierHasUsableRecentFeed(feed)) {
      throw new Error('Recent discovery insufficient; preserving the last usable edition.');
    }
    return { ...feed, items: frontierRecentItems(feed.items) };
  },
  ['frontier-shared-latest-v1'],
  { revalidate: FRONTIER_SHARED_LATEST_TTL_SECONDS, tags: ['frontier-shared-latest'] },
);

const cachedFocused = unstable_cache(
  async (topics: string[]): Promise<FrontierObservableFeedResponse> => {
    const { getIntegratedFrontierFeed } = await import('./aggregate');
    const feed = await getIntegratedFrontierFeed({
      focusTopics: topics,
      includeSnapshot: false,
      adapterDeadlineMs: 4_000,
      pipelineMode: 'focused-live',
    });
    // A 0-result outage must not become a cached 5-minute dead end.
    const items = frontierRecentItems(feed.items);
    if (items.length < 1) throw new Error('Focused source discovery returned no valid recent articles.');
    return { ...feed, items };
  },
  ['frontier-shared-focus-v1'],
  { revalidate: FRONTIER_FOCUSED_TTL_SECONDS, tags: ['frontier-shared-focus'] },
);

export async function getCachedFrontierLatestFeed(): Promise<FrontierObservableFeedResponse> {
  return cachedLatest();
}

export async function getCachedFrontierFocusedFeed(topics: string[]): Promise<FrontierObservableFeedResponse> {
  return cachedFocused(topics);
}
