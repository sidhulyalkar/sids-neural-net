import type { FrontierFeedResponse, FrontierItem, FrontierLaneId, FrontierSourceKind, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-clips/1.0 (+https://sidhulyalkar.com/frontier)';
const FETCH_TIMEOUT_MS = 3_200;

type ClipQuery = {
  id: string;
  query: string;
  lane: FrontierLaneId;
  tags: readonly string[];
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  profile?: { long_name?: string };
  thumbnail?: { src?: string };
};

type TikTokOEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

const SOCIAL_HOSTS = ['x.com', 'twitter.com', 'threads.net', 'threads.com', 'tiktok.com'] as const;
const SPORTS_MEDIA_HOSTS = [
  'bleacherreport.com', 'sleeper.com', 'espn.com', 'cbssports.com', 'nbcsports.com',
  'foxsports.com', 'sports.yahoo.com', 'theathletic.com', 'skysports.com', 'pff.com',
] as const;
const ALLOWED_HOSTS = [...SOCIAL_HOSTS, ...SPORTS_MEDIA_HOSTS] as const;

export const FRONTIER_SPORTS_CLIP_QUERIES: readonly ClipQuery[] = [
  {
    id: 'patriots-nfl-clips',
    query: 'New England Patriots NFL highlight film clip site:x.com OR site:threads.net OR site:tiktok.com OR site:bleacherreport.com OR site:sleeper.com',
    lane: 'team_pulse',
    tags: ['new england patriots', 'patriots', 'nfl', 'football'],
  },
  {
    id: 'warriors-nba-clips',
    query: 'Golden State Warriors NBA highlight film clip site:x.com OR site:threads.net OR site:tiktok.com OR site:bleacherreport.com',
    lane: 'team_pulse',
    tags: ['golden state warriors', 'warriors', 'nba', 'basketball'],
  },
  {
    id: 'premier-league-clips',
    query: 'Chelsea Manchester City Premier League highlight tactics clip site:x.com OR site:threads.net OR site:tiktok.com OR site:bleacherreport.com OR site:skysports.com',
    lane: 'premier_league',
    tags: ['chelsea', 'manchester city', 'premier league', 'soccer'],
  },
  {
    id: 'fantasy-football-clips',
    query: 'fantasy football NFL injury usage film route participation clip site:x.com OR site:threads.net OR site:tiktok.com OR site:sleeper.com OR site:bleacherreport.com',
    lane: 'sports',
    tags: ['fantasy football', 'nfl', 'player usage', 'film study'],
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
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(value: string | undefined, maxLength = 250): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 150 ? boundary : maxLength).trim()}…`;
}

function hostForUrl(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function hostMatches(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`);
}

export function isAllowedSportsClipUrl(value: string): boolean {
  const host = hostForUrl(value);
  return Boolean(host && ALLOWED_HOSTS.some((candidate) => hostMatches(host, candidate)));
}

function isSocialHost(host: string): boolean {
  return SOCIAL_HOSTS.some((candidate) => hostMatches(host, candidate));
}

function sourceLabelForHost(host: string, fallback?: string): string {
  if (hostMatches(host, 'x.com') || hostMatches(host, 'twitter.com')) return 'X';
  if (hostMatches(host, 'threads.net') || hostMatches(host, 'threads.com')) return 'Threads';
  if (hostMatches(host, 'tiktok.com')) return 'TikTok';
  if (hostMatches(host, 'bleacherreport.com')) return 'Bleacher Report';
  if (hostMatches(host, 'sleeper.com')) return 'Sleeper';
  return fallback?.trim() || host;
}

async function fetchJson<T>(url: string, headers: HeadersInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      signal: controller.signal,
      next: { revalidate: 60 * 25 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

async function tiktokMetadata(url: string): Promise<TikTokOEmbed | undefined> {
  if (!hostMatches(hostForUrl(url), 'tiktok.com')) return undefined;
  try {
    return await fetchJson<TikTokOEmbed>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  } catch {
    return undefined;
  }
}

export async function sportsClipItemFromResult(
  result: BraveResult,
  spec: ClipQuery,
  enrichTikTok = false,
): Promise<FrontierItem | undefined> {
  if (!result.url || !result.title || !isAllowedSportsClipUrl(result.url)) return undefined;
  const host = hostForUrl(result.url);
  const metadata = enrichTikTok ? await tiktokMetadata(result.url) : undefined;
  const title = cleanText(metadata?.title || result.title);
  if (!title) return undefined;
  const sourceLabel = sourceLabelForHost(host, metadata?.author_name || result.profile?.long_name);
  const sourceKind: FrontierSourceKind = isSocialHost(host) ? 'social' : 'brave_web';
  const publishedAt = new Date().toISOString();
  const quality = sourceKind === 'social' ? 0.58 : 0.72;
  const importance = spec.lane === 'team_pulse' ? 0.62 : 0.58;
  const novelty = 0.64;
  const momentum = 0.58;
  const baseScore = clamp(importance * 0.28 + quality * 0.24 + momentum * 0.18 + novelty * 0.16 + 0.14);
  const thumbnail = metadata?.thumbnail_url || result.thumbnail?.src;

  return {
    id: `sports-clip-${spec.id}-${stableId(result.url)}`,
    title,
    summary: summarize(result.description || `${sourceLabel} sports clip discovered for your sports radar.`),
    url: result.url,
    source: host,
    sourceLabel,
    sourceKind,
    publishedAt,
    lane: spec.lane,
    tags: Array.from(new Set([
      ...spec.tags,
      'sports highlight', 'watchable', 'external clip', 'social clip', sourceLabel.toLowerCase(),
    ])).slice(0, 12),
    // Social rights and embed availability can change independently of the
    // recommendation. Keep playback at the source and use only stable source
    // metadata/thumbnail inside FRONTIER.
    media: thumbnail
      ? { type: 'image', url: thumbnail, alt: title, aspectRatio: hostMatches(host, 'tiktok.com') ? 'portrait' : 'landscape' }
      : undefined,
    actionLabel: `Watch on ${sourceLabel}`,
    importance,
    quality,
    momentum,
    novelty,
    baseScore,
    why: `${sourceLabel} is treated as an external sports-clip source so platform embed restrictions cannot destabilize the FRONTIER card.`,
  };
}

async function fetchQuery(spec: ClipQuery, token: string): Promise<FrontierItem[]> {
  const payload = await fetchJson<{ web?: { results?: BraveResult[] } }>(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(spec.query)}&count=5&freshness=pw&text_decorations=false`,
    { 'X-Subscription-Token': token },
  );
  const relevant = (payload.web?.results ?? []).filter((result) => result.url && isAllowedSportsClipUrl(result.url)).slice(0, 4);
  const items = await Promise.all(relevant.map((result, index) => sportsClipItemFromResult(result, spec, index < 2)));
  return items.filter((item): item is FrontierItem => Boolean(item));
}

export async function getSportsClipFeed(): Promise<FrontierFeedResponse> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) {
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      sources: [{ id: 'social', label: 'Sports clip radar', ok: false, count: 0, message: 'optional Brave key not configured' }],
    };
  }
  const runs = await Promise.allSettled(FRONTIER_SPORTS_CLIP_QUERIES.map((spec) => fetchQuery(spec, token)));
  const seen = new Set<string>();
  const items = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : [])
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 16);
  const failures = runs.filter((run) => run.status === 'rejected').length;
  const status: FrontierSourceStatus = {
    id: 'social',
    label: 'Sports clip radar',
    ok: items.length > 0,
    count: items.length,
    message: items.length
      ? (failures ? `${failures} clip query${failures === 1 ? '' : 'ies'} degraded` : undefined)
      : 'external sports clips temporarily unavailable',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
