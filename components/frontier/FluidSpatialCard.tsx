'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  frontierCanAnalyzeMediaElement,
  primeFrontierAudioReactivity,
} from '@/lib/frontier/audio/audioReactivity';
import { markFrontierItemSeen } from '@/lib/frontier/live/seenLedger';
import { frontierMasonrySpan } from '@/lib/frontier/presentation/mediaForward';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierItem } from '@/lib/frontier/types';
import { useExpandedAudioReactivity } from './audio/useExpandedAudioReactivity';
import { FrontierInlineFocal } from './FrontierInlineFocal';
import { InlineMediaSurface } from './media/InlineMediaSurface';
import { useFluidInteraction } from './useFluidInteraction';
import styles from './frontier-fluid-interaction.module.css';

type Props = {
  item: FrontierItem;
  expanded: boolean;
  className: string;
  children: ReactNode;
  onExpand: (item: FrontierItem) => void;
  onCollapse: (item: FrontierItem) => void;
  onExternalOpen?: (item: FrontierItem) => void;
};

function cssNumber(node: HTMLElement, property: string, fallback: number): number {
  const parsed = Number.parseFloat(getComputedStyle(node).getPropertyValue(property));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function primeSafeNativeMedia(root: HTMLElement | null) {
  if (!root) return;
  const media = root.querySelectorAll<HTMLMediaElement>('video, audio');
  for (const element of media) {
    if (!frontierCanAnalyzeMediaElement(element)) continue;
    primeFrontierAudioReactivity();
    return;
  }
}

export function FluidSpatialCard({
  item,
  expanded,
  className,
  children,
  onExpand,
  onCollapse,
  onExternalOpen,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const recordOpen = useFrontierStore((state) => state.recordOpen);
  useExpandedAudioReactivity(rootRef, expanded);
  const interaction = useFluidInteraction({
    item,
    expanded,
    onExpand: (next) => {
      // This callback still runs inside the trusted pointer release. Unlock the
      // shared AudioContext here only when the card already owns safe native
      // media; analyser/source-node wiring remains expansion-scoped in the hook.
      primeSafeNativeMedia(rootRef.current);
      void markFrontierItemSeen(next, 'expand').catch(() => undefined);
      onExpand(next);
    },
    onCollapse,
    onExternalOpen: (next) => {
      void markFrontierItemSeen(next, 'open').catch(() => undefined);
      recordOpen(next);
      onExternalOpen?.(next);
    },
  });

  const syncMasonrySpan = useCallback(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const height = Math.max(measure.scrollHeight, measure.getBoundingClientRect().height);
    const rowHeight = cssNumber(root, '--frontier-masonry-row-height', 8);
    const rowGap = cssNumber(root, '--frontier-masonry-row-gap', 10);
    root.style.setProperty('--frontier-masonry-span', String(frontierMasonrySpan(height, rowHeight, rowGap)));
  }, []);

  useLayoutEffect(() => {
    syncMasonrySpan();
  }, [expanded, syncMasonrySpan]);

  useEffect(() => {
    const measure = measureRef.current;
    if (!measure || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => syncMasonrySpan());
    observer.observe(measure);
    return () => observer.disconnect();
  }, [syncMasonrySpan]);

  return (
    <div
      ref={rootRef}
      data-frontier-fluid-card={item.id}
      data-frontier-virtual-card
      data-fluid-expanded={expanded ? 'true' : 'false'}
      className={`${className} ${styles.card} ${expanded ? styles.expanded : ''}`}
      {...interaction}
    >
      <div ref={measureRef} className={styles.measure}>
        <InlineMediaSurface expanded={expanded}>{children}</InlineMediaSurface>
        {expanded ? <FrontierInlineFocal item={item} /> : null}
      </div>
    </div>
  );
}
