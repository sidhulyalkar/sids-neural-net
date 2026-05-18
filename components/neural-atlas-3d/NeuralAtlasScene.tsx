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
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', isDeepView ? 10 : 18, isDeepView ? 28 : 40]} />
      <ambientLight intensity={isDeepView ? 0.15 : 0.2} />
      <pointLight position={[0, 0, 8]} intensity={isArrival ? 4.5 : 3.2} color="#00ffff" />
      <pointLight position={[-8, 5, 4]} intensity={isDeepView ? 1.2 : 1.8} color="#c084fc" />
      <pointLight position={[5, -4, 6]} intensity={isDeepView ? 1.8 : 1.0} color="#39ff14" />
      <CameraRig graph={graph} />
      <GlialParticleField />
      <NeuralSubnetwork graph={graph} />
    </>
  );
}
