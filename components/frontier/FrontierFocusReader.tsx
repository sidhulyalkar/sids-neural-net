'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { holdToInterestScore } from '@/lib/frontier/interestRating';
import { rankFrontierItems } from '@/lib/frontier/scoring';
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

function mediaUrl(item: FrontierItem): string | null {
  const media = item.media;
  if (!media) return null;
  if (media.type === 'image') return media.proxyUrl || media.url || null;
  if (media.type === 'youtube' || media.type === 'video') return media.posterProxyUrl || media.poster || null;
  return null;
}

/** One DOM article and at most one image are mounted at any point in time. */
export function FrontierFocusReader({ initialItems, generatedAt }: Props) {
  const [items, setItems] = useState(() => initialItems.slice(0, EDITION_LIMIT));
  const [position, setPosition] = useState(0);
  const [editionAt, setEditionAt] = useState(generatedAt);
  const [searchDraft, setSearchDraft] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brokenMediaId, setBrokenMediaId] = useState<string | null>(null);
  const [holdValue, setHoldValue] = useState<number | null>(null);
  const [sliderDraft, setSliderDraft] = useState<{ id: string; value: number } | null>(null);
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
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
  const image = item ? mediaUrl(item) : null;
  const canShowImage = Boolean(image && brokenMediaId !== item?.id);

  const cancelHold = useCallback(() => {
    holdStartedRef.current = null;
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
    holdFrameRef.current = null;
    setHoldValue(null);
  }, []);

  const commitRating = useCallback((score: number, method: 'hold' | 'slider', duration = 0) => {
    if (!item) return;
    rateInterest(item, score, method, duration);
    setSliderDraft({ id: item.id, value: score });
    setNotice('Saved ' + score + '/10');
  }, [item, rateInterest]);

  const beginHold = useCallback(() => {
    if (holdStartedRef.current !== null || !item) return;
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
    event.currentTarget.setPointerCapture(event.pointerId);
    beginHold();
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
    cancelHold();
    setNotice('');
    setBrokenMediaId(null);
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
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
  }, []);

  const retrieve = useCallback(async (query: string, fresh: boolean) => {
    requestRef.current?.abort();
    cancelHold();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('focus', query);
      if (fresh) params.set('fresh', '1');
      const response = await fetch('/api/frontier/feed?' + params.toString(), {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Feed unavailable (' + response.status + ')');
      const payload = await response.json() as FrontierFeedResponse & { error?: string };
      if (controller.signal.aborted) return;
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error(payload.error || 'No matching articles. Try another topic or refresh.');
      }
      const state = useFrontierStore.getState();
      const ranked = rankFrontierItems(payload.items, state.profile, state.history, new Date(), state.behavior);
      const next = (ranked.length ? ranked : payload.items).slice(0, EDITION_LIMIT);
      setItems(next);
      setPosition(0);
      setEditionAt(payload.generatedAt);
      setActiveQuery(query);
      setNotice('');
      setBrokenMediaId(null);
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

  const summaryParagraphs = useMemo(() => {
    if (!item?.summary?.trim()) return [];
    return item.summary.split(/\n\n+/g).map((paragraph) => paragraph.trim()).filter(Boolean);
  }, [item]);

  return (
    <section className={styles.reader} aria-label="Frontier focused reader">
      <header className={styles.masthead}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>FRONTIER<span className={styles.brandDot}>.</span></Link>
          <span className={styles.edition}>A quiet space for what is new</span>
        </div>
        <div className={styles.topActions}>
          <form role="search" onSubmit={onSearch} className={styles.search}>
            <Search aria-hidden="true" size={17} />
            <input aria-label="Search live topics" placeholder="Find a topic" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} maxLength={64} />
          </form>
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
          <figure className={styles.visual}>
            {canShowImage && image ? (
              <Image
                unoptimized
                src={image}
                alt={item.media?.alt || item.title}
                width={1200}
                height={760}
                sizes="(max-width: 900px) 100vw, 54vw"
                priority={position === 0}
                className={styles.heroImage}
                onError={() => setBrokenMediaId(item.id)}
              />
            ) : (
              <div className={styles.editorial} aria-label="Editorial article cover">
                <span className={styles.editorialKicker}>{item.lane.replace(/_/g, ' ')}</span>
                <span className={styles.editorialTitle}>{item.title}</span>
                <span className={styles.editorialDomain}>{cleanUrlHost(item.url)}</span>
              </div>
            )}
            <figcaption className={styles.caption}>
              <span>{item.media?.alt || item.sourceLabel}</span>
              <span>{item.sourceLabel} · {sourceDate(item.publishedAt)}</span>
            </figcaption>
          </figure>

          <div ref={contentRef} className={styles.content}>
            <div className={styles.contentTop}>
              <span className={styles.kicker}>{item.lane.replace(/_/g, ' ')} <span className={styles.separator}>/</span> {item.sourceLabel}</span>
              <span className={styles.counter}>{String(position + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
            </div>
            <article className={styles.article}>
              <h1>{item.title}</h1>
              {item.authors?.length ? <p className={styles.byline}>By {item.authors.slice(0, 4).join(', ')}</p> : null}
              <h2>At a glance</h2>
              {summaryParagraphs.length ? summaryParagraphs.map((paragraph, i) => (
                <p key={i} className={styles.summary}>{paragraph}</p>
              )) : <p className={styles.summary}>The source has not provided a synopsis. Open the original for the full story.</p>}
              {item.why && <div className={styles.rationale}><h2>Why it is here</h2><p>{item.why}</p></div>}
              {item.metrics?.length ? <div className={styles.metrics}>{item.metrics.slice(0, 4).map((metric) => (
                <span key={metric.label}><strong>{metric.value}</strong> {metric.label}</span>
              ))}</div> : null}
              {item.tags?.length ? <p className={styles.tags}>{item.tags.slice(0, 6).join('  ·  ')}</p> : null}
              <div className={styles.articleActions}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => recordOpen(item)} className={styles.sourceLink}>Read original <ExternalLink size={15} aria-hidden="true" /></a>
                <button type="button" onClick={() => toggleSave(item)} className={styles.saveButton} aria-pressed={isSaved}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />{isSaved ? 'Saved' : 'Save'}</button>
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
            style={{ ['--fill' as string]: (((holdValue ?? rating ?? 0) / 10) * 100) + '%' }}
            disabled={!item}
            aria-label="Hold to rate interest from one to ten; release to save"
            onPointerDown={onHoldPointerDown}
            onPointerUp={finishHold}
            onPointerCancel={cancelHold}
            onLostPointerCapture={cancelHold}
            onKeyDown={onHoldKeyDown}
            onKeyUp={onHoldKeyUp}
          >
            <span>{holdValue === null ? (rating ? rating + '/10 · Hold to revise' : 'Hold to rate') : holdValue + ' / 10'}</span>
          </button>
          <details className={styles.precision}>
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
          <button type="button" onClick={() => move(-1)} disabled={position === 0 || loading} aria-label="Previous article"><ArrowLeft size={19} /><span>Back</span></button>
          <button type="button" onClick={() => hasNext ? move(1) : void retrieve(activeQuery, true)} disabled={!item || loading} className={styles.next}><span>{hasNext ? 'Next' : 'New edition'}</span><ArrowRight size={20} /></button>
        </div>
      </footer>
      <span className={styles.editionFooter}>Edition {sourceDate(editionAt)} · Use ← → to navigate · No automatic feed loading</span>
    </section>
  );
}
