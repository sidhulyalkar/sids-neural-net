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
  const branches = useMemo(() => buildInterneuronTree(seed), [seed]);
  const stateBoost = selected ? 1.08 : active ? 1.04 : 1;
  const baseOpacity = selected ? 0.82 : active ? 0.68 : hovered ? 0.58 : 0.45;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      {/* Compact elongated soma typical of interneurons */}
      <group scale={[1.1, 0.8, 0.9]}>
        <SomaMesh
          color={color}
          scale={0.52}
          active={active}
          hovered={hovered}
          selected={selected}
          seed={`${seed}:soma`}
        />
      </group>

      {/* Dense local branching typical of interneurons */}
      {branches.map((branch) => {
        const opacity = baseOpacity * (1 - branch.depth * 0.08);
        const emissiveBoost = selected ? 0.34 : active || hovered ? 0.22 : 0.1;

        return (
          <mesh key={branch.id}>
            <tubeGeometry
              args={[branch.curve, Math.max(5, 12 - branch.depth * 2), branch.radius, 4, false]}
            />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveBoost * (1 - branch.depth * 0.06)}
              transparent
              opacity={opacity}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function buildInterneuronTree(seed: string): DendriteBranch[] {
  const random = seededRandom(seed);
  const branches: DendriteBranch[] = [];

  // Recursive branch builder with more local, dense branching
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

    const wobble = () => (random() - 0.5) * 0.1 * length;
    const segments = Math.max(2, 3 - Math.floor(depth / 2));
    const points: Vector3[] = [start.clone()];

    // Build curved path
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

    // Interneurons branch more frequently but with shorter segments
    if (depth < maxDepth) {
      const childCount = Math.floor(random() * 2) + 2;
      for (let i = 0; i < childCount; i++) {
        if (random() > 0.55 + depth * 0.08) continue;

        const branchAngle = (random() - 0.5) * Math.PI * 1.0;
        const elevationAngle = (random() - 0.5) * Math.PI * 0.7;
        const childDir = new Vector3(
          direction.x + Math.sin(branchAngle) * 0.75,
          direction.y + Math.sin(elevationAngle) * 0.6,
          direction.z + Math.cos(branchAngle) * 0.75
        ).normalize();

        addBranch(
          `${id}:${i}`,
          endPoint.clone(),
          childDir,
          length * (0.45 + random() * 0.25),
          radius * (0.55 + random() * 0.2),
          depth + 1,
          maxDepth
        );
      }
    }
  };

  // Interneurons have dense local arbors - more compact than pyramidal
  // Primary dendrites radiate outward in a disk-like pattern
  const primaryCount = 10;

  for (let i = 0; i < primaryCount; i++) {
    const angle = (i / primaryCount) * Math.PI * 2 + (random() - 0.5) * 0.35;
    // Keep dendrites mostly in horizontal plane with some vertical spread
    const elevation = (random() - 0.5) * 0.4;

    const dir = new Vector3(
      Math.cos(angle),
      elevation,
      Math.sin(angle) * 0.85
    ).normalize();

    const startPos = dir.clone().multiplyScalar(0.12);
    const length = 0.35 + random() * 0.3;
    const radius = 0.011 + random() * 0.007;

    addBranch(
      `interneuron:${i}`,
      startPos,
      dir,
      length,
      radius,
      0,
      4
    );
  }

  // Add vertical processes (some interneurons have bipolar-like morphology)
  for (let i = 0; i < 4; i++) {
    const upward = i < 2;
    const angle = (i % 2) * Math.PI + random() * 0.5;

    const dir = new Vector3(
      (random() - 0.5) * 0.3,
      upward ? 0.8 : -0.8,
      (random() - 0.5) * 0.3
    ).normalize();

    const startPos = new Vector3(
      (random() - 0.5) * 0.08,
      upward ? 0.1 : -0.1,
      (random() - 0.5) * 0.08
    );

    addBranch(
      `interneuron-vert:${i}`,
      startPos,
      dir,
      0.3 + random() * 0.25,
      0.009 + random() * 0.005,
      0,
      3
    );
  }

  // Fine axonal arbor - interneurons have extensive local axons
  const axonCount = 6;
  for (let i = 0; i < axonCount; i++) {
    const angle = (i / axonCount) * Math.PI * 2 + random() * 0.4;
    const elevation = (random() - 0.5) * 0.6;

    const dir = new Vector3(
      Math.cos(angle) * 0.9,
      elevation,
      Math.sin(angle) * 0.8
    ).normalize();

    const startPos = new Vector3(
      Math.cos(angle) * 0.08,
      -0.05,
      Math.sin(angle) * 0.06
    );

    addBranch(
      `interneuron-axon:${i}`,
      startPos,
      dir,
      0.5 + random() * 0.4,
      0.006 + random() * 0.004,
      1,
      5
    );
  }

  return branches;
}
