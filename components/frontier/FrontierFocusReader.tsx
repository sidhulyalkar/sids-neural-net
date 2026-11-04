'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, ListFilter, RefreshCw, Search, X } from 'lucide-react';
import { FrontierSignalTrail } from './FrontierSignalTrail';
import { buildFrontierStoryPresentation } from '@/lib/frontier/storyPresentation';
import { buildFrontierEditionContents, frontierReaderFormat } from '@/lib/frontier/editionContents';
import { frontierHasNewStories, frontierShouldCheckLatest } from '@/lib/frontier/liveFeedPolicy';
import { buildFrontierSourceBrief, frontierSourceFigures } from '@/lib/frontier/sourceBrief';
import { rankFrontierItems, selectDailyRun } from '@/lib/frontier/scoring';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierFeedResponse, FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-focus-reader.module.css';

const EDITION_LIMIT = 36;

type Props = {
  initialItems: FrontierItem[];
  generatedAt: string;
};

function cleanUrlHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www[.]/, ''); } catch { return ''; }
}

function sourceDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.valueOf()) ? 'Recent' : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
  }).format(parsed);
}

/** One DOM article and at most one image are mounted at any point in time. */
export function FrontierFocusReader({ initialItems, generatedAt }: Props) {
  // Server-rendered edition already came from the full evidence-qualified
  // inventory. Do not re-select from its truncated 36-item output, which can
  // subtly alter the canonical first 14 slots and break selection provenance.
  const [items, setItems] = useState(() => initialItems.slice(0, EDITION_LIMIT));
  const [position, setPosition] = useState(0);
  const [editionAt, setEditionAt] = useState(generatedAt);
  const [searchDraft, setSearchDraft] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestChecking, setLatestChecking] = useState(false);
  const [latestReady, setLatestReady] = useState<{ items: FrontierItem[]; generatedAt: string } | null>(null);
  const [error, setError] = useState('');
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [nativeImageWidth, setNativeImageWidth] = useState<number | null>(null);
  const [figureIndex, setFigureIndex] = useState(0);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const contentsButtonRef = useRef<HTMLButtonElement>(null);
  const contentsPanelRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const backgroundRef = useRef<AbortController | null>(null);
  const readerInteractedRef = useRef(false);
  const initialPersonalizationAppliedRef = useRef(false);
  const editionVersionRef = useRef(0);

  const history = useFrontierStore((state) => state.history);
  const saved = useFrontierStore((state) => state.saved);
  const hydrated = useFrontierStore((state) => state.hydrated);
  const markSeen = useFrontierStore((state) => state.markSeen);
  const recordDwell = useFrontierStore((state) => state.recordDwell);
  const recordOpen = useFrontierStore((state) => state.recordOpen);
  const rateInterest = useFrontierStore((state) => state.rateInterest);
  const toggleSave = useFrontierStore((state) => state.toggleSave);

  const editionContents = useMemo(() => buildFrontierEditionContents(items), [items]);
  const item = items[position];
  const rating = item ? history[item.id]?.interestScore : undefined;
  const isSaved = Boolean(item && saved[item.id]);
  const figures = useMemo(() => item ? frontierSourceFigures(item) : [], [item]);
  const activeFigure = figures[Math.min(figureIndex, Math.max(0, figures.length - 1))];
  // A failed HD proxy must retry the original publisher image before the
  // editorial fallback. Never retry a source that already failed.
  const imageCandidates = activeFigure
    ? [...new Set([activeFigure.url, ...(activeFigure.fallbackUrls ?? []), activeFigure.fallbackUrl].filter((url): url is string => Boolean(url)))]
    : [];
  const image = imageCandidates.find((candidate) => !failedImages.includes(candidate));
  const canShowImage = Boolean(image);
  const imageKey = item && image ? `${item.id}:${figureIndex}:${image}` : '';
  const imageReady = Boolean(imageKey && loadedImageKey === imageKey);

  useEffect(() => {
    if (!hydrated || initialPersonalizationAppliedRef.current) return;
    // Rendering must never wait for the wider inventory. A returning reader
    // loads the other candidates *after* first paint; a new reader pays no
    // additional request or 96-item React flight payload.
    const controller = new AbortController();
    const startingEdition = editionVersionRef.current;
    const timer = window.setTimeout(async () => {
      if (initialPersonalizationAppliedRef.current) return;
      initialPersonalizationAppliedRef.current = true;
      if (readerInteractedRef.current || document.visibilityState === 'hidden') return;
      const state = useFrontierStore.getState();
      const hasTaste = state.profile.meaningfulInteractions > 0
        || Object.values(state.history).some((entry) => entry.interestScore !== undefined || Boolean(entry.reaction));
      if (!hasTaste) return;
      let candidates = initialItems;
      try {
        const response = await fetch('/api/frontier/feed?candidates=1', {
          cache: 'no-store', signal: controller.signal,
        });
        if (response.ok && response.headers.get('X-Frontier-Live') === 'snapshot-candidates') {
          const snapshot = await response.json() as FrontierFeedResponse;
          if (Array.isArray(snapshot.items) && snapshot.items.length > initialItems.length) {
            candidates = snapshot.items;
          }
        }
      } catch {
        // Preserve offline first paint and still rank the available candidates.
      }
      if (controller.signal.aborted || readerInteractedRef.current || startingEdition !== editionVersionRef.current) return;
      const latest = useFrontierStore.getState();
      const ranked = rankFrontierItems(candidates, latest.profile, latest.history, new Date(), latest.behavior);
      const selected = selectDailyRun(ranked, latest.history, EDITION_LIMIT);
      if (!selected.length || controller.signal.aborted || readerInteractedRef.current) return;
      setItems((current) => {
        const first = current[0];
        // Pin the initially visible story so a preference update never flashes
        // a new article under the reader's eyes.
        if (!first || latest.history[first.id]?.reaction === 'hide') return selected;
        return [first, ...selected.filter((candidate) => candidate.id !== first.id)].slice(0, EDITION_LIMIT);
      });
    }, 850);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [hydrated, initialItems]);

  const commitRating = useCallback((score: number) => {
    if (!item) return;
    readerInteractedRef.current = true;
    // Keep the same persisted numeric and coarse reactions. Only the input
    // modality changes; viewing, ranking and history are unaffected.
    rateInterest(item, score, 'slider');
    setNotice('Saved ' + score + '/10');
  }, [item, rateInterest]);

  const navigateTo = useCallback((target: number) => {
    readerInteractedRef.current = true;
    setNotice('');
    setFailedImages([]);
    setLoadedImageKey(null);
    setNativeImageWidth(null);
    setFigureIndex(0);
    setPosition(Math.max(0, Math.min(items.length - 1, target)));
    setContentsOpen(false);
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [items.length]);

  const move = useCallback((delta: number) => {
    navigateTo(position + delta);
  }, [navigateTo, position]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && contentsOpen) {
        event.preventDefault();
        setContentsOpen(false);
        contentsButtonRef.current?.focus();
        return;
      }
      if (contentsOpen || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, contentsOpen]);

  // A modal index should not allow keyboard focus or mobile scrolling behind
  // the panel. The selected story receives focus separately after navigation.
  useEffect(() => {
    if (!contentsOpen) return;
    const panel = contentsPanelRef.current;
    if (!panel) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const current = panel.querySelector<HTMLButtonElement>('[data-frontier-contents-entry][aria-current="true"]');
    (current ?? panel.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      document.body.style.overflow = priorOverflow;
    };
  }, [contentsOpen]);

  useEffect(() => {
    if (!item || !hydrated) return;
    let visibleAt: number | null = document.visibilityState === 'visible' ? performance.now() : null;
    let accumulated = 0;
    let registered = false;
    const mark = () => {
      if (registered || document.visibilityState !== 'visible') return;
      registered = true;
      markSeen(item);
    };
    const seenTimer = window.setTimeout(mark, 1100);
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        if (visibleAt !== null) accumulated += performance.now() - visibleAt;
        visibleAt = null;
      } else if (visibleAt === null) {
        visibleAt = performance.now();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(seenTimer);
      document.removeEventListener('visibilitychange', visibility);
      if (visibleAt !== null) accumulated += performance.now() - visibleAt;
      if (accumulated >= 1000) recordDwell(item, Math.min(120_000, Math.round(accumulated)));
    };
  }, [item, hydrated, markSeen, recordDwell]);

  useEffect(() => () => {
    requestRef.current?.abort();
    backgroundRef.current?.abort();
  }, []);

  const applyLatest = useCallback((edition: { items: FrontierItem[]; generatedAt: string }) => {
    editionVersionRef.current += 1;
    setItems(edition.items.slice(0, EDITION_LIMIT));
    setPosition(0);
    setEditionAt(edition.generatedAt);
    setActiveQuery('');
    setFailedImages([]);
    setLoadedImageKey(null);
    setNativeImageWidth(null);
    setFigureIndex(0);
    setContentsOpen(false);
    setLatestReady(null);
    setNotice('');
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // First paint remains the server snapshot. Once idle, request the shared
  // recent-source cache in the background. Never poll, and never swap an active
  // reader's article: show a small "latest ready" chip instead.
  useEffect(() => {
    if (!frontierShouldCheckLatest(generatedAt)) return;
    const controller = new AbortController();
    let tried = false;
    let disposed = false;
    backgroundRef.current = controller;
    const check = async () => {
      if (tried || document.visibilityState !== 'visible' || disposed) return;
      tried = true;
      setLatestChecking(true);
      try {
        const response = await fetch('/api/frontier/feed?latest=1', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok || response.headers.get('X-Frontier-Live') === 'snapshot-fallback') return;
        const payload = await response.json() as FrontierFeedResponse;
        if (controller.signal.aborted || !Array.isArray(payload.items) || !payload.items.length) return;
        const store = useFrontierStore.getState();
        const ranked = rankFrontierItems(payload.items, store.profile, store.history, new Date(), store.behavior);
        const next = selectDailyRun(ranked.length ? ranked : payload.items, store.history, EDITION_LIMIT);
        const initiallyVisible = selectDailyRun(initialItems, {}, EDITION_LIMIT);
        if (!frontierHasNewStories(initiallyVisible.map((entry) => entry.id), next.map((entry) => entry.id))) return;
        const edition = { items: next, generatedAt: payload.generatedAt };
        // Reading without clicking or scrolling is still reading. Never swap
        // an article underneath someone after an asynchronous cache refresh.
        // A visible "Latest ready" action lets them choose when to switch.
        setLatestReady(edition);
      } catch {
        // A valid snapshot is still on screen. No noisy errors on a background
        // fetch failure; manual refresh remains available.
      } finally {
        if (!disposed) setLatestChecking(false);
      }
    };
    const timer = window.setTimeout(() => { void check(); }, 1_400);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener('visibilitychange', onVisible);
      if (backgroundRef.current === controller) backgroundRef.current = null;
    };
  }, [generatedAt, initialItems, applyLatest]);

  // Warm one upcoming publisher image without mounting additional DOM media.
  // Avoid speculative downloads for Data Saver and slow connections.
  useEffect(() => {
    const next = items[position + 1];
    if (!next || document.visibilityState !== 'visible') return;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection;
    if (connection?.saveData || connection?.effectiveType === '2g') return;
    const url = frontierSourceFigures(next)[0]?.url;
    if (!url) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      const cached = new window.Image();
      cached.decoding = 'async';
      cached.src = url;
    }, 950);
    return () => window.clearTimeout(timer);
  }, [items, position]);

  const retrieve = useCallback(async (query: string, fresh: boolean) => {
    readerInteractedRef.current = true;
    requestRef.current?.abort();
    backgroundRef.current?.abort();
    setLatestReady(null);
    setContentsOpen(false);
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('focus', query);
      if (fresh && query) params.set('fresh', '1');
      if (fresh && !query) params.set('latest', '1');
      const response = await fetch('/api/frontier/feed?' + params.toString(), {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Feed unavailable (' + response.status + ')');
      if (response.headers.get('X-Frontier-Live') === 'snapshot-fallback') {
        throw new Error('Recent source search is temporarily unavailable; the saved edition remains available.');
      }
      const payload = await response.json() as FrontierFeedResponse & { error?: string };
      if (controller.signal.aborted) return;
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error(payload.error || 'No matching articles. Try another topic or refresh.');
      }
      const state = useFrontierStore.getState();
      const ranked = rankFrontierItems(payload.items, state.profile, state.history, new Date(), state.behavior);
      const next = selectDailyRun(ranked.length ? ranked : payload.items, state.history, EDITION_LIMIT);
      editionVersionRef.current += 1;
      setItems(next);
      setPosition(0);
      setEditionAt(payload.generatedAt);
      setActiveQuery(query);
      setNotice('');
      setFailedImages([]);
       setLoadedImageKey(null);
    setNativeImageWidth(null);
      setFigureIndex(0);
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not refresh');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchDraft.replace(/\s+/g, ' ').trim().slice(0, 64);
    if (query.length >= 2) void retrieve(query, false);
  };
  const hasNext = position < items.length - 1;
  const progress = items.length ? Math.round(((position + 1) / items.length) * 100) : 0;

  const sourceBrief = useMemo(() => buildFrontierSourceBrief(item?.summary || '', item?.sourceKind), [item?.summary, item?.sourceKind]);
  const presentation = useMemo(() => item ? buildFrontierStoryPresentation(item) : null, [item]);

  return (
    <section className={styles.reader} aria-label="Frontier focused reader" data-frontier-edition-at={editionAt}>
      <header className={styles.masthead}>
        <Link href="/" className={styles.brand}>FRONTIER<span className={styles.brandDot}>.</span></Link>
        <div className={styles.topActions}>
          <button ref={contentsButtonRef} type="button" className={styles.contentsToggle}
            aria-expanded={contentsOpen} aria-controls="frontier-edition-contents" aria-label="Browse edition"
            onClick={() => { readerInteractedRef.current = true; setContentsOpen((open) => !open); }}
            title="Browse this edition">
            <ListFilter size={17} aria-hidden="true" />
            <span>Contents</span>
          </button>
          <form role="search" onSubmit={onSearch} className={styles.search}>
            <Search aria-hidden="true" size={17} />
            <input aria-label="Search live topics" placeholder="Search" value={searchDraft}
              onFocus={() => { readerInteractedRef.current = true; }}
              onChange={(event) => setSearchDraft(event.target.value)} maxLength={64} />
          </form>
          {latestReady ? (
            <button type="button" className={styles.latestChip} onClick={() => {
              readerInteractedRef.current = true;
              applyLatest(latestReady);
            }} aria-label="Open latest discovered articles">Latest ready <span aria-hidden="true">↗</span></button>
          ) : latestChecking ? <span className={styles.checkingLatest} aria-label="Checking recent articles">Updating…</span> : null}
          <button type="button" className={styles.iconButton} title="Refresh live edition"
            aria-label="Refresh live edition" disabled={loading} onClick={() => void retrieve(activeQuery, true)}>
            <RefreshCw size={18} aria-hidden="true" className={loading ? styles.spinning : ''} />
          </button>
          <a href="/frontier/advanced" className={styles.advanced} title="Explore the complete frontier">Explore <span aria-hidden="true">↗</span></a>
        </div>
      </header>
      {contentsOpen ? (
        <div className={styles.contentsLayer}>
          <button className={styles.contentsBackdrop} type="button" tabIndex={-1}
            aria-label="Dismiss edition contents" onClick={() => {
              setContentsOpen(false); contentsButtonRef.current?.focus();
            }} />
          <nav ref={contentsPanelRef} id="frontier-edition-contents" className={styles.contentsPanel}
            role="dialog" aria-modal="true" aria-label="Edition contents"
            data-frontier-contents-panel="true">
            <div className={styles.contentsHeader}>
              <div><strong>In this edition</strong><span>{items.length} stories · Curated order</span></div>
              <button type="button" aria-label="Close edition contents" onClick={() => {
                setContentsOpen(false); contentsButtonRef.current?.focus();
              }}><X size={18} aria-hidden="true" /></button>
            </div>
            <div className={styles.contentsGroups}>
              {editionContents.map((group) => (
                <section key={group.id} className={styles.contentsGroup} aria-label={group.label}>
                  <h2>{group.label}<span>{group.entries.length}</span></h2>
                  {group.entries.map((entry) => (
                    <button key={entry.item.id} type="button" className={styles.contentsEntry}
                      data-frontier-contents-entry={entry.position}
                      aria-current={entry.position === position ? 'true' : undefined}
                      onClick={() => {
                        navigateTo(entry.position);
                        window.requestAnimationFrame(() => headlineRef.current?.focus({ preventScroll: true }));
                      }}>
                      <span className={styles.contentsOrdinal}>{String(entry.position + 1).padStart(2, '0')}</span>
                      <span className={styles.contentsEntryText}>
                        <strong>{entry.item.title}</strong>
                        <small>{entry.item.sourceLabel} · {frontierReaderFormat(entry.item)}</small>
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
            <a className={styles.contentsExplore} href="/frontier/advanced">
              Explore the full frontier <ExternalLink size={14} aria-hidden="true" />
            </a>
          </nav>
        </div>
      ) : null}
      <div className={styles.progressTrack} role="progressbar" aria-valuenow={position + (items.length ? 1 : 0)}
        aria-valuemin={0} aria-valuemax={items.length || 1} aria-label="Article progress">
        <span style={{ width: progress + '%' }} />
      </div>

      {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      {item ? (
        <div className={styles.stage} key={item.id}>
          <article className={styles.article} data-frontier-story-format={presentation?.format}>
            <div className={styles.headline}>
              <div className={styles.headlineMeta}>
                <span className={styles.kicker}>{item.lane.replace(/_/g, ' ')} <span className={styles.separator}>/</span> {item.sourceLabel} <span className={styles.separator}>·</span> {frontierReaderFormat(item)}</span>
                <span className={styles.counter}>{String(position + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
              </div>
              <h1 ref={headlineRef} tabIndex={-1}>{item.title}</h1>
              {item.authors?.length ? <p className={styles.byline}>{item.authors.slice(0, 3).join(', ')}</p> : null}
          <nav className={styles.navigation} aria-label="Article navigation">
            <button type="button" className={styles.previous} data-frontier-previous="true"
              onClick={() => move(-1)} disabled={position === 0 || loading}
              aria-label="Previous article" title="Previous article">
              <ArrowLeft size={22} aria-hidden="true" /><span className={styles.srOnly}>Back</span>
            </button>
            <button type="button" className={styles.next} data-frontier-next="true"
              aria-label={hasNext ? 'Next article' : 'Get fresh edition'}
              onClick={() => hasNext ? move(1) : void retrieve(activeQuery, true)}
              disabled={!item || loading} title={hasNext ? 'Next article' : 'Get fresh edition'}>
              <span className={styles.srOnly}>{hasNext ? 'Next' : 'New edition'}</span>
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </nav>
            </div>

            <div className={styles.storyBody}
              data-frontier-source-image={canShowImage ? 'true' : 'false'}
              data-frontier-sports-state={item.sportsState ? 'true' : 'false'}>
              {canShowImage && image && !item.sportsState ? (
              <figure className={styles.visual} data-frontier-figure-count={figures.length}>
                <div className={styles.visualViewport} data-frontier-media={canShowImage ? 'source-image' : 'source-only'}>
                  {canShowImage && image ? (
                    <>
                      {!imageReady ? <div className={styles.imagePlaceholder} aria-hidden="true" /> : null}
                    <Image
                      unoptimized
                      src={image}
                      alt={activeFigure?.alt || item.title}
                      width={1200}
                      height={760}
                      sizes="(max-width: 900px) 100vw, 56vw"
                      priority={position === 0 && figureIndex === 0}
                      key={imageKey}
                      className={styles.heroImage}
                      data-frontier-media-ready={imageReady ? 'true' : 'false'}
                      style={nativeImageWidth && nativeImageWidth < 720 ? { maxWidth: nativeImageWidth + 'px' } : undefined}
                      onLoad={(event) => {
                        const width = event.currentTarget.naturalWidth;
                        if (width < 720 && imageCandidates.some((candidate) => candidate !== image && !failedImages.includes(candidate))) {
                          setFailedImages((current) => current.includes(image) ? current : [...current, image]);
                          return;
                        }
                        setNativeImageWidth(width);
                        setLoadedImageKey(imageKey);
                      }}
                      onError={() => setFailedImages((current) => current.includes(image) ? current : [...current, image])}
                    />
                    </>
                  ) : (
                    <div className={styles.editorial} aria-label="Article without source imagery">
                      <span className={styles.editorialKicker}>{frontierReaderFormat(item)}</span>
                      <span className={styles.editorialMark} aria-hidden="true">✧</span>
                      <span className={styles.editorialDomain}>{cleanUrlHost(item.url)}</span>
                    </div>
                  )}
                </div>
                {figures.length > 1 ? (
                  <nav className={styles.figureRail} aria-label="Source figures">
                    {figures.map((figure, index) => (
                      <button key={figure.url} type="button" aria-label={'View source figure ' + (index + 1)}
                        aria-pressed={index === figureIndex}
                        onClick={() => { readerInteractedRef.current = true; setFigureIndex(index); setFailedImages([]);
                          setLoadedImageKey(null); setNativeImageWidth(null); }}>
                        {String(index + 1).padStart(2, '0')}
                      </button>
                    ))}
                  </nav>
                ) : null}
                {activeFigure?.caption && activeFigure.caption !== item.title ? (
                  <figcaption className={styles.caption}>
                    <span>{activeFigure.caption}</span>
                    <span>{activeFigure.credit || item.sourceLabel}</span>
                  </figcaption>
                ) : null}
              </figure>
              ) : null}

              <div ref={contentRef} className={styles.content}
                onScroll={() => { readerInteractedRef.current = true; }}
                onTouchStart={() => { readerInteractedRef.current = true; }}>
                {presentation?.sportsPriority && item.sportsState ? (
                  <section className={styles.featuredSports} aria-label="Source sports evidence">
                    <h2>{item.sportsState.leagueLabel} · {item.sportsState.kind === 'scoreboard' ? 'Scores & schedule' : 'Standings'}</h2>
                    <div className={styles.gameRows}>{item.sportsState.kind === 'scoreboard'
                      ? item.sportsState.games.slice(0, 6).map((game) => (
                        <div key={game.id} className={styles.gameRow}>
                          <span>{game.competitors.map((team) => team.shortName).join(' · ')}</span>
                          <strong>{game.competitors.map((team) => team.score ?? '–').join(' : ')}</strong>
                          <small>{game.status}</small>
                        </div>
                      ))
                      : item.sportsState.standings.slice(0, 8).map((team) => (
                        <div key={team.team} className={styles.gameRow}>
                          <span>{team.rank}. {team.team}</span>
                          <strong>{team.record || (team.points === undefined ? '–' : String(team.points) + ' pts')}</strong>
                        </div>
                      ))}</div>
                    <p>Source snapshot · {sourceDate(item.publishedAt)}. Scores may have changed.</p>
                  </section>
                ) : null}
                <section className={styles.briefSection} aria-label="Source-grounded summary">
                  {presentation ? <h2 className={styles.briefLabel}>{presentation.summaryLabel}</h2> : null}
                  <p className={styles.summary}>{sourceBrief.lead || 'This source did not include a synopsis. Read the original for the full story.'}</p>
                  {presentation?.evidenceNote ? (
                    <p className={styles.provenanceHint}>{presentation.evidenceNote}</p>
                  ) : null}
                  {sourceBrief.previewTruncated ? (
                    <p className={styles.previewNotice}>
                      Source preview is incomplete. <a href={item.url} target="_blank" rel="noopener noreferrer">
                        Read the full source <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </p>
                  ) : null}
                  {sourceBrief.details.length ? (
                    <div className={styles.sourcePoints}>
                      <h2>From the source</h2>
                      <ul>{sourceBrief.details.slice(0, 2).map((part, index) =>
                        <li key={index}>{part}</li>)}</ul>
                    </div>
                  ) : null}
                  {sourceBrief.details.length > 2 ? (
                    <details className={styles.sourceDetail}>
                      <summary>{presentation?.detailLabel ?? 'More source context'}</summary>
                      <div className={styles.detailBody}>{sourceBrief.details.slice(2).map((part, index) => <p key={index}>{part}</p>)}</div>
                    </details>
                  ) : null}
                </section>

                {presentation?.metricSections.length || item.artifacts?.length ? (
                  <details className={styles.evidenceDetails}>
                    <summary>{presentation?.evidenceLabel ?? 'Data & references'}</summary>
                    {presentation?.metricSections.length ? (
                      <section className={styles.evidenceSection} aria-label="Source metrics">
                        {presentation.metricSections.map((group) => (
                          <div key={group.kind} data-frontier-metric-kind={group.kind} className={styles.metricSection}>
                            <h2>{group.title}</h2>
                            <dl className={styles.metricGrid}>{group.metrics.map((metric, index) => (
                              <div key={metric.label + index} className={styles.metricCard}>
                                <dt>{metric.label}</dt><dd>{metric.value}</dd>
                                {metric.detail ? <p>{metric.detail}</p> : null}
                              </div>
                            ))}</dl>
                          </div>
                        ))}
                      </section>
                    ) : null}
                    {item.artifacts?.length ? (
                      <section className={styles.evidenceSection} aria-label="Source artifacts">
                        <h2>References</h2>
                        <div className={styles.artifactGrid}>{item.artifacts.slice(0, 6).map((artifact, index) => (
                          <div className={styles.artifact} key={artifact.label + index}>
                            {artifact.url?.startsWith('https://') ? (
                              <a href={artifact.url} target="_blank" rel="noopener noreferrer">{artifact.label} ↗</a>
                            ) : <strong>{artifact.label}</strong>}
                            {artifact.value ? <small>{artifact.value}</small> : null}
                          </div>
                        ))}</div>
                      </section>
                    ) : null}
                  </details>
                ) : null}
                <div className={styles.articleActions}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => { readerInteractedRef.current = true; recordOpen(item); }}
                    className={styles.sourceLink}>{presentation?.sourceActionLabel ?? 'Original source'} <ExternalLink size={15} aria-hidden="true" /></a>
                  <button type="button" onClick={() => { readerInteractedRef.current = true; toggleSave(item); }}
                    className={styles.saveButton} aria-pressed={isSaved}>
                    <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                  <span className={styles.sourceDate}>{sourceDate(item.publishedAt)}</span>
                </div>
                <div className={styles.interactionArea}>
                  <FrontierSignalTrail key={item.id} itemId={item.id}
                    rating={rating} onRate={commitRating} notice={notice} />
                </div>
              </div>
            </div>
          </article>

        </div>
      ) : (
        <div className={styles.empty}>
          <h1>No articles in this edition</h1>
          <p>The saved edition may have expired. Request the latest stories.</p>
          <button type="button" onClick={() => void retrieve('', true)}>Find fresh stories</button>
        </div>
      )}
    </section>
  );
}
