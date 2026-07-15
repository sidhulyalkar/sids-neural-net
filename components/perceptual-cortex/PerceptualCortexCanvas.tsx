'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { usePerceptualStore, worldSnapshot } from './perceptualStore';

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}

function Organism({ seed }: { seed: number }) {
  const root = useRef<THREE.Group>(null);
  const soma = useRef<THREE.Mesh>(null);
  const pulses = useRef<THREE.Points>(null);
  const phase = usePerceptualStore((s) => s.phase);
  const reducedMotion = usePerceptualStore((s) => s.reducedMotion);
  const branches = useMemo(() => {
    const random = seeded(seed);
    return Array.from({ length: 42 }, (_, index) => {
      const side = index % 2 ? 1 : -1;
      const layer = Math.floor(index / 2);
      const angle = (random() - 0.5) * 2.8 + side * 0.65;
      const length = 1.5 + random() * 2.7 + layer * 0.035;
      const startRadius = index < 10 ? 0.15 : 0.45 + random() * 0.9;
      const start = new THREE.Vector3(Math.cos(angle) * startRadius, Math.sin(angle) * startRadius * 0.7, (random() - .5) * .4);
      const mid = start.clone().add(new THREE.Vector3(side * length * .48, Math.sin(angle + random()) * length * .42, (random() - .5) * .8));
      const end = mid.clone().add(new THREE.Vector3(side * length * .5, (random() - .5) * length, (random() - .5) * .9));
      return [start, mid, end];
    });
  }, [seed]);
  const pulsePositions = useMemo(() => new Float32Array(72 * 3), []);

  useFrame(({ clock }, delta) => {
    const world = worldSnapshot();
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.rotation.z = reducedMotion ? 0 : world.pointerX * 0.025;
      root.current.rotation.x = reducedMotion ? 0 : -world.pointerY * 0.018;
      const audioWave = Math.sin(t * (1.15 + world.oscillationFrequency * 2.5)) * world.oscillationAmplitude * .055;
      const scale = phase === 'crystallized' ? 0.96 : 1 + Math.sin(t * 1.15) * (0.012 + world.excitation * .018) + audioWave;
      root.current.scale.lerp(new THREE.Vector3(scale, scale, scale), Math.min(1, delta * 4));
    }
    if (soma.current) {
      const material = soma.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.55 + world.excitation * 2.2 + world.lowBand * 1.2 + world.onsetImpulse;
      soma.current.rotation.y += delta * (reducedMotion ? .03 : .12 + world.coherence * .15);
    }
    if (pulses.current) {
      const array = pulses.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < 72; i++) {
        const branch = branches[i % branches.length];
        const p = (t * world.propagationVelocity * .16 + i * .127) % 1;
        const a = p < .5 ? branch[0] : branch[1];
        const b = p < .5 ? branch[1] : branch[2];
        const q = p < .5 ? p * 2 : (p - .5) * 2;
        array[i * 3] = THREE.MathUtils.lerp(a.x, b.x, q);
        array[i * 3 + 1] = THREE.MathUtils.lerp(a.y, b.y, q);
        array[i * 3 + 2] = THREE.MathUtils.lerp(a.z, b.z, q);
      }
      pulses.current.geometry.attributes.position.needsUpdate = true;
      const pulseMaterial = pulses.current.material as THREE.PointsMaterial;
      pulseMaterial.opacity = .22 + world.excitation * .62 + world.highBand * .35;
      pulseMaterial.size = .055 + world.highBand * .045 + world.onsetImpulse * .025;
    }
  });

  return <group ref={root}>
    <mesh ref={soma}>
      <icosahedronGeometry args={[0.58, 5]} />
      <meshStandardMaterial color="#562f78" emissive="#ff5fa2" roughness={0.72} metalness={0.02} transparent opacity={0.76} />
    </mesh>
    {branches.map((points, index) => <Line key={index} points={points} color={index % 5 ? '#86d8e8' : '#c291ff'} lineWidth={index < 12 ? 1.4 : .65} transparent opacity={index < 12 ? .7 : .35} />)}
    <points ref={pulses}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} /></bufferGeometry>
      <pointsMaterial color="#fff1ce" size={0.055} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  </group>;
}

function CaptureBridge({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) {
  const gl = useThree((s) => s.gl);
  useFrame(() => onReady(gl.domElement));
  return null;
}

export function PerceptualCortexCanvas({ seed, onCanvas }: { seed: number; onCanvas: (canvas: HTMLCanvasElement) => void }) {
  return <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 8.5], fov: 52 }} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
    <color attach="background" args={['#020306']} />
    <fog attach="fog" args={['#020306', 7, 14]} />
    <ambientLight intensity={0.32} />
    <pointLight position={[2, 3, 4]} color="#8cecff" intensity={7} />
    <pointLight position={[-3, -2, 2]} color="#b671ff" intensity={5} />
    <Organism seed={seed} />
    <CaptureBridge onReady={onCanvas} />
  </Canvas>;
}
