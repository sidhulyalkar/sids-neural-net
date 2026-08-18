'use client';

import { useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import {
  dominantSleepStage,
  getSignal,
  type PersonaMoodSelfReport,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';

type SceneProps = {
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
};

function numericSignal(snapshot: PersonaSnapshot, key: string, fallback: number): number {
  const signal = getSignal(snapshot, key);
  return signal?.available && typeof signal.value === 'number' ? signal.value : fallback;
}

function EvidenceMote({ index, strength }: { index: number; strength: number }) {
  const ref = useRef<Mesh>(null);
  const phase = index * 2.15;
  const radius = 1.05 + index * 0.18;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime() * (0.22 + index * 0.035) + phase;
    ref.current.position.x = Math.cos(time) * radius;
    ref.current.position.z = Math.sin(time) * radius * 0.55;
    ref.current.position.y = 1.0 + Math.sin(time * 1.7) * 0.34 + index * 0.08;
  });

  return (
    <mesh ref={ref} scale={0.045 + strength * 0.025}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color={index === 0 ? '#7dd3fc' : index === 1 ? '#c4b5fd' : '#a7f3d0'}
        emissive={index === 0 ? '#0ea5e9' : index === 1 ? '#8b5cf6' : '#10b981'}
        emissiveIntensity={0.55}
      />
    </mesh>
  );
}

function Persona({ snapshot, mood, accent }: SceneProps) {
  const group = useRef<Group>(null);
  const torso = useRef<Mesh>(null);
  const heart = useRef<Mesh>(null);
  const respirationRate = numericSignal(snapshot, 'respiration_rate', 12);
  const movement = numericSignal(snapshot, 'movement_intensity', 0.1);
  const cardiacRate = numericSignal(snapshot, 'cardiac_rate', 60);
  const sleepStage = dominantSleepStage(snapshot);

  const moodEnergy = {
    calm: 0.55,
    curious: 0.82,
    energized: 1.25,
    sleepy: 0.28,
  }[mood];
  const sleepEnergy = sleepStage === 'deep' ? 0.38 : sleepStage === 'light' ? 0.65 : sleepStage === 'rem' ? 0.78 : 1;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const breathPhase = time * Math.PI * 2 * (Math.max(6, respirationRate) / 60);
    const breath = Math.sin(breathPhase);
    const bounce = Math.sin(time * (1.8 + movement * 2.8)) * movement * 0.11 * moodEnergy * sleepEnergy;

    if (group.current) {
      group.current.position.y = bounce;
      group.current.rotation.y = Math.sin(time * 0.27) * 0.12 * moodEnergy;
      group.current.rotation.z = Math.sin(time * 0.43) * 0.018 * moodEnergy;
    }
    if (torso.current) {
      torso.current.scale.set(0.74 + breath * 0.015, 0.92 + breath * 0.035, 0.48 + breath * 0.025);
    }
    if (heart.current) {
      const pulse = Math.max(0, Math.sin(time * Math.PI * 2 * (Math.max(40, cardiacRate) / 60)));
      const scale = 0.09 + pulse * 0.018;
      heart.current.scale.setScalar(scale);
    }
  });

  const eyeScale = mood === 'sleepy' || sleepStage === 'deep' ? 0.055 : 0.085;

  return (
    <group ref={group} position={[0, -0.18, 0]}>
      <mesh ref={torso} position={[0, 0.86, 0]} scale={[0.74, 0.92, 0.48]}>
        <sphereGeometry args={[1, 40, 40]} />
        <meshStandardMaterial color={accent} roughness={0.55} metalness={0.08} />
      </mesh>

      <mesh position={[0, 1.72, 0.02]}>
        <sphereGeometry args={[0.47, 40, 40]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>

      <mesh position={[-0.17, 1.78, 0.43]} scale={[0.09, eyeScale, 0.045]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#e6fbff" emissive="#7dd3fc" emissiveIntensity={0.38} />
      </mesh>
      <mesh position={[0.17, 1.78, 0.43]} scale={[0.09, eyeScale, 0.045]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#e6fbff" emissive="#7dd3fc" emissiveIntensity={0.38} />
      </mesh>

      <mesh position={[0, 1.58, 0.46]} scale={[0.14, 0.035, 0.035]} rotation={[0, 0, mood === 'energized' ? 0.08 : 0]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial color="#d9fbf2" />
      </mesh>

      <mesh ref={heart} position={[0, 0.98, 0.47]} scale={0.09}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#fda4af" emissive="#fb7185" emissiveIntensity={0.55} />
      </mesh>

      <mesh position={[-0.61, 0.9, 0]} rotation={[0, 0, -0.32]}>
        <capsuleGeometry args={[0.11, 0.58, 6, 16]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      <mesh position={[0.61, 0.9, 0]} rotation={[0, 0, 0.32]}>
        <capsuleGeometry args={[0.11, 0.58, 6, 16]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>

      <mesh position={[-0.26, 0.02, 0]}>
        <capsuleGeometry args={[0.15, 0.6, 6, 16]} />
        <meshStandardMaterial color={accent} roughness={0.65} />
      </mesh>
      <mesh position={[0.26, 0.02, 0]}>
        <capsuleGeometry args={[0.15, 0.6, 6, 16]} />
        <meshStandardMaterial color={accent} roughness={0.65} />
      </mesh>

      {[0, 1, 2].map((index) => (
        <EvidenceMote key={index} index={index} strength={snapshot.overall_observability} />
      ))}
    </group>
  );
}

function Ground() {
  return (
    <group position={[0, -0.62, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.25, 64]} />
        <meshStandardMaterial color="#07151c" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2.1, 64]} />
        <meshStandardMaterial color="#0f2732" emissive="#082f49" emissiveIntensity={0.24} />
      </mesh>
    </group>
  );
}

export function PhysioPersonaScene(props: SceneProps) {
  const keyLight = useMemo(() => props.accent, [props.accent]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:h-[520px]">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.45, 4.25], fov: 40 }}>
        <ambientLight intensity={0.72} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color={keyLight} />
        <pointLight position={[-3, 2, 2]} intensity={18} distance={8} color="#67e8f9" />
        <Persona {...props} />
        <Ground />
        <OrbitControls
          enablePan={false}
          minDistance={3.2}
          maxDistance={5.4}
          minPolarAngle={Math.PI * 0.28}
          maxPolarAngle={Math.PI * 0.62}
        />
      </Canvas>
    </div>
  );
}
