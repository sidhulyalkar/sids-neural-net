import type { Metadata } from 'next';
import { ArcadeCatalog } from '@/components/arcade/ArcadeCatalog';
import { arcadeGames } from '@/src/data/arcadeGames';

export const metadata: Metadata = {
  title: 'Game Network',
  description: 'Play the current production builds of Stretchicorn and uniRico directly in the browser.',
  alternates: { canonical: '/arcade' },
  openGraph: {
    title: 'Game Network | Sids Neural Net',
    description: 'Stretchicorn and uniRico, current GitHub-pinned builds playable directly in the browser.',
    url: '/arcade',
  },
};

export default function ArcadePage() {
  return (
    <main className="min-h-screen bg-[#020306] px-4 pb-20 pt-20 text-white sm:px-8 sm:pt-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h1 className="font-mono text-[10px] font-normal uppercase tracking-[0.28em] text-white/40">
            game network
          </h1>
          <p className="mt-4 text-sm font-light leading-6 text-white/45 sm:text-base">
            Two finished browser experiments, served from immutable snapshots of their current GitHub releases.
            Pick a signal and play it here.
          </p>
        </div>

        <section className="mt-8 sm:mt-10" aria-label="Published games in the Game Network">
          <ArcadeCatalog games={arcadeGames} />
        </section>
      </div>
    </main>
  );
}
