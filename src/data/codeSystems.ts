export type CodeSystem = {
  title: string;
  summary: string;
  tags: string[];
  href?: string;
  repo?: string;
  route?: string;
};

export const codeSystems: CodeSystem[] = [
  {
    title: 'Neural Data Infrastructure',
    summary:
      'DataJoint-centered workflows for calcium imaging, electrophysiology, pose estimation, photometry, metadata, and lab-scale reproducibility.',
    tags: ['DataJoint', 'AWS', 'Docker', 'multimodal neuroscience'],
    route: '/projects/datajoint-multimodal-infrastructure',
  },
  {
    title: 'BCI Middleware and Real-Time Systems',
    summary:
      'Streaming, decoding, feedback, and orchestration experiments where latency and observability are part of the product surface.',
    tags: ['BCI', 'real-time', 'middleware', 'closed loop'],
    route: '/projects/neuros-v1',
    repo: 'https://github.com/sidhulyalkar/neurOS-v1',
  },
  {
    title: 'Multimodal ML and Interpretability',
    summary:
      'Transformer and representation-learning experiments for neural time series, behavior, and model interpretability.',
    tags: ['transformers', 'mechanistic interpretability', 'neural data'],
    route: '/projects/neural-mm-tf-mechint',
    repo: 'https://github.com/sidhulyalkar/neural-mm-tf-mechint',
  },
  {
    title: 'Applied AI Product Engineering',
    summary:
      'Fast product prototypes, AI workflows, interfaces, and cloud-backed systems that turn ambiguous ideas into usable tools.',
    tags: ['applied AI', 'product', 'TypeScript', 'systems'],
    route: '/projects/coeval-and-recent-ai-web-projects',
  },
];
