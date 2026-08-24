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
  { id: 'play', label: 'After Hours', glyph: '◉', description: 'Teams, highlights, active sports, games, anime + TV, music, and internet gold.' },
];

export const FRONTIER_LANES: FrontierLaneDefinition[] = [
  {
    id: 'must_know', label: 'Must Know Today', shortLabel: 'Must Know', glyph: '◎',
    description: 'Developments important enough to break through the personalization bubble.', weight: 1.2, realm: 'learn',
    keywords: ['breakthrough', 'major release', 'vulnerability', 'retraction', 'replication', 'standard', 'outage'],
  },
  {
    id: 'ml_data', label: 'ML + Data Lab', shortLabel: 'ML + Data', glyph: '▦',
    description: 'Machine learning, statistics, causal inference, visualization, and modern data tooling.', weight: 1.16, realm: 'learn',
    keywords: ['machine learning', 'data analysis', 'data science', 'statistics', 'causal', 'forecast', 'time series', 'visualization', 'feature engineering', 'polars', 'duckdb', 'pandas', 'benchmark', 'dataset', 'uncertainty quantification', 'scientific machine learning'],
  },
  {
    id: 'ai_frontier', label: 'AI Frontier', shortLabel: 'AI', glyph: '◇',
    description: 'Foundation models, agents, reasoning, evaluation, safety, and interpretability.', weight: 1.08, realm: 'learn',
    keywords: ['foundation model', 'agent', 'reasoning', 'multimodal', 'mechanistic interpretability', 'alignment', 'inference', 'quantization', 'evaluation', 'language model', 'llm', 'transformer', 'coding agent', 'tool calling'],
  },
  {
    id: 'neuro_frontier', label: 'Neuroscience + NeuroAI', shortLabel: 'NeuroAI', glyph: '⌁',
    description: 'Neural representation, BCI, decoding, multimodal neuroscience, brain atlases, and scientific neuro-data systems.', weight: 1.18, realm: 'learn',
    keywords: ['neuroscience', 'neural decoding', 'brain computer interface', 'brain-computer interface', 'bci', 'eeg', 'ecog', 'neuropixels', 'calcium imaging', 'two-photon', '2-photon', 'fiber photometry', 'neuroai', 'neural representation', 'neural population dynamics', 'brain imaging', 'fmri', 'connectomics', 'connectome', 'brain atlas', 'neuroglancer', 'napari', 'datajoint', 'deeplabcut', 'facemap', 'spikeinterface', 'nwb', 'dandi'],
  },
  {
    id: 'methods', label: 'Methods Worth Stealing', shortLabel: 'Methods', glyph: '∴',
    description: 'Algorithms and analytical ideas that can transfer into active projects.', weight: 1.14, realm: 'learn',
    keywords: ['ranking', 'retrieval', 'graph learning', 'contextual bandit', 'active learning', 'calibration', 'tracking', 'spatiotemporal', 'optimization', 'probability', 'information theory', 'representation learning', 'recommendation system', 'recommender system', 'inverse problem', 'inverse problems', 'computational imaging', 'image reconstruction', 'tomography', 'deconvolution', 'compressed sensing', 'phase retrieval'],
  },
  {
    id: 'builder_signal', label: 'Builder Signal', shortLabel: 'Open Source', glyph: '⌘',
    description: 'Open-source tools, research software, systems, infrastructure, visualization packages, and developer workflows.', weight: 1.11, realm: 'learn',
    keywords: ['open source', 'developer tool', 'library', 'framework', 'infrastructure', 'workflow', 'github', 'release', 'repository', 'research software', 'scientific software', 'visualization library', 'plotly', 'observable', 'd3.js', 'deck.gl'],
  },
  {
    id: 'competitions', label: 'Competition Edge', shortLabel: 'Competition', glyph: '△',
    description: 'Kaggle methods, winning solutions, feature engineering, ensembling, and leaderboard lessons.', weight: 1.04, realm: 'learn',
    keywords: ['kaggle', 'competition', 'winning solution', 'feature engineering', 'ensemble', 'pseudo label', 'leaderboard', 'cross validation'],
  },
  {
    id: 'broad_science', label: 'Science Frontier', shortLabel: 'Science', glyph: '✦',
    description: 'High-information discoveries across biology, physics, cognition, medicine, astronomy, and computer science.', weight: 1.02, realm: 'learn',
    keywords: ['biology', 'physics', 'cognition', 'scientific discovery', 'randomized trial', 'meta-analysis', 'replication', 'genomics', 'bioengineering', 'space', 'astronomy', 'space imaging', 'astronomical imaging', 'telescope imaging', 'adaptive optics', 'radio interferometry', 'medicine'],
  },
  {
    id: 'creative_tech', label: 'Project Design + Creative Tech', shortLabel: 'Project Design', glyph: '✺',
    description: 'WebXR, WebGPU, browser graphics, procedural worlds, game mechanics, interaction design, and prototypes worth remixing.', weight: 1.03, realm: 'learn',
    keywords: ['webxr', 'webgpu', 'shader', 'procedural', 'procedural graphics', 'procedural generation', 'game design', 'combat design', 'physics engine', 'browser graphics', 'spatial interaction', 'prototype', 'interaction design', 'creative coding', 'generative interface'],
  },
  {
    id: 'world_pulse', label: 'World + Tech Pulse', shortLabel: 'World Pulse', glyph: '◌',
    description: 'Consequential technology, platform, internet, business, policy, and culture shifts.', weight: 0.8, realm: 'learn',
    keywords: ['platform', 'internet', 'technology policy', 'regulation', 'security incident', 'infrastructure outage'],
  },
  {
    id: 'premier_league', label: 'Premier League', shortLabel: 'Premier League', glyph: '⚽',
    description: 'Fixtures, tactical shifts, injuries, transfers, analytics, and matchday context.', weight: 1.1, realm: 'play',
    keywords: ['premier league', 'arsenal', 'liverpool', 'manchester united', 'tottenham', 'newcastle', 'aston villa', 'xg', 'xthreat', 'pressing', 'set piece', 'transfer', 'football tactics'],
  },
  {
    id: 'world_soccer', label: 'World Soccer', shortLabel: 'World Soccer', glyph: '◉',
    description: 'Champions League, international football, player stories, skills, tactical innovation, scouting, and global transfers.', weight: 0.98, realm: 'play',
    keywords: ['champions league', 'world cup', 'la liga', 'bundesliga', 'serie a', 'football tactics', 'soccer analytics', 'soccer', 'football skills'],
  },
  {
    id: 'team_pulse', label: 'My Teams', shortLabel: 'My Teams', glyph: '◆',
    description: 'Patriots, Warriors, Chelsea, and Manchester City: results, roster moves, highlights, memes, and fan conversation.', weight: 1.18, realm: 'play',
    keywords: ['new england patriots', 'patriots', 'golden state warriors', 'dub nation', 'chelsea fc', 'chelsea football club', 'manchester city', 'man city', 'mcfc'],
  },
  {
    id: 'sports', label: 'Sports + Motion', shortLabel: 'Sports', glyph: '◍',
    description: 'NFL and fantasy edges, sports data analysis, the sports you do, pro circuits, athlete stories, and standout clips.', weight: 1.12, realm: 'play',
    keywords: ['rock climbing', 'sport climbing', 'bouldering', 'lead climbing', 'speed climbing', 'ifsc', 'mountain biking', 'mountain bike', 'mtb', 'downhill mtb', 'enduro mtb', 'crankworx', 'skiing', 'freeski', 'freeride', 'freeride world tour', 'skateboarding', 'skateboard', 'street skating', 'longboarding', 'longboard', 'ripstik', 'ripstick', 'caster board', 'ripsurf', 'ripsurfing', 'waveboard', 'nfl', 'nba', 'fantasy football', 'superflex', '2qb', '2 qb', 'adp', 'route participation', 'target share', 'air yards', 'snap share', 'sports analytics', 'sports data', 'player tracking', 'next gen stats', 'nflverse', 'nflfastr', 'play-by-play', 'epa', 'cpoe', 'expected points', 'expected value', 'win probability', 'fourth down', 'highlight', 'scoreboard', 'scores', 'standings'],
  },
  {
    id: 'gaming', label: 'Game Radar', shortLabel: 'Games', glyph: '▣',
    description: 'Metroidvanias, roguelikes, RPGs, co-op chaos, releases, patches, trailers, mods, and adjacent indie discoveries.', weight: 1.02, realm: 'play',
    keywords: ['elden ring', 'hollow knight', 'silksong', 'ender lilies', 'ender magnolia', 'nine sols', 'dead cells', 'celeste', 'tunic', 'rain world', 'outer wilds', 'metroidvania', 'roguelike', 'roguelite', 'indie game', 'steam', 'gameplay', 'dlc', 'patch notes', 'video game'],
  },
  {
    id: 'screen', label: 'Screen Orbit', shortLabel: 'Anime + TV', glyph: '◫',
    description: 'Story-rich anime, dark and animated comedy, clever satire, mystery, thrillers, and adjacent shows worth knowing about.', weight: 1.08, realm: 'play',
    keywords: ['anime', 'manga', 'crunchyroll', 'adult animation', 'animated comedy', 'dark comedy', 'black comedy', 'satire', 'absurdist comedy', 'psychological thriller', 'mystery series', 'dark fantasy', 'isekai', 'supernatural action', 'season renewal', 'series premiere', 'anime adaptation', 're zero', 'frieren', 'jujutsu kaisen', 'dandadan', 'solo leveling', 'bojack horseman', 'inside job', 'black mirror', 'arrested development'],
  },
  {
    id: 'music', label: 'Bass Orbit', shortLabel: 'Music', glyph: '♫',
    description: 'Dubstep, bass music, EDM releases, live sets, festival signal, remixes, and artists already in heavy rotation.', weight: 1.04, realm: 'play',
    keywords: ['dubstep', 'edm', 'bass music', 'illenium', 'virtual riot', 'seven lions', 'skrillex', 'subtronics', 'zeds dead', 'knock2', 'rl grime', 'griz', 'porter robinson', 'madeon', 'soundcloud', 'festival', 'remix'],
  },
  {
    id: 'internet_culture', label: 'Internet Gold', shortLabel: 'Internet Gold', glyph: '☺',
    description: 'The funniest, strangest, most shareable posts, threads, memes, clips, demos, and online culture worth your time.', weight: 0.88, realm: 'play',
    keywords: ['meme', 'funny', 'viral', 'reddit', 'shitpost', 'joke', 'thread', 'internet culture', 'clip', 'demo video'],
  },
  {
    id: 'life', label: 'Life + Outside', shortLabel: 'Outside', glyph: '↟',
    description: 'Huskies, animals, photography, nature, food, trails, and visual rabbit holes beyond the dedicated active-sports radar.', weight: 0.76, realm: 'play',
    keywords: ['husky', 'dog', 'animal', 'wildlife', 'photography', 'landscape', 'nature', 'food', 'trail'],
  },
  {
    id: 'wildcards', label: 'Productive Wildcards', shortLabel: 'Wildcards', glyph: '↝',
    description: 'Calculated weirdness: adjacent ideas with unusually high transfer or delight potential.', weight: 0.72, realm: 'play',
    keywords: ['unexpected', 'cross-disciplinary', 'unusual method', 'new interaction', 'strange', 'beautiful'],
  },
];

export const FRONTIER_LANE_MAP = Object.fromEntries(FRONTIER_LANES.map((lane) => [lane.id, lane])) as Record<FrontierLaneId, FrontierLaneDefinition>;

export function laneMatchesRealm(lane: FrontierLaneId, realm: FrontierRealm): boolean {
  return realm === 'all' || FRONTIER_LANE_MAP[lane].realm === realm;
}

export const FRONTIER_SOURCE_WEIGHTS: Record<string, number> = {
  openalex: 1.1,
  arxiv: 1.06,
  huggingface: 1.02,
  paperswithcode: 1.03,
  biorxiv: 1.08,
  medrxiv: 1.07,
  openreview: 1.08,
  github: 1.05,
  hackernews: 0.92,
  lobsters: 0.94,
  nasa: 1.08,
  rss: 0.92,
  youtube: 0.98,
  football_data: 1.14,
  sports_state: 1.12,
  reddit: 0.86,
  steam: 0.92,
  social: 0.78,
  brave_web: 1.0,
  gdelt: 0.96,
  local: 0.8,
};

export const FRONTIER_IMPORTANCE_TERMS = [
  'breakthrough', 'state of the art', 'benchmark', 'vulnerability', 'zero-day', 'retraction', 'replication',
  'randomized trial', 'systematic review', 'meta-analysis', 'open source', 'dataset', 'standard', 'release',
  'foundation model', 'mechanistic interpretability', 'neural decoding', 'brain computer interface', 'agent', 'inference',
  'nfl', 'fantasy football', 'injury', 'depth chart', 'player tracking', 'premier league', 'transfer', 'trade', 'signing',
  'release date', 'dlc', 'major update', 'world championship', 'final', 'record', 'season renewal', 'series premiere',
];

export const DEFAULT_COLLECTIONS: FrontierCollection[] = [
  { id: 'inbox', name: 'Saved', description: 'Everything worth returning to.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'deep-dives', name: 'Deep dives', description: 'Long-form reading and papers.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'project-fuel', name: 'Project fuel', description: 'Ideas worth transferring into something you are building.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'ml-data', name: 'ML + data', description: 'Methods, tools, benchmarks, and analysis ideas.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'football', name: 'Football', description: 'NFL/fantasy edges plus soccer tactics, analytics, and matchday context.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'clubhouse', name: 'Clubhouse', description: 'Favorite teams, active sports, highlights, fan threads, and motion rabbit holes.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'screen-orbit', name: 'Screen Orbit', description: 'Anime, animated comedy, dark humor, clever TV, and gripping story worlds.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
  { id: 'games-music', name: 'Games + bass', description: 'Game discoveries, releases, sets, tracks, and artists to revisit.', itemIds: [], createdAt: '2026-08-20T00:00:00.000Z' },
];

export function createInitialProfile(): FrontierProfile {
  return {
    laneAffinity: Object.fromEntries(FRONTIER_LANES.map((lane) => [lane.id, lane.weight - 1])) as Record<FrontierLaneId, number>,
    topicAffinity: {
      'new england patriots': 0.42,
      patriots: 0.36,
      nfl: 0.36,
      'fantasy football': 0.4,
      superflex: 0.32,
      '2qb': 0.32,
      'sports analytics': 0.36,
      'player tracking': 0.32,
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
      anime: 0.36,
      'fantasy progression': 0.34,
      'strong worldbuilding': 0.32,
      'dark action anime': 0.32,
      'mystery psychological': 0.28,
      'competition anime': 0.22,
      'witty anime': 0.28,
      'animated dark comedy': 0.36,
      'witty dark comedy': 0.36,
      'adult animation': 0.32,
      satire: 0.26,
      'psychological thriller': 0.26,
      'open source': 0.28,
      'scientific software': 0.3,
      'scientific visualization': 0.34,
      neuroglancer: 0.36,
      connectomics: 0.3,
      datajoint: 0.28,
      'neural decoding': 0.32,
      neuroai: 0.3,
      'inverse problems': 0.3,
      'computational imaging': 0.32,
      'space imaging': 0.28,
      'recommendation systems': 0.3,
      'contextual bandit': 0.24,
      webgpu: 0.26,
      webxr: 0.22,
      'game design': 0.24,
    },
    sourceAffinity: {},
    interestPairs: {},
    knownTopics: {},
    curiosity: 0.28,
    meaningfulInteractions: 0,
  };
}
