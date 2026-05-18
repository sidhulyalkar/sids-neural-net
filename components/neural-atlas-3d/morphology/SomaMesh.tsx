'use client';

import { useMemo } from 'react';
import { AdditiveBlending, BackSide } from 'three';
import type { AtlasVec3 } from '../atlasTypes';

export type NeuronMorphologyProps = {
  position?: AtlasVec3;
  color: string;
  scale?: number;
  active?: boolean;
  hovered?: boolean;
  selected?: boolean;
  seed?: string;
  onClick?: () => void;
};

type SomaLobe = {
  position: AtlasVec3;
  rotation: AtlasVec3;
  scale: AtlasVec3;
  radius: number;
};

export function SomaMesh({
  position = [0, 0, 0],
  color,
  scale = 1,
  active = false,
  hovered = false,
  selected = false,
  seed = 'soma',
  onClick,
}: NeuronMorphologyProps) {
  const stateBoost = selected ? 1.24 : active ? 1.15 : hovered ? 1.08 : 1;
  const lobes = useMemo(() => buildLobes(seed), [seed]);
  const emissiveIntensity = selected ? 0.82 : active ? 0.62 : hovered ? 0.52 : 0.34;

  return (
    <group position={position} scale={scale * stateBoost} onClick={onClick}>
      <mesh scale={selected || active ? 1.35 : 1.18}>
        <sphereGeometry args={[0.78, 32, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.16 : hovered ? 0.1 : 0.075}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {lobes.map((lobe, index) => (
        <mesh key={index} position={lobe.position} rotation={lobe.rotation} scale={lobe.scale}>
          <icosahedronGeometry args={[lobe.radius, 3]} />
          <meshStandardMaterial
            color={index === 0 ? '#f8fbff' : color}
            emissive={color}
            emissiveIntensity={index === 0 ? emissiveIntensity * 0.8 : emissiveIntensity}
            roughness={0.66}
            metalness={0.04}
          />
        </mesh>
      ))}

      <mesh scale={[1.08, 0.98, 1.1]}>
        <sphereGeometry args={[0.72, 32, 18]} />
        <meshBasicMaterial color="#f8fbff" transparent opacity={0.055} blending={AdditiveBlending} depthWrite={false} />
      </mesh>

      <mesh scale={1.12}>
        <sphereGeometry args={[0.82, 32, 20]} />
        <meshBasicMaterial
          color={color}
          side={BackSide}
          transparent
          opacity={selected ? 0.22 : active || hovered ? 0.16 : 0.09}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function seededRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLobes(seed: string): SomaLobe[] {
  const random = seededRandom(seed);

  return Array.from({ length: 7 }, (_, index) => {
    const isCore = index === 0;
    const angle = random() * Math.PI * 2;
    const radius = isCore ? 0 : 0.18 + random() * 0.14;

    return {
      position: [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.78,
        (random() - 0.5) * 0.18,
      ],
      rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
      scale: [
        isCore ? 1.08 : 0.62 + random() * 0.28,
        isCore ? 0.92 : 0.52 + random() * 0.24,
        isCore ? 0.96 : 0.58 + random() * 0.26,
      ],
      radius: isCore ? 0.54 : 0.34 + random() * 0.11,
    };
  });
}
