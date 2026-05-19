import dynamic from 'next/dynamic';

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
  return <MinimalDendriteHome />;
}
