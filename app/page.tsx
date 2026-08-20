import dynamic from 'next/dynamic';
import Link from 'next/link';

/**
 * Homepage - Minimal Dendritic Landing
 *
 * A single elegant neuron spread across the screen with navigation
 * labels attached to branch endpoints. No dashboard UI by default.
 */
const MinimalDendriteHome = dynamic(
  () => import('@/components/neural-atlas-canvas').then((module) => module.MinimalDendriteHome),
  {
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[#020306]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full border border-white/20" />
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-white/40">
            Loading neural atlas
          </p>
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <>
      <MinimalDendriteHome />

      <Link
        href="/arcade"
        data-gesture-target
        aria-label="Play games in the Game Arcade"
        className="group fixed right-4 top-4 z-[70] w-[min(15rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-violet/50 bg-[#070812]/95 px-4 py-3.5 shadow-[0_0_42px_rgba(167,139,250,0.20)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-violet/90 hover:bg-violet/[0.12] hover:shadow-[0_0_54px_rgba(167,139,250,0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/80 sm:right-7 sm:top-7 sm:w-[17rem] sm:px-5 sm:py-4"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet/80 to-transparent"
        />
        <span className="flex items-center justify-between gap-4">
          <span>
            <span className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.24em] text-violet">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet" />
              </span>
              Playable now · 3 games
            </span>
            <span className="mt-1.5 block font-mono text-sm font-semibold uppercase tracking-[0.14em] text-white sm:text-[15px]">
              Game Arcade
            </span>
            <span className="mt-1 block text-[10px] leading-4 text-white/50 sm:text-[11px]">
              Stretchicorn · uniRico · Mosslight
            </span>
          </span>
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet/35 bg-violet/10 font-mono text-base text-violet transition-all duration-300 group-hover:translate-x-1 group-hover:border-violet/70 group-hover:bg-violet/20"
          >
            →
          </span>
        </span>
      </Link>
    </>
  );
}
