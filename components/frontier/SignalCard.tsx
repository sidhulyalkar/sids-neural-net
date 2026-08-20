'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Bookmark, ExternalLink } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import type { FrontierItem, FrontierReaction } from '@/lib/frontier/types';
import styles from './frontier.module.css';

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

const LANE_ACCENTS: Record<string, string> = {
  must_know: '#ffd47a', premier_league: '#9dffb1', world_soccer: '#a7e6ba', ml_data: '#78e9ff',
  ai_frontier: '#a79cff', neuro_frontier: '#ef9cff', methods: '#87f0d2', builder_signal: '#90c9ff',
  competitions: '#ffd08c', broad_science: '#b7f3e1', creative_tech: '#ff9ed1', world_pulse: '#f1e2a4',
  sports: '#b3d4ff', wildcards: '#d5afff',
};

export type SignalCardVariant = 'feature' | 'wide' | 'standard' | 'compact';

type Props = {
  item: FrontierItem;
  variant?: SignalCardVariant;
  saved?: boolean;
  reaction?: FrontierReaction;
  explanation: string;
  resurfaced?: boolean;
  onSeen: (item: FrontierItem, resurfaced?: boolean) => void;
  onOpen: (item: FrontierItem) => void;
  onSave: (item: FrontierItem) => void;
  onReact: (item: FrontierItem, reaction: FrontierReaction) => void;
};

function score(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function mediaLabel(item: FrontierItem): string {
  if (item.media?.type === 'youtube' || item.media?.type === 'video') return 'video signal';
  if (item.sourceKind === 'openalex') return 'paper signal';
  if (item.sourceKind === 'github') return 'builder signal';
  if (item.sourceKind === 'football_data') return 'match signal';
  return 'live signal';
}

function SignalArt({ item }: { item: FrontierItem }) {
  const lane = FRONTIER_LANE_MAP[item.lane];
  return <div className={styles.signalArt} aria-hidden="true"><div className={styles.signalGlyph}>{lane.glyph}</div></div>;
}

function Media({ item, variant }: { item: FrontierItem; variant: SignalCardVariant }) {
  const media = item.media;
  const youtube = media?.type === 'youtube' && media.url;

  return (
    <div className={styles.media}>
      {youtube && variant === 'feature' ? (
        <iframe
          title={`Video: ${item.title}`}
          src={`https://www.youtube-nocookie.com/embed/${media.url}`}
          className={styles.mediaImage}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : media?.type === 'image' && media.url ? (
        // Discovery images can originate from arbitrary publishers, so a static next/image host allowlist is intentionally unsuitable.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={media.alt || ''} className={styles.mediaImage} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : media?.type === 'video' && media.url && variant === 'feature' ? (
        <video className={styles.mediaImage} controls preload="metadata" poster={media.poster}><source src={media.url} /></video>
      ) : <SignalArt item={item} />}
      <div className={styles.mediaShade} />
      <div className={styles.mediaLabel}><span>●</span>{mediaLabel(item)}</div>
    </div>
  );
}

export function SignalCard({ item, variant = 'standard', saved = false, reaction, explanation, resurfaced = false, onSeen, onOpen, onSave, onReact }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const observed = useRef(false);
  const lane = FRONTIER_LANE_MAP[item.lane];

  useEffect(() => {
    const node = ref.current;
    if (!node || observed.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55)) {
        observed.current = true;
        onSeen(item, resurfaced);
        observer.disconnect();
      }
    }, { threshold: [0.55] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [item, onSeen, resurfaced]);

  const cardClass = [
    styles.card,
    variant === 'feature' ? styles.cardFeature : '',
    variant === 'wide' ? styles.cardWide : '',
    variant === 'standard' ? styles.cardStandard : '',
    variant === 'compact' ? styles.cardCompact : '',
  ].filter(Boolean).join(' ');
  const style = { '--lane-accent': LANE_ACCENTS[item.lane] ?? '#76edff' } as CSSProperties;
  const published = new Date(item.publishedAt);
  const days = Math.round((published.getTime() - Date.now()) / 86_400_000);
  const timeLabel = Number.isNaN(published.getTime()) ? 'recent' : new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(days, 'day');

  return (
    <article ref={ref} className={cardClass} style={style}>
      <Media item={item} variant={variant} />
      <div className={styles.cardBody}>
        <div className={styles.cardTopline}>
          <span className={styles.laneLabel}>{resurfaced ? '↺ Second chance · ' : ''}{lane.shortLabel}</span>
          <span className={styles.sourceLabel}>{item.sourceLabel} · {timeLabel}</span>
        </div>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <p className={styles.cardSummary}>{item.summary}</p>

        {item.metrics?.length ? <div className={styles.metrics}>{item.metrics.slice(0, 4).map((metric) => (
          <span className={styles.metric} key={`${metric.label}-${metric.value}`}><span className={styles.metricValue}>{metric.value}</span>{metric.label}</span>
        ))}</div> : null}

        <div className={styles.tags}>{item.tags.slice(0, variant === 'feature' ? 6 : 4).map((tag) => <span className={styles.tag} key={tag}>{tag}</span>)}</div>
        <p className={styles.reason}><span className={styles.reasonStrong}>Why it found you:</span> {explanation}</p>

        <div className={styles.scoreRail} aria-label="Signal scores">
          {([['importance', item.importance], ['novelty', item.novelty], ['quality', item.quality]] as const).map(([label, value]) => (
            <div className={styles.scoreCell} key={label}>
              <div className={styles.scoreLabel}><span>{label}</span><span>{score(value)}</span></div>
              <div className={styles.scoreTrack}><div className={styles.scoreFill} style={{ width: `${score(value)}%` }} /></div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          {REACTIONS.map((option) => (
            <button key={option.id} type="button" title={option.label} aria-label={`${option.label}: ${item.title}`} aria-pressed={reaction === option.id} className={`${styles.actionButton} ${reaction === option.id ? styles.actionActive : ''}`} onClick={() => onReact(item, option.id)}>{option.glyph}</button>
          ))}
          <button type="button" className={`${styles.saveButton} ${saved ? styles.actionActive : ''}`} onClick={() => onSave(item)} aria-pressed={saved}>
            <Bookmark size={11} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
          </button>
          <a className={styles.openButton} href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(item)} aria-label={`Open ${item.title} on ${host(item.url) || item.sourceLabel}`}>
            <ExternalLink size={11} /> Open
          </a>
        </div>
      </div>
    </article>
  );
}
