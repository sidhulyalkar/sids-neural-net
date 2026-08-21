import { FRONTIER_LANE_MAP, FRONTIER_SOURCE_WEIGHTS } from './config';
import {
  FRONTIER_GAME_LIBRARY,
  FRONTIER_MUSIC_ARTISTS,
  FRONTIER_SOUNDCLOUD_PROFILE,
  FRONTIER_TEAMS,
  personalInterestTags,
  personalLaneForText,
  pickDailySteamGames,
  pickDailySubreddits,
} from './interests';
import { classifyFrontierLane } from './sources';
import type {
  FrontierFeedResponse,
  FrontierItem,
  FrontierLaneId,
  FrontierMedia,
  FrontierSourceKind,
  FrontierSourceStatus,
} from './types';

const DAY_MS = 86_400_000;
const USER_AGENT = 'sids-neural-net-frontier/2.0 (+https://sidhulyalkar.com/frontier)';

type SourceRun = { items: FrontierItem[]; status: FrontierSourceStatus };

type RedditPost = {
  id: string;
  title: string;
  selftext?: string;
  permalink?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  num_comments?: number;
  stickied?: boolean;
  over_18?: boolean;
  link_flair_text?: string | null;
  post_hint?: string;
  thumbnail?: string;
  preview?: {
    images?: Array<{ source?: { url?: string; width?: number; height?: number } }>;
  };
};

type RedditListing = {
  data?: { children?: Array<{ data?: RedditPost }> };
};

type SteamNewsItem = {
  gid?: string;
  title?: string;
  url?: string;
  is_external_url?: boolean;
  author?: string;
  contents?: string;
  feedlabel?: string;
  date?: number;
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  profile?: { long_name?: string };
  thumbnail?: { src?: string };
};

type DiscoveryQuery = {
  query: string;
  lane: FrontierLaneId;
  tags: string[];
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

function summarize(value: string, maxLength = 300): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 180 ? boundary : maxLength).trim()}…`;
}

function tagsForText(text: string, lane: FrontierLaneId, extra: string[] = []): string[] {
  const lower = text.toLowerCase();
  const laneTerms = FRONTIER_LANE_MAP[lane]?.keywords ?? [];
  const matchedLane = laneTerms.filter((term) => lower.includes(term.toLowerCase())).slice(0, 4);
  return Array.from(new Set([
    ...personalInterestTags(text),
    ...matchedLane,
    ...extra.map((tag) => tag.toLowerCase()),
    lane.replaceAll('_', ' '),
  ])).filter(Boolean).slice(0, 9);
}

function scoreItem(
  sourceKind: FrontierSourceKind,
  publishedAt: string,
  momentum = 0.5,
  quality = 0.65,
  importance = 0.52,
  novelty = 0.56
) {
  const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / 5);
  const weightedQuality = clamp(quality * (FRONTIER_SOURCE_WEIGHTS[sourceKind] ?? 1));
  const baseScore = clamp(
    importance * 0.28 + weightedQuality * 0.24 + momentum * 0.18 + freshness * 0.2 + novelty * 0.1
  );
  return {
    importance: clamp(importance),
    quality: weightedQuality,
    momentum: clamp(momentum),
    novelty: clamp(novelty),
    baseScore,
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

function redditImage(post: RedditPost): string | undefined {
  const preview = post.preview?.images?.[0]?.source?.url;
  if (preview) return decodeHtml(preview);
  if (post.thumbnail?.startsWith('http')) return decodeHtml(post.thumbnail);
  return undefined;
}

function redditLane(subreddit: string, text: string): FrontierLaneId {
  const lower = subreddit.toLowerCase();
  if (['patriots', 'warriors', 'chelseafc', 'mcfc'].includes(lower)) return 'team_pulse';
  if (['soccer'].includes(lower)) return 'world_soccer';
  if (['nba', 'sports'].includes(lower)) return 'sports';
  if (['eldenring', 'hollowknight', 'silksong', 'silksongisntreal', 'deadcells', 'astroneer', 'pcmasterrace', 'clashofclans'].includes(lower)) return 'gaming';
  if (['dubstep', 'edm', 'illenium', 'electricdaisycarnival', 'listentothis', 'music'].includes(lower)) return 'music';
  if (['programmerhumor', 'damnthatsinteresting', 'interestingasfuck', 'sipstea', 'brandnewsentence', 'nottheonion', 'showerthoughts', 'funny', 'gifs', 'mildlyinteresting', 'nextfuckinglevel', 'thatsinsane'].includes(lower)) return 'internet_culture';
  if (['mountainbiking', 'mtb', 'bouldering', 'climbing', 'climbingporn', 'skiing', 'husky', 'huskytantrums', 'animalsbeingbros', 'animalsbeingderps', 'aww', 'rarepuppers', 'natureisfuckinglit', 'earthporn', 'exposureporn', 'spaceporn', 'food'].includes(lower)) return 'life';
  if (['machinelearning', 'dataisbeautiful'].includes(lower)) return 'ml_data';
  if (['bci', 'brainhackerslab', 'computationalneuro', 'neurallace', 'neuroengineering', 'neuroscience'].includes(lower)) return 'neuro_frontier';
  if (['science', 'askscience', 'bioengineering', 'bioinformatics', 'imageprocessing'].includes(lower)) return 'broad_science';
  return personalLaneForText(text) ?? classifyFrontierLane(text);
}

export function parseRedditListing(payload: RedditListing, fallbackSubreddit: string): FrontierItem[] {
  const posts = payload.data?.children ?? [];
  return posts.flatMap(({ data }) => {
    if (!data?.id || !data.title || data.stickied || data.over_18) return [];
    const subreddit = data.subreddit || fallbackSubreddit;
    const publishedAt = new Date((data.created_utc ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const text = `${data.title} ${data.selftext ?? ''} ${data.link_flair_text ?? ''}`;
    const lane = redditLane(subreddit, text);
    const score = Math.max(0, data.score ?? 0);
    const comments = Math.max(0, data.num_comments ?? 0);
    const momentum = clamp(
      Math.log10(score + 1) / 4.2 * 0.68 + Math.log10(comments + 1) / 3.3 * 0.32
    );
    const highSignalCommunity = ['MachineLearning', 'neuroscience', 'computationalneuro', 'science', 'BCI'].includes(subreddit);
    const sportsOrFun = ['team_pulse', 'sports', 'world_soccer', 'gaming', 'music', 'internet_culture'].includes(lane);
    const scores = scoreItem(
      'reddit',
      publishedAt,
      momentum,
      highSignalCommunity ? 0.7 : 0.58,
      highSignalCommunity ? 0.58 : sportsOrFun ? 0.5 : 0.46,
      sportsOrFun ? 0.62 : 0.56
    );
    const image = redditImage(data);
    const permalink = data.permalink
      ? `https://www.reddit.com${data.permalink}`
      : `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/`;
    return [{
      id: `reddit-${data.id}`,
      title: cleanText(data.title),
      summary: summarize(data.selftext || `${score.toLocaleString()} upvotes · ${comments.toLocaleString()} comments in r/${subreddit}.`),
      url: permalink,
      source: `reddit.com/r/${subreddit}`,
      sourceLabel: `r/${subreddit}`,
      sourceKind: 'reddit' as const,
      publishedAt,
      lane,
      tags: tagsForText(text, lane, [subreddit, data.link_flair_text ?? '', 'reddit']),
      media: image ? { type: 'image', url: image, alt: data.title, aspectRatio: 'landscape' } : undefined,
      metrics: [
        { label: 'upvotes', value: score.toLocaleString() },
        { label: 'comments', value: comments.toLocaleString() },
      ],
      ...scores,
      why: `Direct community pulse from r/${subreddit}, selected from your rotating subreddit orbit.`,
    }];
  });
}

async function redditItems(): Promise<FrontierItem[]> {
  const custom = (process.env.FRONTIER_SUBREDDITS ?? '')
    .split(',')
    .map((value) => value.trim().replace(/^r\//i, ''))
    .filter(Boolean);
  const dayKey = new Date().toISOString().slice(0, 10);
  const subreddits = pickDailySubreddits(dayKey, custom);
  const payloads = await Promise.all(subreddits.map(async (subreddit) => {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=day&limit=5&raw_json=1`;
    const payload = await fetchJson<RedditListing>(url, { next: { revalidate: 60 * 20 } });
    return parseRedditListing(payload, subreddit).slice(0, 2);
  }));
  return payloads.flat().slice(0, 30);
}

function imageFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img\b[^>]*src=["']([^"']+)["']/i);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

async function steamItems(): Promise<FrontierItem[]> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const games = pickDailySteamGames(dayKey);
  const payloads = await Promise.all(games.map(async (game) => {
    const appId = game.steamAppId!;
    const payload = await fetchJson<{ appnews?: { newsitems?: SteamNewsItem[] } }>(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=4&maxlength=900&format=json`,
      { next: { revalidate: 60 * 60 } }
    );
    const now = Date.now();
    return (payload.appnews?.newsitems ?? []).flatMap((news) => {
      if (!news.title || !news.url || !news.gid) return [];
      const publishedAt = new Date((news.date ?? Math.floor(now / 1000)) * 1000).toISOString();
      const ageDays = (now - new Date(publishedAt).getTime()) / DAY_MS;
      if (ageDays > 35) return [];
      const text = `${game.title} ${news.title} ${news.contents ?? ''}`;
      const scores = scoreItem('steam', publishedAt, 0.48, 0.76, 0.54, 0.58);
      const image = imageFromHtml(news.contents) || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
      return [{
        id: `steam-${appId}-${stableId(news.gid)}`,
        title: cleanText(news.title),
        summary: summarize(news.contents || `Fresh update from ${game.title}.`),
        url: news.url,
        source: 'steampowered.com',
        sourceLabel: game.title,
        sourceKind: 'steam' as const,
        publishedAt,
        lane: 'gaming' as const,
        tags: tagsForText(text, 'gaming', [game.title, news.feedlabel ?? 'steam', 'game update']),
        media: { type: 'image', url: image, alt: game.title, aspectRatio: 'landscape' } as FrontierMedia,
        ...scores,
        why: `Fresh first-party Steam signal for a game already in your library orbit.`,
      }];
    }).slice(0, 2);
  }));
  return payloads.flat().slice(0, 16);
}

function youtubeVideoId(url: string): string | undefined {
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

function personalDiscoveryQueries(): DiscoveryQuery[] {
  const music = FRONTIER_MUSIC_ARTISTS.slice(0, 7).join(' ');
  const games = FRONTIER_GAME_LIBRARY.slice(0, 10).map((game) => `"${game.title}"`).join(' ');
  return [
    { query: '"New England Patriots" highlights memes analysis', lane: 'team_pulse', tags: ['new england patriots', 'nfl'] },
    { query: '"Golden State Warriors" highlights memes Steph Curry', lane: 'team_pulse', tags: ['golden state warriors', 'nba'] },
    { query: '"Chelsea FC" highlights tactics memes', lane: 'team_pulse', tags: ['chelsea', 'premier league'] },
    { query: '"Manchester City" highlights tactics memes', lane: 'team_pulse', tags: ['manchester city', 'premier league'] },
    { query: `${music} dubstep bass music new release live set`, lane: 'music', tags: ['dubstep', 'bass music'] },
    { query: `${games} metroidvania indie game new release trailer`, lane: 'gaming', tags: ['game discovery', 'metroidvania'] },
    { query: 'site:youtube.com metroidvania roguelike indie game trailer new release', lane: 'gaming', tags: ['video', 'game discovery'] },
    { query: 'site:x.com OR site:threads.net Patriots Warriors Chelsea Manchester City funny highlight', lane: 'internet_culture', tags: ['social', 'sports'] },
    { query: 'site:reddit.com machine learning neuroscience BCI open source project discussion', lane: 'internet_culture', tags: ['reddit', 'discussion'] },
    { query: `site:soundcloud.com ${music} dubstep remix new track`, lane: 'music', tags: ['soundcloud', 'music discovery'] },
    { query: `"${FRONTIER_SOUNDCLOUD_PROFILE}" music`, lane: 'music', tags: ['soundcloud'] },
  ];
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

async function socialDiscoveryItems(): Promise<FrontierItem[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return [];
  const queries = personalDiscoveryQueries();
  const payloads = await Promise.all(queries.map((spec) =>
    fetchJson<{ web?: { results?: BraveResult[] } }>(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(spec.query)}&count=4&freshness=pw&text_decorations=false`,
      { headers: { 'X-Subscription-Token': token }, next: { revalidate: 60 * 60 } }
    ).then((payload) => ({ payload, spec })).catch(() => ({ payload: { web: { results: [] } }, spec }))
  ));

  const seen = new Set<string>();
  return payloads.flatMap(({ payload, spec }) => (payload.web?.results ?? []).flatMap((result) => {
    if (!result.url || !result.title || seen.has(result.url)) return [];
    seen.add(result.url);
    const text = `${result.title} ${result.description ?? ''}`;
    const lane = personalLaneForText(text) ?? spec.lane ?? classifyFrontierLane(text);
    const videoId = youtubeVideoId(result.url);
    const sourceKind = sourceKindFromUrl(result.url, videoId);
    const sourceLabel = result.profile?.long_name || new URL(result.url).hostname.replace(/^www\./, '');
    const publishedAt = new Date().toISOString();
    const scores = scoreItem(sourceKind, publishedAt, 0.5, sourceKind === 'social' ? 0.5 : 0.62, 0.52, 0.66);
    const media: FrontierMedia | undefined = videoId
      ? { type: 'youtube', url: videoId, poster: result.thumbnail?.src, alt: result.title, aspectRatio: 'wide' }
      : result.thumbnail?.src
        ? { type: 'image', url: result.thumbnail.src, alt: result.title, aspectRatio: 'landscape' }
        : undefined;
    return [{
      id: `personal-web-${stableId(result.url)}`,
      title: cleanText(result.title),
      summary: summarize(result.description || 'Fresh web discovery from your personal teams, games, music, or community orbit.'),
      url: result.url,
      source: sourceLabel,
      sourceLabel,
      sourceKind,
      publishedAt,
      lane,
      tags: tagsForText(text, lane, [...spec.tags, videoId ? 'video' : 'web discovery']),
      media,
      ...scores,
      why: 'A targeted personal discovery query pulled this out of the wider web without turning FRONTIER into an infinite feed.',
    }];
  })).slice(0, 36);
}

export async function getPersonalFrontierFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.all([
    runSource('reddit', 'Reddit orbit', redditItems),
    runSource('steam', 'Steam library', steamItems),
    process.env.BRAVE_SEARCH_API_KEY
      ? runSource('social', 'Social + media', socialDiscoveryItems)
      : Promise.resolve({
          items: [],
          status: { id: 'social', label: 'Social + media', ok: false, count: 0, message: 'optional Brave key not configured' },
        } as SourceRun),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    items: runs.flatMap((run) => run.items),
    sources: runs.map((run) => run.status),
  };
}
