import Link from 'next/link';
import { ArrowUpRight, Gamepad2, LockKeyhole, Play } from 'lucide-react';
import type { ArcadeGame } from '@/src/data/arcadeGames';

export function ArcadeCatalog({ games }: { games: ArcadeGame[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {games.map((game, index) => (
        <article key={game.slug} className="group relative overflow-hidden border border-white/10 bg-[#05080c]/80 p-1 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(125deg,rgba(103,224,255,.08),transparent_35%,rgba(255,255,255,.025)_70%,transparent)] opacity-70 transition duration-500 group-hover:opacity-100" />
          <div aria-hidden="true" className="absolute left-0 top-0 h-12 w-12 border-l border-t border-cyan/45 transition-all duration-500 group-hover:h-16 group-hover:w-16" />
          <div aria-hidden="true" className="absolute bottom-0 right-0 h-9 w-9 border-b border-r border-white/20" />
          <div className="relative min-h-[24rem] border border-white/[0.065] bg-[radial-gradient(circle_at_70%_15%,rgba(103,224,255,.09),transparent_32%),#030507] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center border border-cyan/25 bg-cyan/[0.055] text-cyan/80 [transform:rotate(45deg)]">
                <Gamepad2 className="h-5 w-5 [transform:rotate(-45deg)]" aria-hidden="true" />
              </div>
              <div className="text-right font-mono text-[9px] uppercase tracking-[0.17em] text-white/30">
                <p>chamber {String(index + 1).padStart(2, '0')}</p>
                <p className="mt-1">{game.version}</p>
              </div>
            </div>

            <div className="mt-16">
              <p className="font-mono text-[9px] uppercase tracking-[0.23em] text-cyan/60">{game.status === 'playable' ? 'runtime online' : 'runtime docking'}</p>
              <h2 className="mt-3 text-4xl font-light tracking-[-0.04em] text-white sm:text-5xl">{game.title}</h2>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.17em] text-white/35">{game.subtitle}</p>
              <p className="mt-6 max-w-xl text-sm leading-6 text-white/45">{game.description}</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {game.tags.map((tag) => <span key={tag} className="border border-white/8 bg-white/[0.025] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.13em] text-white/35">{tag}</span>)}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={`/arcade/${game.slug}`} className="inline-flex items-center gap-2 border border-cyan/30 bg-cyan/[0.07] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.17em] text-cyan transition hover:border-cyan/70 hover:bg-cyan/[0.12]">
                <Play className="h-3.5 w-3.5" /> enter chamber
              </Link>
              {game.repoUrl && <a href={game.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-2 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35 transition hover:text-white/70">source <ArrowUpRight className="h-3 w-3" /></a>}
              {game.sourceVisibility === 'private' && <span className="inline-flex items-center gap-2 px-2 py-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/25"><LockKeyhole className="h-3 w-3" /> private source</span>}
            </div>
          </div>
        </article>
      ))}

      <article className="relative flex min-h-[24rem] items-center justify-center border border-dashed border-white/10 bg-white/[0.012] p-8 text-center">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/25">expandable slot</p>
          <p className="mt-4 text-3xl font-light tracking-tight text-white/40">the next strange little world goes here.</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/25">New games join the arcade through a single typed registry entry and an HTTPS runtime. The play chamber, focus controls, framing, and accessibility layer are already reusable.</p>
        </div>
      </article>
    </div>
  );
}
