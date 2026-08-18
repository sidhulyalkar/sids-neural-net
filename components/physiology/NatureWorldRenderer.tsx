'use client';

import { useMemo, useRef } from 'react';
import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import {
  NATURE_WORLD_PALETTES,
  type NatureWorldDefinition,
} from '@/lib/physiology/natureWorlds';

type Vec3 = [number, number, number];

type Props = { world: NatureWorldDefinition };

function makeRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatter(seed: number, count: number, radius = 2.7, y = -0.48): Vec3[] {
  const random = makeRandom(seed);
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = 0.85 + random() * radius;
    return [Math.cos(angle) * distance, y, Math.sin(angle) * distance - 0.25];
  });
}

function Rock({ position, scale = 1, color = '#6f7777' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <mesh position={position} scale={[0.28 * scale, 0.18 * scale, 0.23 * scale]} rotation={[0.08, position[0] * 0.19, -0.05]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.98} flatShading />
    </mesh>
  );
}

function Tree({ position, kind, scale = 1, autumn = false }: { position: Vec3; kind: 'pine' | 'oak' | 'bamboo' | 'willow' | 'cherry'; scale?: number; autumn?: boolean }) {
  if (kind === 'bamboo') {
    return (
      <group position={position} scale={scale}>
        {[-0.14, 0, 0.15].map((x, index) => (
          <group key={x} position={[x, 0, (index - 1) * 0.07]}>
            <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.035, 0.045, 1.9, 7]} /><meshStandardMaterial color={index % 2 ? '#7e9863' : '#668253'} roughness={0.9} /></mesh>
            {[0.58, 1.04, 1.46].map((y, leaf) => (
              <mesh key={y} position={[leaf % 2 ? 0.18 : -0.17, y, 0]} rotation={[0, 0, leaf % 2 ? -0.65 : 0.65]} scale={[0.2, 0.055, 0.07]}>
                <sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#73925c" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }

  if (kind === 'willow') {
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0.68, 0]}><cylinderGeometry args={[0.1, 0.14, 1.35, 8]} /><meshStandardMaterial color="#5e4939" /></mesh>
        <mesh position={[0, 1.48, 0]} scale={[0.8, 0.52, 0.8]}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color="#668c67" roughness={0.95} /></mesh>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x, index) => (
          <mesh key={x} position={[x, 0.84 + (index % 2) * 0.1, 0]} scale={[0.045, 0.58, 0.045]}><capsuleGeometry args={[1, 1, 4, 7]} /><meshStandardMaterial color="#74956e" /></mesh>
        ))}
      </group>
    );
  }

  if (kind === 'oak' || kind === 'cherry') {
    const crowns: Vec3[] = [[-0.25, 1.45, 0], [0.28, 1.42, 0.05], [0, 1.72, -0.04]];
    const main = kind === 'cherry' ? '#d49ab0' : autumn ? '#b5764b' : '#58765a';
    const alt = kind === 'cherry' ? '#c98ca7' : autumn ? '#c58c54' : '#668361';
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.11, 0.17, 1.4, 8]} /><meshStandardMaterial color="#5e4939" roughness={1} /></mesh>
        {crowns.map((p, index) => (
          <mesh key={index} position={p} scale={[0.55, 0.42, 0.5]}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={index % 2 ? main : alt} roughness={0.96} flatShading /></mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.055, 0.08, 0.9, 7]} /><meshStandardMaterial color="#5e4939" /></mesh>
      {[0.75, 1.08, 1.37].map((height, index) => (
        <mesh key={height} position={[0, height, 0]}><coneGeometry args={[0.5 - index * 0.09, 0.7, 8]} /><meshStandardMaterial color={autumn ? (index % 2 ? '#a86b45' : '#c18a51') : (index % 2 ? '#315c48' : '#3d6a50')} roughness={0.96} flatShading /></mesh>
      ))}
    </group>
  );
}

function Fern({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 0.1, 0.22, Math.sin(angle) * 0.1]} rotation={[0.1, -angle, 0.78]} scale={[0.07, 0.31, 0.03]}><sphereGeometry args={[1, 8, 7]} /><meshStandardMaterial color={index % 2 ? '#67a46b' : '#4f8a5b'} /></mesh>;
      })}
    </group>
  );
}

function Flower({ position, color = '#d8a6c3', scale = 1 }: { position: Vec3; color?: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.01, 0.013, 0.32, 5]} /><meshStandardMaterial color="#5e8758" /></mesh>
      {[0, 1, 2, 3, 4].map((index) => {
        const angle = (index / 5) * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 0.055, 0.34, Math.sin(angle) * 0.055]} scale={[0.06, 0.025, 0.04]}><sphereGeometry args={[1, 7, 7]} /><meshStandardMaterial color={color} /></mesh>;
      })}
      <mesh position={[0, 0.34, 0]} scale={0.025}><sphereGeometry args={[1, 7, 7]} /><meshStandardMaterial color="#edd778" /></mesh>
    </group>
  );
}

function Mushroom({ position, glow = false, scale = 1 }: { position: Vec3; glow?: boolean; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.035, 0.048, 0.24, 7]} /><meshStandardMaterial color="#dfd6c7" /></mesh>
      <mesh position={[0, 0.27, 0]} scale={[0.16, 0.075, 0.16]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={glow ? '#9bdcc2' : '#a96868'} emissive={glow ? '#57cda6' : '#000000'} emissiveIntensity={glow ? 1.8 : 0} /></mesh>
    </group>
  );
}

function Reeds({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[-0.12, -0.04, 0.05, 0.13].map((x, index) => (
        <group key={x} position={[x, 0, index % 2 ? 0.04 : -0.03]}>
          <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.008, 0.012, 0.56 + index * 0.04, 5]} /><meshStandardMaterial color="#72865d" /></mesh>
          <mesh position={[0, 0.6 + index * 0.04, 0]} scale={[0.022, 0.075, 0.022]}><sphereGeometry args={[1, 7, 7]} /><meshStandardMaterial color="#756347" /></mesh>
        </group>
      ))}
    </group>
  );
}

function Cactus({ position, pricklyPear = false, scale = 1 }: { position: Vec3; pricklyPear?: boolean; scale?: number }) {
  if (pricklyPear) {
    const pads: Vec3[] = [[-0.13, 0.22, 0], [0.08, 0.28, 0.02], [0.24, 0.2, -0.02], [0, 0.52, 0]];
    return (
      <group position={position} scale={scale}>
        {pads.map((p, index) => <mesh key={index} position={p} scale={[0.15, 0.24, 0.06]} rotation={[0, 0, index % 2 ? 0.18 : -0.12]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#5d8a58" /></mesh>)}
        <Flower position={[0.2, 0.43, 0]} color="#dc8a9e" scale={0.55} />
      </group>
    );
  }
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.1, 0.13, 1.3, 9]} /><meshStandardMaterial color="#527d55" /></mesh>
      <mesh position={[0.22, 0.72, 0]} rotation={[0, 0, -0.7]}><capsuleGeometry args={[0.07, 0.35, 4, 8]} /><meshStandardMaterial color="#5d895d" /></mesh>
      <mesh position={[-0.2, 0.48, 0]} rotation={[0, 0, 0.75]}><capsuleGeometry args={[0.065, 0.28, 4, 8]} /><meshStandardMaterial color="#5d895d" /></mesh>
    </group>
  );
}

function Sunflower({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.018, 0.024, 1.1, 6]} /><meshStandardMaterial color="#5b8b52" /></mesh>
      {[0,1,2,3,4,5,6,7].map((index) => {
        const angle = (index / 8) * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 0.12, 1.08, Math.sin(angle) * 0.12]} scale={[0.13, 0.045, 0.06]}><sphereGeometry args={[1, 8, 7]} /><meshStandardMaterial color="#e4c750" /></mesh>;
      })}
      <mesh position={[0, 1.08, 0]} scale={0.1}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#76543b" /></mesh>
    </group>
  );
}

function Coral({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[-0.18, 0, 0.18].map((x, index) => <mesh key={x} position={[x, 0.18 + index * 0.07, 0]} scale={[0.06, 0.35 + index * 0.08, 0.06]} rotation={[0, 0, (index - 1) * 0.18]}><capsuleGeometry args={[1, 1, 4, 7]} /><meshStandardMaterial color={index === 0 ? '#d88986' : index === 1 ? '#d5a0c9' : '#e1b16d'} /></mesh>)}
    </group>
  );
}

function Campfire({ position }: { position: Vec3 }) {
  const flame = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const time = clock.getElapsedTime();
    const pulse = 0.9 + Math.sin(time * 8.3) * 0.08 + Math.sin(time * 13.7) * 0.05;
    flame.current.scale.set(0.14 * pulse, 0.28 * pulse, 0.14 * pulse);
  });
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.07, 0]}><cylinderGeometry args={[0.045, 0.05, 0.48, 7]} /><meshStandardMaterial color="#5c4032" /></mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.07, 0]}><cylinderGeometry args={[0.045, 0.05, 0.48, 7]} /><meshStandardMaterial color="#6a4936" /></mesh>
      <mesh ref={flame} position={[0, 0.3, 0]} scale={[0.14, 0.28, 0.14]}><coneGeometry args={[1, 2, 8]} /><meshStandardMaterial color="#ffd079" emissive="#ff742f" emissiveIntensity={2.4} /></mesh>
      <pointLight position={[0, 0.55, 0]} intensity={6} distance={3.6} color="#ff9b52" />
    </group>
  );
}

function Mountain({ position, scale = 1, snow = false, color = '#667b82' }: { position: Vec3; scale?: number; snow?: boolean; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh><coneGeometry args={[1.2, 2.45, 5]} /><meshStandardMaterial color={color} roughness={1} flatShading /></mesh>
      {snow && <mesh position={[0, 0.75, 0]} scale={[0.58, 0.38, 0.58]}><coneGeometry args={[1.15, 2.2, 5]} /><meshStandardMaterial color="#e7eff1" roughness={0.96} flatShading /></mesh>}
    </group>
  );
}

function Cloud({ position, scale = 1, storm = false }: { position: Vec3; scale?: number; storm?: boolean }) {
  const puffs: Vec3[] = [[-0.3,0,0],[0,0.08,0],[0.32,0,0],[0.08,-0.08,0.05]];
  const color = storm ? '#65707b' : '#d7e3e1';
  return (
    <group position={position} scale={scale}>
      {puffs.map((p, index) => <mesh key={index} position={p} scale={[0.42,0.28,0.32]}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={color} transparent opacity={storm ? 0.8 : 0.72} roughness={1} /></mesh>)}
    </group>
  );
}

function Rainbow() {
  const colors = ['#e88b8b','#efb777','#e6d77f','#8ec89c','#80b7d1','#a99ad4'];
  return (
    <group position={[0, 1.8, -3.6]}>
      {colors.map((color, index) => <mesh key={color}><torusGeometry args={[2.15 - index * 0.11, 0.045, 8, 42, Math.PI]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} transparent opacity={0.72} /></mesh>)}
    </group>
  );
}

function Aurora() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.2) * 0.04; });
  return (
    <group ref={ref} position={[0, 2.4, -4.2]}>
      {[-0.65, 0, 0.65].map((x, index) => <mesh key={x} position={[x, index === 1 ? 0.2 : 0, 0]} rotation={[0, 0, (index - 1) * 0.12]} scale={[0.5, 1.5, 1]}><planeGeometry args={[1, 1.6]} /><meshBasicMaterial color={index === 1 ? '#7ce0b4' : '#8b9ee3'} transparent opacity={0.2} /></mesh>)}
    </group>
  );
}

function Meteor({ phase }: { phase: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * 0.24 + phase) % 1;
    ref.current.position.set(-3 + t * 6, 3.2 - t * 1.5, -4.6);
  });
  return (
    <group ref={ref}>
      <mesh scale={0.045}><sphereGeometry args={[1,8,8]} /><meshBasicMaterial color="#ffe6bd" /></mesh>
      <mesh position={[-0.22,0.06,0]} rotation={[0,0,-0.26]} scale={[0.34,0.012,0.012]}><boxGeometry /><meshBasicMaterial color="#f2b487" transparent opacity={0.55} /></mesh>
    </group>
  );
}

function DustDevil() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 1.9; });
  return (
    <group ref={ref} position={[1.5,0.2,-1.7]}>
      {[0,0.18,0.36,0.54,0.72].map((y, index) => <mesh key={y} position={[0,y,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[0.28-index*0.035,0.015,5,18]} /><meshBasicMaterial color="#c7a079" transparent opacity={0.45-index*0.05} /></mesh>)}
    </group>
  );
}

function Waterfall() {
  return (
    <group position={[1.6, 0.38, -2.2]}>
      <Rock position={[0,-0.3,0]} scale={2.4} color="#697678" />
      <mesh position={[0,0.25,0.3]} scale={[0.35,1.35,0.06]}><planeGeometry args={[1,1]} /><meshStandardMaterial color="#9fd9e2" emissive="#4c9eb5" emissiveIntensity={0.18} transparent opacity={0.78} /></mesh>
      <mesh position={[0,-0.38,0.38]} rotation={[-Math.PI/2,0,0]} scale={[0.7,0.42,1]}><circleGeometry args={[1,20]} /><meshStandardMaterial color="#78b7c6" transparent opacity={0.7} /></mesh>
    </group>
  );
}

function RedArch() {
  return (
    <group position={[0,0.3,-2.55]} scale={1.2}>
      <mesh position={[-0.62,0.48,0]} scale={[0.42,1.25,0.5]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#9b5e45" roughness={1} flatShading /></mesh>
      <mesh position={[0.62,0.48,0]} scale={[0.42,1.25,0.5]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#9b5e45" roughness={1} flatShading /></mesh>
      <mesh position={[0,1.26,0]} scale={[0.95,0.38,0.48]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#a8684c" roughness={1} flatShading /></mesh>
    </group>
  );
}

function Wildlife({ species, position, phase }: { species: string; position: Vec3; phase: number }) {
  const ref = useRef<Group>(null);
  const flying = ['bat','owl','eagle','butterfly','bee','dolphin'].includes(species);
  const tiny = ['ladybug','snail','caterpillar','crab','frog','scorpion','lizard'].includes(species);
  const aquatic = ['fish','turtle','otter','swan','duck','penguin','dolphin'].includes(species);
  const colors: Record<string, string> = {
    deer:'#9a7657', squirrel:'#a87852', bat:'#4b4652', fox:'#b96f4a', owl:'#887762', bear:'#6f5847', turtle:'#6d8d63', otter:'#775c48', swan:'#e5e5df', frog:'#6b9a5d', fish:'#73abc1', crab:'#b46a59', dolphin:'#6f9bab', penguin:'#38434d', duck:'#8e9260', goat:'#aaa28d', eagle:'#6d5844', sheep:'#d6d1c0', husky:'#75828c', butterfly:'#c79ac9', bee:'#d4b14f', bunny:'#b9aaa0', ladybug:'#ba5e58', snail:'#91836b', caterpillar:'#79a260', lizard:'#879160', scorpion:'#7e6853'
  };
  const color = colors[species] ?? '#9a866e';
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime() + phase;
    ref.current.position.y = position[1] + (flying ? 0.45 + Math.sin(time * 1.4) * 0.12 : tiny ? 0.05 : 0.18 + Math.sin(time * 0.9) * 0.025);
    ref.current.rotation.y = Math.sin(time * 0.45) * 0.35;
    if (flying) ref.current.position.x = position[0] + Math.sin(time * 0.55) * 0.35;
  });
  const scale = tiny ? 0.35 : species === 'bear' ? 1.15 : 0.72;
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh scale={aquatic ? [0.32,0.16,0.18] : [0.28,0.22,0.2]}><sphereGeometry args={[1,12,9]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <mesh position={[0.28,0.12,0.02]} scale={[0.16,0.15,0.15]}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      {!aquatic && !flying && !tiny && <>
        <mesh position={[-0.13,-0.25,0.08]} scale={[0.055,0.22,0.055]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0.14,-0.25,0.08]} scale={[0.055,0.22,0.055]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={color} /></mesh>
      </>}
      {flying && <>
        <mesh position={[-0.27,0.03,0]} rotation={[0,0,0.42]} scale={[0.28,0.055,0.12]}><sphereGeometry args={[1,9,7]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0.27,0.03,0]} rotation={[0,0,-0.42]} scale={[0.28,0.055,0.12]}><sphereGeometry args={[1,9,7]} /><meshStandardMaterial color={color} /></mesh>
      </>}
      {['deer','goat','bunny','fox','husky'].includes(species) && <>
        <mesh position={[0.21,0.31,0.05]} rotation={[0,0,0.35]} scale={[0.05,0.14,0.04]}><coneGeometry args={[1,1.8,6]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0.36,0.31,0.05]} rotation={[0,0,-0.35]} scale={[0.05,0.14,0.04]}><coneGeometry args={[1,1.8,6]} /><meshStandardMaterial color={color} /></mesh>
      </>}
      <mesh position={[0.34,0.14,0.14]} scale={0.025}><sphereGeometry args={[1,7,7]} /><meshStandardMaterial color="#172027" /></mesh>
    </group>
  );
}

function Weather({ kind, seed }: { kind: 'snow' | 'rain' | 'petals' | 'glow'; seed: number }) {
  const ref = useRef<Group>(null);
  const positions = useMemo(() => scatter(seed, kind === 'rain' ? 34 : 24, 3.4, 0), [seed, kind]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = -((clock.getElapsedTime() * (kind === 'rain' ? 1.4 : 0.35)) % 1.1);
    ref.current.rotation.y = kind === 'petals' ? clock.getElapsedTime() * 0.04 : 0;
  });
  const color = kind === 'snow' ? '#f3fbff' : kind === 'rain' ? '#acd4dc' : kind === 'petals' ? '#e9b6c6' : '#d9ff9c';
  return (
    <group ref={ref}>
      {positions.map((p, index) => (
        <mesh key={index} position={[p[0], 1.1 + (index % 5) * 0.62, p[2]]} scale={kind === 'rain' ? [0.012,0.18,0.012] : [0.025,0.025,0.025]}>
          {kind === 'rain' ? <boxGeometry /> : <sphereGeometry args={[1,6,6]} />}
          <meshBasicMaterial color={color} transparent opacity={kind === 'glow' ? 0.7 : 0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Terrain({ world }: Props) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const water = ['shore','reef','lake','river','wetland','ice'].includes(world.terrain);
  const snow = world.terrain === 'snow' || world.terrain === 'ice';
  return (
    <group>
      <mesh position={[0,-0.52,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[4.75,64]} /><meshStandardMaterial color={snow ? '#dce7ea' : palette.ground} roughness={0.96} /></mesh>
      <mesh position={[0,-0.555,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[3.9,4.58,64]} /><meshStandardMaterial color={palette.secondary} transparent opacity={0.58} roughness={0.98} /></mesh>
      {water && <mesh position={[0,-0.45,world.terrain === 'river' ? -1.55 : -2.2]} rotation={[-Math.PI/2,0,world.terrain === 'river' ? -0.12 : 0]} scale={world.terrain === 'river' ? [1.25,3.8,1] : [5.8,3.9,1]}><planeGeometry args={[1,1]} /><meshStandardMaterial color={palette.water} roughness={0.3} metalness={0.12} transparent opacity={0.88} /></mesh>}
      {world.terrain === 'cave' && <>
        <mesh position={[-3.15,1.2,-1.3]} scale={[2.2,3.4,2.1]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#2b2b31" roughness={1} flatShading /></mesh>
        <mesh position={[3.15,1.05,-1.2]} scale={[2.3,3.1,2.1]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#27272d" roughness={1} flatShading /></mesh>
        <mesh position={[0,3.75,-1.8]} scale={[4.5,1.3,2.6]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#24242a" roughness={1} flatShading /></mesh>
      </>}
      {['mountain','snow','hill'].includes(world.terrain) && <>
        <Mountain position={[-2.8,0.12,-4]} scale={1.28} snow={snow} color={palette.secondary} />
        <Mountain position={[0.25,-0.2,-5.15]} scale={1.68} snow={snow} color={palette.secondary} />
        <Mountain position={[3.05,0.02,-4.4]} scale={1.28} snow={snow} color={palette.secondary} />
      </>}
      {world.terrain === 'canyon' && <>
        <mesh position={[-3,1.15,-2.4]} scale={[1.8,2.4,1.4]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#9a684e" roughness={1} flatShading /></mesh>
        <mesh position={[3,1,-2.2]} scale={[1.9,2.25,1.5]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#a97152" roughness={1} flatShading /></mesh>
      </>}
      {world.terrain === 'volcanic' && <Mountain position={[0,0.1,-4.3]} scale={1.75} color="#4b4645" />}
    </group>
  );
}

function Motifs({ world }: Props) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const positions = useMemo(() => scatter(world.seed, 18), [world.seed]);
  const features = useMemo(() => new Set(world.features), [world.features]);
  const has = (...names: string[]) => names.some((name) => features.has(name));
  const treeKind: 'pine' | 'oak' | 'bamboo' | 'willow' | 'cherry' = has('bamboo') ? 'bamboo' : has('willow') ? 'willow' : has('cherry') ? 'cherry' : has('oak','hollow') ? 'oak' : 'pine';
  const treeCount = has('pine','oak','bamboo','willow','cherry','hollow') || world.terrain === 'forest' ? 5 : 0;
  const flowerCount = has('flowers','tulips','lavender','dandelions','clover','roses','berries','petals') ? 9 : ['meadow','garden'].includes(world.terrain) ? 5 : 0;
  const flowerColors = has('lavender') ? ['#a993c7'] : has('tulips') ? ['#d98fa0','#d8b36d','#b792c9'] : has('roses') ? ['#c47784'] : ['#d6a1bd','#d4c278','#9dc0d6'];
  return (
    <group>
      {Array.from({ length: treeCount }, (_, index) => <Tree key={`tree-${index}`} position={positions[index]} scale={0.62 + (index % 3) * 0.14} kind={treeKind} autumn={has('autumn','leaves')} />)}
      {has('ferns','moss') && positions.slice(6,11).map((p,index) => <Fern key={`fern-${index}`} position={p} scale={0.8 + (index % 2) * 0.25} />)}
      {positions.slice(5,5+flowerCount).map((p,index) => <Flower key={`flower-${index}`} position={p} color={flowerColors[index % flowerColors.length]} scale={has('tulips') ? 1.25 : 0.8} />)}
      {has('mushrooms') && positions.slice(3,10).map((p,index) => <Mushroom key={`mush-${index}`} position={p} glow={has('glow')} scale={0.7 + (index % 3) * 0.16} />)}
      {has('sunflowers') && positions.slice(4,11).map((p,index) => <Sunflower key={`sun-${index}`} position={p} scale={0.72 + (index % 2) * 0.18} />)}
      {has('cactus') && positions.slice(4,9).map((p,index) => <Cactus key={`cactus-${index}`} position={p} scale={0.7 + index * 0.06} />)}
      {has('prickly-pear') && positions.slice(4,9).map((p,index) => <Cactus key={`pear-${index}`} position={p} pricklyPear scale={0.75 + index * 0.04} />)}
      {has('reeds','marsh','delta') && positions.slice(5,12).map((p,index) => <Reeds key={`reeds-${index}`} position={p} scale={0.7 + (index % 3) * 0.14} />)}
      {has('coral','reef') && positions.slice(5,12).map((p,index) => <Coral key={`coral-${index}`} position={[p[0],-0.44,p[2]-1.2]} scale={0.65 + (index % 3) * 0.16} />)}
      {has('lily-pads','pond','lagoon') && positions.slice(5,12).map((p,index) => <mesh key={`lily-${index}`} position={[p[0]*0.7,-0.4,p[2]-1.2]} rotation={[-Math.PI/2,0,index*0.5]} scale={[0.22,0.22,0.04]}><circleGeometry args={[1,16]} /><meshStandardMaterial color={index % 2 ? '#648f66' : '#527b59'} /></mesh>)}
      {has('rocks','boulder','granite','ledge','ridge','peak','pass','world-edge') && positions.slice(4,11).map((p,index) => <Rock key={`rock-${index}`} position={p} scale={has('boulder') && index === 0 ? 2.7 : 0.6 + (index % 3) * 0.22} color={palette.secondary} />)}
      {has('log') && <mesh position={[-0.75,-0.35,-0.55]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.13,0.16,1.2,8]} /><meshStandardMaterial color="#66503e" /></mesh>}
      {has('campfire','camp') && <Campfire position={[1.35,-0.45,0.25]} />}
      {has('waterfall') && <Waterfall />}
      {has('red-arch') && <RedArch />}
      {has('garden-wall') && <><mesh position={[-2,0.12,-1.5]} scale={[0.25,0.75,2]}><boxGeometry /><meshStandardMaterial color="#76716a" /></mesh><mesh position={[2,0.12,-1.5]} scale={[0.25,0.75,2]}><boxGeometry /><meshStandardMaterial color="#76716a" /></mesh></>}
      {has('tall-grass','wheat','grass','field') && positions.slice(3,15).map((p,index) => <mesh key={`grass-${index}`} position={[p[0],-0.21,p[2]]} scale={[0.025,0.32 + (index % 3) * 0.09,0.025]}><capsuleGeometry args={[1,1,3,5]} /><meshStandardMaterial color={has('wheat') ? '#c7ad63' : '#719260'} /></mesh>)}
      {has('shells') && positions.slice(4,12).map((p,index) => <mesh key={`shell-${index}`} position={[p[0],-0.43,p[2]]} rotation={[-Math.PI/2,0,index*0.7]} scale={[0.08,0.06,0.03]}><torusGeometry args={[1,0.28,5,12,Math.PI*1.5]} /><meshStandardMaterial color={index % 2 ? '#d9b5ac' : '#e3d3bd'} /></mesh>)}
      {has('acorns','berries','grapes') && positions.slice(4,12).map((p,index) => <mesh key={`fruit-${index}`} position={[p[0],-0.38,p[2]]} scale={0.055}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color={has('berries') ? '#ad4f58' : has('grapes') ? '#80628c' : '#8a6847'} /></mesh>)}
      {has('rainbow') && <Rainbow />}
      {has('aurora') && <Aurora />}
      {has('meteor') && <><Meteor phase={0.1} /><Meteor phase={0.58} /></>}
      {has('dust-devil') && <DustDevil />}
      {has('clouds') && <><Cloud position={[-2.2,2.5,-4]} scale={1.1} storm={has('thunder')} /><Cloud position={[2.1,2.1,-4.5]} scale={0.9} storm={has('thunder')} /></>}
      {has('snow','powder','snowdrift') && <Weather kind="snow" seed={world.seed+31} />}
      {has('rain') && <Weather kind="rain" seed={world.seed+41} />}
      {has('petals','cherry') && <Weather kind="petals" seed={world.seed+47} />}
      {has('glow','bioluminescent') && <Weather kind="glow" seed={world.seed+53} />}
    </group>
  );
}

function WildlifeLayer({ world }: Props) {
  const positions = useMemo(() => scatter(world.seed + 109, Math.max(2, world.wildlife.length * 2), 2.1, -0.44), [world.seed, world.wildlife.length]);
  return <group>{world.wildlife.map((species,index) => <Wildlife key={`${species}-${index}`} species={species} position={positions[index] ?? [1.4,-0.44,-1]} phase={world.seed*0.001 + index*1.7} />)}</group>;
}

export function NatureWorldRenderer({ world }: Props) {
  const features = useMemo(() => new Set(world.features), [world.features]);
  const night = world.palette === 'sky-night' || world.palette === 'sky-aurora' || features.has('stars') || features.has('twilight');
  return (
    <group>
      {night && <Stars radius={36} depth={18} count={features.has('milky-way') ? 1250 : 650} factor={features.has('milky-way') ? 2.6 : 2} saturation={0.18} fade speed={0.2} />}
      <Terrain world={world} />
      <Motifs world={world} />
      <WildlifeLayer world={world} />
    </group>
  );
}
