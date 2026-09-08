'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildFrontierSectionPages,
  FRONTIER_SECTION_FEED_PAGE_SIZE,
  FRONTIER_SECTION_PAGE_SIZE,
} from '@/lib/frontier/sectionDeck';
import type { FrontierItem, FrontierLayoutMode } from '@/lib/frontier/types';
import styles from './frontier-section-deck.module.css';

type Props = {
  items: FrontierItem[];
  layoutMode: FrontierLayoutMode;
  renderCard: (item: FrontierItem, mode: FrontierLayoutMode) => ReactNode;
  empty?: ReactNode;
};

type TurnDirection = 'forward' | 'backward';
type TurnPhase = 'prepare' | 'turn';
type TurnState = {
  targetIndex: number;
  direction: TurnDirection;
  phase: TurnPhase;
};
type WarmPriority = 'idle' | 'immediate';
type ConnectionHint = { saveData?: boolean; effectiveType?: string };

const TURN_FALLBACK_MS = 640;
const MAX_DECODED_MEDIA = 32;
const decodedMediaCache = new Map<string, HTMLImageElement>();

function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  return Boolean(node && (
    node.tagName === 'INPUT'
    || node.tagName === 'TEXTAREA'
    || node.tagName === 'SELECT'
    || node.isContentEditable
  ));
}

function validWarmUrl(value?: string): value is string {
  return Boolean(value && (value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://')));
}

function mediaWarmUrls(item: FrontierItem): string[] {
  const media = item.media;
  if (!media || media.type === 'none' || media.type === 'chart') return [];

  if (media.type === 'image') {
    const primary = media.proxyUrl ?? media.url;
    return validWarmUrl(primary) ? [primary] : [];
  }

  if (media.type === 'video') {
    const poster = media.posterProxyUrl ?? media.poster;
    return validWarmUrl(poster) ? [poster] : [];
  }

  if (media.type === 'youtube' && /^[A-Za-z0-9_-]{6,20}$/.test(media.url)) {
    const maxRes = `https://i.ytimg.com/vi/${media.url}/maxresdefault.jpg`;
    const hq = `https://i.ytimg.com/vi/${media.url}/hqdefault.jpg`;
    return [
      `/api/frontier/media?url=${encodeURIComponent(maxRes)}`,
      `/api/frontier/media?url=${encodeURIComponent(hq)}`,
    ];
  }

  return [];
}

function connectionHint(): ConnectionHint | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: ConnectionHint }).connection;
}

function warmBudget(priority: WarmPriority): number {
  const connection = connectionHint();
  if (connection?.saveData) return priority === 'immediate' ? 2 : 0;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
    return priority === 'immediate' ? 3 : 1;
  }
  if (connection?.effectiveType === '3g') return priority === 'immediate' ? 6 : 4;
  return priority === 'immediate' ? 10 : 8;
}

function rememberDecodedImage(url: string, image: HTMLImageElement) {
  decodedMediaCache.delete(url);
  decodedMediaCache.set(url, image);
  while (decodedMediaCache.size > MAX_DECODED_MEDIA) {
    const oldest = decodedMediaCache.keys().next().value as string | undefined;
    if (!oldest) break;
    decodedMediaCache.delete(oldest);
  }
}

function warmPageMedia(items: FrontierItem[], priority: WarmPriority, requestedLimit?: number) {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;
  const urls = Array.from(new Set(items.flatMap(mediaWarmUrls)));
  const limit = Math.max(0, Math.min(urls.length, requestedLimit ?? warmBudget(priority)));

  for (const url of urls.slice(0, limit)) {
    const cached = decodedMediaCache.get(url);
    if (cached) {
      rememberDecodedImage(url, cached);
      continue;
    }

    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.referrerPolicy = 'no-referrer';
    image.setAttribute('fetchpriority', priority === 'immediate' ? 'high' : 'low');
    image.src = url;
    rememberDecodedImage(url, image);
    if (typeof image.decode === 'function') void image.decode().catch(() => undefined);
  }
}

export function FrontierSectionDeck({ items, layoutMode, renderCard, empty }: Props) {
  const pageSize = layoutMode === 'feed' ? FRONTIER_SECTION_FEED_PAGE_SIZE : FRONTIER_SECTION_PAGE_SIZE;
  const pages = useMemo(() => buildFrontierSectionPages(items, pageSize), [items, pageSize]);
  const [pageIndex, setPageIndex] = useState(0);
  const [turn, setTurn] = useState<TurnState>();
  const turnFallback = useRef<number | undefined>(undefined);
  const prepareFrame = useRef<number | undefined>(undefined);
  const revealFrame = useRef<number | undefined>(undefined);
  const swipeStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const swipeWarmDirection = useRef<TurnDirection | undefined>(undefined);

  useEffect(() => {
    setTurn(undefined);
    setPageIndex((index) => pages.length ? Math.min(index, pages.length - 1) : 0);
  }, [pages.length]);

  useEffect(() => () => {
    if (turnFallback.current !== undefined) window.clearTimeout(turnFallback.current);
    if (prepareFrame.current !== undefined) window.cancelAnimationFrame(prepareFrame.current);
    if (revealFrame.current !== undefined) window.cancelAnimationFrame(revealFrame.current);
  }, []);

  const warmIndex = useCallback((index: number, priority: WarmPriority, requestedLimit?: number) => {
    const page = pages[index];
    if (!page) return;
    warmPageMedia(page.items, priority, requestedLimit);
  }, [pages]);

  useEffect(() => {
    if (!pages.length) return;
    const run = () => {
      const budget = warmBudget('idle');
      if (budget <= 0) return;
      warmIndex(pageIndex + 1, 'idle', budget);
      warmIndex(pageIndex - 1, 'idle', Math.min(3, budget));
      warmIndex(pageIndex + 2, 'idle', Math.min(3, budget));
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(run, { timeout: 900 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 360);
    return () => window.clearTimeout(id);
  }, [pageIndex, pages.length, warmIndex]);

  useEffect(() => {
    if (turn?.phase !== 'prepare') return;
    prepareFrame.current = window.requestAnimationFrame(() => {
      revealFrame.current = window.requestAnimationFrame(() => {
        setTurn((active) => active?.phase === 'prepare' ? { ...active, phase: 'turn' } : active);
        revealFrame.current = undefined;
      });
      prepareFrame.current = undefined;
    });
    return () => {
      if (prepareFrame.current !== undefined) window.cancelAnimationFrame(prepareFrame.current);
      if (revealFrame.current !== undefined) window.cancelAnimationFrame(revealFrame.current);
      prepareFrame.current = undefined;
      revealFrame.current = undefined;
    };
  }, [turn?.phase]);

  const completeTurn = useCallback(() => {
    if (!turn) return;
    if (turnFallback.current !== undefined) {
      window.clearTimeout(turnFallback.current);
      turnFallback.current = undefined;
    }
    setPageIndex(turn.targetIndex);
    setTurn(undefined);
  }, [turn]);

  useEffect(() => {
    if (turn?.phase !== 'turn') return;
    turnFallback.current = window.setTimeout(completeTurn, TURN_FALLBACK_MS);
    return () => {
      if (turnFallback.current !== undefined) window.clearTimeout(turnFallback.current);
      turnFallback.current = undefined;
    };
  }, [completeTurn, turn?.phase]);

  const navigate = useCallback((nextIndex: number) => {
    if (turn || !pages.length) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, nextIndex));
    if (clamped === pageIndex) return;
    const direction: TurnDirection = clamped > pageIndex ? 'forward' : 'backward';
    warmIndex(clamped, 'immediate');

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPageIndex(clamped);
      return;
    }

    setTurn({ targetIndex: clamped, direction, phase: 'prepare' });
  }, [pageIndex, pages.length, turn, warmIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigate(pageIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(pageIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, pageIndex]);

  const currentPage = pages[pageIndex];
  const targetPage = turn ? pages[turn.targetIndex] : undefined;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (turn) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    swipeWarmDirection.current = undefined;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || turn) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 18 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    const direction: TurnDirection = dx < 0 ? 'forward' : 'backward';
    if (swipeWarmDirection.current === direction) return;
    swipeWarmDirection.current = direction;
    warmIndex(direction === 'forward' ? pageIndex + 1 : pageIndex - 1, 'immediate');
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = undefined;
    swipeWarmDirection.current = undefined;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 58 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    navigate(dx < 0 ? pageIndex + 1 : pageIndex - 1);
  };

  const cancelPointer = () => {
    swipeStart.current = undefined;
    swipeWarmDirection.current = undefined;
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) < 44 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.15) return;
    event.preventDefault();
    navigate(event.deltaX > 0 ? pageIndex + 1 : pageIndex - 1);
  };

  if (!currentPage) return <div className={styles.empty}>{empty}</div>;

  const pageContents = (page: typeof currentPage) => (
    <div className={layoutMode === 'feed' ? styles.feed : styles.grid}>
      {page.items.map((item) => (
        <div
          className={styles.card}
          key={item.id}
          data-frontier-fluid-card={item.id}
          data-frontier-virtual-card="true"
          data-fluid-expanded="false"
        >
          {renderCard(item, layoutMode)}
        </div>
      ))}
    </div>
  );

  return (
    <section
      className={styles.deck}
      data-frontier-section-deck="true"
      data-frontier-mounted-cards={currentPage.items.length}
      data-frontier-total-items={items.length}
      data-frontier-page-count={pages.length}
      data-frontier-turning={turn?.phase ?? 'idle'}
      data-frontier-page-cache="memory+decoded-media"
      data-frontier-prefetch-depth="next-prev-plus-one"
    >
      <div className={styles.navBar}>
        <div className={styles.sectionIdentity}>
          <span className={styles.eyebrow}>Daily edition · section {pageIndex + 1}</span>
          <h2 className={styles.sectionTitle}>{currentPage.title}</h2>
          <div className={styles.kicker}>{currentPage.kicker}</div>
        </div>
        <div className={styles.controls} aria-label="Section navigation">
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => navigate(pageIndex - 1)}
            onPointerEnter={() => warmIndex(pageIndex - 1, 'immediate')}
            onFocus={() => warmIndex(pageIndex - 1, 'immediate')}
            disabled={pageIndex === 0 || Boolean(turn)}
            aria-label="Previous section"
          ><ChevronLeft size={15} /></button>
          <span className={styles.pageCount}>{pageIndex + 1} / {pages.length}</span>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => navigate(pageIndex + 1)}
            onPointerEnter={() => warmIndex(pageIndex + 1, 'immediate')}
            onFocus={() => warmIndex(pageIndex + 1, 'immediate')}
            disabled={pageIndex >= pages.length - 1 || Boolean(turn)}
            aria-label="Next section"
          ><ChevronRight size={15} /></button>
        </div>
      </div>

      {pages.length > 1 ? (
        <nav className={styles.rail} aria-label="Newspaper sections">
          {pages.map((page, index) => (
            <button
              type="button"
              key={page.id}
              className={`${styles.railButton} ${index === pageIndex ? styles.railActive : ''}`}
              onClick={() => navigate(index)}
              onPointerEnter={() => warmIndex(index, 'idle')}
              onFocus={() => warmIndex(index, 'idle')}
              aria-current={index === pageIndex ? 'page' : undefined}
            >
              {index + 1}. {page.title}
            </button>
          ))}
        </nav>
      ) : null}

      <div
        className={styles.viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelPointer}
        onWheel={onWheel}
      >
        <div className={styles.pageEdge} aria-hidden="true" />

        {targetPage ? (
          <div
            className={`${styles.page} ${styles.incomingPage} ${turn?.phase === 'prepare' ? styles.incomingPrepared : ''} ${turn?.phase === 'turn' && turn.direction === 'forward' ? styles.incomingForward : ''} ${turn?.phase === 'turn' && turn.direction === 'backward' ? styles.incomingBackward : ''}`}
            data-frontier-page-role="incoming"
            aria-hidden="true"
          >
            {pageContents(targetPage)}
          </div>
        ) : null}

        <div
          className={`${styles.page} ${styles.currentPage} ${turn?.phase === 'turn' && turn.direction === 'forward' ? styles.turnForward : ''} ${turn?.phase === 'turn' && turn.direction === 'backward' ? styles.turnBackward : ''}`}
          data-frontier-page-role="current"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget && turn?.phase === 'turn') completeTurn();
          }}
        >
          {pageContents(currentPage)}
        </div>
      </div>

      <div className={styles.hint}>← → / horizontal swipe · adjacent pages and media are warmed before the turn</div>
    </section>
  );
}
