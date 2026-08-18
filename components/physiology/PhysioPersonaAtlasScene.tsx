'use client';

import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { NatureWorldRenderer } from '@/components/physiology/NatureWorldRenderer';
import {
  NATURE_WORLD_PALETTES,
  getNatureWorld,
} from '@/lib/physiology/natureWorlds';
import {
  dominantSleepStage,
  getSignal,
  type PersonaMoodSelfReport,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';
import { ACTIVITIES, type PersonaActivity } from '@/lib/physiology/world';

type SceneProps = {
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
  worldId: string;
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
  const color = index === 0 ? '#b8ecff' : index === 1 ? '#dfcbff' : '#c3f5cf';
  return (
    <mesh ref={ref} scale={0.034 + strength * 0.021}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.78} />
    </mesh>
  );
}

function Firefly({ position, phase }: { position: Vec3; phase: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime() * 0.8 + phase;
    ref.current.position.x = position[0] + Math.sin(time * 1.2) * 0.2;
    ref.current.position.y = position[1] + Math.sin(time * 1.9) * 0.14;
    ref.current.position.z = position[2] + Math.cos(time) * 0.14;
  });
  return <mesh ref={ref} position={position} scale={0.03}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#efff99" emissive="#d7ff64" emissiveIntensity={2.2} /></mesh>;
}

function LittleRock({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return <mesh position={position} scale={[0.22 * scale, 0.14 * scale, 0.18 * scale]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#7b8180" roughness={1} flatShading /></mesh>;
}

function ActivityProp({ activity }: { activity: PersonaActivity }) {
  if (activity === 'rest') {
    return (
      <group position={[1.05, -0.42, 0.35]}>
        <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.06, 0.08, 0.28, 8]} /><meshStandardMaterial color="#e6ddcf" /></mesh>
        <mesh position={[0, 0.31, 0]} scale={[0.3, 0.12, 0.3]}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#b96d73" /></mesh>
      </group>
    );
  }
  if (activity === 'build-cairn') {
    return <group position={[1.05, -0.45, 0.35]}><LittleRock position={[0,0.05,0]} scale={1.05} /><LittleRock position={[0,0.24,0]} scale={0.74} /><LittleRock position={[0,0.39,0]} scale={0.5} /></group>;
  }
  if (activity === 'skip-stones') {
    return <group position={[1.05,-0.43,0.28]}><LittleRock position={[-0.18,0.04,0]} scale={0.4} /><LittleRock position={[0.06,0.04,0.06]} scale={0.32} /><LittleRock position={[0.25,0.035,-0.04]} scale={0.26} /></group>;
  }
  if (activity === 'fish') {
    return (
      <group position={[0.9,-0.27,0.25]} rotation={[0,0.15,-0.52]}>
        <mesh position={[0,0.52,0]}><cylinderGeometry args={[0.016,0.022,1.05,7]} /><meshStandardMaterial color="#72583e" /></mesh>
        <mesh position={[0.33,0.96,0]} scale={0.04}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#ef786f" /></mesh>
      </group>
    );
  }
  if (activity === 'garden') {
    return (
      <group position={[1.05,-0.48,0.3]}>
        <mesh position={[0,0.015,0]} scale={[0.75,0.05,0.55]}><boxGeometry /><meshStandardMaterial color="#5c4939" /></mesh>
        {[-0.22,0,0.22].map((x) => <mesh key={x} position={[x,0.16,0]} scale={[0.08,0.16,0.05]}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#7ba36a" /></mesh>)}
      </group>
    );
  }
  if (activity === 'collect') {
    return (
      <group position={[1,-0.4,0.35]}>
        <mesh position={[0,0.12,0]} scale={[0.28,0.16,0.2]}><sphereGeometry args={[1,12,10]} /><meshStandardMaterial color="#80664c" /></mesh>
        <Firefly position={[-0.15,0.34,0]} phase={1} /><Firefly position={[0.15,0.3,0.06]} phase={2.2} />
      </group>
    );
  }
  if (activity === 'chase-fireflies') {
    return <>{[0,1,2,3,4,5].map((index) => <Firefly key={index} position={[-1.25 + (index % 3) * 0.9, 0.28 + (index % 2) * 0.5, -0.8 + Math.floor(index / 3) * 0.9]} phase={index * 1.4} />)}</>;
  }
  if (activity === 'stargaze') {
    return <mesh position={[0.92,-0.48,0.24]} rotation={[-Math.PI/2,0,0.2]} scale={[0.75,0.5,1]}><planeGeometry args={[1,1]} /><meshStandardMaterial color="#6e637b" /></mesh>;
  }
  if (activity === 'snow-angel') {
    return <mesh position={[0.95,-0.475,0.25]} rotation={[-Math.PI/2,0,0.2]} scale={[0.48,0.7,1]}><ringGeometry args={[0.38,0.48,24]} /><meshStandardMaterial color="#c3dce4" /></mesh>;
  }
  if (activity === 'warm-fire') {
    return (
      <group position={[1.15,-0.43,0.3]}>
        <mesh rotation={[0,0,Math.PI/2]} position={[0,0.07,0]}><cylinderGeometry args={[0.045,0.05,0.46,7]} /><meshStandardMaterial color="#5d4033" /></mesh>
        <mesh position={[0,0.3,0]} scale={[0.14,0.28,0.14]}><coneGeometry args={[1,2,8]} /><meshStandardMaterial color="#ffd079" emissive="#ff742f" emissiveIntensity={2.4} /></mesh>
        <pointLight position={[0,0.55,0]} intensity={5} distance={3.5} color="#ff9b52" />
      </group>
    );
  }
  return null;
}

function Persona({ snapshot, mood, accent, activity }: Omit<SceneProps, 'worldId'>) {
  const group = useRef<Group>(null);
  const torso = useRef<Mesh>(null);
  const heart = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const leftArm = useRef<Mesh>(null);
  const rightArm = useRef<Mesh>(null);
  const respiration = numericSignal(snapshot, 'respiration_rate', 12);
  const movement = numericSignal(snapshot, 'movement_intensity', 0.1);
  const cardiac = numericSignal(snapshot, 'cardiac_rate', 60);
  const sleepStage = dominantSleepStage(snapshot);
  const moodEnergy = { calm: 0.55, curious: 0.82, energized: 1.25, sleepy: 0.28 }[mood];
  const sleepEnergy = sleepStage === 'deep' ? 0.38 : sleepStage === 'light' ? 0.65 : sleepStage === 'rem' ? 0.78 : 1;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const breath = Math.sin(time * Math.PI * 2 * (Math.max(6, respiration) / 60));
    const energetic = ['explore','skip-stones','snow-angel','chase-fireflies'].includes(activity);
    const activityEnergy = energetic ? 1.35 : ['rest','warm-fire','stargaze'].includes(activity) ? 0.45 : 0.82;
    const bounce = Math.sin(time * (1.8 + movement * 2.8)) * (0.025 + movement * 0.085) * moodEnergy * sleepEnergy * activityEnergy;
    const lying = activity === 'snow-angel';

    if (group.current) {
      group.current.position.y = lying ? -0.42 : bounce - 0.18;
      group.current.position.x = activity === 'chase-fireflies' ? Math.sin(time * 0.8) * 0.22 : 0;
      group.current.rotation.x = lying ? -1.12 : ['garden','collect'].includes(activity) ? 0.08 + Math.sin(time * 1.7) * 0.035 : 0;
      group.current.rotation.y = lying ? 0.3 : Math.sin(time * 0.27) * 0.12 * moodEnergy;
      group.current.rotation.z = lying ? Math.sin(time * 1.9) * 0.04 : Math.sin(time * 0.43) * 0.018 * moodEnergy;
    }
    if (torso.current) torso.current.scale.set(0.68 + breath * 0.014, 0.82 + breath * 0.032, 0.45 + breath * 0.022);
    if (head.current) {
      head.current.rotation.x = activity === 'stargaze' ? -0.3 : ['garden','collect'].includes(activity) ? 0.18 : Math.sin(time * 0.31) * 0.04;
      head.current.rotation.z = activity === 'fish' ? -0.08 : Math.sin(time * 0.37) * 0.035;
    }
    if (heart.current) {
      const pulse = Math.max(0, Math.sin(time * Math.PI * 2 * (Math.max(40, cardiac) / 60)));
      heart.current.scale.setScalar(0.075 + pulse * 0.014);
    }
    if (leftArm.current && rightArm.current) {
      let left = -0.3;
      let right = 0.3;
      if (['garden','collect','build-cairn'].includes(activity)) {
        const reach = Math.sin(time * 2.2) * 0.18;
        left = -0.58 + reach;
        right = 0.58 - reach;
      } else if (activity === 'skip-stones') {
        right = 0.35 + Math.sin(time * 3.1) * 0.55;
      } else if (activity === 'snow-angel') {
        const sweep = 0.72 + Math.sin(time * 2.1) * 0.45;
        left = -sweep;
        right = sweep;
      } else if (['chase-fireflies','explore'].includes(activity)) {
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
    <group ref={group} position={[0,-0.18,0]}>
      <mesh ref={torso} position={[0,0.77,0]} scale={[0.68,0.82,0.45]}><sphereGeometry args={[1,28,24]} /><meshStandardMaterial color={accent} roughness={0.68} metalness={0.04} /></mesh>
      <mesh ref={head} position={[0,1.53,0.02]}><sphereGeometry args={[0.42,28,24]} /><meshStandardMaterial color={accent} roughness={0.62} /></mesh>
      <mesh position={[-0.15,1.59,0.38]} scale={[0.075,eyeScale,0.038]}><sphereGeometry args={[1,18,16]} /><meshStandardMaterial color="#effcff" emissive="#9de7f6" emissiveIntensity={0.35} /></mesh>
      <mesh position={[0.15,1.59,0.38]} scale={[0.075,eyeScale,0.038]}><sphereGeometry args={[1,18,16]} /><meshStandardMaterial color="#effcff" emissive="#9de7f6" emissiveIntensity={0.35} /></mesh>
      <mesh position={[0,1.43,0.4]} scale={[0.12,0.028,0.028]}><sphereGeometry args={[1,16,14]} /><meshStandardMaterial color="#e3f6ee" /></mesh>
      <mesh ref={heart} position={[0,0.87,0.43]} scale={0.075}><sphereGeometry args={[1,18,16]} /><meshStandardMaterial color="#f6a7ad" emissive="#e76f7d" emissiveIntensity={0.48} /></mesh>
      <mesh ref={leftArm} position={[-0.55,0.83,0]} rotation={[0,0,-0.3]}><capsuleGeometry args={[0.095,0.5,5,12]} /><meshStandardMaterial color={accent} /></mesh>
      <mesh ref={rightArm} position={[0.55,0.83,0]} rotation={[0,0,0.3]}><capsuleGeometry args={[0.095,0.5,5,12]} /><meshStandardMaterial color={accent} /></mesh>
      <mesh position={[-0.23,0.02,0]}><capsuleGeometry args={[0.13,0.52,5,12]} /><meshStandardMaterial color={accent} /></mesh>
      <mesh position={[0.23,0.02,0]}><capsuleGeometry args={[0.13,0.52,5,12]} /><meshStandardMaterial color={accent} /></mesh>
      {[0,1,2].map((index) => <EvidenceMote key={index} index={index} strength={snapshot.overall_observability} />)}
    </group>
  );
}

function SceneContent(props: SceneProps) {
  const world = getNatureWorld(props.worldId);
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const cave = world.terrain === 'cave';
  const ambient = cave ? 0.42 : props.mood === 'energized' ? 0.95 : props.mood === 'calm' ? 0.72 : 0.82;
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, 6.5, 13]} />
      <ambientLight intensity={ambient} />
      <hemisphereLight color={palette.accent} groundColor={palette.ground} intensity={cave ? 0.55 : 1.1} />
      <directionalLight position={[3.5,5.5,3]} intensity={props.mood === 'energized' ? 2.2 : 1.55} color={palette.accent} />
      <pointLight position={[-3,2.4,2.5]} intensity={7} distance={8} color={props.accent} />
      <NatureWorldRenderer key={world.id} world={world} />
      <ActivityProp activity={props.activity} />
      <Persona snapshot={props.snapshot} mood={props.mood} accent={props.accent} activity={props.activity} />
    </>
  );
}

export function PhysioPersonaAtlasScene(props: SceneProps) {
  const world = getNatureWorld(props.worldId);
  const activity = ACTIVITIES[props.activity];
  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:h-[620px]">
      <Canvas dpr={[1,1.4]} camera={{ position: [0,1.65,5.25], fov: 42 }}>
        <SceneContent {...props} />
        <OrbitControls target={[0,0.72,0]} enablePan={false} minDistance={3.7} maxDistance={6.8} minPolarAngle={Math.PI*0.24} maxPolarAngle={Math.PI*0.66} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-4 pb-4 pt-16 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/50">world {String(world.index).padStart(3,'0')} · {world.theme}</p>
            <p className="mt-1 text-sm font-medium text-white/92">{world.icon} {world.name}</p>
            <p className="mt-1 hidden max-w-lg text-[0.65rem] leading-5 text-white/52 sm:block">{world.description}</p>
          </div>
          <p className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[0.68rem] text-white/75 backdrop-blur">{activity.icon} {activity.name}</p>
        </div>
      </div>
    </div>
  );
}
