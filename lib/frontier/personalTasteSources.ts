import { FRONTIER_SOURCE_WEIGHTS } from './config';
import { FRONTIER_MUSIC_ARTISTS } from './interests';
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

const USER_AGENT = 'sids-neural-net-frontier/2.2 (+https://sidhulyalkar.com/frontier)';
const MUSIC_QUERY_TIMEOUT_MS = 3_800;
const DAY_MS = 86_400_000;
const CONNECTION_DISCOVERY_TAG = 'connection discovery';

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  profile?: { long_name?: string };
  thumbnail?: { src?: string };
};

type BravePayload = { web?: { results?: BraveResult[] } };

type MusicQuery = {
  id: string;
  query: string;
  artists: string[];
};

export type DirectMusicFeed = {
  id: string;
  label: string;
  url: string;
  host: string;
};

export const FRONTIER_DIRECT_MUSIC_FEEDS: readonly DirectMusicFeed[] = [
  {
    id: 'edm-com',
    label: 'EDM.com',
    url: 'https://edm.com/.rss/full/',
    host: 'edm.com',
  },
  {
    id: 'dancing-astronaut',
    label: 'Dancing Astronaut',
    url: 'https://dancingastronaut.com/feed',
    host: 'dancingastronaut.com',
  },
] as const;

/**
 * Deep bridge probes live beside acquisition rather than the cold-start taste
 * map because they are retrieval strategies, not new interests. Exactly one of
 * these rotates into the normal eight-query daily budget.
 */
export const FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES: readonly FrontierTasteDiscoveryQuery[] = [
  {
    query: 'site:github.com game development WebGPU physics engine procedural generation open source',
    lane: 'creative_tech',
    tags: ['game design', 'webgpu', 'simulation', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com skateboarding pose estimation computer vision biomechanics analysis open source',
    lane: 'sports',
    tags: ['skateboarding', 'pose estimation', 'biomechanics', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com mountain biking MTB telemetry GPS GPX data visualization analysis open source',
    lane: 'sports',
    tags: ['mountain biking', 'mtb', 'telemetry', 'visualization', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com rock climbing bouldering biomechanics pose estimation movement analysis open source',
    lane: 'sports',
    tags: ['rock climbing', 'bouldering', 'biomechanics', 'pose estimation', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com disc golf flight simulation trajectory modeling analysis open source',
    lane: 'sports',
    tags: ['disc golf', 'simulation', 'trajectory', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com sports analytics visualization player tracking open source repository',
    lane: 'sports',
    tags: ['sports analytics', 'visualization', 'player tracking', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com scientific visualization game engine WebGPU interactive open source',
    lane: 'creative_tech',
    tags: ['scientific visualization', 'game design', 'webgpu', 'open source', CONNECTION_DISCOVERY_TAG],
  },
  {
    query: 'site:github.com music visualization creative coding WebGPU audio reactive open source',
    lane: 'creative_tech',
    tags: ['music', 'visualization', 'creative coding', 'webgpu', 'open source', CONNECTION_DISCOVERY_TAG],
  },
] as const;

const BASS_EVIDENCE = [
  'dubstep', 'bass music', 'melodic bass', 'bass house', 'drum and bass',
  'electronic music', 'edm', 'remix', 'live set',
] as const;

const BRIDGE_INTEREST_EVIDENCE = [
  'game development', 'game dev', 'game engine', 'webgpu',
  'skateboard', 'skateboarding', 'street skating',
  'mountain biking', 'mountain bike', 'mtb',
  'rock climbing', 'bouldering',
  'disc golf',
  'sports analytics', 'player tracking',
  'scientific visualization', 'neuroglancer',
  'music visualization', 'audio reactive', 'audio-reactive',
] as const;

const BRIDGE_METHOD_EVIDENCE = [
  'analysis', 'analytics', 'pose estimation', 'computer vision', 'biomechanics',
  'kinematics', 'telemetry', 'gps', 'gpx', 'simulation', 'trajectory',
  'visualization', 'visualisation', 'creative coding', 'open source', 'open-source',
  'repository', 'toolkit', 'library', 'physics engine', 'procedural generation',
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
    if (host === 'github.com') return 'github';
    if (host === 'paperswithcode.com') return 'paperswithcode';
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
    if (['x.com', 'twitter.com', 'threads.net', 'threads.com', 'tiktok.com'].includes(host)) return 'social';
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

function xmlTag(block: string, tag: string): string {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return cleanText(match?.[1]);
}

function xmlTagAttribute(block: string, tag: string, attribute: string): string {
  const escaped = tag.replace(':', '\\:');
  const opening = block.match(new RegExp(`<${escaped}\\b([^>]*)>`, 'i'))?.[1] ?? '';
  return cleanText(opening.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]);
}

function publisherHost(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function evidenceContains(text: string, term: string): boolean {
  const lower = text.toLowerCase();
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  if (/^[a-z0-9]+$/.test(needle) && needle.length <= 4) {
    return new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(lower);
  }
  return lower.includes(needle);
}

function bridgeResultHasIndependentEvidence(text: string, url: string): boolean {
  const interest = BRIDGE_INTEREST_EVIDENCE.some((term) => evidenceContains(text, term));
  const method = BRIDGE_METHOD_EVIDENCE.some((term) => evidenceContains(text, term))
    || hostLabel(url) === 'github.com';
  return interest && method;
}

function verifiedBridgeQueryTags(query: FrontierTasteDiscoveryQuery, text: string, url: string): string[] {
  const host = hostLabel(url);
  return query.tags.filter((tag) => (
    tag === CONNECTION_DISCOVERY_TAG
    || evidenceContains(text, tag)
    || (tag === 'open source' && host === 'github.com')
  ));
}

function musicEvidence(text: string, artists: readonly string[] = FRONTIER_MUSIC_ARTISTS): {
  matchedArtists: string[];
  bassEvidence: boolean;
} {
  return {
    matchedArtists: artists.filter((artist) => evidenceContains(text, artist)),
    bassEvidence: BASS_EVIDENCE.some((term) => evidenceContains(text, term)),
  };
}

function musicScores(publishedAt: string, matchedArtists: string[], now: number) {
  const ageDays = Math.max(0, (now - new Date(publishedAt).getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / 7);
  const quality = 0.68;
  const importance = matchedArtists.length ? 0.58 : 0.5;
  const novelty = 0.62;
  const momentum = 0.5;
  const baseScore = clamp(
    importance * 0.28 + quality * 0.24 + momentum * 0.14 + freshness * 0.22 + novelty * 0.12
  );
  return { quality, importance, novelty, momentum, baseScore };
}

function musicTags(matchedArtists: string[], bassEvidence: boolean): string[] {
  return Array.from(new Set([
    ...matchedArtists.map((artist) => artist.toLowerCase()),
    ...(bassEvidence ? ['bass music'] : []),
    'music discovery',
  ])).slice(0, 8);
}

/**
 * Keep the highest-value four taste searches always on, reserve one rotating
 * slot for a verified cross-interest bridge, then use the remaining capacity
 * for ordinary taste rotation. The standard budget remains exactly eight.
 */
export function pickDailyTasteQueries(dayKey: string, limit = 8): FrontierTasteDiscoveryQuery[] {
  const cap = Math.max(4, Math.min(FRONTIER_TASTE_DISCOVERY_QUERIES.length, limit));
  const pinned = FRONTIER_TASTE_DISCOVERY_QUERIES.slice(0, 4);
  const rotation = FRONTIER_TASTE_DISCOVERY_QUERIES.slice(4);
  if (cap <= pinned.length) return pinned.slice(0, cap);

  const bridge = FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES.length
    ? FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES[
      dayHash(`${dayKey}-taste-bridge`) % FRONTIER_TASTE_BRIDGE_DISCOVERY_QUERIES.length
    ]
    : undefined;
  const ordinarySlots = Math.max(0, cap - pinned.length - (bridge ? 1 : 0));
  const start = rotation.length ? dayHash(`${dayKey}-taste-query`) % rotation.length : 0;
  const picked = rotation.length
    ? Array.from(
      { length: Math.min(ordinarySlots, rotation.length) },
      (_, index) => rotation[(start + index) % rotation.length]
    )
    : [];
  return [...pinned, ...(bridge ? [bridge] : []), ...picked].slice(0, cap);
}

/**
 * Bass discovery is intentionally keyless and rotates through the checked-in
 * taste profile. Query text is retrieval only: returned copy must independently
 * mention the artist or bass/dubstep evidence before it earns music semantics.
 */
export function pickDailyMusicQueries(dayKey: string, artistCount = 4): MusicQuery[] {
  const artists = Array.from(new Set(FRONTIER_MUSIC_ARTISTS.map((artist) => artist.trim()).filter(Boolean)));
  const count = Math.max(1, Math.min(6, artistCount, artists.length));
  const start = artists.length ? dayHash(`${dayKey}-music-radar`) % artists.length : 0;
  const selected = artists.length
    ? Array.from({ length: count }, (_, index) => artists[(start + index) % artists.length])
    : [];
  return [
    ...selected.map((artist) => ({
      id: `artist-${stableId(artist.toLowerCase())}`,
      query: `"${artist}" new release remix live set dubstep bass music`,
      artists: [artist],
    })),
    {
      id: 'bass-frontier',
      query: 'dubstep bass music new release remix live set festival',
      artists: [],
    },
  ];
}

export function parsePersonalMusicNewsRss(xml: string, spec: MusicQuery, now = Date.now()): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 8).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url) return [];
    const description = summarize(xmlTag(block, 'description'));
    const evidence = musicEvidence(`${title} ${description}`, spec.artists);
    if (!evidence.matchedArtists.length && !evidence.bassEvidence) return [];

    const publishedRaw = xmlTag(block, 'pubDate');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date(now).toISOString()
      : new Date(publishedRaw).toISOString();
    const ageDays = Math.max(0, (now - new Date(publishedAt).getTime()) / DAY_MS);
    if (ageDays > 21) return [];

    const publisherUrl = xmlTagAttribute(block, 'source', 'url');
    const sourceLabel = xmlTag(block, 'source') || publisherHost(publisherUrl) || 'Music radar';
    const source = publisherHost(publisherUrl) || 'news.google.com';

    return [{
      id: `taste-music-${spec.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary: description || 'Fresh release or performance signal from the keyless bass radar.',
      url,
      source,
      sourceLabel,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'music' as const,
      tags: musicTags(evidence.matchedArtists, evidence.bassEvidence),
      ...musicScores(publishedAt, evidence.matchedArtists, now),
      why: evidence.matchedArtists.length
        ? `Fresh signal for ${evidence.matchedArtists.join(' + ')} from the checked-in music taste profile.`
        : 'Fresh dubstep or bass-music signal from the keyless daily radar.',
    } satisfies FrontierItem];
  });
}

/** Direct specialist feeds are preferred because provenance survives intact. */
export function parseDirectMusicRss(
  xml: string,
  feed: DirectMusicFeed,
  now = Date.now(),
): FrontierItem[] {
  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []),
  ];
  return blocks.slice(0, 16).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link')
      || xmlTagAttribute(block, 'link', 'href')
      || xmlTag(block, 'guid')
      || xmlTag(block, 'id');
    if (!title || !url) return [];

    const summary = summarize(
      xmlTag(block, 'description')
      || xmlTag(block, 'summary')
      || xmlTag(block, 'content:encoded')
      || xmlTag(block, 'content')
    );
    const evidence = musicEvidence(`${title} ${summary}`);
    if (!evidence.matchedArtists.length && !evidence.bassEvidence) return [];

    const publishedRaw = xmlTag(block, 'pubDate')
      || xmlTag(block, 'published')
      || xmlTag(block, 'updated')
      || xmlTag(block, 'dc:date');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date(now).toISOString()
      : new Date(publishedRaw).toISOString();
    const ageDays = Math.max(0, (now - new Date(publishedAt).getTime()) / DAY_MS);
    if (ageDays > 21) return [];

    return [{
      id: `taste-music-direct-${feed.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary: summary || `Fresh electronic-music signal from ${feed.label}.`,
      url,
      source: feed.host,
      sourceLabel: feed.label,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'music' as const,
      tags: musicTags(evidence.matchedArtists, evidence.bassEvidence),
      ...musicScores(publishedAt, evidence.matchedArtists, now),
      why: evidence.matchedArtists.length
        ? `${feed.label} directly mentioned ${evidence.matchedArtists.join(' + ')} from your checked-in music taste profile.`
        : `${feed.label} directly published a fresh bass or electronic-music signal.`,
    } satisfies FrontierItem];
  });
}

async function fetchMusicQuery(spec: MusicQuery): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MUSIC_QUERY_TIMEOUT_MS);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(spec.query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 45 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parsePersonalMusicNewsRss(await response.text(), spec).slice(0, 2);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDirectMusicFeed(feed: DirectMusicFeed): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MUSIC_QUERY_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 45 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseDirectMusicRss(await response.text(), feed).slice(0, 5);
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeMusic(items: FrontierItem[]): FrontierItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    let key = item.url.toLowerCase();
    try {
      const url = new URL(item.url);
      url.hash = '';
      key = url.toString().toLowerCase();
    } catch {
      key = item.title.toLowerCase().replace(/\W+/g, ' ').trim();
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getKeylessMusicRadar(dayKey: string): Promise<{ items: FrontierItem[]; status: FrontierSourceStatus }> {
  const queries = pickDailyMusicQueries(dayKey);
  const [directRuns, searchRuns] = await Promise.all([
    Promise.allSettled(FRONTIER_DIRECT_MUSIC_FEEDS.map(fetchDirectMusicFeed)),
    Promise.allSettled(queries.map(fetchMusicQuery)),
  ]);
  const directItems = directRuns.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const searchItems = searchRuns.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const items = dedupeMusic([...directItems, ...searchItems]).slice(0, 16);
  const failures = [...directRuns, ...searchRuns].filter((run) => run.status === 'rejected').length;
  const totalRuns = directRuns.length + searchRuns.length;
  return {
    items,
    status: {
      id: 'rss',
      label: 'Bass music radar',
      ok: items.length > 0 || failures < totalRuns,
      count: items.length,
      message: failures > 0 && items.length === 0 ? 'keyless music discovery unavailable' : undefined,
    },
  };
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
      const isConnectionDiscovery = query.tags.includes(CONNECTION_DISCOVERY_TAG);
      if (isConnectionDiscovery && !bridgeResultHasIndependentEvidence(text, result.url)) return [];

      const queryTags = isConnectionDiscovery
        ? verifiedBridgeQueryTags(query, text, result.url)
        : Array.from(query.tags);
      const tags = Array.from(new Set([
        ...queryTags,
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
          : isConnectionDiscovery
            ? 'A verified cross-interest discovery: the returned item independently shows the hobby and a transferable tool or method.'
            : 'A deliberate high-fit search from your explicit personal taste map, still subject to publisher provenance gates.',
      } satisfies FrontierItem];
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPersonalTasteFrontierFeed(): Promise<FrontierFeedResponse> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  const dayKey = new Date().toISOString().slice(0, 10);
  const music = await getKeylessMusicRadar(dayKey);
  const braveStatus: FrontierSourceStatus = token
    ? { id: 'brave_web', label: 'Personal taste search', ok: true, count: 0 }
    : { id: 'brave_web', label: 'Personal taste search', ok: false, count: 0, message: 'optional Brave key not configured' };

  if (!token) {
    return {
      generatedAt: new Date().toISOString(),
      items: music.items,
      sources: [braveStatus, music.status],
    };
  }

  const queries = pickDailyTasteQueries(dayKey);
  const runs = await Promise.allSettled(queries.map((query) => fetchBrave(query, token)));
  const braveItems = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const failures = runs.filter((run) => run.status === 'rejected').length;

  return {
    generatedAt: new Date().toISOString(),
    items: [...braveItems, ...music.items],
    sources: [{
      ...braveStatus,
      ok: braveItems.length > 0 || failures < runs.length,
      count: braveItems.length,
      message: failures > 0 && braveItems.length === 0 ? 'targeted search providers unavailable' : undefined,
    }, music.status],
  };
}
