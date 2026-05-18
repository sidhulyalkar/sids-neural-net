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

type Varicosity = {
  id: string;
  position: [number, number, number];
  scale: number;
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
  const varicosities = useMemo(() => buildVaricosities(seed, branches), [branches, seed]);
  const stateBoost = selected ? 1.12 : active ? 1.07 : 1;
  const opacity = selected ? 0.86 : active ? 0.72 : hovered ? 0.68 : 0.52;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      <SomaMesh color={color} scale={0.62} active={active} hovered={hovered} selected={selected} seed={`${seed}:soma`} />

      {branches.map((branch) => (
        <mesh key={branch.id}>
          <tubeGeometry args={[branch.curve, 16, branch.radius * (active ? 1.12 : 1), 6, false]} />
          <meshStandardMaterial
            color={color}
            emissive="#a88c42"
            emissiveIntensity={selected ? 0.42 : active || hovered ? 0.28 : 0.14}
            transparent
            opacity={opacity}
            roughness={0.92}
            metalness={0}
          />
        </mesh>
      ))}
      {varicosities.map((detail) => (
        <mesh key={detail.id} position={detail.position} scale={detail.scale}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color="#e3d28e"
            emissive="#b99a54"
            emissiveIntensity={active || hovered ? 0.2 : 0.08}
            transparent
            opacity={active || hovered ? 0.84 : 0.62}
            roughness={0.95}
            metalness={0}
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

function buildVaricosities(seed: string, branches: RayBranch[]): Varicosity[] {
  const random = seededRandom(`${seed}:varicosities`);
  const details: Varicosity[] = [];

  branches.forEach((branch, branchIndex) => {
    const count = 2 + Math.floor(random() * 4);
    for (let index = 0; index < count; index += 1) {
      const point = branch.curve.getPoint(0.08 + random() * 0.86);
      const tangent = branch.curve.getTangent(0.5);
      const normal = new Vector3(-tangent.y, tangent.x, (random() - 0.5) * 0.5).normalize();
      const position = point.add(normal.multiplyScalar((random() - 0.5) * 0.08));

      details.push({
        id: `${branch.id}:varicosity:${branchIndex}:${index}`,
        position: [position.x, position.y, position.z],
        scale: 0.022 + random() * 0.045,
      });
    }
  });

  return details;
}
