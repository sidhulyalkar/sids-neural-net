'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { registerFrontierGpuImage } from './mediaPlane';
import styles from './frontier-media.module.css';

type Props = {
  id: string;
  src: string;
  alt: string;
  className?: string;
  onUnavailable?: () => void;
};

export function GpuImageSurface({ id, src, alt, className = '', onUnavailable }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    const node = slotRef.current;
    if (!node || !src) return;
    setState('loading');
    setFallbackFailed(false);
    return registerFrontierGpuImage({
      id: `${id}:${reactId}`,
      node,
      src,
      onState: setState,
    });
  }, [id, reactId, src]);

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
    >
      {state !== 'ready' && !fallbackFailed ? (
        // Publisher/community images remain the resilient fallback when cross-origin
        // fetch/decode cannot enter the GPU path.
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
