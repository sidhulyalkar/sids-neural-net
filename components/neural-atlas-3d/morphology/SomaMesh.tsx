'use client';

import { useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, IcosahedronGeometry, Vector3 } from 'three';
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

export function SomaMesh({
  color,
  scale = 1,
  active = false,
  hovered = false,
  selected = false,
  seed = 'soma',
  onClick,
}: Omit<NeuronMorphologyProps, 'position'>) {
  const stateBoost = selected ? 1.18 : active ? 1.1 : 1;
  const emissiveIntensity = selected ? 0.65 : active ? 0.45 : hovered ? 0.38 : 0.22;

  const geometry = useMemo(() => {
    const geo = new IcosahedronGeometry(0.5, 3);
    const positionAttr = geo.attributes.position;
    const random = seededRandom(seed);

    // Displace vertices to create organic irregular shape
    for (let i = 0; i < positionAttr.count; i++) {
      const vertex = new Vector3(
        positionAttr.getX(i),
        positionAttr.getY(i),
        positionAttr.getZ(i)
      );

      // Normalize to get direction, then apply irregular displacement
      const dir = vertex.clone().normalize();
      const noise = 0.85 + random() * 0.35;
      const asymmetry = 1 + (dir.y > 0 ? 0.12 : -0.08) + (random() - 0.5) * 0.15;

      vertex.multiplyScalar(noise * asymmetry);

      positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geo.computeVertexNormals();
    return geo;
  }, [seed]);

  return (
    <group scale={scale * stateBoost} onClick={onClick}>
      {/* Inner glow */}
      <mesh scale={0.7}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial
          color="#fffaf0"
          transparent
          opacity={selected ? 0.4 : active ? 0.3 : 0.2}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main organic soma body */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>

      {/* Outer glow halo */}
      <mesh scale={1.3}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial
          color={color}
          side={BackSide}
          transparent
          opacity={selected ? 0.12 : active || hovered ? 0.08 : 0.04}
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
