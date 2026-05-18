'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeuralAtlasScene } from './NeuralAtlasScene';
import type { AtlasGraph } from './atlasTypes';

type NeuralAtlasCanvasProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasCanvas({ graph }: NeuralAtlasCanvasProps) {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      camera={{ position: [0, 0, 16], fov: 42 }}
      dpr={[1, 1.25]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <NeuralAtlasScene graph={graph} />
      </Suspense>
    </Canvas>
  );
}
