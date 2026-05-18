'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { useAtlasStore } from '../atlasStore';
import type { AtlasGraph } from '../atlasTypes';
import { ATLAS_LAYOUT } from '../visualConstants';
import { categoryTarget, leafTarget, overviewTarget } from './cameraTargets';

const nextPosition = new Vector3();
const nextLookAt = new Vector3();

type CameraRigProps = {
  graph: AtlasGraph;
};

export function CameraRig({ graph }: CameraRigProps) {
  const cameraTarget = useAtlasStore((state) => state.cameraTarget);
  const level = useAtlasStore((state) => state.level);
  const activeCategoryId = useAtlasStore((state) => state.activeCategoryId);
  const selectedLeafId = useAtlasStore((state) => state.selectedLeafId);
  const setCameraTarget = useAtlasStore((state) => state.setCameraTarget);
  const { camera } = useThree();
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  useEffect(() => {
    const selectedLeaf = selectedLeafId ? nodeById.get(selectedLeafId) : null;
    const activeCategory = activeCategoryId ? nodeById.get(activeCategoryId) : null;

    if (selectedLeaf) {
      setCameraTarget(leafTarget(selectedLeaf, activeCategory));
      return;
    }
    if (activeCategory) {
      setCameraTarget(categoryTarget(activeCategory));
      return;
    }
    if (level === 'root') setCameraTarget(overviewTarget());
  }, [activeCategoryId, level, nodeById, selectedLeafId, setCameraTarget]);

  useFrame(() => {
    nextPosition.set(...cameraTarget.position);
    nextLookAt.set(...cameraTarget.lookAt);
    const distance = camera.position.distanceTo(nextPosition);
    const lerp = Math.min(0.12, ATLAS_LAYOUT.cameraLerp + distance * 0.003);
    camera.position.lerp(nextPosition, lerp);
    camera.lookAt(nextLookAt);
    if (cameraTarget.fov && 'fov' in camera) {
      camera.fov += (cameraTarget.fov - camera.fov) * lerp;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
