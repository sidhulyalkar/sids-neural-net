'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { NeuralAtlasScene } from './NeuralAtlasScene';
import { NeuralAtlasLoading } from './NeuralAtlasLoading';
import type { AtlasGraph } from './atlasTypes';

type NeuralAtlasCanvasProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasCanvas({ graph }: NeuralAtlasCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 18], fov: 46 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <NeuralAtlasScene graph={graph} />
        <EffectComposer>
          <Bloom intensity={0.42} luminanceThreshold={0.18} luminanceSmoothing={0.7} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
