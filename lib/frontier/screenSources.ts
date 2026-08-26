import {
  matchedScreenFavorites,
  screenFavoriteDiscoveryBundles,
  screenTastePrior,
  screenTasteTags,
} from './screenTaste';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-screen-orbit/1.1 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;
const REQUEST_QUERY_TIMEOUT_MS = 3_200;
const DEEP_QUERY_TIMEOUT_MS = 6_500;
const PUBLISHER_MAX_AGE_DAYS = 21;

type ScreenQuery = {
  id: string;
  label: string;
  query: string;
  tags: string[];
  weight: number;
};

type ScreenPublisherFeed = {
  id: string;
  label: string;
  url: string;
  destinationDomains: readonly string[];
  tags: readonly string[];
  quality: number;
};

const SCREEN_PUBLISHER_FEEDS: readonly ScreenPublisherFeed[] = [
  {
    id: 'crunchyroll',
    label: 'Crunchyroll News',
    url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss',
    destinationDomains: ['crunchyroll.com'],
    tags: ['screen orbit', 'anime', 'primary anime news'],
    quality: 0.84,
  },
  {
    id: 'ann',
    label: 'Anime News Network',
    url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us',
    destinationDomains: ['animenewsnetwork.com'],
    tags: ['screen orbit', 'anime', 'anime news'],
    quality: 0.78,
  },
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanText(value: string | undefined): string {
  return (value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return cleanText(match?.[1]);
}

function xmlTagAttribute(block: string, tag: string, attribute: string): string {
  const opening = block.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '';
  return cleanText(opening.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]);
}

function host(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function hostMatches(hostname: string, domains: readonly string[]): boolean {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function summarize(value: string, maxLength = 300): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 180 ? boundary : maxLength).trim()}…`;
}

function ageDays(publishedAt: string, now = Date.now()): number {
  return Math.max(0, (now - Date.parse(publishedAt)) / DAY_MS);
}

function quotedBundle(titles: string[]): string {
  return titles.map((title) => `"${title.replace(/"/g, '')}"`).join(' OR ');
}

export function screenDiscoveryQueries(dayKey = new Date().toISOString().slice(0, 10), deep = false): ScreenQuery[] {
  const rotating = screenFavoriteDiscoveryBundles(dayKey, deep ? 4 : 2, 5).map((titles, index): ScreenQuery => ({
    id: `favorites-${index}`,
    label: 'Favorite-title pulse',
    query: `(${quotedBundle(titles)}) anime TV season trailer renewal premiere release`,
    tags: ['screen orbit'],
    weight: 1,
  }));

  const anchors: ScreenQuery[] = [
    {
      id: 'story-anime',
      label: 'Story-rich anime',
      query: 'anime dark fantasy action mystery psychological worldbuilding new season trailer renewal premiere Crunchyroll Netflix',
      tags: ['screen orbit', 'anime', 'story rich', 'strong worldbuilding'],
      weight: 0.94,
    },
    {
      id: 'dark-comedy',
      label: 'Witty dark comedy',
      query: 'dark comedy adult animation animated satire absurdist comedy TV series renewal trailer premiere',
      tags: ['screen orbit', 'witty dark comedy', 'animated dark comedy'],
      weight: 0.9,
    },
  ];

  return [...anchors, ...rotating];
}

export function parseScreenNewsRss(xml: string, spec: ScreenQuery, now = Date.now()): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 8).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url) return [];
    const publishedRaw = xmlTag(block, 'pubDate');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date(now).toISOString()
      : new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt, now) > 16) return [];

    const sourceLabel = xmlTag(block, 'source') || 'Screen Orbit';
    const publisherUrl = xmlTagAttribute(block, 'source', 'url');
    const source = host(publisherUrl) || 'news.google.com';
    const summary = summarize(xmlTag(block, 'description') || `${spec.label} update.`);
    const evidenceText = `${title} ${summary} ${sourceLabel}`;
    const evidenceTags = screenTasteTags(evidenceText);
    const exactFavorite = matchedScreenFavorites(evidenceText).length > 0;
    const exactBundle = spec.id.startsWith('favorites-');

    // Search-engine query expansion is only retrieval assistance. Returned
    // evidence must independently establish relevance before a card enters the
    // candidate pool. Exact-title bundles require an actual favorite-title hit;
    // motif searches require a real screen-taste motif in title/summary/source.
    if (exactBundle && !exactFavorite) return [];
    if (!exactBundle && !evidenceTags.length) return [];

    const tasteText = `${evidenceText} ${spec.tags.join(' ')}`;
    const tags = Array.from(new Set([
      ...spec.tags,
      ...evidenceTags,
      ...(exactFavorite ? ['screen favorite'] : []),
      'screen orbit',
      'targeted discovery',
    ])).slice(0, 14);
    const taste = screenTastePrior(tasteText);
    const freshness = Math.exp(-ageDays(publishedAt, now) / 5);
    const importance = clamp(0.54 + spec.weight * 0.08 + taste * 0.55 + (exactFavorite ? 0.05 : 0));
    const quality = 0.72;
    const momentum = 0.48;
    const novelty = exactFavorite ? 0.42 : 0.62;
    const baseScore = clamp(
      importance * 0.31 + quality * 0.25 + momentum * 0.12 + freshness * 0.22 + novelty * 0.1
    );

    return [{
      id: `screen-${spec.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary,
      url,
      source,
      sourceLabel,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'screen' as const,
      tags,
      importance,
      quality,
      momentum,
      novelty,
      baseScore,
      why: exactFavorite
        ? 'A fresh update touched a title already inside your Screen Orbit.'
        : `${spec.label} is adjacent to your anime/comedy/story preferences without requiring an exact-title match.`,
    } satisfies FrontierItem];
  });
}

/**
 * Parse a publisher-owned anime feed. Unlike query search, the feed's declared
 * editorial category is legitimate adapter metadata: Crunchyroll News and ANN
 * are explicitly anime-news feeds. That supplies a low baseline anime signal,
 * while exact favorites and motif evidence still earn the stronger priors.
 */
export function parseScreenPublisherRss(
  xml: string,
  feed: ScreenPublisherFeed,
  now = Date.now(),
): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 20).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    const destination = host(url);
    if (!title || !url || !hostMatches(destination, feed.destinationDomains)) return [];

    const publishedRaw = xmlTag(block, 'pubDate') || xmlTag(block, 'published') || xmlTag(block, 'dc:date');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date(now).toISOString()
      : new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt, now) > PUBLISHER_MAX_AGE_DAYS) return [];

    const summary = summarize(
      xmlTag(block, 'description')
      || xmlTag(block, 'content:encoded')
      || `${feed.label} anime update.`
    );
    const evidenceText = `${title} ${summary}`;
    const evidenceTags = screenTasteTags(evidenceText);
    const exactFavorite = matchedScreenFavorites(evidenceText).length > 0;
    const tags = Array.from(new Set([
      ...feed.tags,
      ...evidenceTags,
      ...(exactFavorite ? ['screen favorite'] : []),
      'screen orbit',
      'publisher feed',
    ])).slice(0, 14);
    const taste = screenTastePrior(`${evidenceText} ${feed.tags.join(' ')}`);
    const freshness = Math.exp(-ageDays(publishedAt, now) / 5.5);
    const importance = clamp(0.5 + taste * 0.72 + (exactFavorite ? 0.06 : 0));
    const momentum = 0.44;
    const novelty = exactFavorite ? 0.44 : 0.56;
    const baseScore = clamp(
      importance * 0.31 + feed.quality * 0.27 + momentum * 0.12 + freshness * 0.22 + novelty * 0.08
    );

    return [{
      id: `screen-publisher-${feed.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary,
      url,
      source: destination,
      sourceLabel: feed.label,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'screen' as const,
      tags,
      importance,
      quality: feed.quality,
      momentum,
      novelty,
      baseScore,
      why: exactFavorite
        ? `${feed.label} published a fresh update about a title already inside your Screen Orbit.`
        : `${feed.label} supplies a fresh first-party or established anime signal for the broader Screen Orbit.`,
    } satisfies FrontierItem];
  })
    .sort((left, right) => {
      const leftExact = left.tags.includes('screen favorite') ? 1 : 0;
      const rightExact = right.tags.includes('screen favorite') ? 1 : 0;
      return rightExact - leftExact || right.baseScore - left.baseScore;
    })
    .slice(0, 5);
}

async function fetchQuery(spec: ScreenQuery, timeoutMs: number): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(spec.query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 35 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseScreenNewsRss(await response.text(), spec).slice(0, 3);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPublisherFeed(feed: ScreenPublisherFeed, timeoutMs: number): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(feed.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 30 },
    });
    if (!response.ok) throw new Error(`${feed.label}: ${response.status} ${response.statusText}`);
    return parseScreenPublisherRss(await response.text(), feed);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getScreenOrbitFeed(options: { deep?: boolean } = {}): Promise<FrontierFeedResponse> {
  const deep = Boolean(options.deep);
  const dayKey = new Date().toISOString().slice(0, 10);
  const queries = screenDiscoveryQueries(dayKey, deep);
  const queryTimeout = deep ? DEEP_QUERY_TIMEOUT_MS : REQUEST_QUERY_TIMEOUT_MS;

  // Publisher-owned feeds are archive-building inputs. Keeping them out of the
  // request-time path protects first useful paint while making the durable daily
  // snapshot useful even when optional search credentials are absent.
  const [queryRuns, publisherRuns] = await Promise.all([
    Promise.allSettled(queries.map((spec) => fetchQuery(spec, queryTimeout))),
    deep
      ? Promise.allSettled(SCREEN_PUBLISHER_FEEDS.map((feed) => fetchPublisherFeed(feed, DEEP_QUERY_TIMEOUT_MS)))
      : Promise.resolve([] as PromiseSettledResult<FrontierItem[]>[]),
  ]);

  const seen = new Set<string>();
  const items = [
    ...publisherRuns.flatMap((run) => run.status === 'fulfilled' ? run.value : []),
    ...queryRuns.flatMap((run) => run.status === 'fulfilled' ? run.value : []),
  ]
    .sort((left, right) => right.baseScore - left.baseScore)
    .filter((item) => {
      const key = `${item.url.toLowerCase()}|${item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, deep ? 14 : 8);

  const queryFailures = queryRuns.filter((run) => run.status === 'rejected').length;
  const publisherFailures = publisherRuns.filter((run) => run.status === 'rejected').length;
  const degradations = [
    queryFailures ? `${queryFailures}/${queryRuns.length} searches degraded` : '',
    publisherFailures ? `${publisherFailures}/${publisherRuns.length} publisher feeds degraded` : '',
  ].filter(Boolean);
  const someTransportWorked = queryFailures < queryRuns.length
    || (deep && publisherFailures < publisherRuns.length);
  const status: FrontierSourceStatus = {
    id: 'rss',
    label: deep ? 'Screen Orbit primary + search radar' : 'Screen Orbit radar',
    ok: items.length > 0 || someTransportWorked,
    count: items.length,
    message: items.length
      ? (degradations.length ? degradations.join(' · ') : undefined)
      : (degradations.length ? `no relevant screen items · ${degradations.join(' · ')}` : 'no relevant screen items'),
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
