'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { holdToInterestScore } from '@/lib/frontier/interestRating';
import { frontierHasNewStories, frontierShouldCheckLatest } from '@/lib/frontier/liveFeedPolicy';
import { buildFrontierSourceBrief, frontierRatingDescription, frontierSourceFigures } from '@/lib/frontier/sourceBrief';
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
  // Deterministic diverse first edition during SSR, before preference hydration.
  const [items, setItems] = useState(() => selectDailyRun(initialItems, {}, EDITION_LIMIT));
  const [position, setPosition] = useState(0);
  const [editionAt, setEditionAt] = useState(generatedAt);
  const [searchDraft, setSearchDraft] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestChecking, setLatestChecking] = useState(false);
  const [latestReady, setLatestReady] = useState<{ items: FrontierItem[]; generatedAt: string } | null>(null);
  const [error, setError] = useState('');
  const [brokenMediaUrl, setBrokenMediaUrl] = useState<string | null>(null);
  const [figureIndex, setFigureIndex] = useState(0);
  const [holdValue, setHoldValue] = useState<number | null>(null);
  const [sliderDraft, setSliderDraft] = useState<{ id: string; value: number } | null>(null);
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const backgroundRef = useRef<AbortController | null>(null);
  const readerInteractedRef = useRef(false);
  const initialPersonalizationAppliedRef = useRef(false);
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

  const item = items[position];
  const rating = item ? history[item.id]?.interestScore : undefined;
  const sliderScore = sliderDraft?.id === item?.id ? sliderDraft.value : (rating ?? 5);
  const isSaved = Boolean(item && saved[item.id]);
  const figures = useMemo(() => item ? frontierSourceFigures(item) : [], [item]);
  const activeFigure = figures[Math.min(figureIndex, Math.max(0, figures.length - 1))];
  const image = activeFigure?.url;
  const canShowImage = Boolean(image && brokenMediaUrl !== image);
  const currentVisualGrade = holdValue ?? rating;
  const balloonScale = (0.76 + 0.36 * ((currentVisualGrade ?? 1) / 10)).toFixed(3);
  const gradeDescription = frontierRatingDescription(currentVisualGrade);

  useEffect(() => {
    if (!hydrated || initialPersonalizationAppliedRef.current) return;
    // Hydration is an external store event. Schedule the one-time handoff
    // rather than synchronously cascading a React render from this effect.
    const timer = window.setTimeout(() => {
      if (initialPersonalizationAppliedRef.current) return;
      initialPersonalizationAppliedRef.current = true;
      if (readerInteractedRef.current) return;
      const state = useFrontierStore.getState();
      const ranked = rankFrontierItems(initialItems, state.profile, state.history, new Date(), state.behavior);
      const selected = selectDailyRun(ranked, state.history, EDITION_LIMIT);
      if (!selected.length || readerInteractedRef.current) return;
      setItems((current) => {
        const first = current[0];
        // Never flash a different story under the reader after hydration.
        // The remaining 35 slots still reflect their learned taste model.
        if (!first || state.history[first.id]?.reaction === 'hide') return selected;
        return [first, ...selected.filter((candidate) => candidate.id !== first.id)].slice(0, EDITION_LIMIT);
      });
    }, 0);
    return () => window.clearTimeout(timer);
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

  const move = useCallback((delta: number) => {
    readerInteractedRef.current = true;
    cancelHold();
    setNotice('');
    setBrokenMediaUrl(null);
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
    cancelHold();
    setItems(edition.items.slice(0, EDITION_LIMIT));
    setPosition(0);
    setEditionAt(edition.generatedAt);
    setActiveQuery('');
    setBrokenMediaUrl(null);
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
        if (!frontierHasNewStories(initialItems.map((entry) => entry.id), next.map((entry) => entry.id))) return;
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
      setItems(next);
      setPosition(0);
      setEditionAt(payload.generatedAt);
      setActiveQuery(query);
      setNotice('');
      setBrokenMediaUrl(null);
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

  const sourceBrief = useMemo(() => buildFrontierSourceBrief(item?.summary || ''), [item?.summary]);

  return (
    <section className={styles.reader} aria-label="Frontier focused reader" data-frontier-edition-at={editionAt}>
      <header className={styles.masthead}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>FRONTIER<span className={styles.brandDot}>.</span></Link>
          <span className={styles.edition}>A quiet space for what is new</span>
        </div>
        <div className={styles.topActions}>
          <form role="search" onSubmit={onSearch} className={styles.search}>
            <Search aria-hidden="true" size={17} />
            <input aria-label="Search live topics" placeholder="Find a topic" value={searchDraft} onFocus={() => { readerInteractedRef.current = true; }} onChange={(event) => setSearchDraft(event.target.value)} maxLength={64} />
          </form>
          {latestReady ? (
            <button type="button" className={styles.latestChip} onClick={() => {
              readerInteractedRef.current = true;
              applyLatest(latestReady);
            }} aria-label="Open latest discovered articles">
              Latest ready <span aria-hidden="true">↗</span>
            </button>
          ) : latestChecking ? <span className={styles.checkingLatest} aria-label="Checking recent articles">Checking latest…</span> : null}
          <button type="button" className={styles.iconButton} title="Refresh live edition" aria-label="Refresh live edition" disabled={loading} onClick={() => void retrieve(activeQuery, true)}>
            <RefreshCw size={18} aria-hidden="true" className={loading ? styles.spinning : ''} />
          </button>
          <a href="/frontier/advanced" className={styles.advanced}>Explore <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <div className={styles.progressTrack} role="progressbar" aria-valuenow={position + (items.length ? 1 : 0)} aria-valuemin={0} aria-valuemax={items.length || 1} aria-label="Article progress">
        <span style={{ width: progress + '%' }} />
      </div>

      {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      {item ? (
        <div className={styles.stage} key={item.id}>
          <figure className={styles.visual} data-frontier-figure-count={figures.length}>
            <div className={styles.visualViewport}>
              {canShowImage && image ? (
                <Image
                  unoptimized
                  src={image}
                  alt={activeFigure.alt || item.title}
                  width={1200}
                  height={760}
                  sizes="(max-width: 900px) 100vw, 54vw"
                  priority={position === 0 && figureIndex === 0}
                  className={styles.heroImage}
                  onError={() => setBrokenMediaUrl(image)}
                />
              ) : (
                <div className={styles.editorial} aria-label="Editorial article cover">
                  <span className={styles.editorialKicker}>{item.lane.replace(/_/g, ' ')}</span>
                  <span className={styles.editorialTitle}>{item.title}</span>
                  <span className={styles.editorialDomain}>{cleanUrlHost(item.url)}</span>
                </div>
              )}
            </div>
            {figures.length > 1 ? (
              <nav className={styles.figureRail} aria-label="Source figures">
                {figures.map((figure, index) => (
                  <button key={figure.url} type="button" aria-label={'View source figure ' + (index + 1)}
                    aria-pressed={index === figureIndex} onClick={() => { readerInteractedRef.current = true; setFigureIndex(index); }}>
                    {String(index + 1).padStart(2, '0')}
                  </button>
                ))}
              </nav>
            ) : null}
            <figcaption className={styles.caption}>
              <span>{activeFigure?.caption || activeFigure?.alt || 'Source visual not provided'}</span>
              <span>{activeFigure?.credit || item.sourceLabel}{figures.length > 1 ? ' · ' + (Math.min(figureIndex, figures.length - 1) + 1) + '/' + figures.length : ''}</span>
            </figcaption>
          </figure>

          <div ref={contentRef} className={styles.content} onScroll={() => { readerInteractedRef.current = true; }} onTouchStart={() => { readerInteractedRef.current = true; }}>
            <div className={styles.contentTop}>
              <span className={styles.kicker}>{item.lane.replace(/_/g, ' ')} <span className={styles.separator}>/</span> {item.sourceLabel}</span>
              <span className={styles.counter}>{String(position + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
            </div>
            <article className={styles.article}>
              <h1>{item.title}</h1>
              {item.authors?.length ? <p className={styles.byline}>By {item.authors.slice(0, 4).join(', ')}</p> : null}
              <section className={styles.briefSection} aria-label="Source-grounded summary">
                <div className={styles.sectionHeading}><h2>Source brief</h2><span>From {item.sourceLabel}</span></div>
                <p className={styles.summary}>{sourceBrief.lead || 'The source did not provide a synopsis. Open the original for the complete story.'}</p>
                {sourceBrief.hasFullerContext ? (
                  <details className={styles.sourceDetail}>
                    <summary>More from the source <span>+{sourceBrief.details.length} passages</span></summary>
                    <div className={styles.detailBody}>
                      {sourceBrief.details.map((detail, index) => <p key={index}>{detail}</p>)}
                    </div>
                  </details>
                ) : null}
              </section>
              {item.metrics?.length ? (
                <section className={styles.evidenceSection} aria-label="Source metrics">
                  <div className={styles.sectionHeading}><h2>Reported numbers</h2><span>{Math.min(item.metrics.length, 6)} figures</span></div>
                  <dl className={styles.metricGrid}>{item.metrics.slice(0, 6).map((metric, index) => (
                    <div key={metric.label + index} className={styles.metricCard}>
                      <dt>{metric.label}</dt><dd>{metric.value}</dd>
                      {metric.detail ? <p>{metric.detail}</p> : null}
                    </div>
                  ))}</dl>
                </section>
              ) : null}
              {item.sportsState ? (
                <section className={styles.evidenceSection} aria-label="Source sports evidence">
                  <div className={styles.sectionHeading}><h2>{item.sportsState.leagueLabel}</h2><span>{item.sportsState.kind}</span></div>
                  {item.sportsState.kind === 'scoreboard' ? (
                    <div className={styles.gameRows}>{item.sportsState.games.slice(0, 5).map((game) => (
                      <div key={game.id} className={styles.gameRow}>
                        <span>{game.competitors.map((team) => team.shortName).join(' · ')}</span>
                        <strong>{game.competitors.map((team) => team.score ?? '–').join(' : ')}</strong>
                        <small>{game.status}</small>
                      </div>
                    ))}</div>
                  ) : (
                    <div className={styles.gameRows}>{item.sportsState.standings.slice(0, 6).map((team) => (
                      <div key={team.team} className={styles.gameRow}><span>{team.rank}. {team.team}</span><strong>{team.record || (team.points === undefined ? '–' : String(team.points) + ' pts')}</strong></div>
                    ))}</div>
                  )}
                </section>
              ) : null}
              {item.artifacts?.length ? (
                <section className={styles.evidenceSection} aria-label="Source artifacts">
                  <div className={styles.sectionHeading}><h2>Source artifacts</h2><span>References</span></div>
                  <div className={styles.artifactGrid}>{item.artifacts.slice(0, 6).map((artifact, index) => (
                    <div className={styles.artifact} key={artifact.label + index}>
                      <span>{artifact.kind}</span>
                      {artifact.url?.startsWith('https://') ? <a href={artifact.url} target="_blank" rel="noopener noreferrer">{artifact.label} ↗</a> : <strong>{artifact.label}</strong>}
                      {artifact.value ? <small>{artifact.value}</small> : null}
                    </div>
                  ))}</div>
                </section>
              ) : null}
              {item.why ? (
                <section className={styles.rationale} aria-label="Recommendation context">
                  <h2>Why Frontier surfaced this</h2><p>{item.why}</p>
                </section>
              ) : null}
              <p className={styles.sourceFootnote}>Source: {item.sourceLabel} · {sourceDate(item.publishedAt)}
                {item.readMinutes ? ' · About ' + item.readMinutes + ' min' : ''}. Figures and statistics appear only when present in the source feed.
              </p>
              {item.tags?.length ? <p className={styles.tags}>{item.tags.slice(0, 7).join('  ·  ')}</p> : null}
              <div className={styles.articleActions}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => { readerInteractedRef.current = true; recordOpen(item); }} className={styles.sourceLink}>Read original <ExternalLink size={15} aria-hidden="true" /></a>
                <button type="button" onClick={() => { readerInteractedRef.current = true; toggleSave(item); }} className={styles.saveButton} aria-pressed={isSaved}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />{isSaved ? 'Saved' : 'Save'}</button>
              </div>
            </article>
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <h1>No articles in this edition</h1>
          <p>The daily snapshot may have expired. Request a live edition to continue.</p>
          <button type="button" onClick={() => void retrieve('', true)}>Find fresh stories</button>
        </div>
      )}

      <footer className={styles.footer}>
        <div className={styles.ratingZone}>
          <span className={styles.ratingLabel}>How interesting was this?</span>
          <button
            type="button"
            className={styles.holdButton}
            data-frontier-balloon={holdValue !== null ? 'inflating' : (rating ? 'rated' : 'idle')}
            style={{ ['--balloon-scale' as string]: balloonScale }}
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
            <span className={styles.balloonWrap} aria-hidden="true">
              <span className={styles.balloonBubble}><span>{currentVisualGrade ?? '·'}</span></span>
              <span className={styles.balloonKnot} />
              <span className={styles.balloonString} />
            </span>
            <span className={styles.balloonCopy}>
              <strong>{holdValue === null ? (rating ? rating + '/10 · Hold to revise' : 'Hold to rate') : holdValue + '/10 · Release to save'}</strong>
              <small>{gradeDescription}</small>
            </span>
          </button>
          <details className={styles.precision} onToggle={() => { readerInteractedRef.current = true; }}>
            <summary>Set exact score</summary>
            <div className={styles.precisionContent}>
              <label htmlFor="frontier-interest-slider">Interest: {sliderScore}/10</label>
              <input id="frontier-interest-slider" type="range" min={1} max={10} step={1} value={sliderScore} onChange={(event) => { if (item) setSliderDraft({ id: item.id, value: Number(event.target.value) }); }} />
              <button type="button" onClick={() => commitRating(sliderScore, 'slider')}>Save</button>
            </div>
          </details>
          <span className={styles.notice} role="status" aria-live="polite">{notice}</span>
        </div>
        <div className={styles.navigation}>
          <button type="button" data-frontier-previous="true" onClick={() => move(-1)} disabled={position === 0 || loading} aria-label="Previous article"><ArrowLeft size={19} /><span>Back</span></button>
          <button type="button" data-frontier-next="true" aria-label={hasNext ? 'Next article' : 'Get fresh edition'} onClick={() => hasNext ? move(1) : void retrieve(activeQuery, true)} disabled={!item || loading} className={styles.next}><span>{hasNext ? 'Next' : 'New edition'}</span><ArrowRight size={20} /></button>
        </div>
      </footer>
      <span className={styles.editionFooter}>Edition {sourceDate(editionAt)} · Use ← → to navigate · No automatic feed loading</span>
    </section>
  );
}
