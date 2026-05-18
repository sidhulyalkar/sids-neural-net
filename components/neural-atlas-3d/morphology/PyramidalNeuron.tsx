'use client';

import type { AtlasVec3 } from '../atlasTypes';

type PyramidalNeuronProps = {
  position?: AtlasVec3;
  color: string;
  size?: number;
  onClick?: () => void;
};

export function PyramidalNeuron({ position = [0, 0, 0], color, size = 1, onClick }: PyramidalNeuronProps) {
  return (
    <group position={position} scale={size} onClick={onClick}>
      <mesh>
        <coneGeometry args={[0.72, 1.45, 5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.72, 0]}>
        <sphereGeometry args={[0.34, 18, 18]} />
        <meshStandardMaterial color="#f8fbff" emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}
