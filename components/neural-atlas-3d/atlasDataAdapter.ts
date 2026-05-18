import graphData from '@/data/generated/neural-graph.json';
import type { NeuralGraph, NeuralNode } from '@/lib/data/schemas';
import type { AtlasGraph, AtlasMorphology, AtlasNode, AtlasVec3 } from './atlasTypes';
import { ATLAS_LAYOUT, CATEGORY_COLORS } from './visualConstants';

type CategoryDefinition = {
  id: string;
  label: string;
  route: string;
  summary: string;
  keywords: string[];
  morphology: AtlasMorphology;
};

const generatedGraph = graphData as NeuralGraph;

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'about',
    label: 'About / Identity',
    route: '/about',
    summary: 'Identity, research instincts, and the connective tissue behind the work.',
    keywords: ['personal', 'life', 'dolby', 'coeval'],
    morphology: 'soma',
  },
  {
    id: 'professional',
    label: 'Professional Work',
    route: '/case-studies',
    summary: 'Research engineering, lab infrastructure, and production scientific systems.',
    keywords: ['datajoint', 'harvard', 'sabatini', 'allen', 'neatlabs', 'workflow'],
    morphology: 'pyramidal',
  },
  {
    id: 'projects',
    label: 'Projects / Code',
    route: '/projects',
    summary: 'Neural data infrastructure, applied AI systems, and prototypes.',
    keywords: ['neuros', 'neuroforge', 'bci', 'python', 'typescript', 'pipeline'],
    morphology: 'pyramidal',
  },
  {
    id: 'publications',
    label: 'Publications / Papers',
    route: '/publications',
    summary: 'Peer-reviewed research artifacts and scientific outputs.',
    keywords: ['publication', 'neuroscience', 'electrophysiology', 'paper'],
    morphology: 'interneuron',
  },
  {
    id: 'ideas',
    label: 'Research Ideas',
    route: '/ideas',
    summary: 'Foundation models, interpretability, BCI systems, and scientific tools.',
    keywords: ['foundation', 'mechanistic', 'interpretability', 'bci', 'kalman'],
    morphology: 'stellate',
  },
  {
    id: 'personal',
    label: 'Personal Interests',
    route: '/life',
    summary: 'Outdoor rhythm, animals, music, motion, and life outside the lab.',
    keywords: ['personal', 'life', 'woof', 'petpath', 'shasta'],
    morphology: 'glial',
  },
  {
    id: 'photography',
    label: 'Photography / Field Notes',
    route: '/photography',
    summary: 'Field notes, images, and visual attention outside the lab.',
    keywords: ['photo', 'field', 'shasta', 'creative'],
    morphology: 'glial',
  },
  {
    id: 'contact',
    label: 'Contact',
    route: '/contact',
    summary: 'Collaborations, research conversations, and ambitious prototypes.',
    keywords: ['neuros', 'neuroforge', 'datajoint', 'coeval'],
    morphology: 'soma',
  },
];

export function buildAtlasGraph(): AtlasGraph {
  const categories = CATEGORY_DEFINITIONS.map((category, index) =>
    categoryToNode(category, index, CATEGORY_DEFINITIONS.length)
  );
  const leaves = CATEGORY_DEFINITIONS.flatMap((category, categoryIndex) =>
    generatedGraph.nodes
      .filter((node) => nodeMatchesCategory(node, category))
      .sort((a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance))
      .slice(0, 6)
      .map((node, leafIndex, leafList) => leafToNode(node, category, categoryIndex, leafIndex, leafList.length))
  );

  const nodes = [...categories, ...leaves];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const categoryEdges = categories
    .filter((node) => node.id !== 'about')
    .map((node) => ({
      id: `category:about:${node.id}`,
      source: 'about',
      target: node.id,
      strength: 0.8,
      color: node.color,
    }));
  const leafEdges = leaves.map((leaf) => ({
    id: `leaf:${leaf.categoryId}:${leaf.slug}`,
    source: leaf.categoryId ?? 'about',
    target: leaf.id,
    strength: Math.max(0.35, Math.min(0.95, leaf.size / 2.4)),
    color: leaf.color,
  }));
  const relatedEdges = generatedGraph.edges
    .map((edge) => ({
      id: `related:${edge.id}`,
      source: `leaf:${edge.source}`,
      target: `leaf:${edge.target}`,
      strength: edge.weight / 10,
      color: 'rgba(102,227,255,0.28)',
    }))
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .slice(0, 48);

  return {
    categories,
    nodes,
    edges: [...categoryEdges, ...leafEdges, ...relatedEdges],
  };
}

function categoryToNode(category: CategoryDefinition, index: number, total: number): AtlasNode {
  return {
    id: category.id,
    slug: category.id,
    title: category.label,
    label: category.label,
    summary: category.summary,
    kind: 'category',
    morphology: category.morphology,
    route: category.route,
    color: CATEGORY_COLORS[category.id],
    position: radialPosition(index, total, ATLAS_LAYOUT.overviewRadius, 0),
    size: category.id === 'about' ? 1.2 : 0.9,
  };
}

function leafToNode(
  node: NeuralNode,
  category: CategoryDefinition,
  categoryIndex: number,
  leafIndex: number,
  totalLeaves: number
): AtlasNode {
  const base = radialPosition(categoryIndex, CATEGORY_DEFINITIONS.length, ATLAS_LAYOUT.overviewRadius, 0);
  const offset = radialPosition(leafIndex, totalLeaves, ATLAS_LAYOUT.leafRadius, (categoryIndex % 3) - 1);
  const morphology: AtlasMorphology = node.type === 'publication' ? 'interneuron' : 'stellate';

  return {
    id: `leaf:${node.slug}`,
    slug: node.slug,
    title: node.title,
    label: shortLabel(node.title),
    summary: node.summary,
    kind: 'leaf',
    morphology,
    categoryId: category.id,
    route: routeForNode(node),
    color: CATEGORY_COLORS[category.id],
    position: [base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]],
    size: Math.max(0.36, Math.min(0.8, (node.visualWeight ?? 3) / 10)),
    sourceNode: node,
  };
}

function nodeMatchesCategory(node: NeuralNode, category: CategoryDefinition) {
  if (category.id === 'publications' && node.type !== 'publication') return false;
  const haystack = [node.slug, node.title, node.summary ?? '', node.cluster ?? '', ...node.domains, ...node.tags]
    .join(' ')
    .toLowerCase();
  return category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function radialPosition(index: number, total: number, radius: number, zOffset: number): AtlasVec3 {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.72,
    Math.sin(angle * 1.7) * ATLAS_LAYOUT.zSpread + zOffset,
  ];
}

function routeForNode(node: NeuralNode) {
  if (node.type === 'project') return `/projects/${node.slug}`;
  if (node.type === 'publication') return '/publications';
  if (node.type === 'case-study') return `/case-studies/${node.slug}`;
  if (node.type === 'field-note') return `/field-notes/${node.slug}`;
  return `/neural-net?focus=${node.slug}`;
}

function shortLabel(title: string) {
  return title.length <= 28 ? title : `${title.slice(0, 25).trim()}...`;
}
