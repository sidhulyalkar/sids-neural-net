'use client';

import type { ReactNode } from 'react';
import { markFrontierItemSeen } from '@/lib/frontier/live/seenLedger';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierItem } from '@/lib/frontier/types';
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

export function FluidSpatialCard({
  item,
  expanded,
  className,
  children,
  onExpand,
  onCollapse,
  onExternalOpen,
}: Props) {
  const recordOpen = useFrontierStore((state) => state.recordOpen);
  const interaction = useFluidInteraction({
    item,
    expanded,
    onExpand: (next) => {
      void markFrontierItemSeen(next, 'expand').catch(() => undefined);
      onExpand(next);
    },
    onCollapse,
    onExternalOpen: (next) => {
      void markFrontierItemSeen(next, 'open').catch(() => undefined);
      // A canonical external open is explicit behavior authority. The preceding
      // inline expansion remains presentation-only and never calls recordExpand.
      recordOpen(next);
      onExternalOpen?.(next);
    },
  });

  return (
    <div
      data-frontier-fluid-card={item.id}
      data-frontier-virtual-card
      data-fluid-expanded={expanded ? 'true' : 'false'}
      className={`${className} ${styles.card} ${expanded ? styles.expanded : ''}`}
      {...interaction}
    >
      <InlineMediaSurface expanded={expanded}>{children}</InlineMediaSurface>
      {expanded ? <FrontierInlineFocal item={item} /> : null}
    </div>
  );
}
