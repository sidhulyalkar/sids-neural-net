import type { Metadata } from 'next';
import { NatureWorldThumbnail2D } from '@/components/physiology/nature2d/NatureWorldThumbnail2D';
import { getNatureWorld } from '@/lib/physiology/natureWorldsExpanded';
import { NATURE_VISUAL_CORPUS } from '@/lib/physiology/natureVisualCorpus';

export const metadata: Metadata = {
  title: 'Nature Atlas Visual Audit',
  robots: { index: false, follow: false },
};

export default function NatureAtlasVisualAuditPage() {
  return (
    <main className="min-h-screen bg-[#071014] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-8 max-w-4xl">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-cyan/70">deterministic visual regression corpus</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">Nature Atlas canonical worlds</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            A stable cross-section of every collection plus explicit atmosphere, density, terrain, macro, floral, celestial, weather, and unusual-focal coverage. CI captures this page at desktop and mobile sizes after every relevant change.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {NATURE_VISUAL_CORPUS.map((fixture) => {
            const world = getNatureWorld(fixture.worldId);
            return (
              <article key={fixture.key} data-visual-fixture={fixture.key} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <NatureWorldThumbnail2D world={world} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white/90">{world.icon} {world.name}</p>
                    <p className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.11em] text-white/40">world {String(world.index).padStart(3, '0')} · {world.collection}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[0.52rem] text-white/45">{world.scene.depth}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {fixture.facets.map((facet) => (
                    <span key={facet} className="rounded-full bg-white/[0.055] px-2 py-1 font-mono text-[0.5rem] text-white/48">{facet}</span>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
