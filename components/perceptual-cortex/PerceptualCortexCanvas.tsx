'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { usePerceptualStore, worldSnapshot } from './perceptualStore';
import { qualityConfig, type QualityTier } from './quality';
import { visualThemes, type VisualThemeId } from './visualThemes';

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}

function Organism({ seed, pulseCount, themeId }: { seed: number; pulseCount: number; themeId: VisualThemeId }) {
  const theme = visualThemes[themeId];
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
  const pulsePositions = useMemo(() => new Float32Array(pulseCount * 3), [pulseCount]);

  useFrame(({ clock }, delta) => {
    const world = worldSnapshot();
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.rotation.z = reducedMotion ? 0 : world.pointerX * 0.025;
      root.current.rotation.x = reducedMotion ? 0 : -world.pointerY * 0.018;
      const audioWave = Math.sin(t * (1.15 + world.oscillationFrequency * 2.5)) * world.oscillationAmplitude * .055;
      const scale = phase === 'crystallized' ? 0.96 : 1 + Math.sin(t * 1.15) * (0.012 + world.excitation * .018) + audioWave;
      const spatialScale = scale * (1 + world.handSeparation * .12);
      root.current.scale.lerp(new THREE.Vector3(spatialScale, spatialScale, spatialScale), Math.min(1, delta * 4));
      root.current.position.x = THREE.MathUtils.lerp(root.current.position.x, world.handX * world.handSpeed * .18, Math.min(1, delta * 5));
      root.current.position.y = THREE.MathUtils.lerp(root.current.position.y, world.handY * world.handSpeed * .18, Math.min(1, delta * 5));
    }
    if (soma.current) {
      const material = soma.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.55 + world.excitation * 2.2 + world.lowBand * 1.2 + world.onsetImpulse;
      soma.current.rotation.y += delta * (reducedMotion ? .03 : .12 + world.coherence * .15);
    }
    if (pulses.current) {
      const array = pulses.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pulseCount; i++) {
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
      const dominant = world.bilateralStrength > .4 ? 'hand' : world.facialActivity > .35 ? 'face' : world.lowBand + world.midBand + world.highBand > .35 ? 'audio' : world.pointerSpeed > .18 ? 'pointer' : world.growthImpulse > .25 ? 'keyboard' : 'synthetic';
      pulseMaterial.color.set(theme.sources[dominant]);
    }
  });

  return <group ref={root}>
    <mesh ref={soma}>
      <icosahedronGeometry args={[0.58, 5]} />
      <meshStandardMaterial color={theme.soma} emissive={theme.membrane} roughness={0.72} metalness={0.02} transparent opacity={0.76} />
    </mesh>
    {branches.map((points, index) => <Line key={index} points={points} color={index % 5 ? theme.branchPrimary : theme.branchSecondary} lineWidth={index < 12 ? 1.4 : .65} transparent opacity={index < 12 ? .7 : .35} />)}
    <points ref={pulses}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} /></bufferGeometry>
      <pointsMaterial color={theme.pulse} size={0.055} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  </group>;
}

function CameraRig() {
  useFrame(({ camera }, delta) => { const world = worldSnapshot(); const reduced = usePerceptualStore.getState().reducedMotion; const amount = reduced ? .15 : 1; camera.position.x = THREE.MathUtils.lerp(camera.position.x, world.cameraParallaxX * amount, Math.min(1, delta * 3)); camera.position.y = THREE.MathUtils.lerp(camera.position.y, world.cameraParallaxY * amount, Math.min(1, delta * 3)); camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8.5 * world.zoom, Math.min(1, delta * 3)); camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, world.cameraRoll * amount, Math.min(1, delta * 3)); });
  return null;
}

function CaptureBridge({ onReady, onCaptureReady }: { onReady: (canvas: HTMLCanvasElement) => void; onCaptureReady: (capture: () => string) => void }) {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => { onReady(gl.domElement); onCaptureReady(() => { const width = size.width; const height = size.height; const dpr = gl.getPixelRatio(); gl.setPixelRatio(1); gl.setSize(1920, 1080, false); gl.render(scene, camera); const data = gl.domElement.toDataURL('image/png'); gl.setPixelRatio(dpr); gl.setSize(width, height, false); gl.render(scene, camera); return data; }); }, [camera, gl, onCaptureReady, onReady, scene, size.height, size.width]);
  return null;
}

export function PerceptualCortexCanvas({ seed, quality, themeId, onCanvas, onCaptureReady }: { seed: number; quality: QualityTier; themeId: VisualThemeId; onCanvas: (canvas: HTMLCanvasElement) => void; onCaptureReady: (capture: () => string) => void }) {
  const config = qualityConfig[quality];
  const theme = visualThemes[themeId];
  return <Canvas dpr={[1, config.dpr]} camera={{ position: [0, 0, 8.5], fov: 52 }} gl={{ antialias: quality !== 'low', alpha: false, preserveDrawingBuffer: true }}>
    <color attach="background" args={[theme.background]} />
    <fog attach="fog" args={[theme.fog, 7, 14]} />
    <ambientLight intensity={0.32} />
    <pointLight position={[2, 3, 4]} color={theme.branchPrimary} intensity={7} />
    <pointLight position={[-3, -2, 2]} color={theme.branchSecondary} intensity={5} />
    <Organism seed={seed} pulseCount={config.pulses} themeId={themeId} />
    <CameraRig />
    <CaptureBridge onReady={onCanvas} onCaptureReady={onCaptureReady} />
  </Canvas>;
}
