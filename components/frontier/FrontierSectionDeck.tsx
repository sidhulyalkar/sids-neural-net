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

function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  return Boolean(node && (
    node.tagName === 'INPUT'
    || node.tagName === 'TEXTAREA'
    || node.tagName === 'SELECT'
    || node.isContentEditable
  ));
}

function mediaWarmUrl(item: FrontierItem): string | undefined {
  const media = item.media;
  if (!media || media.type === 'none') return undefined;
  return media.proxyUrl ?? media.posterProxyUrl ?? media.url ?? media.poster;
}

export function FrontierSectionDeck({ items, layoutMode, renderCard, empty }: Props) {
  const pageSize = layoutMode === 'feed' ? FRONTIER_SECTION_FEED_PAGE_SIZE : FRONTIER_SECTION_PAGE_SIZE;
  const pages = useMemo(() => buildFrontierSectionPages(items, pageSize), [items, pageSize]);
  const [pageIndex, setPageIndex] = useState(0);
  const [turning, setTurning] = useState<TurnDirection>();
  const turnTimer = useRef<number | undefined>(undefined);
  const swipeStart = useRef<{ x: number; y: number } | undefined>(undefined);

  useEffect(() => () => {
    if (turnTimer.current !== undefined) window.clearTimeout(turnTimer.current);
  }, []);

  const navigate = useCallback((nextIndex: number) => {
    if (turning || !pages.length) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, nextIndex));
    if (clamped === pageIndex) return;
    const direction: TurnDirection = clamped > pageIndex ? 'forward' : 'backward';
    setTurning(direction);
    turnTimer.current = window.setTimeout(() => {
      setPageIndex(clamped);
      setTurning(undefined);
      turnTimer.current = undefined;
    }, 360);
  }, [pageIndex, pages.length, turning]);

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
  const nextPage = pages[pageIndex + 1];

  useEffect(() => {
    if (!nextPage?.items.length) return;
    const warm = () => {
      for (const item of nextPage.items.slice(0, 2)) {
        const url = mediaWarmUrl(item);
        if (!url) continue;
        const image = new Image();
        image.decoding = 'async';
        image.loading = 'eager';
        image.src = url;
      }
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(warm, { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 520);
    return () => window.clearTimeout(id);
  }, [nextPage]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = undefined;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    navigate(dx < 0 ? pageIndex + 1 : pageIndex - 1);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) < 44 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.15) return;
    event.preventDefault();
    navigate(event.deltaX > 0 ? pageIndex + 1 : pageIndex - 1);
  };

  if (!currentPage) return <div className={styles.empty}>{empty}</div>;

  return (
    <section
      className={styles.deck}
      data-frontier-section-deck="true"
      data-frontier-mounted-cards={currentPage.items.length}
      data-frontier-total-items={items.length}
      data-frontier-page-count={pages.length}
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
            disabled={pageIndex === 0 || Boolean(turning)}
            aria-label="Previous section"
          ><ChevronLeft size={15} /></button>
          <span className={styles.pageCount}>{pageIndex + 1} / {pages.length}</span>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => navigate(pageIndex + 1)}
            disabled={pageIndex >= pages.length - 1 || Boolean(turning)}
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
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipeStart.current = undefined; }}
        onWheel={onWheel}
      >
        <div className={styles.pageEdge} aria-hidden="true" />
        <div className={`${styles.page} ${turning === 'forward' ? styles.turnForward : ''} ${turning === 'backward' ? styles.turnBackward : ''}`}>
          <div className={layoutMode === 'feed' ? styles.feed : styles.grid}>
            {currentPage.items.map((item) => (
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
        </div>
      </div>

      <div className={styles.hint}>← → / horizontal swipe · next section media warms during idle</div>
    </section>
  );
}
