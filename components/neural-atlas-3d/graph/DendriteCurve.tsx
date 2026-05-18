'use client';

import { useMemo } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Vector3 } from 'three';
import type { AtlasEdge, AtlasNode } from '../atlasTypes';
import { vectorToTuple } from '../atlasTypes';
import { getCategorySignalHarmony, seededUnit } from '../visualConstants';

type DendriteCurveProps = {
  edge: AtlasEdge;
  source: AtlasNode;
  target: AtlasNode;
  highlighted?: boolean;
  signaling?: boolean;
};

export function DendriteCurve({ edge, source, target, highlighted = false, signaling = false }: DendriteCurveProps) {
  const curve = useMemo(() => buildEdgeCurve(edge, source, target), [edge, source, target]);
  const harmony = getCategorySignalHarmony(target.category || source.category);
  const bright = highlighted || signaling;
  const baseRadius = signaling ? 0.04 : highlighted ? 0.028 : 0.011 + edge.strength * 0.014;
  const baseOpacity = signaling ? 0.78 : highlighted ? 0.48 : 0.11 + edge.strength * 0.16;

  const branchCurves = useMemo(
    () => {
      const random = seededUnit(`${edge.id}:branches`);

      return Array.from({ length: edge.dendriteBranches }, (_, index) => {
        const t = (index + 1) / (edge.dendriteBranches + 1) + (random() - 0.5) * 0.08;
        const base = curve.getPoint(t);
        const direction = curve.getTangent(t);
        const normal = new Vector3(-direction.y, direction.x, 0.18 + random() * 0.32).normalize();
        const side = index % 2 === 0 ? 1 : -1;
        const reach = 0.36 + random() * 0.38 + edge.strength * 0.16;
        const kink = base.clone().add(normal.clone().multiplyScalar(reach * 0.45 * side));

        return new CatmullRomCurve3([
          base,
          kink.add(new Vector3((random() - 0.5) * 0.16, (random() - 0.5) * 0.16, (random() - 0.5) * 0.24)),
          base.clone().add(normal.clone().multiplyScalar(reach * side)),
        ]);
      });
    },
    [curve, edge.dendriteBranches, edge.id, edge.strength]
  );

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, baseRadius, 8, false]} />
        <meshBasicMaterial
          color={bright ? harmony.primary : edge.color}
          transparent
          opacity={baseOpacity}
          blending={bright ? AdditiveBlending : undefined}
          depthWrite={false}
        />
      </mesh>
      {bright && (
        <mesh>
          <tubeGeometry args={[curve, 64, baseRadius * 2.4, 8, false]} />
          <meshBasicMaterial
            color={signaling ? harmony.secondary : edge.color}
            transparent
            opacity={signaling ? 0.2 : 0.1}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      {branchCurves.map((branchCurve, index) => (
        <group key={index}>
          <mesh>
            <tubeGeometry args={[branchCurve, 14, signaling ? 0.018 : highlighted ? 0.013 : 0.007, 6, false]} />
            <meshBasicMaterial
              color={bright ? harmony.secondary : edge.color}
              transparent
              opacity={signaling ? 0.46 : highlighted ? 0.28 : 0.08}
              blending={bright ? AdditiveBlending : undefined}
              depthWrite={false}
            />
          </mesh>
          <mesh position={branchCurve.getPoint(1)} scale={signaling ? 0.052 : highlighted ? 0.038 : 0.026}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial
              color={bright ? harmony.core : edge.color}
              transparent
              opacity={signaling ? 0.62 : highlighted ? 0.36 : 0.13}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
      <mesh position={curve.getPoint(1)} scale={signaling ? 0.09 : highlighted ? 0.065 : 0.038}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial
          color={bright ? harmony.core : edge.color}
          transparent
          opacity={signaling ? 0.72 : highlighted ? 0.42 : 0.16}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function buildEdgeCurve(edge: AtlasEdge, source: AtlasNode, target: AtlasNode) {
  const random = seededUnit(`${edge.id}:curve`);
  const start = new Vector3(...vectorToTuple(source.position));
  const end = new Vector3(...vectorToTuple(target.position));
  const distance = start.distanceTo(end);
  const direction = end.clone().sub(start).normalize();
  const normal = new Vector3(-direction.y, direction.x, 0.24 + random() * 0.42).normalize();
  const lift = 0.34 + edge.strength * 0.72 + random() * 0.42;
  const bend = Math.min(1.8, distance * (0.08 + random() * 0.07));

  const first = start
    .clone()
    .lerp(end, 0.32)
    .add(normal.clone().multiplyScalar(bend))
    .add(new Vector3(0, 0, lift));
  const second = start
    .clone()
    .lerp(end, 0.68)
    .add(normal.clone().multiplyScalar(-bend * 0.72))
    .add(new Vector3(0, 0, lift * 0.58 + (random() - 0.5) * 0.42));

  return new CatmullRomCurve3([start, first, second, end]);
}
