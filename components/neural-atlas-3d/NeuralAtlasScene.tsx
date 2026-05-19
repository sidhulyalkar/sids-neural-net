'use client';

import type { AtlasGraph } from './atlasTypes';
import { useAtlasStore } from './atlasStore';
import { CameraRig } from './camera/CameraRig';
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
      <fog attach="fog" args={['#000000', isDeepView ? 14 : 22, isDeepView ? 40 : 55]} />
      <ambientLight intensity={isDeepView ? 0.45 : 0.38} />
      <pointLight position={[0, 0, 10]} intensity={isArrival ? 3.2 : 2.4} color="#f4f1eb" />
      <pointLight position={[-10, 6, 5]} intensity={isDeepView ? 0.8 : 1.1} color="#9fc7cf" />
      <pointLight position={[6, -5, 7]} intensity={isDeepView ? 0.9 : 0.7} color="#e5ded2" />
      <CameraRig graph={graph} />
      <NeuralSubnetwork graph={graph} />
    </>
  );
}
