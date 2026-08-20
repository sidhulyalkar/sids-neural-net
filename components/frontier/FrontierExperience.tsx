'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { FRONTIER_LANES, FRONTIER_LANE_MAP } from '@/lib/frontier/config';
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

type Props = {
  initialDateLabel: string;
  initialDayKey: string;
};

function onboardingSignals(): FrontierItem[] {
  const publishedAt = '2026-08-20T12:00:00.000Z';
  return [
    {
      id: 'frontier-warming',
      title: 'FRONTIER is warming up the live source mesh',
      summary: 'The interface remains usable when an upstream source is temporarily unavailable. Live feeds are fetched independently, cached on the server, and merged with persistent personal memory.',
      url: '/frontier', source: 'FRONTIER', sourceLabel: 'System', sourceKind: 'local', publishedAt,
      lane: 'must_know', tags: ['frontier', 'personalization', 'live radar'],
      baseScore: 0.72, importance: 0.72, novelty: 0.55, quality: 0.8, momentum: 0.5,
      why: 'System-status signal, never fabricated news.',
    },
    {
      id: 'frontier-football-ready',
      title: 'Premier League radar ready for matchday signal',
      summary: 'Football stories, tactical analysis, structured fixtures, injuries, transfers, analytics, and video can occupy their own lane without crowding out ML or science.',
      url: '/frontier', source: 'FRONTIER', sourceLabel: 'System', sourceKind: 'local', publishedAt,
      lane: 'premier_league', tags: ['premier league', 'football analytics', 'tactics'],
      baseScore: 0.64, importance: 0.56, novelty: 0.5, quality: 0.76, momentum: 0.42,
    },
    {
      id: 'frontier-ml-ready',
      title: 'ML + Data Lab ready for methods worth stealing',
      summary: 'The data lane prioritizes tools, benchmarks, statistical methods, causal inference, forecasting, visualization, and practical analysis ideas instead of generic AI headlines.',
      url: '/frontier', source: 'FRONTIER', sourceLabel: 'System', sourceKind: 'local', publishedAt,
      lane: 'ml_data', tags: ['machine learning', 'data analysis', 'methods'],
      baseScore: 0.64, importance: 0.55, novelty: 0.54, quality: 0.78, momentum: 0.4,
    },
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

export function FrontierExperience({ initialDateLabel, initialDayKey }: Props) {
  const store = useFrontierStore();
  const [view, setView] = useState<FrontierView>('today');
  const [items, setItems] = useState<FrontierItem[]>([]);
  const [sources, setSources] = useState<FrontierSourceStatus[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [laneFilter, setLaneFilter] = useState<'all' | FrontierLaneId>('all');
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
  const dailyRun = useMemo(() => selectDailyRun(ranked, store.history, 14), [ranked, store.history]);
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
  const exploreItems = laneFilter === 'all' ? ranked : ranked.filter((item) => item.lane === laneFilter);
  const historyEntries = Object.values(store.history)
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

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

  const hero = dailyRun[0];
  const sideSignals = dailyRun.slice(1, 3);
  const runRemainder = dailyRun.slice(3);

  return (
    <div className={styles.shell}>
      <div className={styles.ambient} />
      <div className={styles.inner}>
        <header className={styles.masthead}>
          <div>
            <p className={styles.eyebrow}>Personal intelligence system · {initialDateLabel}</p>
            <h1 className={styles.wordmark}>Your world, <span className={styles.wordmarkAccent}>in signal.</span></h1>
            <p className={styles.deck}>
              A finite daily run across Premier League football, machine learning, data analysis, NeuroAI, science, tools, video, and useful weirdness. It remembers what you know, save, ignore, and where your curiosity is moving.
            </p>
            <div className={styles.sourceStrip} aria-label="Live source status">
              {sources.map((source) => (
                <span
                  key={source.id}
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
                <p className={styles.sectionAside}>Important items can break through your taste model. Football, ML/data, and adjacent discovery retain independent oxygen.</p>
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
                <p className={styles.sectionAside}>Resolve the good signals, save the long ones, and let tomorrow&apos;s radar learn from the shape of your attention.</p>
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
              <div><p className={styles.sectionKicker}>Open radar</p><h2 className={styles.sectionTitle}>Explore beyond the finite daily run.</h2></div>
              <p className={styles.sectionAside}>The full candidate field keeps the same learning model without the Daily Run&apos;s editorial slot budget.</p>
            </div>
            <div className={styles.filterRail}>
              <button type="button" onClick={() => setLaneFilter('all')} className={`${styles.filterButton} ${laneFilter === 'all' ? styles.filterActive : ''}`}>All signals</button>
              {FRONTIER_LANES.map((lane) => (
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
            <div className={`${styles.grid} ${styles.section}`}>
              {exploreItems.slice(0, 48).map((item, index) => renderCard(item, index % 7 === 0 ? 'wide' : 'standard'))}
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
