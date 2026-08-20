import type { Metadata } from 'next';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { VisualArchiveGallery } from '@/components/visual-archive';
import { VisualMotionGallery } from '@/components/visual-archive/VisualMotionGallery';
import { visualArchive } from '@/src/data/visualArchive';
import { visualMotion } from '@/src/data/visualMotion';

export const metadata: Metadata = {
  title: 'Visual Cortex',
  description: 'A high-resolution archive for field photography, action-camera motion, and visual experiments.',
  alternates: {
    canonical: '/photography',
  },
  openGraph: {
    title: 'Visual Cortex | Sids Neural Net',
    description: 'A darkroom-style visual cortex for curated field images and motion.',
    url: '/photography',
  },
};

export default function PhotographyPage() {
  return (
    <ComicSectionLayout eyebrow="archive" title="visual cortex">
      <section className="mb-14 max-w-3xl border-l border-cyan/25 pl-5 sm:mb-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/70">still light · moving light</p>
        <p className="mt-3 text-sm leading-7 text-text-secondary">
          Photography remains the fast first layer. Motion is poster-first and only loads when requested, preserving room for high-bitrate DJI footage without making every visit download a film reel.
        </p>
      </section>

      <section aria-labelledby="visual-motion-heading" className="mb-20 sm:mb-28">
        <div className="mb-7 flex items-end justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan/55">motion studies</p>
            <h2 id="visual-motion-heading" className="mt-2 text-2xl font-light tracking-tight text-white">Action-camera records</h2>
          </div>
          <p className="hidden font-mono text-[8px] uppercase tracking-[0.16em] text-white/25 sm:block">manual quality · fullscreen · lazy load</p>
        </div>
        <VisualMotionGallery entries={visualMotion} />
      </section>

      <section aria-labelledby="visual-stills-heading">
        <div className="mb-7 border-b border-white/8 pb-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan/55">still archive</p>
          <h2 id="visual-stills-heading" className="mt-2 text-2xl font-light tracking-tight text-white">Field imagery</h2>
        </div>
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
      </section>
    </ComicSectionLayout>
  );
}
