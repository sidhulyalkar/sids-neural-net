'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ambientExplorationVector, emitFrontierAmbientExploration } from '@/lib/frontier/ambientState';
import {
  frontierDecisionPolicyMode,
  listenFrontierDecisionOutcomes,
  recordFrontierDecision,
  recordFrontierDecisionVisibility,
} from '@/lib/frontier/decisionLedger';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import {
  frontierPackedColumnSpans,
  frontierPackedColumnStarts,
  frontierVisualRole,
  type FrontierVisualRole,
} from '@/lib/frontier/presentation/mediaForward';
import { useFrontierStore } from '@/lib/frontier/store';
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

type StableOrderState = {
  streamEpoch: number;
  appendStable: boolean;
  signature: string;
  order: string[];
};

type ExpandedState = {
  streamEpoch: number;
  itemId?: string;
};

const EMPTY_DIVERSITY_REFERENCE: FrontierItem[] = [];

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
  diversityReference = EMPTY_DIVERSITY_REFERENCE,
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
  const decisionLoggingEnabled = useFrontierStore((state) => state.behavior.implicitLearning);
  const { playSearchResolved } = useUIFrequencies();
  const resolvedSoundQuery = useRef('');
  const boardRef = useRef<HTMLDivElement | null>(null);
  const endSentinel = useRef<HTMLDivElement | null>(null);
  const nearEndAt = useRef(0);
  const hoveredRef = useRef<FrontierItem | undefined>(undefined);
  const [query, setQuery] = useState(() => getFrontierClientQuery());
  const [stableState, setStableState] = useState<StableOrderState>(() => ({
    streamEpoch,
    appendStable,
    signature: '',
    order: [],
  }));
  const [expandedState, setExpandedState] = useState<ExpandedState>(() => ({ streamEpoch }));

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
  const presentationSignature = useMemo(
    () => presentationItems.map((item) => item.id).join('|'),
    [presentationItems],
  );

  if (
    stableState.streamEpoch !== streamEpoch
    || stableState.appendStable !== appendStable
    || stableState.signature !== presentationSignature
  ) {
    let nextOrder: string[] = [];
    if (appendStable) {
      const liveIds = new Set(presentationItems.map((item) => item.id));
      const retained = stableState.streamEpoch === streamEpoch
        ? stableState.order.filter((id) => liveIds.has(id))
        : [];
      const retainedSet = new Set(retained);
      const additions = presentationItems.map((item) => item.id).filter((id) => !retainedSet.has(id));
      nextOrder = [...retained, ...additions];
    }
    setStableState({
      streamEpoch,
      appendStable,
      signature: presentationSignature,
      order: nextOrder,
    });
  }

  const stableOrder = stableState.streamEpoch === streamEpoch && appendStable
    ? stableState.order
    : EMPTY_DIVERSITY_REFERENCE.map((item) => item.id);
  const expandedItemId = expandedState.streamEpoch === streamEpoch ? expandedState.itemId : undefined;

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
  const packedColumnStarts = useMemo(
    () => frontierPackedColumnStarts(packedColumns),
    [packedColumns],
  );
  const visibleExpandedItemId = expandedItemId && displayedItems.some((item) => item.id === expandedItemId)
    ? expandedItemId
    : undefined;

  const expandInline = useCallback((item: FrontierItem) => {
    setExpandedState({ streamEpoch, itemId: item.id });
    onFluidExpand?.(item);
  }, [onFluidExpand, streamEpoch]);

  const collapseInline = useCallback((_item: FrontierItem) => {
    setExpandedState({ streamEpoch });
  }, [streamEpoch]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = resolveFrontierFocalKeyboardIntent({
        key: event.key,
        open: Boolean(visibleExpandedItemId),
        hasHoveredItem: Boolean(hoveredRef.current),
        typing: isFrontierTypingTarget(event.target),
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
      });
      if (action === 'open' && hoveredRef.current) {
        event.preventDefault();
        expandInline(hoveredRef.current);
      } else if (action === 'close' && visibleExpandedItemId) {
        event.preventDefault();
        const item = displayedItems.find((candidate) => candidate.id === visibleExpandedItemId);
        if (item) collapseInline(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapseInline, displayedItems, expandInline, visibleExpandedItemId]);

  const itemSignature = useMemo(() => displayedItems.map((item) => item.id).join('|'), [displayedItems]);
  const upstreamSignature = useMemo(() => items.map((item) => item.id).join('|'), [items]);
  const decisionPolicy = useMemo(
    () => frontierDecisionPolicyMode(query, explorationTemperature),
    [explorationTemperature, query],
  );
  const explorationVector = useMemo(() => ambientExplorationVector(displayedItems), [displayedItems]);

  useEffect(() => {
    if (!decisionLoggingEnabled || !displayedItems.length) return;
    recordFrontierDecision({
      policyMode: decisionPolicy,
      semanticEnabled,
      streamEpoch,
      upstreamIds: items.map((item) => item.id),
      displayedIds: displayedItems.map((item) => item.id),
    });
  }, [decisionLoggingEnabled, decisionPolicy, displayedItems, itemSignature, items, semanticEnabled, streamEpoch, upstreamSignature]);

  useEffect(() => {
    if (!decisionLoggingEnabled) return;
    return listenFrontierDecisionOutcomes();
  }, [decisionLoggingEnabled]);

  useEffect(() => {
    const root = boardRef.current;
    if (!decisionLoggingEnabled || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.55) continue;
        const itemId = (entry.target as HTMLElement).dataset.frontierDecisionItem;
        if (itemId) recordFrontierDecisionVisibility(itemId, entry.intersectionRatio);
      }
    }, { threshold: [0.55, 0.8] });
    root.querySelectorAll<HTMLElement>('[data-frontier-decision-item]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [decisionLoggingEnabled, itemSignature, mode]);

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
      data-fluid-expanded={visibleExpandedItemId ? 'true' : 'false'}
    >
      {!displayedItems.length ? empty : mode === 'feed' ? (
        <div className={`${styles.readingFeed} ${spatial.feed}`}>
          {displayedItems.map((item) => {
            const focused = visibleExpandedItemId === item.id;
            return (
              <FluidSpatialCard
                key={item.id}
                item={item}
                expanded={focused}
                onExpand={expandInline}
                onCollapse={collapseInline}
                onExternalOpen={onFluidExternalOpen}
                className={`${styles.feedItem} ${spatial.feedItem} ${item.highPriority ? spatial.priorityFeedItem : ''} ${item.velocitySignal ? spatial.velocityItem : ''} ${perf.virtualItem} ${perf.feedVirtualItem}`}
              >
                <div
                  data-frontier-decision-item={item.id}
                  data-frontier-priority={item.highPriority ? 'true' : undefined}
                  data-frontier-velocity={item.velocitySignal ? 'true' : undefined}
                  {...hoverProps(item)}
                >
                  <PriorityMarker item={item} />
                  <VelocityMarker item={item} />
                  <FrontierIntelligenceBadges item={item} />
                  <span className={spatial.focalHint} aria-hidden="true">click to expand · 2× source</span>
                  {renderCard(item, 'feed')}
                </div>
              </FluidSpatialCard>
            );
          })}
          <div ref={endSentinel} aria-hidden="true" style={{ height: 1 }} />
        </div>
      ) : (
        <div className={`${styles.signalGrid} ${spatial.grid} ${compact ? styles.signalGridCompact : ''}`}>
          {displayedItems.map((item, index) => {
            const hasMedia = renderableMedia[index] ?? false;
            const visualRole = frontierVisualRole(item, index, hasMedia);
            const packedSpan = packedColumns[index] ?? 4;
            const packedStart = packedColumnStarts[index] ?? 1;
            const focused = visibleExpandedItemId === item.id;
            const packedStyle = {
              '--frontier-grid-span': String(packedSpan),
              '--frontier-grid-column-start': String(packedStart),
            } as CSSProperties;
            return (
              <FluidSpatialCard
                key={item.id}
                item={item}
                expanded={focused}
                onExpand={expandInline}
                onCollapse={collapseInline}
                onExternalOpen={onFluidExternalOpen}
                className={`${styles.gridItem} ${spatial.item} ${VISUAL_ROLE_CLASS[visualRole]} ${hasMedia ? spatial.mediaItem : spatial.textItem} ${item.highPriority ? spatial.priorityItem : ''} ${item.velocitySignal ? spatial.velocityItem : ''} ${perf.virtualItem}`}
                style={packedStyle}
              >
                <div
                  data-frontier-decision-item={item.id}
                  data-frontier-priority={item.highPriority ? 'true' : undefined}
                  data-frontier-velocity={item.velocitySignal ? 'true' : undefined}
                  data-frontier-visual-role={visualRole}
                  data-frontier-has-media={hasMedia ? 'true' : 'false'}
                  data-frontier-grid-span={packedSpan}
                  data-frontier-grid-column-start={packedStart}
                  {...hoverProps(item)}
                >
                  <PriorityMarker item={item} />
                  <VelocityMarker item={item} />
                  <FrontierIntelligenceBadges item={item} />
                  <span className={spatial.focalHint} aria-hidden="true">click to expand · 2× source</span>
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
