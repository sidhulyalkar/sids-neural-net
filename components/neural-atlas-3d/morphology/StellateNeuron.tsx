'use client';

import type { AtlasVec3 } from '../atlasTypes';

type StellateNeuronProps = {
  position?: AtlasVec3;
  color: string;
  size?: number;
  onClick?: () => void;
};

export function StellateNeuron({ position = [0, 0, 0], color, size = 1, onClick }: StellateNeuronProps) {
  return (
    <group position={position} scale={size} onClick={onClick}>
      <mesh>
        <sphereGeometry args={[0.46, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.38} />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} rotation={[0, 0, (Math.PI / 4) * index]}>
          <cylinderGeometry args={[0.025, 0.07, 1.42, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}
