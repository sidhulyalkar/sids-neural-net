import { FRONTIER_SOURCE_WEIGHTS } from './config';
import {
  FRONTIER_TASTE_DISCOVERY_QUERIES,
  personalTasteTags,
  type FrontierTasteDiscoveryQuery,
} from './personalTaste';
import type {
  FrontierFeedResponse,
  FrontierItem,
  FrontierMedia,
  FrontierSourceKind,
  FrontierSourceStatus,
} from './types';

const USER_AGENT = 'sids-neural-net-frontier/2.0 (+https://sidhulyalkar.com/frontier)';

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  profile?: { long_name?: string };
  thumbnail?: { src?: string };
};

type BravePayload = { web?: { results?: BraveResult[] } };

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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(value: string | undefined, maxLength = 300): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 180 ? boundary : maxLength).trim()}…`;
}

function youtubeVideoId(value: string): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0];
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2];
      return url.searchParams.get('v') || undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function sourceKindFromUrl(url: string, videoId?: string): FrontierSourceKind {
  if (videoId) return 'youtube';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
    if (['x.com', 'twitter.com', 'threads.net'].includes(host)) return 'social';
  } catch {
    return 'brave_web';
  }
  return 'brave_web';
}

function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'web'; }
}

function dayHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Keep the highest-value four taste searches always on, then rotate another
 * four. This bounds Brave usage while preventing the discovery mesh from
 * forgetting NFL/fantasy, sports data, or scientific visualization.
 */
export function pickDailyTasteQueries(dayKey: string, limit = 8): FrontierTasteDiscoveryQuery[] {
  const cap = Math.max(4, Math.min(FRONTIER_TASTE_DISCOVERY_QUERIES.length, limit));
  const pinned = FRONTIER_TASTE_DISCOVERY_QUERIES.slice(0, 4);
  const rotation = FRONTIER_TASTE_DISCOVERY_QUERIES.slice(4);
  if (cap <= pinned.length || !rotation.length) return pinned.slice(0, cap);

  const start = dayHash(`${dayKey}-taste-query`) % rotation.length;
  const picked = Array.from(
    { length: Math.min(cap - pinned.length, rotation.length) },
    (_, index) => rotation[(start + index) % rotation.length]
  );
  return [...pinned, ...picked];
}

async function fetchBrave(query: FrontierTasteDiscoveryQuery, token: string): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_500);
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query.query)}&count=4&freshness=pw&text_decorations=false`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'X-Subscription-Token': token,
      },
      signal: controller.signal,
      next: { revalidate: 60 * 45 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json() as BravePayload;
    const now = new Date().toISOString();

    return (payload.web?.results ?? []).flatMap((result) => {
      if (!result.url || !result.title) return [];
      const videoId = youtubeVideoId(result.url);
      if (query.video && !videoId) return [];

      const sourceKind = sourceKindFromUrl(result.url, videoId);
      const host = hostLabel(result.url);
      const title = cleanText(result.title);
      const summary = summarize(result.description);
      const text = `${title} ${summary}`;
      const tags = Array.from(new Set([
        ...query.tags,
        ...personalTasteTags(text),
        ...(query.video ? ['watchable', 'video'] : ['targeted discovery']),
      ])).slice(0, 12);
      const quality = clamp((sourceKind === 'youtube' ? 0.59 : 0.7) * (FRONTIER_SOURCE_WEIGHTS[sourceKind] ?? 1));
      const importance = query.lane === 'sports' || query.lane === 'neuro_frontier' ? 0.62 : 0.56;
      const novelty = 0.67;
      const momentum = query.video ? 0.6 : 0.5;
      const freshness = 0.9;
      const baseScore = clamp(
        importance * 0.28 + quality * 0.24 + momentum * 0.14 + freshness * 0.2 + novelty * 0.14
      );
      const media: FrontierMedia | undefined = videoId
        ? { type: 'youtube', url: videoId, poster: result.thumbnail?.src, alt: title, aspectRatio: 'wide' }
        : result.thumbnail?.src
          ? { type: 'image', url: result.thumbnail.src, alt: title, aspectRatio: 'landscape' }
          : undefined;

      return [{
        id: `taste-web-${stableId(result.url)}`,
        title,
        summary: summary || `Fresh targeted discovery for ${query.tags.slice(0, 2).join(' + ')}.`,
        url: result.url,
        source: host,
        sourceLabel: result.profile?.long_name || host,
        sourceKind,
        publishedAt: now,
        lane: query.lane,
        tags,
        media,
        importance,
        quality,
        momentum,
        novelty,
        baseScore,
        why: query.video
          ? 'A deliberately searched watchable signal from a topic already in your taste map.'
          : 'A deliberate high-fit search from your explicit personal taste map, still subject to publisher provenance gates.',
      } satisfies FrontierItem];
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPersonalTasteFrontierFeed(): Promise<FrontierFeedResponse> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  const status: FrontierSourceStatus = token
    ? { id: 'brave_web', label: 'Personal taste search', ok: true, count: 0 }
    : { id: 'brave_web', label: 'Personal taste search', ok: false, count: 0, message: 'optional Brave key not configured' };
  if (!token) return { generatedAt: new Date().toISOString(), items: [], sources: [status] };

  const dayKey = new Date().toISOString().slice(0, 10);
  const queries = pickDailyTasteQueries(dayKey);
  const runs = await Promise.allSettled(queries.map((query) => fetchBrave(query, token)));
  const items = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const failures = runs.filter((run) => run.status === 'rejected').length;

  return {
    generatedAt: new Date().toISOString(),
    items,
    sources: [{
      ...status,
      ok: items.length > 0 || failures < runs.length,
      count: items.length,
      message: failures > 0 && items.length === 0 ? 'targeted search providers unavailable' : undefined,
    }],
  };
}
