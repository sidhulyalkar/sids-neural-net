import type { DiagramNode, DiagramDefinition } from './diagram-types';
import { packageDiagrams, type PackageDiagramVariant } from './package-diagrams';

type CoreVariant =
  | 'datajoint'
  | 'neatlabs'
  | 'audio-led'
  | 'lu-lab'
  | 'video-encoding'
  | 'neuros-platform'
  | 'go-nogo'
  | 'delay-discounting'
  | 'reversal-learning';

type DiagramVariant = CoreVariant | PackageDiagramVariant;

const toneClasses: Record<NonNullable<DiagramNode['tone']>, string> = {
  cyan: 'border-cyan/30 bg-cyan/[0.06] text-cyan',
  violet: 'border-violet/30 bg-violet/[0.06] text-violet',
  green: 'border-green/30 bg-green/[0.06] text-green',
  amber: 'border-amber/30 bg-amber/[0.06] text-amber',
  rose: 'border-rose/30 bg-rose/[0.06] text-rose',
};

const diagrams: Record<CoreVariant, DiagramDefinition> = {
  datajoint: {
    eyebrow: 'workflow map',
    title: 'DataJoint multimodal system flow',
    summary:
      'A lab-facing scientific workflow turns heterogeneous acquisition files into queryable, reproducible analysis outputs.',
    lanes: [
      {
        label: 'Acquisition',
        nodes: [
          { title: 'Subjects and sessions', subtitle: 'Lab, subject, session, task, metadata', tone: 'cyan' },
          { title: 'Raw modalities', subtitle: 'Ephys, imaging, photometry, behavior video', tone: 'cyan' },
          { title: 'Inbox organization', subtitle: 'Files arrive with lab-specific conventions', tone: 'cyan' },
        ],
      },
      {
        label: 'Workflow',
        nodes: [
          { title: 'DataJoint schemas', subtitle: 'Relational dependencies and provenance', tone: 'violet' },
          { title: 'Element pipelines', subtitle: 'DLC, Facemap, array-ephys, imaging', tone: 'violet' },
          { title: 'Compute execution', subtitle: 'Local notebooks, Docker, cloud/GPU jobs', tone: 'violet' },
        ],
      },
      {
        label: 'Research output',
        nodes: [
          { title: 'Derived features', subtitle: 'Spikes, traces, poses, facial features', tone: 'green' },
          { title: 'Review surfaces', subtitle: 'Notebooks, SciViz, QC and validation', tone: 'green' },
          { title: 'Reusable analysis', subtitle: 'Traceable data products for scientists', tone: 'green' },
        ],
      },
    ],
    outputs: ['provenance', 'queryability', 'reproducibility', 'lab usability'],
  },
  neatlabs: {
    eyebrow: 'experimental systems map',
    title: 'NEATLABs behavior to neural analysis loop',
    summary:
      'The system linked rodent behavioral paradigms, Raspberry Pi operant boxes, treatment conditions, and LFP analysis into a publication-supporting research loop.',
    lanes: [
      {
        label: 'Behavior systems',
        nodes: [
          { title: 'Task paradigms', subtitle: 'Go/No-Go, delay discounting, reversal learning', tone: 'amber' },
          { title: 'Operant boxes', subtitle: 'Raspberry Pi, MATLAB/Simulink, event logging', tone: 'amber' },
          { title: 'Trial structure', subtitle: 'Cues, waits, responses, rewards, omissions', tone: 'amber' },
        ],
      },
      {
        label: 'Experimental context',
        nodes: [
          { title: 'Animal cohorts', subtitle: 'Healthy and TBI-related comparisons', tone: 'rose' },
          { title: 'Treatment conditions', subtitle: 'Saline, methylphenidate, ketamine contexts', tone: 'rose' },
          { title: 'Recording sessions', subtitle: 'Multisite LFP and behavior synchronization', tone: 'rose' },
        ],
      },
      {
        label: 'Analysis',
        nodes: [
          { title: 'Event alignment', subtitle: 'Behavioral events become neural windows', tone: 'green' },
          { title: 'Signal processing', subtitle: 'ERP, ERSP, beta, theta, high-gamma', tone: 'green' },
          { title: 'Network insight', subtitle: 'Action, inhibition, reward, impulsivity', tone: 'green' },
        ],
      },
    ],
    outputs: ['behavioral inhibition', 'reward value', 'TBI comparisons', 'publication figures'],
  },
  'audio-led': {
    eyebrow: 'real-time routing map',
    title: 'Neuro, audio, and LED feedback loop',
    summary:
      'A low-latency physical feedback system split signals so music stayed clean while lighting reacted in real time.',
    lanes: [
      {
        label: 'Signal sources',
        nodes: [
          { title: 'NeuroSky input', subtitle: 'Attention, meditation, EEG-style features', tone: 'cyan' },
          { title: 'Audio stream', subtitle: 'Music/game audio captured for analysis', tone: 'cyan' },
          { title: 'Split routing', subtitle: 'One path to speakers, one path to processing', tone: 'cyan' },
        ],
      },
      {
        label: 'Processing',
        nodes: [
          { title: 'Raspberry Pi', subtitle: 'Signal parsing and control logic', tone: 'violet' },
          { title: 'Audio features', subtitle: 'Intensity, frequency bands, beat response', tone: 'violet' },
          { title: 'Mapping layer', subtitle: 'Feature values become color and motion', tone: 'violet' },
        ],
      },
      {
        label: 'Physical output',
        nodes: [
          { title: 'LED strip', subtitle: 'Addressable real-time visual response', tone: 'green' },
          { title: 'NanoLeaf / galaxy light', subtitle: 'Room-scale reactive atmosphere', tone: 'green' },
          { title: 'Speakers', subtitle: 'Clean playback without processing lag', tone: 'green' },
        ],
      },
    ],
    outputs: ['low latency', 'synchronized light', 'clean audio', 'embodied feedback'],
  },
  'lu-lab': {
    eyebrow: 'deep learning deployment map',
    title: 'Lu Lab behavior-video ML pipeline',
    summary:
      'DeepLabCut and Facemap workflows become deployable scientific systems when model lifecycle, video data, GPU execution, and outputs are tracked together.',
    lanes: [
      {
        label: 'Inputs',
        nodes: [
          { title: 'Behavior videos', subtitle: 'Lab-specific camera data and sessions', tone: 'cyan' },
          { title: 'Model projects', subtitle: 'DLC projects and Facemap configurations', tone: 'cyan' },
          { title: 'Metadata', subtitle: 'Session, subject, task, processing parameters', tone: 'cyan' },
        ],
      },
      {
        label: 'Model lifecycle',
        nodes: [
          { title: 'Training schemas', subtitle: 'Model state, config, run metadata', tone: 'violet' },
          { title: 'Inference schemas', subtitle: 'Video inputs, jobs, artifacts, outputs', tone: 'violet' },
          { title: 'Cloud execution', subtitle: 'GPU dependencies, deployment debugging', tone: 'violet' },
        ],
      },
      {
        label: 'Outputs',
        nodes: [
          { title: 'Pose estimates', subtitle: 'DeepLabCut keypoints and confidence', tone: 'green' },
          { title: 'Facial features', subtitle: 'Facemap behavior and movement signals', tone: 'green' },
          { title: 'Aligned behavior', subtitle: 'Features ready to connect with neural data', tone: 'green' },
        ],
      },
    ],
    outputs: ['training provenance', 'inference provenance', 'cloud reliability', 'behavior features'],
  },
  'video-encoding': {
    eyebrow: 'encoding pipeline map',
    title: 'Naturalistic video to brain prediction pipeline',
    summary:
      'A falsification-first harness turns naturalistic video into frozen features, fits a controlled linear readout to fMRI, and only lets a claim survive after preregistered gates and cross-dataset confirmation.',
    lanes: [
      {
        label: 'Stimulus and features',
        nodes: [
          { title: 'Naturalistic video', subtitle: 'Short clips and continuous movies with audio', tone: 'cyan' },
          { title: 'Visual features', subtitle: 'DINOv2 ViT-L/14 layer-12 patch tokens', tone: 'cyan' },
          { title: 'Motion and low-level', subtitle: 'RAFT optical flow, luminance, contrast, edges', tone: 'cyan' },
        ],
      },
      {
        label: 'Encoding and controls',
        nodes: [
          { title: 'Ridge readout', subtitle: 'Train-fold RidgeCV to Schaefer-400 parcels', tone: 'violet' },
          { title: 'Nuisance removal', subtitle: 'BOLD autocorrelation, run polynomial, timing warp', tone: 'violet' },
          { title: 'Preregistered gates', subtitle: 'Held subject and movie, matched permutation nulls', tone: 'violet' },
        ],
      },
      {
        label: 'Evaluation and confirmation',
        nodes: [
          { title: 'Noise-ceiling scoring', subtitle: 'Region-specific, ceiling-normalized Pearson r', tone: 'green' },
          { title: 'Cross-dataset transfer', subtitle: 'BoldMoments to CNeuroMod, frozen pipeline', tone: 'green' },
          { title: 'Falsified claims', subtitle: 'Audio, affect, and temporal negatives reported', tone: 'green' },
        ],
      },
    ],
    outputs: ['cross-dataset visual encoder', 'ceiling-normalized r', 'preregistered gates', 'honest negatives'],
  },
  'neuros-platform': {
    eyebrow: 'platform architecture map',
    title: 'neurOS-v1 real-time BCI and foundation-model platform',
    summary:
      'A modular monorepo carries neural data from hot-swappable device drivers through agent-orchestrated processing into a multimodal foundation model, serving, and mechanistic interpretability.',
    lanes: [
      {
        label: 'Acquisition and streaming',
        nodes: [
          { title: 'Device drivers', subtitle: '16+ modalities, hot-swappable unified API', tone: 'cyan' },
          { title: 'Streaming backends', subtitle: 'Kafka, Redis Streams, ZeroMQ, LSL sync', tone: 'cyan' },
          { title: 'Storage and export', subtitle: 'NWB, Zarr, WebDataset, Iceberg', tone: 'cyan' },
        ],
      },
      {
        label: 'Orchestration and processing',
        nodes: [
          { title: 'Agent orchestrator', subtitle: 'Device, processing, model, fusion agents', tone: 'violet' },
          { title: 'Processing pipeline', subtitle: 'Filters, features, adaptation, health monitor', tone: 'violet' },
          { title: 'Model registry', subtitle: 'EEGNet, CNN, LSTM, Transformer, DINOv3', tone: 'violet' },
        ],
      },
      {
        label: 'Foundation and interpretability',
        nodes: [
          { title: 'neuroFMx', subtitle: 'Mamba backbone, tokenizers, masked SSL, LoRA', tone: 'green' },
          { title: 'Foundation models', subtitle: 'CEBRA, NDT, POYO, Neuroformer', tone: 'green' },
          { title: 'Mechanistic interpretability', subtitle: 'ACDC, SAEs, RSA/CCA, dynamics', tone: 'green' },
        ],
      },
    ],
    outputs: ['hot-swappable drivers', 'real-time orchestration', 'multimodal foundation model', 'cloud-native + observable'],
  },
  'go-nogo': {
    eyebrow: 'behavioral paradigm map',
    title: 'Go/No-Go & Go/Wait — action, inhibition, impulsivity',
    summary:
      'Rats act, withhold, or wait in response to cues while distributed cortico-striatal LFP and human EEG reveal separable action and inhibition networks.',
    lanes: [
      {
        label: 'Task design',
        nodes: [
          { title: 'Cue presentation', subtitle: 'Go vs No-Go / wait signals', tone: 'amber' },
          { title: 'Response window', subtitle: 'Act, withhold, or wait for reward', tone: 'amber' },
          { title: 'Trial outcomes', subtitle: 'Correct, premature, omission', tone: 'amber' },
        ],
      },
      {
        label: 'Neural measurement',
        nodes: [
          { title: 'Multisite LFP', subtitle: 'Distributed cortico-striatal electrodes', tone: 'violet' },
          { title: 'Human EEG', subtitle: 'Translational cross-species comparison', tone: 'violet' },
          { title: 'Functional connectivity', subtitle: 'Network-level coupling analysis', tone: 'violet' },
        ],
      },
      {
        label: 'What we found',
        nodes: [
          { title: 'Action coding', subtitle: 'Low-frequency activity tracks action/sensory', tone: 'green' },
          { title: 'Inhibition', subtitle: 'Prefrontal/premotor theta tracks withholding', tone: 'green' },
          { title: 'Impulsivity', subtitle: 'Motor-inhibitory connectivity ↔ less impulsivity', tone: 'green' },
        ],
      },
    ],
    outputs: ['action networks', 'theta inhibition signal', 'impulsivity connectivity', 'rodent-human bridge'],
  },
  'delay-discounting': {
    eyebrow: 'behavioral paradigm map',
    title: 'Delay Discounting — reward value & subjective value',
    summary:
      'Rats choose between smaller-sooner and larger-later rewards while reward-locked beta oscillations track reward magnitude, delay cost, and modeled subjective value.',
    lanes: [
      {
        label: 'Task design',
        nodes: [
          { title: 'Choice options', subtitle: 'Smaller-sooner vs larger-later', tone: 'amber' },
          { title: 'Delay manipulation', subtitle: 'Increasing waiting cost', tone: 'amber' },
          { title: 'Reward delivery', subtitle: 'Magnitude and timing vary', tone: 'amber' },
        ],
      },
      {
        label: 'Neural measurement',
        nodes: [
          { title: 'Reward-locked LFP', subtitle: 'Time-frequency around reward', tone: 'violet' },
          { title: 'Reward network', subtitle: 'OFC, mPFC, insula, vStr, amygdala', tone: 'violet' },
          { title: 'Subjective-value model', subtitle: 'Computational value estimates', tone: 'violet' },
        ],
      },
      {
        label: 'What we found',
        nodes: [
          { title: 'Beta = magnitude', subtitle: 'Reward-locked beta scales with reward size', tone: 'green' },
          { title: 'Delay decay', subtitle: 'Beta power decays with longer delays', tone: 'green' },
          { title: 'Value correlate', subtitle: 'Beta tracks modeled subjective value', tone: 'green' },
        ],
      },
    ],
    outputs: ['reward-locked beta', 'magnitude scaling', 'delay sensitivity', 'subjective-value marker'],
  },
  'reversal-learning': {
    eyebrow: 'behavioral paradigm map',
    title: 'Probabilistic Reversal Learning — reward certainty',
    summary:
      'Reward contingencies flip unpredictably; beta and high-gamma oscillations track reward probability, and optogenetic beta stimulation causally perturbs adaptive behavior.',
    lanes: [
      {
        label: 'Task design',
        nodes: [
          { title: 'Probabilistic reward', subtitle: 'Uncertain, changing contingencies', tone: 'amber' },
          { title: 'Reversals', subtitle: 'Contingencies flip mid-session', tone: 'amber' },
          { title: 'Adaptive choice', subtitle: 'Update behavior under uncertainty', tone: 'amber' },
        ],
      },
      {
        label: 'Neural measurement',
        nodes: [
          { title: 'Cortico-striatal LFP', subtitle: 'Reward-evoked oscillations', tone: 'violet' },
          { title: 'RL model', subtitle: 'Trial-by-trial value and uncertainty', tone: 'violet' },
          { title: 'Optogenetics', subtitle: 'Beta-frequency OFC stimulation', tone: 'violet' },
        ],
      },
      {
        label: 'What we found',
        nodes: [
          { title: 'Reward certainty', subtitle: 'Beta & high-gamma track valence/probability', tone: 'green' },
          { title: 'Connectivity ↔ performance', subtitle: 'Beta coupling predicts behavior', tone: 'green' },
          { title: 'Causal test', subtitle: 'OFC beta stim → maladaptive responses', tone: 'green' },
        ],
      },
    ],
    outputs: ['reward-certainty signal', 'beta/high-gamma coding', 'performance connectivity', 'causal optogenetic test'],
  },
};

interface SystemDiagramProps {
  variant: DiagramVariant;
}

const allDiagrams: Record<DiagramVariant, DiagramDefinition> = { ...diagrams, ...packageDiagrams };

export function SystemDiagram({ variant }: SystemDiagramProps) {
  const diagram = allDiagrams[variant];

  return (
    <section className="not-prose my-10 border border-white/10 bg-white/[0.025] p-5">
      <div className="mb-6">
        <p className="technical-label">{diagram.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-text-primary">{diagram.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{diagram.summary}</p>
      </div>

      <div className="space-y-4">
        {diagram.lanes.map((lane) => (
          <div key={lane.label} className="grid gap-3 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-stretch">
            <div className="flex items-center border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">{lane.label}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {lane.nodes.map((node, index) => (
                <div key={node.title} className="relative">
                  <div className={`h-full border p-4 ${toneClasses[node.tone ?? 'cyan']}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] opacity-80">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {index < lane.nodes.length - 1 && (
                        <span className="hidden font-mono text-xs text-text-muted md:block">-&gt;</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary">{node.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-text-secondary">{node.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {diagram.outputs.map((output) => (
          <span
            key={output}
            className="border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-text-muted"
          >
            {output}
          </span>
        ))}
      </div>
    </section>
  );
}
