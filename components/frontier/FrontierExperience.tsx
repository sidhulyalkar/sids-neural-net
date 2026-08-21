'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, RotateCcw, Search, Upload, X } from 'lucide-react';
import {
  FRONTIER_LANES,
  FRONTIER_LANE_MAP,
  FRONTIER_REALMS,
  laneMatchesRealm,
} from '@/lib/frontier/config';
import { buildDiscoveryFocus, encodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import {
  buildDailyQuests,
  explainRecommendation,
  isDueForResurface,
  rankFrontierItems,
  selectDailyRun,
} from '@/lib/frontier/scoring';
import {
  buildTopicSearchFocus,
  normalizeTopicSearch,
  topicSearchMatches,
  topicSearchScore,
} from '@/lib/frontier/topicSearch';
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
import { FrontierAccount } from './FrontierAccount';
import { InterestConstellation } from './InterestConstellation';
import { PreferenceLens } from './PreferenceLens';
import { SignalBoard } from './SignalBoard';
import type { SignalLayoutMode } from './SignalBoard';
import { SignalCard } from './SignalCard';
import styles from './frontier-experience.module.css';

const LIVE_REFRESH_MS = 4 * 60_000;
const FEED_CACHE_KEY = 'frontier-live-feed-cache-v1';
const FEED_CACHE_MAX_AGE_MS = 36 * 60 * 60_000;

const VIEWS: Array<{ id: FrontierView; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'explore', label: 'Explore' },
  { id: 'saved', label: 'Saved' },
  { id: 'history', label: 'Seen' },
  { id: 'map', label: 'Radar' },
];

type FormatFilter = 'all' | 'papers' | 'code' | 'projects' | 'video' | 'threads' | 'sports' | 'games' | 'music';

const FORMAT_FILTERS: Array<{ id: FormatFilter; label: string }> = [
  { id: 'all', label: 'All formats' },
  { id: 'papers', label: 'Studies' },
  { id: 'code', label: 'Code' },
  { id: 'projects', label: 'Projects' },
  { id: 'video', label: 'Video' },
  { id: 'threads', label: 'Threads' },
  { id: 'sports', label: 'Sports' },
  { id: 'games', label: 'Games' },
  { id: 'music', label: 'Music' },
];

type Props = {
  initialDateLabel: string;
  initialDayKey: string;
};

function humanDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recent';
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

function LoadingBoard() {
  return (
    <div className={styles.loadingGrid} aria-label="Scanning live sources">
      {Array.from({ length: 6 }, (_, index) => (
        <div className={styles.loadingCard} key={index} aria-hidden="true">
          <span className={styles.loadingMeta} />
          <span className={styles.loadingHeadline} />
          <span className={styles.loadingHeadlineShort} />
          <span className={styles.loadingLine} />
        </div>
      ))}
    </div>
  );
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
  const [searchDraft, setSearchDraft] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('inbox');
  const [newCollection, setNewCollection] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const adaptiveFocus = useMemo(
    () => buildDiscoveryFocus(store.profile, store.behavior, 7),
    [store.profile, store.behavior]
  );
  const requestFocus = useMemo(
    () => buildTopicSearchFocus(activeSearch, adaptiveFocus, 8),
    [activeSearch, adaptiveFocus]
  );
  const focusSignature = useMemo(() => encodeDiscoveryFocus(requestFocus), [requestFocus]);

  const searchSuggestions = useMemo(() => {
    const learned = Object.entries(store.profile.topicAffinity)
      .filter(([, score]) => score > 0.2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([topic]) => topic);
    return Array.from(new Set([
      ...FRONTIER_PINNED_TOPICS.map((topic) => topic.label),
      ...learned,
    ])).slice(0, 28);
  }, [store.profile.topicAffinity]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FEED_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as FrontierFeedResponse;
      const generated = new Date(cached.generatedAt).getTime();
      if (!Array.isArray(cached.items) || !cached.items.length || !Number.isFinite(generated)) return;
      if (Date.now() - generated > FEED_CACHE_MAX_AGE_MS) return;
      setItems(cached.items);
      setSources(Array.isArray(cached.sources) ? cached.sources : []);
      setGeneratedAt(cached.generatedAt);
    } catch {
      // Cache is opportunistic. A corrupt browser entry should never block live discovery.
    }
  }, []);

  const loadFeed = useCallback(async (forceFresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
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
      setItems((current) => payload.error && !(payload.items?.length) ? current : (payload.items ?? []));
      setSources(payload.sources ?? []);
      setGeneratedAt(payload.generatedAt);
      if (payload.error) setError(payload.error);
      if (!activeSearch && payload.items?.length) {
        try {
          window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
            generatedAt: payload.generatedAt,
            items: payload.items.slice(0, 72),
            sources: payload.sources ?? [],
          } satisfies FrontierFeedResponse));
        } catch {
          // Discovery remains live even if browser storage is unavailable or full.
        }
      }
    } catch (feedError) {
      if (controller.signal.aborted) return;
      setError(feedError instanceof Error ? feedError.message : 'Live feed temporarily unavailable');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  }, [activeSearch, focusSignature]);

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

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

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
    const liveIds = new Set(items.map((item) => item.id));
    return [...items, ...resurfacing.filter((item) => !liveIds.has(item.id))];
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
  const visibleLanes = FRONTIER_LANES.filter((lane) => laneMatchesRealm(lane.id, realm));
  const exploreItems = useMemo(() => {
    const filtered = realmRanked.filter((item) => {
      if (laneFilter !== 'all' && item.lane !== laneFilter) return false;
      if (!formatMatches(item, formatFilter)) return false;
      if (activeSearch && !topicSearchMatches(item, activeSearch)) return false;
      return true;
    });
    if (!activeSearch) return filtered;
    return [...filtered].sort((a, b) => topicSearchScore(b, activeSearch) - topicSearchScore(a, activeSearch));
  }, [activeSearch, formatFilter, laneFilter, realmRanked]);
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

  const submitSearch = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    const next = normalizeTopicSearch(searchDraft);
    setSearchDraft(next);
    setActiveSearch(next);
    if (next) {
      setView('explore');
      setLaneFilter('all');
      setFormatFilter('all');
    }
  }, [searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft('');
    setActiveSearch('');
    searchInput.current?.focus();
  }, []);

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
    setFormatFilter('all');
  }, []);

  return (
    <div className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.compactMasthead}>
          <div className={styles.brandBlock} title={initialDateLabel}>
            <span className={styles.wordmark}>FRONTIER</span>
          </div>

          <form className={styles.topicSearch} onSubmit={submitSearch} role="search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInput}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && (searchDraft || activeSearch)) {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              list="frontier-topic-suggestions"
              placeholder="Search any topic…"
              aria-label="Search FRONTIER topics"
              autoComplete="off"
              spellCheck="false"
            />
            <datalist id="frontier-topic-suggestions">
              {searchSuggestions.map((topic) => <option value={topic} key={topic} />)}
            </datalist>
            {searchDraft || activeSearch ? (
              <button type="button" className={styles.searchClear} onClick={clearSearch} aria-label="Clear topic search"><X size={13} /></button>
            ) : <kbd className={styles.searchShortcut}>/</kbd>}
          </form>

          <div className={styles.headerActions}>
            <div className={styles.radarStatus} title={`${onlineSources} live sources${generatedAt ? ` · updated ${humanDate(generatedAt)}` : ''}${requestFocus.length ? ` · focus: ${requestFocus.join(', ')}` : ''}`}>
              <span className={`${styles.liveDot} ${error ? styles.liveDotDegraded : ''}`} />
              <span>{loading ? 'scanning' : error ? 'partial' : 'live'}</span>
              <button type="button" className={styles.refreshIcon} onClick={() => void loadFeed(true)} aria-label="Refresh live feed" title="Refresh live"><RefreshCw size={12} /></button>
            </div>
            <FrontierAccount />
          </div>
        </header>

        <div className={styles.controlDock}>
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
              empty={loading ? <LoadingBoard /> : <div className={styles.empty}>Nothing new yet.</div>}
            />
          </main>
        ) : null}

        {view === 'explore' ? (
          <section className={styles.signalStage}>
            <div className={styles.exploreBar}>
              {activeSearch ? (
                <div className={styles.searchContext}>
                  <span className={styles.searchQuery}>“{activeSearch}”</span>
                  <span>{exploreItems.length} match{exploreItems.length === 1 ? '' : 'es'}</span>
                </div>
              ) : <span className={styles.exploreLabel}>Browse</span>}
              <div className={styles.exploreFilters}>
                <select value={laneFilter} onChange={(event) => setLaneFilter(event.target.value as 'all' | FrontierLaneId)} aria-label="Category">
                  <option value="all">All categories</option>
                  {visibleLanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.shortLabel}</option>)}
                </select>
                <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as FormatFilter)} aria-label="Format">
                  {FORMAT_FILTERS.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                </select>
              </div>
            </div>
            <SignalBoard
              items={exploreItems.slice(0, 48)}
              renderCard={(item, mode) => renderCard(item, mode)}
              onLayoutChange={layoutCallback}
              compact
              empty={loading ? <LoadingBoard /> : <div className={styles.empty}>{activeSearch ? 'No match. Try a wider phrase.' : 'No signals in this slice.'}</div>}
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
                    <summary>Organize</summary>
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
                  empty={<div className={styles.empty}>{savedItems.length ? 'Empty group.' : 'Nothing saved yet.'}</div>}
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
                      <div className={styles.historyMeta}>{FRONTIER_LANE_MAP[entry.item.lane].shortLabel} · {entry.item.sourceLabel}{entry.dwellMs ? ` · ${Math.round(entry.dwellMs / 1000)}s` : ''}</div>
                    </div>
                    <div className={styles.micro}>{entry.reaction ?? (entry.openedAt ? 'opened' : '')}</div>
                  </div>
                ))}
              </div>
            ) : <div className={styles.empty}>Nothing seen yet.</div>}
          </section>
        ) : null}

        {view === 'map' ? (
          <section className={styles.section}>
            <PreferenceLens
              behavior={store.behavior}
              onToggleLearning={store.setImplicitLearning}
              onResetBehavior={() => {
                if (window.confirm('Forget learned habits while keeping saves, reactions, and history?')) store.resetBehavior();
              }}
            />
            <div className={styles.radarMapSection}>
              <InterestConstellation profile={store.profile} />
            </div>
          </section>
        ) : null}

        <footer className={styles.footerTools}>
          <details className={styles.dataMenu}>
            <summary>Data</summary>
            <div className={styles.dataMenuPanel}>
              <span className={styles.micro}>{store.behavior.sessions} sessions · {store.game.streak}d streak</span>
              <button type="button" className={styles.utilityButton} onClick={downloadBackup}><Download size={11} /> Export</button>
              <button type="button" className={styles.utilityButton} onClick={() => fileInput.current?.click()}><Upload size={11} /> Import</button>
              <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />
              <button
                type="button"
                className={styles.utilityButton}
                onClick={() => {
                  if (window.confirm('Reset local FRONTIER memory, saves, history, and preferences?')) store.resetFrontier();
                }}
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
          </details>
        </footer>
      </div>
    </div>
  );
}
