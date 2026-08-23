'use client';

import { useRef } from 'react';
import { frontierMediaGeometry } from '@/lib/frontier/media/geometry';
import { isFrontierGithubSocialPreview } from '@/lib/frontier/media/sourceVisuals';
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

function isSameOriginMediaPath(value?: string): value is string {
  return Boolean(value?.startsWith('/'));
}

function isMediaUrl(value?: string): value is string {
  return Boolean(value && (isSameOriginMediaPath(value) || isHttpUrl(value)));
}

function isYouTubeId(value?: string): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{6,20}$/.test(value));
}

function localProxyUrl(url: string): string {
  return `/api/frontier/media?url=${encodeURIComponent(url)}`;
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
  // Historical GitHub cards carried owner avatars. Keep rejecting those weak
  // visuals; only repository-level previews derived from the canonical source
  // may become project media.
  if (item.sourceKind === 'github' && media.type === 'image' && !isFrontierGithubSocialPreview(media.url)) return false;
  if (media.type === 'youtube') return isYouTubeId(media.url);
  if (media.type === 'video') return Boolean(isHttpUrl(media.url) || media.streams?.length);
  return isMediaUrl(media.proxyUrl ?? media.url);
}

function NativeImageSurface({
  src,
  alt,
  aspectRatio,
  onUnavailable,
}: {
  src: string;
  alt: string;
  aspectRatio: string;
  onUnavailable?: () => void;
}) {
  return (
    <div className={styles.nativeImageSurface} style={{ aspectRatio }}>
      {/* Cross-origin publisher imagery that is not in FRONTIER's trusted proxy
          set remains a browser-native fallback rather than weakening SSRF/CORS boundaries. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={styles.nativeImage}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onUnavailable}
      />
    </div>
  );
}

function YouTubeSurface({ item, onUnavailable }: { item: FrontierItem; onUnavailable?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const visibility = useMediaVisibility(ref);
  const media = item.media;
  if (!media || media.type !== 'youtube' || !isYouTubeId(media.url)) return null;
  const aspectRatio = frontierMediaGeometry(media).cssAspectRatio;
  const defaultPoster = `https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`;
  const poster = isMediaUrl(media.posterProxyUrl)
    ? media.posterProxyUrl
    : isHttpUrl(media.poster)
      ? media.poster
      : localProxyUrl(defaultPoster);

  return (
    <div ref={ref} className={styles.youtubeSurface} style={{ aspectRatio }}>
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
        <GpuImageSurface
          id={`${item.id}:youtube`}
          src={poster}
          alt={media.alt || item.title}
          className={styles.posterSurface}
          placeholderColor={media.averageColor}
          aspectRatio={aspectRatio}
          onUnavailable={onUnavailable}
        />
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
  const aspectRatio = frontierMediaGeometry(media).cssAspectRatio;

  if (media.type === 'image') {
    // Same-origin archive imagery is already inside FRONTIER's trust boundary.
    // Route it through the GPU plane directly rather than treating it like an
    // unknown publisher URL. A previous branch accepted these URLs during
    // presentation classification but then returned null here, leaving a media
    // card with reserved geometry and no actual visual surface.
    const gpuSource = isMediaUrl(media.proxyUrl)
      ? media.proxyUrl
      : isSameOriginMediaPath(media.url)
        ? media.url
        : undefined;
    if (gpuSource) {
      return (
        <GpuImageSurface
          id={`${item.id}:image`}
          src={gpuSource}
          alt={media.alt || item.title}
          className={styles.primaryImage}
          placeholderColor={media.averageColor}
          aspectRatio={aspectRatio}
          onUnavailable={onUnavailable}
        />
      );
    }
    if (!isHttpUrl(media.url)) return null;
    return (
      <NativeImageSurface
        src={media.url}
        alt={media.alt || item.title}
        aspectRatio={aspectRatio}
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
        aspectRatio={aspectRatio}
        onUnavailable={onUnavailable}
      />
    );
  }

  return null;
}
