import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-analytics/1.0 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;
const QUERY_TIMEOUT_MS = 3_800;

type SportsAnalyticsQuery = {
  id: string;
  label: string;
  query: string;
  tags: string[];
  weight: number;
};

const PINNED_QUERIES: readonly SportsAnalyticsQuery[] = [
  {
    id: 'nfl-analytics',
    label: 'NFL analytics',
    query: 'NFL Patriots analytics player tracking EPA CPOE play-by-play fourth down win probability',
    tags: ['nfl', 'patriots', 'sports analytics', 'player tracking', 'play-by-play', 'epa', 'cpoe'],
    weight: 1,
  },
  {
    id: 'fantasy-football',
    label: 'Fantasy football models',
    query: 'fantasy football superflex 2QB ADP target share route participation air yards projections analytics',
    tags: ['fantasy football', 'superflex', '2qb', 'adp', 'target share', 'player usage'],
    weight: 1,
  },
  {
    id: 'nfl-role-news',
    label: 'NFL role and availability',
    query: 'NFL fantasy football injury depth chart training camp role change snap share route participation beat reporter',
    tags: ['nfl', 'fantasy football', 'injury', 'depth chart', 'player usage', 'decision edge'],
    weight: 1,
  },
  {
    id: 'sports-data-viz',
    label: 'Sports data visualization',
    query: 'sports analytics data visualization player tracking open source football basketball soccer',
    tags: ['sports analytics', 'sports data', 'visualization'],
    weight: 0.92,
  },
] as const;

const ROTATING_QUERIES: readonly SportsAnalyticsQuery[] = [
  {
    id: 'nba-analytics',
    label: 'Warriors and NBA analytics',
    query: 'Golden State Warriors NBA analytics lineup tracking shot quality expected value player impact visualization',
    tags: ['warriors', 'nba', 'sports analytics', 'player tracking', 'visualization'],
    weight: 0.9,
  },
  {
    id: 'soccer-analytics',
    label: 'Chelsea, Man City and soccer analytics',
    query: 'Chelsea Manchester City soccer analytics xG xThreat tracking pressing set pieces data visualization',
    tags: ['chelsea', 'man city', 'soccer analytics', 'xg', 'xthreat', 'sports data', 'visualization'],
    weight: 0.9,
  },
] as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function stableId(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
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

function publisherHost(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function summarize(value: string, maxLength = 280): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 170 ? boundary : maxLength).trim()}…`;
}

function ageDays(publishedAt: string): number {
  return Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
}

function dailyRotationIndex(): number {
  const day = new Date().toISOString().slice(0, 10);
  return Array.from(day).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
}

export function sportsAnalyticsQueries(): SportsAnalyticsQuery[] {
  const rotating = ROTATING_QUERIES[dailyRotationIndex() % ROTATING_QUERIES.length];
  return [...PINNED_QUERIES, rotating];
}

export function parseSportsAnalyticsNewsRss(xml: string, spec: SportsAnalyticsQuery): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 6).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url) return [];

    const publishedRaw = xmlTag(block, 'pubDate');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date().toISOString()
      : new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt) > 10) return [];

    const sourceLabel = xmlTag(block, 'source') || 'Sports analytics';
    const publisherUrl = xmlTagAttribute(block, 'source', 'url');
    const source = publisherHost(publisherUrl) || 'news.google.com';
    const summary = summarize(xmlTag(block, 'description') || `${spec.label} signal.`);
    const freshness = Math.exp(-ageDays(publishedAt) / 4.5);
    const quality = 0.72;
    const importance = 0.6 + spec.weight * 0.08;
    const novelty = 0.58;
    const momentum = 0.5;
    const baseScore = clamp(
      importance * 0.3 + quality * 0.24 + momentum * 0.12 + freshness * 0.22 + novelty * 0.12
    );

    return [{
      id: `sports-analytics-${spec.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary,
      url,
      source,
      sourceLabel,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'sports' as const,
      tags: Array.from(new Set([...spec.tags, 'sports analytics', 'targeted discovery'])).slice(0, 10),
      importance,
      quality,
      momentum,
      novelty,
      baseScore,
      why: `${spec.label} has a dedicated discovery budget because it is a high-value personal analysis topic.`,
    } satisfies FrontierItem];
  });
}

async function fetchQuery(spec: SportsAnalyticsQuery): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(spec.query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 35 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseSportsAnalyticsNewsRss(await response.text(), spec).slice(0, 3);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSportsAnalyticsFeed(): Promise<FrontierFeedResponse> {
  const queries = sportsAnalyticsQueries();
  const runs = await Promise.allSettled(queries.map(fetchQuery));
  const items = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const failures = runs.filter((run) => run.status === 'rejected').length;
  const status: FrontierSourceStatus = {
    id: 'rss',
    label: 'Sports analytics radar',
    ok: items.length > 0 || failures < runs.length,
    count: items.length,
    message: failures > 0 && items.length === 0 ? 'sports analytics discovery unavailable' : undefined,
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
