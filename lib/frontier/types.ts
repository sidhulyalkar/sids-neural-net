export const FRONTIER_LANE_IDS = [
  'must_know',
  'ml_data',
  'ai_frontier',
  'neuro_frontier',
  'methods',
  'builder_signal',
  'competitions',
  'broad_science',
  'creative_tech',
  'world_pulse',
  'premier_league',
  'world_soccer',
  'team_pulse',
  'sports',
  'gaming',
  'screen',
  'music',
  'internet_culture',
  'life',
  'wildcards',
] as const;

export type FrontierLaneId = (typeof FRONTIER_LANE_IDS)[number];

export type FrontierSourceKind =
  | 'hackernews'
  | 'github'
  | 'openalex'
  | 'arxiv'
  | 'huggingface'
  | 'paperswithcode'
  | 'biorxiv'
  | 'medrxiv'
  | 'openreview'
  | 'lobsters'
  | 'nasa'
  | 'vimeo'
  | 'rss'
  | 'youtube'
  | 'football_data'
  | 'sports_state'
  | 'reddit'
  | 'steam'
  | 'social'
  | 'brave_web'
  | 'gdelt'
  | 'local';

export type FrontierSegment = {
  url: string;
  duration: number;
  byteLength?: number;
};

export type FrontierVideoVariant = {
  id: string;
  width: number;
  height: number;
  fps?: number;
  bitrate: number;
  codec: string;
  mimeType: string;
};

export type FrontierVideoStream =
  | {
      kind: 'progressive';
      url: string;
      mimeType?: string;
    }
  | {
      kind: 'hls';
      manifestUrl: string;
    }
  | {
      kind: 'frontier-fmp4';
      initUrl: string;
      variants: Array<FrontierVideoVariant & { segments: FrontierSegment[] }>;
    };

export type FrontierMedia = {
  type: 'image' | 'youtube' | 'video' | 'chart' | 'none';
  url?: string;
  /** Optional same-origin or trusted CORS-safe image surface used by the GPU path. */
  proxyUrl?: string;
  poster?: string;
  /** Optional same-origin/CORS-safe poster equivalent. */
  posterProxyUrl?: string;
  alt?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'wide';
  width?: number;
  height?: number;
  /** Derived only from the real source image; never synthetic editorial media. */
  blurHash?: string;
  averageColor?: string;
  duration?: number;
  streams?: FrontierVideoStream[];
};

export type FrontierMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type FrontierSportsCompetitor = {
  id?: string;
  name: string;
  shortName: string;
  abbreviation: string;
  score?: string;
  record?: string;
  homeAway?: 'home' | 'away';
  favorite?: boolean;
  winner?: boolean;
};

export type FrontierSportsGame = {
  id: string;
  date: string;
  status: string;
  detail?: string;
  live: boolean;
  completed: boolean;
  competitors: FrontierSportsCompetitor[];
  url?: string;
};

export type FrontierSportsStanding = {
  rank: number;
  team: string;
  abbreviation: string;
  record?: string;
  points?: string;
  favorite?: boolean;
};

export type FrontierSportsState =
  | {
      kind: 'scoreboard';
      league: string;
      leagueLabel: string;
      games: FrontierSportsGame[];
    }
  | {
      kind: 'standings';
      league: string;
      leagueLabel: string;
      standings: FrontierSportsStanding[];
    };

export type FrontierWatchSignal = {
  intentId: string;
  label: string;
  /** Normalized semantic match score in [0, 1]. */
  score: number;
  triggeredAt: number;
};

export type FrontierConvergenceMember = {
  id: string;
  title: string;
  url: string;
  sourceLabel: string;
  sourceKind: FrontierSourceKind;
  publishedAt: string;
  /** Bounded verbatim source evidence for optional local-only synthesis. */
  excerpt?: string;
};

export type FrontierConvergenceSignal = {
  /** Real corroborating source items collapsed behind the representative card. */
  members: FrontierConvergenceMember[];
  sourceKinds: FrontierSourceKind[];
  confidence: number;
  windowHours: number;
};

export type FrontierArtifact = {
  kind: 'formula' | 'benchmark' | 'repository' | 'release' | 'tracklist';
  label: string;
  value?: string;
  url?: string;
};

export type FrontierVelocitySignal = {
  concept: string;
  score: number;
  recentCount: number;
  baselineRate: number;
  sourceCount: number;
  detectedAt: number;
};

export type FrontierItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceLabel: string;
  sourceKind: FrontierSourceKind;
  publishedAt: string;
  lane: FrontierLaneId;
  tags: string[];
  authors?: string[];
  media?: FrontierMedia;
  metrics?: FrontierMetric[];
  sportsState?: FrontierSportsState;
  /** Optional user-facing action hint for source-hosted media that should open externally. */
  actionLabel?: string;
  baseScore: number;
  importance: number;
  novelty: number;
  quality: number;
  momentum: number;
  readMinutes?: number;
  why?: string;
  /** Phase 6 interruption metadata. Only explicit Watch Intents can set this. */
  highPriority?: boolean;
  watchSignal?: FrontierWatchSignal;
  /** Phase 7 synthesis metadata. Members always point to real source items. */
  convergence?: FrontierConvergenceSignal;
  artifacts?: FrontierArtifact[];
  velocitySignal?: FrontierVelocitySignal;
};

export type FrontierSourceStatus = {
  id: FrontierSourceKind;
  label: string;
  ok: boolean;
  count: number;
  message?: string;
};

export type FrontierFeedResponse = {
  generatedAt: string;
  items: FrontierItem[];
  sources: FrontierSourceStatus[];
};

export const FRONTIER_REACTIONS = [
  'up',
  'down',
  'love',
  'important',
  'surprise',
  'useful',
  'read',
  'known',
  'later',
  'meh',
  'hide',
] as const;

export type FrontierReaction = (typeof FRONTIER_REACTIONS)[number];

export type FrontierProfile = {
  laneAffinity: Record<FrontierLaneId, number>;
  topicAffinity: Record<string, number>;
  sourceAffinity: Record<string, number>;
  /** Slow co-interest memory. Keys are canonical sorted tag pairs joined by ` × `. */
  interestPairs: Record<string, number>;
  knownTopics: Record<string, number>;
  curiosity: number;
  meaningfulInteractions: number;
};

export type FrontierHistoryEntry = {
  item: FrontierItem;
  firstSeenAt: string;
  lastSeenAt: string;
  impressions: number;
  dwellMs?: number;
  openedAt?: string;
  reaction?: FrontierReaction;
  reactedAt?: string;
  resurfacedCount: number;
  rewarded: boolean;
};

export type FrontierCollection = {
  id: string;
  name: string;
  description?: string;
  itemIds: string[];
  createdAt: string;
};

export type FrontierGameState = {
  xp: number;
  streak: number;
  lastActiveDay?: string;
  completedQuestDays: Record<string, string[]>;
};

export type FrontierTimeBucket = 'morning' | 'afternoon' | 'evening' | 'late';
export type FrontierLayoutMode = 'desk' | 'feed';

export type FrontierBehaviorAggregate = {
  shown: number;
  dwelled: number;
  expanded: number;
  opened: number;
  saved: number;
  positive: number;
  negative: number;
  dwellMs: number;
  lastAt?: string;
};

export type FrontierBehaviorEvent = {
  kind: 'impression' | 'dwell' | 'expand' | 'open' | 'save' | 'positive' | 'negative';
  dwellMs?: number;
};

export type FrontierBehaviorSnapshot = {
  laneStats: Record<string, FrontierBehaviorAggregate>;
  sourceStats: Record<string, FrontierBehaviorAggregate>;
  topicStats: Record<string, FrontierBehaviorAggregate>;
  formatStats: Record<string, FrontierBehaviorAggregate>;
  contextStats: Record<string, FrontierBehaviorAggregate>;
  capturedAt: string;
};

export type FrontierBehaviorModel = {
  implicitLearning: boolean;
  sessions: number;
  sessionStartedAt?: string;
  lastActiveAt?: string;
  totalActiveMs: number;
  laneStats: Record<string, FrontierBehaviorAggregate>;
  sourceStats: Record<string, FrontierBehaviorAggregate>;
  topicStats: Record<string, FrontierBehaviorAggregate>;
  formatStats: Record<string, FrontierBehaviorAggregate>;
  timeStats: Record<string, FrontierBehaviorAggregate>;
  contextStats: Record<string, FrontierBehaviorAggregate>;
  layoutUses: Record<FrontierLayoutMode, number>;
  viewUses: Record<FrontierView, number>;
  rankingSnapshot?: FrontierBehaviorSnapshot;
};

export type FrontierPersistedState = {
  version: 4;
  profile: FrontierProfile;
  behavior: FrontierBehaviorModel;
  saved: Record<string, FrontierItem>;
  collections: FrontierCollection[];
  history: Record<string, FrontierHistoryEntry>;
  game: FrontierGameState;
};

export type FrontierQuest = {
  id: string;
  label: string;
  description: string;
  current: number;
  target: number;
  complete: boolean;
  xp: number;
};

export type FrontierView = 'today' | 'explore' | 'saved' | 'history' | 'map';
export type FrontierRealm = 'all' | 'learn' | 'play';
