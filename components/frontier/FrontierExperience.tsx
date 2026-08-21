'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import {
  FRONTIER_LANES,
  FRONTIER_LANE_MAP,
  FRONTIER_REALMS,
  laneMatchesRealm,
} from '@/lib/frontier/config';
import { buildDiscoveryFocus, encodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
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
import { PreferenceLens } from './PreferenceLens';
import { SignalBoard } from './SignalBoard';
import type { SignalLayoutMode } from './SignalBoard';
import { SignalCard } from './SignalCard';
import styles from './frontier-minimal.module.css';

const LIVE_REFRESH_MS = 4 * 60_000;

const VIEWS: Array<{ id: FrontierView; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'explore', label: 'Explore' },
  { id: 'saved', label: 'Saved' },
  { id: 'history', label: 'History' },
  { id: 'map', label: 'Radar' },
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
    why: 'System status only, never fabricated news.',
  };
}

function onboardingSignals(): FrontierItem[] {
  const publishedAt = '2026-08-20T12:00:00.000Z';
  return [
    systemSignal('frontier-warming', 'FRONTIER is warming up the live source mesh', 'Live sources are being merged with the durable daily snapshot and your local memory.', 'must_know', ['frontier'], publishedAt),
    systemSignal('frontier-research-ready', 'Brainfood is ready for papers, code, and methods', 'Research, public code, methods, and project ideas stay separate enough to remain useful.', 'ml_data', ['machine learning', 'open source'], publishedAt),
    systemSignal('frontier-team-ready', 'Your four-team clubhouse is live', 'Patriots, Warriors, Chelsea, and Manchester City have protected signal space.', 'team_pulse', ['patriots', 'warriors', 'chelsea', 'manchester city'], publishedAt),
    systemSignal('frontier-active-ready', 'Active sports have their own motion radar', 'Climbing, MTB, skiing, skating, soccer, RipStik, RipSurf, and longboarding rotate through professional stories and clips.', 'sports', ['active sport'], publishedAt),
    systemSignal('frontier-games-ready', 'Game Radar is rotating through your library', 'Fresh game updates and adjacent discoveries rotate rather than repeating the same franchises.', 'gaming', ['steam'], publishedAt),
  ];
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

function realmTitle(realm: FrontierRealm): string {
  if (realm === 'learn') return 'Brainfood';
  if (realm === 'play') return 'After Hours';
  return 'For You';
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
  const requestRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const discoveryFocus = useMemo(
    () => buildDiscoveryFocus(store.profile, store.behavior, 7),
    [store.profile, store.behavior]
  );
  const focusSignature = useMemo(() => encodeDiscoveryFocus(discoveryFocus), [discoveryFocus]);

  const loadFeed = useCallback(async (forceFresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!hasLoadedRef.current) setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams();
      if (focusSignature) params.set('focus', focusSignature);
      if (forceFresh) params.set('fresh', '1');
      const response = await fetch(`/api/frontier/feed${params.size ? `?${params.toString()}` : ''}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      const payload = (await response.json()) as FrontierFeedResponse & { error?: string };
      setItems(payload.items ?? []);
      setSources(payload.sources ?? []);
      setGeneratedAt(payload.generatedAt);
      if (payload.error) setError(payload.error);
      hasLoadedRef.current = true;
    } catch (feedError) {
      if (controller.signal.aborted) return;
      setError(feedError instanceof Error ? feedError.message : 'Live feed temporarily unavailable');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  }, [focusSignature]);

  useEffect(() => {
    void loadFeed();
    const tick = () => {
      if (document.visibilityState === 'visible') void loadFeed();
    };
    const timer = window.setInterval(tick, LIVE_REFRESH_MS);
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') void loadFeed();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      requestRef.current?.abort();
    };
  }, [loadFeed]);

  const beginSession = store.beginSession;
  const endSession = store.endSession;
  useEffect(() => {
    beginSession();
    const finish = () => endSession();
    window.addEventListener('pagehide', finish);
    return () => {
      window.removeEventListener('pagehide', finish);
      endSession();
    };
  }, [beginSession, endSession]);

  const recordView = store.recordView;
  useEffect(() => { recordView(view); }, [recordView, view]);

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
    () => rankFrontierItems(mergedItems, store.profile, store.history, new Date(), store.behavior),
    [mergedItems, store.behavior, store.history, store.profile]
  );
  const realmRanked = useMemo(
    () => ranked.filter((item) => laneMatchesRealm(item.lane, realm)),
    [ranked, realm]
  );
  const dailyRun = useMemo(() => selectDailyRun(realmRanked, store.history, 14), [realmRanked, store.history]);
  const quests = useMemo(() => buildDailyQuests(store.history, initialDayKey), [store.history, initialDayKey]);
  const awardQuest = store.awardQuest;

  useEffect(() => {
    for (const quest of quests) if (quest.complete) awardQuest(quest.id, quest.xp, initialDayKey);
  }, [quests, awardQuest, initialDayKey]);

  const onlineSources = sources.filter((source) => source.ok).length;
  const savedItems = Object.values(store.saved);
  const activeCollection = store.collections.find((collection) => collection.id === collectionFilter) ?? store.collections[0];
  const activeCollectionItems = activeCollection
    ? activeCollection.itemIds.flatMap((id) => store.saved[id] ? [store.saved[id]] : [])
    : savedItems;
  const activeTopic = FRONTIER_PINNED_TOPICS.find((topic) => topic.id === topicFilter);
  const visibleLanes = FRONTIER_LANES.filter((lane) => laneMatchesRealm(lane.id, realm));
  const visibleTopics = FRONTIER_PINNED_TOPICS.filter((topic) => realm === 'all' || topic.realm === realm);
  const exploreItems = useMemo(() => realmRanked.filter((item) => {
    if (laneFilter !== 'all' && item.lane !== laneFilter) return false;
    if (!formatMatches(item, formatFilter)) return false;
    if (activeTopic && !topicMatchesItem(activeTopic, itemSearchText(item))) return false;
    return true;
  }), [activeTopic, formatFilter, laneFilter, realmRanked]);
  const historyEntries = Object.values(store.history)
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  const markSeen = store.markSeen;
  const recordDwell = store.recordDwell;
  const recordExpand = store.recordExpand;
  const recordOpen = store.recordOpen;
  const toggleSave = store.toggleSave;
  const react = store.react;
  const recordLayout = store.recordLayout;
  const seenCallback = useCallback((item: FrontierItem, resurfaced?: boolean) => markSeen(item, resurfaced), [markSeen]);
  const dwellCallback = useCallback((item: FrontierItem, dwellMs: number) => recordDwell(item, dwellMs), [recordDwell]);
  const expandCallback = useCallback((item: FrontierItem) => recordExpand(item), [recordExpand]);
  const openCallback = useCallback((item: FrontierItem) => recordOpen(item), [recordOpen]);
  const saveCallback = useCallback((item: FrontierItem) => toggleSave(item), [toggleSave]);
  const reactCallback = useCallback((item: FrontierItem, reaction: FrontierReaction) => react(item, reaction), [react]);
  const layoutCallback = useCallback((layout: SignalLayoutMode) => recordLayout(layout), [recordLayout]);

  const renderCard = useCallback((item: FrontierItem, presentation: SignalLayoutMode | 'library' = 'library') => (
    <SignalCard
      item={item}
      presentation={presentation}
      saved={Boolean(store.saved[item.id])}
      reaction={store.history[item.id]?.reaction}
      explanation={explainRecommendation(item, store.profile, store.behavior)}
      resurfaced={item.tags.includes('second-chance')}
      onSeen={seenCallback}
      onDwell={dwellCallback}
      onExpand={expandCallback}
      onOpen={openCallback}
      onSave={saveCallback}
      onReact={reactCallback}
    />
  ), [dwellCallback, expandCallback, openCallback, reactCallback, saveCallback, seenCallback, store.behavior, store.history, store.profile, store.saved]);

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

  const setRealmFilter = useCallback((nextRealm: FrontierRealm) => {
    setRealm(nextRealm);
    setLaneFilter('all');
    setTopicFilter('all');
    setFormatFilter('all');
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.compactMasthead}>
          <div className={styles.brandBlock}>
            <p className={styles.eyebrow}>FRONTIER · {initialDateLabel}</p>
            <h1 className={styles.minimalTitle}>{realmTitle(realm)}</h1>
          </div>
          <div className={styles.radarStatus} title={generatedAt ? `Last live scan ${humanDate(generatedAt)} · adaptive focus: ${discoveryFocus.join(', ')}` : undefined}>
            <span className={styles.liveDot} /> {loading && !items.length ? 'scanning' : `${onlineSources} live sources`}
            <span>·</span><span>{dailyRun.length} signals</span>
            <span>·</span><span>{savedItems.length} saved</span>
            <span>·</span><span>{store.behavior.implicitLearning ? 'learning' : 'learning paused'}</span>
            {error ? <span className={styles.degraded}>· degraded</span> : null}
          </div>
        </header>

        <div className={styles.controlDock} style={{ flexWrap: 'wrap', overflow: 'visible' }}>
          <nav className={styles.nav} aria-label="FRONTIER views">
            {VIEWS.map((option) => (
              <button type="button" key={option.id} className={`${styles.navButton} ${view === option.id ? styles.activeNav : ''}`} onClick={() => setView(option.id)}>
                {option.label}
              </button>
            ))}
          </nav>
          <div className={styles.realmSwitch} aria-label="FRONTIER perspective">
            {FRONTIER_REALMS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`${styles.filterButton} ${realm === option.id ? styles.filterActive : ''}`}
                onClick={() => setRealmFilter(option.id)}
                title={option.description}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {view === 'today' ? (
          <main className={styles.signalStage}>
            <SignalBoard
              items={dailyRun}
              renderCard={(item, mode) => renderCard(item, mode)}
              onLayoutChange={layoutCallback}
              empty={<div className={styles.empty}>No live signal yet. Refresh in a moment.</div>}
            />
          </main>
        ) : null}

        {view === 'explore' ? (
          <section className={styles.signalStage}>
            <div className={styles.exploreBar}>
              <label>
                <span>Topic</span>
                <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
                  <option value="all">Everything</option>
                  {visibleTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
                </select>
              </label>
              <label>
                <span>Category</span>
                <select value={laneFilter} onChange={(event) => setLaneFilter(event.target.value as 'all' | FrontierLaneId)}>
                  <option value="all">All categories</option>
                  {visibleLanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.shortLabel}</option>)}
                </select>
              </label>
              <label>
                <span>Format</span>
                <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as FormatFilter)}>
                  {FORMAT_FILTERS.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                </select>
              </label>
            </div>
            <SignalBoard
              items={exploreItems.slice(0, 48)}
              renderCard={(item, mode) => renderCard(item, mode)}
              onLayoutChange={layoutCallback}
              compact
              empty={<div className={styles.empty}>No signals match this slice. Widen one filter.</div>}
            />
          </section>
        ) : null}

        {view === 'saved' ? (
          <section className={styles.section}>
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
                  <details className={styles.organizer}>
                    <summary>Organize {activeCollection.name}</summary>
                    <div className={styles.organizerItems}>
                      {savedItems.map((item) => {
                        const active = activeCollection.itemIds.includes(item.id);
                        return (
                          <button type="button" key={`membership-${item.id}`} className={active ? styles.organizerActive : ''} onClick={() => store.toggleCollectionItem(activeCollection.id, item)}>
                            {active ? '✓' : '+'} {item.title}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
                <SignalBoard
                  items={activeCollectionItems}
                  renderCard={(item, mode) => renderCard(item, mode)}
                  onLayoutChange={layoutCallback}
                  compact
                  empty={<div className={styles.empty}>{savedItems.length ? 'This group is empty.' : 'Save a signal and it will appear here.'}</div>}
                />
              </div>
            </div>
          </section>
        ) : null}

        {view === 'history' ? (
          <section className={styles.section}>
            {historyEntries.length ? (
              <div className={styles.historyList}>
                {historyEntries.slice(0, 120).map((entry) => (
                  <div className={styles.historyItem} key={entry.item.id}>
                    <div className={styles.historyTime}>{humanDate(entry.lastSeenAt)}</div>
                    <div>
                      <div className={styles.historyTitle}>{entry.item.title}</div>
                      <div className={styles.historyMeta}>{FRONTIER_LANE_MAP[entry.item.lane].shortLabel} · {entry.item.sourceLabel}{entry.dwellMs ? ` · ${Math.round(entry.dwellMs / 1000)}s attention` : ''}</div>
                    </div>
                    <div className={styles.micro}>{entry.reaction ?? (entry.openedAt ? 'opened' : 'unresolved')}</div>
                  </div>
                ))}
              </div>
            ) : <div className={styles.empty}>Your history begins when signals become visible.</div>}
          </section>
        ) : null}

        {view === 'map' ? (
          <section className={styles.section}>
            <PreferenceLens
              behavior={store.behavior}
              onToggleLearning={store.setImplicitLearning}
              onResetBehavior={() => {
                if (window.confirm('Forget only the behavior/habit model while keeping saves, explicit reactions, and history?')) store.resetBehavior();
              }}
            />
            <div className={styles.radarMapSection}>
              <InterestConstellation profile={store.profile} />
            </div>
          </section>
        ) : null}

        <footer className={styles.footerTools}>
          <span className={styles.micro}>Live runtime · local memory · {store.game.streak} day streak · {store.game.xp} XP · {store.behavior.sessions} learned sessions</span>
          <div className={styles.toolGroup}>
            <button type="button" className={styles.utilityButton} onClick={() => void loadFeed(true)}><RefreshCw size={11} /> Refresh live</button>
            <button type="button" className={styles.utilityButton} onClick={downloadBackup}><Download size={11} /> Export</button>
            <button type="button" className={styles.utilityButton} onClick={() => fileInput.current?.click()}><Upload size={11} /> Import</button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />
            <button
              type="button"
              className={styles.utilityButton}
              onClick={() => {
                if (window.confirm('Reset FRONTIER history, saves, collections, XP, learned behavior, and explicit preferences in this browser?')) store.resetFrontier();
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
