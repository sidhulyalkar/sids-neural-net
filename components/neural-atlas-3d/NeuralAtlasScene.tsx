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
      <color attach="background" args={['#02040c']} />
      <fog attach="fog" args={['#02040c', isDeepView ? 7 : 12, isDeepView ? 20 : 28]} />
      <ambientLight intensity={isDeepView ? 0.26 : 0.35} />
      <pointLight position={[0, 0, 7]} intensity={isArrival ? 3 : 2.1} color="#66e3ff" />
      <pointLight position={[-7, 4, 3]} intensity={isDeepView ? 0.75 : 1.1} color="#a78bfa" />
      <pointLight position={[4, -3, 5]} intensity={isDeepView ? 1.2 : 0.55} color="#66f0c2" />
      <CameraRig graph={graph} />
      <GlialParticleField />
      <NeuralSubnetwork graph={graph} />
    </>
  );
}
