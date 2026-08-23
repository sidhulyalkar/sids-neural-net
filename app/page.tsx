import dynamic from 'next/dynamic';

/**
 * Homepage - Eight-way radial dendritic landing
 *
 * The homepage is the permanent launch surface for the portfolio's eight
 * primary destinations. Every destination owns one evenly spaced primary
 * dendrite and a matched subtree density so the neuron remains balanced
 * across viewport sizes.
 */
const RadialDendriteHome = dynamic(
  () => import('@/components/neural-atlas-canvas').then((module) => module.RadialDendriteHome),
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
  return <RadialDendriteHome />;
}
