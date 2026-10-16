import { Metadata } from 'next';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Learning Trails',
  description: 'A structured map of current learning paths and areas of study.',
  alternates: {
    canonical: '/learning-trails',
  },
  openGraph: {
    title: 'Learning Trails | Sids Neural Net',
    description: 'A structured map of current learning paths and areas of active study.',
    url: '/learning-trails',
  },
};

export default function LearningTrailsPage() {
  return (
    <ComicSectionLayout
      eyebrow="study"
      title="learning trails"
    >
      <section className="max-w-2xl border-l border-violet/25 pl-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-violet/70">in progress</p>
        <p className="mt-3 text-sm leading-7 text-text-secondary">
          Learning paths for mechanistic interpretability, systems programming, and active areas of study.
        </p>
      </section>
    </ComicSectionLayout>
  );
}
