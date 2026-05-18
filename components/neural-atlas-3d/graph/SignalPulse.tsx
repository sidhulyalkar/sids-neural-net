'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Mesh, Vector3 } from 'three';
import type { AtlasEdge, AtlasNode } from '../atlasTypes';
import { vectorToTuple } from '../atlasTypes';

type SignalPulseProps = {
  active: boolean;
  edge: AtlasEdge;
  source: AtlasNode;
  target: AtlasNode;
};

export function SignalPulse({ active, edge, source, target }: SignalPulseProps) {
  const meshRef = useRef<Mesh>(null);
  const curve = useMemo(() => {
    const start = new Vector3(...vectorToTuple(source.position));
    const end = new Vector3(...vectorToTuple(target.position));
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.z += 0.8;
    return new CatmullRomCurve3([start, midpoint, end]);
  }, [source.position, target.position]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !active) return;
    const point = curve.getPoint((clock.elapsedTime * 0.55) % 1);
    meshRef.current.position.copy(point);
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.08 + edge.strength * 0.04, 16, 16]} />
      <meshBasicMaterial color="#f8fbff" />
    </mesh>
  );
}
