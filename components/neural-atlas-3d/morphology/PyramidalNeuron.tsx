'use client';

import { useMemo } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Vector3 } from 'three';
import { SomaMesh, seededRandom } from './SomaMesh';
import type { NeuronMorphologyProps } from './SomaMesh';

type Branch = {
  id: string;
  curve: CatmullRomCurve3;
  radius: number;
};

export function PyramidalNeuron({
  position = [0, 0, 0],
  color,
  scale = 1,
  active = false,
  hovered = false,
  selected = false,
  seed = 'pyramidal',
  onClick,
}: NeuronMorphologyProps) {
  const branches = useMemo(() => buildBranches(seed), [seed]);
  const stateBoost = selected ? 1.16 : active ? 1.1 : hovered ? 1.06 : 1;
  const branchOpacity = selected ? 0.78 : active ? 0.64 : hovered ? 0.56 : 0.34;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      <group scale={[0.78, 0.95, 0.78]}>
        <SomaMesh color={color} scale={0.78} active={active} hovered={hovered} selected={selected} seed={`${seed}:soma`} />
      </group>

      <mesh position={[0, 0.18, 0]} scale={[0.74, 1.08, 0.66]}>
        <coneGeometry args={[0.56, 1.12, 5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.74 : active || hovered ? 0.48 : 0.28}
          roughness={0.58}
          metalness={0.03}
        />
      </mesh>

      <mesh position={[0, 0.92, 0]} scale={[0.42, 1.6, 0.42]}>
        <sphereGeometry args={[0.28, 18, 14]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
      </mesh>

      {branches.map((branch) => (
        <mesh key={branch.id}>
          <tubeGeometry args={[branch.curve, 18, branch.radius * (hovered || active ? 1.22 : 1), 7, false]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 0.42 : active || hovered ? 0.28 : 0.14}
            transparent
            opacity={branchOpacity}
            roughness={0.72}
          />
        </mesh>
      ))}
    </group>
  );
}

function buildBranches(seed: string): Branch[] {
  const random = seededRandom(seed);
  const branches: Branch[] = [];

  branches.push({
    id: 'apical',
    radius: 0.036,
    curve: new CatmullRomCurve3([
      new Vector3(0, 0.45, 0),
      new Vector3((random() - 0.5) * 0.18, 1.28, 0.08),
      new Vector3((random() - 0.5) * 0.24, 2.15, -0.06),
      new Vector3((random() - 0.5) * 0.34, 2.82, 0.1),
    ]),
  });

  for (let index = 0; index < 7; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const spread = 0.72 + random() * 0.72;
    const y = -0.22 - random() * 0.48;
    const z = (random() - 0.5) * 0.34;
    branches.push({
      id: `basal:${index}`,
      radius: 0.018 + random() * 0.015,
      curve: new CatmullRomCurve3([
        new Vector3(0, -0.18, 0),
        new Vector3(side * spread * 0.34, y - random() * 0.18, z * 0.4),
        new Vector3(side * spread, y - random() * 0.28, z),
      ]),
    });
  }

  for (let index = 0; index < 5; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const y = 1.1 + random() * 1.2;
    branches.push({
      id: `apical-branch:${index}`,
      radius: 0.012 + random() * 0.01,
      curve: new CatmullRomCurve3([
        new Vector3(0, y, 0),
        new Vector3(side * (0.22 + random() * 0.22), y + 0.12, (random() - 0.5) * 0.18),
        new Vector3(side * (0.55 + random() * 0.34), y + 0.22 + random() * 0.22, (random() - 0.5) * 0.28),
      ]),
    });
  }

  return branches;
}
