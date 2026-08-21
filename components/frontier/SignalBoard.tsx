'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LayoutGrid, Rows3 } from 'lucide-react';
import type { FrontierItem, FrontierLayoutMode } from '@/lib/frontier/types';
import styles from './frontier-minimal.module.css';

export type SignalLayoutMode = FrontierLayoutMode;

type Props = {
  items: FrontierItem[];
  renderCard: (item: FrontierItem, mode: SignalLayoutMode) => ReactNode;
  empty?: ReactNode;
  compact?: boolean;
  onLayoutChange?: (mode: SignalLayoutMode) => void;
};

export function SignalBoard({ items, renderCard, empty, compact = false, onLayoutChange }: Props) {
  const [mode, setMode] = useState<SignalLayoutMode>('desk');

  useEffect(() => {
    const saved = window.localStorage.getItem('frontier-layout-mode');
    const preferred = saved === 'feed' || saved === 'desk' ? saved : 'desk';
    const resolved = window.innerWidth < 720 ? 'feed' : preferred;
    setMode(resolved);
    onLayoutChange?.(resolved);
  }, [onLayoutChange]);

  const switchMode = (next: SignalLayoutMode) => {
    setMode(next);
    window.localStorage.setItem('frontier-layout-mode', next);
    onLayoutChange?.(next);
  };

  return (
    <div className={styles.boardShell}>
      <div className={styles.layoutBar} aria-label="Signal layout">
        <button
          type="button"
          className={`${styles.layoutButton} ${mode === 'desk' ? styles.layoutActive : ''}`}
          onClick={() => switchMode('desk')}
          title="Arrange signals in a calm visual grid"
        >
          <LayoutGrid size={13} /> Grid
        </button>
        <button
          type="button"
          className={`${styles.layoutButton} ${mode === 'feed' ? styles.layoutActive : ''}`}
          onClick={() => switchMode('feed')}
          title="Arrange signals in a compact reading list"
        >
          <Rows3 size={13} /> List
        </button>
      </div>

      {!items.length ? empty : mode === 'feed' ? (
        <div className={styles.readingFeed}>
          {items.map((item) => <div key={item.id} className={styles.feedItem}>{renderCard(item, 'feed')}</div>)}
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${compact ? styles.signalGridCompact : ''}`}>
          {items.map((item) => (
            <div key={item.id} className={styles.gridItem}>
              {renderCard(item, 'desk')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
