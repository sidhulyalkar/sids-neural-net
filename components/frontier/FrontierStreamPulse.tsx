'use client';

import { Sparkles } from 'lucide-react';
import styles from './frontier-stream-pulse.module.css';

type Props = {
  count: number;
  leader?: boolean;
  polling?: boolean;
  onReveal: () => void;
};

export function FrontierStreamPulse({ count, leader = false, polling = false, onReveal }: Props) {
  if (!count) return null;
  const label = count === 1 ? '1 fresh signal queued' : `${count} fresh signals queued`;
  return (
    <button
      type="button"
      className={styles.pulse}
      onClick={onReveal}
      aria-label={`${label}. Add them to the current feed.`}
      title={`${label} · ${leader ? 'this tab owns discovery' : 'shared discovery'}`}
      data-polling={polling ? 'true' : 'false'}
    >
      <span className={styles.dot} aria-hidden="true" />
      <Sparkles size={10} aria-hidden="true" />
      <span>{count} new</span>
      <kbd>N</kbd>
    </button>
  );
}
