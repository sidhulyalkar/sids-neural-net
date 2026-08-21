import { FRONTIER_ACTIVE_SPORTS, pickDailyActiveSports } from './interests';
import type {
  FrontierActiveSport,
} from './interests';
import type {
  FrontierFeedResponse,
  FrontierItem,
  FrontierMedia,
  FrontierSourceKind,
  FrontierSourceStatus,
} from './types';

const USER_AGENT = 'sids-neural-net-frontier-active-sports/1.0 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;

type SourceRun = { items: FrontierItem[]; status: FrontierSourceStatus };

type RedditPost = {
  id?: string;
  title?: string;
  selftext?: string;
  permalink?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  num_comments?: number;
  stickied?: boolean;
  over_18?: boolean;
  post_hint?: string;
  thumbnail?: string;
  url?: string;
  url_overridden_by_dest?: string;
  is_video?: boolean;
  preview?: { images?: Array<{ source?: { url?: string } }> };
  secure_media?: { reddit_video?: { fallback_url?: string } };
};

type RedditListing = {
  data?: { children?: Array<{ data?: RedditPost }> };
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  profile?: { long_name?: string };
  thumbnail?: { src?: string };
};

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

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function cleanText(value: string | undefined | null): string {
  if (!value) return '';
  return decodeHtml(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function signalScores(publishedAt: string, momentum: number, quality: number, importance: number, novelty: number) {
  const freshness = Math.exp(-ageDays(publishedAt) / 6);
  return {
    momentum: clamp(momentum),
    quality: clamp(quality),
    importance: clamp(importance),
    novelty: clamp(novelty),
    baseScore: clamp(importance * 0.28 + quality * 0.24 + momentum * 0.18 + freshness * 0.2 + novelty * 0.1),
  };
}

async function fetchJson<T>(url: string, init: RequestInit & { next?: { revalidate?: number } } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 45 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function runSource(
  id: FrontierSourceKind,
  label: string,
  task: () => Promise<FrontierItem[]>
): Promise<SourceRun> {
  try {
    const items = await task();
    return { items, status: { id, label, ok: true, count: items.length } };
  } catch (error) {
    return {
      items: [],
      status: {
        id,
        label,
        ok: false,
        count: 0,
        message: error instanceof Error ? error.message.slice(0, 120) : 'source unavailable',
      },
    };
  }
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return cleanText(match?.[1] ?? '');
}

function tagsForSport(sport: FrontierActiveSport, extra: string[] = []): string[] {
  return Array.from(new Set([...sport.tags, sport.label.toLowerCase(), ...extra])).slice(0, 9);
}

export function parseActiveSportNewsRss(xml: string, sport: FrontierActiveSport): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 5).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url) return [];
    const description = xmlTag(block, 'description');
    const source = xmlTag(block, 'source') || 'Sports news';
    const publishedRaw = xmlTag(block, 'pubDate');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date().toISOString()
      : new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt) > 12) return [];
    const scores = signalScores(publishedAt, 0.55, 0.68, 0.6, 0.58);
    return [{
      id: `active-news-${sport.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary: summarize(description || `Fresh professional ${sport.label} news and athlete story.`),
      url,
      source: 'news.google.com',
      sourceLabel: source,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: sport.lane,
      tags: tagsForSport(sport, ['professional news', 'active sports']),
      ...scores,
      why: `${sport.label} is in your active-sports orbit, so professional competition and athlete stories get their own signal budget.`,
    }];
  });
}

async function activeSportNewsItems(): Promise<FrontierItem[]> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const sports = pickDailyActiveSports(dayKey, 4);
  const payloads = await Promise.all(sports.map(async (sport) => {
    const query = `${sport.label} professional competition athlete highlights`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchText(url);
    return parseActiveSportNewsRss(xml, sport).slice(0, 3);
  }));
  return payloads.flat().slice(0, 12);
}

function youtubeVideoId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0];
    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
      return parsed.searchParams.get('v') || undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function redditMedia(post: RedditPost): FrontierMedia | undefined {
  const destination = post.url_overridden_by_dest || post.url;
  const youtube = youtubeVideoId(destination);
  const preview = post.preview?.images?.[0]?.source?.url
    ? decodeHtml(post.preview.images[0].source.url!)
    : undefined;
  if (youtube) {
    return {
      type: 'youtube',
      url: youtube,
      poster: preview || `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`,
      alt: post.title,
      aspectRatio: 'wide',
    };
  }
  const redditVideo = post.secure_media?.reddit_video?.fallback_url;
  if (redditVideo) {
    return { type: 'video', url: decodeHtml(redditVideo), poster: preview, alt: post.title, aspectRatio: 'wide' };
  }
  const image = preview || (post.thumbnail?.startsWith('http') ? decodeHtml(post.thumbnail) : undefined);
  return image ? { type: 'image', url: image, alt: post.title, aspectRatio: 'landscape' } : undefined;
}

export function parseActiveSportRedditListing(
  payload: RedditListing,
  sport: FrontierActiveSport,
  fallbackSubreddit: string
): FrontierItem[] {
  return (payload.data?.children ?? []).flatMap(({ data }) => {
    if (!data?.id || !data.title || data.stickied || data.over_18) return [];
    const subreddit = data.subreddit || fallbackSubreddit;
    const publishedAt = new Date((data.created_utc ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
    if (ageDays(publishedAt) > 9) return [];
    const score = Math.max(0, data.score ?? 0);
    const comments = Math.max(0, data.num_comments ?? 0);
    const momentum = clamp(Math.log10(score + 1) / 4.1 * 0.72 + Math.log10(comments + 1) / 3.2 * 0.28);
    const hasVideo = Boolean(data.is_video || youtubeVideoId(data.url_overridden_by_dest || data.url));
    const scores = signalScores(publishedAt, momentum, 0.6, hasVideo ? 0.56 : 0.5, hasVideo ? 0.7 : 0.6);
    const permalink = data.permalink
      ? `https://www.reddit.com${data.permalink}`
      : `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/`;
    return [{
      id: `active-reddit-${data.id}`,
      title: cleanText(data.title),
      summary: summarize(data.selftext || `${score.toLocaleString()} upvotes · ${comments.toLocaleString()} comments in r/${subreddit}.`),
      url: permalink,
      source: `reddit.com/r/${subreddit}`,
      sourceLabel: `r/${subreddit}`,
      sourceKind: 'reddit' as const,
      publishedAt,
      lane: sport.lane,
      tags: tagsForSport(sport, ['community', hasVideo ? 'clip' : 'story', 'active sports']),
      media: redditMedia(data),
      metrics: [
        { label: 'upvotes', value: score.toLocaleString() },
        { label: 'comments', value: comments.toLocaleString() },
      ],
      ...scores,
      why: `A top recent ${sport.label} community signal, biased toward clips, standout performances, and stories worth seeing.`,
    }];
  });
}

async function activeSportRedditItems(): Promise<FrontierItem[]> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const sports = pickDailyActiveSports(dayKey, 4);
  const requests = sports.flatMap((sport) => sport.reddit.slice(0, 2).map((subreddit) => ({ sport, subreddit })));
  const payloads = await Promise.all(requests.map(async ({ sport, subreddit }) => {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=week&limit=6&raw_json=1`;
    const payload = await fetchJson<RedditListing>(url, { next: { revalidate: 60 * 30 } });
    return parseActiveSportRedditListing(payload, sport, subreddit).slice(0, 2);
  }));
  return payloads.flat().slice(0, 16);
}

function sourceKindFromUrl(url: string, videoId?: string): FrontierSourceKind {
  if (videoId) return 'youtube';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
    if (host === 'x.com' || host === 'twitter.com' || host === 'threads.net') return 'social';
  } catch {
    return 'brave_web';
  }
  return 'brave_web';
}

async function activeSportWebItems(): Promise<FrontierItem[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return [];
  const dayKey = new Date().toISOString().slice(0, 10);
  const sports = pickDailyActiveSports(dayKey, 4);
  const payloads = await Promise.all(sports.map(async (sport) => {
    const query = `${sport.query} video highlights clip`; 
    const payload = await fetchJson<{ web?: { results?: BraveResult[] } }>(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pw&text_decorations=false`,
      { headers: { 'X-Subscription-Token': token }, next: { revalidate: 60 * 60 } }
    );
    return { sport, results: payload.web?.results ?? [] };
  }));

  const seen = new Set<string>();
  return payloads.flatMap(({ sport, results }) => results.flatMap((result) => {
    if (!result.url || !result.title || seen.has(result.url)) return [];
    seen.add(result.url);
    const videoId = youtubeVideoId(result.url);
    const sourceKind = sourceKindFromUrl(result.url, videoId);
    const sourceLabel = result.profile?.long_name || new URL(result.url).hostname.replace(/^www\./, '');
    const media: FrontierMedia | undefined = videoId
      ? { type: 'youtube', url: videoId, poster: result.thumbnail?.src, alt: result.title, aspectRatio: 'wide' }
      : result.thumbnail?.src
        ? { type: 'image', url: result.thumbnail.src, alt: result.title, aspectRatio: 'landscape' }
        : undefined;
    const publishedAt = new Date().toISOString();
    const scores = signalScores(publishedAt, 0.56, sourceKind === 'youtube' ? 0.72 : 0.64, 0.56, 0.68);
    return [{
      id: `active-web-${sport.id}-${stableId(result.url)}`,
      title: cleanText(result.title),
      summary: summarize(result.description || `Fresh ${sport.label} discovery from the wider web.`),
      url: result.url,
      source: sourceLabel,
      sourceLabel,
      sourceKind,
      publishedAt,
      lane: sport.lane,
      tags: tagsForSport(sport, [sourceKind === 'youtube' ? 'clip' : 'professional story', 'active sports']),
      media,
      ...scores,
      why: `Targeted ${sport.label} discovery prioritizes professional stories, standout performances, and clips instead of generic sports chatter.`,
    }];
  })).slice(0, 24);
}

export async function getActiveSportsFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.all([
    runSource('rss', 'Active sports news', activeSportNewsItems),
    runSource('reddit', 'Active sports clips', activeSportRedditItems),
    process.env.BRAVE_SEARCH_API_KEY
      ? runSource('brave_web', 'Active sports web', activeSportWebItems)
      : Promise.resolve({
          items: [],
          status: { id: 'brave_web', label: 'Active sports web', ok: false, count: 0, message: 'optional Brave key not configured' },
        } as SourceRun),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    items: runs.flatMap((run) => run.items),
    sources: runs.map((run) => run.status),
  };
}

export function activeSportCoverage(): string[] {
  return FRONTIER_ACTIVE_SPORTS.map((sport) => sport.label);
}
