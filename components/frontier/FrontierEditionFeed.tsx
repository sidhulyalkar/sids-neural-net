'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, RefreshCw, Search } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import { frontierInformationValue, rerankFrontierForInformation } from '@/lib/frontier/informativeEdition';
import { featureFrontierEditionStory, frontierEditionChannel } from '@/lib/frontier/editionCandidates';
import { frontierReadableText } from '@/lib/frontier/readableText';
import { rankFrontierItems, selectDailyRun } from '@/lib/frontier/scoring';
import { buildFrontierSourceBrief, frontierSourceFigures } from '@/lib/frontier/sourceBrief';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierFeedResponse, FrontierItem } from '@/lib/frontier/types';
import { FrontierWheelRating } from './FrontierWheelRating';
import styles from './frontier-edition-feed.module.css';

const EDITION_LIMIT = 48;
const PAGE_SIZE = 16;
type Subject = 'all' | 'research' | 'building' | 'sports' | 'culture' | 'nature';
const SUBJECTS: readonly { id: Subject; name: string }[] = [
  { id: 'all', name: 'Everything' },
  { id: 'research', name: 'Research' },
  { id: 'building', name: 'Building' },
  { id: 'sports', name: 'Sports' },
  { id: 'culture', name: 'Culture' },
  { id: 'nature', name: 'Nature' },
];

function belongsTo(item: FrontierItem, subject: Subject): boolean {
  if (subject === 'all') return true;
  const channel = frontierEditionChannel(item);
  if (subject === 'sports') return channel === 'sports' ||
    (item.sourceKind === 'rss' && item.tags.some((tag) => /football|soccer|premier league|nfl|nba/i.test(tag)));
  if (subject === 'nature') return channel === 'nature';
  if (subject === 'building') return channel === 'building';
  if (subject === 'culture') return channel === 'culture';
  // Do not classify general football reporting as science merely because
  // an upstream generic source tag called it 'broad_science'.
  return channel === 'papers' ||
    (['neuro_frontier','ai_frontier','ml_data','methods','broad_science'].includes(item.lane) &&
    !['github','rss','sports_state','steam'].includes(item.sourceKind));
}

function dateLabel(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', timeZone:'America/Los_Angeles' }).format(date);
}

function editionOrder(items: FrontierItem[], history: Record<string, never> = {}): FrontierItem[] {
  return featureFrontierEditionStory(
    selectDailyRun(rerankFrontierForInformation(items), history, EDITION_LIMIT)
  );
}

function LeadFigure({ item }: { item: FrontierItem }) {
  const first = frontierSourceFigures(item)[0];
  const [failed, setFailed] = useState(false);
  if (!first || failed) return null;
  return (
    <figure className={styles.leadFigure}>
      <Image unoptimized src={first.url} alt={first.alt || item.title} width={1000} height={680}
        sizes="(max-width: 760px) 100vw, 34vw" loading="lazy"
        onError={() => setFailed(true)}/>
      {first.caption ? <figcaption>{frontierReadableText(first.caption).slice(0, 185)}</figcaption> : null}
    </figure>
  );
}

function EditionArticle({ item, ordinal, lead }: { item: FrontierItem; ordinal: number; lead: boolean }) {
  const history = useFrontierStore((s) => s.history);
  const saved = useFrontierStore((s) => s.saved);
  const hydrated = useFrontierStore((s) => s.hydrated);
  const rateInterest = useFrontierStore((s) => s.rateInterest);
  const toggleSave = useFrontierStore((s) => s.toggleSave);
  const recordOpen = useFrontierStore((s) => s.recordOpen);
  const brief = useMemo(() => buildFrontierSourceBrief(item.summary, item.sourceKind), [item.summary, item.sourceKind]);
  const context = frontierInformationValue(item);
  const evidenceReasons = context.reasons.filter((reason) => reason !== 'Detailed context');
  const rating = history[item.id]?.interestScore;

  return (
    <article className={`${styles.story} ${lead ? styles.leadStory : ''}`} data-frontier-story={item.id}>
      <div className={styles.storyHeader}>
        <span className={styles.ordinal}>{String(ordinal).padStart(2, '0')}</span>
        <span className={styles.sourceName}>{item.sourceLabel}</span>
        <span className={styles.separator} aria-hidden="true">/</span>
        <time dateTime={item.publishedAt}>{dateLabel(item.publishedAt)}</time>
      </div>
      <div className={styles.storyMain}>
        <div className={styles.storyText}>
          <span className={styles.lane}>{FRONTIER_LANE_MAP[item.lane].shortLabel}</span>
          <h2><a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => recordOpen(item)}>
            {frontierReadableText(item.title)}<ArrowUpRight size={16} aria-hidden="true"/>
          </a></h2>
          <p className={styles.summary}>{frontierReadableText(brief.lead || 'Original source available; detailed context not supplied.')}</p>
          {brief.hasFullerContext ? <details className={styles.more}>
            <summary>More context</summary>
            {brief.details.map((paragraph, index) => <p key={index}>{frontierReadableText(paragraph)}</p>)}
          </details> : null}
          {evidenceReasons.length ? <p className={styles.reason}>
            <span>In the source</span> {evidenceReasons.join(' · ')}
          </p> : null}
        </div>
        {lead ? <LeadFigure item={item}/> : null}
      </div>
      <div className={styles.storyActions}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => recordOpen(item)}
          className={styles.sourceLink}>Read original <ArrowUpRight size={13} aria-hidden="true"/></a>
        <FrontierWheelRating key={item.id} title={frontierReadableText(item.title)} savedScore={rating}
          onSave={(score, method) => rateInterest(item, score, method)}/>
        <button type="button" className={styles.bookmark} disabled={!hydrated}
          aria-pressed={Boolean(saved[item.id])}
          aria-label={saved[item.id] ? 'Remove saved article' : 'Save article'}
          onClick={() => toggleSave(item)}>
          <Bookmark size={15} aria-hidden="true" fill={saved[item.id] ? 'currentColor' : 'none'}/>
          <span>{saved[item.id] ? 'Saved' : 'Save'}</span>
        </button>
      </div>
    </article>
  );
}

export function FrontierEditionFeed({ initialItems, generatedAt }: {
  initialItems: FrontierItem[]; generatedAt: string;
}) {
  const [pool, setPool] = useState(initialItems);
  const [items, setItems] = useState(() => editionOrder(initialItems));
  const [subject, setSubject] = useState<Subject>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [editionAt, setEditionAt] = useState(generatedAt);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  const didPersonalize = useRef(false);
  const hydrated = useFrontierStore((s) => s.hydrated);

  // Use the verified server snapshot on first paint. Apply existing local taste
  // once after hydration; NEVER shuffle an open feed beneath a rating action.
  useEffect(() => {
    if (!hydrated || didPersonalize.current) return;
    didPersonalize.current = true;
    const state = useFrontierStore.getState();
    const ranked = rankFrontierItems(pool, state.profile, state.history, new Date(), state.behavior);
    setItems(editionOrder(ranked));
  }, [hydrated, pool]);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase().trim();
    return items.filter((item) => belongsTo(item, subject) &&
      (!q || [item.title, item.summary, item.sourceLabel, ...item.tags].join(' ').toLocaleLowerCase().includes(q)));
  }, [items, subject, query]);
  const shown = filtered.slice(0, visible);

  const checkForNew = async () => {
    if (checking) return;
    setChecking(true);
    setStatus('');
    try {
      const response = await fetch('/api/frontier/feed?latest=1', { cache: 'no-store' });
      if (!response.ok) throw new Error('Source check unavailable');
      const payload = await response.json() as FrontierFeedResponse;
      if (!Array.isArray(payload.items) || !payload.items.length ||
          response.headers.get('X-Frontier-Live') === 'snapshot-fallback') {
        setStatus('No newer verified edition is available.');
        return;
      }
      const state = useFrontierStore.getState();
      const ranked = rankFrontierItems(payload.items, state.profile, state.history, new Date(), state.behavior);
      const next = editionOrder(ranked);
      if (!next.length) { setStatus('No admitted stories in the new snapshot.'); return; }
      setPool(payload.items);
      setItems(next);
      setEditionAt(payload.generatedAt);
      setVisible(PAGE_SIZE);
      setStatus('New edition loaded.');
    } catch {
      setStatus('Could not check for new sources. This edition remains available.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={styles.page} data-frontier-edition="multi-article">
      <header className={styles.masthead}>
        <Link href="/" className={styles.brand}>FRONTIER<span>.</span></Link>
        <div className={styles.mastActions}>
          <Link href="/frontier/read">Focus reader</Link>
          <Link href="/frontier/advanced">Full radar</Link>
          <button type="button" onClick={checkForNew} disabled={checking}
            aria-label="Check for a newer Frontier edition"><RefreshCw size={15} aria-hidden="true"/> <span>Update</span></button>
        </div>
      </header>
      <div className={styles.editionTop}>
        <span className={styles.editionKicker}>AN EDITION OF THINGS WORTH UNDERSTANDING · {dateLabel(editionAt)}</span>
        <div className={styles.editionLead}>
          <h1>The frontier,<br/>in context.</h1>
          <p>A living selection of research, methods, technology, sport and culture. Ranked for relevance and substantive information, not just noise or novelty.</p>
        </div>
      </div>
      <div className={styles.discover}>
        <nav className={styles.categories} aria-label="Filter Frontier stories">
          {SUBJECTS.map(({id,name}) => (
            <button type="button" key={id} aria-pressed={subject === id} onClick={() => {
              setSubject(id); setVisible(PAGE_SIZE);
            }}>{name}</button>
          ))}
        </nav>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true"/>
          <span className={styles.srOnly}>Search edition</span>
          <input type="search" value={query} placeholder="Find a subject" onChange={(event) => {
            setQuery(event.target.value); setVisible(PAGE_SIZE);
          }} />
        </label>
      </div>
      <div className={styles.editionMeta}>
        <span>{filtered.length} {filtered.length === 1 ? 'story' : 'stories'} in this view</span>
        <span>Source evidence + personal relevance · refreshed each edition</span>
      </div>
      {status ? <p role="status" className={styles.status}>{status}</p> : null}
      {filtered.length ? (
        <>
          <section className={styles.grid} id="frontier-stories" aria-label="Stories in this edition">
            {shown.map((item,index) => <EditionArticle key={item.id} item={item} ordinal={index+1}
              lead={subject === 'all' && index === 0}/>)}
          </section>
          {filtered.length > visible ? <div className={styles.moreStories}>
            <button type="button" onClick={() => setVisible((n) => Math.min(filtered.length,n+PAGE_SIZE))}>
              More stories <span>{filtered.length-visible} remaining</span>
            </button>
          </div> : null}
        </>
      ) : <p className={styles.empty}>Nothing in this part of the edition. Try another topic or explore the full radar.</p>}
      <footer className={styles.footer}>
        <span>FRONTIER · An evolving personal field guide</span>
        <Link href="/frontier/advanced">Discover beyond the edition <ArrowUpRight size={14} aria-hidden="true"/></Link>
      </footer>
    </div>
  );
}
