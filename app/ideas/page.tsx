import { Metadata } from 'next';
import { BrainCircuit, DatabaseZap, GitBranch, MessagesSquare, RadioTower, Search } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';

export const metadata: Metadata = {
  title: 'Research Ideas',
  description: 'Speculative research ideas around brain dynamics, interpretability, BCI, and scientific tools.',
};

const ideas = [
  {
    icon: BrainCircuit,
    label: 'Foundation Models',
    title: 'Foundation models for brain dynamics.',
    copy: 'Long-context neural time series, behavioral tokens, latent state transitions, and models that can learn across animals, sessions, tasks, and modalities.',
    tone: 'violet' as const,
    className: 'comic-span-8 comic-tilt-left',
  },
  {
    icon: Search,
    label: 'Searchable Maps',
    title: 'Neural embeddings as navigable memory.',
    copy: 'Represent experiments as searchable maps: recordings, behavior, metadata, code, paper context, and model states aligned into useful retrieval space.',
    tone: 'cyan' as const,
    className: 'comic-span-4 comic-tilt-right md:mt-10',
  },
  {
    icon: GitBranch,
    label: 'Interpretability',
    title: 'Mechanistic interpretability for neural systems.',
    copy: 'Use circuit-style methods to inspect models trained on brain and behavior, then connect learned mechanisms back to biological hypotheses.',
    tone: 'green' as const,
    className: 'comic-span-6',
  },
  {
    icon: RadioTower,
    label: 'Closed Loop',
    title: 'BCI infrastructure that treats latency as a first-class object.',
    copy: 'Streaming, decoding, feedback, observability, and adaptation for systems that have to operate while the brain and body keep moving.',
    tone: 'rose' as const,
    className: 'comic-span-6 comic-tilt-right',
  },
  {
    icon: DatabaseZap,
    label: 'Multimodal Data',
    title: 'Behavioral and neural datasets as living systems.',
    copy: 'Pipelines where pose, video, calcium imaging, electrophysiology, stimulation, and task events stay queryable and reproducible.',
    tone: 'amber' as const,
    className: 'comic-span-5 comic-tilt-left',
  },
  {
    icon: MessagesSquare,
    label: 'Scientific Tools',
    title: 'AI-assisted instruments for researchers.',
    copy: 'Tools that help scientists inspect experiments, generate hypotheses, compare model behavior, and move from artifact to interpretation faster.',
    tone: 'cyan' as const,
    className: 'comic-span-7 md:mt-8',
  },
];

export default function IdeasPage() {
  return (
    <ComicSectionLayout
      eyebrow="Thought Nodes"
      title="Speculative systems I keep circling."
      intro="These are research directions rather than finished claims: a chamber for foundation models of brain dynamics, interpretable neural systems, closed-loop infrastructure, and AI tools that make science more navigable."
    >
      <div className="comic-grid">
        {ideas.map((idea) => {
          const Icon = idea.icon;
          return (
            <NodeDetailPanel
              key={idea.label}
              label={idea.label}
              title={idea.title}
              tone={idea.tone}
              className={idea.className}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center border border-cyan/25 bg-cyan/10 text-cyan">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="h-px flex-1 bg-cyan/20" />
              </div>
              <p>{idea.copy}</p>
            </NodeDetailPanel>
          );
        })}
      </div>
    </ComicSectionLayout>
  );
}
