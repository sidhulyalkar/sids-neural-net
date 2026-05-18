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

type Bouton = {
  id: string;
  position: [number, number, number];
  scale: number;
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
  const boutons = useMemo(() => buildBoutons(seed, branches), [branches, seed]);
  const stateBoost = selected ? 1.1 : active ? 1.06 : 1;

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
            emissive="#a88c42"
            emissiveIntensity={selected ? 0.42 : active || hovered ? 0.28 : 0.14}
            transparent
            opacity={selected ? 0.86 : active || hovered ? 0.72 : 0.54}
            roughness={0.92}
            metalness={0}
          />
        </mesh>
      ))}
      {boutons.map((bouton) => (
        <mesh key={bouton.id} position={bouton.position} scale={bouton.scale}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color="#e7d79d"
            emissive="#b99a54"
            emissiveIntensity={active || hovered ? 0.2 : 0.08}
            transparent
            opacity={active || hovered ? 0.86 : 0.62}
            roughness={0.95}
            metalness={0}
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

function buildBoutons(seed: string, branches: LocalBranch[]): Bouton[] {
  const random = seededRandom(`${seed}:boutons`);

  return branches.flatMap((branch, branchIndex) =>
    Array.from({ length: 2 + Math.floor(random() * 3) }, (_, index) => {
      const point = branch.curve.getPoint(0.18 + random() * 0.76);
      return {
        id: `${branch.id}:bouton:${branchIndex}:${index}`,
        position: [point.x, point.y, point.z] as [number, number, number],
        scale: 0.02 + random() * 0.04,
      };
    })
  );
}
