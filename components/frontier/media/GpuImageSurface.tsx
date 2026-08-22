'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { registerFrontierPrefetchTarget } from '@/lib/frontier/media/streamPrefetcher';
import { registerFrontierGpuImage, warmFrontierGpuImage } from './mediaPlane';
import { useInlineMediaExpansion } from './InlineMediaSurface';
import styles from './frontier-media.module.css';

type Props = {
  id: string;
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  onUnavailable?: () => void;
};

type SurfaceSize = { width: number; height: number };

export function GpuImageSurface({ id, src, alt, className = '', placeholderColor, onUnavailable }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const compactSize = useRef<SurfaceSize>();
  const expanded = useInlineMediaExpansion();
  const reactId = useId();
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const surfaceStyle = placeholderColor
    ? ({ '--frontier-media-placeholder': placeholderColor } as CSSProperties)
    : undefined;
  const gpuId = `${id}:${reactId}`;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const remember = () => {
      if (expanded) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width >= 2 && rect.height >= 2) compactSize.current = { width: rect.width, height: rect.height };
    };
    remember();
    const observer = new ResizeObserver(remember);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [expanded]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const slot = slotRef.current;
    if (!frame || !slot) return;
    if (!expanded) {
      slot.style.width = '100%';
      slot.style.height = '100%';
      slot.style.transform = '';
      return;
    }

    const target = frame.getBoundingClientRect();
    const base = compactSize.current;
    if (!base || base.width < 2 || base.height < 2 || target.width < 2 || target.height < 2) return;
    slot.style.width = `${base.width}px`;
    slot.style.height = `${base.height}px`;
    slot.style.transform = `scale(${target.width / base.width}, ${target.height / base.height})`;
  }, [expanded]);

  useEffect(() => {
    const slot = slotRef.current;
    const frame = frameRef.current;
    if (!slot || !frame || !src) return;
    setState('loading');
    setFallbackFailed(false);
    const unregisterGpu = registerFrontierGpuImage({
      id: gpuId,
      node: slot,
      src,
      onState: setState,
    });
    const unregisterPrefetch = registerFrontierPrefetchTarget({
      id: `image:${gpuId}`,
      kind: 'image',
      node: frame,
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
      ref={frameRef}
      className={`${styles.imageSurface} ${className}`}
      role="img"
      aria-label={alt}
      data-media-state={state}
      data-inline-expanded={expanded ? 'true' : 'false'}
      style={surfaceStyle}
    >
      <div ref={slotRef} className={styles.gpuRegistrationSlot} aria-hidden="true" />
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
