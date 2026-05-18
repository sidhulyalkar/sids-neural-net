'use client';

import type { AtlasGraph } from './atlasTypes';
import { useAtlasStore } from './atlasStore';
import { CameraRig } from './camera/CameraRig';
import { GlialParticleField } from './morphology/GlialParticleField';
import { NeuralSubnetwork } from './graph/NeuralSubnetwork';

type NeuralAtlasSceneProps = {
  graph: AtlasGraph;
};

export function NeuralAtlasScene({ graph }: NeuralAtlasSceneProps) {
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const isDeepView = Boolean(activeCategoryId || selectedLeafId);
  const isArrival = transitionPhase === 'arriving';

  return (
    <>
      <color attach="background" args={['#030303']} />
      <fog attach="fog" args={['#030303', isDeepView ? 12 : 20, isDeepView ? 34 : 48]} />
      <ambientLight intensity={isDeepView ? 0.55 : 0.48} />
      <pointLight position={[0, 0, 8]} intensity={isArrival ? 3.8 : 2.8} color="#f4f1eb" />
      <pointLight position={[-8, 5, 4]} intensity={isDeepView ? 0.9 : 1.3} color="#9fc7cf" />
      <pointLight position={[5, -4, 6]} intensity={isDeepView ? 1.1 : 0.8} color="#e5ded2" />
      <CameraRig graph={graph} />
      <GlialParticleField />
      <NeuralSubnetwork graph={graph} />
    </>
  );
}
