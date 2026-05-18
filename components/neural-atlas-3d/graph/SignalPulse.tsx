'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Mesh } from 'three';
import type { AtlasEdge, AtlasNode } from '../atlasTypes';
import { useAtlasStore } from '../atlasStore';
import { getCategorySignalHarmony } from '../visualConstants';
import { buildEdgeCurve } from './DendriteCurve';

type SignalPulseProps = {
  active: boolean;
  edge: AtlasEdge;
  source: AtlasNode;
  target: AtlasNode;
};

const TRAVEL_SECONDS = 1.55;
const TRAIL_OFFSETS = [0, 0.085, 0.16, 0.235];

export function SignalPulse({ active, edge, source, target }: SignalPulseProps) {
  const transitionPhase = useAtlasStore((state) => state.transitionPhase);
  const coreRefs = useRef<Array<Mesh | null>>([]);
  const glowRefs = useRef<Array<Mesh | null>>([]);
  const progressRef = useRef(0);
  const curve = useMemo(() => buildEdgeCurve(edge, source, target), [edge, source, target]);
  const harmony = getCategorySignalHarmony(target.category || source.category);

  useEffect(() => {
    progressRef.current = 0;
  }, [active, edge.id]);

  useFrame((_, delta) => {
    if (!active) return;

    if (transitionPhase === 'traveling') {
      progressRef.current = Math.min(1, progressRef.current + delta / TRAVEL_SECONDS);
    } else if (transitionPhase === 'arriving') {
      progressRef.current = Math.min(1, progressRef.current + delta / 0.22);
    } else if (transitionPhase === 'charging') {
      progressRef.current = Math.min(progressRef.current, 0.03);
    }

    const leadingProgress = transitionPhase === 'charging' ? 0 : progressRef.current;

    TRAIL_OFFSETS.forEach((offset, index) => {
      const core = coreRefs.current[index];
      const glow = glowRefs.current[index];
      if (!core || !glow) return;

      const pointProgress = Math.max(0, Math.min(1, leadingProgress - offset));
      const visible = transitionPhase === 'charging' ? index === 0 : leadingProgress >= offset * 0.7;
      const point = curve.getPoint(pointProgress);
      const pulseScale = index === 0 ? 1 : Math.max(0.22, 1 - index * 0.2);

      core.visible = visible;
      glow.visible = visible;
      core.position.copy(point);
      glow.position.copy(point);
      core.scale.setScalar((0.1 + edge.strength * 0.045) * pulseScale);
      glow.scale.setScalar((0.34 + edge.strength * 0.11) * pulseScale);
    });
  });

  if (!active) return null;

  return (
    <group>
      {TRAIL_OFFSETS.map((_, index) => (
        <group key={index}>
          <mesh ref={(mesh) => { coreRefs.current[index] = mesh; }}>
            <sphereGeometry args={[1, 18, 14]} />
            <meshBasicMaterial
              color={index === 0 ? harmony.core : harmony.primary}
              transparent
              opacity={index === 0 ? 0.96 : 0.58}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={(mesh) => { glowRefs.current[index] = mesh; }}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshBasicMaterial
              color={index % 2 === 0 ? harmony.primary : harmony.secondary}
              transparent
              opacity={index === 0 ? 0.34 : 0.16}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
