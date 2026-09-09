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
  renderCard: (item: FrontierItem, mode: FrontierLayoutMode, index: number) => ReactNode;
  empty?: ReactNode;
};

type TurnDirection = 'forward' | 'backward';
type WarmPriority = 'idle' | 'immediate';
type ConnectionHint = { saveData?: boolean; effectiveType?: string };

const MAX_DECODED_MEDIA = 18;
const WHEEL_NAV_THRESHOLD = 72;
const WHEEL_GESTURE_RESET_MS = 170;
const WHEEL_NAV_LOCK_MS = 420;
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

  const youtubeId = media.type === 'youtube' ? media.url : undefined;
  if (youtubeId && /^[A-Za-z0-9_-]{6,20}$/.test(youtubeId)) {
    const hq = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    return [`/api/frontier/media?url=${encodeURIComponent(hq)}`];
  }

  return [];
}

function connectionHint(): ConnectionHint | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: ConnectionHint }).connection;
}

function warmBudget(priority: WarmPriority): number {
  const connection = connectionHint();
  if (connection?.saveData) return priority === 'immediate' ? 1 : 0;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return 1;
  if (connection?.effectiveType === '3g') return priority === 'immediate' ? 2 : 1;
  return priority === 'immediate' ? 3 : 2;
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
  const swipeStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const swipeWarmDirection = useRef<TurnDirection | undefined>(undefined);
  const lastNavigateDirection = useRef<TurnDirection>('forward');
  const wheelDelta = useRef(0);
  const wheelDirection = useRef(0);
  const wheelResetTimer = useRef<number | undefined>(undefined);
  const wheelLockedUntil = useRef(0);
  const activePageIndex = pages.length ? Math.min(pageIndex, pages.length - 1) : 0;

  const warmIndex = useCallback((index: number, priority: WarmPriority, requestedLimit?: number) => {
    const page = pages[index];
    if (!page) return;
    warmPageMedia(page.items, priority, requestedLimit);
  }, [pages]);

  useEffect(() => {
    if (!pages.length) return;
    warmIndex(activePageIndex, 'immediate', Math.min(2, warmBudget('immediate')));

    const run = () => {
      const budget = warmBudget('idle');
      if (budget <= 0) return;
      warmIndex(activePageIndex + 1, 'idle', Math.min(2, budget));
      warmIndex(activePageIndex - 1, 'idle', Math.min(1, budget));
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(run, { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 500);
    return () => window.clearTimeout(id);
  }, [activePageIndex, pages.length, warmIndex]);

  useEffect(() => () => {
    if (wheelResetTimer.current !== undefined) window.clearTimeout(wheelResetTimer.current);
  }, []);

  const navigate = useCallback((nextIndex: number) => {
    if (!pages.length) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, nextIndex));
    if (clamped === activePageIndex) return;
    lastNavigateDirection.current = clamped > activePageIndex ? 'forward' : 'backward';
    warmIndex(clamped, 'immediate', 3);
    setPageIndex(clamped);
  }, [activePageIndex, pages.length, warmIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigate(activePageIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(activePageIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePageIndex, navigate]);

  const currentPage = pages[activePageIndex];

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
    swipeWarmDirection.current = undefined;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 18 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    const direction: TurnDirection = dx < 0 ? 'forward' : 'backward';
    if (swipeWarmDirection.current === direction) return;
    swipeWarmDirection.current = direction;
    warmIndex(direction === 'forward' ? activePageIndex + 1 : activePageIndex - 1, 'immediate', 3);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = undefined;
    swipeWarmDirection.current = undefined;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 58 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    navigate(dx < 0 ? activePageIndex + 1 : activePageIndex - 1);
  };

  const cancelPointer = () => {
    swipeStart.current = undefined;
    swipeWarmDirection.current = undefined;
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const horizontal = Math.abs(event.deltaX);
    const vertical = Math.abs(event.deltaY);
    if (horizontal < 4 || horizontal < vertical * 1.1) return;
    event.preventDefault();

    const now = performance.now();
    const direction = Math.sign(event.deltaX);
    if (wheelDirection.current && direction !== wheelDirection.current) wheelDelta.current = 0;
    wheelDirection.current = direction;
    wheelDelta.current += event.deltaX;

    if (wheelResetTimer.current !== undefined) window.clearTimeout(wheelResetTimer.current);
    wheelResetTimer.current = window.setTimeout(() => {
      wheelDelta.current = 0;
      wheelDirection.current = 0;
      wheelResetTimer.current = undefined;
    }, WHEEL_GESTURE_RESET_MS);

    if (now < wheelLockedUntil.current || Math.abs(wheelDelta.current) < WHEEL_NAV_THRESHOLD) return;
    const next = wheelDelta.current > 0 ? activePageIndex + 1 : activePageIndex - 1;
    wheelLockedUntil.current = now + WHEEL_NAV_LOCK_MS;
    wheelDelta.current = 0;
    wheelDirection.current = 0;
    navigate(next);
  };

  if (!currentPage) return <div className={styles.empty}>{empty}</div>;

  return (
    <section
      className={styles.deck}
      data-frontier-section-deck="true"
      data-frontier-mounted-cards={currentPage.items.length}
      data-frontier-total-items={items.length}
      data-frontier-page-count={pages.length}
      data-frontier-turning="idle"
      data-frontier-page-cache="decoded-media"
      data-frontier-prefetch-depth="adjacent"
      data-frontier-prefetch-budget="3-intent-2-next-1-prev"
      data-frontier-fast-swap="true"
      data-frontier-transition="single-plane"
      data-frontier-wheel-coalescing="true"
    >
      <div className={styles.navBar}>
        <div className={styles.sectionIdentity}>
          <span className={styles.eyebrow}>Daily edition · section {activePageIndex + 1}</span>
          <h2 className={styles.sectionTitle}>{currentPage.title}</h2>
          <div className={styles.kicker}>{currentPage.kicker}</div>
        </div>
        <div className={styles.controls} aria-label="Section navigation">
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => navigate(activePageIndex - 1)}
            onPointerEnter={() => warmIndex(activePageIndex - 1, 'immediate', 3)}
            onFocus={() => warmIndex(activePageIndex - 1, 'immediate', 3)}
            disabled={activePageIndex === 0}
            aria-label="Previous section"
          ><ChevronLeft size={15} /></button>
          <span className={styles.pageCount}>{activePageIndex + 1} / {pages.length}</span>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => navigate(activePageIndex + 1)}
            onPointerEnter={() => warmIndex(activePageIndex + 1, 'immediate', 3)}
            onFocus={() => warmIndex(activePageIndex + 1, 'immediate', 3)}
            disabled={activePageIndex >= pages.length - 1}
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
              className={`${styles.railButton} ${index === activePageIndex ? styles.railActive : ''}`}
              onClick={() => navigate(index)}
              onPointerEnter={() => warmIndex(index, 'idle', 1)}
              onFocus={() => warmIndex(index, 'idle', 1)}
              aria-current={index === activePageIndex ? 'page' : undefined}
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
        <div
          key={currentPage.id}
          className={`${styles.page} ${styles.currentPage}`}
          data-frontier-page-role="current"
          data-frontier-page-direction={lastNavigateDirection.current}
        >
          <div className={layoutMode === 'feed' ? styles.feed : styles.grid}>
            {currentPage.items.map((item, index) => (
              <div
                className={styles.card}
                key={item.id}
                data-frontier-card-rank={index + 1}
                data-frontier-fluid-card={item.id}
                data-frontier-virtual-card="true"
                data-fluid-expanded="false"
              >
                {renderCard(item, layoutMode, index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}