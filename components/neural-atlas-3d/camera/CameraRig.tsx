'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useAtlasStore } from '../atlasStore';
import { ATLAS_LAYOUT } from '../visualConstants';

const nextPosition = new Vector3();
const nextLookAt = new Vector3();

export function CameraRig() {
  const cameraTarget = useAtlasStore((state) => state.cameraTarget);
  const { camera } = useThree();

  useFrame(() => {
    nextPosition.set(...cameraTarget.position);
    nextLookAt.set(...cameraTarget.lookAt);
    camera.position.lerp(nextPosition, ATLAS_LAYOUT.cameraLerp);
    camera.lookAt(nextLookAt);
    if (cameraTarget.fov && 'fov' in camera) {
      camera.fov += (cameraTarget.fov - camera.fov) * ATLAS_LAYOUT.cameraLerp;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
