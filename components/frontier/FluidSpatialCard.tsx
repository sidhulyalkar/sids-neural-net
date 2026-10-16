'use client';

import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  frontierCanAnalyzeMediaElement,
  primeFrontierAudioReactivity,
} from '@/lib/frontier/audio/audioReactivity';
import { markFrontierItemSeen } from '@/lib/frontier/live/seenLedger';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierItem } from '@/lib/frontier/types';
import { useExpandedAudioReactivity } from './audio/useExpandedAudioReactivity';
import { FrontierInlineFocal } from './FrontierInlineFocal';
import { InlineMediaSurface } from './media/InlineMediaSurface';
import { useDeterministicMasonry } from './useDeterministicMasonry';
import { useFluidInteraction } from './useFluidInteraction';
import styles from './frontier-fluid-interaction.module.css';

type Props = {
  item: FrontierItem;
  expanded: boolean;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
  onExpand: (item: FrontierItem) => void;
  onCollapse: (item: FrontierItem) => void;
  onExternalOpen?: (item: FrontierItem) => void;
};

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
  style,
  children,
  onExpand,
  onCollapse,
  onExternalOpen,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const recordOpen = useFrontierStore((state) => state.recordOpen);
  useExpandedAudioReactivity(rootRef, expanded);
  useDeterministicMasonry({ itemId: item.id, expanded, rootRef, measureRef });
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

  return (
    <div
      ref={rootRef}
      data-frontier-fluid-card={item.id}
      data-frontier-virtual-card
      data-fluid-expanded={expanded ? 'true' : 'false'}
      className={`${className} ${styles.card} ${expanded ? styles.expanded : ''}`}
      style={style}
      {...interaction}
    >
      <div ref={measureRef} className={styles.measure}>
        <InlineMediaSurface expanded={expanded}>{children}</InlineMediaSurface>
        {expanded ? <FrontierInlineFocal item={item} onCollapse={() => onCollapse(item)} /> : null}
      </div>
    </div>
  );
}
