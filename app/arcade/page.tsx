import type { Metadata } from 'next';
import { ArcadeCatalog } from '@/components/arcade/ArcadeCatalog';
import { arcadeGames } from '@/src/data/arcadeGames';

export const metadata: Metadata = {
  title: 'Game Network',
  description: 'A minimal network of playable browser games by Sidharth Hulyalkar.',
  alternates: { canonical: '/arcade' },
  openGraph: {
    title: 'Game Network | Sids Neural Net',
    description: 'Stretchicorn, uniRico, and Sylvaria, playable directly in the browser.',
    url: '/arcade',
  },
};

export default function ArcadePage() {
  return (
    <main className="min-h-screen bg-[#020306] px-4 pb-20 pt-20 text-white sm:px-8 sm:pt-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-mono text-[10px] font-normal uppercase tracking-[0.28em] text-white/40">
          game network
        </h1>

        <section className="mt-8 sm:mt-10" aria-label="Games in the Game Network">
          <ArcadeCatalog games={arcadeGames} />
        </section>
      </div>
    </main>
  );
}
