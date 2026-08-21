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
        aria-label="Open the Game Network"
        className="group fixed right-4 top-4 z-[70] inline-flex items-center gap-2 border border-white/12 bg-black/55 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/55 backdrop-blur-md transition-colors hover:border-cyan/35 hover:text-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/70 sm:right-7 sm:top-7"
      >
        game network
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </>
  );
}
