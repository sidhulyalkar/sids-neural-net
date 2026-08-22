'use client';

import type { ReactNode } from 'react';
import type { FrontierItem, FrontierLayoutMode } from '@/lib/frontier/types';
import { usePredictivePrefetch } from './media/usePredictivePrefetch';
import styles from './frontier-minimal.module.css';
import perf from './signal-board-performance.module.css';

export type SignalLayoutMode = FrontierLayoutMode;

type Props = {
  items: FrontierItem[];
  mode: SignalLayoutMode;
  renderCard: (item: FrontierItem, mode: SignalLayoutMode) => ReactNode;
  empty?: ReactNode;
  compact?: boolean;
};

export function SignalBoard({ items, mode, renderCard, empty, compact = false }: Props) {
  usePredictivePrefetch();

  return (
    <div className={styles.boardShell}>
      {!items.length ? empty : mode === 'feed' ? (
        <div className={styles.readingFeed}>
          {items.map((item) => (
            <div key={item.id} data-frontier-virtual-card className={`${styles.feedItem} ${perf.virtualItem} ${perf.feedVirtualItem}`}>
              {renderCard(item, 'feed')}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${compact ? styles.signalGridCompact : ''}`}>
          {items.map((item) => (
            <div key={item.id} data-frontier-virtual-card className={`${styles.gridItem} ${perf.virtualItem}`}>
              {renderCard(item, 'desk')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
