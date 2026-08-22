'use client';

import type { ReactNode } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import { FrontierInlineFocal } from './FrontierInlineFocal';
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
  const interaction = useFluidInteraction({
    item,
    expanded,
    onExpand,
    onCollapse,
    onExternalOpen,
  });

  return (
    <div
      data-frontier-fluid-card={item.id}
      data-frontier-virtual-card
      data-fluid-expanded={expanded ? 'true' : 'false'}
      className={`${className} ${styles.card} ${expanded ? styles.expanded : ''}`}
      {...interaction}
    >
      {children}
      {expanded ? <FrontierInlineFocal item={item} /> : null}
    </div>
  );
}
