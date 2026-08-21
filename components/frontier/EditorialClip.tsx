'use client';

import { ExternalLink } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import { deriveEditorialClip } from '@/lib/frontier/editorialClip';
import type { FrontierItem } from '@/lib/frontier/types';
import styles from './editorial-clip.module.css';

const VARIANT_CLASS = {
  research: styles.research,
  builder: styles.builder,
  sport: styles.sport,
  games: styles.games,
  music: styles.music,
  culture: styles.culture,
  dispatch: styles.dispatch,
} as const;

function publishedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recent';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  }).format(date);
}

type Props = {
  item: FrontierItem;
  presentation: 'grid' | 'list';
  resurfaced?: boolean;
  onOpen: () => void;
};

export function EditorialClip({ item, presentation, resurfaced = false, onOpen }: Props) {
  const clip = deriveEditorialClip(item);
  const lane = FRONTIER_LANE_MAP[item.lane];
  const highlightRepeatsTitle = clip.highlight.toLocaleLowerCase() === item.title.trim().toLocaleLowerCase();

  return (
    <div
      className={`${styles.clip} ${VARIANT_CLASS[clip.variant]} ${presentation === 'list' ? styles.list : styles.grid}`}
      data-kind={clip.kind}
      data-variant={clip.variant}
    >
      <div className={styles.masthead}>
        <span className={styles.section}>{resurfaced ? '↺ ' : ''}{lane.shortLabel}</span>
        <span className={styles.source}>{item.sourceLabel} · {publishedLabel(item.publishedAt)}</span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.storyLink}
        onClick={onOpen}
        aria-label={`Read ${item.title} on ${item.sourceLabel}`}
      >
        <div className={styles.headlineBlock}>
          <span className={styles.clipLabel}>{clip.label}</span>
          <h3 className={styles.headline}>{item.title}</h3>
          {clip.byline ? <span className={styles.byline}>{clip.byline}</span> : null}
        </div>

        {!highlightRepeatsTitle ? (
          <div className={styles.highlightBlock}>
            <span className={styles.highlightRule} aria-hidden="true" />
            <p className={styles.highlight}>
              {clip.kind === 'quote' ? <span aria-hidden="true">“</span> : null}
              {clip.highlight}
              {clip.kind === 'quote' ? <span aria-hidden="true">”</span> : null}
            </p>
          </div>
        ) : null}

        <span className={styles.readCue}>Read source <ExternalLink size={11} /></span>
      </a>
    </div>
  );
}
