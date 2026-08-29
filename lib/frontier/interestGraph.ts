import { matchedPersonalTasteTopics } from './personalTaste';
import type { FrontierItem } from './types';

export type FrontierInterestDomain =
  | 'sports-analysis'
  | 'motion-sports'
  | 'science-engineering'
  | 'creative-systems'
  | 'culture'
  | 'nature';

export type FrontierConnectionFacet =
  | 'open-source'
  | 'analysis'
  | 'motion-science'
  | 'telemetry'
  | 'visualization'
  | 'simulation'
  | 'technique';

export type FrontierInterestConnection = {
  score: number;
  confidence: number;
  topicIds: string[];
  topicLabels: string[];
  domains: FrontierInterestDomain[];
  facets: FrontierConnectionFacet[];
  explanation?: string;
};

type FrontierGraphIdentity = {
  id: string;
  label: string;
  patterns: readonly RegExp[];
};

const TOPIC_DOMAIN: Record<string, FrontierInterestDomain> = {
  'nfl-analytics': 'sports-analysis',
  'fantasy-football': 'sports-analysis',
  'sports-data': 'sports-analysis',
  'favorite-teams': 'sports-analysis',
  'active-sports': 'motion-sports',
  'rock-climbing': 'motion-sports',
  'mountain-biking': 'motion-sports',
  skiing: 'motion-sports',
  'disc-golf': 'motion-sports',
  'skate-progression': 'motion-sports',
  'freestyle-scooter': 'motion-sports',
  'scientific-visualization': 'science-engineering',
  'neuro-data-systems': 'science-engineering',
  'neuroai-bci': 'science-engineering',
  'neuro-foundation-models': 'science-engineering',
  'mechanistic-interpretability': 'science-engineering',
  'ml-data-methods': 'science-engineering',
  'recommenders-agents': 'science-engineering',
  'computational-imaging': 'science-engineering',
  'space-imaging': 'science-engineering',
  'earth-observation': 'science-engineering',
  'scientific-software': 'science-engineering',
  competitions: 'science-engineering',
  'creative-compute': 'creative-systems',
  'favorite-games': 'creative-systems',
  'screen-orbit': 'culture',
  'bass-music': 'culture',
  'nature-dogs': 'nature',
};

// Some broad cold-start topics intentionally remain grouped in personalTaste.ts
// so they do not receive more ranking authority merely because the taxonomy is
// more detailed. The connection graph can still preserve identity inside that
// broad family, which is what lets MTB telemetry and climbing biomechanics learn
// separately while sharing weaker motion-sports transfer.
const GRAPH_IDENTITIES: readonly FrontierGraphIdentity[] = [
  {
    id: 'rock-climbing',
    label: 'rock climbing',
    patterns: [/\brock climb(?:ing|er|ers)?\b/i, /\bbouldering\b/i],
  },
  {
    id: 'mountain-biking',
    label: 'mountain biking',
    patterns: [/\bmountain bik(?:e|es|ing|er|ers)\b/i, /\bmtb\b/i],
  },
  {
    id: 'skiing',
    label: 'skiing',
    patterns: [/\bskiing\b/i, /\bfreeski(?:ing)?\b/i, /\bbackcountry ski(?:ing)?\b/i],
  },
];

const FACET_PATTERNS: ReadonlyArray<{
  id: FrontierConnectionFacet;
  label: string;
  patterns: readonly string[];
}> = [
  {
    id: 'open-source',
    label: 'open-source tooling',
    patterns: ['open source', 'open-source', 'github', 'repository', 'codebase', 'library', 'toolkit', 'sdk', 'package'],
  },
  {
    id: 'analysis',
    label: 'analysis + modeling',
    patterns: ['analysis', 'analytics', 'modeling', 'modelling', 'benchmark', 'dataset', 'statistics', 'tracking data', 'data analysis'],
  },
  {
    id: 'motion-science',
    label: 'motion science',
    patterns: ['biomechanics', 'kinematics', 'pose estimation', 'computer vision', 'motion capture', 'trajectory analysis', 'form analysis'],
  },
  {
    id: 'telemetry',
    label: 'telemetry',
    patterns: ['telemetry', 'gps', 'gpx', 'imu', 'sensor data', 'wearable data', 'ride data', 'trail data'],
  },
  {
    id: 'visualization',
    label: 'visualization',
    patterns: ['visualization', 'visualisation', 'dashboard', 'interactive map', 'plotting', 'rendering', 'visual analytics'],
  },
  {
    id: 'simulation',
    label: 'simulation + physics',
    patterns: ['simulation', 'physics engine', 'flight model', 'trajectory model', 'procedural generation', 'game engine'],
  },
  {
    id: 'technique',
    label: 'technique progression',
    patterns: ['tutorial', 'technique', 'progression', 'drill', 'form breakdown', 'skill progression', 'training analysis'],
  },
];

const METHOD_FACETS = new Set<FrontierConnectionFacet>([
  'open-source',
  'analysis',
  'motion-science',
  'telemetry',
  'visualization',
  'simulation',
]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function contentText(item: FrontierItem): string {
  return [item.title, item.summary, ...item.tags].filter(Boolean).join(' ').toLowerCase();
}

function matchedGraphIdentities(item: FrontierItem): FrontierGraphIdentity[] {
  const text = contentText(item);
  return GRAPH_IDENTITIES.filter((identity) => identity.patterns.some((pattern) => pattern.test(text)));
}

function matchedFacets(item: FrontierItem): FrontierConnectionFacet[] {
  const text = contentText(item);
  const facets = FACET_PATTERNS
    .filter((facet) => facet.patterns.some((pattern) => text.includes(pattern)))
    .map((facet) => facet.id);

  if ((item.sourceKind === 'github' || item.sourceKind === 'paperswithcode') && !facets.includes('open-source')) {
    facets.push('open-source');
  }
  return facets;
}

function facetLabel(facet: FrontierConnectionFacet): string {
  return FACET_PATTERNS.find((entry) => entry.id === facet)?.label ?? facet;
}

/**
 * A connection is deliberately stricter than a topic match. FRONTIER only
 * earns a bridge bonus when one item either spans distinct owner-interest
 * domains or applies a transferable method to a concrete interest. This keeps
 * two synonyms from masquerading as interdisciplinary relevance.
 */
export function personalInterestConnection(item: FrontierItem): FrontierInterestConnection {
  const tasteTopics = matchedPersonalTasteTopics(item);
  const graphIdentities = matchedGraphIdentities(item);
  const topicIds = Array.from(new Set([
    ...tasteTopics.map((topic) => topic.id),
    ...graphIdentities.map((identity) => identity.id),
  ]));
  const topicLabels = Array.from(new Set([
    ...tasteTopics.map((topic) => topic.label),
    ...graphIdentities.map((identity) => identity.label),
  ]));
  const domains = Array.from(new Set(topicIds.flatMap((id) => TOPIC_DOMAIN[id] ? [TOPIC_DOMAIN[id]] : [])));
  const facets = matchedFacets(item);
  const methodFacets = facets.filter((facet) => METHOD_FACETS.has(facet));
  const domainSet = new Set(domains);

  let score = 0;
  if (domains.length >= 2) score += 0.045 + Math.min(0.028, (domains.length - 2) * 0.014);
  if (topicIds.length >= 3) score += 0.01;

  // Vertical bridges are especially useful: a concrete hobby plus a method the
  // owner can build with, inspect, or transfer into another project.
  if (domainSet.has('motion-sports') && methodFacets.length) score += 0.042;
  if (domainSet.has('creative-systems') && methodFacets.length) score += 0.03;
  if (domainSet.has('sports-analysis') && (facets.includes('open-source') || facets.includes('visualization'))) score += 0.025;
  if (domainSet.has('science-engineering') && domainSet.has('creative-systems')) score += 0.018;

  if (
    item.sourceKind === 'github'
    && (domainSet.has('motion-sports') || domainSet.has('sports-analysis') || domainSet.has('creative-systems'))
  ) score += 0.018;

  score = clamp(score, 0, 0.115);
  const confidence = score > 0
    ? clamp(0.42 + Math.min(0.24, topicIds.length * 0.07) + Math.min(0.22, facets.length * 0.055), 0, 0.94)
    : 0;

  let explanation: string | undefined;
  if (score >= 0.04 && topicLabels.length >= 2 && domains.length >= 2) {
    const method = methodFacets[0] ? ` through ${facetLabel(methodFacets[0])}` : '';
    explanation = `Connects your ${topicLabels[0]} and ${topicLabels[1]} interests${method}.`;
  } else if (score >= 0.04 && topicLabels.length && methodFacets.length) {
    explanation = `Applies ${facetLabel(methodFacets[0])} to your ${topicLabels[0]} interest.`;
  }

  return { score, confidence, topicIds, topicLabels, domains, facets, explanation };
}
