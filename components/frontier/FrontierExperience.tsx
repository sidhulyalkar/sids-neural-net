'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import {
  FRONTIER_LANES,
  FRONTIER_LANE_MAP,
  FRONTIER_REALMS,
  laneMatchesRealm,
} from '@/lib/frontier/config';
import { FRONTIER_PINNED_TOPICS, topicMatchesItem } from '@/lib/frontier/interests';
import {
  buildDailyQuests,
  explainRecommendation,
  isDueForResurface,
  rankFrontierItems,
  selectDailyRun,
} from '@/lib/frontier/scoring';
import { frontierBackup, useFrontierStore } from '@/lib/frontier/store';
import type {
  FrontierFeedResponse,
  FrontierItem,
  FrontierLaneId,
  FrontierReaction,
  FrontierRealm,
  FrontierSourceStatus,
  FrontierView,
} from '@/lib/frontier/types';
import { InterestConstellation } from './InterestConstellation';
import { SignalCard } from './SignalCard';
import styles from './frontier.module.css';

const VIEWS: Array<{ id: FrontierView; label: string }> = [
  { id: 'today', label: 'Daily run' },
  { id: 'explore', label: 'Explore' },
  { id: 'saved', label: 'Saved' },
  { id: 'history', label: 'History' },
  { id: 'map', label: 'My radar' },
];

type FormatFilter = 'all' | 'papers' | 'code' | 'projects' | 'video' | 'threads' | 'sports' | 'games' | 'music';

const FORMAT_FILTERS: Array<{ id: FormatFilter; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'papers', label: 'Studies' },
  { id: 'code', label: 'Codebases' },
  { id: 'projects', label: 'Project design' },
  { id: 'video', label: 'Video' },
  { id: 'threads', label: 'Posts + threads' },
  { id: 'sports', label: 'Sports' },
  { id: 'games', label: 'Games' },
  { id: 'music', label: 'Music' },
];

type Props = {
  initialDateLabel: string;
  initialDayKey: string;
};

function systemSignal(
  id: string,
  title: string,
  summary: string,
  lane: FrontierLaneId,
  tags: string[],
  publishedAt: string
): FrontierItem {
  return {
    id,
    title,
    summary,
    url: '/frontier',
    source: 'FRONTIER',
    sourceLabel: 'System',
    sourceKind: 'local',
    publishedAt,
    lane,
    tags,
    baseScore: 0.62,
    importance: 0.54,
    novelty: 0.52,
    quality: 0.78,
    momentum: 0.4,
    why: 'System-status signal, never fabricated news.',
  };
}

function onboardingSignals(): FrontierItem[] {
  const publishedAt = '2026-08-20T12:00:00.000Z';
  return [
    systemSignal(
      'frontier-warming',
      'FRONTIER is warming up the live source mesh',
      'Live sources are fetched independently, cached on the server, and merged with a deployable daily snapshot plus your browser-local memory.',
      'must_know',
      ['frontier', 'personalization', 'live radar'],
      publishedAt
    ),
    systemSignal(
      'frontier-research-ready',
      'Brainfood is wired for papers, code, methods, and project fuel',
      'OpenAlex, GitHub, technical communities, specialist feeds, and broad-web discovery stay separate enough that studies do not get flattened into generic tech news.',
      'ml_data',
      ['machine learning', 'open source', 'papers', 'methods'],
      publishedAt
    ),
    systemSignal(
      'frontier-team-ready',
      'Your four-team clubhouse has its own lane',
      'Patriots, Warriors, Chelsea, and Manchester City can surface fixtures, roster moves, tactical context, highlights, memes, and fan discussion without taking over the science feed.',
      'team_pulse',
      ['patriots', 'warriors', 'chelsea', 'manchester city'],
      publishedAt
    ),
    systemSignal(
      'frontier-games-ready',
      'Your Steam library now rotates through Game Radar',
      'Favorite and adjacent games are sampled across days so patches, releases, trailers, mods, and indie discoveries stay fresh instead of repeating the same franchises forever.',
      'gaming',
      ['steam', 'metroidvania', 'indie games', 'game radar'],
      publishedAt
    ),
    systemSignal(
      'frontier-bass-ready',
      'Bass Orbit follows the shape of your actual listening',
      'The music radar can reuse the site’s Spotify taste profile for top artists, followed artists, and playlists, then widen into bass releases, sets, remixes, and SoundCloud discovery.',
      'music',
      ['dubstep', 'bass music', 'spotify', 'soundcloud'],
      publishedAt
    ),
    systemSignal(
      'frontier-reddit-ready',
      'Reddit orbit rotates across your communities',
      'A small daily sample spans technical subreddits, games, music, sports, outdoors, animals, and internet culture. It is finite on purpose.',
      'internet_culture',
      ['reddit', 'community', 'memes', 'daily rotation'],
      publishedAt
    ),
  ];
}

function levelForXp(xp: number): { level: number; name: string; current: number; target: number } {
  const names = ['Signal Seeker', 'Pattern Scout', 'Knowledge Cartographer', 'Frontier Analyst', 'Synthesis Pilot', 'World Modeler', 'Radar Architect'];
  const level = Math.floor(xp / 120) + 1;
  return {
    level,
    name: names[Math.min(names.length - 1, level - 1)],
    current: xp % 120,
    target: 120,
  };
}

function scanLabel(iso?: string): string {
  if (!iso) return 'waiting for first scan';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'scan complete';
  return `scan ${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)} PT`;
}

function humanDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatMatches(item: FrontierItem, filter: FormatFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'papers': return item.sourceKind === 'openalex' || item.tags.some((tag) => ['paper', 'study', 'research'].includes(tag));
    case 'code': return item.sourceKind === 'github' || item.lane === 'builder_signal';
    case 'projects': return ['methods', 'builder_signal', 'creative_tech'].includes(item.lane);
    case 'video': return item.media?.type === 'youtube' || item.media?.type === 'video';
    case 'threads': return ['reddit', 'social', 'hackernews'].includes(item.sourceKind);
    case 'sports': return ['team_pulse', 'premier_league', 'world_soccer', 'sports'].includes(item.lane);
    case 'games': return item.lane === 'gaming';
    case 'music': return item.lane === 'music';
  }
}

function itemSearchText(item: FrontierItem): string {
  return `${item.title} ${item.summary} ${item.tags.join(' ')} ${item.sourceLabel}`;
}

function realmCopy(realm: FrontierRealm): { title: string; accent: string; deck: string } {
  if (realm === 'learn') {
    return {
      title: 'Brainfood,',
      accent: 'with receipts.',
      deck: 'A finite research run across novel studies, open-source code, reusable methods, project design, NeuroAI, ML/data, and science. Evidence first, rabbit holes second.',
    };
  }
  if (realm === 'play') {
    return {
      title: 'The fun stuff,',
      accent: 'minus the sludge.',
      deck: 'Your teams, best highlights, Reddit threads, memes, games, bass music, outdoor rabbit holes, and useful internet chaos, filtered through the same personal radar instead of an infinite feed.',
    };
  }
  return {
    title: 'Your world,',
    accent: 'in signal.',
    deck: 'One finite daily run across research, code, teams, sports, games, dubstep, Reddit, video, and useful weirdness. It remembers what you know, save, skip, and where your curiosity is moving.',
  };
}

export function FrontierExperience({ initialDateLabel, initialDayKey }: Props) {
  const store = useFrontierStore();
  const [view, setView] = useState<FrontierView>('today');
  const [items, setItems] = useState<FrontierItem[]>([]);
  const [sources, setSources] = useState<FrontierSourceStatus[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [realm, setRealm] = useState<FrontierRealm>('all');
  const [laneFilter, setLaneFilter] = useState<'all' | FrontierLaneId>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('inbox');
  const [newCollection, setNewCollection] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch('/api/frontier/feed', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      const payload = (await response.json()) as FrontierFeedResponse & { error?: string };
      setItems(payload.items ?? []);
      setSources(payload.sources ?? []);
      setGeneratedAt(payload.generatedAt);
      if (payload.error) setError(payload.error);
    } catch (feedError) {
      setError(feedError instanceof Error ? feedError.message : 'Live feed temporarily unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
    const timer = window.setInterval(() => void loadFeed(), 15 * 60_000);
    return () => window.clearInterval(timer);
  }, [loadFeed]);

  const resurfacing = useMemo(
    () => Object.values(store.history)
      .filter((entry) => isDueForResurface(entry))
      .map((entry) => ({ ...entry.item, tags: Array.from(new Set(['second-chance', ...entry.item.tags])) })),
    [store.history]
  );

  const mergedItems = useMemo(() => {
    const live = items.length ? items : onboardingSignals();
    const liveIds = new Set(live.map((item) => item.id));
    return [...live, ...resurfacing.filter((item) => !liveIds.has(item.id))];
  }, [items, resurfacing]);

  const ranked = useMemo(
    () => rankFrontierItems(mergedItems, store.profile, store.history),
    [mergedItems, store.profile, store.history]
  );
  const realmRanked = useMemo(
    () => ranked.filter((item) => laneMatchesRealm(item.lane, realm)),
    [ranked, realm]
  );
  const dailyRun = useMemo(() => selectDailyRun(realmRanked, store.history, 14), [realmRanked, store.history]);
  const quests = useMemo(() => buildDailyQuests(store.history, initialDayKey), [store.history, initialDayKey]);
  const awardQuest = store.awardQuest;

  useEffect(() => {
    for (const quest of quests) {
      if (quest.complete) awardQuest(quest.id, quest.xp, initialDayKey);
    }
  }, [quests, awardQuest, initialDayKey]);

  const level = levelForXp(store.game.xp);
  const onlineSources = sources.filter((source) => source.ok).length;
  const savedItems = Object.values(store.saved);
  const activeCollection = store.collections.find((collection) => collection.id === collectionFilter) ?? store.collections[0];
  const activeCollectionItems = activeCollection
    ? activeCollection.itemIds.flatMap((id) => store.saved[id] ? [store.saved[id]] : [])
    : savedItems;
  const activeTopic = FRONTIER_PINNED_TOPICS.find((topic) => topic.id === topicFilter);
  const exploreItems = useMemo(() => realmRanked.filter((item) => {
    if (laneFilter !== 'all' && item.lane !== laneFilter) return false;
    if (!formatMatches(item, formatFilter)) return false;
    if (activeTopic && !topicMatchesItem(activeTopic, itemSearchText(item))) return false;
    return true;
  }), [activeTopic, formatFilter, laneFilter, realmRanked]);
  const historyEntries = Object.values(store.history)
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  const copy = realmCopy(realm);

  const markSeen = store.markSeen;
  const recordOpen = store.recordOpen;
  const toggleSave = store.toggleSave;
  const react = store.react;
  const seenCallback = useCallback((item: FrontierItem, resurfaced?: boolean) => markSeen(item, resurfaced), [markSeen]);
  const openCallback = useCallback((item: FrontierItem) => recordOpen(item), [recordOpen]);
  const saveCallback = useCallback((item: FrontierItem) => toggleSave(item), [toggleSave]);
  const reactCallback = useCallback((item: FrontierItem, reaction: FrontierReaction) => react(item, reaction), [react]);

  const downloadBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(frontierBackup(store), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `frontier-memory-${initialDayKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [store, initialDayKey]);

  const importBackup = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!store.importBackup(parsed)) window.alert('That file is not a compatible FRONTIER memory backup.');
    } catch {
      window.alert('Could not read that FRONTIER memory backup.');
    }
  }, [store]);

  const createCollection = useCallback(() => {
    const id = store.createCollection(newCollection);
    if (id) {
      setCollectionFilter(id);
      setNewCollection('');
    }
  }, [newCollection, store]);

  const renderCard = useCallback((item: FrontierItem, variant: 'feature' | 'wide' | 'standard' | 'compact' = 'standard') => (
    <SignalCard
      key={item.id}
      item={item}
      variant={variant}
      saved={Boolean(store.saved[item.id])}
      reaction={store.history[item.id]?.reaction}
      explanation={explainRecommendation(item, store.profile)}
      resurfaced={item.tags.includes('second-chance')}
      onSeen={seenCallback}
      onOpen={openCallback}
      onSave={saveCallback}
      onReact={reactCallback}
    />
  ), [openCallback, reactCallback, saveCallback, seenCallback, store.history, store.profile, store.saved]);

  const setRealmFilter = useCallback((nextRealm: FrontierRealm) => {
    setRealm(nextRealm);
    setLaneFilter('all');
    setTopicFilter('all');
    setFormatFilter('all');
  }, []);

  const openTopic = useCallback((topicId: string) => {
    const topic = FRONTIER_PINNED_TOPICS.find((candidate) => candidate.id === topicId);
    if (!topic) return;
    setRealm(topic.realm);
    setTopicFilter(topic.id);
    setLaneFilter('all');
    setFormatFilter('all');
    setView('explore');
  }, []);

  const hero = dailyRun[0];
  const sideSignals = dailyRun.slice(1, 3);
  const runRemainder = dailyRun.slice(3);
  const visibleLanes = FRONTIER_LANES.filter((lane) => laneMatchesRealm(lane.id, realm));
  const visibleTopics = FRONTIER_PINNED_TOPICS.filter((topic) => realm === 'all' || topic.realm === realm);

  return (
    <div className={styles.shell}>
      <div className={styles.ambient} />
      <div className={styles.inner}>
        <header className={styles.masthead}>
          <div>
            <p className={styles.eyebrow}>Personal intelligence system · {initialDateLabel}</p>
            <h1 className={styles.wordmark}>{copy.title} <span className={styles.wordmarkAccent}>{copy.accent}</span></h1>
            <p className={styles.deck}>{copy.deck}</p>
            <div className={styles.sourceStrip} aria-label="Live source status">
              {sources.map((source) => (
                <span
                  key={`${source.id}-${source.label}`}
                  className={`${styles.sourceStatus} ${source.ok ? styles.sourceOnline : styles.sourceOffline}`}
                  title={source.message}
                >
                  {source.label} {source.ok ? source.count : '—'}
                </span>
              ))}
              {error ? <span className={`${styles.sourceStatus} ${styles.sourceOffline}`}>degraded · {error}</span> : null}
            </div>
          </div>

          <aside className={styles.livePanel}>
            <div className={styles.liveRow}>
              <span><span className={styles.liveDot} /> &nbsp;RADAR LIVE</span>
              <span>{scanLabel(generatedAt)}</span>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}><div className={styles.statValue}>{onlineSources}</div><div className={styles.statLabel}>live sources</div></div>
              <div className={styles.stat}><div className={styles.statValue}>{store.game.streak}</div><div className={styles.statLabel}>day streak</div></div>
              <div className={styles.stat}><div className={styles.statValue}>{store.game.xp}</div><div className={styles.statLabel}>learning xp</div></div>
              <div className={styles.stat}><div className={styles.statValue}>{savedItems.length}</div><div className={styles.statLabel}>saved</div></div>
            </div>
            <div className={styles.questMeta}><span>LV {level.level} · {level.name}</span><span>{level.current}/{level.target}</span></div>
            <div className={styles.questTrack}>
              <div className={styles.questFill} style={{ width: `${Math.round(level.current / level.target * 100)}%` }} />
            </div>
          </aside>
        </header>

        <nav className={styles.nav} aria-label="FRONTIER views">
          {VIEWS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={`${styles.navButton} ${view === option.id ? styles.activeNav : ''}`}
              onClick={() => setView(option.id)}
            >
              {option.label}
            </button>
          ))}
        </nav>

        <div className={styles.filterRail} aria-label="FRONTIER perspective">
          {FRONTIER_REALMS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={`${styles.filterButton} ${realm === option.id ? styles.filterActive : ''}`}
              onClick={() => setRealmFilter(option.id)}
              title={option.description}
            >
              {option.glyph} {option.label}
            </button>
          ))}
          <span className={styles.micro} style={{ alignSelf: 'center', marginLeft: 6 }}>
            {FRONTIER_REALMS.find((option) => option.id === realm)?.description}
          </span>
        </div>

        <div className={styles.filterRail} aria-label="Pinned personal topics" style={{ marginTop: 8 }}>
          {visibleTopics.map((topic) => (
            <button
              type="button"
              key={topic.id}
              className={`${styles.filterButton} ${topicFilter === topic.id ? styles.filterActive : ''}`}
              onClick={() => openTopic(topic.id)}
            >
              {topic.glyph} {topic.label}
            </button>
          ))}
        </div>

        {view === 'today' ? (
          <>
            <div className={styles.questStrip} aria-label="Daily learning quests">
              {quests.map((quest) => (
                <div key={quest.id} className={`${styles.quest} ${quest.complete ? styles.questComplete : ''}`}>
                  <div className={styles.questTitle}>{quest.complete ? '✓ ' : ''}{quest.label}</div>
                  <div className={styles.questDesc}>{quest.description}</div>
                  <div className={styles.questMeta}><span>{quest.current}/{quest.target}</span><span>+{quest.xp} XP</span></div>
                  <div className={styles.questTrack}>
                    <div className={styles.questFill} style={{ width: `${Math.min(100, quest.current / quest.target * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>01 · Today&apos;s worldline</p>
                  <h2 className={styles.sectionTitle}>The few signals worth interrupting your day.</h2>
                </div>
                <p className={styles.sectionAside}>No doomscroll contract. FRONTIER reserves breadth, learns from explicit reactions, and stops after a finite run.</p>
              </div>
              {loading && !items.length ? (
                <div className={styles.featureGrid}>
                  <div className={styles.skeleton} />
                  <div className={styles.featureStack}><div className={styles.skeleton} /><div className={styles.skeleton} /></div>
                </div>
              ) : (
                <div className={styles.featureGrid}>
                  {hero ? renderCard(hero, 'feature') : <div className={styles.empty}>No live signal yet. The next source scan will repopulate this worldline.</div>}
                  <div className={styles.featureStack}>{sideSignals.map((item) => renderCard(item, 'compact'))}</div>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div><p className={styles.sectionKicker}>02 · Continue the run</p><h2 className={styles.sectionTitle}>Breadth before scroll depth.</h2></div>
                <p className={styles.sectionAside}>Save the long ones, resolve the good ones, and let tomorrow&apos;s radar learn from the shape of your attention.</p>
              </div>
              <div className={styles.grid}>
                {runRemainder.map((item, index) => renderCard(item, index % 5 === 0 ? 'wide' : 'standard'))}
              </div>
            </section>
          </>
        ) : null}

        {view === 'explore' ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div><p className={styles.sectionKicker}>Open radar</p><h2 className={styles.sectionTitle}>Slice the signal by what you actually want right now.</h2></div>
              <p className={styles.sectionAside}>Studies, codebases, project designs, videos, social threads, sports, games, and music remain first-class formats rather than one generic card pile.</p>
            </div>

            <p className={styles.micro}>Category</p>
            <div className={styles.filterRail} style={{ marginTop: 8 }}>
              <button type="button" onClick={() => setLaneFilter('all')} className={`${styles.filterButton} ${laneFilter === 'all' ? styles.filterActive : ''}`}>All categories</button>
              {visibleLanes.map((lane) => (
                <button
                  type="button"
                  key={lane.id}
                  onClick={() => setLaneFilter(lane.id)}
                  className={`${styles.filterButton} ${laneFilter === lane.id ? styles.filterActive : ''}`}
                >
                  {lane.glyph} {lane.shortLabel}
                </button>
              ))}
            </div>

            <p className={styles.micro} style={{ marginTop: 13 }}>Format</p>
            <div className={styles.filterRail} style={{ marginTop: 8 }}>
              {FORMAT_FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  onClick={() => setFormatFilter(filter.id)}
                  className={`${styles.filterButton} ${formatFilter === filter.id ? styles.filterActive : ''}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {activeTopic ? (
              <div className={styles.sourceStrip} style={{ marginTop: 10 }}>
                <span className={`${styles.sourceStatus} ${styles.sourceOnline}`}>Pinned · {activeTopic.label}</span>
                <button type="button" className={styles.utilityButton} onClick={() => setTopicFilter('all')}>Clear topic</button>
              </div>
            ) : null}

            <div className={`${styles.grid} ${styles.section}`}>
              {exploreItems.length
                ? exploreItems.slice(0, 60).map((item, index) => renderCard(item, index % 7 === 0 ? 'wide' : 'standard'))
                : <div className={styles.empty} style={{ gridColumn: '1 / -1' }}>No signals match this slice yet. Try a wider category or format.</div>}
            </div>
          </section>
        ) : null}

        {view === 'saved' ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div><p className={styles.sectionKicker}>External memory</p><h2 className={styles.sectionTitle}>Your saved knowledge, grouped by intent.</h2></div>
              <p className={styles.sectionAside}>Saving organizes memory. Explicit reactions teach preference, so filing an item cannot accidentally distort taste.</p>
            </div>
            <div className={styles.libraryLayout}>
              <aside className={styles.collectionRail}>
                {store.collections.map((collection) => (
                  <button
                    type="button"
                    key={collection.id}
                    onClick={() => setCollectionFilter(collection.id)}
                    className={`${styles.collectionButton} ${collectionFilter === collection.id ? styles.collectionActive : ''}`}
                  >
                    <span>{collection.name}</span><span className={styles.collectionCount}>{collection.itemIds.length}</span>
                  </button>
                ))}
                <div className={styles.collectionCreate}>
                  <input
                    value={newCollection}
                    onChange={(event) => setNewCollection(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') createCollection(); }}
                    className={styles.collectionInput}
                    placeholder="New group…"
                    aria-label="New collection name"
                  />
                  <button type="button" className={styles.utilityButton} onClick={createCollection}>+</button>
                </div>
              </aside>

              <div>
                {activeCollection && activeCollection.id !== 'inbox' && savedItems.length ? (
                  <div style={{ marginBottom: 22 }}>
                    <p className={styles.micro}>Organize “{activeCollection.name}” · tap saved signals to add or remove</p>
                    <div className={styles.filterRail} style={{ marginTop: 9 }}>
                      {savedItems.map((item) => {
                        const active = activeCollection.itemIds.includes(item.id);
                        return (
                          <button
                            type="button"
                            key={`membership-${item.id}`}
                            title={item.title}
                            className={`${styles.filterButton} ${active ? styles.filterActive : ''}`}
                            onClick={() => store.toggleCollectionItem(activeCollection.id, item)}
                          >
                            {active ? '✓' : '+'} {item.title.length > 46 ? `${item.title.slice(0, 46)}…` : item.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {activeCollectionItems.length ? (
                  <div className={styles.grid}>
                    {activeCollectionItems.map((item, index) => renderCard(item, index % 5 === 0 ? 'wide' : 'standard'))}
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <div>
                      <p className={styles.micro}>Empty group</p>
                      <p style={{ marginTop: 8 }}>{savedItems.length ? 'Use the organizer above to add saved signals to this group.' : 'Save a signal from Daily Run or Explore and it will appear here.'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {view === 'history' ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div><p className={styles.sectionKicker}>Memory trace</p><h2 className={styles.sectionTitle}>What crossed your attention.</h2></div>
              <p className={styles.sectionAside}>History powers second chances. Ignoring a strong item once is not interpreted as disinterest.</p>
            </div>
            {historyEntries.length ? (
              <div className={styles.historyList}>
                {historyEntries.slice(0, 120).map((entry) => (
                  <div className={styles.historyItem} key={entry.item.id}>
                    <div className={styles.historyTime}>{humanDate(entry.lastSeenAt)}</div>
                    <div>
                      <div className={styles.historyTitle}>{entry.item.title}</div>
                      <div className={styles.historyMeta}>{FRONTIER_LANE_MAP[entry.item.lane].shortLabel} · {entry.item.sourceLabel} · {entry.impressions} impression{entry.impressions === 1 ? '' : 's'}</div>
                    </div>
                    <div className={styles.micro}>{entry.reaction ?? (entry.openedAt ? 'opened' : 'unresolved')}</div>
                  </div>
                ))}
              </div>
            ) : <div className={styles.empty}>Your memory trace begins when signals become meaningfully visible.</div>}
          </section>
        ) : null}

        {view === 'map' ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div><p className={styles.sectionKicker}>Adaptive world model</p><h2 className={styles.sectionTitle}>Watch your curiosity change shape.</h2></div>
              <p className={styles.sectionAside}>{store.profile.meaningfulInteractions} meaningful interactions · exploration budget {Math.round(store.profile.curiosity * 100)}%</p>
            </div>
            <InterestConstellation profile={store.profile} />
            <div className={styles.section}>
              <p className={styles.sectionKicker}>Strongest learned concepts</p>
              <div className={styles.tags}>
                {Object.entries(store.profile.topicAffinity)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 24)
                  .map(([topic, affinity]) => <span key={topic} className={styles.tag}>{topic} · {Math.round(affinity * 100)}</span>)}
                {!Object.keys(store.profile.topicAffinity).length ? <span className={styles.tag}>Cold start · your feedback will grow this map</span> : null}
              </div>
            </div>
          </section>
        ) : null}

        <footer className={styles.footerTools}>
          <div>
            <p className={styles.micro}>FRONTIER MEMORY · local-first, private to this browser</p>
            <p className={styles.deck} style={{ fontSize: 11, marginTop: 5 }}>Export a portable memory capsule for backup or browser-to-browser transfer.</p>
          </div>
          <div className={styles.toolGroup}>
            <button type="button" className={styles.utilityButton} onClick={() => void loadFeed()}><RefreshCw size={11} /> Refresh</button>
            <button type="button" className={styles.utilityButton} onClick={downloadBackup}><Download size={11} /> Export memory</button>
            <button type="button" className={styles.utilityButton} onClick={() => fileInput.current?.click()}><Upload size={11} /> Import</button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />
            <button
              type="button"
              className={styles.utilityButton}
              onClick={() => {
                if (window.confirm('Reset FRONTIER history, saves, collections, XP, and learned preferences in this browser?')) store.resetFrontier();
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
