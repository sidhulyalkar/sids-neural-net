'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { registerFrontierPrefetchTarget } from '@/lib/frontier/media/streamPrefetcher';
import { registerFrontierGpuImage, warmFrontierGpuImage } from './mediaPlane';
import styles from './frontier-media.module.css';

type Props = {
  id: string;
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  onUnavailable?: () => void;
};

export function GpuImageSurface({ id, src, alt, className = '', placeholderColor, onUnavailable }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const surfaceStyle = placeholderColor
    ? ({ '--frontier-media-placeholder': placeholderColor } as CSSProperties)
    : undefined;
  const gpuId = `${id}:${reactId}`;

  useEffect(() => {
    const node = slotRef.current;
    if (!node || !src) return;
    setState('loading');
    setFallbackFailed(false);
    const unregisterGpu = registerFrontierGpuImage({
      id: gpuId,
      node,
      src,
      onState: setState,
    });
    const unregisterPrefetch = registerFrontierPrefetchTarget({
      id: `image:${gpuId}`,
      kind: 'image',
      node,
      warm: () => warmFrontierGpuImage(gpuId),
    });
    return () => {
      unregisterPrefetch();
      unregisterGpu();
    };
  }, [gpuId, src]);

  useEffect(() => {
    if (fallbackFailed) onUnavailable?.();
  }, [fallbackFailed, onUnavailable]);

  return (
    <div
      ref={slotRef}
      className={`${styles.imageSurface} ${className}`}
      role="img"
      aria-label={alt}
      data-media-state={state}
      style={surfaceStyle}
    >
      {state === 'fallback' && !fallbackFailed ? (
        // The native element exists only after the GPU/worker path declines the
        // asset, avoiding two simultaneous decodes for every successful image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className={styles.imageFallback}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFallbackFailed(true)}
        />
      ) : null}
      {state === 'loading' ? <span className={styles.imageSheen} aria-hidden="true" /> : null}
    </div>
  );
}
