// Enhanced content for key projects that adds context beyond GitHub metadata
export interface ProjectEnhancement {
  slug: string;
  tagline: string;
  whyItMatters: string;
  whatIBuilt: string[];
  technicalHighlights: string[];
  notebooksIncluded?: string[];
}

export const projectEnhancements: Record<string, ProjectEnhancement> = {
  'neural-mm-tf-mechint': {
    slug: 'neural-mm-tf-mechint',
    tagline: 'Interpretability tools for understanding neural network internals',
    whyItMatters: 'Understanding how neural networks process information is critical for building trustworthy AI systems. This package provides hands-on tools for inspecting model activations, discovering circuits, and performing causal interventions.',
    whatIBuilt: [
      'TransformerLens-based interpretability toolkit',
      'Path patching implementation for circuit discovery',
      'Activation patching and causal intervention utilities',
      'Probing classifiers for feature analysis',
      'Visualization tools for attention patterns and activations',
    ],
    technicalHighlights: [
      'ACDC-style circuit discovery workflows',
      'Counterfactual intervention framework',
      'Latent space surgery and ablation studies',
      'Manifold analysis for neural representations',
      'Integration with Hugging Face transformers',
    ],
    notebooksIncluded: [
      'Introduction to Mechanistic Interpretability',
      'Path Patching Tutorial',
      'Circuit Discovery with ACDC',
      'Probing Classifier Walkthrough',
      'Attention Pattern Visualization',
    ],
  },
  'neuros-v1': {
    slug: 'neuros-v1',
    tagline: 'Operating system concepts for neural data infrastructure',
    whyItMatters: 'Neural data processing pipelines are fragmented across tools and formats. This project explores a unified abstraction layer for managing neural recordings, processing, and analysis workflows.',
    whatIBuilt: [
      'Unified data ingestion layer for multiple recording formats',
      'Pipeline orchestration with provenance tracking',
      'Cloud-native processing architecture',
      'Real-time and batch processing modes',
    ],
    technicalHighlights: [
      'DataJoint integration for workflow management',
      'NWB and Zarr format support',
      'AWS infrastructure automation',
      'Docker/Kubernetes deployment patterns',
    ],
  },
  'neuroforge': {
    slug: 'neuroforge',
    tagline: 'Tools for forging neural data analysis pipelines',
    whyItMatters: 'Building reproducible neural data pipelines requires consistent tooling across calcium imaging, electrophysiology, and behavioral analysis. NeuroForge provides reusable components.',
    whatIBuilt: [
      'Modular pipeline components for common neural analyses',
      'Integration with Suite2p, DeepLabCut, Facemap',
      'Cloud-based training and inference workflows',
      'Standardized data schemas and validation',
    ],
    technicalHighlights: [
      'GPU-accelerated processing pipelines',
      'Automated QC and artifact detection',
      'Multi-session alignment utilities',
      'Behavioral video synchronization',
    ],
  },
  'element-deeplabcut': {
    slug: 'element-deeplabcut',
    tagline: 'DataJoint Element for markerless pose estimation',
    whyItMatters: 'DeepLabCut enables markerless pose estimation but integrating it into reproducible workflows requires careful data management. This Element provides a standardized DataJoint interface.',
    whatIBuilt: [
      'DataJoint schema for DeepLabCut projects',
      'Cloud-based training pipeline',
      'Automated inference on new videos',
      'Integration with behavioral analysis downstream',
    ],
    technicalHighlights: [
      'AWS GPU instance orchestration',
      'Model versioning and artifact tracking',
      'Multi-animal pose estimation support',
      'Batch inference optimization',
    ],
  },
  'element-facemap': {
    slug: 'element-facemap',
    tagline: 'DataJoint Element for orofacial behavior tracking',
    whyItMatters: 'Facemap extracts rich behavioral signals from face videos. This Element enables reproducible Facemap processing integrated with neural data workflows.',
    whatIBuilt: [
      'DataJoint schema for Facemap analysis',
      'Automated SVD-based motion energy extraction',
      'Cloud training for Facemap neural network',
      'Integration with neural recording timestamps',
    ],
    technicalHighlights: [
      'Streaming video processing',
      'GPU-accelerated feature extraction',
      'Multi-view camera support',
      'Behavioral event alignment',
    ],
  },
  'element-calcium-imaging': {
    slug: 'element-calcium-imaging',
    tagline: 'DataJoint Element for calcium imaging analysis',
    whyItMatters: 'Calcium imaging data requires motion correction, cell detection, and signal extraction. This Element standardizes the workflow from raw movies to neural traces.',
    whatIBuilt: [
      'DataJoint schema for Suite2p and CaImAn',
      'Automated motion correction pipeline',
      'ROI detection and signal extraction',
      'Quality control metrics and visualization',
    ],
    technicalHighlights: [
      'Large-file handling with chunked processing',
      'GPU acceleration for motion correction',
      'Multi-plane imaging support',
      'Integration with behavioral timestamps',
    ],
  },
  'woof': {
    slug: 'woof',
    tagline: 'Personal project showcasing my dog Shasta',
    whyItMatters: 'Life outside the lab matters. This is a fun side project.',
    whatIBuilt: [
      'Photo gallery of Shasta adventures',
      'Custom styling and layout',
    ],
    technicalHighlights: [
      'Next.js image optimization',
      'Responsive gallery design',
    ],
  },
};

export function getProjectEnhancement(slug: string): ProjectEnhancement | null {
  return projectEnhancements[slug] || null;
}
