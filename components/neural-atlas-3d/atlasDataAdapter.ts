import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import type { NeuralEdge, NeuralGraph, NeuralNode } from '@/lib/data/schemas';
import type {
  AtlasCurveType,
  AtlasEdge,
  AtlasEdgeRelation,
  AtlasGraph,
  AtlasLeafContentType,
  AtlasMorphology,
  AtlasNodeDetail,
  AtlasNode,
  AtlasVector3,
  AtlasVisibleState,
} from './atlasTypes';
import { ATLAS_LAYOUT, CATEGORY_COLORS } from './visualConstants';

type CategoryDefinition = {
  id: string;
  title: string;
  shortLabel: string;
  route: string;
  summary: string;
  morphology: AtlasMorphology;
  contentType: AtlasLeafContentType;
  keywords: string[];
  domains: string[];
  clusters: string[];
};

type CategoryScore = {
  categoryId: string;
  score: number;
};

const ROOT_ID = 'neural-atlas-root';
const generatedGraph = NeuralGraphSchema.parse(graphData) as NeuralGraph;

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'about',
    title: 'About / Identity',
    shortLabel: 'About',
    route: '/about',
    summary: 'The central soma for identity, research instincts, taste, and positioning.',
    morphology: 'soma',
    contentType: 'external',
    keywords: ['identity', 'about', 'personal', 'dolby', 'coeval'],
    domains: ['Life Outside the Lab'],
    clusters: ['Life Outside the Lab'],
  },
  {
    id: 'professional-work',
    title: 'Professional Work',
    shortLabel: 'Work',
    route: '/case-studies',
    summary: 'Research engineering, lab infrastructure, DataJoint deployments, and production scientific systems.',
    morphology: 'pyramidal',
    contentType: 'case-study',
    keywords: ['datajoint', 'harvard', 'sabatini', 'allen', 'mindscope', 'neatlabs', 'workflow', 'lu lab', 'deeplabcut', 'facemap'],
    domains: ['Neural Data Infrastructure', 'Scientific Workflow Systems', 'Scientific DevOps', 'NEATLABs Research'],
    clusters: ['Neural Data Infrastructure', 'Scientific Workflow Systems', 'Scientific DevOps', 'NEATLABs Research'],
  },
  {
    id: 'projects',
    title: 'Projects / Code',
    shortLabel: 'Projects',
    route: '/projects',
    summary: 'GitHub-backed systems, applied AI products, neural tooling, and working prototypes.',
    morphology: 'pyramidal',
    contentType: 'project',
    keywords: ['github', 'python', 'typescript', 'neuros', 'neuroforge', 'pipeline', 'agent', 'classifier', 'app'],
    domains: ['Applied AI Products', 'BCI & Real-Time Systems', 'Cloud Infrastructure'],
    clusters: ['Applied AI Products', 'Foundation Models & BCI', 'Cloud Infrastructure', 'DataJoint Elements'],
  },
  {
    id: 'publications',
    title: 'Publications / Papers',
    shortLabel: 'Papers',
    route: '/publications',
    summary: 'Peer-reviewed neuroscience papers with DOI, author, venue, and related graph context.',
    morphology: 'interneuron',
    contentType: 'publication',
    keywords: ['publication', 'paper', 'journal', 'doi', 'electrophysiology', 'neuroscience'],
    domains: ['Publications', 'Neural Data Analysis', 'Experimental Systems'],
    clusters: ['Publications', 'Neuroscience Research'],
  },
  {
    id: 'research-ideas',
    title: 'Research Ideas',
    shortLabel: 'Ideas',
    route: '/ideas',
    summary: 'Foundation models for brain dynamics, mechanistic interpretability, BCI systems, and speculative tools.',
    morphology: 'stellate',
    contentType: 'idea',
    keywords: ['foundation', 'mechanistic', 'interpretability', 'bci', 'neurofmx', 'neuros', 'kalman', 'transformer', 'neural signal'],
    domains: ['Mechanistic Interpretability', 'Neural Foundation Models', 'Neural Decoding and ML', 'Neural Signal Discovery'],
    clusters: ['Mechanistic Interpretability', 'Foundation Models & BCI', 'Neural Decoding and ML', 'Neural Signal Discovery'],
  },
  {
    id: 'personal-interests',
    title: 'Personal Interests',
    shortLabel: 'Personal',
    route: '/life',
    summary: 'Outdoor rhythm, Shasta, personal product ideas, motion, music, and life outside the lab.',
    morphology: 'glial',
    contentType: 'external',
    keywords: ['personal', 'life', 'woof', 'petpath', 'shasta', 'pet', 'audio', 'visualization'],
    domains: ['Life Outside the Lab', 'Personal Projects', 'Personal Product Experiments'],
    clusters: ['Life Outside the Lab', 'Personal Projects', 'Real-Time Creative Neurotech'],
  },
  {
    id: 'photography',
    title: 'Photography / Field Notes',
    shortLabel: 'Field Notes',
    route: '/photography',
    summary: 'Photography, travel fragments, field observations, and visual attention outside the lab.',
    morphology: 'purkinje-inspired',
    contentType: 'photography',
    keywords: ['photo', 'photography', 'field', 'field-note', 'shasta', 'creative', 'travel'],
    domains: ['Life Outside the Lab', 'Personal Projects'],
    clusters: ['Life Outside the Lab', 'Personal Projects'],
  },
  {
    id: 'contact',
    title: 'Contact',
    shortLabel: 'Contact',
    route: '/contact',
    summary: 'An open terminal for collaborations, roles, research conversations, and ambitious prototypes.',
    morphology: 'axon-terminal',
    contentType: 'contact',
    keywords: ['contact', 'collaborate', 'neuros', 'neuroforge', 'datajoint'],
    domains: ['Applied AI Products', 'Neural Data Infrastructure'],
    clusters: ['Foundation Models & BCI', 'Applied AI Products', 'Neural Data Infrastructure'],
  },
];

export function buildAtlasGraph(): AtlasGraph {
  const root = buildRootNode();
  const outerCategories = CATEGORY_DEFINITIONS.filter((category) => category.id !== 'about');
  const categories = CATEGORY_DEFINITIONS.map((category) => {
    const outerIndex = outerCategories.findIndex((outerCategory) => outerCategory.id === category.id);
    return categoryToNode(category, outerIndex, outerCategories.length);
  });
  const leafAssignments = assignGeneratedNodes(generatedGraph.nodes);
  const leaves = leafAssignments.map(({ node, categoryId, leafIndex, siblingCount }) =>
    leafToNode(node, categoryId, leafIndex, siblingCount)
  );

  const allNodes = [root, ...categories, ...leaves];
  const nodeById = new Map(allNodes.map((node) => [node.id, node]));
  const slugToLeafId = new Map(leaves.map((node) => [node.slug, node.id]));
  const categoryEdges = categories
    .filter((category) => category.id !== 'about')
    .map((category, index) =>
      makeEdge({
        id: `root:about:${category.id}`,
        source: 'about',
        target: category.id,
        relation: 'root-to-category',
        strength: 0.72 + index * 0.02,
        curveType: index % 3 === 0 ? 'bundle' : 'axon',
        color: category.color,
        signalDelay: index * 0.08,
        dendriteBranches: 2 + (index % 3),
        visibleInStates: ['root', 'overview', 'always'],
      })
    );
  const leafEdges = leaves.map((leaf, index) =>
    makeEdge({
      id: `category:${leaf.parentId}:${leaf.id}`,
      source: leaf.parentId ?? ROOT_ID,
      target: leaf.id,
      relation: 'category-to-leaf',
      strength: Math.max(0.36, Math.min(0.95, leaf.importance / 110)),
      curveType: leaf.contentType === 'publication' ? 'synapse' : 'dendrite',
      color: leaf.color,
      signalDelay: (index % 8) * 0.05,
      dendriteBranches: leaf.morphology === 'pyramidal' ? 5 : 3,
      visibleInStates: ['category', 'detail', 'traveling', 'arriving', 'reading'],
    })
  );
  const relatedEdges = buildRelatedEdges(generatedGraph.edges, slugToLeafId);
  const edges = [...categoryEdges, ...leafEdges, ...relatedEdges];

  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    source.childrenIds = source.childrenIds.includes(target.id)
      ? source.childrenIds
      : [...source.childrenIds, target.id];
    target.relatedIds = target.relatedIds.includes(source.id)
      ? target.relatedIds
      : [...target.relatedIds, source.id];
    source.relatedIds = source.relatedIds.includes(target.id)
      ? source.relatedIds
      : [...source.relatedIds, target.id];
  }

  return {
    rootId: ROOT_ID,
    categoryIds: categories.map((category) => category.id),
    nodes: allNodes,
    edges,
    categories,
    generatedNodeCount: generatedGraph.nodes.length,
    generatedEdgeCount: generatedGraph.edges.length,
  };
}

function buildRootNode(): AtlasNode {
  return {
    id: ROOT_ID,
    slug: 'neural-atlas',
    title: 'Sid Neural Atlas',
    shortLabel: 'Atlas',
    summary: 'The root soma for the spatial map of work, research, publications, ideas, and field notes.',
    kind: 'root',
    contentType: 'external',
    morphology: 'soma',
    category: 'root',
    parentId: null,
    childrenIds: [],
    relatedIds: [],
    position: { x: 0, y: 0, z: 0 },
    scale: 1.35,
    color: '#f8fbff',
    route: '/',
    tags: ['atlas', 'root'],
    domains: [],
    importance: 100,
    featured: true,
    hiddenUntilParentFocused: false,
  };
}

function categoryToNode(category: CategoryDefinition, index: number, total: number): AtlasNode {
  const isSignalOrigin = category.id === 'about';

  return {
    id: category.id,
    slug: category.id,
    title: category.title,
    shortLabel: category.shortLabel,
    summary: category.summary,
    kind: 'category',
    contentType: category.contentType,
    morphology: category.morphology,
    category: category.id,
    parentId: isSignalOrigin ? ROOT_ID : 'about',
    childrenIds: [],
    relatedIds: [],
    position: isSignalOrigin ? { x: 0, y: 0, z: 0.35 } : radialPosition(index, total, ATLAS_LAYOUT.overviewRadius, 0),
    scale: isSignalOrigin ? 1.22 : 0.86,
    color: CATEGORY_COLORS[category.id],
    route: category.route,
    tags: category.keywords,
    domains: category.domains,
    importance: 100,
    featured: true,
    hiddenUntilParentFocused: false,
  };
}

function assignGeneratedNodes(nodes: NeuralNode[]) {
  const usedSlugs = new Set<string>();
  const grouped = new Map<string, NeuralNode[]>();

  for (const node of nodes) {
    if (usedSlugs.has(node.slug)) continue;
    const categoryId = pickCategory(node);
    usedSlugs.add(node.slug);
    grouped.set(categoryId, [...(grouped.get(categoryId) ?? []), node]);
  }

  return Array.from(grouped.entries()).flatMap(([categoryId, categoryNodes]) =>
    categoryNodes
      .sort((a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance))
      .slice(0, 12)
      .map((node, leafIndex, siblings) => ({
        node,
        categoryId,
        leafIndex,
        siblingCount: siblings.length,
      }))
  );
}

function pickCategory(node: NeuralNode) {
  if (node.type === 'publication') return 'publications';

  const scores = CATEGORY_DEFINITIONS.map((category) => ({
    categoryId: category.id,
    score: scoreNodeForCategory(node, category),
  })).sort(sortCategoryScores);

  return scores[0]?.categoryId ?? 'projects';
}

function sortCategoryScores(a: CategoryScore, b: CategoryScore) {
  if (b.score !== a.score) return b.score - a.score;
  const priority = [
    'professional-work',
    'research-ideas',
    'projects',
    'personal-interests',
    'photography',
    'publications',
    'about',
    'contact',
  ];
  return priority.indexOf(a.categoryId) - priority.indexOf(b.categoryId);
}

function scoreNodeForCategory(node: NeuralNode, category: CategoryDefinition) {
  const haystack = nodeHaystack(node);
  let score = 0;

  for (const keyword of category.keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 3;
  }
  for (const domain of category.domains) {
    if (node.domains.some((nodeDomain) => nodeDomain.toLowerCase() === domain.toLowerCase())) score += 5;
  }
  if (node.cluster && category.clusters.some((cluster) => cluster.toLowerCase() === node.cluster?.toLowerCase())) {
    score += 6;
  }

  if (category.id === 'professional-work') {
    if (node.source === 'context-doc') score += 4;
    if (/(datajoint|harvard|sabatini|allen|mindscope|neatlabs|lu lab|workflow)/i.test(haystack)) score += 7;
  }
  if (category.id === 'projects') {
    if (node.source === 'github') score += 5;
    if (node.github) score += 4;
    if ((node.computedImportance ?? node.importance) < 90) score += 1;
  }
  if (category.id === 'research-ideas') {
    if (/(mechanistic|interpretability|foundation|bci|neurofmx|neuros|kalman|transformer)/i.test(haystack)) score += 7;
  }
  if (category.id === 'personal-interests') {
    if (/(personal|life|woof|petpath|shasta|pet)/i.test(haystack)) score += 8;
  }
  if (category.id === 'photography') {
    if (/(photo|photography|field|travel|visual attention)/i.test(haystack)) score += 8;
  }

  return score;
}

function leafToNode(node: NeuralNode, categoryId: string, leafIndex: number, totalLeaves: number): AtlasNode {
  const categoryIndex = CATEGORY_DEFINITIONS.findIndex((category) => category.id === categoryId);
  const category = CATEGORY_DEFINITIONS[Math.max(0, categoryIndex)];
  const base = radialPosition(Math.max(0, categoryIndex), CATEGORY_DEFINITIONS.length, ATLAS_LAYOUT.overviewRadius, 0);
  const offset = radialPosition(leafIndex, Math.max(1, totalLeaves), ATLAS_LAYOUT.leafRadius, (categoryIndex % 3) - 1);
  const contentType = contentTypeForNode(node, categoryId);
  const importance = node.computedImportance ?? node.importance;

  return {
    id: `leaf:${node.slug}`,
    slug: node.slug,
    title: node.title,
    shortLabel: shortLabel(node.title),
    summary: node.summary || node.description || 'A generated graph artifact connected to this atlas category.',
    kind: 'leaf',
    contentType,
    morphology: morphologyForNode(node, contentType, categoryId),
    category: categoryId,
    parentId: categoryId,
    childrenIds: [],
    relatedIds: [],
    position: {
      x: base.x + offset.x,
      y: base.y + offset.y,
      z: base.z + offset.z,
    },
    scale: Math.max(0.38, Math.min(0.92, (node.visualWeight ?? 3) / 9)),
    color: CATEGORY_COLORS[categoryId] ?? '#66e3ff',
    route: routeForNode(node, contentType),
    externalUrl: node.sourceUrl ?? node.github?.url ?? (node.publication?.doi ? `https://doi.org/${node.publication.doi}` : null),
    sourceNodeSlug: node.slug,
    publication: node.publication,
    github: node.github,
    detail: detailForNode(node, contentType, categoryId),
    tags: node.tags,
    domains: node.domains,
    importance,
    featured: node.featured || importance >= 90,
    hiddenUntilParentFocused: true,
    sourceNode: node,
  };
}

function detailForNode(node: NeuralNode, contentType: AtlasLeafContentType, categoryId: string): AtlasNodeDetail {
  if (contentType === 'publication') {
    return {
      description: node.publication?.abstract ?? node.summary,
      myContribution: publicationContributionForNode(node),
      summaryBullets: publicationSummaryBullets(node),
    };
  }

  if (contentType === 'case-study') {
    return {
      description: node.description ?? node.summary,
      whyItMatters: projectWhyItMatters(node, categoryId),
    };
  }

  if (contentType === 'project') {
    return {
      description: node.description ?? node.github?.description ?? node.summary,
      whyItMatters: projectWhyItMatters(node, categoryId),
      architectureHighlights: architectureHighlightsForNode(node),
      representativeFiles: representativeFilesForNode(node),
      demonstrates: demonstratesForNode(node),
    };
  }

  if (contentType === 'idea') {
    return {
      description: node.description ?? node.summary,
      whyItMatters: 'This node marks a research direction where neural data, model behavior, and usable scientific tools can meet.',
      demonstrates: 'Research taste, technical imagination, and the ability to connect engineering systems to biological questions.',
    };
  }

  if (contentType === 'photography' || contentType === 'field-note') {
    return {
      description: node.description ?? node.summary,
      whyItMatters: 'A quieter signal in the atlas: attention to place, texture, movement, and the observational habits that also shape research work.',
    };
  }

  return {
    description: node.description ?? node.summary,
    whyItMatters: 'This is an outward-facing connection point from the atlas into the wider portfolio.',
  };
}

function publicationContributionForNode(node: NeuralNode) {
  if (node.domains.some((domain) => /neatlabs/i.test(domain)) || /neatlabs/i.test(node.tags.join(' '))) {
    return 'Contributed to NEATLABs research workflows spanning neural data analysis, experimental systems, and publication-ready interpretation.';
  }

  return 'Contribution details are being curated; this placeholder keeps the paper readable until the publication record is expanded.';
}

function publicationSummaryBullets(node: NeuralNode) {
  const pub = node.publication;
  const bullets: string[] = [];

  if (node.summary) bullets.push(node.summary);
  if (pub?.venue || pub?.year) {
    bullets.push(`Published ${pub.year ? `in ${pub.year}` : ''}${pub.venue ? ` through ${pub.venue}` : ''}.`.replace(/\s+/g, ' '));
  }
  if (node.tags.length > 0) {
    bullets.push(`Connects ${node.tags.slice(0, 4).join(', ')} to the broader research graph.`);
  }
  if (node.domains.length > 0) {
    bullets.push(`Sits in ${node.domains.slice(0, 3).join(', ')} within the atlas.`);
  }
  bullets.push('Readable paper notes and contribution details can be expanded from curated metadata as the archive deepens.');

  return bullets.slice(0, 5);
}

function projectWhyItMatters(node: NeuralNode, categoryId: string) {
  if (categoryId === 'professional-work') {
    return 'It shows production scientific infrastructure: reproducible workflows, lab-facing tooling, and systems that turn complex experiments into usable datasets.';
  }
  if (node.domains.some((domain) => /BCI|Real-Time|Foundation/i.test(domain))) {
    return 'It pushes toward low-latency neural systems where streaming data, model inference, and experimental feedback need to stay coordinated.';
  }
  if (node.domains.some((domain) => /Data Infrastructure|Workflow|DataJoint/i.test(domain)) || /datajoint/i.test(node.tags.join(' '))) {
    return 'It demonstrates comfort with scientific data plumbing: schemas, compute orchestration, reproducibility, and tools researchers can actually operate.';
  }
  if (node.domains.some((domain) => /Interpretability/i.test(domain)) || /interpretability/i.test(node.tags.join(' '))) {
    return 'It connects model inspection to neuroscience questions, making opaque systems easier to probe and explain.';
  }
  if (node.github?.isFork) {
    return 'It represents contribution-oriented engineering: reading an existing scientific codebase, adapting to its patterns, and improving useful infrastructure.';
  }

  return 'It is a concrete artifact in the portfolio graph, tying code, domain judgment, and a working implementation into one inspectable node.';
}

function architectureHighlightsForNode(node: NeuralNode) {
  const haystack = nodeHaystack(node);
  const highlights: string[] = [];

  if (/datajoint|element|workflow|pipeline/.test(haystack)) {
    highlights.push('Schema-centered pipeline architecture with clear ingestion, processing, and analysis boundaries.');
  }
  if (/bci|real-time|streaming|classification/.test(haystack)) {
    highlights.push('Streaming-first design for neural data processing, model inference, and feedback loops.');
  }
  if (/agent|middleware|orchestration/.test(haystack)) {
    highlights.push('Agent/orchestration layer that turns higher-level research intent into executable system behavior.');
  }
  if (/transformer|interpretability|foundation/.test(haystack)) {
    highlights.push('Model-analysis workflow for inspecting latent behavior, interventions, and learned representations.');
  }
  if (/aws|cloud|docker|kubernetes/.test(haystack)) {
    highlights.push('Cloud-ready deployment posture with containerized services and durable storage boundaries.');
  }
  if (node.github?.language) {
    highlights.push(`Primary implementation language: ${node.github.language}.`);
  }

  return highlights.slice(0, 5);
}

function representativeFilesForNode(node: NeuralNode) {
  const repo = node.github?.repo ?? node.slug;
  const haystack = nodeHaystack(node);

  if (/datajoint|element/.test(haystack)) {
    return ['schemas/', 'workflow/', 'notebooks/', 'tests/'];
  }
  if (/agent|orchestration|middleware/.test(haystack)) {
    return ['agents/', 'orchestrator/', 'tools/', 'configs/'];
  }
  if (/transformer|interpretability/.test(haystack)) {
    return ['models/', 'analysis/', 'interventions/', 'notebooks/'];
  }
  if (/bci|streaming|real-time/.test(haystack)) {
    return ['streams/', 'processing/', 'classifiers/', 'experiments/'];
  }

  return [`${repo}/`, 'src/', 'README.md'];
}

function demonstratesForNode(node: NeuralNode) {
  if (node.github?.isFork) {
    return 'Ability to enter established scientific software, preserve local conventions, and contribute without treating the codebase as a blank slate.';
  }
  if (node.domains.some((domain) => /Neural Data Infrastructure|Scientific Workflow/i.test(domain))) {
    return 'Research engineering maturity: translating lab needs into maintainable data systems with clear operational boundaries.';
  }
  if (node.domains.some((domain) => /BCI|Real-Time|Foundation/i.test(domain))) {
    return 'A builder-researcher profile: low-latency systems, neural decoding intuition, and enough product sense to make the tooling navigable.';
  }
  if (node.domains.some((domain) => /Applied AI|Interpretability/i.test(domain))) {
    return 'Modern AI engineering with a research spine: model-facing tools grounded in actual experimental questions.';
  }

  return 'Readable engineering judgment, project ownership, and the habit of making technical work inspectable.';
}

function buildRelatedEdges(edges: NeuralEdge[], slugToLeafId: Map<string, string>) {
  const relatedEdges: AtlasEdge[] = [];

  for (const edge of edges) {
    const source = slugToLeafId.get(edge.source);
    const target = slugToLeafId.get(edge.target);
    if (!source || !target) continue;

    relatedEdges.push(
      makeEdge({
        id: `related:${edge.id}`,
        source,
        target,
        relation: 'related',
        strength: Math.max(0.2, Math.min(0.85, edge.weight / 10)),
        curveType: 'bundle',
        color: 'rgba(102,227,255,0.28)',
        signalDelay: (relatedEdges.length % 12) * 0.04,
        dendriteBranches: 1,
        visibleInStates: ['category', 'detail', 'reading'],
      })
    );
  }

  return relatedEdges.slice(0, 80);
}

function makeEdge(edge: AtlasEdge): AtlasEdge {
  return edge;
}

function contentTypeForNode(node: NeuralNode, categoryId: string): AtlasLeafContentType {
  if (node.type === 'publication') return 'publication';
  if (node.type === 'case-study') return 'case-study';
  if (node.type === 'field-note') return 'field-note';
  if (categoryId === 'research-ideas') return 'idea';
  if (categoryId === 'photography') return 'photography';
  if (categoryId === 'contact') return 'contact';
  if (node.type === 'project') return 'project';
  return node.sourceUrl ? 'external' : 'project';
}

function morphologyForNode(node: NeuralNode, contentType: AtlasLeafContentType, categoryId: string): AtlasMorphology {
  if (contentType === 'publication') return 'interneuron';
  if (categoryId === 'professional-work') return 'pyramidal';
  if (categoryId === 'photography') return 'purkinje-inspired';
  if (categoryId === 'personal-interests') return 'glial';
  if (categoryId === 'contact') return 'axon-terminal';
  if ((node.computedImportance ?? node.importance) >= 92) return 'pyramidal';
  return 'stellate';
}

function routeForNode(node: NeuralNode, contentType: AtlasLeafContentType) {
  if (contentType === 'project') return `/projects/${node.slug}`;
  if (contentType === 'publication') return `/publications?focus=${node.slug}`;
  if (contentType === 'case-study') return `/case-studies/${node.slug}`;
  if (contentType === 'field-note') return `/field-notes?focus=${node.slug}`;
  if (contentType === 'idea') return `/ideas?focus=${node.slug}`;
  if (contentType === 'photography') return `/photography?focus=${node.slug}`;
  if (contentType === 'contact') return '/contact';
  return node.sourceUrl ?? `/neural-net?focus=${node.slug}`;
}

function radialPosition(index: number, total: number, radius: number, zOffset: number): AtlasVector3 {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.72,
    z: Math.sin(angle * 1.7) * ATLAS_LAYOUT.zSpread + zOffset,
  };
}

function nodeHaystack(node: NeuralNode) {
  return [
    node.slug,
    node.type,
    node.title,
    node.summary ?? '',
    node.description ?? '',
    node.cluster ?? '',
    node.source,
    ...node.domains,
    ...node.tags,
  ]
    .join(' ')
    .toLowerCase();
}

function shortLabel(title: string) {
  const cleaned = title
    .replace(/^Published:\s*/i, '')
    .replace(/\s*[:|/]\s*.+$/i, '')
    .replace(/\b(multimodal|neuroscience|pipeline|pipelines|framework|application|system|systems)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length <= 28 ? cleaned || title : `${cleaned.slice(0, 25).trim()}...`;
}
