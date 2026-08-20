import type { FrontierCollection, FrontierLaneId, FrontierProfile } from './types';

export type FrontierLaneDefinition = {
  id: FrontierLaneId;
  label: string;
  shortLabel: string;
  glyph: string;
  description: string;
  weight: number;
  keywords: string[];
};

export const FRONTIER_LANES: FrontierLaneDefinition[] = [
  {
    id: 'must_know',
    label: 'Must Know Today',
    shortLabel: 'Must Know',
    glyph: '◎',
    description: 'Developments important enough to break through the personalization bubble.',
    weight: 1.2,
    keywords: ['breakthrough', 'major release', 'vulnerability', 'retraction', 'replication', 'standard', 'outage'],
  },
  {
    id: 'premier_league',
    label: 'Premier League',
    shortLabel: 'Premier League',
    glyph: '⚽',
    description: 'Fixtures, tactical shifts, injuries, transfers, analytics, and matchday context.',
    weight: 1.16,
    keywords: [
      'premier league', 'arsenal', 'liverpool', 'manchester city', 'manchester united', 'chelsea',
      'tottenham', 'newcastle', 'aston villa', 'xg', 'xthreat', 'pressing', 'set piece', 'transfer',
    ],
  },
  {
    id: 'ml_data',
    label: 'ML + Data Lab',
    shortLabel: 'ML + Data',
    glyph: '▦',
    description: 'Machine learning, statistics, causal inference, visualization, and modern data tooling.',
    weight: 1.16,
    keywords: [
      'machine learning', 'data analysis', 'data science', 'statistics', 'causal', 'forecast', 'time series',
      'visualization', 'feature engineering', 'polars', 'duckdb', 'pandas', 'benchmark', 'dataset',
    ],
  },
  {
    id: 'ai_frontier',
    label: 'AI Frontier',
    shortLabel: 'AI',
    glyph: '◇',
    description: 'Foundation models, agents, reasoning, evaluation, safety, and interpretability.',
    weight: 1.14,
    keywords: [
      'foundation model', 'agent', 'reasoning', 'multimodal', 'mechanistic interpretability', 'alignment',
      'inference', 'quantization', 'evaluation', 'language model', 'llm',
    ],
  },
  {
    id: 'neuro_frontier',
    label: 'Neuroscience + NeuroAI',
    shortLabel: 'NeuroAI',
    glyph: '⌁',
    description: 'Neural representation, BCI, decoding, multimodal neuroscience, and brain data systems.',
    weight: 1.15,
    keywords: [
      'neuroscience', 'neural decoding', 'brain computer interface', 'bci', 'eeg', 'ecog', 'neuropixels',
      'calcium imaging', 'neuroai', 'neural representation',
    ],
  },
  {
    id: 'methods',
    label: 'Methods Worth Stealing',
    shortLabel: 'Methods',
    glyph: '∴',
    description: 'Algorithms and analytical ideas that can transfer into active projects.',
    weight: 1.1,
    keywords: [
      'ranking', 'retrieval', 'graph learning', 'contextual bandit', 'active learning', 'calibration',
      'tracking', 'spatiotemporal', 'optimization', 'probability', 'information theory',
    ],
  },
  {
    id: 'builder_signal',
    label: 'Builder Signal',
    shortLabel: 'Builder',
    glyph: '⌘',
    description: 'Open-source tools, research software, systems, infrastructure, and developer workflows.',
    weight: 1.08,
    keywords: ['open source', 'developer tool', 'library', 'framework', 'infrastructure', 'workflow', 'github', 'release'],
  },
  {
    id: 'competitions',
    label: 'Competition Edge',
    shortLabel: 'Competition',
    glyph: '△',
    description: 'Kaggle methods, winning solutions, feature engineering, ensembling, and leaderboard lessons.',
    weight: 1.04,
    keywords: ['kaggle', 'competition', 'winning solution', 'feature engineering', 'ensemble', 'pseudo label', 'leaderboard'],
  },
  {
    id: 'world_soccer',
    label: 'World Soccer',
    shortLabel: 'World Soccer',
    glyph: '◉',
    description: 'Champions League, international football, tactical innovation, scouting, and global transfers.',
    weight: 0.94,
    keywords: ['champions league', 'world cup', 'la liga', 'bundesliga', 'serie a', 'football tactics', 'soccer analytics'],
  },
  {
    id: 'broad_science',
    label: 'Science Frontier',
    shortLabel: 'Science',
    glyph: '✦',
    description: 'High-information discoveries across biology, physics, cognition, and computer science.',
    weight: 0.98,
    keywords: ['biology', 'physics', 'cognition', 'scientific discovery', 'randomized trial', 'meta-analysis', 'replication'],
  },
  {
    id: 'creative_tech',
    label: 'Creative Technology',
    shortLabel: 'Creative Tech',
    glyph: '✺',
    description: 'WebXR, browser graphics, procedural worlds, game mechanics, and interaction design.',
    weight: 0.95,
    keywords: ['webxr', 'webgpu', 'shader', 'procedural', 'game design', 'indie game', 'browser graphics', 'spatial interaction'],
  },
  {
    id: 'world_pulse',
    label: 'World + Internet Pulse',
    shortLabel: 'World Pulse',
    glyph: '◌',
    description: 'Consequential technology, platform, internet, business, policy, and culture shifts.',
    weight: 0.82,
    keywords: ['platform', 'internet', 'technology policy', 'regulation', 'security incident', 'infrastructure outage'],
  },
  {
    id: 'sports',
    label: 'Sports + Fantasy Signal',
    shortLabel: 'Sports',
    glyph: '◍',
    description: 'Quantitative sports ideas, NFL developments, fantasy strategy, and tracking data.',
    weight: 0.76,
    keywords: ['nfl', 'fantasy football', 'sports analytics', 'player tracking', 'expected value'],
  },
  {
    id: 'wildcards',
    label: 'Productive Wildcards',
    shortLabel: 'Wildcards',
    glyph: '↝',
    description: 'Calculated weirdness: adjacent ideas with unusually high transfer potential.',
    weight: 0.72,
    keywords: ['unexpected', 'cross-disciplinary', 'unusual method', 'new interaction', 'strange', 'beautiful'],
  },
];

export const FRONTIER_LANE_MAP = Object.fromEntries(
  FRONTIER_LANES.map((lane) => [lane.id, lane])
) as Record<FrontierLaneId, FrontierLaneDefinition>;

export const FRONTIER_SOURCE_WEIGHTS: Record<string, number> = {
  openalex: 1.1,
  github: 1.05,
  hackernews: 0.92,
  rss: 0.92,
  youtube: 0.98,
  football_data: 1.14,
  brave_web: 1.0,
  local: 0.8,
};

export const FRONTIER_IMPORTANCE_TERMS = [
  'breakthrough', 'state of the art', 'benchmark', 'vulnerability', 'zero-day', 'retraction',
  'replication', 'randomized trial', 'systematic review', 'meta-analysis', 'open source', 'dataset',
  'standard', 'release', 'foundation model', 'mechanistic interpretability', 'neural decoding',
  'brain computer interface', 'agent', 'inference', 'premier league', 'injury', 'transfer',
];

export const DEFAULT_COLLECTIONS: FrontierCollection[] = [
  { id: 'inbox', name: 'Saved', description: 'Everything worth returning to.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'deep-dives', name: 'Deep dives', description: 'Long-form reading and papers.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'project-fuel', name: 'Project fuel', description: 'Ideas worth transferring into something you are building.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'ml-data', name: 'ML + data', description: 'Methods, tools, benchmarks, and analysis ideas.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'football', name: 'Football', description: 'Tactics, analytics, transfers, and matchday context.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
];

export function createInitialProfile(): FrontierProfile {
  return {
    laneAffinity: Object.fromEntries(
      FRONTIER_LANES.map((lane) => [lane.id, lane.weight - 1])
    ) as Record<FrontierLaneId, number>,
    topicAffinity: {},
    sourceAffinity: {},
    knownTopics: {},
    curiosity: 0.24,
    meaningfulInteractions: 0,
  };
}
