import type { Metadata } from 'next';
import { ArcadeCatalog } from '@/components/arcade/ArcadeCatalog';
import { ArcadeNeuralField } from '@/components/arcade/ArcadeNeuralField';
import { arcadeGames } from '@/src/data/arcadeGames';

export const metadata: Metadata = {
  title: 'Game Arcade',
  description: 'A neural playspace for compact games, experiments, and strange interactive systems.',
  alternates: { canonical: '/arcade' },
  openGraph: {
    title: 'Game Arcade | Sids Neural Net',
    description: 'Custom games presented inside a focused neural play chamber.',
    url: '/arcade',
  },
};

export default function ArcadePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#020306] px-4 pb-20 pt-20 text-white sm:px-8 sm:pt-28 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(76,194,224,.12),transparent_38%),linear-gradient(180deg,#030609,#010203)]" />
      <ArcadeNeuralField />
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.27em] text-cyan/70">interactive lobe · custom game archive</p>
          <h1 className="mt-5 text-5xl font-light tracking-[-0.055em] text-white sm:text-7xl">game arcade</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/45 sm:text-lg">
            Small games get the whole nervous system. Each one opens inside a dedicated play chamber with its own input focus, fullscreen path, controls, and a geometric field that recedes when the game takes over.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 font-mono text-[9px] uppercase tracking-[0.17em] text-white/30">
            <span>{arcadeGames.length} games docked</span>
            <span>canvas + web runtimes</span>
            <span>future-game ready</span>
          </div>
        </header>

        <section className="mt-16 sm:mt-20" aria-label="Custom games">
          <ArcadeCatalog games={arcadeGames} />
        </section>
      </div>
    </main>
  );
}
