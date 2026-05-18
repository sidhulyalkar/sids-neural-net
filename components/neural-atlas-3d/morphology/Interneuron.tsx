'use client';

import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { SomaMesh, seededRandom } from './SomaMesh';
import type { NeuronMorphologyProps } from './SomaMesh';

type LocalBranch = {
  id: string;
  curve: CatmullRomCurve3;
  radius: number;
};

export function Interneuron({
  position = [0, 0, 0],
  color,
  scale = 1,
  active = false,
  hovered = false,
  selected = false,
  seed = 'interneuron',
  onClick,
}: NeuronMorphologyProps) {
  const branches = useMemo(() => buildBranches(seed), [seed]);
  const stateBoost = selected ? 1.12 : active ? 1.07 : hovered ? 1.04 : 1;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      <group scale={[1.08, 0.82, 0.86]}>
        <SomaMesh color={color} scale={0.58} active={active} hovered={hovered} selected={selected} seed={`${seed}:soma`} />
      </group>

      {branches.map((branch) => (
        <mesh key={branch.id}>
          <tubeGeometry args={[branch.curve, 12, branch.radius, 6, false]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 0.9 : active || hovered ? 0.6 : 0.35}
            transparent
            opacity={selected ? 0.74 : active || hovered ? 0.58 : 0.35}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

function buildBranches(seed: string): LocalBranch[] {
  const random = seededRandom(seed);

  return Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2 + (random() - 0.5) * 0.28;
    const length = 0.45 + random() * 0.48;
    const z = (random() - 0.5) * 0.38;
    const midAngle = angle + (random() - 0.5) * 0.6;

    return {
      id: `interneuron:${index}`,
      radius: 0.01 + random() * 0.011,
      curve: new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(Math.cos(midAngle) * length * 0.46, Math.sin(midAngle) * length * 0.38, z * 0.5),
        new Vector3(Math.cos(angle) * length, Math.sin(angle) * length * 0.75, z),
      ]),
    };
  });
}
