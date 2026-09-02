'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, RefreshCw, RotateCcw, Search, Upload, X } from 'lucide-react';
import { FRONTIER_LANES, FRONTIER_LANE_MAP, laneMatchesRealm } from '@/lib/frontier/config';
import {
  buildDirectPreferenceEvidenceIndex,
  effectiveDirectPreferenceAffinity,
} from '@/lib/frontier/directPreferenceEvidence';
import { buildDiscoveryFocus, encodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import { clearFrontierCandidatePool } from '@/lib/frontier/live/candidatePool';
import {
  clearFrontierSeenLedger,
  filterUnseenFrontierItems,
  migrateFrontierHistoryToSeenLedger,
} from '@/lib/frontier/live/seenLedger';
import { buildPairEvidenceIndex } from '@/lib/frontier/pairEvidence';
import { explainRecommendation, rankFrontierItems, selectDailyRun } from '@/lib/frontier/scoring';
import { buildSessionIntent } from '@/lib/frontier/sessionIntent';
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
  FrontierLayoutMode,
  FrontierReaction,
  FrontierRealm,
  FrontierSourceStatus,
  FrontierView,
} from '@/lib/frontier/types';
import { FrontierAccount } from './FrontierAccount';
import { FrontierSectionDeck } from './FrontierSectionDeck';
import { FrontierUtilityDock } from './FrontierUtilityDock';
import { InterestConstellation } from './InterestConstellation';
import { PreferenceLens } from './PreferenceLens';
import { SignalCard } from './SignalCard';
import styles from './frontier-experience.module.css';

const INITIAL_BROWSE_TARGET = 48;
const MAX_CLIENT_ITEMS = 72;

type FormatFilter = 'all' | 'papers' | 'code' | 'projects' | 'video' | 'threads' | 'sports' | 'games' | 'music';
type FeedScope = 'edition' | 'search';

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
  initialFeed: FrontierFeedResponse;
};

function humanDate(iso?: string): string {
  if (!iso) return 'recent';
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

export function FrontierSectionExperience({ initialDateLabel, initialDayKey, initialFeed }: Props) {
  const store = useFrontierStore();
  const {
    profile,
    behavior,
    history,
    saved,
    collections,
    game,
    hydrated,
    beginSession,
    endSession,
    recordView,
    recordLayout,
    markSeen,
    recordDwell,
    recordOpen,
    toggleSave,
    react,
    setImplicitLearning,
    resetBehavior,
    importBackup,
    createCollection: createStoreCollection,
    resetFrontier,
  } = store;

  const initialItems = useMemo(() => initialFeed.items.slice(0, MAX_CLIENT_ITEMS), [initialFeed.items]);
  const [view, setView] = useState<FrontierView>('today');
  const [editionItems, setEditionItems] = useState<FrontierItem[]>(initialItems);
  const [searchItems, setSearchItems] = useState<FrontierItem[]>();
  const [sources, setSources] = useState<FrontierSourceStatus[]>(initialFeed.sources ?? []);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>(initialFeed.generatedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [realm, setRealm] = useState<FrontierRealm>('all');
  const [laneFilter, setLaneFilter] = useState<'all' | FrontierLaneId>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [layoutMode, setLayoutMode] = useState<FrontierLayoutMode>('desk');
  const [searchDraft, setSearchDraft] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('inbox');
  const [newCollection, setNewCollection] = useState('');
  const [editionEpoch, setEditionEpoch] = useState(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const migrationStarted = useRef(false);

  const items = activeSearch && searchItems !== undefined ? searchItems : editionItems;
  const pairEvidence = useMemo(() => buildPairEvidenceIndex(history), [history]);
  const directPreferenceEvidence = useMemo(() => buildDirectPreferenceEvidenceIndex(history), [history]);
  const sessionIntent = useMemo(() => buildSessionIntent(history), [history]);
  const adaptiveFocus = useMemo(
    () => buildDiscoveryFocus(profile, behavior, 7, new Date(), pairEvidence, sessionIntent, directPreferenceEvidence),
    [behavior, directPreferenceEvidence, pairEvidence, profile, sessionIntent],
  );
  const manualFocusSignature = useMemo(
    () => encodeDiscoveryFocus(buildTopicSearchFocus(activeSearch, adaptiveFocus, 8)),
    [activeSearch, adaptiveFocus],
  );

  const searchSuggestions = useMemo(() => {
    const learned = Object.entries(profile.topicAffinity)
      .map(([topic, legacyAffinity]) => ([
        topic,
        effectiveDirectPreferenceAffinity(legacyAffinity, 'topic', topic, directPreferenceEvidence),
      ] as const))
      .filter(([, score]) => score > 0.2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([topic]) => topic);
    return Array.from(new Set([
      ...FRONTIER_PINNED_TOPICS.map((topic) => topic.label),
      ...learned,
    ])).slice(0, 28);
  }, [directPreferenceEvidence, profile.topicAffinity]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedLayout = window.localStorage.getItem('frontier-layout-mode');
      const preferred: FrontierLayoutMode = savedLayout === 'feed' || savedLayout === 'desk' ? savedLayout : 'desk';
      const resolved: FrontierLayoutMode = window.innerWidth < 720 ? 'feed' : preferred;
      setLayoutMode(resolved);
      recordLayout(resolved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [recordLayout]);

  useEffect(() => {
    if (!hydrated || migrationStarted.current) return;
    migrationStarted.current = true;
    const historical = Object.values(history).map((entry) => entry.item);
    void migrateFrontierHistoryToSeenLedger(historical);
  }, [hydrated, history]);

  useEffect(() => {
    beginSession();
    const finish = () => endSession();
    window.addEventListener('pagehide', finish);
    return () => {
      window.removeEventListener('pagehide', finish);
      endSession();
    };
  }, [beginSession, endSession]);

  useEffect(() => {
    recordView(view);
  }, [recordView, view]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const requestFeed = useCallback(async (options: { fresh?: boolean; focus?: string; scope?: FeedScope } = {}) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setError(undefined);

    try {
      const params = new URLSearchParams();
      if (options.focus) params.set('focus', options.focus);
      if (options.fresh) {
        params.set('fresh', '1');
        params.set('request', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      }
      const response = await fetch(`/api/frontier/feed${params.size ? `?${params.toString()}` : ''}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      const payload = await response.json() as FrontierFeedResponse & { error?: string };
      const unseen = await filterUnseenFrontierItems(payload.items ?? []);
      if (controller.signal.aborted) return;

      const bounded = unseen.slice(0, MAX_CLIENT_ITEMS);
      if ((options.scope ?? 'edition') === 'search') setSearchItems(bounded);
      else setEditionItems(bounded);
      setEditionEpoch((epoch) => epoch + 1);
      setSources(payload.sources ?? []);
      setGeneratedAt(payload.generatedAt);
      if (payload.error) setError(payload.error);
    } catch (feedError) {
      if (controller.signal.aborted) return;
      setError(feedError instanceof Error ? feedError.message : 'Live refresh temporarily unavailable');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  const ranked = useMemo(
    () => rankFrontierItems(items, profile, history, new Date(), behavior, pairEvidence, sessionIntent, directPreferenceEvidence),
    [behavior, directPreferenceEvidence, history, items, pairEvidence, profile, sessionIntent],
  );
  const realmRanked = useMemo(() => ranked.filter((item) => laneMatchesRealm(item.lane, realm)), [ranked, realm]);
  const todayItems = useMemo(() => selectDailyRun(realmRanked, history, INITIAL_BROWSE_TARGET), [history, realmRanked]);
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

  const savedItems = Object.values(saved);
  const activeCollection = collections.find((collection) => collection.id === collectionFilter) ?? collections[0];
  const activeCollectionItems = activeCollection
    ? activeCollection.itemIds.flatMap((id) => saved[id] ? [saved[id]] : [])
    : savedItems;
  const historyEntries = Object.values(history)
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  const visibleLanes = FRONTIER_LANES.filter((lane) => laneMatchesRealm(lane.id, realm));
  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All categories' },
    ...visibleLanes.map((lane) => ({ value: lane.id, label: lane.shortLabel })),
  ], [visibleLanes]);
  const formatOptions = useMemo(() => FORMAT_FILTERS.map((filter) => ({ value: filter.id, label: filter.label })), []);

  const seenCallback = useCallback((item: FrontierItem, resurfaced?: boolean) => markSeen(item, resurfaced), [markSeen]);
  const dwellCallback = useCallback((item: FrontierItem, dwellMs: number) => recordDwell(item, dwellMs), [recordDwell]);
  const openCallback = useCallback((item: FrontierItem) => recordOpen(item), [recordOpen]);
  const saveCallback = useCallback((item: FrontierItem) => toggleSave(item), [toggleSave]);
  const reactCallback = useCallback((item: FrontierItem, reaction: FrontierReaction) => react(item, reaction), [react]);

  const renderCard = useCallback((item: FrontierItem, presentation: FrontierLayoutMode) => (
    <SignalCard
      item={item}
      presentation={presentation}
      saved={Boolean(saved[item.id])}
      reaction={history[item.id]?.reaction}
      explanation={explainRecommendation(item, profile, behavior, new Date(), pairEvidence, directPreferenceEvidence)}
      resurfaced={item.tags.includes('second-chance')}
      onSeen={seenCallback}
      onDwell={dwellCallback}
      onOpen={openCallback}
      onSave={saveCallback}
      onReact={reactCallback}
    />
  ), [behavior, directPreferenceEvidence, dwellCallback, history, openCallback, pairEvidence, profile, reactCallback, saveCallback, saved, seenCallback]);

  const submitSearch = useCallback((event?: FormEvent) => {
    event?.preventDefault();
    const next = normalizeTopicSearch(searchDraft);
    if (!next) return;
    const focus = encodeDiscoveryFocus(buildTopicSearchFocus(next, adaptiveFocus, 8));
    setSearchDraft('');
    setActiveSearch(next);
    setSearchItems(undefined);
    setView('explore');
    setLaneFilter('all');
    setFormatFilter('all');
    setEditionEpoch((epoch) => epoch + 1);
    void requestFeed({ focus, scope: 'search' });
  }, [adaptiveFocus, requestFeed, searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft('');
    setActiveSearch('');
    setSearchItems(undefined);
    setEditionEpoch((epoch) => epoch + 1);
    searchInput.current?.focus();
  }, []);

  const changeView = useCallback((next: FrontierView) => {
    setView(next);
    if (next === 'today') {
      setSearchDraft('');
      setActiveSearch('');
      setSearchItems(undefined);
      setLaneFilter('all');
      setFormatFilter('all');
    }
    setEditionEpoch((epoch) => epoch + 1);
  }, []);

  const changeLayout = useCallback((next: FrontierLayoutMode) => {
    setLayoutMode(next);
    window.localStorage.setItem('frontier-layout-mode', next);
    recordLayout(next);
    setEditionEpoch((epoch) => epoch + 1);
  }, [recordLayout]);

  const changeCategory = useCallback((value: string) => {
    setLaneFilter(value as 'all' | FrontierLaneId);
    if (view === 'today' && value !== 'all') setView('explore');
    setEditionEpoch((epoch) => epoch + 1);
  }, [view]);

  const changeFormat = useCallback((value: string) => {
    setFormatFilter(value as FormatFilter);
    if (view === 'today' && value !== 'all') setView('explore');
    setEditionEpoch((epoch) => epoch + 1);
  }, [view]);

  const setRealmFilter = useCallback((nextRealm: FrontierRealm) => {
    setRealm(nextRealm);
    setLaneFilter('all');
    setFormatFilter('all');
    setEditionEpoch((epoch) => epoch + 1);
  }, []);

  const manualRefresh = useCallback(() => {
    void requestFeed({
      fresh: true,
      focus: activeSearch ? manualFocusSignature : undefined,
      scope: activeSearch ? 'search' : 'edition',
    });
  }, [activeSearch, manualFocusSignature, requestFeed]);

  const downloadBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(frontierBackup(store), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `frontier-memory-${initialDayKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [initialDayKey, store]);

  const importBackupFile = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!importBackup(parsed)) window.alert('That file is not a compatible FRONTIER memory backup.');
    } catch {
      window.alert('Could not read that FRONTIER memory backup.');
    }
  }, [importBackup]);

  const createCollection = useCallback(() => {
    const id = createStoreCollection(newCollection);
    if (id) {
      setCollectionFilter(id);
      setNewCollection('');
    }
  }, [createStoreCollection, newCollection]);

  const resetAll = useCallback(() => {
    resetFrontier();
    setEditionItems(initialItems);
    setSearchItems(undefined);
    setSources(initialFeed.sources ?? []);
    setGeneratedAt(initialFeed.generatedAt);
    setActiveSearch('');
    setSearchDraft('');
    setEditionEpoch((epoch) => epoch + 1);
    void clearFrontierSeenLedger();
    void clearFrontierCandidatePool();
  }, [initialFeed.generatedAt, initialFeed.sources, initialItems, resetFrontier]);

  const onlineSources = sources.filter((source) => source.ok).length;
  const status = refreshing ? 'refreshing' : error ? 'partial' : 'edition';
  const activeFeedItems = view === 'explore' ? exploreItems : todayItems;
  const deckKey = `${view}:${realm}:${laneFilter}:${formatFilter}:${activeSearch}:${editionEpoch}`;

  return (
    <div className={styles.shell} data-frontier-v21-newspaper="true">
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
              placeholder="Search any topic live…"
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
            <div className={styles.radarStatus} title={`${onlineSources} snapshot sources · updated ${humanDate(generatedAt)} · bounded newspaper runtime`}>
              <span className={`${styles.liveDot} ${error ? styles.liveDotDegraded : ''}`} />
              <span>{status}</span>
              <button
                type="button"
                className={styles.refreshIcon}
                onClick={manualRefresh}
                aria-label="Full live refresh"
                title="Pull a fresh edition from the Internet"
                disabled={refreshing}
              ><RefreshCw size={12} /></button>
            </div>
            <FrontierAccount />
          </div>
        </header>

        {view === 'today' || view === 'explore' ? (
          <main className={styles.signalStage}>
            <FrontierSectionDeck
              key={deckKey}
              items={activeFeedItems}
              layoutMode={layoutMode}
              renderCard={renderCard}
              empty={<div className={styles.empty}>{activeSearch ? 'No unseen match. Try a wider phrase.' : 'No unseen signals in this edition.'}</div>}
            />
          </main>
        ) : null}

        {view === 'saved' ? (
          <section className={styles.section}>
            <div className={styles.libraryLayout}>
              <aside className={styles.collectionRail}>
                {collections.map((collection) => (
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
              <FrontierSectionDeck
                key={`saved:${collectionFilter}:${editionEpoch}`}
                items={activeCollectionItems}
                layoutMode={layoutMode}
                renderCard={renderCard}
                empty={<div className={styles.empty}>{savedItems.length ? 'Empty group.' : 'Nothing saved yet.'}</div>}
              />
            </div>
          </section>
        ) : null}

        {view === 'history' ? (
          <section className={styles.section}>
            {historyEntries.length ? (
              <div className={styles.historyList}>
                {historyEntries.slice(0, 80).map((entry) => (
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
              behavior={behavior}
              onToggleLearning={setImplicitLearning}
              onResetBehavior={() => {
                if (window.confirm('Forget learned habits while keeping saves, reactions, and history?')) resetBehavior();
              }}
            />
            <div className={styles.radarMapSection}>
              <InterestConstellation profile={profile} />
            </div>
          </section>
        ) : null}

        <footer className={styles.footerTools}>
          <details className={styles.dataMenu}>
            <summary>Data</summary>
            <div className={styles.dataMenuPanel}>
              <span className={styles.micro}>{behavior.sessions} sessions · {game.streak}d streak</span>
              <button type="button" className={styles.utilityButton} onClick={downloadBackup}><Download size={11} /> Export</button>
              <button type="button" className={styles.utilityButton} onClick={() => fileInput.current?.click()}><Upload size={11} /> Import</button>
              <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importBackupFile(event.target.files?.[0])} />
              <button
                type="button"
                className={styles.utilityButton}
                onClick={() => {
                  if (window.confirm('Reset local FRONTIER memory, seen ledger, saves, history, and preferences?')) resetAll();
                }}
              ><RotateCcw size={11} /> Reset</button>
            </div>
          </details>
        </footer>
      </div>

      <FrontierUtilityDock
        view={view}
        realm={realm}
        layoutMode={layoutMode}
        category={laneFilter}
        format={formatFilter}
        categoryOptions={categoryOptions}
        formatOptions={formatOptions}
        activeSearch={activeSearch}
        onViewChange={changeView}
        onRealmChange={setRealmFilter}
        onLayoutChange={changeLayout}
        onCategoryChange={changeCategory}
        onFormatChange={changeFormat}
        onClearSearch={clearSearch}
      />
    </div>
  );
}
