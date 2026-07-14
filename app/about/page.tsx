import { Metadata } from 'next';
import Link from 'next/link';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Core',
  description:
    'About Sidharth Hulyalkar, a neuroscience data systems, multimodal ML, BCI infrastructure, and applied AI engineer.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'Core | Sids Neural Net',
    description:
      'Background, working style, and technical through-line for Sidharth Hulyalkar.',
    url: '/about',
  },
};

const education = [
  {
    degree: 'M.E.',
    field: 'Bioengineering',
    institution: 'UC San Diego',
    year: '2021',
  },
  {
    degree: 'B.S.',
    field: 'Bioengineering: Biosystems',
    institution: 'UC San Diego',
    year: '2020',
  },
];

const affiliations = [
  { name: 'Panoptic Bio', role: 'Founding Applied AI Scientist', period: '2026' },
  { name: 'Stealth NeuroAI Startup', role: 'Founding Engineer', period: '2025' },
  { name: 'DataJoint', role: 'Neuroscience Data Engineer II', period: '2022–2024' },
  { name: 'NEATLABs, UCSD', role: 'Lead Lab Programmer', period: '2017–2022' },
  { name: 'Dolby Laboratories', role: 'Engineering Intern', period: '2014–2016' },
];

// Deployed systems and professional projects
const deployedSystems = [
  {
    name: 'Lu Lab DataJoint Workflows',
    description: 'Deployed cloud-based DeepLabCut, Facemap, and calcium imaging pipelines for the Lu Lab at UCSD.',
    links: [
      { label: 'element-deeplabcut', href: 'https://github.com/dj-sciops/lulab_element-deeplabcut' },
      { label: 'element-facemap', href: 'https://github.com/dj-sciops/lulab_element-facemap' },
      { label: 'element-calcium-imaging', href: 'https://github.com/dj-sciops/lulab_element-calcium-imaging' },
    ],
  },
  {
    name: 'Mindscope / Allen Institute Ephys',
    description: 'Large-scale electrophysiology processing with same-day data upload and reproducible pipeline execution.',
    links: [],
  },
  {
    name: 'Sabatini / Harvard Pipelines',
    description: 'DataJoint workflows for calcium imaging, electrophysiology, fiber photometry, and behavioral tracking.',
    links: [],
  },
  {
    name: 'Panoptic Bio',
    description: 'Applied AI systems for clinical trial intelligence: data pipelines, model evaluation, and decision-support tooling.',
    links: [],
  },
];

const analysisMethods = {
  'calcium imaging': [
    { name: 'Suite2p', link: 'https://suite2p.readthedocs.io', desc: 'ROI detection and signal extraction' },
    { name: 'CaImAn', link: 'https://caiman.readthedocs.io', desc: 'Constrained NMF for calcium imaging' },
    { name: 'EXTRACT', link: 'https://github.com/schnitzer-lab/EXTRACT-public', desc: 'Robust cell extraction' },
    { name: 'NoRMCorre', link: 'https://github.com/flatironinstitute/NoRMCorre', desc: 'Non-rigid motion correction' },
  ],
  'pose & behavior': [
    { name: 'DeepLabCut', link: 'https://deeplabcut.github.io/DeepLabCut', desc: 'Markerless pose estimation' },
    { name: 'Facemap', link: 'https://facemap.readthedocs.io', desc: 'Orofacial and behavioral tracking' },
    { name: 'Fiber Photometry', link: null, desc: 'Population activity from GCaMP signals' },
  ],
  'electrophysiology': [
    { name: 'SpikeInterface', link: 'https://spikeinterface.readthedocs.io', desc: 'Unified spike sorting API' },
    { name: 'Kilosort', link: 'https://github.com/MouseLand/Kilosort', desc: 'Template-matching spike sorter' },
    { name: 'Allen ecephys_spike_sorting', link: 'https://github.com/AllenInstitute/ecephys_spike_sorting', desc: 'Allen Institute pipeline' },
    { name: 'Neuropixels processing', link: null, desc: 'High-density probe preprocessing' },
  ],
  'behavioral modeling': [
    { name: 'Q-Learning', link: 'https://en.wikipedia.org/wiki/Q-learning', desc: 'Reinforcement learning models' },
    { name: 'Probabilistic reversal learning', link: null, desc: 'Belief updating under uncertainty' },
    { name: 'Delay discounting', link: null, desc: 'Temporal preference modeling' },
    { name: 'Go/NoGo analysis', link: null, desc: 'Impulse control metrics' },
  ],
  'neural time-series': [
    { name: 'Fourier / spectral analysis', link: null, desc: 'Power spectra and band power via FFT' },
    { name: 'Wavelet transform', link: null, desc: 'Time-frequency decomposition' },
    { name: 'Hilbert transform', link: null, desc: 'Instantaneous amplitude and phase' },
    { name: 'Phase-domain analysis', link: null, desc: 'Phase locking and phase-amplitude coupling' },
    { name: 'Spectral coherence', link: null, desc: 'Frequency-resolved coupling between sites' },
    { name: 'Full-spectrum network mapping', link: null, desc: 'Connectivity across all bands; beta/delta significant in paper' },
    { name: 'Cross-correlation', link: null, desc: 'Pairwise neural synchrony' },
    { name: 'Granger causality', link: null, desc: 'Directed functional connectivity' },
    { name: 'Event-aligned ERP / ERSP', link: null, desc: 'Trial-locked responses and spectral perturbation' },
  ],
  'brain encoding': [
    { name: 'DINOv2 features', link: 'https://github.com/facebookresearch/dinov2', desc: 'Self-supervised ViT visual representations' },
    { name: 'RAFT optical flow', link: 'https://github.com/princeton-vl/RAFT', desc: 'Motion features for video encoding' },
    { name: 'Ridge encoding models', link: null, desc: 'Regularized feature-to-BOLD readout' },
    { name: 'Noise-ceiling normalization', link: null, desc: 'Region-specific reliability scaling' },
    { name: 'Preregistration & permutation nulls', link: null, desc: 'Falsification-first evaluation' },
  ],
  'mechanistic interpretability': [
    { name: 'TransformerLens toolkit', link: 'https://github.com/TransformerLensOrg/TransformerLens', desc: 'Hooked-transformer activation introspection' },
    { name: 'Path patching', link: null, desc: 'Circuit discovery via path interventions' },
    { name: 'Activation patching', link: null, desc: 'Causal localization of computation' },
    { name: 'ACDC circuit discovery', link: 'https://github.com/ArthurConmy/Automatic-Circuit-Discovery', desc: 'Automated circuit-graph search' },
    { name: 'Counterfactual interventions', link: null, desc: 'Behavior under edited activations' },
    { name: 'Probing classifiers', link: null, desc: 'Decoding features from representations' },
    { name: 'Attention & activation viz', link: null, desc: 'Head-level pattern inspection' },
    { name: 'Latent surgery & ablation', link: null, desc: 'Directed edits and manifold analysis' },
  ],
  'foundation models': [
    { name: 'Self-supervised pretraining', link: null, desc: 'Masked and contrastive objectives' },
    { name: 'Long-sequence transformers', link: null, desc: 'Attention over extended neural context' },
    { name: 'Mamba / state-space models', link: 'https://github.com/state-spaces/mamba', desc: 'Linear-time sequence modeling' },
    { name: 'Perceiver IO', link: null, desc: 'Cross-attention over heterogeneous inputs' },
    { name: 'Autoencoders & VAEs', link: null, desc: 'Latent compression of neural signals' },
    { name: 'LoRA adaptation', link: 'https://github.com/microsoft/LoRA', desc: 'Parameter-efficient fine-tuning' },
    { name: 'FSDP distributed training', link: null, desc: 'Sharded large-model training' },
    { name: 'Cross-session alignment', link: null, desc: 'Stitching subjects and sessions' },
  ],
  'multimodal systems': [
    { name: 'Modality-specific encoders', link: null, desc: 'Video, audio, text, and neural tokenizers' },
    { name: 'Cross-modal fusion', link: null, desc: 'Joint attention across streams' },
    { name: 'Contrastive alignment', link: null, desc: 'CLIP-style representation binding' },
    { name: 'Feature-to-brain readout', link: null, desc: 'Linear / ridge encoding heads' },
    { name: 'Modality dropout', link: null, desc: 'Robustness to missing inputs' },
    { name: 'Shared latent spaces', link: null, desc: 'Harmonized tokens across sensors' },
  ],
  'data infrastructure': [
    { name: 'DataJoint', link: 'https://datajoint.com', desc: 'Workflow and provenance modeling' },
    { name: 'NWB', link: 'https://nwb.org', desc: 'Neurodata Without Borders format' },
    { name: 'HDF5 / Zarr', link: 'https://zarr.dev', desc: 'Chunked array storage' },
    { name: 'Cloud/distributed processing', link: null, desc: 'AWS, parallel pipelines' },
  ],
};

const technicalDomains = [
  'Neural data infrastructure',
  'Multimodal foundation models',
  'Naturalistic-video brain encoding',
  'BCI & real-time systems',
  'Scientific workflow systems',
  'Mechanistic interpretability',
];

// Links for technologies (null = no link)
const techLinks: Record<string, string | null> = {
  // Languages
  'Python': 'https://python.org',
  'MATLAB': 'https://mathworks.com/products/matlab.html',
  'TypeScript': 'https://typescriptlang.org',
  'SQL': null,
  'R': 'https://r-project.org',
  'Java': 'https://java.com',
  'Bash': null,
  // ML/DL
  'PyTorch': 'https://pytorch.org',
  'TensorFlow': 'https://tensorflow.org',
  'Keras': 'https://keras.io',
  'XGBoost': 'https://xgboost.readthedocs.io',
  'Hugging Face': 'https://huggingface.co',
  'Scikit-learn': 'https://scikit-learn.org',
  'CUDA': 'https://developer.nvidia.com/cuda-toolkit',
  // Architectures
  'CNNs': null,
  'RNNs': null,
  'LSTMs': null,
  'U-Net': null,
  'Transformers': null,
  'Mamba': 'https://github.com/state-spaces/mamba',
  'Perceiver IO': null,
  // Data Science
  'NumPy': 'https://numpy.org',
  'SciPy': 'https://scipy.org',
  'Pandas': 'https://pandas.pydata.org',
  'Dask': 'https://dask.org',
  'OpenCV': 'https://opencv.org',
  'Scikit-image': 'https://scikit-image.org',
  // Cloud
  'AWS': 'https://aws.amazon.com',
  'Google Cloud': 'https://cloud.google.com',
  'Cloudflare': 'https://cloudflare.com',
  'Docker': 'https://docker.com',
  'Kubernetes': 'https://kubernetes.io',
  'Terraform': 'https://terraform.io',
  'Singularity': 'https://sylabs.io/singularity',
  // AWS Services
  'EC2': 'https://aws.amazon.com/ec2',
  'S3': 'https://aws.amazon.com/s3',
  'Lambda': 'https://aws.amazon.com/lambda',
  'Kinesis': 'https://aws.amazon.com/kinesis',
  'CloudWatch': 'https://aws.amazon.com/cloudwatch',
  'EFS': 'https://aws.amazon.com/efs',
  // Frameworks
  'FastAPI': 'https://fastapi.tiangolo.com',
  'Next.js': 'https://nextjs.org',
  'React': 'https://react.dev',
  'Streamlit': 'https://streamlit.io',
  'Dash': 'https://dash.plotly.com',
  'DataJoint': 'https://datajoint.com',
  'Nextflow': 'https://nextflow.io',
  // Neuro Tools
  'SpikeInterface': 'https://spikeinterface.readthedocs.io',
  'Suite2p': 'https://suite2p.readthedocs.io',
  'CaImAn': 'https://caiman.readthedocs.io',
  'DeepLabCut': 'https://deeplabcut.github.io/DeepLabCut',
  'Facemap': 'https://facemap.readthedocs.io',
  'Kilosort': 'https://github.com/MouseLand/Kilosort',
  'Open Ephys': 'https://open-ephys.org',
  'Allen SDK': 'https://allensdk.readthedocs.io',
  // Data Formats
  'NWB': 'https://nwb.org',
  'Zarr': 'https://zarr.dev',
  'HDF5': 'https://hdfgroup.org/solutions/hdf5',
  'Parquet': 'https://parquet.apache.org',
  'MCAP': 'https://mcap.dev',
  // Signal Processing
  'DTW': null,
  'Kalman Filtering': null,
  'ERP/ERSP': null,
  'Spectral Analysis': null,
  'Granger Causality': null,
  'PCA/ICA': null,
  // Analysis
  'Electrophysiology': null,
  'LFP/EEG': null,
  'Calcium Imaging': null,
  'Fiber Photometry': null,
  'Pose Estimation': null,
  'Q-Learning': null,
  // Visualization
  'Matplotlib': 'https://matplotlib.org',
  'Seaborn': 'https://seaborn.pydata.org',
  'Bokeh': 'https://bokeh.org',
  'Plotly': 'https://plotly.com',
  'Three.js': 'https://threejs.org',
  'Foxglove': 'https://foxglove.dev',
  // DevOps
  'Git': 'https://git-scm.com',
  'GitHub Actions': 'https://github.com/features/actions',
  'CI/CD': null,
  'Linux': 'https://kernel.org',
  'Jira': 'https://atlassian.com/software/jira',
  'Prometheus': 'https://prometheus.io',
  'Grafana': 'https://grafana.com',
  'DataDog': 'https://datadoghq.com',
  // Tools
  'Jupyter': 'https://jupyter.org',
  'Vim': 'https://vim.org',
  'tmux': 'https://github.com/tmux/tmux',
  'SSH': null,
  'Arduino': 'https://arduino.cc',
  'Raspberry Pi': 'https://raspberrypi.org',
};

const stack = {
  languages: ['Python', 'MATLAB', 'TypeScript', 'SQL', 'R', 'Java', 'Bash'],
  'ml/dl': ['PyTorch', 'TensorFlow', 'Keras', 'XGBoost', 'Hugging Face', 'Scikit-learn', 'CUDA'],
  'architectures': ['CNNs', 'RNNs', 'LSTMs', 'U-Net', 'Transformers', 'Mamba', 'Perceiver IO'],
  'data science': ['NumPy', 'SciPy', 'Pandas', 'Dask', 'OpenCV', 'Scikit-image'],
  cloud: ['AWS', 'Google Cloud', 'Cloudflare', 'Docker', 'Kubernetes', 'Terraform', 'Singularity'],
  'aws services': ['EC2', 'S3', 'Lambda', 'Kinesis', 'CloudWatch', 'EFS'],
  frameworks: ['FastAPI', 'Next.js', 'React', 'Streamlit', 'Dash', 'DataJoint', 'Nextflow'],
  'neuro tools': ['SpikeInterface', 'Suite2p', 'CaImAn', 'DeepLabCut', 'Facemap', 'Kilosort', 'Open Ephys', 'Allen SDK'],
  'data formats': ['NWB', 'Zarr', 'HDF5', 'Parquet', 'MCAP'],
  'signal processing': ['DTW', 'Kalman Filtering', 'ERP/ERSP', 'Spectral Analysis', 'Granger Causality', 'PCA/ICA'],
  analysis: ['Electrophysiology', 'LFP/EEG', 'Calcium Imaging', 'Fiber Photometry', 'Pose Estimation', 'Q-Learning'],
  visualization: ['Matplotlib', 'Seaborn', 'Bokeh', 'Plotly', 'Three.js', 'Foxglove'],
  devops: ['Git', 'GitHub Actions', 'CI/CD', 'Linux', 'Jira', 'Prometheus', 'Grafana', 'DataDog'],
  tools: ['Jupyter', 'Vim', 'tmux', 'SSH', 'Arduino', 'Raspberry Pi'],
};

const links = [
  { label: 'GitHub', href: 'https://github.com/sidhulyalkar' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/sidharth-hulyalkar/' },
  { label: 'Resume', href: '/resume' },
];

// Tech chip component with optional link (web-only interactivity)
function TechChip({ tech }: { tech: string }) {
  const link = techLinks[tech];
  const baseClasses = "max-w-full break-words border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-white/55 transition-all duration-200";

  if (link) {
    return (
      <>
        {/* Desktop: Interactive link */}
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseClasses} hidden cursor-pointer hover:border-cyan/40 hover:bg-cyan/10 hover:text-cyan md:inline-block pointer-coarse:hidden`}
        >
          {tech}
        </a>
        {/* Mobile/Touch: Non-interactive display */}
        <span className={`${baseClasses} inline-block md:hidden pointer-coarse:inline-block`}>
          {tech}
        </span>
      </>
    );
  }

  return (
    <span className={baseClasses}>
      {tech}
    </span>
  );
}

export default function AboutPage() {
  return (
    <ComicSectionLayout
      eyebrow="CORE"
      title="core"
    >
      <div className="space-y-16">
        {/* Education */}
        <section>
          <p className="technical-label mb-8">Education</p>
          <div className="grid gap-6 sm:grid-cols-2">
            {education.map((item) => (
              <div
                key={`${item.degree}-${item.field}`}
                className="border-l-2 border-cyan/30 pl-4"
              >
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-cyan/60">
                  {item.degree}
                </p>
                <p className="mt-1 text-sm font-medium text-text-primary">{item.field}</p>
                <p className="mt-1 text-xs text-text-secondary">{item.institution}</p>
                <p className="mt-0.5 font-mono text-[0.58rem] text-white/40">{item.year}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Stack, Domains & Affiliations */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)] xl:grid-cols-[minmax(0,1.85fr)_minmax(20rem,0.75fr)]">
          <section className="min-w-0">
            <p className="technical-label mb-8">Stack</p>
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(stack).map(([category, items]) => (
                <div key={category} className="min-w-0">
                  <p className="mb-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/30">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((tech) => (
                      <TechChip key={tech} tech={tech} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-12">
            <section>
              <p className="technical-label mb-8">Domains</p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {technicalDomains.map((domain) => (
                  <li key={domain} className="flex min-w-0 items-center gap-3 text-sm text-text-secondary">
                    <span className="h-px w-4 shrink-0 bg-cyan/40" />
                    <span>{domain}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="technical-label mb-8">Affiliations</p>
              <div className="space-y-6">
                {affiliations.map((item) => (
                  <div
                    key={`${item.name}-${item.period}`}
                    className="grid gap-2 border-b border-white/8 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary">{item.name}</p>
                      <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/50">
                        {item.role}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-[0.62rem] tracking-wider text-white/40">{item.period}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Analysis Methods */}
        <section>
          <p className="technical-label mb-8">Analysis Methods</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(analysisMethods).map(([category, methods]) => (
              <div key={category} className="node-shell p-4">
                <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cyan/70">
                  {category}
                </p>
                <div className="space-y-2">
                  {methods.map((method) => (
                    <div key={method.name} className="group">
                      {method.link ? (
                        <a
                          href={method.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-text-primary transition-colors hover:text-cyan"
                        >
                          {method.name}
                          <span className="ml-1 text-[0.6rem] text-text-muted">↗</span>
                        </a>
                      ) : (
                        <span className="text-sm text-text-primary">{method.name}</span>
                      )}
                      <p className="text-[0.68rem] text-text-muted">{method.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Deployed Systems */}
        <section>
          <p className="technical-label mb-8">Deployed Systems</p>
          <div className="grid gap-4 md:grid-cols-2">
            {deployedSystems.map((system) => (
              <div key={system.name} className="node-shell p-4">
                <h3 className="text-sm font-medium text-text-primary">{system.name}</h3>
                <p className="mt-2 text-[0.75rem] text-text-muted">{system.description}</p>
                {system.links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {system.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan/70 hover:text-cyan"
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <section>
          <p className="technical-label mb-8">Links</p>
          <div className="flex flex-wrap gap-6">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="font-mono text-xs uppercase tracking-[0.14em] text-cyan/70 transition-colors hover:text-cyan"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ComicSectionLayout>
  );
}
