'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { ATLAS_COLORS } from '../visualConstants';

export function GlialParticleField() {
  const groupRef = useRef<Group>(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 80 }, (_, index) => {
        const angle = index * 1.618;
        const radius = 4 + (index % 17) * 0.55;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, ((index % 11) - 5) * 0.42] as const;
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.08) * 0.018;
    groupRef.current.rotation.x = Math.cos(clock.elapsedTime * 0.06) * 0.012;
  });

  return (
    <group ref={groupRef}>
      {particles.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.025 + (index % 3) * 0.01, 8, 8]} />
          <meshBasicMaterial color={index % 2 === 0 ? ATLAS_COLORS.cyan : ATLAS_COLORS.violet} transparent opacity={0.42} />
        </mesh>
      ))}
    </group>
  );
}
