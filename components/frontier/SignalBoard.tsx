'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import type { FrontierItem, FrontierLayoutMode } from '@/lib/frontier/types';
import { FRONTIER_CLIENT_QUERY_EVENT, getFrontierClientQuery } from '@/lib/frontier/vector/clientQuery';
import { usePredictivePrefetch } from './media/usePredictivePrefetch';
import { useSemanticReranker } from './vector/useSemanticReranker';
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

const SEMANTIC_COLD_START = FRONTIER_PINNED_TOPICS
  .slice(0, 24)
  .map((topic) => topic.label)
  .join(' · ');

export function SignalBoard({ items, mode, renderCard, empty, compact = false }: Props) {
  usePredictivePrefetch();
  const [query, setQuery] = useState(() => getFrontierClientQuery());

  useEffect(() => {
    const update = (event: Event) => setQuery((event as CustomEvent<string>).detail ?? '');
    window.addEventListener(FRONTIER_CLIENT_QUERY_EVENT, update);
    return () => window.removeEventListener(FRONTIER_CLIENT_QUERY_EVENT, update);
  }, []);

  const semantic = useSemanticReranker(items, {
    query,
    seedText: SEMANTIC_COLD_START,
    enabled: true,
  });
  const displayedItems = semantic.items;
  const itemSignature = useMemo(() => displayedItems.map((item) => item.id).join('|'), [displayedItems]);
  void itemSignature;

  return (
    <div className={styles.boardShell} data-vector-backend={semantic.backend}>
      {!displayedItems.length ? empty : mode === 'feed' ? (
        <div className={styles.readingFeed}>
          {displayedItems.map((item) => (
            <div key={item.id} data-frontier-virtual-card className={`${styles.feedItem} ${perf.virtualItem} ${perf.feedVirtualItem}`}>
              {renderCard(item, 'feed')}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${compact ? styles.signalGridCompact : ''}`}>
          {displayedItems.map((item) => (
            <div key={item.id} data-frontier-virtual-card className={`${styles.gridItem} ${perf.virtualItem}`}>
              {renderCard(item, 'desk')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
