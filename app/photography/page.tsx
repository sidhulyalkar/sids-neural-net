import { Metadata } from 'next';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { VisualArchiveGallery } from '@/components/visual-archive';
import { visualArchive } from '@/src/data/visualArchive';

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
