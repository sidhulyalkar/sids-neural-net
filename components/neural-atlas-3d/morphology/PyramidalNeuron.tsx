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
          emissiveIntensity={selected ? 1.4 : active || hovered ? 1.0 : 0.65}
          roughness={0.35}
          metalness={0.02}
        />
      </mesh>

      <mesh position={[0, 0.92, 0]} scale={[0.42, 1.6, 0.42]}>
        <sphereGeometry args={[0.28, 18, 14]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
      </mesh>

      {branches.map((branch) => (
        <mesh key={branch.id}>
          <tubeGeometry args={[branch.curve, 18, branch.radius * (hovered || active ? 1.22 : 1), 7, false]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 0.9 : active || hovered ? 0.65 : 0.4}
            transparent
            opacity={branchOpacity}
            roughness={0.45}
          />
        </mesh>
      ))}
    </group>
  );
}

function buildBranches(seed: string): Branch[] {
  const random = seededRandom(seed);
  const branches: Branch[] = [];

  // Main apical dendrite - longer with more control points for organic curve
  const apicalWobble = () => (random() - 0.5) * 0.15;
  branches.push({
    id: 'apical',
    radius: 0.032,
    curve: new CatmullRomCurve3([
      new Vector3(0, 0.45, 0),
      new Vector3(apicalWobble(), 0.85, apicalWobble()),
      new Vector3(apicalWobble() * 1.2, 1.35, apicalWobble()),
      new Vector3(apicalWobble() * 1.5, 1.95, apicalWobble() * 1.2),
      new Vector3(apicalWobble() * 1.8, 2.65, apicalWobble() * 1.5),
      new Vector3(apicalWobble() * 2, 3.2, apicalWobble() * 1.8),
    ]),
  });

  // Basal dendrites - more branches with secondary branching
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2 + (random() - 0.5) * 0.4;
    const spread = 0.65 + random() * 0.55;
    const y = -0.25 - random() * 0.35;
    const z = (random() - 0.5) * 0.5;
    const endX = Math.cos(angle) * spread;
    const endZ = Math.sin(angle) * spread * 0.7;

    // Main basal branch
    branches.push({
      id: `basal:${index}`,
      radius: 0.016 + random() * 0.012,
      curve: new CatmullRomCurve3([
        new Vector3(0, -0.15, 0),
        new Vector3(endX * 0.3, y * 0.4, endZ * 0.3),
        new Vector3(endX * 0.6, y * 0.7, endZ * 0.6),
        new Vector3(endX, y, endZ + z),
      ]),
    });

    // Secondary branches from basal
    if (random() > 0.4) {
      const branchPoint = 0.5 + random() * 0.3;
      const branchAngle = angle + (random() - 0.5) * 1.2;
      const branchSpread = spread * (0.4 + random() * 0.3);
      branches.push({
        id: `basal-sec:${index}`,
        radius: 0.008 + random() * 0.006,
        curve: new CatmullRomCurve3([
          new Vector3(endX * branchPoint, y * branchPoint, endZ * branchPoint),
          new Vector3(
            Math.cos(branchAngle) * branchSpread,
            y * branchPoint - random() * 0.2,
            Math.sin(branchAngle) * branchSpread * 0.6
          ),
        ]),
      });
    }
  }

  // Apical oblique branches - more realistic branching from main trunk
  for (let index = 0; index < 8; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const y = 0.7 + index * 0.28 + random() * 0.15;
    const angle = side * (0.4 + random() * 0.5);
    const length = 0.4 + random() * 0.35;

    branches.push({
      id: `apical-oblique:${index}`,
      radius: 0.009 + random() * 0.007,
      curve: new CatmullRomCurve3([
        new Vector3(apicalWobble() * 0.5, y, apicalWobble() * 0.3),
        new Vector3(
          Math.sin(angle) * length * 0.5,
          y + 0.08 + random() * 0.08,
          Math.cos(angle) * length * 0.3
        ),
        new Vector3(
          Math.sin(angle) * length,
          y + 0.15 + random() * 0.12,
          Math.cos(angle) * length * 0.5
        ),
      ]),
    });
  }

  // Apical tuft at top - dense branching
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2 + random() * 0.3;
    const length = 0.25 + random() * 0.3;
    const baseY = 3.0 + random() * 0.2;

    branches.push({
      id: `tuft:${index}`,
      radius: 0.006 + random() * 0.005,
      curve: new CatmullRomCurve3([
        new Vector3(apicalWobble(), baseY, apicalWobble()),
        new Vector3(
          Math.cos(angle) * length * 0.4,
          baseY + 0.15 + random() * 0.1,
          Math.sin(angle) * length * 0.3
        ),
        new Vector3(
          Math.cos(angle) * length,
          baseY + 0.25 + random() * 0.15,
          Math.sin(angle) * length * 0.5
        ),
      ]),
    });
  }

  return branches;
}
