import type { NeuralNode } from '@/lib/data/schemas';

const PERSONAL_DOMAINS = new Set([
  'Life Outside the Lab',
  'Personal Product Experiments',
  'Personal Builds',
]);

const PERSONAL_TAGS = new Set(['personal', 'shasta', 'pets', 'adventure', 'food', 'gaming']);

const PROFESSIONAL_ALLOWLIST = new Set(['woof']);

const PROFESSIONAL_DOMAINS = new Set([
  'Applied AI Products',
  'Audio-Visual Systems',
  'BCI & Real-Time Systems',
  'Bioengineering Hardware',
  'Biomedical ML',
  'Cloud Infrastructure',
  'Electrophysiology Infrastructure',
  'Foundation Models & BCI',
  'Mechanistic Interpretability',
  'NEATLABs Research',
  'Neural Data Analysis',
  'Neural Data Infrastructure',
  'Neural Decoding',
  'Neural Decoding and ML',
  'Neural Foundation Models',
  'Neural Signal Discovery',
  'Neuroscience Research',
  'Publications',
  'Real-Time Creative Neurotech',
  'Scientific DevOps',
  'Scientific Workflow Systems',
]);

const PROFESSIONAL_MODES = new Set(['recruiter', 'researcher', 'builder']);

export function isProfessionalProject(node: NeuralNode) {
  if (node.type !== 'project') return false;
  if (PROFESSIONAL_ALLOWLIST.has(node.slug)) return true;

  const tags = node.tags.map((tag) => tag.toLowerCase());
  const domains = node.domains;
  const cluster = node.cluster ?? '';

  if (domains.some((domain) => PERSONAL_DOMAINS.has(domain))) return false;
  if (PERSONAL_DOMAINS.has(cluster)) return false;
  if (tags.some((tag) => PERSONAL_TAGS.has(tag))) return false;

  if (node.modeVisibility.some((mode) => PROFESSIONAL_MODES.has(mode))) return true;
  if (domains.some((domain) => PROFESSIONAL_DOMAINS.has(domain))) return true;

  const importance = node.computedImportance ?? node.importance;
  return importance >= 80 && Boolean(node.summary || node.description || node.sourceUrl || node.github);
}

export function filterProfessionalProjects(nodes: NeuralNode[]) {
  return nodes.filter(isProfessionalProject);
}
