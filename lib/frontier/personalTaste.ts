import type { FrontierItem, FrontierLaneId } from './types';

export type FrontierPersonalTasteTopic = {
  id: string;
  label: string;
  aliases: readonly string[];
  tags: readonly string[];
  prior: number;
};

export type FrontierTasteDiscoveryQuery = {
  query: string;
  lane: FrontierLaneId;
  tags: readonly string[];
  video?: boolean;
};

/**
 * Explicit, inspectable owner taste prior.
 *
 * This is deliberately separate from learned behavior. It gives FRONTIER a
 * useful cold-start map based on the public site's subject matter and the
 * owner's repeatedly expressed interests, while reactions/dwell/opens remain
 * free to override it over time. We keep the weights modest so this acts as a
 * compass, not a cage.
 */
export const FRONTIER_PERSONAL_TASTE_TOPICS: readonly FrontierPersonalTasteTopic[] = [
  {
    id: 'nfl-analytics',
    label: 'NFL modeling + player state',
    aliases: ['nfl', 'player tracking', 'next gen stats', 'nflverse', 'nflfastr', 'play-by-play', 'epa', 'cpoe', 'win probability', 'fourth down'],
    tags: ['nfl', 'sports analytics', 'player tracking', 'play-by-play'],
    prior: 0.16,
  },
  {
    id: 'fantasy-football',
    label: 'fantasy football decision edges',
    aliases: ['fantasy football', 'superflex', '2qb', '2 qb', 'adp', 'value over replacement', 'vorp', 'route participation', 'target share', 'air yards', 'snap share', 'waiver wire'],
    tags: ['fantasy football', '2qb', 'superflex', 'player usage'],
    prior: 0.16,
  },
  {
    id: 'sports-data',
    label: 'sports data analysis',
    aliases: ['sports analytics', 'sports data', 'tracking data', 'expected points', 'expected value', 'expected goals', 'xg', 'xthreat', 'shot quality', 'player tracking'],
    tags: ['sports analytics', 'sports data', 'visualization'],
    prior: 0.14,
  },
  {
    id: 'scientific-visualization',
    label: 'scientific visualization tools',
    aliases: ['neuroglancer', 'napari', 'connectomics', 'brain atlas', 'volume rendering', 'volumetric visualization', 'microscopy visualization', 'scientific visualization', 'observable', 'plotly', 'd3.js', 'deck.gl'],
    tags: ['scientific visualization', 'neuroglancer', 'visualization tools'],
    prior: 0.16,
  },
  {
    id: 'neuro-data-systems',
    label: 'neuroscience data systems',
    aliases: ['datajoint', 'deeplabcut', 'facemap', 'spikeinterface', 'neuropixels', 'calcium imaging', 'two-photon', '2-photon', 'fiber photometry', 'electrophysiology', 'nwb', 'dandi'],
    tags: ['neuroscience', 'scientific software', 'multimodal data'],
    prior: 0.15,
  },
  {
    id: 'neuroai-bci',
    label: 'NeuroAI + neural interfaces',
    aliases: ['neuroai', 'neural decoding', 'brain computer interface', 'brain-computer interface', 'bci', 'neural representation', 'neural population dynamics', 'brain atlas', 'connectome'],
    tags: ['neuroai', 'neural decoding', 'bci'],
    prior: 0.14,
  },
  {
    id: 'ml-data-methods',
    label: 'ML, statistics + transferable methods',
    aliases: ['machine learning', 'scientific ml', 'causal inference', 'time series', 'feature engineering', 'calibration', 'representation learning', 'graph learning', 'active learning', 'uncertainty quantification'],
    tags: ['machine learning', 'data analysis', 'methods'],
    prior: 0.12,
  },
  {
    id: 'recommenders-agents',
    label: 'recommendation systems + agents',
    aliases: ['recommendation system', 'recommender system', 'contextual bandit', 'ranking system', 'retrieval system', 'agentic', 'coding agent', 'agent harness', 'tool calling'],
    tags: ['recommendation systems', 'agents', 'ranking'],
    prior: 0.12,
  },
  {
    id: 'computational-imaging',
    label: 'inverse problems + computational imaging',
    aliases: ['inverse problem', 'inverse problems', 'computational imaging', 'image reconstruction', 'tomography', 'deconvolution', 'compressed sensing', 'phase retrieval'],
    tags: ['inverse problems', 'computational imaging', 'reconstruction'],
    prior: 0.13,
  },
  {
    id: 'space-imaging',
    label: 'space imaging + astronomy',
    aliases: ['space imaging', 'astronomical imaging', 'astronomy', 'telescope imaging', 'radio interferometry', 'exoplanet imaging', 'adaptive optics'],
    tags: ['space imaging', 'astronomy', 'imaging'],
    prior: 0.12,
  },
  {
    id: 'scientific-software',
    label: 'open scientific software',
    aliases: ['scientific software', 'research software', 'open source', 'python library', 'data pipeline', 'reproducible pipeline', 'kubernetes', 'docker', 'workflow engine'],
    tags: ['open source', 'scientific software', 'builder signal'],
    prior: 0.11,
  },
  {
    id: 'competitions',
    label: 'competition modeling',
    aliases: ['kaggle', 'competition solution', 'leaderboard', 'ensemble', 'pseudo label', 'cross validation'],
    tags: ['kaggle', 'competition', 'modeling'],
    prior: 0.1,
  },
  {
    id: 'creative-compute',
    label: 'WebGPU, WebXR + game systems',
    aliases: ['webgpu', 'webxr', 'shader', 'procedural graphics', 'procedural generation', 'game design', 'combat design', 'physics engine', 'creative coding'],
    tags: ['creative tech', 'webgpu', 'game design'],
    prior: 0.1,
  },
  {
    id: 'favorite-games',
    label: 'metroidvania + systems-heavy games',
    aliases: ['metroidvania', 'roguelike', 'roguelite', 'hollow knight', 'silksong', 'elden ring', 'nine sols', 'dead cells', 'outer wilds'],
    tags: ['gaming', 'metroidvania', 'game design'],
    prior: 0.1,
  },
  {
    id: 'favorite-teams',
    label: 'favorite teams',
    aliases: ['new england patriots', 'patriots', 'golden state warriors', 'warriors', 'chelsea fc', 'chelsea', 'manchester city', 'man city'],
    tags: ['favorite teams', 'sports'],
    prior: 0.11,
  },
  {
    id: 'active-sports',
    label: 'climbing, MTB + motion sports',
    aliases: ['rock climbing', 'bouldering', 'mountain biking', 'mtb', 'downhill', 'enduro', 'skiing', 'freeski', 'skateboarding', 'longboarding'],
    tags: ['active sports', 'climbing', 'mountain biking'],
    prior: 0.1,
  },
  {
    id: 'bass-music',
    label: 'dubstep + bass music',
    aliases: ['dubstep', 'bass music', 'edm', 'illenium', 'subtronics', 'zeds dead', 'virtual riot', 'seven lions', 'skrillex'],
    tags: ['dubstep', 'bass music', 'music'],
    prior: 0.09,
  },
  {
    id: 'nature-dogs',
    label: 'huskies + nature rabbit holes',
    aliases: ['husky', 'huskies', 'dog', 'wildlife', 'nature photography', 'landscape photography'],
    tags: ['huskies', 'nature', 'photography'],
    prior: 0.07,
  },
];

/**
 * Stable discovery anchors. Adaptive behavior still supplies most of the focus
 * slots, but these ensure cold starts and sparse profiles search the parts of
 * the world the owner actually cares about instead of defaulting to generic AI.
 */
export const FRONTIER_DISCOVERY_SEEDS = [
  'NFL analytics',
  'fantasy football',
  'sports analytics',
  'Neuroglancer',
  'scientific visualization',
  'neural decoding',
  'computational imaging',
  'space imaging',
  'scientific software',
  'recommendation systems',
  'WebGPU',
  'game design',
] as const;

/** Targeted web/video searches used by the personal taste discovery mesh. */
export const FRONTIER_TASTE_DISCOVERY_QUERIES: readonly FrontierTasteDiscoveryQuery[] = [
  {
    query: 'NFL player tracking analytics EPA CPOE nflverse play-by-play',
    lane: 'sports',
    tags: ['nfl', 'sports analytics', 'player tracking'],
  },
  {
    query: 'fantasy football 2QB superflex projections ADP route participation target share analysis',
    lane: 'sports',
    tags: ['fantasy football', '2qb', 'superflex', 'player usage'],
  },
  {
    query: 'sports analytics visualization player tracking open source data project',
    lane: 'sports',
    tags: ['sports analytics', 'sports data', 'visualization'],
  },
  {
    query: 'Neuroglancer napari connectomics brain atlas scientific visualization release',
    lane: 'neuro_frontier',
    tags: ['neuroglancer', 'scientific visualization', 'connectomics'],
  },
  {
    query: 'Neuropixels calcium imaging DeepLabCut Facemap SpikeInterface DataJoint open source',
    lane: 'neuro_frontier',
    tags: ['neuroscience', 'scientific software', 'multimodal data'],
  },
  {
    query: 'inverse problems computational imaging tomography image reconstruction open source',
    lane: 'methods',
    tags: ['inverse problems', 'computational imaging', 'reconstruction'],
  },
  {
    query: 'space imaging astronomy telescope image reconstruction computational imaging',
    lane: 'broad_science',
    tags: ['space imaging', 'astronomy', 'computational imaging'],
  },
  {
    query: 'recommendation systems contextual bandits graph learning ranking open source',
    lane: 'methods',
    tags: ['recommendation systems', 'contextual bandit', 'graph learning'],
  },
  {
    query: 'WebGPU WebXR procedural graphics shaders game design open source',
    lane: 'creative_tech',
    tags: ['webgpu', 'webxr', 'game design'],
  },
  {
    query: 'site:youtube.com NFL film room analytics player tracking EPA breakdown',
    lane: 'sports',
    tags: ['nfl', 'sports analytics', 'watchable'],
    video: true,
  },
  {
    query: 'site:youtube.com Neuroglancer connectomics neuroscience visualization demo',
    lane: 'internet_culture',
    tags: ['neuroglancer', 'scientific visualization', 'watchable'],
    video: true,
  },
  {
    query: 'site:youtube.com mountain biking climbing skiing best runs highlights',
    lane: 'sports',
    tags: ['active sports', 'highlights', 'watchable'],
    video: true,
  },
  {
    query: 'site:youtube.com WebGPU shader procedural graphics game dev demo',
    lane: 'internet_culture',
    tags: ['webgpu', 'game design', 'watchable'],
    video: true,
  },
  {
    query: 'site:youtube.com dubstep bass music live set festival',
    lane: 'music',
    tags: ['dubstep', 'bass music', 'watchable'],
    video: true,
  },
];

function includesAlias(text: string, aliases: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

function itemText(item: FrontierItem): string {
  return [item.title, item.summary, item.sourceLabel, item.source, ...item.tags].filter(Boolean).join(' ').toLowerCase();
}

export function matchedPersonalTasteTopics(item: FrontierItem): FrontierPersonalTasteTopic[] {
  const text = itemText(item);
  return FRONTIER_PERSONAL_TASTE_TOPICS
    .filter((topic) => includesAlias(text, topic.aliases))
    .sort((a, b) => b.prior - a.prior);
}

export function personalTasteTags(text: string): string[] {
  const tags = FRONTIER_PERSONAL_TASTE_TOPICS.flatMap((topic) =>
    includesAlias(text, topic.aliases) ? [...topic.tags] : []
  );
  return Array.from(new Set(tags)).slice(0, 12);
}

export function personalTasteRankingPrior(item: FrontierItem): number {
  const matches = matchedPersonalTasteTopics(item);
  if (!matches.length) {
    // FRONTIER had drifted toward generic AI because the AI lane itself was a
    // strong signal. Keep important AI eligible, but require a small amount of
    // evidence that generic AI deserves a scarce personalized slot.
    if (item.lane === 'ai_frontier') return -0.045;
    if (item.lane === 'world_pulse') return -0.015;
    return 0;
  }

  const primary = matches[0].prior;
  const crossDomainBonus = matches.slice(1, 3).reduce((sum, topic) => sum + topic.prior * 0.16, 0);
  const watchableBonus = item.tags.includes('watchable') ? 0.012 : 0;
  return Math.min(0.19, primary + crossDomainBonus + watchableBonus);
}

export function matchesPersonalTasteTopic(item: FrontierItem, ids: readonly string[]): boolean {
  const allowed = new Set(ids);
  return matchedPersonalTasteTopics(item).some((topic) => allowed.has(topic.id));
}

export function strongestPersonalTasteLabel(item: FrontierItem): string | undefined {
  return matchedPersonalTasteTopics(item)[0]?.label;
}
