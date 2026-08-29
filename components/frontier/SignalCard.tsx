'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark, ExternalLink, MessageCircleMore, ThumbsDown, ThumbsUp } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import { FRONTIER_VIEWPORT_SEEN_MS, markFrontierItemSeen } from '@/lib/frontier/live/seenLedger';
import { assessFrontierSource } from '@/lib/frontier/sourceTrust';
import type { FrontierItem, FrontierReaction } from '@/lib/frontier/types';
import { EditorialClip } from './EditorialClip';
import { canRenderFrontierMedia, FrontierMediaSurface, frontierMediaKey } from './media/FrontierMediaSurface';
import type { SignalLayoutMode } from './SignalBoard';
import { SportsStatePanel } from './SportsStatePanel';
import mediaForward from './frontier-media-forward-cards.module.css';
import styles from './frontier-minimal.module.css';

const REACTIONS: Array<{ id: FrontierReaction; glyph: string; label: string }> = [
  { id: 'love', glyph: '♥', label: 'Love' },
  { id: 'important', glyph: '!', label: 'Important' },
  { id: 'surprise', glyph: '✦', label: 'Surprise' },
  { id: 'useful', glyph: '+', label: 'Useful' },
  { id: 'read', glyph: '✓', label: 'Read' },
  { id: 'known', glyph: '◎', label: 'Already knew' },
  { id: 'later', glyph: '↺', label: 'Later' },
  { id: 'meh', glyph: '·', label: 'Meh' },
  { id: 'hide', glyph: '×', label: 'Hide' },
];

export type SignalCardVariant = 'feature' | 'wide' | 'standard' | 'compact';

type Props = {
  item: FrontierItem;
  variant?: SignalCardVariant;
  presentation?: SignalLayoutMode | 'library';
  focused?: boolean;
  saved?: boolean;
  reaction?: FrontierReaction;
  explanation: string;
  resurfaced?: boolean;
  onSeen: (item: FrontierItem, resurfaced?: boolean) => void;
  onDwell: (item: FrontierItem, dwellMs: number) => void;
  /** Legacy caller compatibility. FluidSpatialCard is now the sole expansion authority. */
  onExpand?: (item: FrontierItem) => void;
  onOpen: (item: FrontierItem) => void;
  onSave: (item: FrontierItem) => void;
  onReact: (item: FrontierItem, reaction: FrontierReaction) => void;
};

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function provenanceLabel(item: FrontierItem, provenanceHost: string): string {
  const label = item.sourceLabel.trim() || provenanceHost;
  if (!provenanceHost || label.toLowerCase().includes(provenanceHost.toLowerCase())) return label;
  return `${label} · ${provenanceHost}`;
}

function publishedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recent';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }).format(date);
}

function MetricLine({ item }: { item: FrontierItem }) {
  if (!item.metrics?.length) return null;
  return <div className={styles.metricLine}>{item.metrics.slice(0, 3).map((metric) => <span key={`${metric.label}-${metric.value}`}><strong>{metric.value}</strong> {metric.label}</span>)}</div>;
}

function Feedback({ item, reaction, onReact }: Pick<Props, 'item' | 'reaction' | 'onReact'>) {
  return (
    <details className={styles.feedbackMenu} data-frontier-fluid-native="true">
      <summary><MessageCircleMore size={12} /> Feedback</summary>
      <div className={styles.feedbackGrid}>
        {REACTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.label}
            aria-label={`${option.label}: ${item.title}`}
            aria-pressed={reaction === option.id}
            className={`${styles.feedbackButton} ${reaction === option.id ? styles.actionActive : ''}`}
            onClick={() => onReact(item, option.id)}
          >
            <span>{option.glyph}</span>{option.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function SignalCard({
  item,
  presentation = 'library',
  focused = false,
  saved = false,
  reaction,
  explanation,
  resurfaced = false,
  onSeen,
  onDwell,
  onOpen,
  onSave,
  onReact,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const observed = useRef(false);
  const [unavailableMediaKey, setUnavailableMediaKey] = useState<string>();
  const lane = FRONTIER_LANE_MAP[item.lane];
  const feed = presentation === 'feed';
  const sourceTrust = assessFrontierSource(item);
  const sourceLabel = provenanceLabel(item, sourceTrust.host);
  const currentMediaKey = frontierMediaKey(item);
  const hasMedia = canRenderFrontierMedia(item);
  const mediaUnavailable = unavailableMediaKey === currentMediaKey;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let visible = false;
    let visibleSince: number | undefined;
    let ledgerTimer: number | undefined;
    let ledgerRecorded = false;

    const cancelLedgerTimer = () => {
      if (ledgerTimer !== undefined) window.clearTimeout(ledgerTimer);
      ledgerTimer = undefined;
    };
    const startLedgerTimer = () => {
      if (ledgerRecorded || ledgerTimer !== undefined || document.visibilityState !== 'visible') return;
      ledgerTimer = window.setTimeout(() => {
        ledgerTimer = undefined;
        if (!visible || document.visibilityState !== 'visible' || ledgerRecorded) return;
        ledgerRecorded = true;
        void markFrontierItemSeen(item, 'viewport').catch(() => undefined);
      }, FRONTIER_VIEWPORT_SEEN_MS);
    };
    const start = () => {
      if (visibleSince === undefined && document.visibilityState === 'visible') visibleSince = performance.now();
      startLedgerTimer();
    };
    const flush = () => {
      cancelLedgerTimer();
      if (visibleSince === undefined) return;
      const elapsed = Math.min(120_000, Math.max(0, performance.now() - visibleSince));
      visibleSince = undefined;
      if (elapsed >= 1_500) onDwell(item, Math.round(elapsed));
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') flush();
      else if (visible) start();
    };

    const observer = new IntersectionObserver((entries) => {
      const nextVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55);
      if (nextVisible && !observed.current) {
        observed.current = true;
        onSeen(item, resurfaced);
      }
      if (nextVisible && !visible) {
        visible = true;
        start();
      } else if (!nextVisible && visible) {
        visible = false;
        flush();
      }
    }, { threshold: [0, 0.55] });

    observer.observe(node);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      visible = false;
      flush();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [item, onDwell, onSeen, resurfaced]);

  const markMediaUnavailable = () => setUnavailableMediaKey(currentMediaKey);
  const recordExplicit = (reason: 'open' | 'save' | 'reaction') => {
    void markFrontierItemSeen(item, reason).catch(() => undefined);
  };
  const openWithSeen = () => {
    recordExplicit('open');
    onOpen(item);
  };
  const saveWithSeen = () => {
    recordExplicit('save');
    onSave(item);
  };
  const reactWithSeen = (_item: FrontierItem, nextReaction: FrontierReaction) => {
    recordExplicit('reaction');
    onReact(item, nextReaction);
  };

  const quickActions = (
    <div className={styles.quickActions}>
      <button
        type="button"
        className={`${styles.iconAction} ${reaction === 'up' ? styles.actionActive : ''}`}
        title="More like this"
        aria-label={`More like this: ${item.title}`}
        aria-pressed={reaction === 'up'}
        onClick={() => reactWithSeen(item, 'up')}
      ><ThumbsUp size={13} fill={reaction === 'up' ? 'currentColor' : 'none'} /></button>
      <button
        type="button"
        className={`${styles.iconAction} ${reaction === 'down' ? styles.actionActive : ''}`}
        title="Less like this"
        aria-label={`Less like this: ${item.title}`}
        aria-pressed={reaction === 'down'}
        onClick={() => reactWithSeen(item, 'down')}
      ><ThumbsDown size={13} fill={reaction === 'down' ? 'currentColor' : 'none'} /></button>
      <button
        type="button"
        className={`${styles.iconAction} ${saved ? styles.actionActive : ''}`}
        title={saved ? 'Saved' : 'Save'}
        aria-label={`${saved ? 'Saved' : 'Save'} ${item.title}`}
        onClick={saveWithSeen}
      ><Bookmark size={13} fill={saved ? 'currentColor' : 'none'} /></button>
      <a
        className={styles.iconAction}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={openWithSeen}
        aria-label={`${item.actionLabel ?? 'Open'}: ${item.title} on ${sourceLabel || host(item.url)}`}
        title={item.actionLabel ?? 'Open source'}
      ><ExternalLink size={13} /></a>
    </div>
  );

  const contextPanel = focused ? (
    <div className={styles.expandedPanel} data-frontier-focused-context="true">
      <MetricLine item={item} />
      <p className={styles.reason}>{explanation}</p>
      <Feedback item={item} reaction={reaction} onReact={reactWithSeen} />
    </div>
  ) : null;

  const sportsStatePanel = item.sportsState ? <SportsStatePanel state={item.sportsState} /> : null;

  const meta = (
    <div className={`${styles.cardTopline} ${mediaForward.topline}`} data-source-trust={sourceTrust.tier}>
      <span className={styles.laneLabel}>{resurfaced ? '↺ ' : ''}{lane.shortLabel}</span>
      <span
        className={styles.sourceLabel}
        title={`Source provenance: ${sourceTrust.tier}. ${sourceTrust.reason}.`}
      >{sourceLabel} · {publishedLabel(item.publishedAt)}</span>
    </div>
  );

  if (feed && !hasMedia) {
    return (
      <article ref={ref} className={`${styles.card} ${styles.feedCard} ${styles.feedCardText} ${mediaForward.card} ${mediaForward.feedCard} ${focused ? styles.cardExpanded : ''}`}>
        <div className={`${styles.feedCopy} ${mediaForward.feedCopy}`}>
          <EditorialClip item={item} presentation="list" resurfaced={resurfaced} onOpen={openWithSeen} />
          {sportsStatePanel}
          <div className={styles.feedActions}>{quickActions}</div>
          {contextPanel}
        </div>
      </article>
    );
  }

  if (!feed && !hasMedia) {
    return (
      <article ref={ref} className={`${styles.card} ${styles.tileCard} ${styles.tileCardText} ${mediaForward.card} ${mediaForward.tileCard} ${mediaForward.tileText} ${focused ? styles.cardExpanded : ''}`}>
        <div className={`${styles.tileBody} ${mediaForward.body}`}>
          {meta}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.tileStoryLink} ${mediaForward.storyLink}`}
            data-frontier-fluid-primary-link={focused ? undefined : 'true'}
            onClick={openWithSeen}
          >
            <h3 className={`${styles.cardTitle} ${mediaForward.title}`}>{item.title}</h3>
            <p className={`${styles.cardSummary} ${mediaForward.summary}`}>{item.summary}</p>
          </a>
          {sportsStatePanel}
          {contextPanel}
        </div>
        <div className={`${styles.tileFooter} ${mediaForward.footer}`}>{quickActions}</div>
      </article>
    );
  }

  if (feed) {
    return (
      <article
        ref={ref}
        className={`${styles.card} ${styles.feedCard} ${styles.feedCardMedia} ${mediaForward.card} ${mediaForward.feedCard} ${mediaForward.feedMedia} ${focused ? styles.cardExpanded : ''}`}
        data-frontier-media-unavailable={mediaUnavailable ? 'true' : undefined}
      >
        <div className={`${styles.feedCopy} ${mediaForward.feedCopy}`}>
          {meta}
          <h3 className={`${styles.cardTitle} ${mediaForward.title}`}>{item.title}</h3>
          <p className={`${styles.cardSummary} ${mediaForward.summary} ${mediaForward.feedSummary}`}>{item.summary}</p>
          {sportsStatePanel}
          <div className={styles.feedActions}>{quickActions}</div>
          {contextPanel}
        </div>
        <div className={`${styles.feedMediaSlot} ${mediaForward.feedMediaSlot}`}>
          <FrontierMediaSurface item={item} onUnavailable={markMediaUnavailable} />
        </div>
      </article>
    );
  }

  return (
    <article
      ref={ref}
      className={`${styles.card} ${styles.tileCard} ${styles.tileCardMedia} ${mediaForward.card} ${mediaForward.tileCard} ${mediaForward.tileMediaCard} ${focused ? styles.cardExpanded : ''}`}
      data-frontier-media-unavailable={mediaUnavailable ? 'true' : undefined}
    >
      <div className={`${styles.tileMedia} ${mediaForward.mediaSlot}`}>
        <FrontierMediaSurface item={item} onUnavailable={markMediaUnavailable} />
      </div>
      <div className={`${styles.tileBody} ${mediaForward.body}`}>
        {meta}
        <h3 className={`${styles.cardTitle} ${mediaForward.title}`}>{item.title}</h3>
        <p className={`${styles.cardSummary} ${mediaForward.summary}`}>{item.summary}</p>
        {sportsStatePanel}
        {contextPanel}
      </div>
      <div className={`${styles.tileFooter} ${mediaForward.footer}`}>{quickActions}</div>
    </article>
  );
}
