'use client';

import { useRef, useState } from 'react';
import { frontierMediaGeometry } from '@/lib/frontier/media/geometry';
import { isFrontierGithubSocialPreview } from '@/lib/frontier/media/sourceVisuals';
import type { FrontierItem } from '@/lib/frontier/types';
import { AdaptiveVideoSurface } from './AdaptiveVideoSurface';
import { GpuImageSurface } from './GpuImageSurface';
import { useMediaVisibility } from './useMediaVisibility';
import styles from './frontier-media.module.css';

type MediaRenderMode = 'lightweight' | 'rich';

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
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={styles.nativeImageSurface}
      style={{ aspectRatio }}
      data-media-state={failed ? 'fallback' : 'native'}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={styles.nativeImage}
          loading="lazy"
          decoding="async"
          fetchPriority="auto"
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(true);
            onUnavailable?.();
          }}
        />
      ) : (
        <span className={styles.imageUnavailable} aria-label={`Visual unavailable: ${alt}`}>
          source visual unavailable
        </span>
      )}
    </div>
  );
}

function LightweightVideoPlaceholder({ item }: { item: FrontierItem }) {
  const media = item.media;
  if (!media || media.type !== 'video') return null;
  const aspectRatio = frontierMediaGeometry(media).cssAspectRatio;
  return (
    <div className={styles.nativeImageSurface} style={{ aspectRatio }} data-media-state="poster-unavailable">
      <span className={styles.imageUnavailable}>video · open source</span>
    </div>
  );
}

function YouTubeSurface({ item, onUnavailable }: { item: FrontierItem; onUnavailable?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const visibility = useMediaVisibility(ref);
  const media = item.media;
  if (!media || media.type !== 'youtube' || !isYouTubeId(media.url)) return null;
  const aspectRatio = frontierMediaGeometry(media).cssAspectRatio;
  const maxResPoster = localProxyUrl(`https://i.ytimg.com/vi/${media.url}/maxresdefault.jpg`);
  const hqPoster = localProxyUrl(`https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`);

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
          src={maxResPoster}
          fallbackSrc={hqPoster}
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

function LightweightMediaSurface({ item, onUnavailable }: { item: FrontierItem; onUnavailable?: () => void }) {
  const media = item.media;
  if (!media || !canRenderFrontierMedia(item)) return null;
  const aspectRatio = frontierMediaGeometry(media).cssAspectRatio;

  if (media.type === 'image') {
    const src = media.proxyUrl ?? media.url;
    if (!isMediaUrl(src)) return null;
    return (
      <NativeImageSurface
        src={src}
        alt={media.alt || item.title}
        aspectRatio={aspectRatio}
        onUnavailable={onUnavailable}
      />
    );
  }

  if (media.type === 'youtube' && isYouTubeId(media.url)) {
    const poster = localProxyUrl(`https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`);
    return (
      <NativeImageSurface
        src={poster}
        alt={media.alt || item.title}
        aspectRatio={aspectRatio}
        onUnavailable={onUnavailable}
      />
    );
  }

  if (media.type === 'video') {
    const poster = media.posterProxyUrl ?? media.poster;
    if (isMediaUrl(poster)) {
      return (
        <NativeImageSurface
          src={poster}
          alt={media.alt || item.title}
          aspectRatio={aspectRatio}
          onUnavailable={onUnavailable}
        />
      );
    }
    return <LightweightVideoPlaceholder item={item} />;
  }

  return null;
}

export function FrontierMediaSurface({
  item,
  onUnavailable,
  mode = 'lightweight',
}: {
  item: FrontierItem;
  onUnavailable?: () => void;
  mode?: MediaRenderMode;
}) {
  if (mode === 'lightweight') return <LightweightMediaSurface item={item} onUnavailable={onUnavailable} />;

  const media = item.media;
  if (!media || !canRenderFrontierMedia(item)) return null;
  const aspectRatio = frontierMediaGeometry(media).cssAspectRatio;

  if (media.type === 'image') {
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
          fallbackSrc={isHttpUrl(media.url) ? media.url : gpuSource}
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
        posterFallback={isHttpUrl(media.poster) ? media.poster : undefined}
        streams={media.streams}
        alt={media.alt || item.title}
        aspectRatio={aspectRatio}
        onUnavailable={onUnavailable}
      />
    );
  }

  return null;
}