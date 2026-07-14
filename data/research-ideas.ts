export interface ResearchIdea {
  id: string;
  title: string;
  thesis: string;
  whyItMatters: string;
  methods: string[];
  relatedWork: string[];
  sourceLinks?: {
    label: string;
    href: string;
  }[];
  openQuestion?: string;
  domains: string[];
  status: 'sketch' | 'draft' | 'active';
  color: 'cyan' | 'violet' | 'green' | 'amber' | 'rose';
}

export const researchIdeas: ResearchIdea[] = [
  {
    id: 'inhibition-dynamics',
    title: 'Neural Dynamics of Inhibition',
    thesis: 'Model inhibition as a dynamical systems problem linking neural state, behavior, and intervention.',
    whyItMatters: 'My NEATLABs work sits close to the question of how cortico-striatal circuits coordinate reward, action suppression, and decision timing. I want to build analyses that treat inhibition as a living trajectory through neural state space rather than a static trial label.',
    methods: ['Event-aligned LFP analysis', 'Spectral dynamics', 'State-space modeling', 'Tensor component analysis', 'Behavioral alignment'],
    relatedWork: ['NEATLABs research', 'Cortico-striatal reward studies', 'DTW/TCA analyses'],
    openQuestion: 'Can inhibition be represented as a reusable neural-state motif across tasks, species, and recording modalities?',
    domains: ['neural dynamics', 'inhibition', 'decision-making'],
    status: 'active',
    color: 'green',
  },
  {
    id: 'naturalistic-video-encoding',
    title: 'Neural Encoding of Naturalistic Video',
    thesis: 'Build brain encoding models for naturalistic video and content, then score them on region-specific, noise-ceiling-normalized, control-matched prediction behind preregistered gates rather than aggregate correlation.',
    whyItMatters: 'Inspired by Meta\'s TRIBE, this is a falsification-first harness for predicting fMRI responses to movies. The honest contribution so far is methodological: most early "movie-encoding wins" turned out to be artifacts — run-position leakage, BOLD autocorrelation, stimulus-timing warps — caught only by preregistered controls. What survives is a cross-dataset-confirmed visual encoder (DINOv2 + low-level + RAFT-motion composite) that transfers across subject, movie, and dataset, alongside well-powered negative results for audio, affective, and learned-temporal features. The recurring real finding is mapping non-stationarity: a linear feature-to-BOLD map fit on one content does not transfer to other content.',
    methods: ['DINOv2 / self-supervised video features', 'RAFT optical-flow motion', 'Ridge encoding to Schaefer parcels', 'Noise-ceiling normalization', 'Preregistration + permutation nulls', 'Cross-dataset transfer'],
    relatedWork: ['Meta TRIBE v2', 'BoldMoments', 'CNeuroMod movie10', 'StudyForrest', 'Emo-FilM'],
    sourceLinks: [
      {
        label: 'Case study: RetinoAffective encoding harness',
        href: '/case-studies/retinoaffective-video-encoding',
      },
    ],
    openQuestion: 'Can a single feature-to-brain map generalize across content, or is mapping non-stationarity the real signal — and what architecture would encode it honestly?',
    domains: ['brain encoding', 'naturalistic video', 'falsification-first modeling'],
    status: 'active',
    color: 'amber',
  },
  {
    id: 'dataset-reuse-search',
    title: 'Neural Search for Dataset Reuse',
    thesis: 'Build search systems that retrieve reusable experiments, not just documents or metadata.',
    whyItMatters: 'A lot of scientific value is stranded inside datasets that are technically public but practically hard to reinterpret. I am interested in search that understands task structure, behavior, modality, brain region, provenance, and analysis intent, then returns dataset cards, missing-context warnings, and starter notebooks for reuse.',
    methods: ['Behavioral ontologies', 'Hybrid retrieval', 'Embedding search', 'Provenance modeling', 'Dataset cards'],
    relatedWork: ['neural-search', 'DataJoint pipelines', 'NWB data infrastructure'],
    sourceLinks: [
      {
        label: 'sidhulyalkar/neural-search',
        href: 'https://github.com/sidhulyalkar/neural-search',
      },
    ],
    openQuestion: 'How do we make old datasets scientifically alive again without hiding the assumptions that made them?',
    domains: ['dataset reuse', 'scientific search', 'knowledge systems'],
    status: 'active',
    color: 'cyan',
  },
  {
    id: 'source-data-augmentation',
    title: 'Neural Data Augmentation at the Source',
    thesis: 'Rethink limited neural datasets by generating useful variation from the structure already present in the signal.',
    whyItMatters: 'I enjoy thinking about data at the source: what was measured, what was lost, what can be reinterpreted, and what assumptions are silently packaged into the dataset. Neural augmentation is one expression of that instinct: expanding limited training examples while staying honest about signal geometry, behavior, and decoder goals.',
    methods: ['Spike-train augmentation', 'Kalman decoding', 'State-space models', 'Limited-sample learning', 'Error analysis'],
    relatedWork: ['Neural-Data-Augmentation-Model', 'M1 motor decoding', 'BCI modeling'],
    sourceLinks: [
      {
        label: 'sidhulyalkar/Neural-Data-Augmentation-Model',
        href: 'https://github.com/sidhulyalkar/Neural-Data-Augmentation-Model',
      },
    ],
    openQuestion: 'What transformations preserve neural meaning, and which ones only make a model feel more confident?',
    domains: ['data augmentation', 'neural decoding', 'source-level data'],
    status: 'active',
    color: 'rose',
  },
  {
    id: 'quantum-neuro-bci',
    title: 'Quantum Computing for Neural Interfaces',
    thesis: 'Explore whether quantum-inspired models can offer new representations for uncertain, high-dimensional neural signals.',
    whyItMatters: 'Neuroscience and quantum computing share a taste for difficult state spaces, uncertainty, and measurement-limited inference. I am interested in careful, grounded experiments where quantum or quantum-inspired methods are tested against neural decoding, BCI classification, and latent-state discovery rather than treated as buzzwords.',
    methods: ['Quantum kernels', 'Variational circuits', 'Hybrid classical-quantum models', 'Neural decoding benchmarks'],
    relatedWork: ['QuantumBCI', 'BCI classifier work', 'Neural signal modeling'],
    sourceLinks: [
      {
        label: 'sidhulyalkar/QuantumBCI',
        href: 'https://github.com/sidhulyalkar/QuantumBCI',
      },
    ],
    openQuestion: 'Where does quantum representation actually help neural inference, and where is classical structure enough?',
    domains: ['quantum ML', 'BCI', 'neural representation'],
    status: 'draft',
    color: 'violet',
  },
  {
    id: 'foundation-neural',
    title: 'Foundation Models for Brain State Dynamics',
    thesis: 'Train large models on diverse neural recordings to learn transferable representations of brain state.',
    whyItMatters: 'Current neural analysis is often task-specific and session-specific. A foundation model trained across neural time series, behavior, metadata, and experimental context could enable cross-subject transfer, session stitching, and discovery of reusable state motifs.',
    methods: ['Long-sequence models', 'Self-supervised pretraining', 'Multi-task learning', 'Contrastive objectives', 'Cross-session alignment'],
    relatedWork: ['Neural search', 'BCI classifier work', 'Population dynamics analysis'],
    openQuestion: 'What is the right tokenization strategy for neural signals with varying sampling rates?',
    domains: ['neural time series', 'foundation models', 'transfer learning'],
    status: 'active',
    color: 'violet',
  },
  {
    id: 'mechinterp-neuro',
    title: 'Mechanistic Interpretability for Neural Models',
    thesis: 'Apply interpretability tools to models trained on brain data.',
    whyItMatters: 'Understanding what neural network models learn about brain activity could reveal new neuroscientific hypotheses. Circuit discovery in silico could guide experimental design.',
    methods: ['Path patching', 'ACDC circuit discovery', 'Activation patching', 'Counterfactual interventions', 'Probing classifiers'],
    relatedWork: ['TransformerLens interpretability notebooks', 'Neural population dynamics work'],
    openQuestion: 'Do learned features correspond to known cell types or brain regions?',
    domains: ['interpretability', 'neuroAI', 'model analysis'],
    status: 'active',
    color: 'green',
  },
  {
    id: 'bci-middleware',
    title: 'Real-Time BCI Middleware',
    thesis: 'Build the missing infrastructure for closed-loop neuroscience.',
    whyItMatters: 'Current BCI systems are monolithic. A modular middleware layer could enable hot-swappable decoders, real-time QC, drift detection, and adaptive control without custom engineering.',
    methods: ['Streaming architectures', 'Low-latency inference', 'Online learning', 'Observability/monitoring'],
    relatedWork: ['ECoG classifier projects', 'Real-time systems experience'],
    openQuestion: 'How do you balance latency requirements with model complexity?',
    domains: ['BCI', 'real-time systems', 'infrastructure'],
    status: 'draft',
    color: 'amber',
  },
  {
    id: 'behavior-circuit-mapping',
    title: 'Behavior and Circuit State Mapping',
    thesis: 'Map behavior as the visible projection of hidden neural computation.',
    whyItMatters: 'Behavior is the readout that gives neural signals their stakes. I want tools that connect pose, facial inference, task events, reward history, and neural dynamics into interpretable circuit-state maps that scientists can inspect at scale.',
    methods: ['Pose estimation', 'Facemap features', 'Action segmentation', 'Manifold learning', 'Multimodal synchronization'],
    relatedWork: ['DeepLabCut integration', 'Facemap analysis', 'DataJoint visualizations'],
    openQuestion: 'How do we define behavioral units that are stable enough for computation but rich enough for biology?',
    domains: ['behavior', 'computer vision', 'circuit dynamics'],
    status: 'active',
    color: 'rose',
  },
  {
    id: 'scientific-operating-systems',
    title: 'Scientific Operating Systems',
    thesis: 'Design infrastructure where raw data, analysis, provenance, search, and visualization behave like one coherent research environment.',
    whyItMatters: 'Large-scale neuroscience is not only a modeling problem; it is a systems problem. The creative challenge is building environments where scientists can move from raw acquisition to interpretation without losing lineage, context, or trust.',
    methods: ['Workflow orchestration', 'Cloud data systems', 'Provenance graphs', 'Real-time QC', 'Interactive visualization'],
    relatedWork: ['DataJoint deployments', 'Harvard/Sabatini pipeline', 'Allen Mindscope workflows'],
    openQuestion: 'What would it feel like if a neuroscience data platform were built around scientific thought instead of storage conventions?',
    domains: ['large-scale systems', 'scientific infrastructure', 'data trust'],
    status: 'draft',
    color: 'cyan',
  },
];
