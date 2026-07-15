import { Metadata } from 'next';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { VisualArchiveGallery } from '@/components/visual-archive';
import { visualArchive } from '@/src/data/visualArchive';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Visual Cortex',
  description: 'A compact archive for curated field imagery and visual records.',
  alternates: {
    canonical: '/photography',
  },
  openGraph: {
    title: 'Visual Cortex | Sids Neural Net',
    description: 'A darkroom-style visual cortex for curated field images.',
    url: '/photography',
  },
};

export default function PhotographyPage() {
  return (
    <ComicSectionLayout
      eyebrow="archive"
      title="visual cortex"
    >
      <Link
        href="/perceptual-cortex"
        className="group mb-10 block max-w-2xl border border-cyan/20 bg-bg-panel/55 p-5 transition hover:border-cyan/45 hover:bg-bg-panel/80"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan/70">interactive portal</p>
        <h2 className="mt-3 font-mono text-sm uppercase tracking-[0.16em] text-text-primary">Perceptual Cortex <span className="text-cyan/55 transition group-hover:translate-x-1">→</span></h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary/75">Enter a living artwork shaped by gesture, rhythm, movement, and sound.</p>
      </Link>
      {visualArchive.length ? (
        <VisualArchiveGallery entries={visualArchive} />
      ) : (
        <section className="max-w-2xl border-l border-cyan/25 pl-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-cyan/70">curation in progress</p>
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            The public visual cortex is intentionally quiet until selected images are ready.
          </p>
        </section>
      )}
    </ComicSectionLayout>
  );
}
