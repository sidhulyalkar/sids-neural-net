'use client';

import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { SomaMesh, seededRandom } from './SomaMesh';
import type { NeuronMorphologyProps } from './SomaMesh';

type RayBranch = {
  id: string;
  curve: CatmullRomCurve3;
  radius: number;
};

export function StellateNeuron({
  position = [0, 0, 0],
  color,
  scale = 1,
  active = false,
  hovered = false,
  selected = false,
  seed = 'stellate',
  onClick,
}: NeuronMorphologyProps) {
  const branches = useMemo(() => buildBranches(seed), [seed]);
  const stateBoost = selected ? 1.14 : active ? 1.09 : hovered ? 1.05 : 1;
  const opacity = selected ? 0.72 : active ? 0.6 : hovered ? 0.54 : 0.32;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      <SomaMesh color={color} scale={0.62} active={active} hovered={hovered} selected={selected} seed={`${seed}:soma`} />

      {branches.map((branch) => (
        <mesh key={branch.id}>
          <tubeGeometry args={[branch.curve, 16, branch.radius * (active || hovered ? 1.18 : 1), 6, false]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 0.85 : active || hovered ? 0.6 : 0.35}
            transparent
            opacity={opacity}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

function buildBranches(seed: string): RayBranch[] {
  const random = seededRandom(seed);
  const count = 10;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.34;
    const length = 0.9 + random() * 0.7;
    const bend = (random() - 0.5) * 0.42;
    const z = (random() - 0.5) * 0.52;
    const end = new Vector3(Math.cos(angle) * length, Math.sin(angle) * length * 0.82, z);
    const mid = new Vector3(
      Math.cos(angle + bend) * length * 0.48,
      Math.sin(angle + bend) * length * 0.44,
      z * 0.45 + (random() - 0.5) * 0.16
    );

    return {
      id: `stellate:${index}`,
      radius: 0.014 + random() * 0.012,
      curve: new CatmullRomCurve3([new Vector3(0, 0, 0), mid, end]),
    };
  });
}
