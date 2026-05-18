import { Metadata } from 'next';
import { Brain, Database, Eye, Mountain, Radio, Sparkles } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Sidharth Hulyalkar - applied AI scientist and neuroscience systems engineer.',
};

const arcs = [
  {
    icon: Database,
    label: 'Infrastructure',
    title: 'I learned to respect data by building systems for messy experiments.',
    copy: 'At DataJoint and UCSD, the work was not abstract. It was calcium imaging, electrophysiology, behavior, pose, photometry, cloud storage, lab constraints, and researchers who needed the pipeline to hold.',
  },
  {
    icon: Brain,
    label: 'Models',
    title: 'I care about models that can explain their grip on brain dynamics.',
    copy: 'Foundation model work is only interesting to me when it can stay connected to signal quality, temporal structure, biological context, and interpretable mechanisms.',
  },
  {
    icon: Radio,
    label: 'Interfaces',
    title: 'Real-time systems keep the theory honest.',
    copy: 'BCI and closed-loop tools force decisions about latency, reliability, feedback, and what a model can do when the world refuses to wait for a perfect batch job.',
  },
  {
    icon: Eye,
    label: 'Perception',
    title: 'The creative side is not separate from the technical side.',
    copy: 'Photography, field notes, trail time, and visual systems all feed the same habit: noticing structure, timing, texture, and the difference between signal and decoration.',
  },
];

export default function AboutPage() {
  return (
    <ComicSectionLayout
      eyebrow="About / Signal Origin"
      title="Systems where brain data, AI, and interface design meet."
      intro="I am Sidharth Hulyalkar: a neuroscience data systems and AI engineer drawn to problems where software has to survive contact with real experiments, real users, and real ambiguity."
      sideNote={
        <p className="text-sm leading-6 text-text-secondary">
          The through-line is applied rigor with a visual nervous system: architecture that can hold
          messy data, models that stay accountable to signal, and interfaces that make complexity navigable.
        </p>
      }
    >
      <div className="comic-grid">
          {arcs.map((arc, index) => {
            const Icon = arc.icon;
            return (
              <section
                key={arc.title}
                className={`comic-panel p-5 ${index % 2 ? 'comic-span-5 comic-tilt-right md:mt-10' : 'comic-span-7 comic-tilt-left'}`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center border border-cyan/25 bg-cyan/10 text-cyan">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="technical-label">{arc.label}</span>
                  </div>
                  <span className="h-px w-16 bg-cyan/25" />
                </div>
                <h2 className="text-2xl font-black text-text-primary">{arc.title}</h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{arc.copy}</p>
              </section>
            );
          })}
          <NodeDetailPanel
            label="Working Style"
            title="Applied rigor with a visual nervous system."
            tone="violet"
            className="comic-span-8 comic-tilt-left md:mt-8"
          >
            <p>
              I like work where the architecture matters, the data has teeth, and the interface can make
              complexity feel navigable. That has meant lab pipelines, neural recordings, applied AI
              products, interpretability experiments, and prototypes that turn a half-formed idea into a
              working instrument.
            </p>
          </NodeDetailPanel>
          <NodeDetailPanel
            label="Outside the Lab"
            title="Field attention keeps the technical work from becoming sterile."
            tone="green"
            className="comic-span-4 comic-tilt-right"
          >
            <div className="flex items-center gap-3">
              <Mountain className="h-5 w-5 text-green" />
              <span className="technical-label">adventure input</span>
            </div>
            <p className="mt-4">
              Trail rhythm, light, weather, Shasta energy, and photography all feed the same habit:
              noticing structure, timing, texture, and signal.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm text-cyan">
              <Sparkles className="h-4 w-4" />
              Built for signal, not spectacle.
            </div>
          </NodeDetailPanel>
        </div>
    </ComicSectionLayout>
  );
}
