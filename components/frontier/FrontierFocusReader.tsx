'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { holdToInterestScore } from '@/lib/frontier/interestRating';
import { frontierHasNewStories, frontierShouldCheckLatest } from '@/lib/frontier/liveFeedPolicy';
import { buildFrontierSourceBrief, frontierSourceFigures } from '@/lib/frontier/sourceBrief';
import { journalPresentation, journalRelatedItems, journalRealm, journalSourceFigures } from '@/lib/frontier/journalPresentation';
import { FrontierJournalSourceLens } from './FrontierJournalSourceLens';
import { FrontierJournalEvidence } from './FrontierJournalEvidence';
import { FrontierJournalMedia } from './FrontierJournalMedia';
import { FrontierJournalChapters } from './FrontierJournalChapters';
import { journalChapters } from '@/lib/frontier/journalChapters';
import { journalMediaPlan, journalSafePublicUrl } from '@/lib/frontier/journalMedia';
import { JOURNAL_SECTIONS, journalSectionInventory, journalSectionMatches } from '@/lib/frontier/journalSections';
import type { JournalSectionId } from '@/lib/frontier/journalSections';
import { rankFrontierItems, selectDailyRun } from '@/lib/frontier/scoring';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierFeedResponse, FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-journal.module.css';

const EDITION_LIMIT = 36;

type Props = {
  initialItems: FrontierItem[];
  generatedAt: string;
};

function sourceDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.valueOf()) ? 'Recent' : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
  }).format(parsed);
}

/** One DOM article and at most one image are mounted at any point in time. */
export function FrontierFocusReader({ initialItems, generatedAt }: Props) {
  // Deterministic diverse first edition during SSR, before preference hydration.
  const [baseItems, setItems] = useState(() => selectDailyRun(initialItems, {}, EDITION_LIMIT));
  const [poolItems, setPoolItems] = useState<FrontierItem[]>(initialItems);
  const [activeSection, setActiveSection] = useState<JournalSectionId>('for-you');
  const [position, setPosition] = useState(0);
  const [contentsOpen, setContentsOpen] = useState(false);
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
  const [holdValue, setHoldValue] = useState<number | null>(null);
  const [sliderDraft, setSliderDraft] = useState<{ id: string; value: number } | null>(null);
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const backgroundRef = useRef<AbortController | null>(null);
  const readerInteractedRef = useRef(false);
  const initialPersonalizationAppliedRef = useRef(false);
  const editionVersionRef = useRef(0);
  const holdStartedRef = useRef<number | null>(null);
  const holdFrameRef = useRef<number | null>(null);

  const history = useFrontierStore((state) => state.history);
  const saved = useFrontierStore((state) => state.saved);
  const hydrated = useFrontierStore((state) => state.hydrated);
  const markSeen = useFrontierStore((state) => state.markSeen);
  const recordDwell = useFrontierStore((state) => state.recordDwell);
  const recordOpen = useFrontierStore((state) => state.recordOpen);
  const rateInterest = useFrontierStore((state) => state.rateInterest);
  const toggleSave = useFrontierStore((state) => state.toggleSave);

  const items = useMemo(() => activeSection === 'for-you'
    ? baseItems
    : selectDailyRun(poolItems.filter((candidate) =>
        journalSectionMatches(candidate, activeSection)), history, EDITION_LIMIT),
    [activeSection, baseItems, poolItems, history]);
  const sectionCounts = useMemo(() => {
    const inventory = journalSectionInventory(poolItems);
    return { ...inventory, 'for-you': baseItems.length };
  }, [poolItems, baseItems.length]);
  const sectionMeta = JOURNAL_SECTIONS.find((section) => section.id === activeSection) ?? JOURNAL_SECTIONS[0];
  const item = items[position];
  const rating = item ? history[item.id]?.interestScore : undefined;
  const sliderScore = sliderDraft?.id === item?.id ? sliderDraft.value : (rating ?? 5);
  const isSaved = Boolean(item && saved[item.id]);
  const sourceFigures = useMemo(() => item ? journalSourceFigures(item, frontierSourceFigures(item)) : [], [item]);
  const mediaPlan = item ? journalMediaPlan(item) : null;
  // A publisher-supplied video poster is a gateway to the actual footage,
  // not a second research figure below the same footage.
  const originalPoster = item?.media?.poster;
  const proxiedPoster = item?.media?.posterProxyUrl;
  const mediaPosterFigure = mediaPlan && originalPoster
    ? sourceFigures.find((figure) => figure.url === (proxiedPoster || originalPoster))
    : undefined;
  const mediaPoster = mediaPosterFigure?.url;
  const figures = mediaPosterFigure
    ? sourceFigures.filter((figure) => figure.url !== mediaPosterFigure.url)
    : sourceFigures;
  const activeFigure = figures[Math.min(figureIndex, Math.max(0, figures.length - 1))];
  const figureSourceHref = journalSafePublicUrl(activeFigure?.sourceUrl);
  // A failed HD proxy must retry the original publisher image before the
  // editorial fallback. Never retry a source that already failed.
  const imageCandidates = activeFigure
    ? [...new Set([activeFigure.url, ...(activeFigure.fallbackUrls ?? []), activeFigure.fallbackUrl].filter((url): url is string => Boolean(url)))]
    : [];
  const image = imageCandidates.find((candidate) => !failedImages.includes(candidate));
  const canShowImage = Boolean(image);
  const hasFigureChoices = figures.length > 1;
  const currentVisualGrade = holdValue ?? rating;
  const presentation = item ? journalPresentation(item, canShowImage) : undefined;
  const chapters = item ? journalChapters(item, {
    hasSourceVideo: Boolean(mediaPlan), hasSourceFigure: Boolean(canShowImage),
  }) : [];
  const related = item ? journalRelatedItems(item, items, 3) : [];


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
      setPoolItems(candidates);
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

  const cancelHold = useCallback(() => {
    holdStartedRef.current = null;
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
    holdFrameRef.current = null;
    setHoldValue(null);
  }, []);

  const commitRating = useCallback((score: number, method: 'hold' | 'slider', duration = 0) => {
    if (!item) return;
    readerInteractedRef.current = true;
    rateInterest(item, score, method, duration);
    setSliderDraft({ id: item.id, value: score });
    setNotice('Saved ' + score + '/10');
  }, [item, rateInterest]);

  const beginHold = useCallback(() => {
    if (holdStartedRef.current !== null || !item) return;
    readerInteractedRef.current = true;
    holdStartedRef.current = performance.now();
    setHoldValue(1);
    const tick = () => {
      if (holdStartedRef.current === null) return;
      const next = holdToInterestScore(performance.now() - holdStartedRef.current);
      if (next !== null) setHoldValue((old) => old === next ? old : next);
      holdFrameRef.current = requestAnimationFrame(tick);
    };
    holdFrameRef.current = requestAnimationFrame(tick);
  }, [item]);

  const finishHold = useCallback(() => {
    const started = holdStartedRef.current;
    if (started === null) return;
    const duration = performance.now() - started;
    const next = holdToInterestScore(duration);
    cancelHold();
    if (next === null) {
      setNotice('Hold a little longer to rate');
    } else {
      commitRating(next, 'hold', duration);
    }
  }, [cancelHold, commitRating]);

  const onHoldPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    beginHold();
    // Pointer capture is best-effort: some synthetic/embedded pointer contexts
    // reject it, but a normal press must still start the intentional rating.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* release is still handled on pointerup */ }
  };
  const onHoldKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (event.repeat) return;
    event.preventDefault();
    beginHold();
  };
  const onHoldKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    finishHold();
  };

  const selectSection = (section: JournalSectionId) => {
    if (section === activeSection) return;
    readerInteractedRef.current = true;
    cancelHold();
    setActiveSection(section);
    setPosition(0);
    setContentsOpen(false);
    setFailedImages([]);
    setFigureIndex(0);
    setNativeImageWidth(null);
    setNotice('');
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const move = useCallback((delta: number) => {
    readerInteractedRef.current = true;
    cancelHold();
    setNotice('');
    setFailedImages([]);
    setNativeImageWidth(null);
    setFigureIndex(0);
    setPosition((current) => Math.max(0, Math.min(items.length - 1, current + delta)));
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [cancelHold, items.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

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
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
  }, []);

  const applyLatest = useCallback((edition: { items: FrontierItem[]; generatedAt: string }) => {
    editionVersionRef.current += 1;
    cancelHold();
    setPoolItems(edition.items);
    setItems(edition.items.slice(0, EDITION_LIMIT));
    setActiveSection('for-you');
    setPosition(0);
    setContentsOpen(false);
    setEditionAt(edition.generatedAt);
    setActiveQuery('');
    setFailedImages([]);
    setNativeImageWidth(null);
    setFigureIndex(0);
    setLatestReady(null);
    setNotice('');
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [cancelHold]);

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
        // A saved rating indicates an existing reading session even if this
        // particular tab was just reloaded. Don't reset that reader's place.
        const alreadyReading = initialItems[0] &&
          Boolean(store.history[initialItems[0].id]?.interestScore);
        if (!readerInteractedRef.current && !alreadyReading) {
          applyLatest(edition);
        } else {
          setLatestReady(edition);
        }
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

  const retrieve = useCallback(async (query: string, fresh: boolean) => {
    readerInteractedRef.current = true;
    requestRef.current?.abort();
    backgroundRef.current?.abort();
    setLatestReady(null);
    cancelHold();
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
      setPoolItems(payload.items);
      setItems(next);
      setActiveSection('for-you');
      setPosition(0);
      setContentsOpen(false);
      setEditionAt(payload.generatedAt);
      setActiveQuery(query);
      setNotice('');
      setFailedImages([]);
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
  }, [cancelHold]);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchDraft.replace(/\s+/g, ' ').trim().slice(0, 64);
    if (query.length >= 2) void retrieve(query, false);
  };
  const hasNext = position < items.length - 1;
  const progress = items.length ? Math.round(((position + 1) / items.length) * 100) : 0;

  const sourceBrief = useMemo(() => buildFrontierSourceBrief(item?.summary || '', item?.sourceKind), [item?.summary, item?.sourceKind]);

  return (
    <section className={styles.reader} aria-label="Frontier focused reader" data-frontier-journal="true"
      data-frontier-edition-at={editionAt} data-realm={presentation?.realm ?? sectionMeta.realm} data-format={presentation?.format ?? "brief"}>
      <header className={styles.masthead}>
        <div className={styles.identity}><Link href="/" className={styles.brand}>FRONTIER<span className={styles.brandDot}>.</span></Link><span className={styles.identityCaption}>{activeSection === 'for-you' ? 'A journal of what matters next' : sectionMeta.subtitle}</span></div>
        <div className={styles.topActions}>
          <button type="button" className={styles.contentsToggle} aria-expanded={contentsOpen} aria-controls="frontier-contents" onClick={() => setContentsOpen((open) => !open)}>
            <span>Contents</span><span className={styles.contentsCount}>{String(items.length).padStart(2, '0')}</span>
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
      <nav className={styles.sectionNavigation} aria-label="Frontier subject collections">
        <div className={styles.sectionNavigationInner} role="tablist" aria-label="Content areas">
          {JOURNAL_SECTIONS.map((section) => (
            <button key={section.id} type="button" role="tab" data-journal-section={section.id}
              className={styles.sectionTab} aria-selected={activeSection === section.id}
              aria-controls="frontier-reader-stage" onClick={() => selectSection(section.id)}>
              <span>{section.label}</span>
              <span className={styles.sectionTabCount}>{sectionCounts[section.id]}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.realmRibbon} aria-live="off"><span className={styles.realmSignal} aria-hidden="true"/><span>{presentation?.kindLabel ?? "The journal"}</span><span className={styles.realmDivider} aria-hidden="true">/</span><span>{item?.lane.replace(/_/g, " ") ?? "Daily discoveries"}</span><span className={styles.realmCounter}>{item ? String(position + 1).padStart(2,"0") : "00"} / {String(items.length).padStart(2,"0")}</span></div>
      <div className={styles.progressTrack} role="progressbar" aria-valuenow={position + (items.length ? 1 : 0)}
        aria-valuemin={0} aria-valuemax={items.length || 1} aria-label="Article progress">
        <span style={{ width: progress + '%' }} />
      </div>

      {contentsOpen ? (
        <section id="frontier-contents" className={styles.contentsPanel} aria-label="Edition contents">
          <div className={styles.contentsHeading}><div><span className={styles.overline}>THE CURRENT EDITION</span><h2>Explore the issue.</h2></div><button type="button" onClick={() => setContentsOpen(false)} aria-label="Close contents">Close ×</button></div>
          <div className={styles.contentsGrid}>{items.map((entry, index) => (
            <button type="button" key={entry.id} className={styles.contentsEntry} data-realm={journalRealm(entry)} aria-current={position === index ? 'true' : undefined} onClick={() => { move(index - position); setContentsOpen(false); }}>
              <span className={styles.contentsOrdinal}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.contentsEntryBody}><span className={styles.overline}>{entry.lane.replace(/_/g, ' ')} · {entry.sourceLabel}</span><strong>{entry.title}</strong></span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}</div>
        </section>
      ) : null}

      {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      {item ? (
        <div id="frontier-reader-stage" role="tabpanel" aria-label={sectionMeta.label + " discoveries"}
          className={styles.stage} key={item.id}>
          <article className={styles.article}>
            <div className={styles.editionMarker}><span>FRONTIER / {sectionMeta.label.toUpperCase()}</span><span>{sourceDate(editionAt)}</span></div>
            <div className={styles.headline}>
              <div className={styles.headlineMeta}>
                <span className={styles.kicker}>{item.lane.replace(/_/g, ' ')} <span className={styles.separator}>/</span> {item.sourceLabel}</span>
                <span className={styles.counter}>{String(position + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
              </div>
              <h1>{item.title}</h1>
              {item.authors?.length ? <p className={styles.byline}>{item.authors.slice(0, 3).join(', ')}</p> : null}
            </div>

            <FrontierJournalChapters key={item.id} chapters={chapters}/>
            <div className={`${styles.storyBody} ${!canShowImage ? styles.storyBodyText : ''}`}>


              <div ref={contentRef} className={styles.content}
                onScroll={() => { readerInteractedRef.current = true; }}
                onTouchStart={() => { readerInteractedRef.current = true; }}>
                <section id="frontier-story-summary" className={styles.briefSection} aria-label="Source-grounded summary">
                  <h2 className={styles.sectionLabel}>{presentation?.heading ?? "The brief"}</h2>
                  <p className={styles.summary}>{sourceBrief.lead || 'This source did not include a synopsis. Read the original for the full story.'}</p>
                  {sourceBrief.hasFullerContext ? (
                    <details className={styles.sourceDetail}>
                      <summary>Continue reading <span aria-hidden="true">↗</span></summary>
                      <div className={styles.detailBody}>{sourceBrief.details.map((part, index) => <p key={index}>{part}</p>)}</div>
                    </details>
                  ) : null}
                </section>

                {presentation?.format === 'live' || presentation?.format === 'measured' ? (
                  <FrontierJournalEvidence item={item} />
                ) : null}
                {mediaPlan ? (
                  <FrontierJournalMedia plan={mediaPlan} title={item.title} posterUrl={mediaPoster}
                    onOpenSource={() => { readerInteractedRef.current = true; recordOpen(item); }} />
                ) : null}
              {canShowImage || hasFigureChoices ? <figure id="frontier-story-figure" className={styles.visual} data-frontier-figure-count={figures.length}>
                <div className={styles.visualViewport}>
                  {image ? (
                    <Image
                      unoptimized
                      src={image}
                      alt={activeFigure?.alt || item.title}
                      width={1200}
                      height={760}
                      sizes="(max-width: 900px) 100vw, 56vw"
                      priority={position === 0 && figureIndex === 0}
                      className={styles.heroImage}
                      style={nativeImageWidth && nativeImageWidth < 720 ? { maxWidth: nativeImageWidth + 'px' } : undefined}
                      onLoad={(event) => {
                        const width = event.currentTarget.naturalWidth;
                        if (width < 720 && imageCandidates.some((candidate) => candidate !== image && !failedImages.includes(candidate))) {
                          setFailedImages((current) => current.includes(image) ? current : [...current, image]);
                          return;
                        }
                        setNativeImageWidth(width);
                      }}
                      onError={() => setFailedImages((current) => current.includes(image) ? current : [...current, image])}
                    />
                  ) : null}
                </div>
                {!image && hasFigureChoices ? <p className={styles.figureFailure} role="status">This source figure is unavailable. Choose another figure below.</p> : null}
                {figures.length > 1 ? (
                  <nav className={styles.figureRail} aria-label="Source figures">
                    {figures.map((figure, index) => (
                      <button key={figure.url} type="button" aria-label={'View source figure ' + (index + 1)}
                        aria-pressed={index === figureIndex}
                        onClick={() => { readerInteractedRef.current = true; setFigureIndex(index); setFailedImages([]);
    setNativeImageWidth(null); }}>
                        {String(index + 1).padStart(2, '0')}
                      </button>
                    ))}
                  </nav>
                ) : null}
                {activeFigure?.caption && activeFigure.caption !== item.title ? (
                  <figcaption className={styles.caption}>
                    <span>{activeFigure.caption}</span>
                    <span className={styles.figureAttribution}>
                      {activeFigure.credit || item.sourceLabel}
                      {figureSourceHref ? (
                        <a href={figureSourceHref} target="_blank" rel="noopener noreferrer"
                          onClick={() => { readerInteractedRef.current = true; recordOpen(item); }}>
                          Figure source <ExternalLink size={12} aria-hidden="true"/>
                        </a>
                      ) : null}
                    </span>
                  </figcaption>
                ) : null}
              </figure> : null}
                {presentation?.format !== 'live' && presentation?.format !== 'measured' ? (
                  <FrontierJournalEvidence item={item} />
                ) : null}

                <div className={styles.interactionArea}>
                  <div className={styles.ratingZone}>
                    <div className={styles.ratingEyebrow}>Your curiosity <span>Shape what you discover next</span></div>
                    <button
                      type="button"
                      className={styles.holdButton}
                      data-frontier-balloon={holdValue !== null ? 'inflating' : (rating ? 'rated' : 'idle')}
                      disabled={!item}
                      aria-label="Hold to rate interest from one to ten; release to save"
                      onPointerDown={onHoldPointerDown}
                      onPointerUp={finishHold}
                      onPointerCancel={cancelHold}
                      onLostPointerCapture={cancelHold}
                      onKeyDown={onHoldKeyDown}
                      onKeyUp={onHoldKeyUp}
                      onContextMenu={(event) => event.preventDefault()}
                    >
                      <span className={styles.orbRing} aria-hidden="true"><span className={styles.orbCore}>
                        <span className={styles.orbValue}>{currentVisualGrade === null || currentVisualGrade === undefined ? '✧' : currentVisualGrade}</span>
                        <span className={styles.orbDenominator}>{currentVisualGrade === null || currentVisualGrade === undefined ? '' : '/10'}</span>
                      </span></span>
                      <span className={styles.orbCopy}>{holdValue !== null ? 'Release to save'
                        : rating ? rating + '/10 · Hold to revise' : 'Hold to rate'}</span>
                    </button>
                    <details className={styles.precision} onToggle={() => { readerInteractedRef.current = true; }}>
                      <summary>Fine-tune interest</summary>
                      <div className={styles.precisionContent}>
                        <label htmlFor="frontier-interest-slider">Interest: {sliderScore}/10</label>
                        <input id="frontier-interest-slider" type="range" min={1} max={10} step={1}
                          value={sliderScore}
                          onChange={(event) => { if (item) setSliderDraft({ id: item.id, value: Number(event.target.value) }); }} />
                        <button type="button" onClick={() => commitRating(sliderScore, 'slider')}>Save</button>
                      </div>
                    </details>
                    <span className={styles.notice} role="status" aria-live="polite">{notice}</span>
                  </div>
                </div>

                <div className={styles.articleActions}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => { readerInteractedRef.current = true; recordOpen(item); }}
                    className={styles.sourceLink}>Original <ExternalLink size={15} aria-hidden="true" /></a>
                  <button type="button" onClick={() => { readerInteractedRef.current = true; toggleSave(item); }}
                    className={styles.saveButton} aria-pressed={isSaved}>
                    <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                  <span className={styles.sourceDate}>{sourceDate(item.publishedAt)}</span>
                </div>
              </div>
              <aside id="frontier-story-source" className={styles.journalRail} aria-label="Source context and next reading">
                <FrontierJournalSourceLens item={item} figureCount={figures.length} publishedLabel={sourceDate(item.publishedAt)}
                  onOpenSource={() => { readerInteractedRef.current = true; recordOpen(item); }} />
                {presentation?.hasEvidence ? <a className={styles.railJump} href="#frontier-evidence">{presentation.evidenceLabel} <ArrowRight size={13} aria-hidden="true"/></a> : null}
                {item.tags.length ? (
                  <div className={styles.railTopics}><div className={styles.railHeading}><span className={styles.overline}>TOPICS</span></div>
                    <div className={styles.tagGroup}>{item.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
                  </div>
                ) : null}
                <div className={styles.railHeading}><span className={styles.overline}>{related.length ? 'SHARED RESEARCH THREADS' : 'CONTINUE THE EDITION'}</span><button type="button" onClick={() => setContentsOpen(true)}>All stories <ArrowRight size={13}/></button></div>
                <ol className={styles.relatedList}>
                  {related.length ? related.map(({ item: nextItem, sharedTopics }) => (
                    <li key={nextItem.id}><button type="button" onClick={() => move(items.findIndex((entry) => entry.id === nextItem.id) - position)}>
                      <span>{nextItem.sourceLabel} / {sharedTopics.join(', ')}</span><strong>{nextItem.title}</strong><ArrowRight size={14} aria-hidden="true"/>
                    </button></li>
                  )) : items.slice(position + 1, position + 4).map((nextItem, index) => (
                    <li key={nextItem.id}><button type="button" onClick={() => move(index + 1)}>
                      <span>{String(position + index + 2).padStart(2, '0')} / {nextItem.lane.replace(/_/g, ' ')}</span><strong>{nextItem.title}</strong><ArrowRight size={14} aria-hidden="true"/>
                    </button></li>
                  ))}
                </ol>
                {!related.length && position + 1 >= items.length ? <p className={styles.railEnd}>You have reached the end of this edition.</p> : null}
              </aside>
            </div>
          </article>
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
      ) : (
        <div id="frontier-reader-stage" role="tabpanel" aria-label={sectionMeta.label + " discoveries"} className={styles.empty}>
          <h1>{activeSection === 'for-you' ? 'No articles in this edition' : 'No stories in ' + sectionMeta.label + ' yet'}</h1>
          <p>{activeSection === 'for-you' ? 'The saved edition may have expired. Request the latest stories.' : 'This collection has no verified sources in the current snapshot. Explore the rest of the edition or search for a subject.'}</p>
          {activeSection !== 'for-you' ? (
            <button type="button" onClick={() => selectSection('for-you')}>Return to For you</button>
          ) : <button type="button" onClick={() => void retrieve('', true)}>Find fresh stories</button>}
        </div>
      )}
    </section>
  );
}
