'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ambientExplorationVector, emitFrontierAmbientExploration } from '@/lib/frontier/ambientState';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import type { FrontierItem, FrontierLayoutMode } from '@/lib/frontier/types';
import { FRONTIER_CLIENT_QUERY_EVENT, getFrontierClientQuery } from '@/lib/frontier/vector/clientQuery';
import { useUIFrequencies } from './audio/useUIFrequencies';
import { usePredictivePrefetch } from './media/usePredictivePrefetch';
import { useSemanticReranker } from './vector/useSemanticReranker';
import styles from './frontier-minimal.module.css';
import spatial from './frontier-spatial-feed.module.css';
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
  const { playSearchResolved } = useUIFrequencies();
  const resolvedSoundQuery = useRef('');
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
  const explorationVector = useMemo(() => ambientExplorationVector(displayedItems), [displayedItems]);

  useEffect(() => {
    emitFrontierAmbientExploration(explorationVector);
  }, [explorationVector]);

  useEffect(() => {
    const key = query.trim().toLowerCase();
    if (!key) {
      resolvedSoundQuery.current = '';
      return;
    }
    if (displayedItems.length && resolvedSoundQuery.current !== key) {
      resolvedSoundQuery.current = key;
      playSearchResolved();
    }
  }, [displayedItems.length, itemSignature, playSearchResolved, query]);

  return (
    <div className={`${styles.boardShell} ${spatial.board}`} data-vector-backend={semantic.backend} data-exploration={explorationVector.toFixed(3)}>
      {!displayedItems.length ? empty : mode === 'feed' ? (
        <div className={`${styles.readingFeed} ${spatial.feed}`}>
          {displayedItems.map((item) => (
            <div key={item.id} data-frontier-virtual-card className={`${styles.feedItem} ${spatial.feedItem} ${perf.virtualItem} ${perf.feedVirtualItem}`}>
              {renderCard(item, 'feed')}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${spatial.grid} ${compact ? styles.signalGridCompact : ''}`}>
          {displayedItems.map((item) => (
            <div key={item.id} data-frontier-virtual-card className={`${styles.gridItem} ${spatial.item} ${perf.virtualItem}`}>
              {renderCard(item, 'desk')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
