import graphData from '@/data/generated/neural-graph.json';
import type { NeuralEdge, NeuralNode } from '@/lib/data/schemas';

export type NeuralAtlasNodeType =
  | 'core'
  | 'professional'
  | 'academic'
  | 'engineering'
  | 'creative'
  | 'speculative'
  | 'personal'
  | 'contact'
  | 'hidden';

export type NeuralAtlasMorphology =
  | 'soma'
  | 'pyramidal'
  | 'stellate'
  | 'interneuron'
  | 'glial'
  | 'bundle';

export type NeuralAtlasNode = {
  id: string;
  label: string;
  route: string;
  type: NeuralAtlasNodeType;
  x: number;
  y: number;
  size: 'sm' | 'md' | 'lg';
  summary: string;
  annotation: string;
  glyph: string;
  kind: 'category' | 'leaf';
  morphology: NeuralAtlasMorphology;
  categoryId?: AtlasCategoryId;
  sourceSlug?: string;
  sourceType?: string;
  sourceUrl?: string | null;
  tags?: string[];
  domains?: string[];
  importance?: number;
  initiallyVisible?: boolean;
  secondary?: boolean;
};

export type NeuralAtlasEdge = {
  from: string;
  to: string;
  strength: number;
  bend?: number;
  label?: string;
  signalOnly?: boolean;
};

export type AtlasCategoryId =
  | 'about'
  | 'professional'
  | 'projects'
  | 'publications'
  | 'ideas'
  | 'personal'
  | 'photography'
  | 'contact';

type GeneratedGraph = {
  nodes: NeuralNode[];
  edges: NeuralEdge[];
};

type CategoryDefinition = NeuralAtlasNode & {
  id: AtlasCategoryId;
  leafLimit: number;
  keywords: string[];
  clusters: string[];
  nodeTypes?: string[];
  fallbackLeaves?: Array<Pick<NeuralAtlasNode, 'id' | 'label' | 'route' | 'summary' | 'annotation' | 'glyph' | 'type' | 'morphology'>>;
};

const graph = graphData as GeneratedGraph;

export const nodeTypeColors: Record<NeuralAtlasNodeType, string> = {
  core: '#f8fbff',
  professional: '#5b8cff',
  academic: '#a78bfa',
  engineering: '#66e3ff',
  creative: '#ff7aa2',
  speculative: '#66f0c2',
  personal: '#f7c66b',
  contact: '#8fb8ff',
  hidden: '#8fb8ff',
};

const categoryDefinitions: CategoryDefinition[] = [
  {
    id: 'about',
    label: 'About / Identity',
    route: '/about',
    type: 'core',
    x: 50,
    y: 43,
    size: 'lg',
    initiallyVisible: true,
    glyph: 'self',
    kind: 'category',
    morphology: 'soma',
    annotation: 'signal origin',
    summary: 'Identity, taste, research instincts, and the connective tissue behind the work.',
    leafLimit: 6,
    keywords: ['personal', 'life', 'dolby', 'neurosky', 'coeval'],
    clusters: ['Life Outside the Lab', 'Audio-Visual Systems', 'Applied AI Products'],
  },
  {
    id: 'professional',
    label: 'Professional Work',
    route: '/case-studies',
    type: 'professional',
    x: 33,
    y: 27,
    size: 'lg',
    initiallyVisible: true,
    glyph: 'briefcase',
    kind: 'category',
    morphology: 'pyramidal',
    annotation: 'lab systems',
    summary: 'Research engineering, lab infrastructure, DataJoint pipelines, and production-grade scientific tooling.',
    leafLimit: 8,
    keywords: ['datajoint', 'harvard', 'sabatini', 'allen', 'mindscope', 'neatlabs', 'workflow', 'dolby'],
    clusters: ['Neural Data Infrastructure', 'Scientific Workflow Systems', 'Scientific DevOps', 'NEATLABs Research'],
  },
  {
    id: 'projects',
    label: 'Projects / Code',
    route: '/projects',
    type: 'engineering',
    x: 66,
    y: 27,
    size: 'lg',
    initiallyVisible: true,
    glyph: 'code',
    kind: 'category',
    morphology: 'pyramidal',
    annotation: 'build cortex',
    summary: 'Neural data infrastructure, applied AI systems, model tools, and creative prototypes.',
    leafLimit: 10,
    keywords: ['neuros', 'neuroforge', 'bci', 'python', 'typescript', 'classifier', 'pipeline', 'agent'],
    clusters: ['Foundation Models & BCI', 'Applied AI Products', 'BCI & Real-Time Systems', 'Mechanistic Interpretability'],
    nodeTypes: ['project'],
  },
  {
    id: 'publications',
    label: 'Publications / Papers',
    route: '/publications',
    type: 'academic',
    x: 20,
    y: 52,
    size: 'md',
    initiallyVisible: true,
    glyph: 'paper',
    kind: 'category',
    morphology: 'interneuron',
    annotation: 'archive chamber',
    summary: 'Peer-reviewed work in neural dynamics, behavior, and computational neuroscience.',
    leafLimit: 8,
    keywords: ['publication', 'oscillation', 'cortico-striatal', 'probe', 'default-mode'],
    clusters: ['Publications', 'Neuroscience Research'],
    nodeTypes: ['publication'],
  },
  {
    id: 'ideas',
    label: 'Research Ideas',
    route: '/ideas',
    type: 'speculative',
    x: 80,
    y: 52,
    size: 'md',
    initiallyVisible: true,
    glyph: 'spark',
    kind: 'category',
    morphology: 'stellate',
    annotation: 'hypothesis field',
    summary: 'Foundation models for brain dynamics, mechanistic interpretability, BCI infrastructure, and scientific tools.',
    leafLimit: 8,
    keywords: ['foundation', 'mechanistic', 'interpretability', 'bci', 'augmentation', 'kalman', 'transformer'],
    clusters: ['Mechanistic Interpretability', 'Foundation Models & BCI', 'Neural Decoding and ML', 'Neural Signal Discovery'],
  },
  {
    id: 'personal',
    label: 'Personal Interests',
    route: '/life',
    type: 'personal',
    x: 36,
    y: 75,
    size: 'md',
    initiallyVisible: true,
    glyph: 'compass',
    kind: 'category',
    morphology: 'stellate',
    annotation: 'life inputs',
    summary: 'Outdoor rhythm, play, animals, music, motion, and the attention that keeps the work alive.',
    leafLimit: 7,
    keywords: ['personal', 'life', 'woof', 'petpath', 'shasta', 'audio', 'visualization'],
    clusters: ['Life Outside the Lab', 'Personal Projects', 'Real-Time Creative Neurotech'],
  },
  {
    id: 'photography',
    label: 'Photography / Field Notes',
    route: '/photography',
    type: 'creative',
    x: 62,
    y: 76,
    size: 'md',
    initiallyVisible: true,
    glyph: 'lens',
    kind: 'category',
    morphology: 'glial',
    annotation: 'field memory',
    summary: 'Landscape, texture, Shasta energy, travel fragments, and visual attention outside the lab.',
    leafLimit: 5,
    keywords: ['photo', 'field', 'shasta', 'life', 'personal', 'creative'],
    clusters: ['Life Outside the Lab', 'Personal Projects'],
    fallbackLeaves: [
      {
        id: 'field-notes',
        label: 'Field Notes',
        route: '/field-notes',
        type: 'creative',
        glyph: 'notebook',
        morphology: 'glial',
        annotation: 'observational layer',
        summary: 'Small fragments from travel, visual attention, experiments, and life outside the lab.',
      },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    route: '/contact',
    type: 'contact',
    x: 88,
    y: 38,
    size: 'md',
    initiallyVisible: true,
    glyph: 'radio',
    kind: 'category',
    morphology: 'bundle',
    annotation: 'open channel',
    summary: 'Collaborations, research conversations, applied AI systems, and ambitious prototypes.',
    leafLimit: 4,
    keywords: ['neuros', 'neuroforge', 'coeval', 'datajoint'],
    clusters: ['Foundation Models & BCI', 'Applied AI Products', 'Neural Data Infrastructure'],
    fallbackLeaves: [
      {
        id: 'collaborate',
        label: 'Collaborate',
        route: '/contact',
        type: 'contact',
        glyph: 'radio',
        morphology: 'bundle',
        annotation: 'synaptic handoff',
        summary: 'Open to research engineering, applied AI, neuroscience infrastructure, and experimental product work.',
      },
    ],
  },
];

export const atlasCategories: NeuralAtlasNode[] = categoryDefinitions.map(categoryToNode);

export const rootCategoryEdges: NeuralAtlasEdge[] = [
  { from: 'about', to: 'professional', strength: 0.9, bend: 8 },
  { from: 'about', to: 'projects', strength: 0.95, bend: -8 },
  { from: 'about', to: 'publications', strength: 0.74, bend: 10 },
  { from: 'about', to: 'ideas', strength: 0.8, bend: -9 },
  { from: 'about', to: 'personal', strength: 0.68, bend: -6 },
  { from: 'about', to: 'photography', strength: 0.62, bend: 7 },
  { from: 'projects', to: 'contact', strength: 0.7, bend: -7 },
  { from: 'ideas', to: 'publications', strength: 0.78, bend: -12 },
  { from: 'professional', to: 'projects', strength: 0.86, bend: 7 },
  { from: 'personal', to: 'photography', strength: 0.62, bend: -5 },
  { from: 'ideas', to: 'contact', strength: 0.54, bend: 6 },
];

export const neuralAtlasNodes = atlasCategories;
export const neuralAtlasEdges = rootCategoryEdges;

export function getAtlasCategory(id: AtlasCategoryId | null) {
  if (!id) return null;
  return categoryDefinitions.find((category) => category.id === id) ?? null;
}

export function getAtlasStats() {
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    projects: graph.nodes.filter((node) => node.type === 'project').length,
    publications: graph.nodes.filter((node) => node.type === 'publication').length,
  };
}

export function getSubnetwork(categoryId: AtlasCategoryId) {
  const category = getAtlasCategory(categoryId);
  if (!category) {
    return { nodes: atlasCategories, edges: rootCategoryEdges, leaves: [] as NeuralAtlasNode[] };
  }

  const leaves = buildLeaves(category);
  const leafEdges = buildLeafEdges(category, leaves);

  return {
    nodes: [...atlasCategories, ...leaves],
    edges: [...rootCategoryEdges, ...leafEdges],
    leaves,
  };
}

export function getRelatedAtlasLeaves(leaf: NeuralAtlasNode, leaves: NeuralAtlasNode[]) {
  if (!leaf.sourceSlug) return [];

  const relatedSlugs = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === leaf.sourceSlug) relatedSlugs.add(edge.target);
    if (edge.target === leaf.sourceSlug) relatedSlugs.add(edge.source);
  }

  return leaves.filter((candidate) => candidate.sourceSlug && relatedSlugs.has(candidate.sourceSlug)).slice(0, 4);
}

function buildLeaves(category: CategoryDefinition) {
  const selected = graph.nodes
    .filter((node) => matchesCategory(node, category))
    .sort((a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance))
    .slice(0, category.leafLimit);

  const realLeaves = selected.map((node, index) => nodeToAtlasLeaf(node, category, index, selected.length));
  const fallbackLeaves = (category.fallbackLeaves ?? [])
    .filter((fallback) => !realLeaves.some((leaf) => leaf.id.endsWith(`:${fallback.id}`)))
    .slice(0, Math.max(0, category.leafLimit - realLeaves.length))
    .map((fallback, index) => fallbackToAtlasLeaf(fallback, category, index + realLeaves.length, category.leafLimit));

  return [...realLeaves, ...fallbackLeaves];
}

function categoryToNode(category: CategoryDefinition): NeuralAtlasNode {
  return {
    id: category.id,
    label: category.label,
    route: category.route,
    type: category.type,
    x: category.x,
    y: category.y,
    size: category.size,
    summary: category.summary,
    annotation: category.annotation,
    glyph: category.glyph,
    kind: category.kind,
    morphology: category.morphology,
    initiallyVisible: category.initiallyVisible,
    secondary: category.secondary,
  };
}

function matchesCategory(node: NeuralNode, category: CategoryDefinition) {
  if (category.nodeTypes && !category.nodeTypes.includes(node.type)) return false;

  const haystack = [
    node.slug,
    node.title,
    node.summary ?? '',
    node.description ?? '',
    node.cluster ?? '',
    ...node.domains,
    ...node.tags,
  ]
    .join(' ')
    .toLowerCase();

  return [...category.clusters, ...category.keywords].some((term) =>
    haystack.includes(term.toLowerCase())
  );
}

function nodeToAtlasLeaf(node: NeuralNode, category: CategoryDefinition, index: number, total: number): NeuralAtlasNode {
  const position = leafPosition(category, index, total);
  const type = node.type === 'publication' ? 'academic' : category.type;

  return {
    id: `leaf:${category.id}:${node.slug}`,
    label: shortTitle(node.title),
    route: routeForNode(node),
    type,
    x: position.x,
    y: position.y,
    size: (node.visualWeight ?? 3) >= 8 ? 'md' : 'sm',
    summary: node.summary || node.description || 'A connected artifact from the generated neural graph.',
    annotation: annotationForNode(node),
    glyph: glyphForNode(node, category),
    kind: 'leaf',
    morphology: morphologyForNode(node, category),
    categoryId: category.id,
    sourceSlug: node.slug,
    sourceType: node.type,
    sourceUrl: node.sourceUrl,
    tags: node.tags.slice(0, 8),
    domains: node.domains.slice(0, 4),
    importance: node.computedImportance ?? node.importance,
    secondary: true,
  };
}

function fallbackToAtlasLeaf(
  fallback: Pick<NeuralAtlasNode, 'id' | 'label' | 'route' | 'summary' | 'annotation' | 'glyph' | 'type' | 'morphology'>,
  category: CategoryDefinition,
  index: number,
  total: number
): NeuralAtlasNode {
  const position = leafPosition(category, index, total);

  return {
    ...fallback,
    id: `leaf:${category.id}:${fallback.id}`,
    x: position.x,
    y: position.y,
    size: 'sm',
    kind: 'leaf',
    categoryId: category.id,
    tags: [],
    domains: [],
    secondary: true,
  };
}

function leafPosition(category: CategoryDefinition, index: number, total: number) {
  const spread = total <= 5 ? 230 : 285;
  const start = category.id === 'professional' || category.id === 'publications' ? -125 : -72;
  const angle = ((start + (spread / Math.max(1, total - 1)) * index) * Math.PI) / 180;
  const ring = 15 + (index % 3) * 3.2;
  const x = clamp(category.x + Math.cos(angle) * ring, 8, 92);
  const y = clamp(category.y + Math.sin(angle) * ring, 12, 90);

  return { x, y };
}

function buildLeafEdges(category: CategoryDefinition, leaves: NeuralAtlasNode[]) {
  const edges: NeuralAtlasEdge[] = leaves.map((leaf, index) => ({
    from: category.id,
    to: leaf.id,
    strength: Math.min(0.98, 0.48 + ((leaf.importance ?? 60) / 160)),
    bend: index % 2 === 0 ? 5 + (index % 3) : -5 - (index % 3),
    label: leaf.annotation,
  }));

  const slugToLeaf = new Map(leaves.filter((leaf) => leaf.sourceSlug).map((leaf) => [leaf.sourceSlug, leaf]));
  for (const edge of graph.edges) {
    const source = slugToLeaf.get(edge.source);
    const target = slugToLeaf.get(edge.target);
    if (!source || !target) continue;

    edges.push({
      from: source.id,
      to: target.id,
      strength: Math.min(0.82, 0.24 + edge.weight / 12),
      bend: edge.weight % 2 === 0 ? 4 : -4,
      label: edge.label,
    });
  }

  return edges;
}

function routeForNode(node: NeuralNode) {
  if (node.type === 'project') return `/projects/${node.slug}`;
  if (node.type === 'publication') return `/publications`;
  if (node.type === 'case-study') return `/case-studies/${node.slug}`;
  if (node.type === 'field-note') return `/field-notes/${node.slug}`;
  return `/neural-net?focus=${node.slug}`;
}

function annotationForNode(node: NeuralNode) {
  if (node.type === 'publication') {
    return node.publication?.year ? `paper / ${node.publication.year}` : 'paper';
  }

  if (node.cluster) return node.cluster;
  if (node.domains[0]) return node.domains[0];
  return node.source === 'github' ? 'repository' : node.type;
}

function glyphForNode(node: NeuralNode, category: CategoryDefinition) {
  if (node.type === 'publication') return 'paper';
  if (node.github) return 'code';
  if (category.id === 'professional') return 'briefcase';
  if (category.id === 'personal') return 'compass';
  if (category.id === 'photography') return 'lens';
  return category.glyph;
}

function morphologyForNode(node: NeuralNode, category: CategoryDefinition): NeuralAtlasMorphology {
  if (node.type === 'publication') return 'interneuron';
  if ((node.visualWeight ?? 3) >= 8) return 'pyramidal';
  if (category.id === 'photography' || category.id === 'personal') return 'glial';
  return 'stellate';
}

function shortTitle(title: string) {
  const cleaned = title
    .replace(/^Published:\s*/i, '')
    .replace(/\s+with\s+.+$/i, '')
    .replace(/\s*[:|/]\s*.+$/i, '')
    .replace(/\b(multimodal|neuroscience|pipeline|pipelines|project|system|systems|framework|application)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= 42) return cleaned || title;
  return `${cleaned.slice(0, 39).trim()}...`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
