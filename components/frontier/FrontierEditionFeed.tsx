'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, Bug, BugOff, Crosshair, RefreshCw, Search } from 'lucide-react';
import { FRONTIER_LANE_MAP } from '@/lib/frontier/config';
import { frontierMotifForItem } from '@/lib/frontier/ambientSprites';
import { frontierInformationValue, frontierReportedMetrics, rerankFrontierForInformation } from '@/lib/frontier/informativeEdition';
import { featureFrontierEditionStory, frontierEditionChannel } from '@/lib/frontier/editionCandidates';
import { frontierReadableText } from '@/lib/frontier/readableText';
import { rankFrontierItems, selectDailyRun } from '@/lib/frontier/scoring';
import { buildFrontierSourceBrief, frontierSourceFigures } from '@/lib/frontier/sourceBrief';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierFeedResponse, FrontierItem } from '@/lib/frontier/types';
import { FrontierArticleSwarm } from './FrontierArticleSwarm';
import { FrontierLightningCursor } from './FrontierLightningCursor';
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


/** Visual surfaces only render material supplied by the actual source.
 * No invented results, inferred charts or remotely generated placeholder art.
 */
function SourceImage({ item }: { item: FrontierItem }) {
  const first = frontierSourceFigures(item)[0];
  const [failed, setFailed] = useState(false);
  if (!first || failed) return null;
  return (
    <figure className={styles.sourceVisual}>
      <Image unoptimized src={first.url} alt={first.alt || item.title} width={1000} height={680}
        sizes="(max-width: 640px) 100vw, (max-width: 1100px) 32vw, 360px" loading="lazy"
        onError={() => setFailed(true)}/>
      <figcaption><span>Original source</span> {frontierReadableText(first.caption || first.credit || item.sourceLabel).slice(0, 140)}</figcaption>
    </figure>
  );
}

function StoryVisual({ item, lead, ordinal }: { item: FrontierItem; lead: boolean; ordinal: number }) {
  // The first few stories receive richer supporting context, while deeper
  // articles stay quiet, readable, and fast to scan.
  if (!lead && ordinal > 4) return null;
  const figure = frontierSourceFigures(item)[0];
  if (lead && figure) return <SourceImage item={item}/>;

  const sports = item.sportsState;
  if (sports?.kind === 'scoreboard') {
    const game = sports.games.find((entry) => entry.competitors.length >= 2);
    if (game) return (
      <aside className={styles.sourceVisual} aria-label="Sports source snapshot">
        <span className={styles.visualEyebrow}>As published · {frontierReadableText(sports.leagueLabel)}</span>
        <div className={styles.scoreSnapshot}>
          {game.competitors.slice(0, 2).map((competitor, index) => (
            <div className={styles.scoreLine} key={competitor.id || index}>
              <span>{frontierReadableText(competitor.shortName || competitor.name)}</span>
              <strong>{competitor.score ?? '–'}</strong>
            </div>
          ))}
        </div>
        <p className={styles.visualNote}>{frontierReadableText(game.status)} · {dateLabel(item.publishedAt)} snapshot</p>
      </aside>
    );
  }
  if (sports?.kind === 'standings' && sports.standings.length) return (
    <aside className={styles.sourceVisual} aria-label="Sports standings snapshot">
      <span className={styles.visualEyebrow}>As published · {frontierReadableText(sports.leagueLabel)}</span>
      <div className={styles.standingSnapshot}>
        {sports.standings.slice(0, 3).map((team) => (
          <div className={styles.standingLine} key={team.rank + team.abbreviation}>
            <span>{team.rank.toString().padStart(2, '0')}</span>
            <strong>{frontierReadableText(team.team)}</strong>
            <span>{frontierReadableText(team.points || team.record || '')}</span>
          </div>
        ))}
      </div>
      <p className={styles.visualNote}>Snapshot · {dateLabel(item.publishedAt)}</p>
    </aside>
  );

  const metrics = frontierReportedMetrics(item).slice(0, 2);
  if (metrics.length) return (
    <aside className={styles.sourceVisual} aria-label="Reported source measurements">
      <span className={styles.visualEyebrow}>Reported in the source</span>
      <div className={styles.metricSnapshot}>
        {metrics.map((metric, index) => (
          <div className={styles.metricRow} key={metric.label + index}>
            <strong>{frontierReadableText(metric.value).slice(0, 50)}</strong>
            <span>{frontierReadableText(metric.label).slice(0, 95)}</span>
          </div>
        ))}
      </div>
      <p className={styles.visualNote}>Source values, not independently verified</p>
    </aside>
  );

  if (figure) return <SourceImage item={item}/>;
  const artifacts = (item.artifacts ?? []).filter((artifact) =>
    ['repository','benchmark','formula','release'].includes(artifact.kind) && artifact.label.trim()).slice(0, 2);
  if (artifacts.length) return (
    <aside className={styles.sourceVisual} aria-label="Source references">
      <span className={styles.visualEyebrow}>Primary source material</span>
      <div className={styles.artifactSnapshot}>
        {artifacts.map((artifact, index) => (
          <div key={artifact.kind + index}>
            <small>{artifact.kind}</small>
            <strong>{frontierReadableText(artifact.label).slice(0, 100)}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
  if (!lead) return null;
  return (
    <aside className={`${styles.sourceVisual} ${styles.sourcePlate}`} aria-label="Story source context">
      <span className={styles.visualEyebrow}>From the source</span>
      <strong>{frontierReadableText(item.sourceLabel)}</strong>
      <span className={styles.sourceKind}>{item.sourceKind.replace(/_/g, ' ')}</span>
      <div className={styles.sourceTopics}>
        {item.tags.slice(0, 3).map((tag, index) => <span key={tag + index}>{frontierReadableText(tag).slice(0, 38)}</span>)}
      </div>
    </aside>
  );
}

function EditionArticle({ item, ordinal, lead, swarmActive, compact }: {
  item: FrontierItem; ordinal: number; lead: boolean;
  swarmActive: boolean; compact: boolean;
}) {
  const saved = useFrontierStore((s) => s.saved);
  const hydrated = useFrontierStore((s) => s.hydrated);
  const toggleSave = useFrontierStore((s) => s.toggleSave);
  const recordOpen = useFrontierStore((s) => s.recordOpen);
  const brief = useMemo(() => buildFrontierSourceBrief(item.summary, item.sourceKind), [item.summary, item.sourceKind]);
  const context = frontierInformationValue(item);
  const evidenceReasons = context.reasons.filter((reason) => reason !== 'Detailed context');

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
          {brief.hasFullerContext ? <details className={styles.more} onToggle={(event) => {
            if (event.currentTarget.open) useFrontierStore.getState().recordExpand(item);
          }}>
            <summary>More context</summary>
            {brief.details.map((paragraph, index) => <p key={index}>{frontierReadableText(paragraph)}</p>)}
          </details> : null}
          {evidenceReasons.length ? <p className={styles.reason}>
            <span>In the source</span> {evidenceReasons.join(' · ')}
          </p> : null}
        </div>
        <StoryVisual item={item} lead={lead} ordinal={ordinal}/>
      </div>
      <div className={styles.storyActions}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => recordOpen(item)}
          className={styles.sourceLink}>Read original <ArrowUpRight size={13} aria-hidden="true"/></a>
        <button type="button" className={styles.bookmark} disabled={!hydrated}
          aria-pressed={Boolean(saved[item.id])}
          aria-label={saved[item.id] ? 'Remove saved article' : 'Save article'}
          onClick={() => toggleSave(item)}>
          <Bookmark size={15} aria-hidden="true" fill={saved[item.id] ? 'currentColor' : 'none'}/>
          <span>{saved[item.id] ? 'Saved' : 'Save'}</span>
        </button>
      </div>
      <FrontierArticleSwarm item={item} active={swarmActive} compact={compact}/>

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
  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  const [ambientEnabled, setAmbientEnabled] = useState(true);
  // Hidden until the reader explicitly enables this optional aiming aid.
  const [aimReticleEnabled, setAimReticleEnabled] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrowViewport = window.matchMedia('(max-width: 640px)');
    const syncEnvironment = () => {
      setMotionAllowed(!reducedMotion.matches);
      setCompact(narrowViewport.matches);
      setPageVisible(document.visibilityState === 'visible');
    };
    reducedMotion.addEventListener('change', syncEnvironment);
    narrowViewport.addEventListener('change', syncEnvironment);
    document.addEventListener('visibilitychange', syncEnvironment);
    const frame = window.requestAnimationFrame(() => {
      syncEnvironment();
      try {
        setAmbientEnabled(localStorage.getItem('frontier-ambient-sprites') !== 'off');
        setAimReticleEnabled(localStorage.getItem('frontier-lightning-aim-reticle') === 'on');
      } catch { /* safe defaults when storage is unavailable */ }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      reducedMotion.removeEventListener('change', syncEnvironment);
      narrowViewport.removeEventListener('change', syncEnvironment);
      document.removeEventListener('visibilitychange', syncEnvironment);
    };
  }, []);

  // One observer per edition rather than one timer or animation loop per
  // article. Only cards near the viewport mount their independent swarms.
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      setVisibleIds((previous) => {
        const next = new Set(previous);
        let changed = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.frontierStory;
          if (!id) continue;
          const visible = entry.isIntersecting && entry.intersectionRatio >= .075;
          if (visible && !next.has(id)) { next.add(id); changed = true; }
          else if (!visible && next.has(id)) { next.delete(id); changed = true; }
        }
        return changed ? next : previous;
      });
    }, { threshold: [0, .075, .18], rootMargin: '25px 0px 25px 0px' });
    document.querySelectorAll<HTMLElement>('#frontier-stories [data-frontier-story]')
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [shown]);

  const toggleAmbient = () => {
    const enabled = !ambientEnabled;
    setAmbientEnabled(enabled);
    try { localStorage.setItem('frontier-ambient-sprites', enabled ? 'on' : 'off'); }
    catch { /* user can still toggle in this session */ }
  };
  const toggleAimReticle = () => {
    const enabled = !aimReticleEnabled;
    setAimReticleEnabled(enabled);
    try { localStorage.setItem('frontier-lightning-aim-reticle', enabled ? 'on' : 'off'); }
    catch { /* still usable during the current visit */ }
  };
  const subjectCounts = useMemo(() => SUBJECTS.reduce((counts, entry) => {
    counts[entry.id] = entry.id === 'all' ? items.length : items.filter((item) => belongsTo(item, entry.id)).length;
    return counts;
  }, {} as Record<Subject, number>), [items]);

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
      <FrontierLightningCursor showAimReticle={aimReticleEnabled}/>
      <header className={styles.masthead}>
        <Link href="/" className={styles.brand}>FRONTIER<span>.</span></Link>
        <div className={styles.mastActions}>
          <Link href="/frontier/read">FOCUS</Link>
          <Link href="/frontier/advanced">RADAR</Link>
          <button type="button" onClick={toggleAimReticle} className={styles.aimToggle}
            aria-label="Show lightning aim reticle" aria-pressed={aimReticleEnabled}
            title={aimReticleEnabled ? 'Hide lightning target' : 'Show lightning target'}>
            <Crosshair size={17} aria-hidden="true"/>
          </button>
          <button type="button" onClick={toggleAmbient} className={styles.ambientToggle}
            aria-label={ambientEnabled ? 'Turn off floating newspaper creatures' : 'Turn on floating newspaper creatures'}
            aria-pressed={ambientEnabled}
            title={ambientEnabled ? 'Turn off floating creatures' : 'Turn on floating creatures'}>
            {ambientEnabled ? <Bug size={17} aria-hidden="true"/> : <BugOff size={17} aria-hidden="true"/>}
          </button>
          <button type="button" onClick={checkForNew} disabled={checking}
            aria-label="Check for a newer Frontier edition" title="Refresh edition">
            <RefreshCw size={15} aria-hidden="true"/></button>
        </div>
      </header>

      <div className={styles.discover}>
        <nav className={styles.categories} aria-label="Filter Frontier stories">
          {SUBJECTS.map(({id,name}) => (
            <button type="button" key={id} aria-label={name} aria-pressed={subject === id} onClick={() => {
              setSubject(id); setVisible(PAGE_SIZE);
            }}>
              <span className={styles.categoryName}>{name}</span>
              <span className={styles.categoryCount} aria-hidden="true">{subjectCounts[id]}</span>
              <span className={styles.categoryMeter} aria-hidden="true"><span
                style={{ width: `${id === 'all' ? 100 : Math.max(7, subjectCounts[id] / Math.max(1, items.length) * 100)}%` }}/></span>
            </button>
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
        <span className={styles.signalCount}><i className={styles.liveDot} aria-hidden="true"/>
          {String(filtered.length).padStart(2, '0')} SIGNALS</span>
        <time dateTime={editionAt}>{dateLabel(editionAt)}</time>
      </div>
      {status ? <p role="status" className={styles.status}>{status}</p> : null}
      {filtered.length ? (
        <>
          <section className={styles.grid} id="frontier-stories" aria-label="Stories in this edition">
            {shown.map((item,index) => <EditionArticle key={item.id} item={item} ordinal={index+1}
              lead={subject === 'all' && index === 0}
              swarmActive={ambientEnabled && motionAllowed && pageVisible && hydrated && visibleIds.has(item.id)}
              compact={compact}/>)}
          </section>
          {filtered.length > visible ? <div className={styles.moreStories}>
            <button type="button" onClick={() => setVisible((n) => Math.min(filtered.length,n+PAGE_SIZE))}>
              More stories <span>{filtered.length-visible} remaining</span>
            </button>
          </div> : null}
        </>
      ) : <p className={styles.empty}>Nothing in this part of the edition. Try another topic or explore the full radar.</p>}
      <footer className={styles.footer}>
        <span>FRONTIER / {dateLabel(editionAt)}</span>
        <Link href="/frontier/advanced">RADAR <ArrowUpRight size={14} aria-hidden="true"/></Link>
      </footer>
    </div>
  );
}
