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
  /** Optional same-origin or trusted CORS-safe image surface used by the GPU path. */
  url?: string;
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

export type FrontierRankingSnapshot = {
  topicStats: Record<string, FrontierBehaviorAggregate>;
  laneStats: Record<string, FrontierBehaviorAggregate>;
  sourceStats: Record<string, FrontierBehaviorAggregate>;
  sourceKindStats: Record<string, FrontierBehaviorAggregate>;
  authorStats: Record<string, FrontierBehaviorAggregate>;
  timeStats: Record<string, FrontierBehaviorAggregate>;
  layoutStats: Record<string, FrontierBehaviorAggregate>;
  sectionStats: Record<string, FrontierBehaviorAggregate>;
};

export type FrontierBehaviorModel = {
  sessions: number;
  lastSessionAt?: string;
  lastActiveAt?: string;
  sessionStartedAt?: string;
  sessionDepth: number;
  longestSessionDepth: number;
  totalScrollDepth: number;
  implicitLearning: boolean;
  rankingSnapshot: FrontierRankingSnapshot;
  topicStats: Record<string, FrontierBehaviorAggregate>;
};

export type FrontierStoreState = {
  version: number;
  hydrated: boolean;
  profile: FrontierProfile;
  history: Record<string, FrontierHistoryEntry>;
  saved: Record<string, FrontierItem>;
  collections: FrontierCollection[];
  game: FrontierGameState;
  behavior: FrontierBehaviorModel;
};

export type FrontierRealm = 'all' | 'learn' | 'play';
export type FrontierView = 'today' | 'explore' | 'saved' | 'history' | 'map';
