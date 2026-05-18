'use client';

import type { AtlasVec3 } from '../atlasTypes';

type SomaMeshProps = {
  position?: AtlasVec3;
  color: string;
  size?: number;
  onClick?: () => void;
};

export function SomaMesh({ position = [0, 0, 0], color, size = 1, onClick }: SomaMeshProps) {
  return (
    <mesh position={position} scale={size} onClick={onClick}>
      <sphereGeometry args={[0.72, 32, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.42} />
    </mesh>
  );
}
