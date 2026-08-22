'use client';

import { useRef } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import { AdaptiveVideoSurface } from './AdaptiveVideoSurface';
import { GpuImageSurface } from './GpuImageSurface';
import { useMediaVisibility } from './useMediaVisibility';
import styles from './frontier-media.module.css';

function isHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isMediaUrl(value?: string): value is string {
  return Boolean(value && (value.startsWith('/') || isHttpUrl(value)));
}

function isYouTubeId(value?: string): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{6,20}$/.test(value));
}

export function frontierMediaKey(item: FrontierItem): string {
  return [
    item.id,
    item.media?.type,
    item.media?.url,
    item.media?.proxyUrl,
    item.media?.poster,
    item.media?.posterProxyUrl,
  ].join('|');
}

export function canRenderFrontierMedia(item: FrontierItem): boolean {
  const media = item.media;
  if (!media || media.type === 'none' || media.type === 'chart') return false;
  if (item.sourceKind === 'github' && media.type === 'image') return false;
  if (media.type === 'youtube') return isYouTubeId(media.url);
  if (media.type === 'video') return Boolean(isHttpUrl(media.url) || media.streams?.length);
  return isMediaUrl(media.proxyUrl ?? media.url);
}

function YouTubeSurface({ item, onUnavailable }: { item: FrontierItem; onUnavailable?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const visibility = useMediaVisibility(ref);
  const media = item.media;
  if (!media || media.type !== 'youtube' || !isYouTubeId(media.url)) return null;
  const poster = isMediaUrl(media.posterProxyUrl)
    ? media.posterProxyUrl
    : isHttpUrl(media.poster)
      ? media.poster
      : `https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`;

  return (
    <div ref={ref} className={styles.youtubeSurface}>
      {visibility === 'active' ? (
        <iframe
          title={`Video: ${item.title}`}
          src={`https://www.youtube-nocookie.com/embed/${media.url}?rel=0&modestbranding=1`}
          className={styles.youtubeFrame}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <GpuImageSurface id={`${item.id}:youtube`} src={poster} alt={media.alt || item.title} className={styles.posterSurface} onUnavailable={onUnavailable} />
      )}
    </div>
  );
}

export function FrontierMediaSurface({
  item,
  onUnavailable,
}: {
  item: FrontierItem;
  onUnavailable?: () => void;
}) {
  const media = item.media;
  if (!media || !canRenderFrontierMedia(item)) return null;

  if (media.type === 'image') {
    const src = media.proxyUrl ?? media.url;
    if (!isMediaUrl(src)) return null;
    return (
      <GpuImageSurface
        id={`${item.id}:image`}
        src={src}
        alt={media.alt || item.title}
        className={styles.primaryImage}
        onUnavailable={onUnavailable}
      />
    );
  }

  if (media.type === 'youtube') return <YouTubeSurface item={item} onUnavailable={onUnavailable} />;

  if (media.type === 'video') {
    const poster = media.posterProxyUrl ?? media.poster;
    return (
      <AdaptiveVideoSurface
        id={`${item.id}:video`}
        url={isHttpUrl(media.url) ? media.url : undefined}
        poster={isMediaUrl(poster) ? poster : undefined}
        streams={media.streams}
        alt={media.alt || item.title}
        onUnavailable={onUnavailable}
      />
    );
  }

  return null;
}
