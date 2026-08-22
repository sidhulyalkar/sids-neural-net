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
  explorationTemperature?: number;
  diversityReference?: FrontierItem[];
  appendStable?: boolean;
  streamEpoch?: number;
  onNearEnd?: () => void;
};

const SEMANTIC_COLD_START = FRONTIER_PINNED_TOPICS
  .slice(0, 24)
  .map((topic) => topic.label)
  .join(' · ');

function priorityFirst(items: FrontierItem[]): FrontierItem[] {
  const priority = items
    .filter((item) => item.highPriority && item.watchSignal)
    .sort((left, right) => (right.watchSignal?.score ?? 0) - (left.watchSignal?.score ?? 0)
      || (right.watchSignal?.triggeredAt ?? 0) - (left.watchSignal?.triggeredAt ?? 0));
  if (!priority.length) return items;
  const priorityIds = new Set(priority.map((item) => item.id));
  return [...priority, ...items.filter((item) => !priorityIds.has(item.id))];
}

function PriorityMarker({ item }: { item: FrontierItem }) {
  if (!item.highPriority || !item.watchSignal) return null;
  return (
    <div className={spatial.priorityMarker} aria-label={`Watch Intent signal: ${item.watchSignal.label}`}>
      <span>Signal</span>
      <span>{item.watchSignal.label}</span>
      <span>{Math.round(item.watchSignal.score * 100)}%</span>
    </div>
  );
}

export function SignalBoard({
  items,
  mode,
  renderCard,
  empty,
  compact = false,
  explorationTemperature = 0,
  diversityReference = [],
  appendStable = false,
  streamEpoch = 0,
  onNearEnd,
}: Props) {
  usePredictivePrefetch();
  const { playSearchResolved } = useUIFrequencies();
  const resolvedSoundQuery = useRef('');
  const endSentinel = useRef<HTMLDivElement | null>(null);
  const nearEndAt = useRef(0);
  const [query, setQuery] = useState(() => getFrontierClientQuery());
  const [stableOrder, setStableOrder] = useState<string[]>([]);

  useEffect(() => {
    const update = (event: Event) => setQuery((event as CustomEvent<string>).detail ?? '');
    window.addEventListener(FRONTIER_CLIENT_QUERY_EVENT, update);
    return () => window.removeEventListener(FRONTIER_CLIENT_QUERY_EVENT, update);
  }, []);

  const semantic = useSemanticReranker(items, {
    query,
    seedText: SEMANTIC_COLD_START,
    enabled: true,
    explorationTemperature,
    diversityReference,
  });

  useEffect(() => {
    setStableOrder([]);
  }, [streamEpoch]);

  useEffect(() => {
    if (!appendStable) {
      setStableOrder([]);
      return;
    }
    setStableOrder((current) => {
      const liveIds = new Set(semantic.items.map((item) => item.id));
      const retained = current.filter((id) => liveIds.has(id));
      const retainedSet = new Set(retained);
      const additions = semantic.items.map((item) => item.id).filter((id) => !retainedSet.has(id));
      const next = [...retained, ...additions];
      return next.join('|') === current.join('|') ? current : next;
    });
  }, [appendStable, semantic.items]);

  const displayedItems = useMemo(() => {
    let ordered: FrontierItem[];
    if (!appendStable || !stableOrder.length) {
      ordered = semantic.items;
    } else {
      const byId = new Map(semantic.items.map((item) => [item.id, item]));
      const stable = stableOrder.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
      const included = new Set(stable.map((item) => item.id));
      ordered = [...stable, ...semantic.items.filter((item) => !included.has(item.id))];
    }
    // Explicit Watch Intents are the one exception to append-only ordering. A
    // high-priority item gets a deterministic Signal slot at the leading edge,
    // while every ambient item keeps its stable relative order.
    return priorityFirst(ordered);
  }, [appendStable, semantic.items, stableOrder]);

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

  useEffect(() => {
    const node = endSentinel.current;
    if (!node || !onNearEnd || typeof IntersectionObserver === 'undefined' || !displayedItems.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      const now = Date.now();
      if (now - nearEndAt.current < 20_000) return;
      nearEndAt.current = now;
      onNearEnd();
    }, { rootMargin: '720px 0px 720px 0px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [displayedItems.length, onNearEnd]);

  return (
    <div className={`${styles.boardShell} ${spatial.board}`} data-vector-backend={semantic.backend} data-exploration={explorationVector.toFixed(3)}>
      {!displayedItems.length ? empty : mode === 'feed' ? (
        <div className={`${styles.readingFeed} ${spatial.feed}`}>
          {displayedItems.map((item) => (
            <div
              key={item.id}
              data-frontier-virtual-card
              data-frontier-priority={item.highPriority ? 'true' : undefined}
              className={`${styles.feedItem} ${spatial.feedItem} ${item.highPriority ? spatial.priorityFeedItem : ''} ${perf.virtualItem} ${perf.feedVirtualItem}`}
            >
              <PriorityMarker item={item} />
              {renderCard(item, 'feed')}
            </div>
          ))}
          <div ref={endSentinel} aria-hidden="true" style={{ height: 1 }} />
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${spatial.grid} ${compact ? styles.signalGridCompact : ''}`}>
          {displayedItems.map((item) => (
            <div
              key={item.id}
              data-frontier-virtual-card
              data-frontier-priority={item.highPriority ? 'true' : undefined}
              className={`${styles.gridItem} ${spatial.item} ${item.highPriority ? spatial.priorityItem : ''} ${perf.virtualItem}`}
            >
              <PriorityMarker item={item} />
              {renderCard(item, 'desk')}
            </div>
          ))}
          <div ref={endSentinel} aria-hidden="true" style={{ height: 1 }} />
        </div>
      )}
    </div>
  );
}
