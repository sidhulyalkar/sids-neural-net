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
          className="group flex min-h-24 items-center justify-between gap-6 py-6 transition-colors hover:text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/60 sm:min-h-28 sm:py-7"
        >
          <div className="min-w-0">
            <h2 className="text-2xl font-light tracking-[-0.035em] text-white transition-colors group-hover:text-cyan sm:text-3xl">
              {game.title}
            </h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">
              {game.subtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
            <span className="hidden sm:inline">{game.version}</span>
            <span className="text-base text-white/35 transition-transform group-hover:translate-x-1 group-hover:text-cyan" aria-hidden="true">
              →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
