import dynamic from 'next/dynamic';

/**
 * Homepage - Adaptive Fractal Dendritic Landing
 *
 * The landing neuron owns all eight primary destinations. Its geometry is
 * generated client-side from the actual viewport so wide screens receive a
 * wide arbor, portrait screens receive a taller arbor, and each visit gets a
 * fresh procedural morphology without changing the navigation topology.
 */
const AdaptiveFractalHome = dynamic(
  () => import('@/components/neural-atlas-canvas').then((module) => module.AdaptiveFractalHome),
  {
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[#010204]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full border border-white/20" />
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-white/40">
            Growing dendritic field
          </p>
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <AdaptiveFractalHome />;
}
