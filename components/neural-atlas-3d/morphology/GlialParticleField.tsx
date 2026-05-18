'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import { seededRandom } from './SomaMesh';
import { ATLAS_COLORS } from '../visualConstants';

type Particle = {
  position: [number, number, number];
  scale: number;
  color: string;
};

const dummy = new Object3D();
const matrix = new Matrix4();

export function GlialParticleField() {
  const meshRef = useRef<InstancedMesh>(null);
  const particles = useMemo(() => buildParticles(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    particles.forEach((particle, index) => {
      dummy.position.set(...particle.position);
      dummy.scale.setScalar(particle.scale);
      dummy.rotation.set(particle.position[1] * 0.03, particle.position[0] * 0.02, particle.position[2] * 0.04);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new Color(particle.color));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.045) * 0.025;
    meshRef.current.rotation.x = Math.cos(clock.elapsedTime * 0.035) * 0.014;
    meshRef.current.position.z = Math.sin(clock.elapsedTime * 0.12) * 0.08;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particles.length]}>
      <sphereGeometry args={[0.055, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.38} vertexColors depthWrite={false} />
    </instancedMesh>
  );
}

function buildParticles(): Particle[] {
  const random = seededRandom('glial-field');
  const colors = [ATLAS_COLORS.cyan, ATLAS_COLORS.violet, ATLAS_COLORS.blue, '#f8fbff'];

  return Array.from({ length: 150 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const radius = 2.5 + random() * 9.5;
    const depth = (random() - 0.5) * 7.5;

    return {
      position: [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.72,
        depth,
      ],
      scale: 0.36 + random() * 0.9,
      color: colors[index % colors.length],
    };
  });
}
