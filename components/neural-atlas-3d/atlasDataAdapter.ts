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

type CuratedLeafDefinition = {
  slug: string;
  title: string;
  shortLabel?: string;
  summary: string;
  category: string;
  contentType: AtlasLeafContentType;
  morphology: AtlasMorphology;
  route: string;
  externalUrl?: string;
  tags: string[];
  domains: string[];
  importance: number;
  featured?: boolean;
  detail?: AtlasNodeDetail;
  relatedSlugs?: string[];
};

const ROOT_ID = 'neural-atlas-root';
const generatedGraph = NeuralGraphSchema.parse(graphData) as NeuralGraph;

const CURATED_GENERATED_SLUGS: Record<string, string[]> = {
  'professional-work': [
    'datajoint-multimodal-infrastructure',
    'harvard-sabatini-datajoint-pipeline',
    'allen-mindscope-work',
    'lu-lab-deeplabcut-facemap',
    'datajoint-elements-and-templates',
    'spikeinterface-array-ephys',
    'workflow-monitoring-system',
    'neatlabs-core-research',
    'neatlabs-dtw-tca-unpublished',
    'dolby-labs-early-engineering',
    'coeval-and-recent-ai-web-projects',
  ],
  projects: [
    'neuros-v1',
    'neuroforge',
    'neuro-dl-classifier',
    'neuros',
    'neural-mm-tf-mechint',
    'woof',
    'element-deeplabcut',
    'element-facemap',
    'element-array-ephys',
    'datajoint-elements',
    '2dfft_pipeline',
    'quantumbci',
  ],
  publications: [
    'beta-high-gamma-corticostriatal-2025',
    'rodent-default-mode-network-2021',
    'chronic-multisite-probe-designs-2021',
  ],
  'research-ideas': [
    'neural-data-augmentation-m1-kalman',
    'neurosky-led-audio-visualization',
    'bioinformatics-and-biomedical-ml-projects',
  ],
  'personal-interests': ['personal-interests-and-life-nodes'],
};

const MAX_GENERATED_LEAVES_PER_CATEGORY = 12;
const MAX_TOTAL_LEAVES_PER_CATEGORY = 14;
const MAX_RELATED_EDGES = 96;

const CURATED_LEAVES: CuratedLeafDefinition[] = [
  {
    slug: 'identity-applied-ai-neural-systems',
    title: 'Applied AI Scientist / Neural Systems Engineer',
    shortLabel: 'Applied AI Identity',
    summary: 'A builder-researcher profile spanning neuroscience data systems, applied AI products, and real-time neural interfaces.',
    category: 'about',
    contentType: 'external',
    morphology: 'soma',
    route: '/about',
    tags: ['applied-ai', 'neuroscience', 'systems-engineering'],
    domains: ['Identity', 'Applied AI Products', 'Neural Data Infrastructure'],
    importance: 100,
    featured: true,
    relatedSlugs: ['datajoint-multimodal-infrastructure', 'neuros-v1', 'neural-mm-tf-mechint'],
    detail: {
      whyItMatters: 'This is the through-line of the atlas: scientific infrastructure, model-facing engineering, and interfaces that make complex systems navigable.',
    },
  },
  {
    slug: 'neuroscience-data-systems',
    title: 'Neuroscience Data Systems',
    summary: 'Pipelines, schemas, cloud deployments, and lab-facing tooling for multimodal neuroscience experiments.',
    category: 'about',
    contentType: 'external',
    morphology: 'pyramidal',
    route: '/case-studies/datajoint-multimodal-pipelines',
    tags: ['datajoint', 'pipelines', 'neuroscience'],
    domains: ['Neural Data Infrastructure'],
    importance: 96,
    featured: true,
    relatedSlugs: ['datajoint-multimodal-infrastructure', 'harvard-sabatini-datajoint-pipeline'],
  },
  {
    slug: 'multimodal-ml-and-behavior',
    title: 'Multimodal ML and Behavior',
    summary: 'A recurring focus on neural recordings, video, behavior, pose, and model outputs as one analysis surface.',
    category: 'about',
    contentType: 'external',
    morphology: 'stellate',
    route: '/about',
    tags: ['multimodal-ml', 'behavior', 'pose-estimation'],
    domains: ['Scientific Workflow Systems'],
    importance: 92,
    relatedSlugs: ['lu-lab-deeplabcut-facemap', 'element-deeplabcut', 'element-facemap'],
  },
  {
    slug: 'real-time-bci-systems',
    title: 'Real-Time BCI Systems',
    summary: 'Low-latency decoding, streaming, classification, and feedback loops for neural interfaces.',
    category: 'about',
    contentType: 'external',
    morphology: 'axon-terminal',
    route: '/projects/neuros-v1',
    tags: ['bci', 'real-time', 'streaming'],
    domains: ['BCI & Real-Time Systems'],
    importance: 92,
    relatedSlugs: ['neuros-v1', 'neuroforge', 'neuro-dl-classifier'],
  },
  {
    slug: 'creative-builder-signal',
    title: 'Creative Builder Signal',
    summary: 'Taste for strange useful interfaces: neural atlases, visual systems, product experiments, and research tools with personality.',
    category: 'about',
    contentType: 'external',
    morphology: 'stellate',
    route: '/',
    tags: ['creative-tools', 'interfaces', 'product'],
    domains: ['Applied AI Products', 'Life Outside the Lab'],
    importance: 88,
    relatedSlugs: ['sids-neural-net', 'coeval-and-recent-ai-web-projects', 'woof'],
  },
  {
    slug: 'field-attention-shasta-outdoors',
    title: 'Field Attention / Shasta / Outdoors',
    summary: 'Movement, landscape, photography, and Shasta as the perceptual inputs outside the lab.',
    category: 'about',
    contentType: 'photography',
    morphology: 'glial',
    route: '/life',
    tags: ['shasta', 'outdoors', 'photography'],
    domains: ['Life Outside the Lab'],
    importance: 84,
    relatedSlugs: ['personal-interests-and-life-nodes', 'woof'],
  },
  {
    slug: 'panoptic-bio-applied-ai',
    title: 'Panoptic Bio Applied AI',
    shortLabel: 'Panoptic Bio',
    summary: 'Applied AI and clinical intelligence context: evaluation, retrieval, product judgment, and production-oriented AI systems.',
    category: 'professional-work',
    contentType: 'case-study',
    morphology: 'pyramidal',
    route: '/projects',
    tags: ['panoptic-bio', 'clinical-ai', 'rag', 'evaluation'],
    domains: ['Applied AI Products'],
    importance: 86,
    relatedSlugs: ['coeval-and-recent-ai-web-projects', 'neural-mm-tf-mechint'],
    detail: {
      whyItMatters: 'This node represents the applied-AI product side of the portfolio, kept distinct from peer-reviewed neuroscience and infrastructure deployments.',
    },
  },
  {
    slug: 'bci-instrumentation-context',
    title: 'BCI Instrumentation Context',
    summary: 'Instrumentation-adjacent context for neural interfaces: signal capture, feedback loops, hardware constraints, and experimental reliability.',
    category: 'professional-work',
    contentType: 'case-study',
    morphology: 'axon-terminal',
    route: '/case-studies',
    tags: ['bci', 'instrumentation', 'experimental-systems'],
    domains: ['BCI & Real-Time Systems', 'Experimental Systems'],
    importance: 82,
    relatedSlugs: ['icp-monitor-and-emg-morse-projects', 'neuros-v1', 'neuro-dl-classifier'],
    detail: {
      whyItMatters: 'Included cautiously as context for BCI and experimental instrumentation interests where the repo has supporting project material, without overstating any private-company experience.',
    },
  },
  {
    slug: 'paper-archive-neatlabs-context',
    title: 'NEATLABs Publication Context',
    summary: 'The publication cluster is tied to five years of electrophysiology, behavior, experimental systems, and analysis infrastructure.',
    category: 'publications',
    contentType: 'publication',
    morphology: 'interneuron',
    route: '/case-studies/neatlabs-core-research',
    tags: ['publications', 'neatlabs', 'lfp'],
    domains: ['Publications', 'NEATLABs Research'],
    importance: 86,
    relatedSlugs: ['neatlabs-core-research', 'beta-high-gamma-corticostriatal-2025', 'rodent-default-mode-network-2021'],
    detail: {
      myContribution: 'Related context node: summarizes the lab and infrastructure work connected to the peer-reviewed papers without claiming a separate publication.',
      keyFindings: ['Connects the papers back to NEATLABs research infrastructure.', 'Keeps publication reading grounded in the broader atlas story.'],
    },
  },
  {
    slug: 'paper-archive-lfp-signal-thread',
    title: 'LFP Signal Analysis Thread',
    summary: 'A cross-paper thread around local field potentials, oscillations, behavior, and event-aligned neural dynamics.',
    category: 'publications',
    contentType: 'publication',
    morphology: 'interneuron',
    route: '/publications',
    tags: ['lfp', 'oscillations', 'signal-analysis'],
    domains: ['Publications', 'Neural Data Analysis'],
    importance: 82,
    relatedSlugs: ['rodent-default-mode-network-2021', 'beta-high-gamma-corticostriatal-2025', 'neatlabs-dtw-tca-unpublished'],
  },
  {
    slug: 'paper-archive-experimental-methods',
    title: 'Experimental Methods Thread',
    summary: 'Hardware, behavioral rigs, chronic recordings, and the practical systems that make neural datasets possible.',
    category: 'publications',
    contentType: 'publication',
    morphology: 'interneuron',
    route: '/publications',
    tags: ['methods', 'electrophysiology', 'experimental-systems'],
    domains: ['Publications', 'Experimental Systems'],
    importance: 80,
    relatedSlugs: ['chronic-multisite-probe-designs-2021', 'neatlabs-core-research', 'icp-monitor-and-emg-morse-projects'],
  },
  {
    slug: 'brain-foundation-models',
    title: 'Brain Foundation Models',
    summary: 'Long-context models for neural time series, behavior, sessions, modalities, and latent state transitions.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'stellate',
    route: '/ideas',
    tags: ['foundation-models', 'neural-time-series', 'bci'],
    domains: ['Neural Foundation Models'],
    importance: 96,
    featured: true,
    relatedSlugs: ['neuros-v1', 'neuros', 'neural-data-augmentation-m1-kalman'],
  },
  {
    slug: 'mechanistic-interpretability-neural-models',
    title: 'Mechanistic Interpretability for Neural Models',
    summary: 'Circuit-style methods for models trained on brain, behavior, and multimodal experimental data.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'stellate',
    route: '/ideas',
    tags: ['mechanistic-interpretability', 'circuits', 'transformers'],
    domains: ['Mechanistic Interpretability'],
    importance: 94,
    relatedSlugs: ['neural-mm-tf-mechint', 'brain-foundation-models'],
  },
  {
    slug: 'session-stitching',
    title: 'Session Stitching',
    summary: 'Align animals, days, probes, task states, and model embeddings into a usable longitudinal map.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'stellate',
    route: '/ideas',
    tags: ['session-stitching', 'embeddings', 'longitudinal-data'],
    domains: ['Neural Signal Discovery'],
    importance: 90,
    relatedSlugs: ['datajoint-multimodal-infrastructure', 'neatlabs-dtw-tca-unpublished'],
  },
  {
    slug: 'neural-latent-search',
    title: 'Neural Latent Search',
    summary: 'Searchable memory over recordings, behavior, metadata, paper context, code, and model states.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'stellate',
    route: '/ideas',
    tags: ['latent-search', 'retrieval', 'scientific-tools'],
    domains: ['Applied AI Products', 'Neural Data Analysis'],
    importance: 88,
    relatedSlugs: ['coeval-and-recent-ai-web-projects', 'datajoint-multimodal-infrastructure'],
  },
  {
    slug: 'bci-middleware',
    title: 'BCI Middleware',
    summary: 'Middleware for streaming neural data, decoding intent, observing latency, and adapting feedback loops.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'axon-terminal',
    route: '/ideas',
    tags: ['bci', 'middleware', 'closed-loop'],
    domains: ['BCI & Real-Time Systems'],
    importance: 90,
    relatedSlugs: ['neuroforge', 'neuros-v1', 'quantumbci'],
  },
  {
    slug: 'closed-loop-vr-primate-experiments',
    title: 'Closed-Loop VR / Primate Experiments',
    summary: 'Speculative experimental systems for immersive feedback, adaptive tasks, and closed-loop neural interfaces.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'stellate',
    route: '/ideas',
    tags: ['closed-loop', 'vr', 'experimental-systems'],
    domains: ['Experimental Systems', 'BCI & Real-Time Systems'],
    importance: 84,
    relatedSlugs: ['neurosky-led-audio-visualization', 'neuros-v1'],
  },
  {
    slug: 'astrocyte-modeling-placeholder',
    title: 'Astrocyte Modeling Placeholder',
    summary: 'A future research lane for non-neuronal dynamics, brain state, and richer biological context if source material deepens.',
    category: 'research-ideas',
    contentType: 'idea',
    morphology: 'glial',
    route: '/ideas',
    tags: ['astrocytes', 'brain-state', 'future-work'],
    domains: ['Neural Foundation Models'],
    importance: 70,
    detail: {
      whyItMatters: 'Kept intentionally as a placeholder because the repo does not yet contain concrete astrocyte project evidence.',
    },
  },
  {
    slug: 'shasta-trail-scout',
    title: 'Shasta / Trail Scout',
    summary: 'The warm center of the personal layer: hikes, snow, dog-friendly plans, and the outdoor rhythm around the work.',
    category: 'personal-interests',
    contentType: 'external',
    morphology: 'glial',
    route: '/life',
    tags: ['shasta', 'hiking', 'outdoors'],
    domains: ['Life Outside the Lab'],
    importance: 90,
    relatedSlugs: ['woof', 'field-attention-shasta-outdoors'],
  },
  {
    slug: 'mountain-biking-motion',
    title: 'Mountain Biking / Motion',
    summary: 'Fast terrain, attention, balance, and the pleasure of systems that move.',
    category: 'personal-interests',
    contentType: 'external',
    morphology: 'stellate',
    route: '/life',
    tags: ['mountain-biking', 'motion', 'outdoors'],
    domains: ['Life Outside the Lab'],
    importance: 78,
  },
  {
    slug: 'skiing-and-snow',
    title: 'Skiing / Snow',
    summary: 'Cold-weather field input: mountains, snow, speed, and the seasonal counterweight to screen work.',
    category: 'personal-interests',
    contentType: 'external',
    morphology: 'stellate',
    route: '/life',
    tags: ['skiing', 'snow', 'mountains'],
    domains: ['Life Outside the Lab'],
    importance: 76,
  },
  {
    slug: 'hiking-and-adventure',
    title: 'Hiking / Adventure',
    summary: 'The slower side of movement: trails, mountain towns, beach walks, and nature exploration.',
    category: 'personal-interests',
    contentType: 'external',
    morphology: 'stellate',
    route: '/life',
    tags: ['hiking', 'adventure', 'nature'],
    domains: ['Life Outside the Lab'],
    importance: 78,
  },
  {
    slug: 'food-culture-hidden-gems',
    title: 'Food / Culture / Hidden Gems',
    summary: 'Restaurants, cuisines, city wandering, and the small exploratory loops outside technical work.',
    category: 'personal-interests',
    contentType: 'external',
    morphology: 'glial',
    route: '/life',
    tags: ['food', 'culture', 'exploration'],
    domains: ['Life Outside the Lab'],
    importance: 72,
  },
  {
    slug: 'anime-games-comedy',
    title: 'Anime / Games / Comedy',
    summary: 'Story, play, and media as a softer personal cluster: narrative taste, humor, and reset time.',
    category: 'personal-interests',
    contentType: 'external',
    morphology: 'glial',
    route: '/life',
    tags: ['anime', 'games', 'comedy'],
    domains: ['Life Outside the Lab'],
    importance: 70,
  },
  {
    slug: 'landscape-texture-timing',
    title: 'Landscape / Texture / Timing',
    summary: 'Photography as trained attention: light, weather, ridgelines, small surfaces, and when to press the shutter.',
    category: 'photography',
    contentType: 'photography',
    morphology: 'purkinje-inspired',
    route: '/photography',
    tags: ['landscape', 'texture', 'timing'],
    domains: ['Life Outside the Lab'],
    importance: 86,
  },
  {
    slug: 'travel-field-notes',
    title: 'Travel Field Notes',
    summary: 'Cities, roads, coastlines, and fragments of place captured as visual memory rather than stock scenery.',
    category: 'photography',
    contentType: 'photography',
    morphology: 'purkinje-inspired',
    route: '/photography',
    tags: ['travel', 'field-notes', 'cities'],
    domains: ['Life Outside the Lab'],
    importance: 78,
  },
  {
    slug: 'shasta-action-outdoors',
    title: 'Shasta / Action / Outdoors',
    summary: 'Motion and companionship in the field: trails, snow, beaches, and the living parts of a day.',
    category: 'photography',
    contentType: 'photography',
    morphology: 'purkinje-inspired',
    route: '/photography',
    tags: ['shasta', 'action', 'outdoors'],
    domains: ['Life Outside the Lab'],
    importance: 82,
    relatedSlugs: ['shasta-trail-scout', 'woof'],
  },
  {
    slug: 'visual-field-notes-google-photos',
    title: 'Future Google Photos Curation',
    summary: 'A placeholder lane for curated image sets once the real photo archive is connected.',
    category: 'photography',
    contentType: 'photography',
    morphology: 'glial',
    route: '/photography',
    tags: ['photo-archive', 'google-photos', 'future-curation'],
    domains: ['Life Outside the Lab'],
    importance: 66,
  },
  {
    slug: 'quiet-moments-and-small-scenes',
    title: 'Quiet Moments / Small Scenes',
    summary: 'Still water, shadows, signs, strange corners, and tiny visual details that keep asking to be noticed.',
    category: 'photography',
    contentType: 'photography',
    morphology: 'purkinje-inspired',
    route: '/photography',
    tags: ['quiet-moments', 'details', 'attention'],
    domains: ['Life Outside the Lab'],
    importance: 74,
  },
  {
    slug: 'visual-systems-and-interface-taste',
    title: 'Visual Systems / Interface Taste',
    summary: 'The bridge between image-making and interface work: composition, legibility, motion, and attention in complex visual systems.',
    category: 'photography',
    contentType: 'photography',
    morphology: 'purkinje-inspired',
    route: '/photography',
    tags: ['visual-systems', 'interfaces', 'composition'],
    domains: ['Applied AI Products', 'Life Outside the Lab'],
    importance: 76,
    relatedSlugs: ['creative-builder-signal', 'sids-neural-net'],
  },
  {
    slug: 'collaboration-open-signal',
    title: 'Collaboration Open Signal',
    summary: 'A clear path for research conversations, ambitious prototypes, applied AI roles, and systems work.',
    category: 'contact',
    contentType: 'contact',
    morphology: 'axon-terminal',
    route: '/contact',
    tags: ['collaboration', 'research', 'roles'],
    domains: ['Applied AI Products'],
    importance: 96,
    featured: true,
  },
  {
    slug: 'research-conversations',
    title: 'Research Conversations',
    summary: 'Neural data, multimodal ML, BCI systems, interpretability, and scientific tooling.',
    category: 'contact',
    contentType: 'contact',
    morphology: 'axon-terminal',
    route: '/contact',
    tags: ['research', 'neuroscience', 'ml'],
    domains: ['Neural Data Infrastructure'],
    importance: 88,
    relatedSlugs: ['brain-foundation-models', 'datajoint-multimodal-infrastructure'],
  },
  {
    slug: 'applied-ai-systems-contact',
    title: 'Applied AI Systems',
    summary: 'Production-minded AI systems, evaluation, retrieval, product engineering, and interfaces for complex workflows.',
    category: 'contact',
    contentType: 'contact',
    morphology: 'axon-terminal',
    route: '/contact',
    tags: ['applied-ai', 'product', 'systems'],
    domains: ['Applied AI Products'],
    importance: 86,
    relatedSlugs: ['panoptic-bio-applied-ai', 'coeval-and-recent-ai-web-projects'],
  },
  {
    slug: 'email-terminal',
    title: 'Email Terminal',
    summary: 'Direct contact for collaborations, roles, research threads, and project conversations.',
    category: 'contact',
    contentType: 'contact',
    morphology: 'axon-terminal',
    route: '/contact',
    externalUrl: 'mailto:sidharth.hulyalkar@gmail.com',
    tags: ['email', 'contact'],
    domains: ['Contact'],
    importance: 82,
  },
  {
    slug: 'github-output',
    title: 'GitHub Output',
    summary: 'The public code trail: experiments, forks, tools, prototypes, and working artifacts.',
    category: 'contact',
    contentType: 'contact',
    morphology: 'axon-terminal',
    route: '/contact',
    externalUrl: 'https://github.com/sidhulyalkar',
    tags: ['github', 'code'],
    domains: ['Contact'],
    importance: 80,
    relatedSlugs: ['neuros-v1', 'neuroforge'],
  },
  {
    slug: 'linkedin-signal',
    title: 'LinkedIn Signal',
    summary: 'Professional background, current positioning, and an easy route for recruiters or collaborators.',
    category: 'contact',
    contentType: 'contact',
    morphology: 'axon-terminal',
    route: '/contact',
    externalUrl: 'https://linkedin.com/in/sidhulyalkar',
    tags: ['linkedin', 'roles'],
    domains: ['Contact'],
    importance: 78,
  },
];

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'about',
    title: 'About / Identity',
    shortLabel: 'Identity',
    route: '/about',
    summary: 'The central soma for identity: applied AI, neuroscience systems, multimodal ML, real-time interfaces, and the field inputs around them.',
    morphology: 'soma',
    contentType: 'external',
    keywords: ['identity', 'about', 'personal', 'dolby', 'coeval'],
    domains: ['Life Outside the Lab'],
    clusters: ['Life Outside the Lab'],
  },
  {
    id: 'professional-work',
    title: 'Professional Work / Deployed Systems',
    shortLabel: 'Deployed Systems',
    route: '/case-studies',
    summary: 'Credibility layer for deployed research infrastructure, lab systems, DataJoint pipelines, and applied AI work.',
    morphology: 'pyramidal',
    contentType: 'case-study',
    keywords: ['datajoint', 'harvard', 'sabatini', 'allen', 'mindscope', 'neatlabs', 'workflow', 'lu lab', 'deeplabcut', 'facemap'],
    domains: ['Neural Data Infrastructure', 'Scientific Workflow Systems', 'Scientific DevOps', 'NEATLABs Research'],
    clusters: ['Neural Data Infrastructure', 'Scientific Workflow Systems', 'Scientific DevOps', 'NEATLABs Research'],
  },
  {
    id: 'projects',
    title: 'Projects / Code / Build Cortex',
    shortLabel: 'Build Cortex',
    route: '/projects',
    summary: 'Code artifacts and engineering taste: neural tooling, BCI experiments, DataJoint Elements, AI systems, and working prototypes.',
    morphology: 'pyramidal',
    contentType: 'project',
    keywords: ['github', 'python', 'typescript', 'neuros', 'neuroforge', 'pipeline', 'agent', 'classifier', 'app'],
    domains: ['Applied AI Products', 'BCI & Real-Time Systems', 'Cloud Infrastructure'],
    clusters: ['Applied AI Products', 'Foundation Models & BCI', 'Cloud Infrastructure', 'DataJoint Elements'],
  },
  {
    id: 'publications',
    title: 'Publications / Paper Archive',
    shortLabel: 'Paper Archive',
    route: '/publications',
    summary: 'A violet archive for peer-reviewed work, neural behavior, electrophysiology, and paper detail chambers.',
    morphology: 'interneuron',
    contentType: 'publication',
    keywords: ['publication', 'paper', 'journal', 'doi', 'electrophysiology', 'neuroscience'],
    domains: ['Publications', 'Neural Data Analysis', 'Experimental Systems'],
    clusters: ['Publications', 'Neuroscience Research'],
  },
  {
    id: 'research-ideas',
    title: 'Research Ideas / Speculative Circuits',
    shortLabel: 'Speculative Circuits',
    route: '/ideas',
    summary: 'Grounded speculation around brain foundation models, interpretability, session stitching, latent search, and closed-loop systems.',
    morphology: 'stellate',
    contentType: 'idea',
    keywords: ['foundation', 'mechanistic', 'interpretability', 'bci', 'neurofmx', 'neuros', 'kalman', 'transformer', 'neural signal'],
    domains: ['Mechanistic Interpretability', 'Neural Foundation Models', 'Neural Decoding and ML', 'Neural Signal Discovery'],
    clusters: ['Mechanistic Interpretability', 'Foundation Models & BCI', 'Neural Decoding and ML', 'Neural Signal Discovery'],
  },
  {
    id: 'personal-interests',
    title: 'Personal Interests / Field Inputs',
    shortLabel: 'Field Inputs',
    route: '/life',
    summary: 'Personality without diluting the professional signal: movement, Shasta, food, media, and life outside the lab.',
    morphology: 'glial',
    contentType: 'external',
    keywords: ['personal', 'life', 'woof', 'petpath', 'shasta', 'pet', 'audio', 'visualization'],
    domains: ['Life Outside the Lab', 'Personal Projects', 'Personal Product Experiments'],
    clusters: ['Life Outside the Lab', 'Personal Projects', 'Real-Time Creative Neurotech'],
  },
  {
    id: 'photography',
    title: 'Photography / Visual Field Notes',
    shortLabel: 'Visual Field Notes',
    route: '/photography',
    summary: 'Visual field notes for landscape, texture, timing, travel, outdoor motion, and future photo curation.',
    morphology: 'purkinje-inspired',
    contentType: 'photography',
    keywords: ['photo', 'photography', 'field', 'field-note', 'shasta', 'creative', 'travel'],
    domains: ['Life Outside the Lab', 'Personal Projects'],
    clusters: ['Life Outside the Lab', 'Personal Projects'],
  },
  {
    id: 'contact',
    title: 'Contact / Open Signal',
    shortLabel: 'Open Signal',
    route: '/contact',
    summary: 'Open signal for collaborations, roles, research conversations, applied AI systems, and external links.',
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
  const generatedLeaves = leafAssignments.map(({ node, categoryId, leafIndex, siblingCount }) =>
    leafToNode(node, categoryId, leafIndex, siblingCount)
  );
  const curatedLeaves = buildCuratedLeafNodes(generatedLeaves);
  const leaves = [...generatedLeaves, ...curatedLeaves];

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
  const curatedRelatedEdges = buildCuratedRelatedEdges(leaves, slugToLeafId);
  const edges = [...categoryEdges, ...leafEdges, ...relatedEdges, ...curatedRelatedEdges];

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
  const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]));
  const usedSlugs = new Set<string>();
  const grouped = new Map<string, NeuralNode[]>();

  for (const category of CATEGORY_DEFINITIONS) {
    const curatedSlugs = CURATED_GENERATED_SLUGS[category.id] ?? [];
    const generatedLimit = generatedLeafLimitForCategory(category.id);
    for (const slug of curatedSlugs) {
      const node = nodeBySlug.get(slug);
      if (!node || usedSlugs.has(slug)) continue;
      if ((grouped.get(category.id)?.length ?? 0) >= generatedLimit) continue;
      usedSlugs.add(slug);
      grouped.set(category.id, [...(grouped.get(category.id) ?? []), node]);
    }
  }

  const sortedNodes = [...nodes].sort(
    (a, b) => (b.computedImportance ?? b.importance) - (a.computedImportance ?? a.importance)
  );

  for (const node of sortedNodes) {
    if (usedSlugs.has(node.slug)) continue;
    const categoryId = pickCategory(node);
    const generatedLimit = generatedLeafLimitForCategory(categoryId);
    const existingCount = grouped.get(categoryId)?.length ?? 0;
    if (existingCount >= generatedLimit) continue;
    usedSlugs.add(node.slug);
    grouped.set(categoryId, [...(grouped.get(categoryId) ?? []), node]);
  }

  return Array.from(grouped.entries()).flatMap(([categoryId, categoryNodes]) =>
    categoryNodes.map((node, leafIndex, siblings) => ({
      node,
      categoryId,
      leafIndex,
      siblingCount: siblings.length,
    }))
  );
}

function generatedLeafLimitForCategory(categoryId: string) {
  const curatedCount = CURATED_LEAVES.filter((leaf) => leaf.category === categoryId).length;
  return Math.max(0, Math.min(MAX_GENERATED_LEAVES_PER_CATEGORY, MAX_TOTAL_LEAVES_PER_CATEGORY - curatedCount));
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
  const base = categoryBasePosition(categoryId);
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

function buildCuratedLeafNodes(existingLeaves: AtlasNode[]): AtlasNode[] {
  const usedSlugs = new Set(existingLeaves.map((leaf) => leaf.slug));
  const categoryCounts = new Map<string, number>();

  for (const leaf of existingLeaves) {
    categoryCounts.set(leaf.category, (categoryCounts.get(leaf.category) ?? 0) + 1);
  }

  const groupedDefinitions = CATEGORY_DEFINITIONS.flatMap((category) => {
    const definitions = CURATED_LEAVES.filter((leaf) => leaf.category === category.id && !usedSlugs.has(leaf.slug));
    const existingCount = categoryCounts.get(category.id) ?? 0;
    const totalLeaves = Math.max(1, existingCount + definitions.length);

    return definitions.map((definition, index) => ({
      definition,
      leafIndex: existingCount + index,
      totalLeaves,
    }));
  });

  return groupedDefinitions.map(({ definition, leafIndex, totalLeaves }) => curatedLeafToNode(definition, leafIndex, totalLeaves));
}

function curatedLeafToNode(definition: CuratedLeafDefinition, leafIndex: number, totalLeaves: number): AtlasNode {
  const categoryIndex = CATEGORY_DEFINITIONS.findIndex((category) => category.id === definition.category);
  const base = categoryBasePosition(definition.category);
  const offset = radialPosition(leafIndex, totalLeaves, ATLAS_LAYOUT.leafRadius, (categoryIndex % 3) - 1);
  const color = CATEGORY_COLORS[definition.category] ?? '#66e3ff';

  return {
    id: `leaf:${definition.slug}`,
    slug: definition.slug,
    title: definition.title,
    shortLabel: definition.shortLabel ?? shortLabel(definition.title),
    summary: definition.summary,
    kind: 'leaf',
    contentType: definition.contentType,
    morphology: definition.morphology,
    category: definition.category,
    parentId: definition.category,
    childrenIds: [],
    relatedIds: [],
    position: {
      x: base.x + offset.x,
      y: base.y + offset.y,
      z: base.z + offset.z,
    },
    scale: Math.max(0.42, Math.min(0.92, definition.importance / 112)),
    color,
    route: definition.route,
    externalUrl: definition.externalUrl ?? null,
    detail: {
      description: definition.summary,
      whyItMatters: definition.detail?.whyItMatters,
      myContribution: definition.detail?.myContribution,
      summaryBullets: definition.detail?.summaryBullets,
      methods: definition.detail?.methods,
      keyFindings: definition.detail?.keyFindings,
      architectureHighlights: definition.detail?.architectureHighlights,
      representativeFiles: definition.detail?.representativeFiles,
      demonstrates: definition.detail?.demonstrates,
      paperPdfPath: definition.detail?.paperPdfPath,
      externalLinks: definition.detail?.externalLinks,
      relatedProjects: definition.detail?.relatedProjects,
    },
    tags: definition.tags,
    domains: definition.domains,
    importance: definition.importance,
    featured: definition.featured ?? definition.importance >= 90,
    hiddenUntilParentFocused: true,
  };
}

function detailForNode(node: NeuralNode, contentType: AtlasLeafContentType, categoryId: string): AtlasNodeDetail {
  if (contentType === 'publication') {
    const pub = node.publication;
    return {
      description: pub?.abstract ?? node.description ?? node.summary,
      whyItMatters: pub?.whyItMatters,
      myContribution: pub?.myContribution ?? publicationContributionForNode(node),
      summaryBullets: publicationSummaryBullets(node),
      methods: pub?.methods ?? [],
      keyFindings: pub?.keyFindings ?? [],
      paperPdfPath: pub?.localPdfPath,
      externalLinks: pub?.externalLinks && pub.externalLinks.length > 0 ? pub.externalLinks : publicationExternalLinks(node),
      relatedProjects: pub?.relatedProjects ?? [],
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
  const bullets: string[] = [...(pub?.keyFindings ?? [])];

  if (pub?.summary && !bullets.includes(pub.summary)) bullets.unshift(pub.summary);
  if (node.summary && !bullets.includes(node.summary)) bullets.push(node.summary);
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

function publicationExternalLinks(node: NeuralNode) {
  const pub = node.publication;
  return [
    pub?.doi ? { label: 'DOI', href: `https://doi.org/${pub.doi}` } : null,
    pub?.pmid ? { label: 'PubMed', href: `https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}` } : null,
    pub?.pmcid ? { label: 'PMC', href: `https://www.ncbi.nlm.nih.gov/pmc/articles/${pub.pmcid}` } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));
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

  return relatedEdges.slice(0, MAX_RELATED_EDGES);
}

function buildCuratedRelatedEdges(leaves: AtlasNode[], slugToLeafId: Map<string, string>) {
  const leafBySlug = new Map(leaves.map((leaf) => [leaf.slug, leaf]));
  const edgeKeys = new Set<string>();
  const relatedEdges: AtlasEdge[] = [];

  for (const definition of CURATED_LEAVES) {
    const source = slugToLeafId.get(definition.slug);
    if (!source || !definition.relatedSlugs) continue;

    for (const relatedSlug of definition.relatedSlugs) {
      const target = slugToLeafId.get(relatedSlug);
      if (!target || target === source) continue;

      const sortedKey = [definition.slug, relatedSlug].sort().join(':');
      if (edgeKeys.has(sortedKey)) continue;
      edgeKeys.add(sortedKey);

      const sourceLeaf = leafBySlug.get(definition.slug);
      relatedEdges.push(
        makeEdge({
          id: `curated-related:${definition.slug}:${relatedSlug}`,
          source,
          target,
          relation: 'related',
          strength: 0.42,
          curveType: 'bundle',
          color: sourceLeaf ? `${sourceLeaf.color}66` : 'rgba(167,139,250,0.32)',
          signalDelay: (relatedEdges.length % 12) * 0.045,
          dendriteBranches: 1,
          visibleInStates: ['category', 'detail', 'reading'],
        })
      );
    }
  }

  return relatedEdges;
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

function categoryBasePosition(categoryId: string): AtlasVector3 {
  if (categoryId === 'about') return { x: 0, y: 0, z: 0.35 };

  const outerCategories = CATEGORY_DEFINITIONS.filter((category) => category.id !== 'about');
  const categoryIndex = outerCategories.findIndex((category) => category.id === categoryId);
  return radialPosition(Math.max(0, categoryIndex), outerCategories.length, ATLAS_LAYOUT.overviewRadius, 0);
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
