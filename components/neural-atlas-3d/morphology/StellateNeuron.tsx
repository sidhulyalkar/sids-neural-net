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
  const branches: RayBranch[] = [];
  const primaryCount = 14;

  // Primary dendrites radiating outward
  for (let index = 0; index < primaryCount; index += 1) {
    const angle = (index / primaryCount) * Math.PI * 2 + (random() - 0.5) * 0.25;
    const length = 0.8 + random() * 0.6;
    const wobble = () => (random() - 0.5) * 0.12;
    const z = (random() - 0.5) * 0.45;

    const endX = Math.cos(angle) * length;
    const endY = Math.sin(angle) * length * 0.85;

    // Main branch with organic curve
    branches.push({
      id: `stellate:${index}`,
      radius: 0.013 + random() * 0.01,
      curve: new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(endX * 0.25 + wobble(), endY * 0.25 + wobble(), z * 0.2),
        new Vector3(endX * 0.55 + wobble(), endY * 0.55 + wobble(), z * 0.5),
        new Vector3(endX + wobble(), endY + wobble(), z),
      ]),
    });

    // Secondary branches from primary dendrites
    if (random() > 0.35) {
      const branchPoint = 0.45 + random() * 0.35;
      const secAngle = angle + (random() - 0.5) * 1.5;
      const secLength = length * (0.35 + random() * 0.25);

      branches.push({
        id: `stellate-sec:${index}a`,
        radius: 0.007 + random() * 0.005,
        curve: new CatmullRomCurve3([
          new Vector3(endX * branchPoint, endY * branchPoint, z * branchPoint),
          new Vector3(
            Math.cos(secAngle) * secLength + endX * branchPoint,
            Math.sin(secAngle) * secLength * 0.8 + endY * branchPoint,
            z * branchPoint + (random() - 0.5) * 0.15
          ),
        ]),
      });
    }

    // Additional secondary on opposite side
    if (random() > 0.55) {
      const branchPoint = 0.6 + random() * 0.25;
      const secAngle = angle - (random() - 0.5) * 1.2;
      const secLength = length * (0.25 + random() * 0.2);

      branches.push({
        id: `stellate-sec:${index}b`,
        radius: 0.005 + random() * 0.004,
        curve: new CatmullRomCurve3([
          new Vector3(endX * branchPoint, endY * branchPoint, z * branchPoint),
          new Vector3(
            Math.cos(secAngle) * secLength + endX * branchPoint,
            Math.sin(secAngle) * secLength * 0.7 + endY * branchPoint,
            z * branchPoint + (random() - 0.5) * 0.12
          ),
        ]),
      });
    }
  }

  return branches;
}
