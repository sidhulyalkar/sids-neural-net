'use client';

import { useMemo } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Vector3 } from 'three';
import { SomaMesh, seededRandom } from './SomaMesh';
import type { NeuronMorphologyProps } from './SomaMesh';

type DendriteBranch = {
  id: string;
  curve: CatmullRomCurve3;
  radius: number;
  depth: number;
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
  const branches = useMemo(() => buildDendriticTree(seed), [seed]);
  const stateBoost = selected ? 1.12 : active ? 1.06 : 1;
  const baseOpacity = selected ? 0.88 : active ? 0.72 : hovered ? 0.65 : 0.5;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      {/* Organic soma */}
      <group scale={[0.85, 1.0, 0.85]}>
        <SomaMesh
          color={color}
          scale={0.75}
          active={active}
          hovered={hovered}
          selected={selected}
          seed={`${seed}:soma`}
        />
      </group>

      {/* Apical glow cone */}
      <mesh position={[0, 0.6, 0]} scale={[0.25, 0.8, 0.25]}>
        <coneGeometry args={[0.5, 1.2, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* All dendritic branches */}
      {branches.map((branch) => {
        const opacity = baseOpacity * (1 - branch.depth * 0.12);
        const emissiveBoost = selected ? 0.38 : active || hovered ? 0.26 : 0.14;

        return (
          <mesh key={branch.id}>
            <tubeGeometry
              args={[branch.curve, Math.max(8, 16 - branch.depth * 2), branch.radius, 5, false]}
            />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveBoost * (1 - branch.depth * 0.1)}
              transparent
              opacity={opacity}
              roughness={0.85}
              metalness={0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function buildDendriticTree(seed: string): DendriteBranch[] {
  const random = seededRandom(seed);
  const branches: DendriteBranch[] = [];

  // Helper to add a branch with potential children
  const addBranch = (
    id: string,
    start: Vector3,
    direction: Vector3,
    length: number,
    radius: number,
    depth: number,
    maxDepth: number
  ) => {
    if (depth > maxDepth || radius < 0.003) return;

    const wobble = () => (random() - 0.5) * 0.15 * length;
    const segments = Math.max(2, 4 - depth);
    const points: Vector3[] = [start.clone()];

    // Build curved path with organic wobble
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const pos = start.clone().add(direction.clone().multiplyScalar(length * t));
      pos.x += wobble();
      pos.y += wobble() * 0.5;
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

    // Spawn child branches with decreasing probability
    if (depth < maxDepth) {
      const childCount = Math.floor(random() * 3) + (depth < 2 ? 2 : 1);
      for (let i = 0; i < childCount; i++) {
        if (random() > 0.3 + depth * 0.15) continue;

        const branchAngle = (random() - 0.5) * Math.PI * 0.8;
        const elevationAngle = (random() - 0.5) * Math.PI * 0.5;
        const childDir = new Vector3(
          direction.x + Math.sin(branchAngle) * 0.7,
          direction.y + Math.sin(elevationAngle) * 0.4,
          direction.z + Math.cos(branchAngle) * 0.7
        ).normalize();

        addBranch(
          `${id}:${i}`,
          endPoint.clone().add(direction.clone().multiplyScalar(-length * 0.15 * random())),
          childDir,
          length * (0.5 + random() * 0.3),
          radius * (0.55 + random() * 0.2),
          depth + 1,
          maxDepth
        );
      }
    }
  };

  // Main apical dendrite - extends upward with extensive branching
  const apicalBase = new Vector3(0, 0.35, 0);
  const apicalDir = new Vector3(0, 1, 0);

  // Build main apical trunk
  const apicalLength = 2.2 + random() * 0.6;
  const apicalPoints: Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const wobble = (random() - 0.5) * 0.12;
    apicalPoints.push(new Vector3(
      wobble * t,
      0.35 + apicalLength * t,
      wobble * t * 0.8
    ));
  }

  branches.push({
    id: 'apical-main',
    curve: new CatmullRomCurve3(apicalPoints),
    radius: 0.028,
    depth: 0,
  });

  // Apical oblique branches - emerge from main trunk
  for (let i = 0; i < 10; i++) {
    const t = 0.2 + (i / 10) * 0.65;
    const trunkPoint = new Vector3(
      apicalPoints[Math.floor(t * 6)].x,
      0.35 + apicalLength * t,
      apicalPoints[Math.floor(t * 6)].z
    );
    const side = i % 2 === 0 ? 1 : -1;
    const angle = side * (0.5 + random() * 0.6);
    const dir = new Vector3(
      Math.sin(angle),
      0.3 + random() * 0.3,
      Math.cos(angle) * side * 0.6
    ).normalize();

    addBranch(
      `apical-oblique:${i}`,
      trunkPoint,
      dir,
      0.4 + random() * 0.35,
      0.012 + random() * 0.006,
      1,
      3
    );
  }

  // Apical tuft - dense branching at top
  const tuftBase = new Vector3(apicalPoints[6].x, apicalPoints[6].y, apicalPoints[6].z);
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + random() * 0.4;
    const elevation = random() * 0.6;
    const dir = new Vector3(
      Math.cos(angle) * (0.6 + random() * 0.4),
      0.4 + elevation,
      Math.sin(angle) * (0.5 + random() * 0.4)
    ).normalize();

    addBranch(
      `tuft:${i}`,
      tuftBase.clone().add(new Vector3((random() - 0.5) * 0.1, 0, (random() - 0.5) * 0.1)),
      dir,
      0.25 + random() * 0.25,
      0.008 + random() * 0.005,
      1,
      3
    );
  }

  // Basal dendrites - extend downward and outward
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + (random() - 0.5) * 0.4;
    const startPos = new Vector3(
      Math.cos(angle) * 0.12,
      -0.1,
      Math.sin(angle) * 0.1
    );
    const dir = new Vector3(
      Math.cos(angle),
      -0.35 - random() * 0.25,
      Math.sin(angle) * 0.85
    ).normalize();

    addBranch(
      `basal:${i}`,
      startPos,
      dir,
      0.55 + random() * 0.4,
      0.018 + random() * 0.008,
      0,
      4
    );
  }

  // Axon - single long process extending downward
  const axonPoints: Vector3[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const wobble = (random() - 0.5) * 0.08;
    axonPoints.push(new Vector3(
      wobble + t * (random() - 0.5) * 0.3,
      -0.25 - t * 1.8,
      wobble * 0.5 + t * (random() - 0.5) * 0.4
    ));
  }

  branches.push({
    id: 'axon',
    curve: new CatmullRomCurve3(axonPoints),
    radius: 0.015,
    depth: 0,
  });

  return branches;
}
