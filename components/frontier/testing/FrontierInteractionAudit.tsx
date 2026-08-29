'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import { FluidSpatialCard } from '../FluidSpatialCard';
import styles from './frontier-interaction-audit.module.css';

const AUDIT_ITEM: FrontierItem = {
  id: 'frontier-phase8-browser-audit',
  title: 'Phase 8 fluid spatial interaction audit',
  summary: 'A deterministic browser-only fixture proving that one click expands a story in its existing spatial slot, preserves the live media subtree, and reveals larger source-backed reading highlights without repacking neighboring tiles.',
  url: '/frontier/interaction-audit?popup=1',
  source: 'FRONTIER CI',
  sourceLabel: 'FRONTIER CI',
  sourceKind: 'local',
  publishedAt: '2026-08-22T00:00:00.000Z',
  lane: 'creative_tech',
  tags: ['phase-8', 'in-place-expansion', 'browser-audit'],
  baseScore: 1,
  importance: 1,
  novelty: 1,
  quality: 1,
  momentum: 0,
  artifacts: [
    { kind: 'formula', label: 'spatial invariant', value: 'x_before = x_after; width_before = width_after' },
  ],
  convergence: {
    concept: 'Stable in-place reading expansion',
    sourceCount: 2,
    distinctSourceCount: 2,
    members: [
      {
        id: 'fixture-layout',
        title: 'Horizontal tile identity remains fixed during expansion',
        url: '/frontier/interaction-audit?popup=1&source=layout',
        source: 'FRONTIER CI layout',
        sourceLabel: 'FRONTIER CI layout',
        excerpt: 'The expanded card keeps its original column and width while only its vertical reading footprint grows.',
      },
      {
        id: 'fixture-evidence',
        title: 'Expanded cards expose source-backed evidence',
        url: '/frontier/interaction-audit?popup=1&source=evidence',
        source: 'FRONTIER CI evidence',
        sourceLabel: 'FRONTIER CI evidence',
        excerpt: 'The reading plane contains a bounded highlight, the original source summary, and provenance-linked corroborating excerpts.',
      },
    ],
  },
};

function AuditVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof HTMLCanvasElement === 'undefined') return;

    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 54;
    const context = canvas.getContext('2d');
    const capture = canvas.captureStream?.bind(canvas);
    if (!context || !capture) {
      video.dataset.frontierAuditMedia = 'unsupported';
      return;
    }

    let frame = 0;
    let animationFrame = 0;
    const paint = () => {
      frame += 1;
      context.fillStyle = frame % 2 ? '#0b151a' : '#0e1a20';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#a5d5c1';
      context.fillRect((frame * 3) % canvas.width, 0, 3, canvas.height);
      animationFrame = requestAnimationFrame(paint);
    };
    paint();

    const stream = capture(24);
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    void video.play().then(() => {
      video.dataset.frontierAuditMedia = 'playing';
    }).catch(() => {
      video.dataset.frontierAuditMedia = 'blocked';
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, []);

  return (
    <video
      ref={videoRef}
      data-frontier-audit-video="true"
      className={styles.video}
      muted
      autoPlay
      playsInline
      aria-label="Phase 8 continuity audit video"
    />
  );
}

export function FrontierInteractionAudit() {
  const [expanded, setExpanded] = useState(false);
  const item = useMemo(() => AUDIT_ITEM, []);
  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return (
    <main className={styles.shell} data-frontier-interaction-audit="true">
      <header className={styles.header}>
        <span>FRONTIER</span>
        <span>Phase 8 · in-place browser interaction</span>
      </header>
      <div className={styles.grid} data-frontier-audit-grid="true">
        <FluidSpatialCard
          item={item}
          expanded={expanded}
          onExpand={expand}
          onCollapse={collapse}
          className={styles.card}
        >
          <article className={styles.story}>
            <AuditVideo />
            <p className={styles.eyebrow}>Deterministic local fixture</p>
            <a
              href={item.url}
              data-frontier-fluid-primary-link="true"
              data-frontier-audit-primary-link="true"
              className={styles.title}
            >
              {item.title}
            </a>
            <p className={styles.summary}>{item.summary}</p>
          </article>
        </FluidSpatialCard>
        <div className={styles.neighbor} data-frontier-audit-neighbor="primary" aria-hidden="true">neighbor surface</div>
        <div className={styles.neighborSecondary} data-frontier-audit-neighbor="secondary" aria-hidden="true">neighbor surface</div>
      </div>
    </main>
  );
}
