'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ambientExplorationVector, emitFrontierAmbientExploration } from '@/lib/frontier/ambientState';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import {
  frontierPackedColumnSpans,
  frontierVisualRole,
  type FrontierVisualRole,
} from '@/lib/frontier/presentation/mediaForward';
import {
  isFrontierTypingTarget,
  resolveFrontierFocalKeyboardIntent,
} from '@/lib/frontier/synthesis/focalPlane';
import type { FrontierItem, FrontierLayoutMode } from '@/lib/frontier/types';
import { FRONTIER_CLIENT_QUERY_EVENT, getFrontierClientQuery } from '@/lib/frontier/vector/clientQuery';
import { useUIFrequencies } from './audio/useUIFrequencies';
import { FluidSpatialCard } from './FluidSpatialCard';
import { FrontierIntelligenceBadges } from './FrontierIntelligenceBadges';
import { canRenderFrontierMedia } from './media/FrontierMediaSurface';
import { usePredictivePrefetch } from './media/usePredictivePrefetch';
import { useFrontierSynthesis } from './synthesis/useFrontierSynthesis';
import { useAdaptiveReadingDensity } from './useAdaptiveReadingDensity';
import { useSemanticReranker } from './vector/useSemanticReranker';
import { useSpatialFlip } from './useSpatialFlip';
import densityStyles from './frontier-adaptive-density.module.css';
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
  synthesis?: boolean;
  /** Test/audit escape hatch. Production callers should keep semantic ranking enabled. */
  semanticEnabled?: boolean;
  onFluidExpand?: (item: FrontierItem) => void;
  onFluidExternalOpen?: (item: FrontierItem) => void;
};

const SEMANTIC_COLD_START = FRONTIER_PINNED_TOPICS
  .slice(0, 24)
  .map((topic) => topic.label)
  .join(' · ');

const VISUAL_ROLE_CLASS: Record<FrontierVisualRole, string> = {
  hero: spatial.heroItem,
  wide: spatial.wideItem,
  visual: spatial.visualItem,
  standard: spatial.standardItem,
  compact: spatial.compactItem,
};

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

function VelocityMarker({ item }: { item: FrontierItem }) {
  if (!item.velocitySignal || item.highPriority) return null;
  return (
    <div className={spatial.velocityMarker} aria-label={`Emerging signal: ${item.velocitySignal.concept}`}>
      <span>Pulse</span>
      <span>{item.velocitySignal.concept}</span>
      <span>{item.velocitySignal.sourceCount} sources</span>
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
  synthesis,
  semanticEnabled = true,
  onFluidExpand,
  onFluidExternalOpen,
}: Props) {
  usePredictivePrefetch();
  const density = useAdaptiveReadingDensity();
  const { playSearchResolved } = useUIFrequencies();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { captureSpatialFlip, playSpatialFlip, cancelSpatialFlip } = useSpatialFlip(boardRef);
  const resolvedSoundQuery = useRef('');
  const endSentinel = useRef<HTMLDivElement | null>(null);
  const nearEndAt = useRef(0);
  const hoveredRef = useRef<FrontierItem | undefined>(undefined);
  const [query, setQuery] = useState(() => getFrontierClientQuery());
  const [stableOrder, setStableOrder] = useState<string[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string>();

  useEffect(() => {
    const update = (event: Event) => setQuery((event as CustomEvent<string>).detail ?? '');
    window.addEventListener(FRONTIER_CLIENT_QUERY_EVENT, update);
    return () => window.removeEventListener(FRONTIER_CLIENT_QUERY_EVENT, update);
  }, []);

  const semantic = useSemanticReranker(items, {
    query,
    seedText: SEMANTIC_COLD_START,
    enabled: semanticEnabled,
    explorationTemperature,
    diversityReference,
  });
  const synthesisEnabled = synthesis ?? appendStable;
  const presentationItems = useFrontierSynthesis(semantic.items, {
    enabled: synthesisEnabled,
    vectorEpoch: semantic.indexed,
  });

  useEffect(() => {
    setStableOrder([]);
    setExpandedItemId(undefined);
  }, [streamEpoch]);

  useEffect(() => {
    if (!appendStable) {
      setStableOrder([]);
      return;
    }
    setStableOrder((current) => {
      const liveIds = new Set(presentationItems.map((item) => item.id));
      const retained = current.filter((id) => liveIds.has(id));
      const retainedSet = new Set(retained);
      const additions = presentationItems.map((item) => item.id).filter((id) => !retainedSet.has(id));
      const next = [...retained, ...additions];
      return next.join('|') === current.join('|') ? current : next;
    });
  }, [appendStable, presentationItems]);

  const displayedItems = useMemo(() => {
    let ordered: FrontierItem[];
    if (!appendStable || !stableOrder.length) {
      ordered = presentationItems;
    } else {
      const byId = new Map(presentationItems.map((item) => [item.id, item]));
      const stable = stableOrder.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
      const included = new Set(stable.map((item) => item.id));
      ordered = [...stable, ...presentationItems.filter((item) => !included.has(item.id))];
    }
    return priorityFirst(ordered);
  }, [appendStable, presentationItems, stableOrder]);

  const renderableMedia = useMemo(
    () => displayedItems.map((item) => canRenderFrontierMedia(item)),
    [displayedItems],
  );
  const packedColumns = useMemo(
    () => frontierPackedColumnSpans(displayedItems, renderableMedia),
    [displayedItems, renderableMedia],
  );

  useEffect(() => {
    if (expandedItemId && !displayedItems.some((item) => item.id === expandedItemId)) setExpandedItemId(undefined);
  }, [displayedItems, expandedItemId]);

  // The pointer state machine owns intent. These setters are deliberately
  // idempotent and never reject an intent using render-time expansion state:
  // the second trusted release can arrive before React has committed a fresh
  // callback closure for the first release.
  const expandInline = useCallback((item: FrontierItem) => {
    captureSpatialFlip();
    setExpandedItemId(item.id);
    onFluidExpand?.(item);
  }, [captureSpatialFlip, onFluidExpand]);

  const collapseInline = useCallback((_item: FrontierItem) => {
    captureSpatialFlip();
    setExpandedItemId(undefined);
  }, [captureSpatialFlip]);

  useLayoutEffect(() => {
    playSpatialFlip();
  }, [expandedItemId, playSpatialFlip]);

  useEffect(() => cancelSpatialFlip, [cancelSpatialFlip]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = resolveFrontierFocalKeyboardIntent({
        key: event.key,
        open: Boolean(expandedItemId),
        hasHoveredItem: Boolean(hoveredRef.current),
        typing: isFrontierTypingTarget(event.target),
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
      });
      if (action === 'open' && hoveredRef.current) {
        event.preventDefault();
        expandInline(hoveredRef.current);
      } else if (action === 'close' && expandedItemId) {
        event.preventDefault();
        const item = displayedItems.find((candidate) => candidate.id === expandedItemId);
        if (item) collapseInline(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapseInline, displayedItems, expandInline, expandedItemId]);

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

  const hoverProps = (item: FrontierItem) => ({
    onPointerEnter: () => { hoveredRef.current = item; },
    onPointerLeave: () => { if (hoveredRef.current?.id === item.id) hoveredRef.current = undefined; },
  });

  return (
    <div
      ref={boardRef}
      className={`${styles.boardShell} ${spatial.board} ${densityStyles.scope}`}
      data-vector-backend={semantic.backend}
      data-exploration={explorationVector.toFixed(3)}
      data-density={density}
      data-fluid-expanded={expandedItemId ? 'true' : 'false'}
    >
      {!displayedItems.length ? empty : mode === 'feed' ? (
        <div className={`${styles.readingFeed} ${spatial.feed}`}>
          {displayedItems.map((item) => (
            <FluidSpatialCard
              key={item.id}
              item={item}
              expanded={expandedItemId === item.id}
              onExpand={expandInline}
              onCollapse={collapseInline}
              onExternalOpen={onFluidExternalOpen}
              className={`${styles.feedItem} ${spatial.feedItem} ${item.highPriority ? spatial.priorityFeedItem : ''} ${item.velocitySignal ? spatial.velocityItem : ''} ${perf.virtualItem} ${perf.feedVirtualItem}`}
            >
              <div
                data-frontier-priority={item.highPriority ? 'true' : undefined}
                data-frontier-velocity={item.velocitySignal ? 'true' : undefined}
                {...hoverProps(item)}
              >
                <PriorityMarker item={item} />
                <VelocityMarker item={item} />
                <FrontierIntelligenceBadges item={item} />
                <span className={spatial.focalHint} aria-hidden="true">click focus · 2× source</span>
                {renderCard(item, 'feed')}
              </div>
            </FluidSpatialCard>
          ))}
          <div ref={endSentinel} aria-hidden="true" style={{ height: 1 }} />
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${spatial.grid} ${compact ? styles.signalGridCompact : ''}`}>
          {displayedItems.map((item, index) => {
            const hasMedia = renderableMedia[index] ?? false;
            const visualRole = frontierVisualRole(item, index, hasMedia);
            const packedSpan = packedColumns[index] ?? 4;
            const packedStyle = { '--frontier-grid-span': String(packedSpan) } as CSSProperties;
            return (
              <FluidSpatialCard
                key={item.id}
                item={item}
                expanded={expandedItemId === item.id}
                onExpand={expandInline}
                onCollapse={collapseInline}
                onExternalOpen={onFluidExternalOpen}
                className={`${styles.gridItem} ${spatial.item} ${VISUAL_ROLE_CLASS[visualRole]} ${hasMedia ? spatial.mediaItem : spatial.textItem} ${item.highPriority ? spatial.priorityItem : ''} ${item.velocitySignal ? spatial.velocityItem : ''} ${perf.virtualItem}`}
              >
                <div
                  style={packedStyle}
                  data-frontier-priority={item.highPriority ? 'true' : undefined}
                  data-frontier-velocity={item.velocitySignal ? 'true' : undefined}
                  data-frontier-visual-role={visualRole}
                  data-frontier-has-media={hasMedia ? 'true' : 'false'}
                  data-frontier-grid-span={packedSpan}
                  {...hoverProps(item)}
                >
                  <PriorityMarker item={item} />
                  <VelocityMarker item={item} />
                  <FrontierIntelligenceBadges item={item} />
                  <span className={spatial.focalHint} aria-hidden="true">click focus · 2× source</span>
                  {renderCard(item, 'desk')}
                </div>
              </FluidSpatialCard>
            );
          })}
          <div ref={endSentinel} aria-hidden="true" style={{ height: 1 }} />
        </div>
      )}
    </div>
  );
}
