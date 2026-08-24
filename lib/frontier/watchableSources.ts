import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-watch-radar/1.0 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;
const CHANNEL_TIMEOUT_MS = 3_800;

type WatchChannel = {
  id: string;
  label: string;
  channelId: string;
  tags: string[];
  importance: number;
};

/**
 * Stable public YouTube channel IDs. This source is deliberately tiny and
 * high-fit. Leagues known to block website playback, notably the NFL, are kept
 * out entirely and are supplied by source-hosted highlight/social clip radars.
 */
export const FRONTIER_WATCH_CHANNELS: readonly WatchChannel[] = [
  {
    id: 'thinking-basketball',
    label: 'Thinking Basketball',
    channelId: 'UC3HPbvB6f58X_7SMIp6OPYw',
    tags: ['nba', 'sports analytics', 'film study', 'basketball', 'watchable'],
    importance: 0.7,
  },
  {
    id: 'world-climbing',
    label: 'World Climbing',
    channelId: 'UC2MGuhIaOP6YLpUx106kTQw',
    tags: ['active sport', 'rock climbing', 'climbing', 'bouldering', 'watchable'],
    importance: 0.66,
  },
  {
    id: 'red-bull-bike',
    label: 'Red Bull Bike',
    channelId: 'UCXqlds5f7B2OOs9vQuevl4A',
    tags: ['active sport', 'mountain biking', 'mtb', 'downhill', 'watchable'],
    importance: 0.64,
  },
] as const;

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
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return cleanText(match?.[1]);
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function ageDays(publishedAt: string): number {
  return Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
}

export function parseWatchChannelFeed(xml: string, channel: WatchChannel): FrontierItem[] {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return entries.slice(0, 8).flatMap((entry) => {
    const videoId = xmlTag(entry, 'yt:videoId');
    const title = xmlTag(entry, 'title');
    const publishedRaw = xmlTag(entry, 'published');
    if (!videoId || !title || !publishedRaw || Number.isNaN(Date.parse(publishedRaw))) return [];
    const publishedAt = new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt) > 14) return [];

    const description = xmlTag(entry, 'media:description');
    const freshness = Math.exp(-ageDays(publishedAt) / 5);
    const quality = 0.7;
    const novelty = 0.64;
    const momentum = 0.62;
    const baseScore = Math.min(1,
      channel.importance * 0.3 + quality * 0.24 + momentum * 0.16 + freshness * 0.2 + novelty * 0.1
    );
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    return [{
      id: `watch-${channel.id}-${stableId(videoId)}`,
      title,
      summary: description || `Fresh video from ${channel.label}.`,
      url,
      source: 'youtube.com',
      sourceLabel: channel.label,
      sourceKind: 'youtube' as const,
      publishedAt,
      lane: 'sports' as const,
      tags: Array.from(new Set([...channel.tags, 'video'])).slice(0, 10),
      media: {
        type: 'youtube' as const,
        url: videoId,
        poster: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        alt: title,
        aspectRatio: 'wide' as const,
      },
      importance: channel.importance,
      quality,
      novelty,
      momentum,
      baseScore,
      why: `${channel.label} is in the deliberately small watch radar for high-fit analysis, highlights, and motion clips.`,
    } satisfies FrontierItem];
  });
}

async function fetchChannel(channel: WatchChannel): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHANNEL_TIMEOUT_MS);
  try {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/atom+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 30 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseWatchChannelFeed(await response.text(), channel).slice(0, 2);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWatchableFrontierFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.allSettled(FRONTIER_WATCH_CHANNELS.map(fetchChannel));
  const items = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const failures = runs.filter((run) => run.status === 'rejected').length;
  const status: FrontierSourceStatus = {
    id: 'youtube',
    label: 'Watch radar',
    ok: items.length > 0 || failures < runs.length,
    count: items.length,
    message: failures > 0 && items.length === 0 ? 'watch radar unavailable' : undefined,
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
