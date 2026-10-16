import { frontierRssMediaForUrl, frontierRssSourceMedia } from './media/rssSourceMedia';
import { dedupeIngestedItems, FrontierSourceIngestor, parseRss } from './sourceIngestor';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

// Module lifetime is the correct scope for server-side source pacing. Creating a
// new limiter for every /api/frontier/feed request would reset upstream cooldowns
// and defeat the rate-limit contract under concurrent visitors.
const sharedSourceIngestor = new FrontierSourceIngestor();
const RSS_TIMEOUT_MS = 4_000;
const RSS_USER_AGENT = 'sids-neural-net-frontier/3.1 (+https://sidhulyalkar.com/frontier)';

function configuredRssFeeds(): string[] {
  const configured = (process.env.FRONTIER_TARGET_RSS_FEEDS || process.env.FRONTIER_RSS_FEEDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set([
    'https://github.blog/feed/',
    'https://www.theguardian.com/football/rss',
    ...configured,
  ])).slice(0, 10);
}

async function fetchRssText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': RSS_USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: controller.signal,
      next: { revalidate: 60 * 15 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function visualRssFeed(limit: number): Promise<FrontierFeedResponse> {
  const feeds = configuredRssFeeds();
  const results = await Promise.allSettled(feeds.map(async (feedUrl) => {
    const xml = await fetchRssText(feedUrl);
    const media = frontierRssSourceMedia(xml);
    return parseRss(xml, feedUrl).map((entry) => {
      const sourceMedia = frontierRssMediaForUrl(media, entry.url);
      return sourceMedia ? { ...entry, media: sourceMedia } : entry;
    });
  }));

  const fulfilled = results.filter((result): result is PromiseFulfilledResult<FrontierItem[]> => result.status === 'fulfilled');
  const items = fulfilled
    .flatMap((result) => result.value)
    .sort((left, right) => right.baseScore - left.baseScore)
    .slice(0, limit);
  const status: FrontierSourceStatus = {
    id: 'rss',
    label: 'Targeted RSS',
    ok: fulfilled.length > 0,
    count: items.length,
    message: fulfilled.length > 0 ? undefined : 'targeted RSS sources unavailable',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}

export async function getSharedMultiSourceFrontierFeed(focusTopics: string[] = []): Promise<FrontierFeedResponse> {
  const query = Array.from(new Set(focusTopics.map((topic) => topic.trim()).filter(Boolean)))
    .slice(0, 3)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  const limit = query ? 8 : 12;

  // Keep RSS out of the generic ingestor here so it is fetched exactly once.
  // `visualRssFeed` delegates semantic normalization to the same exported
  // parseRss() function and only attaches source-carried media afterward.
  const [research, rss] = await Promise.all([
    sharedSourceIngestor.ingestMany(
      ['arxiv', 'huggingface', 'github', 'paperswithcode', 'hackernews'],
      { query, limit },
    ),
    visualRssFeed(limit),
  ]);

  // Splitting RSS into its own media-enrichment fetch must not weaken the old
  // ingestMany contract: duplicates are still removed across every source by
  // canonical URL and normalized title before the final score sort.
  return {
    generatedAt: new Date().toISOString(),
    items: dedupeIngestedItems([...research.items, ...rss.items])
      .sort((left, right) => right.baseScore - left.baseScore)
      .slice(0, 120),
    sources: [...research.sources, ...rss.sources],
  };
}
