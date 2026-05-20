import { Metadata } from 'next';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Research Ideas',
  description: 'Research ideas around brain dynamics, interpretability, BCI, and scientific tools.',
  alternates: {
    canonical: '/ideas',
  },
  openGraph: {
    title: 'Research Ideas | Sid's Neural Net',
    description: 'Research sketches around brain dynamics, interpretability, BCI, and scientific tools.',
    url: '/ideas',
  },
};

const ideas = [
  {
    title: 'Foundation models for brain dynamics.',
    premise: 'Long-context neural time series, behavioral tokens, latent state transitions, and models that can learn across sessions, tasks, and modalities.',
    domains: ['neural time series', 'multimodal ML'],
    status: 'sketch',
  },
  {
    title: 'Neural embeddings as navigable memory.',
    premise: 'Represent recordings, behavior, metadata, code, paper context, and model states as a searchable research map.',
    domains: ['retrieval', 'scientific tooling'],
    status: 'draft',
  },
  {
    title: 'Mechanistic interpretability for neural models.',
    premise: 'Inspect models trained on brain and behavior, then connect learned mechanisms back to biological hypotheses.',
    domains: ['interpretability', 'neuroAI'],
    status: 'active',
  },
  {
    title: 'Latency-aware BCI infrastructure.',
    premise: 'Streaming, decoding, feedback, observability, and adaptation for systems that have to operate in real time.',
    domains: ['BCI', 'real-time systems'],
    status: 'active',
  },
  {
    title: 'Multimodal datasets as living systems.',
    premise: 'Pipelines where pose, video, calcium imaging, electrophysiology, stimulation, and task events stay queryable and reproducible.',
    domains: ['data infrastructure', 'reproducibility'],
    status: 'draft',
  },
  {
    title: 'AI-assisted instruments for researchers.',
    premise: 'Tools for inspecting experiments, comparing model behavior, and moving from artifact to interpretation with clearer provenance.',
    domains: ['research tools', 'applied AI'],
    status: 'sketch',
  },
];

export default function IdeasPage() {
  return (
    <ComicSectionLayout
      eyebrow="research"
      title="research ideas"
    >
      <div className="relative grid gap-4 md:grid-cols-2">
        {ideas.map((idea, index) => (
          <article key={idea.title} className={`future-circuit-card p-5 ${index % 2 ? 'md:translate-y-8' : ''}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-cyan/70">
                concept {String(index + 1).padStart(2, '0')}
              </p>
              <span className="border border-white/10 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-text-muted">
                {idea.status}
              </span>
            </div>
            <h2 className="text-xl font-semibold leading-tight text-text-primary">{idea.title}</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{idea.premise}</p>
            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
              {idea.domains.map((domain) => (
                <span key={domain} className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-text-muted">
                  {domain}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </ComicSectionLayout>
  );
}
