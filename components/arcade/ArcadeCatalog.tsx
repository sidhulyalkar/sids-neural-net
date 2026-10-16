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
          className="group flex min-h-20 items-center justify-between gap-6 py-5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/60 sm:min-h-24 sm:py-6"
        >
          <h2 className="text-xl font-light tracking-[-0.025em] text-white/80 transition-colors group-hover:text-cyan sm:text-2xl">
            {game.title}
          </h2>
          <span
            aria-hidden="true"
            className="font-mono text-sm text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-cyan"
          >
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
