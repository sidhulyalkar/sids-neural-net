// Per-package architecture diagrams for the neurOS-v1 monorepo briefs.
import type { DiagramDefinition } from './diagram-types';

export type PackageDiagramVariant =
  | 'pkg-core'
  | 'pkg-drivers'
  | 'pkg-models'
  | 'pkg-foundation'
  | 'pkg-neurofm'
  | 'pkg-mechint'
  | 'pkg-cloud'
  | 'pkg-sourceweigher'
  | 'pkg-ui';

export const packageDiagrams: Record<PackageDiagramVariant, DiagramDefinition> = {
  'pkg-core': {
    eyebrow: 'package map',
    title: 'neuros-core — agents, pipeline, and processing',
    summary:
      'The runtime heart of neurOS: an async agent orchestrator, the processing pipeline, and CV plugins that turn streamed signals into real-time inference.',
    lanes: [
      {
        label: 'Comprises',
        nodes: [
          { title: 'Agents', subtitle: 'device, processing, model, fusion, pose, video, calcium', tone: 'cyan' },
          { title: 'Pipeline', subtitle: 'orchestration, alignment, augmentation, benchmarks', tone: 'cyan' },
          { title: 'Processing', subtitle: 'filters, feature extraction, adaptation, health', tone: 'cyan' },
        ],
      },
      {
        label: 'Also holds',
        nodes: [
          { title: 'CV plugins', subtitle: 'DINOv3 backbone, feature matching, seg head', tone: 'violet' },
          { title: 'Autoconfig', subtitle: 'automatic pipeline configuration', tone: 'violet' },
          { title: 'Security', subtitle: 'access and safety layer', tone: 'violet' },
        ],
      },
      {
        label: 'Role',
        nodes: [
          { title: 'Real-time engine', subtitle: 'coordinates agents into a live pipeline', tone: 'green' },
          { title: 'Adaptive', subtitle: 'agents adapt when signals degrade', tone: 'green' },
        ],
      },
    ],
    outputs: ['agent orchestration', 'real-time pipeline', 'adaptive processing'],
  },
  'pkg-drivers': {
    eyebrow: 'package map',
    title: 'neuros-drivers — device adapters and I/O',
    summary:
      'A unified, hot-swappable driver API across 16+ biosignal modalities plus NWB/Zarr I/O, so any device plugs in behind one contract without touching the pipeline.',
    lanes: [
      {
        label: 'Neural / ephys',
        nodes: [
          { title: 'EEG via BrainFlow', subtitle: 'headsets and amplifiers', tone: 'cyan' },
          { title: 'ECoG / EMG / EOG / ECG', subtitle: 'invasive and peripheral electrodes', tone: 'cyan' },
        ],
      },
      {
        label: 'Optical / autonomic',
        nodes: [
          { title: 'Calcium / video / fNIRS', subtitle: 'imaging and optical signals', tone: 'violet' },
          { title: 'GSR / respiration / motion / phone / hormone / audio', subtitle: 'autonomic and context sensors', tone: 'violet' },
        ],
      },
      {
        label: 'I/O and dev',
        nodes: [
          { title: 'NWB / Zarr I/O', subtitle: 'standards-compliant read and write', tone: 'green' },
          { title: 'Mock / dataset drivers', subtitle: 'hardware-free deterministic runs', tone: 'green' },
        ],
      },
    ],
    outputs: ['16+ modalities', 'one driver contract', 'NWB/Zarr I/O', 'hot-swappable'],
  },
  'pkg-models': {
    eyebrow: 'package map',
    title: 'neuros-models — the model zoo and registry',
    summary:
      'A registry-driven library of deep and classical models behind one interface, so architectures are swappable and comparable, with a SageMaker training launcher.',
    lanes: [
      {
        label: 'Deep',
        nodes: [
          { title: 'EEGNet / CNN / LSTM', subtitle: 'sequence and convolutional decoders', tone: 'cyan' },
          { title: 'Transformer / DINOv3', subtitle: 'attention and vision backbones', tone: 'cyan' },
          { title: 'Attention-fusion / composite', subtitle: 'multi-input models', tone: 'cyan' },
        ],
      },
      {
        label: 'Classical',
        nodes: [
          { title: 'SVM / KNN', subtitle: 'kernel and instance methods', tone: 'violet' },
          { title: 'Random forest / GBDT', subtitle: 'tree ensembles', tone: 'violet' },
          { title: 'Simple / linear', subtitle: 'baselines', tone: 'violet' },
        ],
      },
      {
        label: 'Interface',
        nodes: [
          { title: 'Model registry', subtitle: 'one interface, pluggable architectures', tone: 'green' },
          { title: 'SageMaker launcher', subtitle: 'cloud training jobs', tone: 'green' },
        ],
      },
    ],
    outputs: ['deep + classical zoo', 'registry interface', 'cloud training'],
  },
  'pkg-foundation': {
    eyebrow: 'package map',
    title: 'neuros-foundation — reference neural foundation models',
    summary:
      'Published neural foundation models behind one base interface, with dataset loaders, so external architectures are directly comparable inside neurOS.',
    lanes: [
      {
        label: 'Models',
        nodes: [
          { title: 'CEBRA', subtitle: 'consistent latent embeddings', tone: 'cyan' },
          { title: 'NDT', subtitle: 'neural data transformer', tone: 'cyan' },
          { title: 'POYO / Neuroformer', subtitle: 'spiking and multimodal foundation models', tone: 'cyan' },
        ],
      },
      {
        label: 'Interface',
        nodes: [
          { title: 'base_foundation_model', subtitle: 'shared load / infer contract', tone: 'violet' },
          { title: 'utils', subtitle: 'adapters and helpers', tone: 'violet' },
        ],
      },
      {
        label: 'Datasets',
        nodes: [
          { title: 'Allen datasets', subtitle: 'atlas-scale loaders', tone: 'green' },
          { title: 'BCI datasets', subtitle: 'benchmark tasks', tone: 'green' },
        ],
      },
    ],
    outputs: ['4 reference FMs', 'unified interface', 'benchmark datasets'],
  },
  'pkg-neurofm': {
    eyebrow: 'package map',
    title: 'neuros-neurofm — the neuroFMx multimodal foundation model',
    summary:
      'The from-scratch foundation model: per-modality tokenizers, a Mamba backbone, self-supervised objectives, and parameter-efficient adapters for cross-session transfer.',
    lanes: [
      {
        label: 'Tokenize',
        nodes: [
          { title: 'Tokenizers', subtitle: 'spike, LFP, EEG, fMRI, calcium, audio, video, binned', tone: 'cyan' },
          { title: 'Temporal alignment', subtitle: 'common clock across modalities', tone: 'cyan' },
        ],
      },
      {
        label: 'Model',
        nodes: [
          { title: 'Mamba backbone + POPT', subtitle: 'linear-time sequence + population transformer', tone: 'violet' },
          { title: 'neuroFMx heads', subtitle: 'single and multitask', tone: 'violet' },
          { title: 'Masked-modeling SSL', subtitle: 'self-supervised and multitask losses', tone: 'violet' },
        ],
      },
      {
        label: 'Adapt',
        nodes: [
          { title: 'LoRA + unit-ID adapters', subtitle: 'cross-session / cross-subject transfer', tone: 'green' },
          { title: 'Model compression', subtitle: 'deploy-time optimization', tone: 'green' },
        ],
      },
    ],
    outputs: ['multimodal tokenizers', 'Mamba backbone', 'self-supervised', 'PEFT adapters'],
  },
  'pkg-mechint': {
    eyebrow: 'package map',
    title: 'neuros-mechint — mechanistic interpretability + biophysics',
    summary:
      'Interpretability inside the platform: circuit discovery, sparse/concept features, representation alignment, dynamics, and biophysical grounding back to biology.',
    lanes: [
      {
        label: 'Circuits',
        nodes: [
          { title: 'ACDC + path patching', subtitle: 'automated circuit discovery', tone: 'cyan' },
          { title: 'Motif / feature viz / DUNL', subtitle: 'structure and visualization', tone: 'cyan' },
          { title: 'Counterfactuals + attribution', subtitle: 'causal edits', tone: 'cyan' },
        ],
      },
      {
        label: 'Features & alignment',
        nodes: [
          { title: 'Sparse / concept SAEs', subtitle: 'feature decomposition', tone: 'violet' },
          { title: 'RSA / CCA / PLS', subtitle: 'representation alignment', tone: 'violet' },
          { title: 'Cross-species + temporal', subtitle: 'aligned across brains and time', tone: 'violet' },
        ],
      },
      {
        label: 'Grounding',
        nodes: [
          { title: 'Dynamics + bifurcation', subtitle: 'state-space analysis', tone: 'green' },
          { title: 'Biophysical models', subtitle: 'ion channels, synapses, Dale, metabolic', tone: 'green' },
        ],
      },
    ],
    outputs: ['circuit discovery', 'sparse features', 'representation alignment', 'biophysical grounding'],
  },
  'pkg-cloud': {
    eyebrow: 'package map',
    title: 'neuros-cloud — streaming, storage, and federated training',
    summary:
      'The distributed backbone: message-bus streaming, lakehouse storage and export, federated learning, and LSL sync for real deployments beyond a laptop.',
    lanes: [
      {
        label: 'Streaming',
        nodes: [
          { title: 'Kafka / Redis / ZeroMQ', subtitle: 'message-bus ingest', tone: 'cyan' },
          { title: 'LSL sync', subtitle: 'lab-streaming-layer timing', tone: 'cyan' },
        ],
      },
      {
        label: 'Storage & export',
        nodes: [
          { title: 'Iceberg ETL', subtitle: 'lakehouse streaming job', tone: 'violet' },
          { title: 'Petastorm / WebDataset', subtitle: 'training-data export', tone: 'violet' },
          { title: 'Database', subtitle: 'metadata and provenance', tone: 'violet' },
        ],
      },
      {
        label: 'Distributed',
        nodes: [
          { title: 'Federated client + aggregator', subtitle: 'privacy-preserving training', tone: 'green' },
          { title: 'Label Studio', subtitle: 'annotation integration', tone: 'green' },
        ],
      },
    ],
    outputs: ['message-bus streaming', 'lakehouse export', 'federated learning'],
  },
  'pkg-sourceweigher': {
    eyebrow: 'package map',
    title: 'neuros-sourceweigher — data-source weighting',
    summary:
      'A focused service that weights heterogeneous data sources for training mixtures, so a foundation model learns from the right blend rather than raw volume.',
    lanes: [
      {
        label: 'Comprises',
        nodes: [
          { title: 'Weigher', subtitle: 'source-weighting logic', tone: 'cyan' },
          { title: 'Service', subtitle: 'API around the weigher', tone: 'cyan' },
        ],
      },
      {
        label: 'Role',
        nodes: [
          { title: 'Mixture control', subtitle: 'balance datasets for pretraining', tone: 'green' },
          { title: 'Quality over volume', subtitle: 'down- and up-weight sources', tone: 'green' },
        ],
      },
    ],
    outputs: ['source weighting', 'training-mixture control'],
  },
  'pkg-ui': {
    eyebrow: 'package map',
    title: 'neuros-ui — serving, dashboard, and CLI',
    summary:
      'The human surface: a FastAPI serving API, a Streamlit dashboard, and a CLI to run pipelines, benchmarks, and the Constellation demo without writing code.',
    lanes: [
      {
        label: 'Serve',
        nodes: [
          { title: 'FastAPI API', subtitle: 'inference and control endpoints', tone: 'cyan' },
          { title: 'serve/api', subtitle: 'model serving surface', tone: 'cyan' },
        ],
      },
      {
        label: 'Interact',
        nodes: [
          { title: 'Streamlit dashboard', subtitle: 'live monitoring and visualization', tone: 'green' },
          { title: 'CLI', subtitle: 'run / benchmark / constellation / dashboard', tone: 'green' },
        ],
      },
    ],
    outputs: ['serving API', 'live dashboard', 'zero-code CLI'],
  },
};
