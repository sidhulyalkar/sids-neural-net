import type { Metadata } from 'next';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { VisualArchiveGallery } from '@/components/visual-archive';
import { VisualMotionGallery } from '@/components/visual-archive/VisualMotionGallery';
import { visualArchive } from '@/src/data/visualArchive';
import { visualMotion } from '@/src/data/visualMotion';

export const metadata: Metadata = {
  title: 'Visual Cortex',
  description: 'Selected photography and video by Sidharth Hulyalkar.',
  alternates: {
    canonical: '/photography',
  },
  openGraph: {
    title: 'Visual Cortex | Sids Neural Net',
    description: 'Selected photography and video by Sidharth Hulyalkar.',
    url: '/photography',
  },
};

export default function PhotographyPage() {
  return (
    <ComicSectionLayout eyebrow="archive" title="visual cortex">
      <section aria-label="Photography">
        {visualArchive.length ? (
          <VisualArchiveGallery entries={visualArchive} />
        ) : (
          <p className="text-sm text-text-secondary">Selected photography coming soon.</p>
        )}
      </section>

      {visualMotion.length > 0 && (
        <section className="mt-24 sm:mt-32" aria-label="Videos">
          <VisualMotionGallery entries={visualMotion} />
        </section>
      )}
    </ComicSectionLayout>
  );
}
