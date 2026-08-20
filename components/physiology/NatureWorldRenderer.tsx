'use client';

import { useMemo, useRef } from 'react';
import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import {
  NATURE_WORLD_PALETTES,
  type NatureRenderCue,
  type RichNatureWorldDefinition,
} from '@/lib/physiology/natureWorldsExpanded';

type Vec3 = [number, number, number];
type Props = { world: RichNatureWorldDefinition };

type TreeKind = 'pine' | 'oak' | 'bamboo' | 'willow' | 'palm';

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

function scatter(seed: number, count: number, radius = 2.9, y = -0.48): Vec3[] {
  const random = makeRandom(seed);
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = 0.8 + random() * radius;
    return [Math.cos(angle) * distance, y, Math.sin(angle) * distance - 0.35];
  });
}

function hashHue(seed: number) {
  const colors = ['#d79bae', '#e2c777', '#a9c7db', '#c4a5d9', '#e1a984', '#8fc59d'];
  return colors[Math.abs(seed) % colors.length];
}

function Rock({ position, scale = 1, color = '#6f7777' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <mesh position={position} scale={[0.28 * scale, 0.18 * scale, 0.23 * scale]} rotation={[0.08, position[0] * 0.19, -0.05]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.98} flatShading />
    </mesh>
  );
}

function Tree({ position, kind, scale = 1, tint }: { position: Vec3; kind: TreeKind; scale?: number; tint?: string }) {
  if (kind === 'bamboo') {
    return (
      <group position={position} scale={scale}>
        {[-0.14, 0, 0.15].map((x, index) => (
          <group key={x} position={[x, 0, (index - 1) * 0.07]}>
            <mesh position={[0, 0.95, 0]}>
              <cylinderGeometry args={[0.035, 0.045, 1.9, 7]} />
              <meshStandardMaterial color={index % 2 ? '#7e9863' : '#668253'} roughness={0.9} />
            </mesh>
            {[0.58, 1.04, 1.46].map((y, leaf) => (
              <mesh key={y} position={[leaf % 2 ? 0.18 : -0.17, y, 0]} rotation={[0, 0, leaf % 2 ? -0.65 : 0.65]} scale={[0.2, 0.055, 0.07]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color="#73925c" />
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
        <mesh position={[0, 1.48, 0]} scale={[0.8, 0.52, 0.8]}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={tint ?? '#668c67'} roughness={0.95} /></mesh>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x, index) => (
          <mesh key={x} position={[x, 0.84 + (index % 2) * 0.1, 0]} scale={[0.045, 0.58, 0.045]}><capsuleGeometry args={[1, 1, 4, 7]} /><meshStandardMaterial color="#74956e" /></mesh>
        ))}
      </group>
    );
  }

  if (kind === 'palm') {
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0.85, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.07, 0.11, 1.7, 8]} />
          <meshStandardMaterial color="#806548" roughness={1} />
        </mesh>
        {Array.from({ length: 7 }, (_, index) => {
          const angle = (index / 7) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.27, 1.68, Math.sin(angle) * 0.27]} rotation={[0.12, -angle, 0.78]} scale={[0.09, 0.52, 0.035]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color={tint ?? '#668f5d'} roughness={0.95} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (kind === 'oak') {
    const crowns: Vec3[] = [[-0.25, 1.45, 0], [0.28, 1.42, 0.05], [0, 1.72, -0.04]];
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.11, 0.17, 1.45, 8]} /><meshStandardMaterial color="#614936" roughness={1} /></mesh>
        {crowns.map((p, index) => (
          <mesh key={index} position={p} scale={[0.55, 0.42, 0.5]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={index % 2 ? tint ?? '#668361' : tint ?? '#58765a'} roughness={0.96} flatShading />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.055, 0.08, 0.9, 7]} /><meshStandardMaterial color="#5b493d" roughness={1} /></mesh>
      {[0.75, 1.08, 1.37].map((height, index) => (
        <mesh key={height} position={[0, height, 0]}>
          <coneGeometry args={[0.5 - index * 0.09, 0.7, 8]} />
          <meshStandardMaterial color={tint ?? (index % 2 ? '#315c48' : '#3d6a50')} roughness={0.96} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Flower({ position, color, scale = 1 }: { position: Vec3; color: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.012, 0.017, 0.36, 6]} /><meshStandardMaterial color="#5b8a55" /></mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 0.065, 0.38, Math.sin(angle) * 0.065]} scale={[0.065, 0.03, 0.04]}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color={color} /></mesh>;
      })}
      <mesh position={[0, 0.38, 0]} scale={0.034}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#eadb77" /></mesh>
    </group>
  );
}

function Mushroom({ position, scale = 1, glow = false }: { position: Vec3; scale?: number; glow?: boolean }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.06, 0.08, 0.28, 9]} /><meshStandardMaterial color="#e6dfcf" /></mesh>
      <mesh position={[0, 0.31, 0]} scale={[0.28, 0.12, 0.28]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={glow ? '#a5e8b4' : '#b66d6a'} emissive={glow ? '#63d790' : '#000000'} emissiveIntensity={glow ? 1.8 : 0} />
      </mesh>
    </group>
  );
}

function Fern({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 0.12, 0.24, Math.sin(angle) * 0.12]} rotation={[0.2, -angle, 0.74]} scale={[0.08, 0.34, 0.035]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={index % 2 ? '#68a96d' : '#4f8d5d'} roughness={0.95} /></mesh>;
      })}
    </group>
  );
}

function Cactus({ position, scale = 1, agave = false }: { position: Vec3; scale?: number; agave?: boolean }) {
  if (agave) {
    return (
      <group position={position} scale={scale}>
        {Array.from({ length: 9 }, (_, index) => {
          const angle = (index / 9) * Math.PI * 2;
          return <mesh key={index} position={[Math.cos(angle) * 0.14, 0.16, Math.sin(angle) * 0.14]} rotation={[0, -angle, 0.62]} scale={[0.07, 0.42, 0.03]}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#68886f" roughness={0.95} /></mesh>;
        })}
      </group>
    );
  }
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.12, 0.15, 1.3, 10]} /><meshStandardMaterial color="#62815e" roughness={0.94} /></mesh>
      <mesh position={[0.2, 0.72, 0]} rotation={[0, 0, -0.65]}><cylinderGeometry args={[0.07, 0.085, 0.55, 9]} /><meshStandardMaterial color="#6e8c65" /></mesh>
      <mesh position={[-0.18, 0.95, 0]} rotation={[0, 0, 0.7]}><cylinderGeometry args={[0.06, 0.075, 0.42, 9]} /><meshStandardMaterial color="#6e8c65" /></mesh>
    </group>
  );
}

function CrystalCluster({ position, scale = 1, color = '#acd9eb', glow = false }: { position: Vec3; scale?: number; color?: string; glow?: boolean }) {
  return (
    <group position={position} scale={scale}>
      {[-0.17, 0, 0.18].map((x, index) => (
        <mesh key={x} position={[x, 0.28 + index * 0.1, (index - 1) * 0.05]} rotation={[0.08, index * 0.35, x * 0.6]} scale={[0.12, 0.42 + index * 0.08, 0.12]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={color} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? 0.7 : 0} roughness={0.25} metalness={0.08} transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function CoralCluster({ position, scale = 1, color = '#db8eaa' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <group position={position} scale={scale}>
      {[-0.2, -0.07, 0.08, 0.21].map((x, index) => (
        <mesh key={x} position={[x, 0.2 + (index % 2) * 0.11, (index % 2 ? 0.06 : -0.04)]} rotation={[0, 0, x * 0.8]}>
          <cylinderGeometry args={[0.035, 0.055, 0.45 + index * 0.05, 7]} />
          <meshStandardMaterial color={index % 2 ? color : '#d8b082'} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function ShellCluster({ position, scale = 1, color = '#ead7c3' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0.2, 0]} scale={[0.28, 0.08, 0.23]}><sphereGeometry args={[1, 16, 10]} /><meshStandardMaterial color={color} roughness={0.55} /></mesh>
      <mesh position={[0.24, 0.02, 0.08]} rotation={[Math.PI / 2, -0.4, 0]} scale={[0.15, 0.05, 0.11]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#d7c4b5" /></mesh>
    </group>
  );
}

function WaterSurface({ world, kind }: { world: RichNatureWorldDefinition; kind: 'small' | 'river' | 'ocean' }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.22 + world.seed) * 0.015;
  });
  const scale: Vec3 = kind === 'ocean' ? [8, 5.1, 1] : kind === 'river' ? [1.25, 4.4, 1] : [2.5, 1.7, 1];
  const position: Vec3 = kind === 'ocean' ? [0, -0.45, -2.4] : kind === 'river' ? [0, -0.45, -1.55] : [0, -0.45, -1.35];
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, kind === 'river' ? -0.12 : 0]} scale={scale}>
      <planeGeometry args={[1, 1, 18, 18]} />
      <meshStandardMaterial color={palette.water} roughness={0.28} metalness={0.1} transparent opacity={0.88} />
    </mesh>
  );
}

function MountainLayer({ world, z, scale, opacity = 1 }: { world: RichNatureWorldDefinition; z: number; scale: number; opacity?: number }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  return (
    <group position={[0, -0.4, z]} scale={scale}>
      {[-2.5, -0.9, 0.8, 2.5].map((x, index) => (
        <mesh key={x} position={[x, 0.95 + (index % 2) * 0.28, 0]} rotation={[0, 0, index % 2 ? 0.04 : -0.04]}>
          <coneGeometry args={[1.4, 2.6 + (index % 2) * 0.4, 5]} />
          <meshStandardMaterial color={index % 2 ? palette.secondary : palette.fog} roughness={1} flatShading transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

function CloudLayer({ world, z, y, count = 5 }: { world: RichNatureWorldDefinition; z: number; y: number; count?: number }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const positions = useMemo(() => scatter(world.seed + Math.round(z * 100), count, 3.4, y), [count, world.seed, y, z]);
  return (
    <group>
      {positions.map((position, index) => (
        <group key={index} position={[position[0], y + (index % 3) * 0.28, z + position[2] * 0.1]}>
          {([[-0.24,0,0],[0.1,0.08,0],[0.37,-0.02,0]] as Vec3[]).map((p, puff) => (
            <mesh key={puff} position={p} scale={[0.5 + puff * 0.08, 0.22 + puff * 0.04, 0.16]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={palette.fog} transparent opacity={0.35 + (index % 2) * 0.12} roughness={1} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function RainbowArc() {
  const colors = ['#ef8d8d', '#e8bd72', '#dce58b', '#91cfa7', '#8fc8dc', '#b6a4df'];
  return (
    <group position={[0, 0.8, -2.9]} rotation={[0.02, 0, 0]}>
      {colors.map((color, index) => (
        <mesh key={color} rotation={[0, 0, Math.PI]} scale={[1 + index * 0.02, 1, 1]}>
          <torusGeometry args={[1.75 - index * 0.1, 0.045, 8, 48, Math.PI]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function Aurora({ world }: { world: RichNatureWorldDefinition }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.2 + world.seed) * 0.04;
  });
  return (
    <group ref={ref} position={[0, 1.9, -3.4]}>
      {[-0.7, 0, 0.7].map((x, index) => (
        <mesh key={x} position={[x, index * 0.17, 0]} rotation={[0, 0, 0.08 - index * 0.05]} scale={[1.3, 0.18, 1]}>
          <planeGeometry args={[2.2, 1, 18, 2]} />
          <meshBasicMaterial color={index === 1 ? '#8bd9cf' : index === 2 ? '#a995df' : '#80d7a9'} transparent opacity={0.24} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function CelestialBody({ world, type }: { world: RichNatureWorldDefinition; type: 'sun' | 'moon' }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  return (
    <mesh position={[1.9, 2.65, -4.3]} scale={type === 'sun' ? 0.44 : 0.34}>
      <sphereGeometry args={[1, 24, 18]} />
      <meshBasicMaterial color={type === 'sun' ? '#f4d490' : '#dce5ed'} />
      <pointLight color={type === 'sun' ? '#ffd69b' : palette.glow} intensity={type === 'sun' ? 3.4 : 1.2} distance={7} />
    </mesh>
  );
}

function Meteor({ world }: { world: RichNatureWorldDefinition }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * 0.18 + (world.seed % 10) / 10) % 1;
    ref.current.position.x = -2.8 + t * 5.6;
    ref.current.position.y = 3.1 - t * 1.5;
  });
  return (
    <group ref={ref} position={[-2.8, 3.1, -3.5]} rotation={[0, 0, -0.4]}>
      <mesh scale={0.08}><sphereGeometry args={[1, 10, 10]} /><meshBasicMaterial color="#fff2c9" /></mesh>
      <mesh position={[-0.42, 0, 0]} scale={[0.8, 0.025, 0.025]}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#d8e4ff" transparent opacity={0.45} /></mesh>
    </group>
  );
}

function WeatherParticles({ world }: { world: RichNatureWorldDefinition }) {
  const atmosphere = world.scene.atmosphere;
  const group = useRef<Group>(null);
  const count = atmosphere === 'storm' || atmosphere === 'rain' || atmosphere === 'snow' ? 30 : atmosphere === 'glow' || atmosphere === 'night' ? 20 : atmosphere === 'wind' ? 16 : 0;
  const points = useMemo(() => scatter(world.seed + 991, count, 3.5, 1.5).map((p, i) => [p[0], 0.2 + (i % 8) * 0.48, p[2]] as Vec3), [count, world.seed]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    if (atmosphere === 'wind') group.current.rotation.y = Math.sin(t * 0.25) * 0.05;
    if (atmosphere === 'glow' || atmosphere === 'night') group.current.rotation.y = t * 0.025;
    if (atmosphere === 'rain' || atmosphere === 'storm' || atmosphere === 'snow') group.current.position.y = -((t * (atmosphere === 'snow' ? 0.12 : 0.38)) % 0.48);
  });
  if (!count) return null;
  const isWet = atmosphere === 'rain' || atmosphere === 'storm';
  const isSnow = atmosphere === 'snow';
  const color = isWet ? '#b8d0dc' : isSnow ? '#edf6f7' : atmosphere === 'glow' ? NATURE_WORLD_PALETTES[world.palette].glow : '#dbe7ff';
  return (
    <group ref={group}>
      {points.map((p, index) => (
        <mesh key={index} position={p} scale={isWet ? [0.012, 0.13, 0.012] : isSnow ? [0.025, 0.025, 0.025] : [0.018 + (index % 3) * 0.006, 0.018, 0.018]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={isWet ? 0.48 : 0.65} />
        </mesh>
      ))}
    </group>
  );
}

function StylizedWildlife({ world }: { world: RichNatureWorldDefinition }) {
  if (world.wildlife.length === 0) return null;
  const label = world.wildlife[0];
  const aquatic = /fish|whale|shark|squid|octopus|otter|seal/.test(label);
  const bird = /bird|raptor|macaw|owl|swan|duck|flamingo/.test(label);
  const insect = /insect/.test(label);
  const reptile = /snake|crocod|turtle/.test(label);
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.position.y = (aquatic ? -0.05 : 0.05) + Math.sin(t * (bird ? 1.1 : insect ? 2.2 : 0.75) + world.seed) * (bird ? 0.18 : insect ? 0.1 : 0.035);
    group.current.position.x = Math.sin(t * 0.22 + world.seed) * (bird ? 0.5 : 0.12);
  });
  const palette = NATURE_WORLD_PALETTES[world.palette];
  if (insect) {
    return <group ref={group} position={[1.15, 0.45, -0.3]}><mesh scale={[0.06,0.04,0.09]}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={palette.accent} emissive={world.scene.atmosphere === 'glow' ? palette.accent : '#000000'} emissiveIntensity={1.1} /></mesh><mesh position={[-0.07,0.02,0]} scale={[0.08,0.015,0.05]}><sphereGeometry args={[1,8,6]} /><meshBasicMaterial color="#d8f0ee" transparent opacity={0.5} /></mesh><mesh position={[0.07,0.02,0]} scale={[0.08,0.015,0.05]}><sphereGeometry args={[1,8,6]} /><meshBasicMaterial color="#d8f0ee" transparent opacity={0.5} /></mesh></group>;
  }
  if (bird) {
    return <group ref={group} position={[1.25, 1.25, -1.0]}><mesh scale={[0.11,0.08,0.15]}><sphereGeometry args={[1,12,10]} /><meshStandardMaterial color={palette.secondary} /></mesh><mesh position={[-0.16,0,0]} rotation={[0,0,0.35]} scale={[0.19,0.025,0.08]}><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color={palette.accent} /></mesh><mesh position={[0.16,0,0]} rotation={[0,0,-0.35]} scale={[0.19,0.025,0.08]}><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color={palette.accent} /></mesh></group>;
  }
  if (aquatic) {
    return <group ref={group} position={[1.2, -0.12, -1.45]}><mesh scale={[0.25,0.12,0.12]}><sphereGeometry args={[1,14,10]} /><meshStandardMaterial color={palette.accent} /></mesh><mesh position={[-0.28,0,0]} rotation={[0,0,Math.PI/4]} scale={[0.11,0.06,0.04]}><coneGeometry args={[1,1,3]} /><meshStandardMaterial color={palette.secondary} /></mesh></group>;
  }
  if (reptile) {
    return <group ref={group} position={[1.1, -0.38, 0.2]} rotation={[0,0.3,0]}><mesh scale={[0.32,0.06,0.08]}><capsuleGeometry args={[0.4,1.2,4,8]} /><meshStandardMaterial color="#6f835d" /></mesh></group>;
  }
  return <group ref={group} position={[1.15,-0.28,0.1]}><mesh position={[0,0.22,0]} scale={[0.25,0.22,0.22]}><sphereGeometry args={[1,14,12]} /><meshStandardMaterial color={palette.secondary} /></mesh><mesh position={[0.2,0.42,0.03]} scale={[0.14,0.14,0.14]}><sphereGeometry args={[1,12,10]} /><meshStandardMaterial color={palette.secondary} /></mesh><mesh position={[-0.11,0.02,0]} scale={[0.06,0.18,0.06]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={palette.secondary} /></mesh><mesh position={[0.11,0.02,0]} scale={[0.06,0.18,0.06]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={palette.secondary} /></mesh></group>;
}

function PopUpBackdrop({ world }: { world: RichNatureWorldDefinition }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const depth = world.scene.depth;
  return (
    <group>
      <mesh position={[0, 1.0, -4.45]} scale={[7.6, 3.2, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.fog} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {depth === 'panorama' || depth === 'horizon' || world.scene.renderCues.includes('mountain') ? <MountainLayer world={world} z={-4} scale={depth === 'panorama' ? 0.82 : 0.62} opacity={0.48} /> : null}
      {world.scene.renderCues.includes('cloud') || world.theme === 'beyond' || world.scene.atmosphere === 'storm' ? <CloudLayer world={world} z={-3.7} y={2.2} count={6} /> : null}
    </group>
  );
}

function CueCluster({ cue, world, index }: { cue: NatureRenderCue; world: RichNatureWorldDefinition; index: number }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const positions = scatter(world.seed + index * 131, 5, 2.6);
  const focal: Vec3 = [index % 2 ? 1.25 : -1.2, -0.48, -0.2 - index * 0.07];
  const flowerColor = hashHue(world.seed + index);

  if (cue === 'pine') return <>{positions.slice(0, 4).map((p, i) => <Tree key={i} position={p} kind="pine" scale={0.58 + (i % 3) * 0.18} tint={palette.secondary} />)}</>;
  if (cue === 'oak' || cue === 'tree') return <>{positions.slice(0, 3).map((p, i) => <Tree key={i} position={p} kind="oak" scale={0.62 + (i % 2) * 0.22} tint={world.collection === 'autumn-harvest' ? '#aa734b' : undefined} />)}</>;
  if (cue === 'bamboo') return <>{positions.slice(0, 4).map((p, i) => <Tree key={i} position={p} kind="bamboo" scale={0.65 + (i % 2) * 0.16} />)}</>;
  if (cue === 'willow') return <Tree position={focal} kind="willow" scale={1.05} />;
  if (cue === 'palm') return <>{positions.slice(0, 3).map((p, i) => <Tree key={i} position={p} kind="palm" scale={0.8 + i * 0.11} />)}</>;
  if (cue === 'fern') return <>{positions.slice(0, 6).map((p, i) => <Fern key={i} position={p} scale={0.65 + (i % 3) * 0.18} />)}</>;
  if (cue === 'flower' || cue === 'sunflower') return <>{positions.slice(0, Math.max(4, Math.round(world.scene.density * 8))).map((p, i) => <Flower key={i} position={p} color={i % 2 ? flowerColor : palette.accent} scale={cue === 'sunflower' ? 1.5 : 0.78 + (i % 3) * 0.12} />)}</>;
  if (cue === 'mushroom') return <>{positions.slice(0, 6).map((p, i) => <Mushroom key={i} position={p} scale={0.65 + (i % 3) * 0.22} glow={world.scene.atmosphere === 'glow'} />)}</>;
  if (cue === 'cactus') return <>{positions.slice(0, 4).map((p, i) => <Cactus key={i} position={p} scale={0.68 + i * 0.12} />)}</>;
  if (cue === 'agave' || cue === 'yucca') return <>{positions.slice(0, 5).map((p, i) => <Cactus key={i} position={p} scale={0.62 + (i % 2) * 0.15} agave />)}</>;
  if (cue === 'crystal' || cue === 'ice') return <>{positions.slice(0, 4).map((p, i) => <CrystalCluster key={i} position={p} scale={0.7 + i * 0.12} color={cue === 'ice' ? '#bde6ef' : hashHue(world.seed + i * 3)} glow={world.scene.atmosphere === 'glow'} />)}</>;
  if (cue === 'coral') return <>{positions.slice(0, 5).map((p, i) => <CoralCluster key={i} position={p} scale={0.65 + i * 0.08} color={i % 2 ? '#c895c9' : '#dc8e9f'} />)}</>;
  if (cue === 'shell') return <>{positions.slice(0, 5).map((p, i) => <ShellCluster key={i} position={p} scale={0.58 + (i % 3) * 0.18} color={i % 2 ? '#eadcc7' : '#cbd8df'} />)}</>;
  if (cue === 'rock' || cue === 'roots' || cue === 'log') return <>{positions.slice(0, 5).map((p, i) => <Rock key={i} position={p} scale={0.45 + (i % 3) * 0.22} color={cue === 'log' ? '#765b42' : palette.secondary} />)}</>;
  if (cue === 'mountain' || cue === 'canyon') return <MountainLayer world={world} z={-2.9} scale={cue === 'canyon' ? 0.64 : 0.72} opacity={0.9} />;
  if (cue === 'river') return <WaterSurface world={world} kind="river" />;
  if (cue === 'lake' || cue === 'pond' || cue === 'water') return <WaterSurface world={world} kind="small" />;
  if (cue === 'ocean') return <WaterSurface world={world} kind="ocean" />;
  if (cue === 'rainbow') return <RainbowArc />;
  if (cue === 'aurora') return <Aurora world={world} />;
  if (cue === 'sun') return <CelestialBody world={world} type="sun" />;
  if (cue === 'moon') return <CelestialBody world={world} type="moon" />;
  if (cue === 'meteor') return <Meteor world={world} />;
  if (cue === 'cave') return (
    <group>
      <mesh position={[-3.2, 1.15, -1.2]} scale={[2.2, 3.4, 2.1]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#2a2930" roughness={1} flatShading /></mesh>
      <mesh position={[3.2, 1.05, -1.15]} scale={[2.2, 3.2, 2.1]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#26262c" roughness={1} flatShading /></mesh>
      <mesh position={[0, 3.65, -1.7]} scale={[4.5, 1.2, 2.4]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#232329" roughness={1} flatShading /></mesh>
    </group>
  );
  if (cue === 'path' || cue === 'bridge') return (
    <mesh position={[0, -0.465, 0.25]} rotation={[-Math.PI / 2, 0, cue === 'path' ? -0.08 : Math.PI / 2]} scale={[cue === 'path' ? 1 : 0.7, cue === 'path' ? 4.1 : 2.1, 1]}>
      <planeGeometry args={[1,1]} /><meshStandardMaterial color={cue === 'path' ? '#88735c' : '#7d6449'} roughness={1} />
    </mesh>
  );
  if (cue === 'web') return (
    <group position={[1.35, 1.0, -0.8]} rotation={[0,0.3,0]}>
      {[0.18,0.32,0.46].map((r) => <mesh key={r}><ringGeometry args={[r-0.006,r,32]} /><meshBasicMaterial color="#dce9e7" transparent opacity={0.5} /></mesh>)}
      {Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2; return <mesh key={i} rotation={[0,0,a]} scale={[0.5,0.006,1]}><planeGeometry args={[1,1]} /><meshBasicMaterial color="#dce9e7" transparent opacity={0.4} /></mesh>;})}
    </group>
  );
  return null;
}

function SceneFloor({ world }: { world: RichNatureWorldDefinition }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  return (
    <group position={[0, -0.52, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.7, 56]} />
        <meshStandardMaterial color={world.terrain === 'ice' ? '#dce9ec' : palette.ground} roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.85, 4.58, 56]} />
        <meshStandardMaterial color={palette.secondary} roughness={0.96} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

export function NatureWorldRenderer({ world }: Props) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const cues = world.scene.renderCues;
  const mainCues = cues.filter((cue) => !['rain','fog','wind','animal','bird','fish','insect','reptile','glow','stars','cloud','lightning'].includes(cue)).slice(0, 6);
  const nightLike = world.scene.atmosphere === 'night' || world.scene.atmosphere === 'glow';
  const stormLike = world.scene.atmosphere === 'storm' || world.scene.atmosphere === 'rain';
  const stars = cues.includes('stars') || nightLike;
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, world.scene.depth === 'macro' ? 5.2 : 6.6, world.scene.depth === 'panorama' ? 15 : 12.5]} />
      <ambientLight intensity={nightLike ? 0.42 : stormLike ? 0.56 : 0.78} />
      <hemisphereLight color={palette.accent} groundColor={palette.ground} intensity={nightLike ? 0.72 : 1.05} />
      <directionalLight position={world.scene.atmosphere === 'sunset' ? [-4,4,2] : [3.5,5.5,3]} intensity={stormLike ? 1 : nightLike ? 0.8 : 1.75} color={world.scene.atmosphere === 'sunset' || world.scene.atmosphere === 'sunrise' ? '#ffd09d' : palette.accent} />
      {world.scene.atmosphere === 'glow' && <pointLight position={[0, 1.3, -0.3]} intensity={5} distance={6} color={palette.glow} />}
      {stars && <Stars radius={40} depth={24} count={world.scene.depth === 'macro' ? 360 : 720} factor={2.2} saturation={0.18} fade speed={0.18} />}

      <SceneFloor world={world} />
      <PopUpBackdrop world={world} />
      {mainCues.map((cue, index) => <CueCluster key={`${cue}-${index}`} cue={cue} world={world} index={index} />)}
      <StylizedWildlife world={world} />
      <WeatherParticles world={world} />

      {world.scene.sparkle > 0.55 && world.scene.atmosphere !== 'night' && (
        <group>
          {scatter(world.seed + 707, 10, 2.8, 0.8).map((p, index) => (
            <mesh key={index} position={[p[0], 0.18 + (index % 5) * 0.34, p[2]]} scale={0.018 + (index % 3) * 0.005}>
              <sphereGeometry args={[1, 6, 6]} />
              <meshBasicMaterial color={palette.glow} transparent opacity={0.52} />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}
