'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { frontierFocalTakeaways } from '@/lib/frontier/synthesis/artifactExtractor';
import type { FrontierItem } from '@/lib/frontier/types';
import { FrontierMediaSurface, canRenderFrontierMedia } from './media/FrontierMediaSurface';
import styles from './frontier-focal-plane.module.css';

type Props = {
  item?: FrontierItem;
  onClose: () => void;
};

function published(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recent';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  }).format(date);
}

export function FrontierFocalPlane({ item, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const takeaways = useMemo(() => item ? frontierFocalTakeaways(item, 3) : [], [item]);

  useEffect(() => {
    if (!item) return;
    const active = document.activeElement;
    previousFocus.current = active instanceof HTMLElement ? active : null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      window.requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
    };
  }, [item]);

  if (!item) return null;
  const hasMedia = canRenderFrontierMedia(item);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className={styles.plane} role="dialog" aria-modal="true" aria-label={`Quick view: ${item.title}`}>
        <header className={styles.header}>
          <div className={styles.meta}>
            <span>{item.sourceLabel}</span>
            <span>{published(item.publishedAt)}</span>
            {item.velocitySignal ? <span>pulse {Math.round(item.velocitySignal.score * 100)}%</span> : null}
            {item.convergence ? <span>convergence {item.convergence.members.length}</span> : null}
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close quick view"><X size={15} /></button>
        </header>

        <div className={`${styles.body} ${hasMedia ? styles.bodyMedia : ''}`}>
          <div className={styles.copy}>
            {item.watchSignal ? (
              <div className={styles.signal}>Signal · {item.watchSignal.label} · {Math.round(item.watchSignal.score * 100)}%</div>
            ) : null}
            <h2>{item.title}</h2>
            {item.summary ? <p className={styles.summary}>{item.summary}</p> : null}

            {takeaways.length ? (
              <div className={styles.takeaways} aria-label="Key takeaways">
                {takeaways.map((takeaway) => <p key={takeaway}>{takeaway}</p>)}
              </div>
            ) : null}

            {item.artifacts?.length ? (
              <div className={styles.artifacts} aria-label="Extracted artifacts">
                {item.artifacts.map((artifact, index) => artifact.url ? (
                  <a key={`${artifact.kind}-${index}`} href={artifact.url} target="_blank" rel="noopener noreferrer">
                    <span>{artifact.label}</span>{artifact.value ? <strong>{artifact.value}</strong> : null}
                  </a>
                ) : (
                  <span key={`${artifact.kind}-${index}`}>
                    <small>{artifact.label}</small>{artifact.value ? <strong>{artifact.value}</strong> : null}
                  </span>
                ))}
              </div>
            ) : null}

            {item.convergence?.members.length ? (
              <div className={styles.sources} aria-label="Converging sources">
                <div className={styles.sectionLabel}>Converging sources</div>
                {item.convergence.members.map((member) => (
                  <a href={member.url} target="_blank" rel="noopener noreferrer" key={`${member.id}-${member.url}`}>
                    <span>{member.sourceLabel}</span>
                    <strong>{member.title}</strong>
                  </a>
                ))}
              </div>
            ) : null}

            <a className={styles.openSource} href={item.url} target="_blank" rel="noopener noreferrer">
              Open source <ExternalLink size={12} />
            </a>
          </div>

          {hasMedia ? (
            <div className={styles.media}>
              <FrontierMediaSurface item={item} />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
