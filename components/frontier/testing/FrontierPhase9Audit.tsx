'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import { FluidSpatialCard } from '../FluidSpatialCard';
import { useSpatialFlip } from '../useSpatialFlip';
import styles from './frontier-interaction-audit.module.css';

const AUDIT_VISIBLE_SUMMARY = 'A deterministic browser fixture for grounded scientific planes, opt-in local convergence synthesis, and expanded-media audio reactivity.';

const AUDIT_ITEM: FrontierItem = {
  id: 'frontier-phase9-browser-audit',
  title: 'Phase 9 synthesis and reactive environment audit',
  summary: [
    AUDIT_VISIBLE_SUMMARY,
    '',
    '$$x(t) = (1 + \\omega t)e^{-\\omega t}$$',
    '',
    '```ts',
    'const next = state + alpha * (target - state);',
    'return Math.min(1, Math.max(0, next));',
    '```',
  ].join('\n'),
  url: '/frontier/phase9-audit',
  source: 'FRONTIER CI',
  sourceLabel: 'FRONTIER CI',
  sourceKind: 'local',
  publishedAt: '2026-08-22T00:00:00.000Z',
  lane: 'creative_tech',
  tags: ['phase-9', 'synthesis', 'audio-reactivity', 'scientific-artifacts'],
  baseScore: 1,
  importance: 1,
  novelty: 1,
  quality: 1,
  momentum: 0,
  artifacts: [
    { kind: 'formula', label: 'critical damping', value: 'x(t)=(1+ωt)e^(-ωt)' },
  ],
  convergence: {
    confidence: 0.94,
    windowHours: 72,
    sourceKinds: ['arxiv', 'github', 'rss'],
    members: [
      {
        id: 'phase9-source-1',
        title: 'Sparse state-space routing for multimodal systems',
        url: 'https://arxiv.org/abs/2608.00001',
        sourceLabel: 'arXiv',
        sourceKind: 'arxiv',
        publishedAt: '2026-08-22T00:00:00.000Z',
        excerpt: 'A sparse recurrent router preserves modality-specific state while sharing a bounded latent interface across asynchronous observations.',
      },
      {
        id: 'phase9-source-2',
        title: 'Local multimodal router reference implementation',
        url: 'https://github.com/example/frontier-router',
        sourceLabel: 'GitHub',
        sourceKind: 'github',
        publishedAt: '2026-08-22T00:10:00.000Z',
        excerpt: 'The implementation uses independent modality queues, explicit backpressure, and a compact recurrent state updated only when new evidence arrives.',
      },
      {
        id: 'phase9-source-3',
        title: 'Engineering notes on asynchronous multimodal inference',
        url: 'https://example.com/frontier-audit-source',
        sourceLabel: 'Engineering Notes',
        sourceKind: 'rss',
        publishedAt: '2026-08-22T00:20:00.000Z',
        excerpt: 'Measured latency improves when expensive inference is isolated from the compositor and evidence is exchanged through bounded message contracts.',
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
      video.dataset.frontierPhase9Media = 'unsupported';
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
      video.dataset.frontierPhase9Media = 'playing';
    }).catch(() => {
      video.dataset.frontierPhase9Media = 'blocked';
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
      data-frontier-phase9-video="true"
      className={styles.video}
      muted
      autoPlay
      playsInline
      aria-label="Phase 9 audio reactivity audit video"
    />
  );
}

export function FrontierPhase9Audit() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { captureSpatialFlip, playSpatialFlip, cancelSpatialFlip } = useSpatialFlip(boardRef);
  const item = useMemo(() => AUDIT_ITEM, []);

  const expand = useCallback(() => {
    captureSpatialFlip();
    setExpanded(true);
  }, [captureSpatialFlip]);

  const collapse = useCallback(() => {
    captureSpatialFlip();
    setExpanded(false);
  }, [captureSpatialFlip]);

  useLayoutEffect(() => {
    playSpatialFlip();
  }, [expanded, playSpatialFlip]);

  useEffect(() => cancelSpatialFlip, [cancelSpatialFlip]);

  return (
    <main className={styles.shell} data-frontier-phase9-audit="true">
      <header className={styles.header}>
        <span>FRONTIER</span>
        <span>Phase 9 · synthesis + reactive environment</span>
      </header>
      <div ref={boardRef} className={styles.grid}>
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
              data-frontier-phase9-primary-link="true"
              className={styles.title}
            >
              {item.title}
            </a>
            <p className={styles.summary}>{AUDIT_VISIBLE_SUMMARY}</p>
          </article>
        </FluidSpatialCard>
        <div className={styles.neighbor} aria-hidden="true">grounded artifact surface</div>
        <div className={styles.neighborSecondary} aria-hidden="true">local inference boundary</div>
      </div>
    </main>
  );
}
