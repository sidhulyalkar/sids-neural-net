'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ExternalLink, Play, VideoOff } from 'lucide-react';
import type { JournalMediaPlan } from '@/lib/frontier/journalMedia';
import { journalMediaDuration } from '@/lib/frontier/journalMedia';
import styles from './frontier-journal.module.css';

type Props = {
  plan: JournalMediaPlan;
  title: string;
  posterUrl?: string;
  onOpenSource: () => void;
};

/**
 * Source-native media only. A preview image is not a video player, and a
 * remote MP4 is never loaded until explicit user activation. For external
 * hosts, the user follows the real source link instead of a fabricated embed.
 */
export function FrontierJournalMedia({ plan, title, posterUrl, onOpenSource }: Props) {
  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const duration = journalMediaDuration(plan.durationSeconds);
  const activeVideo = plan.kind === 'direct-video' && activated && !failed;
  return (
    <section className={styles.journalMedia} data-frontier-media={plan.kind} aria-label="Original source video">
      <div className={styles.mediaHeading}>
        <span>ON THE SOURCE</span>
        <span>{duration ? 'Runtime ' + duration : 'Original footage'}</span>
      </div>
      {activeVideo ? (
        <video className={styles.journalVideo} src={plan.playableUrl} controls playsInline autoPlay
          preload="metadata" aria-label={title}
          onError={() => setFailed(true)}>
          Your browser cannot play this video.
        </video>
      ) : (
        <div className={styles.mediaPoster}>
          {posterUrl && !posterFailed ? (
            <Image unoptimized src={posterUrl} alt={title} fill sizes="(max-width: 760px) 100vw, 70vw"
              className={styles.mediaPosterImage} onError={() => setPosterFailed(true)}/>
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true">
              <VideoOff size={24} strokeWidth={1.25}/>
              <span>{failed ? 'Source playback unavailable' : 'Source video'}</span>
            </div>
          )}
          {!failed ? plan.kind === 'direct-video' ? (
            <button type="button" className={styles.mediaPlay}
              aria-label={'Play original source clip: ' + title} onClick={() => setActivated(true)}>
              <Play size={18} fill="currentColor" aria-hidden="true"/> Play source clip
            </button>
          ) : (
            <a className={styles.mediaPlay} href={plan.sourceUrl} target="_blank"
              rel="noopener noreferrer" onClick={onOpenSource}>
              <Play size={18} fill="currentColor" aria-hidden="true"/> Watch at source
              <ExternalLink size={14} aria-hidden="true"/>
            </a>
          ) : null}
        </div>
      )}
      <div className={styles.mediaFoot}>
        <span>{failed ? 'The direct clip could not play here.' : 'Publisher-supplied video. No generated footage.'}</span>
        <a href={plan.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={onOpenSource}>
          Open original <ExternalLink size={13} aria-hidden="true"/>
        </a>
      </div>
    </section>
  );
}
