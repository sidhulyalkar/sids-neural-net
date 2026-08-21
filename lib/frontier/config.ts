import type { FrontierCollection, FrontierLaneId, FrontierProfile, FrontierRealm } from './types';

export type FrontierLaneDefinition = {
  id: FrontierLaneId;
  label: string;
  shortLabel: string;
  glyph: string;
  description: string;
  weight: number;
  realm: Exclude<FrontierRealm, 'all'>;
  keywords: string[];
};

export const FRONTIER_REALMS: Array<{
  id: FrontierRealm;
  label: string;
  glyph: string;
  description: string;
}> = [
  { id: 'all', label: 'For You', glyph: '✦', description: 'The useful + the fun, in one finite run.' },
  { id: 'learn', label: 'Brainfood', glyph: '⌁', description: 'Papers, code, methods, science, and project fuel.' },
  { id: 'play', label: 'After Hours', glyph: '◉', description: 'Teams, highlights, active sports, games, music, and internet gold.' },
];

export const FRONTIER_LANES: FrontierLaneDefinition[] = [
  {
    id: 'must_know',
    label: 'Must Know Today',
    shortLabel: 'Must Know',
    glyph: '◎',
    description: 'Developments important enough to break through the personalization bubble.',
    weight: 1.2,
    realm: 'learn',
    keywords: ['breakthrough', 'major release', 'vulnerability', 'retraction', 'replication', 'standard', 'outage'],
  },
  {
    id: 'ml_data',
    label: 'ML + Data Lab',
    shortLabel: 'ML + Data',
    glyph: '▦',
    description: 'Machine learning, statistics, causal inference, visualization, and modern data tooling.',
    weight: 1.16,
    realm: 'learn',
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
    realm: 'learn',
    keywords: [
      'foundation model', 'agent', 'reasoning', 'multimodal', 'mechanistic interpretability', 'alignment',
      'inference', 'quantization', 'evaluation', 'language model', 'llm', 'transformer',
    ],
  },
  {
    id: 'neuro_frontier',
    label: 'Neuroscience + NeuroAI',
    shortLabel: 'NeuroAI',
    glyph: '⌁',
    description: 'Neural representation, BCI, decoding, multimodal neuroscience, and brain data systems.',
    weight: 1.15,
    realm: 'learn',
    keywords: [
      'neuroscience', 'neural decoding', 'brain computer interface', 'bci', 'eeg', 'ecog', 'neuropixels',
      'calcium imaging', 'neuroai', 'neural representation', 'brain imaging', 'fmri',
    ],
  },
  {
    id: 'methods',
    label: 'Methods Worth Stealing',
    shortLabel: 'Methods',
    glyph: '∴',
    description: 'Algorithms and analytical ideas that can transfer into active projects.',
    weight: 1.1,
    realm: 'learn',
    keywords: [
      'ranking', 'retrieval', 'graph learning', 'contextual bandit', 'active learning', 'calibration',
      'tracking', 'spatiotemporal', 'optimization', 'probability', 'information theory', 'representation learning',
    ],
  },
  {
    id: 'builder_signal',
    label: 'Builder Signal',
    shortLabel: 'Open Source',
    glyph: '⌘',
    description: 'Open-source tools, research software, systems, infrastructure, and developer workflows.',
    weight: 1.08,
    realm: 'learn',
    keywords: ['open source', 'developer tool', 'library', 'framework', 'infrastructure', 'workflow', 'github', 'release', 'repository'],
  },
  {
    id: 'competitions',
    label: 'Competition Edge',
    shortLabel: 'Competition',
    glyph: '△',
    description: 'Kaggle methods, winning solutions, feature engineering, ensembling, and leaderboard lessons.',
    weight: 1.04,
    realm: 'learn',
    keywords: ['kaggle', 'competition', 'winning solution', 'feature engineering', 'ensemble', 'pseudo label', 'leaderboard'],
  },
  {
    id: 'broad_science',
    label: 'Science Frontier',
    shortLabel: 'Science',
    glyph: '✦',
    description: 'High-information discoveries across biology, physics, cognition, medicine, and computer science.',
    weight: 0.99,
    realm: 'learn',
    keywords: [
      'biology', 'physics', 'cognition', 'scientific discovery', 'randomized trial', 'meta-analysis', 'replication',
      'genomics', 'bioengineering', 'space', 'astronomy', 'medicine',
    ],
  },
  {
    id: 'creative_tech',
    label: 'Project Design + Creative Tech',
    shortLabel: 'Project Design',
    glyph: '✺',
    description: 'WebXR, browser graphics, procedural worlds, game mechanics, interaction design, and prototypes worth remixing.',
    weight: 0.98,
    realm: 'learn',
    keywords: [
      'webxr', 'webgpu', 'shader', 'procedural', 'game design', 'browser graphics', 'spatial interaction',
      'prototype', 'interaction design', 'creative coding', 'generative interface',
    ],
  },
  {
    id: 'world_pulse',
    label: 'World + Tech Pulse',
    shortLabel: 'World Pulse',
    glyph: '◌',
    description: 'Consequential technology, platform, internet, business, policy, and culture shifts.',
    weight: 0.82,
    realm: 'learn',
    keywords: ['platform', 'internet', 'technology policy', 'regulation', 'security incident', 'infrastructure outage'],
  },
  {
    id: 'premier_league',
    label: 'Premier League',
    shortLabel: 'Premier League',
    glyph: '⚽',
    description: 'Fixtures, tactical shifts, injuries, transfers, analytics, and matchday context.',
    weight: 1.1,
    realm: 'play',
    keywords: [
      'premier league', 'arsenal', 'liverpool', 'manchester united', 'tottenham', 'newcastle', 'aston villa',
      'xg', 'xthreat', 'pressing', 'set piece', 'transfer', 'football tactics',
    ],
  },
  {
    id: 'world_soccer',
    label: 'World Soccer',
    shortLabel: 'World Soccer',
    glyph: '◉',
    description: 'Champions League, international football, player stories, skills, tactical innovation, scouting, and global transfers.',
    weight: 0.98,
    realm: 'play',
    keywords: ['champions league', 'world cup', 'la liga', 'bundesliga', 'serie a', 'football tactics', 'soccer analytics', 'soccer', 'football skills'],
  },
  {
    id: 'team_pulse',
    label: 'My Teams',
    shortLabel: 'My Teams',
    glyph: '◆',
    description: 'Patriots, Warriors, Chelsea, and Manchester City: results, roster moves, highlights, memes, and fan conversation.',
    weight: 1.18,
    realm: 'play',
    keywords: [
      'new england patriots', 'patriots', 'golden state warriors', 'dub nation', 'chelsea fc', 'chelsea football club',
      'manchester city', 'man city', 'mcfc',
    ],
  },
  {
    id: 'sports',
    label: 'Sports + Motion',
    shortLabel: 'Sports',
    glyph: '◍',
    description: 'The sports you do and are learning, plus pro circuits, athlete stories, standout clips, NFL/NBA, fantasy, and worthwhile sports signal.',
    weight: 1.04,
    realm: 'play',
    keywords: [
      'rock climbing', 'sport climbing', 'bouldering', 'lead climbing', 'speed climbing', 'ifsc',
      'mountain biking', 'mountain bike', 'mtb', 'downhill mtb', 'enduro mtb', 'crankworx',
      'skiing', 'freeski', 'freeride', 'freeride world tour', 'skateboarding', 'skateboard', 'street skating',
      'longboarding', 'longboard', 'ripstik', 'ripstick', 'caster board', 'ripsurf', 'ripsurfing', 'waveboard',
      'nfl', 'nba', 'fantasy football', 'sports analytics', 'player tracking', 'expected value', 'highlight',
    ],
  },
  {
    id: 'gaming',
    label: 'Game Radar',
    shortLabel: 'Games',
    glyph: '▣',
    description: 'Metroidvanias, roguelikes, RPGs, co-op chaos, releases, patches, trailers, mods, and adjacent indie discoveries.',
    weight: 1.02,
    realm: 'play',
    keywords: [
      'elden ring', 'hollow knight', 'silksong', 'ender lilies', 'ender magnolia', 'nine sols', 'dead cells',
      'celeste', 'tunic', 'rain world', 'outer wilds', 'metroidvania', 'roguelike', 'roguelite', 'indie game',
      'steam', 'gameplay', 'dlc', 'patch notes', 'video game',
    ],
  },
  {
    id: 'music',
    label: 'Bass Orbit',
    shortLabel: 'Music',
    glyph: '♫',
    description: 'Dubstep, bass music, EDM releases, live sets, festival signal, remixes, and artists already in heavy rotation.',
    weight: 1.04,
    realm: 'play',
    keywords: [
      'dubstep', 'edm', 'bass music', 'illenium', 'virtual riot', 'seven lions', 'skrillex', 'subtronics',
      'zeds dead', 'knock2', 'rl grime', 'griz', 'porter robinson', 'madeon', 'soundcloud', 'festival', 'remix',
    ],
  },
  {
    id: 'internet_culture',
    label: 'Internet Gold',
    shortLabel: 'Internet Gold',
    glyph: '☺',
    description: 'The funniest, strangest, most shareable posts, threads, memes, clips, and online culture worth your time.',
    weight: 0.88,
    realm: 'play',
    keywords: ['meme', 'funny', 'viral', 'reddit', 'shitpost', 'joke', 'thread', 'internet culture', 'clip'],
  },
  {
    id: 'life',
    label: 'Life + Outside',
    shortLabel: 'Outside',
    glyph: '↟',
    description: 'Huskies, animals, photography, nature, food, trails, and visual rabbit holes beyond the dedicated active-sports radar.',
    weight: 0.76,
    realm: 'play',
    keywords: [
      'husky', 'dog', 'animal', 'wildlife', 'photography', 'landscape', 'nature', 'food', 'trail',
    ],
  },
  {
    id: 'wildcards',
    label: 'Productive Wildcards',
    shortLabel: 'Wildcards',
    glyph: '↝',
    description: 'Calculated weirdness: adjacent ideas with unusually high transfer or delight potential.',
    weight: 0.72,
    realm: 'play',
    keywords: ['unexpected', 'cross-disciplinary', 'unusual method', 'new interaction', 'strange', 'beautiful'],
  },
];

export const FRONTIER_LANE_MAP = Object.fromEntries(
  FRONTIER_LANES.map((lane) => [lane.id, lane])
) as Record<FrontierLaneId, FrontierLaneDefinition>;

export function laneMatchesRealm(lane: FrontierLaneId, realm: FrontierRealm): boolean {
  return realm === 'all' || FRONTIER_LANE_MAP[lane].realm === realm;
}

export const FRONTIER_SOURCE_WEIGHTS: Record<string, number> = {
  openalex: 1.1,
  github: 1.05,
  hackernews: 0.92,
  rss: 0.92,
  youtube: 0.98,
  football_data: 1.14,
  reddit: 0.86,
  steam: 0.92,
  social: 0.78,
  brave_web: 1.0,
  local: 0.8,
};

export const FRONTIER_IMPORTANCE_TERMS = [
  'breakthrough', 'state of the art', 'benchmark', 'vulnerability', 'zero-day', 'retraction',
  'replication', 'randomized trial', 'systematic review', 'meta-analysis', 'open source', 'dataset',
  'standard', 'release', 'foundation model', 'mechanistic interpretability', 'neural decoding',
  'brain computer interface', 'agent', 'inference', 'premier league', 'injury', 'transfer', 'trade',
  'signing', 'release date', 'dlc', 'major update', 'world championship', 'final', 'record',
];

export const DEFAULT_COLLECTIONS: FrontierCollection[] = [
  { id: 'inbox', name: 'Saved', description: 'Everything worth returning to.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'deep-dives', name: 'Deep dives', description: 'Long-form reading and papers.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'project-fuel', name: 'Project fuel', description: 'Ideas worth transferring into something you are building.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'ml-data', name: 'ML + data', description: 'Methods, tools, benchmarks, and analysis ideas.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'football', name: 'Football', description: 'Tactics, analytics, transfers, and matchday context.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'clubhouse', name: 'Clubhouse', description: 'Favorite teams, active sports, highlights, fan threads, and motion rabbit holes.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'games-music', name: 'Games + bass', description: 'Game discoveries, releases, sets, tracks, and artists to revisit.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
];

export function createInitialProfile(): FrontierProfile {
  return {
    laneAffinity: Object.fromEntries(
      FRONTIER_LANES.map((lane) => [lane.id, lane.weight - 1])
    ) as Record<FrontierLaneId, number>,
    topicAffinity: {
      'new england patriots': 0.34,
      patriots: 0.28,
      'golden state warriors': 0.34,
      warriors: 0.28,
      chelsea: 0.38,
      'manchester city': 0.34,
      soccer: 0.3,
      'rock climbing': 0.34,
      climbing: 0.3,
      bouldering: 0.3,
      'mountain biking': 0.36,
      mtb: 0.3,
      skiing: 0.3,
      skateboarding: 0.28,
      longboarding: 0.26,
      ripstik: 0.24,
      ripsurf: 0.24,
      dubstep: 0.34,
      'bass music': 0.28,
      metroidvania: 0.28,
      'open source': 0.2,
      'neural decoding': 0.2,
      neuroai: 0.2,
    },
    sourceAffinity: {},
    knownTopics: {},
    curiosity: 0.28,
    meaningfulInteractions: 0,
  };
}
