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

type DioramaProps = {
  world: NatureWorldDefinition;
};

function rng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededPositions(seed: number, count: number, radius = 2.7, y = -0.48): Vec3[] {
  const random = rng(seed);
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = 0.85 + random() * radius;
    return [Math.cos(angle) * distance, y, Math.sin(angle) * distance - 0.25];
  });
}

function Rock({ position, scale = 1, color = '#6e7472' }: { position: Vec3; scale?: number; color?: string }) {
  return (
    <mesh position={position} scale={[0.28 * scale, 0.18 * scale, 0.23 * scale]} rotation={[0.1, position[0] * 0.19, -0.06]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.98} flatShading />
    </mesh>
  );
}

function LowTree({ position, scale = 1, kind = 'pine', tint }: { position: Vec3; scale?: number; kind?: string; tint?: string }) {
  const trunk = kind === 'bamboo' ? '#6d8050' : '#5e4939';
  if (kind === 'bamboo') {
    return (
      <group position={position} scale={scale}>
        {[-0.14, 0, 0.15].map((x, index) => (
          <group key={x} position={[x, 0, (index - 1) * 0.07]}>
            <mesh position={[0, 0.95, 0]}>
              <cylinderGeometry args={[0.035, 0.045, 1.9, 7]} />
              <meshStandardMaterial color={index % 2 ? '#7e9863' : '#668253'} roughness={0.9} />
            </mesh>
            {[0.55, 1.05, 1.45].map((y, leafIndex) => (
              <mesh key={y} position={[leafIndex % 2 ? 0.18 : -0.16, y, 0]} rotation={[0, 0, leafIndex % 2 ? -0.65 : 0.65]} scale={[0.2, 0.055, 0.07]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color="#74935e" />
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
        <mesh position={[0, 0.68, 0]} rotation={[0, 0, -0.06]}>
          <cylinderGeometry args={[0.1, 0.14, 1.35, 8]} />
          <meshStandardMaterial color={trunk} roughness={1} />
        </mesh>
        <mesh position={[0, 1.48, 0]} scale={[0.8, 0.52, 0.8]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color={tint ?? '#668c67'} roughness={0.95} />
        </mesh>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x, index) => (
          <mesh key={x} position={[x, 0.83 + (index % 2) * 0.12, 0.05]} scale={[0.045, 0.58, 0.045]}>
            <capsuleGeometry args={[1, 1, 4, 7]} />
            <meshStandardMaterial color="#74956e" roughness={0.95} />
          </mesh>
        ))}
      </group>
    );
  }

  if (kind === 'oak' || kind === 'cherry') {
    const crown = kind === 'cherry' ? '#d69db2' : tint ?? '#55765a';
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.11, 0.17, 1.4, 8]} />
          <meshStandardMaterial color={trunk} roughness={1} />
        </mesh>
        {[[-0.25,1.45,0],[0.28,1.42,0.05],[0,1.72,-0.04]] as Vec3[]}.map((p, index) => (
          <mesh key={index} position={p} scale={[0.55, 0.42, 0.5]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={index % 2 ? crown : kind === 'cherry' ? '#c98ca7' : '#607f60'} roughness={0.96} flatShading />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.055, 0.08, 0.9, 7]} />
        <meshStandardMaterial color={trunk} roughness={1} />
      </mesh>
      {[0.75, 1.08, 1.37].map((height, index) => (
        <mesh key={height} position={[0, height, 0]}>
          <coneGeometry args={[0.5 - index * 0.09, 0.7, 8]} />
          <meshStandardMaterial color={tint ?? (index % 2 ? '#315c48' : '#3d6a50')} roughness={0.96} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Fern({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[0,1,2,3,4,5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle)*0.1,0.22,Math.sin(angle)*0.1]} rotation={[0.1,-angle,0.78]} scale={[0.07,0.31,0.03]}>
            <sphereGeometry args={[1,8,7]} />
            <meshStandardMaterial color={index % 2 ? '#67a46b' : '#4f8a5b'} roughness={0.96} />
          </mesh>
        );
      })}
    </group>
  );
}

function Flower({ position, color = '#d9b0c9', scale = 1 }: { position: Vec3; color?: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0,0.16,0]}>
        <cylinderGeometry args={[0.01,0.013,0.32,5]} />
        <meshStandardMaterial color="#5e8758" />
      </mesh>
      {[0,1,2,3,4].map((index) => {
        const a = (index/5)*Math.PI*2;
        return (
          <mesh key={index} position={[Math.cos(a)*0.055,0.34,Math.sin(a)*0.055]} scale={[0.06,0.025,0.04]}>
            <sphereGeometry args={[1,7,7]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
      <mesh position={[0,0.34,0]} scale={0.025}><sphereGeometry args={[1,7,7]} /><meshStandardMaterial color="#edd778" /></mesh>
    </group>
  );
}

function Mushroom({ position, glow = false, scale = 1 }: { position: Vec3; glow?: boolean; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0,0.12,0]}><cylinderGeometry args={[0.035,0.048,0.24,7]} /><meshStandardMaterial color="#dfd6c7" /></mesh>
      <mesh position={[0,0.27,0]} scale={[0.16,0.075,0.16]}><sphereGeometry args={[1,12,8]} /><meshStandardMaterial color={glow ? '#9bdcc2' : '#a96868'} emissive={glow ? '#57cda6' : '#000000'} emissiveIntensity={glow ? 1.8 : 0} roughness={0.8} /></mesh>
    </group>
  );
}

function Reeds({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[-0.12,-0.04,0.05,0.13].map((x,index) => (
        <group key={x} position={[x,0,index%2?0.04:-0.03]}>
          <mesh position={[0,0.28,0]}><cylinderGeometry args={[0.008,0.012,0.56 + index*0.04,5]} /><meshStandardMaterial color="#72865d" /></mesh>
          <mesh position={[0,0.6 + index*0.04,0]} scale={[0.022,0.075,0.022]}><sphereGeometry args={[1,7,7]} /><meshStandardMaterial color="#756347" /></mesh>
        </group>
      ))}
    </group>
  );
}

function Cactus({ position, pricklyPear = false, scale = 1 }: { position: Vec3; pricklyPear?: boolean; scale?: number }) {
  if (pricklyPear) {
    return (
      <group position={position} scale={scale}>
        {[[-.13,.22,0],[.08,.28,.02],[.24,.2,-.02],[0,.52,0]] as Vec3[]}.map((p,index) => (
          <mesh key={index} position={p} scale={[0.15,0.24,0.06]} rotation={[0,0,index%2?.18:-.12]}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color="#5d8a58" roughness={0.9} /></mesh>
        ))}
        <Flower position={[0.2,0.43,0]} color="#dc8a9e" scale={0.55} />
      </group>
    );
  }
  return (
    <group position={position} scale={scale}>
      <mesh position={[0,0.65,0]}><cylinderGeometry args={[0.1,0.13,1.3,9]} /><meshStandardMaterial color="#527d55" roughness={0.92} /></mesh>
      <mesh position={[0.22,0.72,0]} rotation={[0,0,-.7]}><capsuleGeometry args={[0.07,0.35,4,8]} /><meshStandardMaterial color="#5d895d" /></mesh>
      <mesh position={[-0.2,0.48,0]} rotation={[0,0,.75]}><capsuleGeometry args={[0.065,0.28,4,8]} /><meshStandardMaterial color="#5d895d" /></mesh>
    </group>
  );
}

function Sunflower({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0,.55,0]}><cylinderGeometry args={[.018,.024,1.1,6]} /><meshStandardMaterial color="#5b8b52" /></mesh>
      {[0,1,2,3,4,5,6,7].map((index) => {
        const a = (index/8)*Math.PI*2;
        return <mesh key={index} position={[Math.cos(a)*.12,1.08,Math.sin(a)*.12]} scale={[.13,.045,.06]} rotation={[0,-a,0]}><sphereGeometry args={[1,8,7]} /><meshStandardMaterial color="#e4c750" /></mesh>;
      })}
      <mesh position={[0,1.08,0]} scale={.1}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color="#76543b" /></mesh>
    </group>
  );
}

function Coral({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {[-.18,0,.18].map((x,index) => (
        <mesh key={x} position={[x,.18 + index*.07,0]} scale={[.06,.35 + index*.08,.06]} rotation={[0,0,(index-1)*.18]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={index===0?'#d88986':index===1?'#d5a0c9':'#e1b16d'} roughness={.75} /></mesh>
      ))}
    </group>
  );
}

function LilyPad({ position, color = '#568a61' }: { position: Vec3; color?: string }) {
  return <mesh position={position} rotation={[-Math.PI/2,0,.3]} scale={[.23,.23,.04]}><circleGeometry args={[1,16]} /><meshStandardMaterial color={color} roughness={.85} /></mesh>;
}

function Log({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return <mesh position={position} rotation={[0,0,Math.PI/2]} scale={scale}><cylinderGeometry args={[.13,.16,1.2,8]} /><meshStandardMaterial color="#66503e" roughness={1} /></mesh>;
}

function SpiderWeb({ position }: { position: Vec3 }) {
  return (
    <group position={position} rotation={[0,.2,0]}>
      {[.16,.3,.44,.58].map((radius) => <mesh key={radius} rotation={[0,0,0]}><ringGeometry args={[radius-.006,radius+.006,28]} /><meshBasicMaterial color="#d8e4e4" transparent opacity={.38} /></mesh>)}
      {[0,1,2,3,4,5,6,7].map((index) => <mesh key={index} rotation={[0,0,(index/8)*Math.PI*2]} position={[0,.29,0]} scale={[.008,.58,.008]}><boxGeometry /><meshBasicMaterial color="#d8e4e4" transparent opacity={.28} /></mesh>)}
    </group>
  );
}

function Campfire({ position }: { position: Vec3 }) {
  const flame = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.getElapsedTime();
    const s = .9 + Math.sin(t*8.3)*.08 + Math.sin(t*13.7)*.05;
    flame.current.scale.set(.14*s,.28*s,.14*s);
  });
  return (
    <group position={position}>
      <mesh rotation={[0,0,Math.PI/2]} position={[0,.07,0]}><cylinderGeometry args={[.045,.05,.48,7]} /><meshStandardMaterial color="#5c4032" /></mesh>
      <mesh rotation={[Math.PI/2,0,Math.PI/2]} position={[0,.07,0]}><cylinderGeometry args={[.045,.05,.48,7]} /><meshStandardMaterial color="#6a4936" /></mesh>
      <mesh ref={flame} position={[0,.3,0]} scale={[.14,.28,.14]}><coneGeometry args={[1,2,8]} /><meshStandardMaterial color="#ffd079" emissive="#ff742f" emissiveIntensity={2.4} /></mesh>
      <pointLight position={[0,.55,0]} intensity={6} distance={3.6} color="#ff9b52" />
    </group>
  );
}

function Mountain({ position, scale = 1, snow = false, color = '#667b82' }: { position: Vec3; scale?: number; snow?: boolean; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh><coneGeometry args={[1.2,2.45,5]} /><meshStandardMaterial color={color} roughness={1} flatShading /></mesh>
      {snow && <mesh position={[0,.75,0]} scale={[.58,.38,.58]}><coneGeometry args={[1.15,2.2,5]} /><meshStandardMaterial color="#e7eff1" roughness={.96} flatShading /></mesh>}
    </group>
  );
}

function Cloud({ position, scale = 1, storm = false }: { position: Vec3; scale?: number; storm?: boolean }) {
  const color = storm ? '#65707b' : '#d7e3e1';
  return (
    <group position={position} scale={scale}>
      {[[-.3,0,0],[0,.08,0],[.32,0,0],[.08,-.08,.05]] as Vec3[]}.map((p,index) => (
        <mesh key={index} position={p} scale={[.42,.28,.32]}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={color} transparent opacity={storm?.8:.72} roughness={1} /></mesh>
      ))}
    </group>
  );
}

function Rainbow({ position = [0,1.8,-3.6] as Vec3 }: { position?: Vec3 }) {
  const colors = ['#e88b8b','#efb777','#e6d77f','#8ec89c','#80b7d1','#a99ad4'];
  return (
    <group position={position} rotation={[0,0,0]}>
      {colors.map((color,index) => (
        <mesh key={color} rotation={[0,0,0]}>
          <torusGeometry args={[2.15-index*.11,.045,8,42,Math.PI]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.18} transparent opacity={.72} />
        </mesh>
      ))}
    </group>
  );
}

function Aurora() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(clock.getElapsedTime()*.2)*.04;
  });
  return (
    <group ref={ref} position={[0,2.4,-4.2]}>
      {[-.65,0,.65].map((x,index) => (
        <mesh key={x} position={[x,index===1?.2:0,0]} rotation={[0,0,(index-1)*.12]} scale={[.5,1.5,1]}>
          <planeGeometry args={[1,1.6,1,1]} />
          <meshBasicMaterial color={index===1?'#7ce0b4':'#8b9ee3'} transparent opacity={.2} />
        </mesh>
      ))}
    </group>
  );
}

function Meteor({ phase = 0 }: { phase?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime()*.24 + phase) % 1;
    ref.current.position.set(-3 + t*6, 3.2 - t*1.5, -4.6);
  });
  return (
    <group ref={ref}>
      <mesh scale={.045}><sphereGeometry args={[1,8,8]} /><meshBasicMaterial color="#ffe6bd" /></mesh>
      <mesh position={[-.22,.06,0]} rotation={[0,0,-.26]} scale={[.34,.012,.012]}><boxGeometry /><meshBasicMaterial color="#f2b487" transparent opacity={.55} /></mesh>
    </group>
  );
}

function DustDevil() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime()*1.9; });
  return (
    <group ref={ref} position={[1.5,.2,-1.7]}>
      {[0,.18,.36,.54,.72].map((y,index) => <mesh key={y} position={[0,y,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.28-index*.035,.015,5,18]} /><meshBasicMaterial color="#c7a079" transparent opacity={.45-index*.05} /></mesh>)}
    </group>
  );
}

function Waterfall() {
  return (
    <group position={[1.6,.38,-2.2]}>
      <Rock position={[0,-.3,0]} scale={2.4} color="#697678" />
      <mesh position={[0,.25,.3]} scale={[.35,1.35,.06]}><planeGeometry args={[1,1]} /><meshStandardMaterial color="#9fd9e2" emissive="#4c9eb5" emissiveIntensity={.18} transparent opacity={.78} /></mesh>
      <mesh position={[0,-.38,.38]} rotation={[-Math.PI/2,0,0]} scale={[.7,.42,1]}><circleGeometry args={[1,20]} /><meshStandardMaterial color="#78b7c6" transparent opacity={.7} /></mesh>
    </group>
  );
}

function Arch() {
  return (
    <group position={[0,.3,-2.55]} scale={1.2}>
      <mesh position={[-.62,.48,0]} scale={[.42,1.25,.5]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#9b5e45" roughness={1} flatShading /></mesh>
      <mesh position={[.62,.48,0]} scale={[.42,1.25,.5]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#9b5e45" roughness={1} flatShading /></mesh>
      <mesh position={[0,1.26,0]} scale={[.95,.38,.48]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#a8684c" roughness={1} flatShading /></mesh>
    </group>
  );
}

function GenericWildlife({ species, position, phase }: { species: string; position: Vec3; phase: number }) {
  const group = useRef<Group>(null);
  const flying = ['bat','owl','eagle','butterfly','bee','dolphin'].includes(species);
  const tiny = ['ladybug','snail','caterpillar','crab','frog','scorpion','lizard'].includes(species);
  const aquatic = ['fish','turtle','otter','swan','duck','penguin','dolphin'].includes(species);
  const colors: Record<string,string> = {
    deer:'#9a7657', squirrel:'#a87852', bat:'#4b4652', fox:'#b96f4a', owl:'#887762', bear:'#6f5847', turtle:'#6d8d63', otter:'#775c48', swan:'#e5e5df', frog:'#6b9a5d', fish:'#73abc1', crab:'#b46a59', dolphin:'#6f9bab', penguin:'#38434d', duck:'#8e9260', goat:'#aaa28d', eagle:'#6d5844', sheep:'#d6d1c0', husky:'#75828c', butterfly:'#c79ac9', bee:'#d4b14f', bunny:'#b9aaa0', ladybug:'#ba5e58', snail:'#91836b', caterpillar:'#79a260', lizard:'#879160', scorpion:'#7e6853'
  };
  const color = colors[species] ?? '#9a866e';
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime()+phase;
    group.current.position.y = position[1] + (flying ? .45 + Math.sin(t*1.4)*.12 : tiny ? .05 : .18 + Math.sin(t*.9)*.025);
    group.current.rotation.y = Math.sin(t*.45)*.35;
    if (flying) group.current.position.x = position[0] + Math.sin(t*.55)*.35;
  });
  const scale = tiny ? .35 : species === 'bear' ? 1.15 : .72;
  return (
    <group ref={group} position={position} scale={scale}>
      <mesh scale={aquatic ? [.32,.16,.18] : [.28,.22,.2]}><sphereGeometry args={[1,12,9]} /><meshStandardMaterial color={color} roughness={.9} /></mesh>
      <mesh position={[.28,.12,.02]} scale={[.16,.15,.15]}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={color} roughness={.9} /></mesh>
      {!aquatic && !flying && !tiny && <>
        <mesh position={[-.13,-.25,.08]} scale={[.055,.22,.055]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[.14,-.25,.08]} scale={[.055,.22,.055]}><capsuleGeometry args={[1,1,4,7]} /><meshStandardMaterial color={color} /></mesh>
      </>}
      {flying && <>
        <mesh position={[-.27,.03,0]} rotation={[0,0,.42]} scale={[.28,.055,.12]}><sphereGeometry args={[1,9,7]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[.27,.03,0]} rotation={[0,0,-.42]} scale={[.28,.055,.12]}><sphereGeometry args={[1,9,7]} /><meshStandardMaterial color={color} /></mesh>
      </>}
      {['deer','goat','bunny','fox','husky'].includes(species) && <>
        <mesh position={[.21,.31,.05]} rotation={[0,0,.35]} scale={[.05,.14,.04]}><coneGeometry args={[1,1.8,6]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[.36,.31,.05]} rotation={[0,0,-.35]} scale={[.05,.14,.04]}><coneGeometry args={[1,1.8,6]} /><meshStandardMaterial color={color} /></mesh>
      </>}
      <mesh position={[.34,.14,.14]} scale={.025}><sphereGeometry args={[1,7,7]} /><meshStandardMaterial color="#172027" /></mesh>
    </group>
  );
}

function ParticleWeather({ kind, seed }: { kind: 'snow' | 'rain' | 'petals' | 'glow'; seed: number }) {
  const group = useRef<Group>(null);
  const particles = useMemo(() => seededPositions(seed, kind === 'rain' ? 34 : 24, 3.4, 0), [seed, kind]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = -((clock.getElapsedTime() * (kind === 'rain' ? 1.4 : .35)) % 1.1);
    group.current.rotation.y = kind === 'petals' ? clock.getElapsedTime()*.04 : 0;
  });
  const color = kind === 'snow' ? '#f3fbff' : kind === 'rain' ? '#acd4dc' : kind === 'petals' ? '#e9b6c6' : '#d9ff9c';
  return (
    <group ref={group}>
      {particles.map((p,index) => (
        <mesh key={index} position={[p[0], 1.1 + (index%5)*.62, p[2]]} scale={kind === 'rain' ? [.012,.18,.012] : [.025,.025,.025]}>
          {kind === 'rain' ? <boxGeometry /> : <sphereGeometry args={[1,6,6]} />}
          <meshBasicMaterial color={color} transparent opacity={kind === 'glow' ? .7 : .5} />
        </mesh>
      ))}
    </group>
  );
}

function Terrain({ world }: DioramaProps) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const waterLike = ['shore','reef','lake','river','wetland','ice'].includes(world.terrain);
  const snowy = world.terrain === 'snow' || world.terrain === 'ice';
  const desert = world.terrain === 'desert' || world.terrain === 'canyon';
  return (
    <group>
      <mesh position={[0,-.52,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[4.75,64]} />
        <meshStandardMaterial color={snowy ? '#dce7ea' : desert ? palette.ground : palette.ground} roughness={.96} />
      </mesh>
      <mesh position={[0,-.555,0]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[3.9,4.58,64]} />
        <meshStandardMaterial color={palette.secondary} roughness={.98} transparent opacity={.58} />
      </mesh>
      {waterLike && (
        <mesh position={[0,-.45, world.terrain === 'river' ? -1.55 : -2.2]} rotation={[-Math.PI/2,0,world.terrain === 'river' ? -.12 : 0]} scale={world.terrain === 'river' ? [1.25,3.8,1] : [5.8,3.9,1]}>
          <planeGeometry args={[1,1]} />
          <meshStandardMaterial color={palette.water} roughness={.3} metalness={.12} transparent opacity={.88} />
        </mesh>
      )}
      {world.terrain === 'reef' && <mesh position={[0,-.1,-1.8]} scale={[6,2.1,1]}><planeGeometry args={[1,1]} /><meshStandardMaterial color={palette.water} transparent opacity={.25} /></mesh>}
      {world.terrain === 'cave' && <>
        <mesh position={[-3.15,1.2,-1.3]} scale={[2.2,3.4,2.1]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#2b2b31" roughness={1} flatShading /></mesh>
        <mesh position={[3.15,1.05,-1.2]} scale={[2.3,3.1,2.1]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#27272d" roughness={1} flatShading /></mesh>
        <mesh position={[0,3.75,-1.8]} scale={[4.5,1.3,2.6]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#24242a" roughness={1} flatShading /></mesh>
      </>}
      {(world.terrain === 'mountain' || world.terrain === 'snow' || world.terrain === 'hill') && <>
        <Mountain position={[-2.8,.12,-4]} scale={1.28} snow={snowy} color={palette.secondary} />
        <Mountain position={[.25,-.2,-5.15]} scale={1.68} snow={snowy} color={palette.secondary} />
        <Mountain position={[3.05,.02,-4.4]} scale={1.28} snow={snowy} color={palette.secondary} />
      </>}
      {world.terrain === 'canyon' && <>
        <mesh position={[-3,1.15,-2.4]} scale={[1.8,2.4,1.4]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#9a684e" roughness={1} flatShading /></mesh>
        <mesh position={[3,1.0,-2.2]} scale={[1.9,2.25,1.5]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#a97152" roughness={1} flatShading /></mesh>
      </>}
      {world.terrain === 'volcanic' && <Mountain position={[0,.1,-4.3]} scale={1.75} color="#4b4645" />}
    </group>
  );
}

function FeatureLayer({ world }: DioramaProps) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const positions = useMemo(() => seededPositions(world.seed, 18), [world.seed]);
  const features = new Set(world.features);
  const hasAny = (...names: string[]) => names.some((name) => features.has(name));
  const treeKind = hasAny('bamboo') ? 'bamboo' : hasAny('willow') ? 'willow' : hasAny('oak','hollow','cherry') ? (hasAny('cherry') ? 'cherry' : 'oak') : 'pine';
  const treeCount = hasAny('pine','oak','bamboo','willow','cherry','hollow','forest') ? 5 : world.terrain === 'forest' ? 4 : 0;
  const flowerCount = hasAny('flowers','tulips','lavender','dandelions','clover','roses','berries','petals') ? 9 : world.terrain === 'meadow' || world.terrain === 'garden' ? 5 : 0;
  return (
    <group>
      {Array.from({ length: treeCount }, (_, index) => <LowTree key={`tree-${index}`} position={positions[index]} scale={.62 + (index%3)*.14} kind={treeKind} tint={hasAny('autumn','leaves') ? (index%2 ? '#a86b45' : '#c18a51') : undefined} />)}
      {hasAny('ferns','moss') && positions.slice(6,11).map((p,index) => <Fern key={`fern-${index}`} position={p} scale={.8 + (index%2)*.25} />)}
      {flowerCount > 0 && positions.slice(5,5+flowerCount).map((p,index) => <Flower key={`flower-${index}`} position={p} color={hasAny('lavender') ? '#a993c7' : hasAny('tulips') ? ['#d98fa0','#d8b36d','#b792c9'][index%3] : hasAny('roses') ? '#c47784' : ['#d6a1bd','#d4c278','#9dc0d6'][index%3]} scale={hasAny('tulips') ? 1.25 : .8} />)}
      {hasAny('mushrooms') && positions.slice(3,10).map((p,index) => <Mushroom key={`mush-${index}`} position={p} glow={hasAny('glow')} scale={.7 + (index%3)*.16} />)}
      {hasAny('sunflowers') && positions.slice(4,11).map((p,index) => <Sunflower key={`sun-${index}`} position={p} scale={.72 + (index%2)*.18} />)}
      {hasAny('cactus') && positions.slice(4,9).map((p,index) => <Cactus key={`cactus-${index}`} position={p} scale={.7 + index*.06} />)}
      {hasAny('prickly-pear') && positions.slice(4,9).map((p,index) => <Cactus key={`pear-${index}`} position={p} pricklyPear scale={.75 + index*.04} />)}
      {hasAny('reeds','marsh','delta') && positions.slice(5,12).map((p,index) => <Reeds key={`reeds-${index}`} position={p} scale={.7 + (index%3)*.14} />)}
      {hasAny('coral','reef') && positions.slice(5,12).map((p,index) => <Coral key={`coral-${index}`} position={[p[0],-.44,p[2]-1.2]} scale={.65 + (index%3)*.16} />)}
      {hasAny('lily-pads','pond','lagoon') && positions.slice(5,12).map((p,index) => <LilyPad key={`lily-${index}`} position={[p[0]*.7,-.4,p[2]-1.2]} color={index%2?'#648f66':'#527b59'} />)}
      {hasAny('rocks','boulder','granite','ledge','ridge','peak','pass','world-edge') && positions.slice(4,11).map((p,index) => <Rock key={`rock-${index}`} position={p} scale={hasAny('boulder') && index===0 ? 2.7 : .6 + (index%3)*.22} color={palette.secondary} />)}
      {hasAny('log') && <Log position={[-.75,-.35,-.55]} scale={1.1} />}
      {hasAny('web') && <SpiderWeb position={[1.35,1.1,-.85]} />}
      {hasAny('campfire','camp') && <Campfire position={[1.35,-.45,.25]} />}
      {hasAny('waterfall') && <Waterfall />}
      {hasAny('red-arch') && <Arch />}
      {hasAny('garden-wall') && <>
        <mesh position={[-2,.12,-1.5]} scale={[.25,.75,2]}><boxGeometry /><meshStandardMaterial color="#76716a" roughness={1} /></mesh>
        <mesh position={[2,.12,-1.5]} scale={[.25,.75,2]}><boxGeometry /><meshStandardMaterial color="#76716a" roughness={1} /></mesh>
      </>}
      {hasAny('tall-grass','wheat','grass','field') && positions.slice(3,15).map((p,index) => <mesh key={`grass-${index}`} position={[p[0],-.21,p[2]]} scale={[.025,.32 + (index%3)*.09,.025]}><capsuleGeometry args={[1,1,3,5]} /><meshStandardMaterial color={hasAny('wheat') ? '#c7ad63' : '#719260'} /></mesh>)}
      {hasAny('shells') && positions.slice(4,12).map((p,index) => <mesh key={`shell-${index}`} position={[p[0],-.43,p[2]]} rotation={[-Math.PI/2,0,index*.7]} scale={[.08,.06,.03]}><torusGeometry args={[1,.28,5,12,Math.PI*1.5]} /><meshStandardMaterial color={index%2?'#d9b5ac':'#e3d3bd'} /></mesh>)}
      {hasAny('acorns','berries','grapes') && positions.slice(4,12).map((p,index) => <mesh key={`fruit-${index}`} position={[p[0],-.38,p[2]]} scale={.055}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color={hasAny('berries')?'#ad4f58':hasAny('grapes')?'#80628c':'#8a6847'} /></mesh>)}
      {hasAny('rainbow') && <Rainbow />}
      {hasAny('aurora') && <Aurora />}
      {hasAny('meteor') && <><Meteor phase={.1} /><Meteor phase={.58} /></>}
      {hasAny('dust-devil') && <DustDevil />}
      {hasAny('clouds') && <><Cloud position={[-2.2,2.5,-4]} scale={1.1} storm={hasAny('thunder')} /><Cloud position={[2.1,2.1,-4.5]} scale={.9} storm={hasAny('thunder')} /></>}
      {hasAny('snow','powder','snowdrift') && <ParticleWeather kind="snow" seed={world.seed+31} />}
      {hasAny('rain') && <ParticleWeather kind="rain" seed={world.seed+41} />}
      {hasAny('petals','cherry') && <ParticleWeather kind="petals" seed={world.seed+47} />}
      {hasAny('glow','bioluminescent') && <ParticleWeather kind="glow" seed={world.seed+53} />}
    </group>
  );
}

function WildlifeLayer({ world }: DioramaProps) {
  const positions = useMemo(() => seededPositions(world.seed + 109, Math.max(2, world.wildlife.length * 2), 2.1, -.44), [world.seed, world.wildlife.length]);
  return (
    <group>
      {world.wildlife.map((species,index) => <GenericWildlife key={`${species}-${index}`} species={species} position={positions[index] ?? [1.4,-.44,-1]} phase={world.seed*.001 + index*1.7} />)}
    </group>
  );
}

export function NatureWorldDiorama({ world }: DioramaProps) {
  const features = new Set(world.features);
  const night = world.palette === 'sky-night' || world.palette === 'sky-aurora' || features.has('stars') || features.has('twilight');
  return (
    <group>
      {night && <Stars radius={36} depth={18} count={features.has('milky-way') ? 1250 : 650} factor={features.has('milky-way') ? 2.6 : 2} saturation={.18} fade speed={.2} />}
      <Terrain world={world} />
      <FeatureLayer world={world} />
      <WildlifeLayer world={world} />
    </group>
  );
}
