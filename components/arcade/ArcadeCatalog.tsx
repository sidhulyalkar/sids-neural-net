import Link from 'next/link';
import type { ArcadeGame } from '@/src/data/arcadeGames';

export function ArcadeCatalog({ games }: { games: ArcadeGame[] }) {
  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {games.map((game) => (
        <Link
          key={game.slug}
          href={`/arcade/${game.slug}`}
          data-gesture-target
          className="group grid min-h-28 gap-4 py-6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/60 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:py-7"
        >
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
              <span>published build</span>
              <span aria-hidden="true">·</span>
              <span>{game.version}</span>
              {game.sourceCommit && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>GitHub {game.sourceCommit.slice(0, 7)}</span>
                </>
              )}
            </div>
            <h2 className="mt-2 text-xl font-light tracking-[-0.025em] text-white/85 transition-colors group-hover:text-cyan sm:text-2xl">
              {game.title}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/35 sm:text-sm">
              {game.subtitle}
            </p>
          </div>

          <span className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30 transition-colors group-hover:text-cyan">
            play
            <span aria-hidden="true" className="text-base transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
