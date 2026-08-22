import { FRONTIER_SOURCE_WEIGHTS } from './config';
import { classifyFrontierLane } from './sources';
import type { FrontierFeedResponse, FrontierItem, FrontierMedia } from './types';

const FETCH_TIMEOUT_MS = 7_500;
const DAY_MS = 86_400_000;

type VimeoPicture = {
  sizes?: Array<{ width?: number; height?: number; link?: string }>;
};

type VimeoVideo = {
  uri?: string;
  name?: string;
  description?: string | null;
  link?: string;
  duration?: number;
  created_time?: string;
  modified_time?: string;
  pictures?: VimeoPicture;
  tags?: Array<{ name?: string; canonical?: string }>;
  user?: { name?: string };
};

type VimeoCollection = { data?: VimeoVideo[] };

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

function bestPicture(pictures?: VimeoPicture): { url: string; width?: number; height?: number } | undefined {
  const choices = (pictures?.sizes ?? [])
    .filter((entry): entry is { width?: number; height?: number; link: string } => Boolean(entry.link))
    .sort((left, right) => (right.width ?? 0) - (left.width ?? 0));
  const preferred = choices.find((entry) => (entry.width ?? 0) <= 1920 && (entry.width ?? 0) >= 960) ?? choices[0];
  return preferred ? { url: preferred.link, width: preferred.width, height: preferred.height } : undefined;
}

export function parseVimeoStaffPicks(payload: VimeoCollection): FrontierItem[] {
  return (payload.data ?? []).flatMap((video) => {
    if (!video.uri || !video.name || !video.link) return [];
    const publishedAt = video.created_time || video.modified_time || new Date().toISOString();
    const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
    const freshness = Math.exp(-ageDays / 8);
    const tags = (video.tags ?? []).flatMap((tag) => tag.name ? [tag.name.toLowerCase()] : []);
    const lane = classifyFrontierLane(`${video.name} ${video.description ?? ''} ${tags.join(' ')}`);
    const quality = clamp(0.88 * (FRONTIER_SOURCE_WEIGHTS.vimeo ?? 1));
    const thumbnail = bestPicture(video.pictures);
    const media: FrontierMedia | undefined = thumbnail
      ? {
          type: 'image',
          url: thumbnail.url,
          alt: video.name,
          width: thumbnail.width,
          height: thumbnail.height,
          aspectRatio: 'landscape',
        }
      : undefined;
    const importance = clamp(0.48 + quality * 0.2 + freshness * 0.12);
    const novelty = clamp(0.6 + freshness * 0.2);
    const momentum = clamp(0.5 + freshness * 0.25);
    const baseScore = clamp(quality * 0.31 + freshness * 0.24 + importance * 0.2 + novelty * 0.13 + momentum * 0.12);
    return [{
      id: `vimeo-${stableId(video.uri)}`,
      title: video.name.trim(),
      summary: (video.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 700),
      url: video.link,
      source: 'vimeo.com',
      sourceLabel: 'Vimeo Staff Picks',
      sourceKind: 'vimeo' as const,
      publishedAt,
      lane,
      tags: Array.from(new Set([...tags.slice(0, 6), 'vimeo', 'staff pick', 'video', lane.replaceAll('_', ' ')])),
      authors: video.user?.name ? [video.user.name] : undefined,
      media,
      metrics: video.duration ? [{ label: 'duration', value: `${Math.round(video.duration / 60)} min` }] : undefined,
      quality,
      importance,
      novelty,
      momentum,
      baseScore,
      why: 'Vimeo Staff Picks is a curated visual-culture signal; FRONTIER uses the real first-party thumbnail and links to the source playback page.',
    }];
  });
}

export async function getVimeoStaffPicksFeed(): Promise<FrontierFeedResponse> {
  const token = process.env.FRONTIER_VIMEO_ACCESS_TOKEN?.trim();
  if (!token) return { generatedAt: new Date().toISOString(), items: [], sources: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = new URL('https://api.vimeo.com/channels/staffpicks/videos');
    url.searchParams.set('per_page', '12');
    url.searchParams.set('page', '1');
    url.searchParams.set('filter', 'content_rating');
    url.searchParams.set('filter_content_rating', 'safe,unrated');
    url.searchParams.set('fields', 'uri,name,description,link,duration,created_time,modified_time,pictures,tags,user.name');
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const items = parseVimeoStaffPicks(await response.json() as VimeoCollection);
    return {
      generatedAt: new Date().toISOString(),
      items,
      sources: [{ id: 'vimeo', label: 'Vimeo Staff Picks', ok: true, count: items.length }],
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      sources: [{
        id: 'vimeo',
        label: 'Vimeo Staff Picks',
        ok: false,
        count: 0,
        message: error instanceof Error ? error.message.slice(0, 120) : 'source unavailable',
      }],
    };
  } finally {
    clearTimeout(timer);
  }
}
