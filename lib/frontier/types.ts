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
  | 'rss'
  | 'youtube'
  | 'football_data'
  | 'reddit'
  | 'steam'
  | 'social'
  | 'brave_web'
  | 'local';

export type FrontierMedia = {
  type: 'image' | 'youtube' | 'video' | 'chart' | 'none';
  url?: string;
  poster?: string;
  alt?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'wide';
};

export type FrontierMetric = {
  label: string;
  value: string;
  detail?: string;
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

export type FrontierPersistedState = {
  version: 1;
  profile: FrontierProfile;
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
