'use client';

import type { AtlasGraph } from './atlasTypes';
import { CameraRig } from './camera/CameraRig';
import { GlialParticleField } from './morphology/GlialParticleField';
import { NeuralSubnetwork } from './graph/NeuralSubnetwork';

type NeuralAtlasSceneProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasScene({ graph }: NeuralAtlasSceneProps) {
  return (
    <>
      <color attach="background" args={['#02040c']} />
      <fog attach="fog" args={['#02040c', 12, 28]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 7]} intensity={2.1} color="#66e3ff" />
      <pointLight position={[-7, 4, 3]} intensity={1.1} color="#a78bfa" />
      <CameraRig />
      <GlialParticleField />
      <NeuralSubnetwork graph={graph} />
    </>
  );
}
