import { FrontierSourceIngestor } from './sourceIngestor';
import type { FrontierFeedResponse } from './types';

// Module lifetime is the correct scope for server-side source pacing. Creating a
// new limiter for every /api/frontier/feed request would reset upstream cooldowns
// and defeat the rate-limit contract under concurrent visitors.
const sharedSourceIngestor = new FrontierSourceIngestor();

export async function getSharedMultiSourceFrontierFeed(focusTopics: string[] = []): Promise<FrontierFeedResponse> {
  const query = Array.from(new Set(focusTopics.map((topic) => topic.trim()).filter(Boolean)))
    .slice(0, 3)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 160);

  return sharedSourceIngestor.ingestMany(
    ['arxiv', 'huggingface', 'github', 'paperswithcode', 'hackernews', 'rss'],
    { query, limit: query ? 8 : 12 }
  );
}
