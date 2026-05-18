'use client';

import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import type { AtlasEdge, AtlasNode } from '../atlasTypes';

type DendriteCurveProps = {
  edge: AtlasEdge;
  source: AtlasNode;
  target: AtlasNode;
};

export function DendriteCurve({ edge, source, target }: DendriteCurveProps) {
  const curve = useMemo(() => {
    const start = new Vector3(...source.position);
    const end = new Vector3(...target.position);
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.z += 0.5 + edge.strength * 0.8;
    return new CatmullRomCurve3([start, midpoint, end]);
  }, [edge.strength, source.position, target.position]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 36, 0.012 + edge.strength * 0.018, 8, false]} />
      <meshBasicMaterial color={edge.color} transparent opacity={0.38 + edge.strength * 0.28} />
    </mesh>
  );
}
