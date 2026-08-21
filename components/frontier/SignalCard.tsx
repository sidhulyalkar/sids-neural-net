'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronDown, ExternalLink, Heart, MessageCircleMore } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import type { FrontierItem, FrontierReaction } from '@/lib/frontier/types';
import { EditorialClip } from './EditorialClip';
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
  onDwell: (item: FrontierItem, dwellMs: number) => void;
  onExpand: (item: FrontierItem) => void;
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

function isHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isYouTubeId(value?: string): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{6,20}$/.test(value));
}

function mediaKey(item: FrontierItem): string {
  return [item.id, item.media?.type, item.media?.url, item.media?.poster].join('|');
}

function hasRenderableMedia(item: FrontierItem): boolean {
  const media = item.media;
  if (!media || media.type === 'none' || media.type === 'chart') return false;
  // The core GitHub adapter currently exposes an owner avatar rather than visual
  // repository content. Keep it out of the editorial feed rather than dressing
  // a code signal with a decorative profile image.
  if (item.sourceKind === 'github' && media.type === 'image') return false;
  if (media.type === 'youtube') return isYouTubeId(media.url);
  return isHttpUrl(media.url);
}

function DiscoveryImage({ src, alt, onUnavailable }: { src: string; alt: string; onUnavailable: () => void }) {
  return (
    // Live publisher/community media cannot use a static next/image host allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={styles.mediaImage}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={onUnavailable}
    />
  );
}

function RealMedia({
  item,
  interactive = false,
  onUnavailable,
}: {
  item: FrontierItem;
  interactive?: boolean;
  onUnavailable: () => void;
}) {
  const media = item.media;
  if (!media || !hasRenderableMedia(item)) return null;

  if (media.type === 'youtube' && isYouTubeId(media.url)) {
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
          <span className={styles.mediaKind}>Video</span>
        </div>
      );
    }
    const poster = isHttpUrl(media.poster) ? media.poster : `https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`;
    return (
      <div className={styles.realMedia}>
        <DiscoveryImage src={poster} alt={media.alt || item.title} onUnavailable={onUnavailable} />
        <span className={styles.mediaKind}>Video</span>
      </div>
    );
  }

  if (media.type === 'image' && isHttpUrl(media.url)) {
    return (
      <div className={styles.realMedia}>
        <DiscoveryImage src={media.url} alt={media.alt || item.title} onUnavailable={onUnavailable} />
      </div>
    );
  }

  if (media.type === 'video' && isHttpUrl(media.url)) {
    if (!interactive && isHttpUrl(media.poster)) {
      return (
        <div className={styles.realMedia}>
          <DiscoveryImage src={media.poster} alt={media.alt || item.title} onUnavailable={onUnavailable} />
          <span className={styles.mediaKind}>Video</span>
        </div>
      );
    }
    return (
      <div className={styles.realMedia}>
        <video
          className={styles.mediaImage}
          controls
          preload="metadata"
          poster={isHttpUrl(media.poster) ? media.poster : undefined}
          onError={onUnavailable}
        >
          <source src={media.url} />
        </video>
        <span className={styles.mediaKind}>Video</span>
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
  onDwell,
  onExpand,
  onOpen,
  onSave,
  onReact,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const observed = useRef(false);
  const dwelled = useRef(false);
  const dwellTimer = useRef<number | undefined>(undefined);
  const expandedRecorded = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [unavailableMediaKey, setUnavailableMediaKey] = useState<string>();
  const lane = FRONTIER_LANE_MAP[item.lane];
  const feed = presentation === 'feed';
  const currentMediaKey = mediaKey(item);
  const hasMedia = unavailableMediaKey !== currentMediaKey && hasRenderableMedia(item);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (visible && !observed.current) {
        observed.current = true;
        onSeen(item, resurfaced);
      }
      if (visible && !dwelled.current && dwellTimer.current === undefined) {
        dwellTimer.current = window.setTimeout(() => {
          dwelled.current = true;
          dwellTimer.current = undefined;
          onDwell(item, 7_500);
        }, 7_500);
      }
      if (!visible && dwellTimer.current !== undefined) {
        window.clearTimeout(dwellTimer.current);
        dwellTimer.current = undefined;
      }
    }, { threshold: [0, 0.5] });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (dwellTimer.current !== undefined) window.clearTimeout(dwellTimer.current);
    };
  }, [item, onDwell, onSeen, resurfaced]);

  const markMediaUnavailable = () => setUnavailableMediaKey(currentMediaKey);

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

  const toggleExpanded = () => {
    setExpanded((value) => {
      const next = !value;
      if (next && !expandedRecorded.current) {
        expandedRecorded.current = true;
        onExpand(item);
      }
      return next;
    });
  };

  const contextPanel = expanded ? (
    <div className={styles.expandedPanel}>
      <MetricLine item={item} />
      <p className={styles.reason}>{explanation}</p>
      <Feedback item={item} reaction={reaction} onReact={onReact} />
    </div>
  ) : null;

  if (feed && !hasMedia) {
    return (
      <article ref={ref} className={`${styles.card} ${styles.feedCard} ${styles.feedCardText}`}>
        <div className={styles.feedCopy}>
          <EditorialClip
            item={item}
            presentation="list"
            resurfaced={resurfaced}
            onOpen={() => onOpen(item)}
          />
          <div className={styles.feedDetails}>
            <MetricLine item={item} />
            <p className={styles.reason}>{explanation}</p>
          </div>
          <div className={styles.feedActions}>
            {quickActions}
            <Feedback item={item} reaction={reaction} onReact={onReact} />
          </div>
        </div>
      </article>
    );
  }

  if (!feed && !hasMedia) {
    return (
      <article ref={ref} className={`${styles.card} ${styles.tileCard} ${styles.tileCardText} ${expanded ? styles.cardExpanded : ''}`}>
        <div className={styles.tileBody}>
          <EditorialClip
            item={item}
            presentation="grid"
            resurfaced={resurfaced}
            onOpen={() => onOpen(item)}
          />
          <button
            type="button"
            className={styles.expandCue}
            aria-expanded={expanded}
            onClick={toggleExpanded}
          >
            {expanded ? 'Less' : 'Context'} <ChevronDown size={12} />
          </button>
          {contextPanel}
        </div>
        <div className={styles.tileFooter}>{quickActions}</div>
      </article>
    );
  }

  const meta = (
    <div className={styles.cardTopline}>
      <span className={styles.laneLabel}>{resurfaced ? '↺ ' : ''}{lane.shortLabel}</span>
      <span className={styles.sourceLabel}>{item.sourceLabel} · {publishedLabel(item.publishedAt)}</span>
    </div>
  );

  if (feed) {
    return (
      <article ref={ref} className={`${styles.card} ${styles.feedCard} ${styles.feedCardMedia}`}>
        <div className={styles.feedCopy}>
          {meta}
          <h3 className={styles.cardTitle}>{item.title}</h3>
          <p className={styles.cardSummary}>{item.summary}</p>
          <div className={styles.feedDetails}>
            <MetricLine item={item} />
            <p className={styles.reason}>{explanation}</p>
          </div>
          <div className={styles.feedActions}>
            {quickActions}
            <Feedback item={item} reaction={reaction} onReact={onReact} />
          </div>
        </div>
        <div className={styles.feedMediaSlot}>
          <RealMedia item={item} interactive onUnavailable={markMediaUnavailable} />
        </div>
      </article>
    );
  }

  return (
    <article ref={ref} className={`${styles.card} ${styles.tileCard} ${styles.tileCardMedia} ${expanded ? styles.cardExpanded : ''}`}>
      <div className={styles.tileMedia}>
        <RealMedia item={item} interactive={expanded} onUnavailable={markMediaUnavailable} />
      </div>

      <div className={styles.tileBody}>
        {meta}
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <p className={styles.cardSummary}>{item.summary}</p>

        <button
          type="button"
          className={styles.expandCue}
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          {expanded ? 'Less' : 'Context'} <ChevronDown size={12} />
        </button>

        {contextPanel}
      </div>

      <div className={styles.tileFooter}>{quickActions}</div>
    </article>
  );
}
