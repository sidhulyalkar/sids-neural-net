'use client';

import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { SomaMesh, seededRandom } from './SomaMesh';
import type { NeuronMorphologyProps } from './SomaMesh';

type DendriteBranch = {
  id: string;
  curve: CatmullRomCurve3;
  radius: number;
  depth: number;
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
  const branches = useMemo(() => buildStellateTree(seed), [seed]);
  const stateBoost = selected ? 1.1 : active ? 1.05 : 1;
  const baseOpacity = selected ? 0.85 : active ? 0.7 : hovered ? 0.62 : 0.48;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      {/* Organic soma - slightly smaller for stellate cells */}
      <SomaMesh
        color={color}
        scale={0.6}
        active={active}
        hovered={hovered}
        selected={selected}
        seed={`${seed}:soma`}
      />

      {/* Radiating dendritic branches */}
      {branches.map((branch) => {
        const opacity = baseOpacity * (1 - branch.depth * 0.1);
        const emissiveBoost = selected ? 0.36 : active || hovered ? 0.24 : 0.12;

        return (
          <mesh key={branch.id}>
            <tubeGeometry
              args={[branch.curve, Math.max(6, 14 - branch.depth * 2), branch.radius, 5, false]}
            />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveBoost * (1 - branch.depth * 0.08)}
              transparent
              opacity={opacity}
              roughness={0.88}
              metalness={0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function buildStellateTree(seed: string): DendriteBranch[] {
  const random = seededRandom(seed);
  const branches: DendriteBranch[] = [];

  // Recursive branch builder
  const addBranch = (
    id: string,
    start: Vector3,
    direction: Vector3,
    length: number,
    radius: number,
    depth: number,
    maxDepth: number
  ) => {
    if (depth > maxDepth || radius < 0.002) return;

    const wobble = () => (random() - 0.5) * 0.12 * length;
    const segments = Math.max(2, 4 - depth);
    const points: Vector3[] = [start.clone()];

    // Build organic curved path
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const pos = start.clone().add(direction.clone().multiplyScalar(length * t));
      pos.x += wobble();
      pos.y += wobble();
      pos.z += wobble();
      points.push(pos);
    }

    const endPoint = points[points.length - 1];
    branches.push({
      id,
      curve: new CatmullRomCurve3(points),
      radius,
      depth,
    });

    // Spawn child branches
    if (depth < maxDepth) {
      const childCount = Math.floor(random() * 3) + 1;
      for (let i = 0; i < childCount; i++) {
        if (random() > 0.45 + depth * 0.12) continue;

        const branchAngle = (random() - 0.5) * Math.PI * 0.9;
        const elevationAngle = (random() - 0.5) * Math.PI * 0.6;
        const childDir = new Vector3(
          direction.x + Math.sin(branchAngle) * 0.65,
          direction.y + Math.sin(elevationAngle) * 0.5,
          direction.z + Math.cos(branchAngle) * 0.65
        ).normalize();

        addBranch(
          `${id}:${i}`,
          endPoint.clone().add(direction.clone().multiplyScalar(-length * 0.1 * random())),
          childDir,
          length * (0.55 + random() * 0.25),
          radius * (0.5 + random() * 0.25),
          depth + 1,
          maxDepth
        );
      }
    }
  };

  // Stellate neurons have dendrites radiating in all directions (star-like pattern)
  const primaryCount = 12;

  for (let i = 0; i < primaryCount; i++) {
    // Distribute in 3D sphere pattern using Fibonacci sphere
    const phi = Math.acos(1 - 2 * (i + 0.5) / primaryCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    // Add randomness to the distribution
    const phiJitter = phi + (random() - 0.5) * 0.3;
    const thetaJitter = theta + (random() - 0.5) * 0.4;

    const dir = new Vector3(
      Math.sin(phiJitter) * Math.cos(thetaJitter),
      Math.cos(phiJitter),
      Math.sin(phiJitter) * Math.sin(thetaJitter)
    ).normalize();

    const startPos = dir.clone().multiplyScalar(0.15);
    const length = 0.65 + random() * 0.45;
    const radius = 0.014 + random() * 0.008;

    addBranch(
      `stellate:${i}`,
      startPos,
      dir,
      length,
      radius,
      0,
      4
    );
  }

  // Additional finer processes in between
  for (let i = 0; i < 8; i++) {
    const angle = random() * Math.PI * 2;
    const elevation = (random() - 0.5) * Math.PI * 0.8;

    const dir = new Vector3(
      Math.cos(angle) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(angle) * Math.cos(elevation)
    ).normalize();

    const startPos = dir.clone().multiplyScalar(0.12);

    addBranch(
      `stellate-fine:${i}`,
      startPos,
      dir,
      0.4 + random() * 0.3,
      0.008 + random() * 0.005,
      1,
      3
    );
  }

  return branches;
}
