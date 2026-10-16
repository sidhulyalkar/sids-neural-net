import { Metadata } from 'next';
import { FlaskConical, Lightbulb, PenLine, WandSparkles } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';

export const metadata: Metadata = {
  title: 'Field Notes',
  description: 'Thoughts, explorations, and notes on neural data systems, ML, and research.',
  alternates: {
    canonical: '/field-notes',
  },
  openGraph: {
    title: 'Field Notes | Sids Neural Net',
    description: 'Experimental writing, prototype notes, and research sketches.',
    url: '/field-notes',
  },
};

export default function FieldNotesPage() {
  return (
    <ComicSectionLayout
      eyebrow="experiments"
      title="field notes"
    >
      <div className="comic-grid">
        <NodeDetailPanel label="Coming Soon" title="Field notes are being organized as thought panels." tone="green" className="comic-span-7 comic-tilt-left">
          <div className="flex items-center gap-3 text-green">
            <PenLine className="h-5 w-5" />
            <span className="technical-label">writing queue</span>
          </div>
          <p className="mt-4">
            Blog-style notes for thinking in public about neural systems, ML, research directions,
            prototypes, and the occasional delightful technical detour.
          </p>
        </NodeDetailPanel>
        <NodeDetailPanel label="Sketches" title="Creative pranks, strange builds, and low-stakes instruments." tone="amber" className="comic-span-5 comic-tilt-right md:mt-10">
          <div className="flex gap-3 text-amber">
            <WandSparkles className="mt-1 h-5 w-5" />
            <p>
              A future home for playful technical artifacts: fast prototypes, odd interfaces,
              tiny tools, and ideas that are better experienced than explained.
            </p>
          </div>
        </NodeDetailPanel>
        <NodeDetailPanel label="Lab Notebook" title="Half-formed ideas before they harden into projects." tone="violet" className="comic-span-6">
          <div className="flex gap-3">
            <Lightbulb className="mt-1 h-5 w-5 text-violet" />
            <p>
              Notes on neural embeddings, searchable scientific memory, multimodal recordings,
              interpretability probes, and interface patterns for research tools.
            </p>
          </div>
        </NodeDetailPanel>
        <NodeDetailPanel label="Prototype Shelf" title="Useful experiments get promoted into the project cortex." tone="cyan" className="comic-span-6 comic-tilt-right">
          <div className="flex gap-3">
            <FlaskConical className="mt-1 h-5 w-5 text-cyan" />
            <p>
              When a note becomes a build, it should eventually link into the builds page with
              code, context, and a cleaner artifact trail.
            </p>
          </div>
        </NodeDetailPanel>
      </div>
    </ComicSectionLayout>
  );
}
