'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { buildAtlasGraph } from './atlasDataAdapter';
import { NeuralAtlasFallback } from './NeuralAtlasFallback';
import { NeuralAtlasLoading } from './NeuralAtlasLoading';
import { NeuralAtlasOverlay } from './NeuralAtlasOverlay';

const NeuralAtlasCanvas = dynamic(
  () => import('./NeuralAtlasCanvas').then((module) => module.NeuralAtlasCanvas),
  {
    ssr: false,
    loading: () => <NeuralAtlasLoading />,
  }
);

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function NeuralAtlasExperience() {
  const graph = useMemo(() => buildAtlasGraph(), []);
  const [fallbackReason, setFallbackReason] = useState<'reduced-motion' | 'webgl-unavailable' | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setFallbackReason('reduced-motion');
      return;
    }
    if (!canUseWebGL()) {
      setFallbackReason('webgl-unavailable');
    }
  }, []);

  if (fallbackReason) {
    return <NeuralAtlasFallback reason={fallbackReason} />;
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-bg-deep text-text-primary">
      <NeuralAtlasCanvas graph={graph} />
      <NeuralAtlasOverlay graph={graph} />
    </section>
  );
}
