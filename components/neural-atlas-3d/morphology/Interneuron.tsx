'use client';

import type { AtlasVec3 } from '../atlasTypes';

type InterneuronProps = {
  position?: AtlasVec3;
  color: string;
  size?: number;
  onClick?: () => void;
};

export function Interneuron({ position = [0, 0, 0], color, size = 1, onClick }: InterneuronProps) {
  return (
    <group position={position} scale={size} onClick={onClick}>
      <mesh scale={[1.15, 0.82, 0.82]}>
        <sphereGeometry args={[0.52, 24, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.42} roughness={0.36} />
      </mesh>
    </group>
  );
}
