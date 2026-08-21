'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bookmark, ChevronDown, ExternalLink, Heart, MessageCircleMore } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import type { FrontierItem, FrontierReaction } from '@/lib/frontier/types';
import type { SignalLayoutMode } from './SignalBoard';
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

const LANE_ACCENTS: Record<string, string> = {
  must_know: '#ffd47a', ml_data: '#78e9ff', ai_frontier: '#a79cff', neuro_frontier: '#ef9cff',
  methods: '#87f0d2', builder_signal: '#90c9ff', competitions: '#ffd08c', broad_science: '#b7f3e1',
  creative_tech: '#ff9ed1', world_pulse: '#f1e2a4', premier_league: '#9dffb1', world_soccer: '#a7e6ba',
  team_pulse: '#80e6a8', sports: '#b3d4ff', gaming: '#ffb36b', music: '#ff85cf',
  internet_culture: '#ffe17a', life: '#9fd6a6', wildcards: '#d5afff',
};

export type SignalCardVariant = 'feature' | 'wide' | 'standard' | 'compact';

type Props = {
  item: FrontierItem;
  variant?: SignalCardVariant;
  presentation?: SignalLayoutMode | 'library';
  saved?: boolean;
  reaction?: FrontierReaction;
  explanation: string;
  resurfaced?: boolean;
  onSeen: (item: FrontierItem, resurfaced?: boolean) => void;
  onOpen: (item: FrontierItem) => void;
  onSave: (item: FrontierItem) => void;
  onReact: (item: FrontierItem, reaction: FrontierReaction) => void;
};

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function publishedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recent';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  }).format(date);
}

function DiscoveryImage({ src, alt }: { src: string; alt: string }) {
  return (
    // Live publisher/community media cannot use a static next/image host allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={styles.mediaImage} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
  );
}

function RealMedia({ item, interactive = false }: { item: FrontierItem; interactive?: boolean }) {
  const media = item.media;
  if (!media || media.type === 'none') return null;
  if (media.type === 'youtube' && media.url) {
    if (interactive) {
      return (
        <div className={styles.realMedia}>
          <iframe
            title={`Video: ${item.title}`}
            src={`https://www.youtube-nocookie.com/embed/${media.url}`}
            className={styles.mediaImage}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    const poster = media.poster || `https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`;
    return <div className={styles.realMedia}><DiscoveryImage src={poster} alt={media.alt || item.title} /></div>;
  }
  if (media.type === 'image' && media.url) {
    return <div className={styles.realMedia}><DiscoveryImage src={media.url} alt={media.alt || item.title} /></div>;
  }
  if (media.type === 'video' && media.url) {
    return (
      <div className={styles.realMedia}>
        {interactive ? (
          <video className={styles.mediaImage} controls preload="metadata" poster={media.poster}><source src={media.url} /></video>
        ) : media.poster ? (
          <DiscoveryImage src={media.poster} alt={media.alt || item.title} />
        ) : null}
      </div>
    );
  }
  return null;
}

function MetricLine({ item }: { item: FrontierItem }) {
  if (!item.metrics?.length) return null;
  return (
    <div className={styles.metricLine}>
      {item.metrics.slice(0, 3).map((metric) => (
        <span key={`${metric.label}-${metric.value}`}><strong>{metric.value}</strong> {metric.label}</span>
      ))}
    </div>
  );
}

function Feedback({ item, reaction, onReact }: Pick<Props, 'item' | 'reaction' | 'onReact'>) {
  return (
    <details className={styles.feedbackMenu}>
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
  saved = false,
  reaction,
  explanation,
  resurfaced = false,
  onSeen,
  onOpen,
  onSave,
  onReact,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const observed = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const lane = FRONTIER_LANE_MAP[item.lane];
  const style = { '--lane-accent': LANE_ACCENTS[item.lane] ?? '#76edff' } as CSSProperties;
  const feed = presentation === 'feed';

  useEffect(() => {
    const node = ref.current;
    if (!node || observed.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        observed.current = true;
        onSeen(item, resurfaced);
        observer.disconnect();
      }
    }, { threshold: [0.5] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [item, onSeen, resurfaced]);

  const quickActions = (
    <div className={styles.quickActions}>
      <button
        type="button"
        className={`${styles.iconAction} ${reaction === 'love' ? styles.actionActive : ''}`}
        title="Love"
        aria-label={`Love ${item.title}`}
        onClick={() => onReact(item, 'love')}
      >
        <Heart size={13} fill={reaction === 'love' ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        className={`${styles.iconAction} ${saved ? styles.actionActive : ''}`}
        title={saved ? 'Saved' : 'Save'}
        aria-label={`${saved ? 'Saved' : 'Save'} ${item.title}`}
        onClick={() => onSave(item)}
      >
        <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <a
        className={styles.iconAction}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onOpen(item)}
        aria-label={`Open ${item.title} on ${host(item.url) || item.sourceLabel}`}
        title="Open source"
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );

  if (feed) {
    return (
      <article ref={ref} className={`${styles.card} ${styles.feedCard}`} style={style}>
        <div className={styles.feedCopy}>
          <div className={styles.cardTopline}>
            <span className={styles.laneLabel}>{resurfaced ? '↺ ' : ''}{lane.shortLabel}</span>
            <span className={styles.sourceLabel}>{item.sourceLabel} · {publishedLabel(item.publishedAt)}</span>
          </div>
          <h3 className={styles.cardTitle}>{item.title}</h3>
          <p className={styles.cardSummary}>{item.summary}</p>
        </div>
        <div className={styles.feedMediaSlot}>
          <RealMedia item={item} interactive />
          {!item.media || item.media.type === 'none' ? (
            <button type="button" className={styles.textCenterpiece} onClick={() => setExpanded((value) => !value)}>
              <span>{expanded ? 'Less' : 'Read deeper'}</span>
              <strong>{item.summary}</strong>
            </button>
          ) : null}
        </div>
        <aside className={styles.feedContext}>
          <MetricLine item={item} />
          <p className={styles.reason}>{explanation}</p>
          {quickActions}
          <Feedback item={item} reaction={reaction} onReact={onReact} />
        </aside>
      </article>
    );
  }

  return (
    <article ref={ref} className={`${styles.card} ${styles.tileCard} ${expanded ? styles.cardExpanded : ''}`} style={style}>
      <button
        type="button"
        className={styles.tilePeek}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <div className={styles.cardTopline}>
          <span className={styles.laneLabel}>{resurfaced ? '↺ ' : ''}{lane.shortLabel}</span>
          <span className={styles.sourceLabel}>{item.sourceLabel} · {publishedLabel(item.publishedAt)}</span>
        </div>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <p className={styles.cardSummary}>{item.summary}</p>
        <span className={styles.expandCue}>{expanded ? 'Collapse' : 'Expand'} <ChevronDown size={12} /></span>
      </button>

      {expanded ? (
        <div className={styles.expandedPanel}>
          <RealMedia item={item} interactive />
          <div className={styles.expandedCopy}>
            <MetricLine item={item} />
            <p className={styles.reason}>{explanation}</p>
            <Feedback item={item} reaction={reaction} onReact={onReact} />
          </div>
        </div>
      ) : null}

      <div className={styles.tileFooter}>{quickActions}</div>
    </article>
  );
}
