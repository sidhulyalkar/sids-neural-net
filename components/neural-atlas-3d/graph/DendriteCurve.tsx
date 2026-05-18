'use client';

import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import type { AtlasEdge, AtlasNode } from '../atlasTypes';
import { vectorToTuple } from '../atlasTypes';

type DendriteCurveProps = {
  edge: AtlasEdge;
  source: AtlasNode;
  target: AtlasNode;
  highlighted?: boolean;
};

export function DendriteCurve({ edge, source, target, highlighted = false }: DendriteCurveProps) {
  const curve = useMemo(() => {
    const start = new Vector3(...vectorToTuple(source.position));
    const end = new Vector3(...vectorToTuple(target.position));
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.z += 0.5 + edge.strength * 0.8;
    return new CatmullRomCurve3([start, midpoint, end]);
  }, [edge.strength, source.position, target.position]);

  const branchCurves = useMemo(
    () =>
      Array.from({ length: edge.dendriteBranches }, (_, index) => {
        const t = (index + 1) / (edge.dendriteBranches + 1);
        const base = curve.getPoint(t);
        const direction = curve.getTangent(t);
        const normal = new Vector3(-direction.y, direction.x, 0.2).normalize();
        const side = index % 2 === 0 ? 1 : -1;
        return new CatmullRomCurve3([
          base,
          base.clone().add(normal.clone().multiplyScalar(0.28 * side)),
          base.clone().add(normal.clone().multiplyScalar((0.52 + edge.strength * 0.18) * side)),
        ]);
      }),
    [curve, edge.dendriteBranches, edge.strength]
  );

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, highlighted ? 0.035 : 0.014 + edge.strength * 0.018, 8, false]} />
        <meshBasicMaterial color={highlighted ? '#f8fbff' : edge.color} transparent opacity={highlighted ? 0.82 : 0.28 + edge.strength * 0.22} />
      </mesh>
      {branchCurves.map((branchCurve, index) => (
        <mesh key={index}>
          <tubeGeometry args={[branchCurve, 12, highlighted ? 0.018 : 0.01, 6, false]} />
          <meshBasicMaterial color={edge.color} transparent opacity={highlighted ? 0.55 : 0.18} />
        </mesh>
      ))}
    </group>
  );
}
