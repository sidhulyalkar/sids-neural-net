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
  /** Native safety-net source used only if the optimized `src` itself fails. */
  fallbackSrc?: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
  aspectRatio?: string;
  onUnavailable?: () => void;
};

type SurfaceSize = { width: number; height: number };

export function GpuImageSurface({
  id,
  src,
  fallbackSrc,
  alt,
  className = '',
  placeholderColor,
  aspectRatio,
  onUnavailable,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const compactSize = useRef<SurfaceSize | undefined>(undefined);
  const expanded = useInlineMediaExpansion();
  const reactId = useId();
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [nativeSrc, setNativeSrc] = useState(src);
  const surfaceStyle = {
    ...(placeholderColor ? { '--frontier-media-placeholder': placeholderColor } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
  } as CSSProperties;
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
    setNativeReady(false);
    setNativeSrc(src);
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
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      // Reserve geometry immediately and ask the shared plane to begin decode
      // before the visual enters the viewport. The native image below is an
      // independent safety layer, so a delayed/evicted GPU texture is never a
      // reason for the card to become visually empty.
      warmFrontierGpuImage(gpuId);
    }, { rootMargin: '200% 0px 200% 0px', threshold: 0 });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [gpuId]);

  useEffect(() => {
    if (fallbackFailed) onUnavailable?.();
  }, [fallbackFailed, onUnavailable]);

  const handleNativeError = () => {
    if (fallbackSrc && fallbackSrc !== nativeSrc) {
      setNativeReady(false);
      setNativeSrc(fallbackSrc);
      return;
    }
    setFallbackFailed(true);
  };

  return (
    <div
      ref={frameRef}
      className={`${styles.imageSurface} ${className}`}
      role="img"
      aria-label={alt}
      data-media-state={state}
      data-media-native-ready={nativeReady ? 'true' : 'false'}
      data-inline-expanded={expanded ? 'true' : 'false'}
      style={surfaceStyle}
    >
      {/* Keep the browser-native image mounted beneath the fixed WebGL plane.
          It starts on the same optimized URL as the GPU fetch, so both paths
          share HTTP cache bytes. Only an actual optimized-source error switches
          the browser layer to the independent upstream fallback. */}
      {!fallbackFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nativeSrc}
          alt=""
          aria-hidden="true"
          className={styles.imageFallback}
          loading="lazy"
          decoding="async"
          fetchPriority="auto"
          referrerPolicy="no-referrer"
          onLoad={() => setNativeReady(true)}
          onError={handleNativeError}
        />
      ) : null}
      <div ref={slotRef} className={styles.gpuRegistrationSlot} aria-hidden="true" />
      {state === 'loading' && !nativeReady ? <span className={styles.imageSheen} aria-hidden="true" /> : null}
    </div>
  );
}
