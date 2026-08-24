export type FrontierLaneId =
  | 'must_know'
  | 'ml_data'
  | 'ai_frontier'
  | 'neuro_frontier'
  | 'methods'
  | 'builder_signal'
  | 'competitions'
  | 'broad_science'
  | 'creative_tech'
  | 'world_pulse'
  | 'premier_league'
  | 'world_soccer'
  | 'team_pulse'
  | 'sports'
  | 'gaming'
  | 'music'
  | 'internet_culture'
  | 'life'
  | 'wildcards';

export type FrontierSourceKind =
  | 'openalex'
  | 'arxiv'
  | 'huggingface'
  | 'paperswithcode'
  | 'biorxiv'
  | 'medrxiv'
  | 'openreview'
  | 'github'
  | 'hackernews'
  | 'lobsters'
  | 'nasa'
  | 'rss'
  | 'youtube'
  | 'vimeo'
  | 'football_data'
  | 'reddit'
  | 'steam'
  | 'social'
  | 'brave_web'
  | 'gdelt'
  | 'local';

export type FrontierMediaType = 'image' | 'video' | 'youtube';

export type FrontierMedia = {
  type: FrontierMediaType;
  url: string;
  alt?: string;
  poster?: string;
  width?: number;
  height?: number;
  /** Stable display geometry hint supplied by the adapter or media proxy. */
  aspectRatio?: 'wide' | 'landscape' | 'square' | 'portrait';
  /** Independent browser-native fallback used underneath GPU-backed imagery. */
  fallbackUrl?: string;
};

export type FrontierMetric = {
  label: string;
  value: string;
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
  media?: FrontierMedia;
  metrics?: FrontierMetric[];
  importance: number;
  quality: number;
  momentum: number;
  novelty: number;
  baseScore: number;
  why?: string;
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

export type FrontierGameState = {
  xp: number;
  streak: number;
  lastActiveDay?: string;
  completedQuestDays: Record<string, string[]>;
};

export type FrontierPersistedState = {
  version: 3;
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
