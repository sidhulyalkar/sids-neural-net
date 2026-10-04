import manifest from './visualMotionManifest.json';

type VisualMotionManifestEntry = {
  id: string;
  title: string;
  description?: string;
  alt?: string;
  collection?: string;
  location?: string;
  capturedWith?: string;
  date?: string;
  tags?: string[];
  featured?: boolean;
  published: boolean;
  durationSeconds: number;
  width: number;
  height: number;
  posterTimeSeconds?: number;
  mux?: {
    playbackId?: string;
  };
};

export type VisualMotionEntry = {
  id: string;
  title: string;
  description?: string;
  posterSrc: string;
  alt: string;
  durationSeconds: number;
  aspectRatio: `${number} / ${number}`;
  width: number;
  height: number;
  resolutionLabel: string;
  playbackId: string;
  capturedWith?: string;
  location?: string;
  collection?: string;
  date?: string;
  tags?: string[];
  featured?: boolean;
};

function resolutionLabel(width: number, height: number) {
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  if (longEdge >= 3840 || shortEdge >= 2160) return '4K';
  if (longEdge >= 2560 || shortEdge >= 1440) return '1440p';
  if (longEdge >= 1920 || shortEdge >= 1080) return '1080p';
  return `${shortEdge}p`;
}

export function muxPosterUrl(playbackId: string, timeSeconds = 0) {
  const params = new URLSearchParams({
    time: String(Math.max(0, timeSeconds)),
    width: '1600',
  });
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.webp?${params.toString()}`;
}

export function muxPlayerUrl(playbackId: string, title: string, videoId: string) {
  const params = new URLSearchParams({
    title,
    'metadata-video-title': title,
    'metadata-video-id': videoId,
    preload: 'metadata',
    'accent-color': '#5bdeff',
  });
  return `https://player.mux.com/${encodeURIComponent(playbackId)}?${params.toString()}`;
}

/**
 * Public motion records for the Visual Cortex.
 *
 * The checked-in JSON manifest is written by scripts/mux-visual-motion.mjs.
 * It contains compact provenance and Mux IDs, never source video bytes or
 * credentials. Only explicitly published records cross the server/client
 * boundary.
 */
export const visualMotion: VisualMotionEntry[] = (manifest as VisualMotionManifestEntry[])
  .filter((entry) => entry.published && entry.mux?.playbackId)
  .map((entry) => {
    const playbackId = entry.mux!.playbackId!;
    const width = Math.max(1, Number(entry.width));
    const height = Math.max(1, Number(entry.height));
    return {
      id: entry.id,
      title: entry.title,
      description: entry.description,
      posterSrc: muxPosterUrl(playbackId, entry.posterTimeSeconds ?? 0),
      alt: entry.alt ?? `${entry.title} video still${entry.location ? ` from ${entry.location}` : ''}`,
      durationSeconds: entry.durationSeconds,
      aspectRatio: `${width} / ${height}` as `${number} / ${number}`,
      width,
      height,
      resolutionLabel: resolutionLabel(width, height),
      playbackId,
      capturedWith: entry.capturedWith,
      location: entry.location,
      collection: entry.collection,
      date: entry.date,
      tags: entry.tags,
      featured: entry.featured,
    };
  })
  .sort((a, b) => {
    const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDelta) return featuredDelta;
    if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
    return a.title.localeCompare(b.title);
  });
