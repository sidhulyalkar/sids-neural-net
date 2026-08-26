'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, RefreshCw, RotateCcw, Search, Upload, X } from 'lucide-react';
import {
  FRONTIER_LANES,
  FRONTIER_LANE_MAP,
  laneMatchesRealm,
} from '@/lib/frontier/config';
import { buildDiscoveryFocus, encodeDiscoveryFocus } from '@/lib/frontier/discoveryFocus';
import { FRONTIER_PINNED_TOPICS } from '@/lib/frontier/interests';
import { clearFrontierCandidatePool } from '@/lib/frontier/live/candidatePool';
import {
  clearFrontierSeenLedger,
  filterUnseenFrontierItems,
  frontierItemIdentityKey,
  frontierSeenSignatures,
  migrateFrontierHistoryToSeenLedger,
} from '@/lib/frontier/live/seenLedger';
import {
  buildDailyQuests,
  explainRecommendation,
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
import { FrontierStreamPulse } from './FrontierStreamPulse';
import { FrontierUtilityDock } from './FrontierUtilityDock';
import { InterestConstellation } from './InterestConstellation';
import { PreferenceLens } from './PreferenceLens';
import { SignalBoard } from './SignalBoard';
import type { SignalLayoutMode } from './SignalBoard';
import { SignalCard } from './SignalCard';
import { useLiveDiscoveryDaemon } from './live/useLiveDiscoveryDaemon';
import { useWaterfallText } from './useWaterfallText';
import styles from './frontier-experience.module.css';

const FEED_CACHE_KEY = 'frontier-live-feed-cache-v1';
const FEED_CACHE_MAX_AGE_MS = 4 * 60 * 60_000;
const BASE_EXPLORATION_TEMPERATURE = 0.08;
const MANUAL_EXPLORATION_TEMPERATURE = 0.82;
const STREAM_EXPLORATION_TEMPERATURE = 0.62;
const INITIAL_BROWSE_TARGET = 48;
const LIVE_APPEND_BATCH = 16;
const MAX_STREAM_ITEMS = 96;
const ACTIVE_ITEM_WINDOW = INITIAL_BROWSE_TARGET + MAX_STREAM_ITEMS;

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

function dedupeCanonical(items: FrontierItem[]): FrontierItem[] {
  const map = new Map<string, FrontierItem>();
  for (const item of items) {
    const key = frontierItemIdentityKey(item);
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

function mergeSourceStatuses(left: FrontierSourceStatus[], right: FrontierSourceStatus[]): FrontierSourceStatus[] {
  const map = new Map<string, FrontierSourceStatus>();
  for (const source of [...left, ...right]) {
    const current = map.get(source.id);
    if (!current) map.set(source.id, source);
    else map.set(source.id, {
      ...current,
      ok: current.ok || source.ok,
      count: Math.max(current.count, source.count),
      message: current.ok ? current.message : source.message,
    });
  }
  return Array.from(map.values());
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
  const [streamItems, setStreamItems] = useState<FrontierItem[]>([]);
  const [sources, setSources] = useState<FrontierSourceStatus[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [realm, setRealm] = useState<FrontierRealm>('all');
  const [laneFilter, setLaneFilter] = useState<'all' | FrontierLaneId>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [layoutMode, setLayoutMode] = useState<SignalLayoutMode>('desk');
  const [searchDraft, setSearchDraft] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('inbox');
  const [newCollection, setNewCollection] = useState('');
  const [explorationTemperature, setExplorationTemperature] = useState(BASE_EXPLORATION_TEMPERATURE);
  const [diversityReference, setDiversityReference] = useState<FrontierItem[]>([]);
  const [streamEpoch, setStreamEpoch] = useState(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const utilityDockRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const temperatureTimer = useRef<number | undefined>(undefined);
  const activeItemsRef = useRef<FrontierItem[]>([]);
  const nearEndArmed = useRef(false);
  const migrationStarted = useRef(false);
  const livePrimerArmed = useRef(true);
  const recordLayout = store.recordLayout;
  const { launchWaterfall, waterfallActive } = useWaterfallText(searchInput, { collisionRef: utilityDockRef });

  const adaptiveFocus = useMemo(
    () => buildDiscoveryFocus(store.profile, store.behavior, 7),
    [store.profile, store.behavior]
  );
  const requestFocus = useMemo(
    () => buildTopicSearchFocus(activeSearch, adaptiveFocus, 8),
    [activeSearch, adaptiveFocus]
  );
  const focusSignature = useMemo(() => encodeDiscoveryFocus(requestFocus), [requestFocus]);
  const focusSignatureRef = useRef(focusSignature);
  useEffect(() => {
    focusSignatureRef.current = focusSignature;
  }, [focusSignature]);
  const daemonExcludeItems = useMemo(
    () => dedupeCanonical([...items, ...streamItems]).slice(0, ACTIVE_ITEM_WINDOW),
    [items, streamItems]
  );
  const {
    pendingCount,
    status: daemonStatus,
    generatedAt: daemonGeneratedAt,
    sources: daemonSources,
    requestPoll,
    flush: flushPending,
    clearPending,
  } = useLiveDiscoveryDaemon({
    focusSignature,
    excludeItems: daemonExcludeItems,
    enabled: !loading && items.length > 0,
  });

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

  const spikeExploration = useCallback((temperature: number) => {
    setExplorationTemperature(Math.max(BASE_EXPLORATION_TEMPERATURE, Math.min(1, temperature)));
    if (temperatureTimer.current !== undefined) window.clearTimeout(temperatureTimer.current);
    temperatureTimer.current = window.setTimeout(() => {
      setExplorationTemperature(BASE_EXPLORATION_TEMPERATURE);
      temperatureTimer.current = undefined;
    }, 24_000);
  }, []);

  useEffect(() => () => {
    if (temperatureTimer.current !== undefined) window.clearTimeout(temperatureTimer.current);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem('frontier-layout-mode');
      const preferred: SignalLayoutMode = saved === 'feed' || saved === 'desk' ? saved : 'desk';
      const resolved: SignalLayoutMode = window.innerWidth < 720 ? 'feed' : preferred;
      setLayoutMode(resolved);
      recordLayout(resolved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [recordLayout]);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem(FEED_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as FrontierFeedResponse;
      const generated = new Date(cached.generatedAt).getTime();
      if (!Array.isArray(cached.items) || !cached.items.length || !Number.isFinite(generated)) return;
      if (Date.now() - generated > FEED_CACHE_MAX_AGE_MS) return;
      void filterUnseenFrontierItems(cached.items).then((unseen) => {
        if (cancelled || !unseen.length) return;
        setItems(unseen);
        setSources(Array.isArray(cached.sources) ? cached.sources : []);
        setGeneratedAt(cached.generatedAt);
      });
    } catch {
      // Cache is opportunistic. A corrupt browser entry should never block live discovery.
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!store.hydrated || migrationStarted.current) return;
    migrationStarted.current = true;
    const historical = Object.values(store.history).map((entry) => entry.item);
    void migrateFrontierHistoryToSeenLedger(historical);
  }, [store.hydrated, store.history]);

  const loadFeed = useCallback(async (forceFresh = false, focus = '') => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(undefined);

    const fetchPayload = async (requestFocusSignature: string): Promise<FrontierFeedResponse & { error?: string }> => {
      const params = new URLSearchParams();
      if (requestFocusSignature) params.set('focus', requestFocusSignature);
      if (forceFresh) {
        params.set('fresh', '1');
        params.set('request', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      }
      const response = await fetch(`/api/frontier/feed${params.size ? `?${params.toString()}` : ''}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      return await response.json() as FrontierFeedResponse & { error?: string };
    };

    try {
      // Passive navigation supplies an empty focus and therefore hits the route's
      // snapshot-first path. Adaptive interests are read through a ref only for
      // explicit search/refresh work so profile hydration cannot restart cold load.
      const payload = await fetchPayload(focus);
      let nextItems = await filterUnseenFrontierItems(payload.items ?? []);
      const nextSources = payload.sources ?? [];
      const nextGeneratedAt = payload.generatedAt;

      const currentSignatures = new Set(activeItemsRef.current.flatMap((item) => frontierSeenSignatures(item)));
      if (forceFresh && currentSignatures.size) {
        nextItems = nextItems.filter((item) => !frontierSeenSignatures(item).some((signature) => currentSignatures.has(signature)));
      }

      if (controller.signal.aborted) return;
      if (nextItems.length) {
        livePrimerArmed.current = true;
        if (forceFresh) {
          setDiversityReference(activeItemsRef.current.slice(0, 28));
          spikeExploration(MANUAL_EXPLORATION_TEMPERATURE);
          setStreamItems([]);
          setStreamEpoch((epoch) => epoch + 1);
          clearPending();
        }
        setItems(nextItems);
      }
      setSources(nextSources);
      setGeneratedAt(nextGeneratedAt);
      if (payload.error) setError(payload.error);
      if (!focus && !forceFresh && nextItems.length) {
        try {
          window.localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
            generatedAt: nextGeneratedAt,
            items: nextItems.slice(0, 72),
            sources: nextSources,
          } satisfies FrontierFeedResponse));
        } catch {
          // Discovery remains live even if browser storage is unavailable or full.
        }
      }
    } catch (feedError) {
      if (controller.signal.aborted) return;
      setError(feedError instanceof Error ? feedError.message : 'Live feed temporarily unavailable');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [clearPending, spikeExploration]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadFeed(false, activeSearch ? focusSignatureRef.current : '');
    });
    return () => {
      window.cancelAnimationFrame(frame);
      requestRef.current?.abort();
    };
  }, [activeSearch, loadFeed]);

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

  // Strict Phase 5 live surfaces intentionally exclude the old automatic
  // second-chance resurfacing path. Seen material remains available in History
  // and Saved, but never competes with a fresh live rotation.
  const ranked = useMemo(
    () => rankFrontierItems(items, store.profile, store.history, new Date(), store.behavior),
    [items, store.behavior, store.history, store.profile]
  );
  const realmRanked = useMemo(
    () => ranked.filter((item) => laneMatchesRealm(item.lane, realm)),
    [ranked, realm]
  );
  const dailyRun = useMemo(
    () => selectDailyRun(realmRanked, store.history, INITIAL_BROWSE_TARGET),
    [realmRanked, store.history]
  );
  const dailySignatures = useMemo(() => new Set(dailyRun.flatMap((item) => frontierSeenSignatures(item))), [dailyRun]);
  const streamedToday = useMemo(() => streamItems.filter((item) => (
    laneMatchesRealm(item.lane, realm)
    && !frontierSeenSignatures(item).some((signature) => dailySignatures.has(signature))
  )), [dailySignatures, realm, streamItems]);
  const todayItems = useMemo(() => dedupeCanonical([...dailyRun, ...streamedToday]), [dailyRun, streamedToday]);

  const exploreRanked = useMemo(
    () => rankFrontierItems(dedupeCanonical([...items, ...streamItems]), store.profile, store.history, new Date(), store.behavior),
    [items, store.behavior, store.history, store.profile, streamItems]
  );
  const exploreRealmRanked = useMemo(
    () => exploreRanked.filter((item) => laneMatchesRealm(item.lane, realm)),
    [exploreRanked, realm]
  );

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
  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All categories' },
    ...visibleLanes.map((lane) => ({ value: lane.id, label: lane.shortLabel })),
  ], [visibleLanes]);
  const formatOptions = useMemo(() => FORMAT_FILTERS.map((filter) => ({ value: filter.id, label: filter.label })), []);
  const exploreItems = useMemo(() => {
    const filtered = exploreRealmRanked.filter((item) => {
      if (laneFilter !== 'all' && item.lane !== laneFilter) return false;
      if (!formatMatches(item, formatFilter)) return false;
      if (activeSearch && !topicSearchMatches(item, activeSearch)) return false;
      return true;
    });
    if (!activeSearch) return filtered;
    return [...filtered].sort((a, b) => topicSearchScore(b, activeSearch) - topicSearchScore(a, activeSearch));
  }, [activeSearch, exploreRealmRanked, formatFilter, laneFilter]);
  const historyEntries = Object.values(store.history)
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  useEffect(() => {
    activeItemsRef.current = view === 'explore'
      ? exploreItems.slice(0, ACTIVE_ITEM_WINDOW)
      : todayItems.slice(0, ACTIVE_ITEM_WINDOW);
  }, [exploreItems, todayItems, view]);

  const revealPending = useCallback(async () => {
    const fresh = await flushPending(LIVE_APPEND_BATCH);
    if (!fresh.length) return;
    setDiversityReference(activeItemsRef.current.slice(0, 28));
    spikeExploration(STREAM_EXPLORATION_TEMPERATURE);
    setStreamItems((current) => dedupeCanonical([...current, ...fresh]).slice(0, MAX_STREAM_ITEMS));
    if (daemonGeneratedAt) setGeneratedAt(daemonGeneratedAt);
    if (daemonSources.length) setSources((current) => mergeSourceStatuses(current, daemonSources));
    if (view !== 'today' && view !== 'explore') setView('today');
  }, [daemonGeneratedAt, daemonSources, flushPending, spikeExploration, view]);

  // Prime one bounded live batch once the snapshot-backed surface is usable.
  // appendStable guarantees this never reshuffles cards the reader is already
  // looking at; new signals simply extend the river below the current content.
  useEffect(() => {
    if (loading || !items.length || pendingCount <= 0 || !livePrimerArmed.current) return;
    const timer = window.setTimeout(() => {
      if (!livePrimerArmed.current) return;
      livePrimerArmed.current = false;
      void revealPending();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [items.length, loading, pendingCount, revealPending]);

  const manualRefresh = useCallback(async () => {
    // A deliberate refresh means "go back to the Internet now", not merely
    // reveal candidates already waiting in this tab's background queue.
    clearPending();
    await loadFeed(true, focusSignatureRef.current);
    requestPoll('manual-refresh');
  }, [clearPending, loadFeed, requestPoll]);

  const handleNearEnd = useCallback(() => {
    if (pendingCount > 0) {
      nearEndArmed.current = false;
      void revealPending();
      return;
    }
    nearEndArmed.current = true;
    requestPoll('near-end');
  }, [pendingCount, requestPoll, revealPending]);

  useEffect(() => {
    if (!nearEndArmed.current || pendingCount <= 0) return;
    nearEndArmed.current = false;
    void revealPending();
  }, [pendingCount, revealPending]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if (!typing && event.key.toLowerCase() === 'n' && pendingCount > 0) {
        event.preventDefault();
        void revealPending();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [pendingCount, revealPending]);

  const markSeen = store.markSeen;
  const recordDwell = store.recordDwell;
  const recordExpand = store.recordExpand;
  const recordOpen = store.recordOpen;
  const toggleSave = store.toggleSave;
  const react = store.react;
  const seenCallback = useCallback((item: FrontierItem, resurfaced?: boolean) => markSeen(item, resurfaced), [markSeen]);
  const dwellCallback = useCallback((item: FrontierItem, dwellMs: number) => recordDwell(item, dwellMs), [recordDwell]);
  const expandCallback = useCallback((item: FrontierItem) => recordExpand(item), [recordExpand]);
  const openCallback = useCallback((item: FrontierItem) => recordOpen(item), [recordOpen]);
  const saveCallback = useCallback((item: FrontierItem) => toggleSave(item), [toggleSave]);
  const reactCallback = useCallback((item: FrontierItem, reaction: FrontierReaction) => react(item, reaction), [react]);

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

  const submitSearch = useCallback((event?: FormEvent) => {
    event?.preventDefault();
    const next = normalizeTopicSearch(searchDraft);
    if (!next) return;

    launchWaterfall(searchDraft);
    setSearchDraft('');
    setActiveSearch(next);
    setView('explore');
    setLaneFilter('all');
    setFormatFilter('all');
    setStreamItems([]);
    setDiversityReference(activeItemsRef.current.slice(0, 28));
    spikeExploration(0.5);
    setStreamEpoch((epoch) => epoch + 1);
  }, [launchWaterfall, searchDraft, spikeExploration]);

  const clearSearch = useCallback(() => {
    setSearchDraft('');
    setActiveSearch('');
    setStreamEpoch((epoch) => epoch + 1);
    searchInput.current?.focus();
  }, []);

  const changeView = useCallback((next: FrontierView) => {
    setView(next);
    if (next === 'today') {
      setSearchDraft('');
      setActiveSearch('');
      setLaneFilter('all');
      setFormatFilter('all');
    }
  }, []);

  const changeLayout = useCallback((next: SignalLayoutMode) => {
    setLayoutMode(next);
    window.localStorage.setItem('frontier-layout-mode', next);
    recordLayout(next);
  }, [recordLayout]);

  const changeCategory = useCallback((value: string) => {
    setLaneFilter(value as 'all' | FrontierLaneId);
    if (view === 'today' && value !== 'all') setView('explore');
  }, [view]);

  const changeFormat = useCallback((value: string) => {
    setFormatFilter(value as FormatFilter);
    if (view === 'today' && value !== 'all') setView('explore');
  }, [view]);

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

  const resetAll = useCallback(() => {
    store.resetFrontier();
    clearPending();
    setStreamItems([]);
    setDiversityReference([]);
    setExplorationTemperature(BASE_EXPLORATION_TEMPERATURE);
    setStreamEpoch((epoch) => epoch + 1);
    livePrimerArmed.current = true;
    void clearFrontierSeenLedger();
    void clearFrontierCandidatePool();
  }, [clearPending, store]);

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
              className={waterfallActive ? styles.searchInputWaterfall : undefined}
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
            <div className={styles.radarStatus} title={`${onlineSources} live sources${generatedAt ? ` · updated ${humanDate(generatedAt)}` : ''}${requestFocus.length ? ` · focus: ${requestFocus.join(', ')}` : ''}${daemonStatus.leader ? ' · discovery leader' : ' · shared discovery follower'}`}>
              <span className={`${styles.liveDot} ${error ? styles.liveDotDegraded : ''}`} />
              <span>{loading ? 'scanning' : error ? 'partial' : daemonStatus.polling ? 'streaming' : 'live'}</span>
              <button type="button" className={styles.refreshIcon} onClick={() => void manualRefresh()} aria-label="Full live refresh" title="Pull fresh Internet signals"><RefreshCw size={12} /></button>
            </div>
            <FrontierAccount />
          </div>
        </header>

        {view === 'today' ? (
          <main className={styles.signalStage}>
            <SignalBoard
              items={todayItems}
              mode={layoutMode}
              renderCard={(item, mode) => renderCard(item, mode)}
              empty={loading ? <LoadingBoard /> : <div className={styles.empty}>No unseen signals yet.</div>}
              explorationTemperature={explorationTemperature}
              diversityReference={diversityReference}
              appendStable
              streamEpoch={streamEpoch}
              onNearEnd={handleNearEnd}
            />
          </main>
        ) : null}

        {view === 'explore' ? (
          <section className={styles.signalStage}>
            <SignalBoard
              items={exploreItems.slice(0, 96)}
              mode={layoutMode}
              renderCard={(item, mode) => renderCard(item, mode)}
              compact
              empty={loading ? <LoadingBoard /> : <div className={styles.empty}>{activeSearch ? 'No unseen match. Try a wider phrase.' : 'No unseen signals in this slice.'}</div>}
              explorationTemperature={explorationTemperature}
              diversityReference={diversityReference}
              appendStable
              streamEpoch={streamEpoch}
              onNearEnd={handleNearEnd}
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
                  mode={layoutMode}
                  renderCard={(item, mode) => renderCard(item, mode)}
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
                  if (window.confirm('Reset local FRONTIER memory, seen ledger, live queue, saves, history, and preferences?')) resetAll();
                }}
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
          </details>
        </footer>
      </div>

      <FrontierStreamPulse
        count={pendingCount}
        leader={daemonStatus.leader}
        polling={daemonStatus.polling}
        onReveal={() => void revealPending()}
      />

      <FrontierUtilityDock
        ref={utilityDockRef}
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
