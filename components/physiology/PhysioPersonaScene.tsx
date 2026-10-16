'use client';

import { useMemo, useRef } from 'react';
import { OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import {
  dominantSleepStage,
  getSignal,
  type PersonaMoodSelfReport,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';
import {
  ACTIVITIES,
  BIOMES,
  type PersonaActivity,
  type PersonaBiome,
} from '@/lib/physiology/world';

type SceneProps = {
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
  biome: PersonaBiome;
  activity: PersonaActivity;
};

type Vec3 = [number, number, number];

function numericSignal(snapshot: PersonaSnapshot, key: string, fallback: number): number {
  const signal = getSignal(snapshot, key);
  return signal?.available && typeof signal.value === 'number' ? signal.value : fallback;
}

function EvidenceMote({ index, strength }: { index: number; strength: number }) {
  const ref = useRef<Mesh>(null);
  const phase = index * 2.15;
  const radius = 0.86 + index * 0.18;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime() * (0.22 + index * 0.035) + phase;
    ref.current.position.x = Math.cos(time) * radius;
    ref.current.position.z = Math.sin(time) * radius * 0.55 + 0.25;
    ref.current.position.y = 1.05 + Math.sin(time * 1.7) * 0.24 + index * 0.06;
  });

  return (
    <mesh ref={ref} scale={0.034 + strength * 0.021}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color={index === 0 ? '#b8ecff' : index === 1 ? '#dfcbff' : '#c3f5cf'}
        emissive={index === 0 ? '#38bdf8' : index === 1 ? '#a78bfa' : '#4ade80'}
        emissiveIntensity={0.85}
      />
    </mesh>
  );
}

function Firefly({ position, phase = 0, color = '#e8ef9a' }: { position: Vec3; phase?: number; color?: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime() * 0.75 + phase;
    ref.current.position.x = position[0] + Math.sin(time * 1.17) * 0.18;
    ref.current.position.y = position[1] + Math.sin(time * 1.83) * 0.13;
    ref.current.position.z = position[2] + Math.cos(time * 0.91) * 0.13;
    const pulse = 0.8 + Math.max(0, Math.sin(time * 2.7)) * 0.45;
    ref.current.scale.setScalar(0.025 * pulse);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} />
    </mesh>
  );
}

function Rock({ position, scale = 1, color = '#667078' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <mesh position={position} scale={[0.25 * scale, 0.16 * scale, 0.2 * scale]} rotation={[0.08, 0.31, -0.05]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </mesh>
  );
}

function PineTree({ position, scale = 1, snow = false }: { position: Vec3; scale?: number; snow?: boolean }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 0.86, 8]} />
        <meshStandardMaterial color="#5b493d" roughness={1} />
      </mesh>
      {[0.72, 1.02, 1.28].map((height, index) => (
        <group key={height} position={[0, height, 0]}>
          <mesh>
            <coneGeometry args={[0.48 - index * 0.085, 0.64, 9]} />
            <meshStandardMaterial color={snow ? '#496c68' : '#315c46'} roughness={0.95} flatShading />
          </mesh>
          {snow && (
            <mesh position={[0, 0.08, 0]} scale={[0.93, 0.2, 0.93]}>
              <coneGeometry args={[0.46 - index * 0.085, 0.58, 9]} />
              <meshStandardMaterial color="#e4eef1" roughness={0.9} flatShading />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function Mountain({ position, scale = 1, color = '#627784' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <coneGeometry args={[1.15, 2.35, 5]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.72, 0]} scale={[0.58, 0.36, 0.58]}>
        <coneGeometry args={[1.1, 2.1, 5]} />
        <meshStandardMaterial color="#e6eef0" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

function Fern({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2, 3, 4].map((index) => {
        const angle = (index / 5) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.12, 0.24, Math.sin(angle) * 0.12]}
            rotation={[0.2, -angle, 0.72]}
            scale={[0.08, 0.34, 0.035]}
          >
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={index % 2 ? '#68a96d' : '#4f8d5d'} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

function Flower({ position, color }: { position: Vec3; color: string }) {
  return (
    <group position={position} scale={0.7}>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.012, 0.016, 0.32, 6]} />
        <meshStandardMaterial color="#5b8a55" />
      </mesh>
      {[0, 1, 2, 3, 4].map((index) => {
        const angle = (index / 5) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.055, 0.34, Math.sin(angle) * 0.055]} scale={[0.055, 0.026, 0.035]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.34, 0]} scale={0.03}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#eadb77" />
      </mesh>
    </group>
  );
}

function Reeds({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[-0.09, -0.03, 0.05, 0.11].map((offset, index) => (
        <group key={offset} position={[offset, 0, Math.sin(index) * 0.04]}>
          <mesh position={[0, 0.27 + index * 0.025, 0]}>
            <cylinderGeometry args={[0.009, 0.012, 0.54 + index * 0.05, 5]} />
            <meshStandardMaterial color="#70845d" />
          </mesh>
          <mesh position={[0, 0.57 + index * 0.05, 0]} scale={[0.025, 0.09, 0.025]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color="#77674b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Campfire({ position = [1.1, -0.38, 0.35] as Vec3 }: { position?: Vec3 }) {
  const flame = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const flicker = 0.88 + Math.sin(clock.getElapsedTime() * 8.2) * 0.08 + Math.sin(clock.getElapsedTime() * 13.7) * 0.05;
    flame.current.scale.set(0.15 * flicker, 0.3 * flicker, 0.15 * flicker);
  });
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.52, 7]} />
        <meshStandardMaterial color="#5b3f32" roughness={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.52, 7]} />
        <meshStandardMaterial color="#6a4937" roughness={1} />
      </mesh>
      <mesh ref={flame} position={[0, 0.31, 0]} scale={[0.15, 0.3, 0.15]}>
        <coneGeometry args={[1, 2, 9]} />
        <meshStandardMaterial color="#ffd17a" emissive="#ff7a2f" emissiveIntensity={2.4} />
      </mesh>
      <pointLight position={[0, 0.6, 0]} color="#ff9c52" intensity={8} distance={4.4} />
    </group>
  );
}

function Cairn({ position = [1.0, -0.42, 0.45] as Vec3 }: { position?: Vec3 }) {
  return (
    <group position={position}>
      <Rock position={[0, 0.06, 0]} scale={0.95} />
      <Rock position={[0.01, 0.25, 0]} scale={0.72} color="#7a7f80" />
      <Rock position={[-0.02, 0.4, 0]} scale={0.52} color="#858989" />
    </group>
  );
}

function Mushroom({ position = [1.05, -0.42, 0.35] as Vec3 }: { position?: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.065, 0.08, 0.28, 9]} />
        <meshStandardMaterial color="#e8dfce" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.31, 0]} scale={[0.3, 0.12, 0.3]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#b76b69" roughness={0.85} />
      </mesh>
    </group>
  );
}

function FishingRod() {
  return (
    <group position={[0.92, -0.27, 0.25]} rotation={[0, 0.15, -0.52]}>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.016, 0.022, 1.05, 7]} />
        <meshStandardMaterial color="#72583e" />
      </mesh>
      <mesh position={[0.33, 0.96, 0]} scale={0.04}>
        <sphereGeometry args={[1, 9, 9]} />
        <meshStandardMaterial color="#ef786f" emissive="#b4423b" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function GardenPatch() {
  return (
    <group position={[1.05, -0.48, 0.3]}>
      <mesh position={[0, 0.015, 0]} scale={[0.75, 0.05, 0.55]}>
        <boxGeometry />
        <meshStandardMaterial color="#5c4939" roughness={1} />
      </mesh>
      {[-0.22, 0, 0.22].flatMap((x) =>
        [-0.12, 0.12].map((z, index) => (
          <group key={`${x}-${z}`} position={[x, 0.08, z]} scale={0.8 + index * 0.08}>
            <mesh position={[0, 0.12, 0]} scale={[0.03, 0.14, 0.03]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color="#73965f" />
            </mesh>
            <mesh position={[0.05, 0.18, 0]} scale={[0.09, 0.04, 0.05]} rotation={[0, 0, 0.55]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color="#83ad69" />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

function ActivityProps({ activity }: { activity: PersonaActivity }) {
  if (activity === 'warm-fire') return <Campfire />;
  if (activity === 'build-cairn') return <Cairn />;
  if (activity === 'rest') return <Mushroom />;
  if (activity === 'fish') return <FishingRod />;
  if (activity === 'garden') return <GardenPatch />;
  if (activity === 'collect') {
    return (
      <group position={[0.95, -0.4, 0.35]}>
        <mesh position={[0, 0.12, 0]} scale={[0.28, 0.16, 0.2]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#80664c" roughness={1} />
        </mesh>
        <Firefly position={[-0.13, 0.36, 0]} phase={1} color="#bde9ff" />
        <Firefly position={[0.13, 0.31, 0.05]} phase={2} color="#d9c5ff" />
      </group>
    );
  }
  if (activity === 'skip-stones') {
    return (
      <group position={[1.05, -0.41, 0.25]}>
        <Rock position={[-0.2, 0.05, 0]} scale={0.42} />
        <Rock position={[0.05, 0.04, 0.08]} scale={0.33} />
        <Rock position={[0.22, 0.035, -0.05]} scale={0.27} />
      </group>
    );
  }
  if (activity === 'chase-fireflies') {
    return (
      <>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Firefly
            key={index}
            position={[
              -1.25 + (index % 3) * 0.9,
              0.25 + (index % 2) * 0.5,
              -0.8 + Math.floor(index / 3) * 0.9,
            ]}
            phase={index * 1.4}
          />
        ))}
      </>
    );
  }
  if (activity === 'stargaze') {
    return (
      <mesh position={[0.92, -0.48, 0.24]} rotation={[-Math.PI / 2, 0, 0.2]} scale={[0.75, 0.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#6e637b" roughness={0.92} />
      </mesh>
    );
  }
  if (activity === 'snow-angel') {
    return (
      <mesh position={[0.95, -0.475, 0.25]} rotation={[-Math.PI / 2, 0, 0.2]} scale={[0.48, 0.7, 1]}>
        <ringGeometry args={[0.38, 0.48, 24]} />
        <meshStandardMaterial color="#c3dce4" roughness={1} />
      </mesh>
    );
  }
  return null;
}

function AlpineWorld() {
  return (
    <group>
      <Mountain position={[-2.8, 0.15, -3.9]} scale={1.28} />
      <Mountain position={[0.2, -0.22, -5.1]} scale={1.65} color="#6d818d" />
      <Mountain position={[3.0, 0.0, -4.4]} scale={1.3} color="#5b707e" />
      <PineTree position={[-2.05, -0.52, -1.0]} scale={0.78} snow />
      <PineTree position={[2.05, -0.52, -1.25]} scale={0.92} snow />
      <PineTree position={[-1.6, -0.52, 1.15]} scale={0.6} snow />
      <Rock position={[-1.2, -0.43, 0.28]} scale={0.85} color="#8b969c" />
      <Rock position={[1.6, -0.45, -0.25]} scale={0.58} color="#889399" />
    </group>
  );
}

function JungleWorld() {
  return (
    <group>
      <PineTree position={[-2.15, -0.52, -1.4]} scale={1.1} />
      <PineTree position={[2.05, -0.52, -1.75]} scale={1.25} />
      <PineTree position={[2.5, -0.52, 0.65]} scale={0.8} />
      <Fern position={[-1.5, -0.48, 0.6]} scale={1.15} />
      <Fern position={[1.55, -0.48, 0.25]} scale={1.35} />
      <Fern position={[-0.95, -0.48, -1.2]} scale={0.9} />
      <Fern position={[0.85, -0.48, -1.65]} scale={1.05} />
      <Rock position={[-1.1, -0.42, 0.05]} scale={0.65} color="#52655a" />
      {[0, 1, 2].map((index) => (
        <Firefly key={index} position={[-1.2 + index * 1.1, 0.3 + index * 0.13, -0.8 + index * 0.25]} phase={index * 2.2} />
      ))}
    </group>
  );
}

function CaveWorld() {
  return (
    <group>
      <mesh position={[-3.15, 1.2, -1.2]} scale={[2.2, 3.4, 2.0]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#29282e" roughness={1} flatShading />
      </mesh>
      <mesh position={[3.15, 1.05, -1.1]} scale={[2.3, 3.1, 2.1]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#26262c" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 3.65, -1.7]} scale={[4.5, 1.25, 2.5]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#232329" roughness={1} flatShading />
      </mesh>
      <Campfire position={[1.45, -0.42, -0.45]} />
      <Rock position={[-1.45, -0.42, 0.4]} scale={1.1} color="#555158" />
      <Rock position={[1.85, -0.42, 0.75]} scale={0.9} color="#5f5960" />
      <Firefly position={[-1.4, 0.65, -1.3]} phase={0.3} color="#cbb5ff" />
      <Firefly position={[1.35, 0.85, -1.45]} phase={2.5} color="#7fdde9" />
    </group>
  );
}

function RiverWorld() {
  return (
    <group>
      <mesh position={[0, -0.45, -1.55]} rotation={[-Math.PI / 2, 0, -0.12]} scale={[1.15, 3.6, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#4f91a1" roughness={0.28} metalness={0.12} transparent opacity={0.9} />
      </mesh>
      <PineTree position={[-2.15, -0.52, -1.55]} scale={0.9} />
      <PineTree position={[2.15, -0.52, -1.8]} scale={0.82} />
      <Reeds position={[-0.85, -0.5, -0.72]} />
      <Reeds position={[0.85, -0.5, -0.95]} scale={0.85} />
      <Rock position={[-0.35, -0.39, -1.45]} scale={0.58} color="#788078" />
      <Rock position={[0.24, -0.39, -1.75]} scale={0.48} color="#7b817b" />
      <Rock position={[0.76, -0.4, -1.42]} scale={0.55} color="#757d79" />
      <Firefly position={[-1.45, 0.3, 0.2]} phase={1.2} color="#bfe9d7" />
    </group>
  );
}

function CoastWorld() {
  return (
    <group>
      <mesh position={[0, -0.43, -2.3]} rotation={[-Math.PI / 2, 0, 0]} scale={[7, 4.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#3e88a8" roughness={0.3} metalness={0.15} transparent opacity={0.94} />
      </mesh>
      <Rock position={[-1.8, -0.38, -0.9]} scale={1.15} color="#777c75" />
      <Rock position={[1.65, -0.4, -1.1]} scale={0.82} color="#85857b" />
      <Reeds position={[-2.05, -0.5, 0.3]} scale={0.68} />
      <Reeds position={[2.15, -0.5, 0.55]} scale={0.56} />
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[-0.7 + index * 0.7, -0.455, -0.72 - index * 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12 + index * 0.02, 0.14 + index * 0.02, 20]} />
          <meshStandardMaterial color="#9bd3de" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function MeadowWorld() {
  const flowerPositions: Array<[Vec3, string]> = [
    [[-1.65, -0.49, 0.35], '#c6a0c7'],
    [[-1.1, -0.49, -0.55], '#d9c57d'],
    [[1.4, -0.49, 0.3], '#d89b9b'],
    [[1.8, -0.49, -0.65], '#a9c6df'],
    [[0.9, -0.49, -1.15], '#c8a9d4'],
    [[-2.0, -0.49, -1.0], '#e1bc8f'],
  ];
  return (
    <group>
      <PineTree position={[-2.1, -0.52, -1.5]} scale={0.82} />
      <PineTree position={[2.25, -0.52, -1.9]} scale={0.68} />
      {flowerPositions.map(([position, color]) => (
        <Flower key={`${position.join('-')}-${color}`} position={position} color={color} />
      ))}
      <Rock position={[-1.35, -0.44, 0.75]} scale={0.55} color="#6e796c" />
      <Firefly position={[1.45, 0.45, -0.4]} phase={0.5} />
      <Firefly position={[-1.25, 0.62, -0.8]} phase={2.2} />
    </group>
  );
}

function BiomeWorld({ biome }: { biome: PersonaBiome }) {
  if (biome === 'alpine') return <AlpineWorld />;
  if (biome === 'jungle') return <JungleWorld />;
  if (biome === 'cave') return <CaveWorld />;
  if (biome === 'river') return <RiverWorld />;
  if (biome === 'coast') return <CoastWorld />;
  return <MeadowWorld />;
}

function Persona({ snapshot, mood, accent, activity }: Omit<SceneProps, 'biome'>) {
  const group = useRef<Group>(null);
  const torso = useRef<Mesh>(null);
  const heart = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const leftArm = useRef<Mesh>(null);
  const rightArm = useRef<Mesh>(null);
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
    const energeticActivity = ['explore', 'skip-stones', 'snow-angel', 'chase-fireflies'].includes(activity);
    const activityEnergy = energeticActivity ? 1.35 : activity === 'rest' || activity === 'warm-fire' || activity === 'stargaze' ? 0.45 : 0.82;
    const bounce = Math.sin(time * (1.8 + movement * 2.8)) * (0.025 + movement * 0.085) * moodEnergy * sleepEnergy * activityEnergy;

    if (group.current) {
      const lyingDown = activity === 'snow-angel';
      group.current.position.y = lyingDown ? -0.42 : bounce - 0.18;
      group.current.position.x = activity === 'chase-fireflies' ? Math.sin(time * 0.8) * 0.22 : 0;
      group.current.rotation.x = lyingDown ? -1.12 : activity === 'garden' || activity === 'collect' ? Math.sin(time * 1.7) * 0.035 + 0.08 : 0;
      group.current.rotation.y = lyingDown ? 0.3 : Math.sin(time * 0.27) * 0.12 * moodEnergy;
      group.current.rotation.z = lyingDown ? Math.sin(time * 1.9) * 0.04 : Math.sin(time * 0.43) * 0.018 * moodEnergy;
    }
    if (torso.current) {
      torso.current.scale.set(0.68 + breath * 0.014, 0.82 + breath * 0.032, 0.45 + breath * 0.022);
    }
    if (head.current) {
      head.current.rotation.x = activity === 'stargaze' ? -0.3 : activity === 'garden' || activity === 'collect' ? 0.18 : Math.sin(time * 0.31) * 0.04;
      head.current.rotation.z = activity === 'fish' ? -0.08 : Math.sin(time * 0.37) * 0.035;
    }
    if (heart.current) {
      const pulse = Math.max(0, Math.sin(time * Math.PI * 2 * (Math.max(40, cardiacRate) / 60)));
      const scale = 0.075 + pulse * 0.014;
      heart.current.scale.setScalar(scale);
    }
    if (leftArm.current && rightArm.current) {
      let left = -0.3;
      let right = 0.3;
      if (activity === 'garden' || activity === 'collect' || activity === 'build-cairn') {
        const reach = Math.sin(time * 2.2) * 0.18;
        left = -0.58 + reach;
        right = 0.58 - reach;
      } else if (activity === 'skip-stones') {
        right = 0.35 + Math.sin(time * 3.1) * 0.55;
      } else if (activity === 'snow-angel') {
        const sweep = 0.72 + Math.sin(time * 2.1) * 0.45;
        left = -sweep;
        right = sweep;
      } else if (activity === 'chase-fireflies' || activity === 'explore') {
        const swing = Math.sin(time * 3.2) * 0.25;
        left = -0.3 + swing;
        right = 0.3 - swing;
      }
      leftArm.current.rotation.z = left;
      rightArm.current.rotation.z = right;
    }
  });

  const eyeScale = mood === 'sleepy' || sleepStage === 'deep' || activity === 'rest' ? 0.045 : 0.075;

  return (
    <group ref={group} position={[0, -0.18, 0]}>
      <mesh ref={torso} position={[0, 0.77, 0]} scale={[0.68, 0.82, 0.45]}>
        <sphereGeometry args={[1, 28, 24]} />
        <meshStandardMaterial color={accent} roughness={0.68} metalness={0.04} />
      </mesh>

      <mesh ref={head} position={[0, 1.53, 0.02]}>
        <sphereGeometry args={[0.42, 28, 24]} />
        <meshStandardMaterial color={accent} roughness={0.62} />
      </mesh>

      <mesh position={[-0.15, 1.59, 0.38]} scale={[0.075, eyeScale, 0.038]}>
        <sphereGeometry args={[1, 18, 16]} />
        <meshStandardMaterial color="#effcff" emissive="#9de7f6" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.15, 1.59, 0.38]} scale={[0.075, eyeScale, 0.038]}>
        <sphereGeometry args={[1, 18, 16]} />
        <meshStandardMaterial color="#effcff" emissive="#9de7f6" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={[0, 1.43, 0.4]} scale={[0.12, 0.028, 0.028]} rotation={[0, 0, mood === 'energized' ? 0.08 : 0]}>
        <sphereGeometry args={[1, 16, 14]} />
        <meshStandardMaterial color="#e3f6ee" />
      </mesh>

      <mesh ref={heart} position={[0, 0.87, 0.43]} scale={0.075}>
        <sphereGeometry args={[1, 18, 16]} />
        <meshStandardMaterial color="#f6a7ad" emissive="#e76f7d" emissiveIntensity={0.48} />
      </mesh>

      <mesh ref={leftArm} position={[-0.55, 0.83, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.095, 0.5, 5, 12]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>
      <mesh ref={rightArm} position={[0.55, 0.83, 0]} rotation={[0, 0, 0.3]}>
        <capsuleGeometry args={[0.095, 0.5, 5, 12]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>

      <mesh position={[-0.23, 0.02, 0]}>
        <capsuleGeometry args={[0.13, 0.52, 5, 12]} />
        <meshStandardMaterial color={accent} roughness={0.72} />
      </mesh>
      <mesh position={[0.23, 0.02, 0]}>
        <capsuleGeometry args={[0.13, 0.52, 5, 12]} />
        <meshStandardMaterial color={accent} roughness={0.72} />
      </mesh>

      {[0, 1, 2].map((index) => (
        <EvidenceMote key={index} index={index} strength={snapshot.overall_observability} />
      ))}
    </group>
  );
}

function WorldGround({ biome }: { biome: PersonaBiome }) {
  const definition = BIOMES[biome];
  return (
    <group position={[0, -0.52, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.7, 56]} />
        <meshStandardMaterial color={definition.ground} roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.8, 4.55, 56]} />
        <meshStandardMaterial color={definition.secondary} roughness={0.96} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function WorldScene(props: SceneProps) {
  const definition = BIOMES[props.biome];
  const nightLike = props.mood === 'sleepy' || props.activity === 'stargaze';
  const ambient = props.biome === 'cave' ? 0.42 : props.mood === 'energized' ? 0.95 : props.mood === 'calm' ? 0.72 : 0.82;
  return (
    <>
      <color attach="background" args={[nightLike && props.biome !== 'cave' ? '#172635' : definition.sky]} />
      <fog attach="fog" args={[definition.fog, 6.5, 13]} />
      <ambientLight intensity={ambient} />
      <hemisphereLight color={definition.accent} groundColor={definition.ground} intensity={props.biome === 'cave' ? 0.55 : 1.1} />
      <directionalLight position={[3.5, 5.5, 3]} intensity={props.mood === 'energized' ? 2.2 : 1.55} color={definition.accent} />
      <pointLight position={[-3, 2.4, 2.5]} intensity={7} distance={8} color={props.accent} />
      {nightLike && <Stars radius={38} depth={20} count={650} factor={2.1} saturation={0.2} fade speed={0.25} />}
      <WorldGround biome={props.biome} />
      <BiomeWorld biome={props.biome} />
      <ActivityProps activity={props.activity} />
      <Persona snapshot={props.snapshot} mood={props.mood} accent={props.accent} activity={props.activity} />
    </>
  );
}

export function PhysioPersonaScene(props: SceneProps) {
  const definition = useMemo(() => BIOMES[props.biome], [props.biome]);
  const activity = ACTIVITIES[props.activity];

  return (
    <div className="relative h-[470px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:h-[590px]">
      <Canvas dpr={[1, 1.45]} camera={{ position: [0, 1.65, 5.25], fov: 42 }}>
        <WorldScene {...props} />
        <OrbitControls
          target={[0, 0.72, 0]}
          enablePan={false}
          minDistance={3.7}
          maxDistance={6.8}
          minPolarAngle={Math.PI * 0.24}
          maxPolarAngle={Math.PI * 0.66}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-4 pb-4 pt-14 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/55">tiny world</p>
            <p className="mt-1 text-sm font-medium text-white/90">{definition.icon} {definition.name}</p>
          </div>
          <p className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[0.68rem] text-white/75 backdrop-blur">
            {activity.icon} {activity.name}
          </p>
        </div>
      </div>
    </div>
  );
}
