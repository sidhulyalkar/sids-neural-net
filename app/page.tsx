import dynamic from 'next/dynamic';
import Link from 'next/link';

/**
 * Homepage - Minimal Dendritic Landing
 *
 * A single elegant neuron spread across the screen with navigation
 * labels attached to branch endpoints. FRONTIER and the Game Network
 * remain lightweight peripheral signals around the atlas.
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
        aria-label="Open the Game Network"
        className="group fixed right-4 top-4 z-[70] inline-flex items-center gap-2 border border-white/12 bg-black/55 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/55 backdrop-blur-md transition-colors hover:border-cyan/35 hover:text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 sm:right-7 sm:top-7"
      >
        game network
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>

      <Link
        href="/frontier"
        aria-label="Open FRONTIER personal intelligence radar"
        className="group fixed bottom-5 right-4 z-40 flex items-center gap-3 rounded-full border border-cyan/15 bg-[#03090d]/80 px-4 py-2.5 shadow-[0_18px_65px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-cyan/35 hover:bg-cyan/[0.055] sm:bottom-7 sm:right-7"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan/50 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan shadow-[0_0_14px_rgba(102,227,255,0.75)]" />
        </span>
        <span className="text-left">
          <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-cyan/80">FRONTIER</span>
          <span className="block text-[10px] text-white/40 transition-colors group-hover:text-white/60">personal live radar</span>
        </span>
      </Link>
    </>
  );
}
