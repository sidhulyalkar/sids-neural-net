'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import {
  NATURE_WORLD_PALETTES,
  type RichNatureWorldDefinition,
} from '@/lib/physiology/natureWorldsExpanded';

type Vec3 = [number, number, number];
type Props = { world: RichNatureWorldDefinition };

function HeroStage({ world, children }: { world: RichNatureWorldDefinition; children: React.ReactNode }) {
  const macro = world.scene.depth === 'macro';
  const vertical = world.scene.depth === 'vertical';
  return <group position={[macro ? 0.72 : 1.25, macro ? -0.26 : -0.42, macro ? -0.05 : -0.1]} scale={macro ? 1.55 : vertical ? 1.12 : 1}>{children}</group>;
}

function Basket() {
  return (
    <group>
      <mesh position={[0,0.17,0]} scale={[0.48,0.24,0.34]}><sphereGeometry args={[1,14,10]} /><meshStandardMaterial color="#9b744e" roughness={0.95} wireframe /></mesh>
      <mesh position={[0,0.5,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.34,0.035,8,24,Math.PI]} /><meshStandardMaterial color="#765339" roughness={1} /></mesh>
      {[-0.18,0,0.18].map((x,i)=><mesh key={x} position={[x,0.24,0]} scale={0.08 + i*0.01}><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={i===0?'#c95d60':i===1?'#6f9356':'#d59a62'} /></mesh>)}
    </group>
  );
}

function Honeycomb() {
  const cells: Vec3[] = [[0,0.35,0],[-0.19,0.2,0],[0.19,0.2,0],[-0.19,0.5,0],[0.19,0.5,0],[0,0.65,0]];
  return <group>{cells.map((p,i)=><mesh key={i} position={p} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.18,0.18,0.07,6]} /><meshStandardMaterial color={i%2?'#d9a844':'#edc465'} emissive="#9f681d" emissiveIntensity={0.15} /></mesh>)}<mesh position={[0.18,-0.02,0]} scale={[0.03,0.26,0.03]}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#e8b84c" transparent opacity={0.8} /></mesh></group>;
}

function Nest() {
  return <group><mesh position={[0,0.14,0]} scale={[0.46,0.14,0.35]}><torusGeometry args={[0.6,0.22,8,20]} /><meshStandardMaterial color="#72583d" roughness={1} /></mesh>{[-0.14,0,0.14].map((x)=><mesh key={x} position={[x,0.31,0]} scale={[0.1,0.13,0.1]}><sphereGeometry args={[1,14,10]} /><meshStandardMaterial color="#9fc6d6" roughness={0.65} /></mesh>)}</group>;
}

function AcornCup() {
  return <group><mesh position={[0,0.18,0]} scale={[0.3,0.23,0.3]}><sphereGeometry args={[1,14,10]} /><meshStandardMaterial color="#90613d" roughness={1} /></mesh><mesh position={[0,0.34,0]} scale={[0.33,0.08,0.33]}><sphereGeometry args={[1,12,8]} /><meshStandardMaterial color="#604a35" roughness={1} /></mesh></group>;
}

function Pumpkin({ pale = false, green = false }: { pale?: boolean; green?: boolean }) {
  const color = pale ? '#e7ddd0' : green ? '#70855f' : '#cf7545';
  return <group>{[-0.16,0,0.16].map((x,i)=><mesh key={x} position={[x,0.25,0]} scale={[0.28,0.25,0.28]}><sphereGeometry args={[1,14,10]} /><meshStandardMaterial color={i===1?color:color} roughness={0.9} /></mesh>)}<mesh position={[0,0.54,0]}><cylinderGeometry args={[0.04,0.055,0.2,6]} /><meshStandardMaterial color="#5d643f" /></mesh></group>;
}

function Apple({ bitten = false }: { bitten?: boolean }) {
  return <group><mesh position={[0,0.25,0]} scale={[0.3,0.28,0.3]}><sphereGeometry args={[1,18,14]} /><meshStandardMaterial color="#b94e4e" roughness={0.8} /></mesh><mesh position={[0,0.55,0]} rotation={[0,0,0.25]}><cylinderGeometry args={[0.025,0.035,0.17,6]} /><meshStandardMaterial color="#5b4936" /></mesh><mesh position={[0.08,0.58,0]} rotation={[0,0,-0.6]} scale={[0.1,0.04,0.05]}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#66865c" /></mesh>{bitten&&<mesh position={[0.24,0.34,0.13]} scale={0.1}><sphereGeometry args={[1,10,10]} /><meshStandardMaterial color="#ead9bd" /></mesh>}</group>;
}

function HayBale() {
  return <group rotation={[0,0,Math.PI/2]}><mesh position={[0,0.28,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.34,0.34,0.62,16]} /><meshStandardMaterial color="#c29b4e" roughness={1} /></mesh>{[-0.18,0.18].map((y)=><mesh key={y} position={[0,0.28,y]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.35,0.02,6,20]} /><meshStandardMaterial color="#8f743e" /></mesh>)}</group>;
}

function Fountain() {
  return <group><mesh position={[0,0.08,0]} scale={[0.48,0.1,0.48]}><cylinderGeometry args={[1,1,1,20]} /><meshStandardMaterial color="#777b74" roughness={0.95} /></mesh><mesh position={[0,0.36,0]}><cylinderGeometry args={[0.08,0.11,0.55,10]} /><meshStandardMaterial color="#858a82" /></mesh><mesh position={[0,0.6,0]} scale={[0.32,0.07,0.32]}><cylinderGeometry args={[1,1,1,20]} /><meshStandardMaterial color="#8b8f87" /></mesh><mesh position={[0,0.48,0]} scale={[0.05,0.34,0.05]}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#8cc4d2" transparent opacity={0.75} /></mesh></group>;
}

function Pot() {
  return <group><mesh position={[0,0.2,0]}><cylinderGeometry args={[0.25,0.18,0.4,12]} /><meshStandardMaterial color="#a66549" roughness={1} /></mesh>{[-0.11,0,0.11].map((x,i)=><mesh key={x} position={[x,0.56,0]} scale={[0.08,0.26,0.04]} rotation={[0,0,(i-1)*0.4]}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#66865f" /></mesh>)}</group>;
}

function GardenGate() {
  return <group>{[-0.46,0.46].map((x)=><mesh key={x} position={[x,0.56,0]}><boxGeometry args={[0.08,1.12,0.08]} /><meshStandardMaterial color="#75614b" /></mesh>)}{[-0.3,-0.1,0.1,0.3].map((x)=><mesh key={x} position={[x,0.47,0]}><boxGeometry args={[0.045,0.82,0.05]} /><meshStandardMaterial color="#8a7254" /></mesh>)}{[0.2,0.62].map((y)=><mesh key={y} position={[0,y,0]}><boxGeometry args={[0.78,0.05,0.05]} /><meshStandardMaterial color="#8a7254" /></mesh>)}</group>;
}

function ZenStones() {
  return <group>{[[0,0.08,0,1],[-0.02,0.27,0,0.72],[0.01,0.42,0,0.48]] .map(([x,y,z,s],i)=><mesh key={i} position={[x,y,z]} scale={[0.3*s,0.16*s,0.24*s]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color={i===0?'#5d6260':i===1?'#767a76':'#8b8e89'} roughness={1} flatShading /></mesh>)}</group>;
}

function Bonsai() {
  return <group><mesh position={[0,0.08,0]}><cylinderGeometry args={[0.28,0.22,0.16,12]} /><meshStandardMaterial color="#6d5441" /></mesh><mesh position={[0,0.48,0]} rotation={[0,0,-0.15]}><cylinderGeometry args={[0.05,0.08,0.7,8]} /><meshStandardMaterial color="#594637" /></mesh>{[[-0.22,0.78,0],[0.18,0.75,0],[0,0.98,0]] as Vec3[]}.map((p,i)=><mesh key={i} position={p} scale={[0.28,0.18,0.25]}><icosahedronGeometry args={[1,1]} /><meshStandardMaterial color={i%2?'#49684d':'#557356'} roughness={1} flatShading /></mesh>)}</group>;
}

function BambooSpout() {
  const drop = useRef<Mesh>(null);
  useFrame(({ clock })=>{if(!drop.current)return; const t=(clock.getElapsedTime()*0.35)%1; drop.current.position.y=0.48-t*0.45; drop.current.scale.setScalar(0.025+Math.sin(t*Math.PI)*0.01);});
  return <group><mesh position={[-0.2,0.42,0]} rotation={[0,0,-0.08]}><cylinderGeometry args={[0.06,0.07,0.85,8]} /><meshStandardMaterial color="#80935e" /></mesh><mesh position={[0.12,0.7,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.055,0.06,0.62,8]} /><meshStandardMaterial color="#879b64" /></mesh><mesh ref={drop} position={[0.43,0.48,0]}><sphereGeometry args={[1,8,8]} /><meshStandardMaterial color="#93cbd3" transparent opacity={0.8} /></mesh></group>;
}

function SeaGlass() {
  const colors=['#8ec5b3','#a4c8dd','#d7b7c8','#d6d1a5'];
  return <group>{[[-0.28,0.08,0],[0,0.05,0.08],[0.25,0.09,-0.02],[-0.08,0.13,-0.12]] as Vec3[]}.map((p,i)=><mesh key={i} position={p} rotation={[0.2,i*0.7,0.1]} scale={[0.16,0.08,0.12]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color={colors[i]} transparent opacity={0.72} roughness={0.2} /></mesh>)}</group>;
}

function Shell({ spiral = false }: { spiral?: boolean }) {
  if (spiral) return <group><mesh position={[0,0.28,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.25,0.11,10,24,Math.PI*1.7]} /><meshStandardMaterial color="#ddb9ad" roughness={0.55} /></mesh><mesh position={[0.18,0.15,0]} rotation={[0,0,-0.55]}><coneGeometry args={[0.13,0.4,12]} /><meshStandardMaterial color="#e5c7bb" /></mesh></group>;
  return <mesh position={[0,0.15,0]} rotation={[Math.PI/2,0.2,0]} scale={[0.48,0.12,0.4]}><sphereGeometry args={[1,18,12]} /><meshStandardMaterial color="#e6d7c7" roughness={0.6} /></mesh>;
}

function Geode({ color }: { color: string }) {
  return <group><mesh position={[0,0.28,0]} scale={[0.48,0.42,0.28]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#57535b" roughness={1} flatShading /></mesh>{[-0.18,0,0.18].map((x,i)=><mesh key={x} position={[x,0.31,0.24]} scale={[0.11,0.26+i*0.05,0.09]}><octahedronGeometry args={[1,0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.25} /></mesh>)}</group>;
}

function Skull() {
  return <group><mesh position={[0,0.34,0]} scale={[0.34,0.3,0.3]}><sphereGeometry args={[1,16,12]} /><meshStandardMaterial color="#d7cdb4" roughness={0.9} /></mesh>{[-0.12,0.12].map((x)=><mesh key={x} position={[x,0.39,0.27]} scale={0.065}><sphereGeometry args={[1,10,10]} /><meshStandardMaterial color="#36322d" /></mesh>)}<mesh position={[0,0.18,0.26]} scale={[0.16,0.11,0.08]}><boxGeometry /><meshStandardMaterial color="#c9bea6" /></mesh></group>;
}

function Observatory() {
  return <group><mesh position={[0,0.2,0]}><cylinderGeometry args={[0.34,0.4,0.4,14]} /><meshStandardMaterial color="#6d7480" /></mesh><mesh position={[0,0.5,0]} rotation={[0,0,0]} scale={[0.38,0.25,0.38]}><sphereGeometry args={[1,18,10,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color="#89929e" /></mesh><mesh position={[0.18,0.74,0]} rotation={[0,0,-0.55]}><cylinderGeometry args={[0.055,0.075,0.65,10]} /><meshStandardMaterial color="#bbc4cb" /></mesh></group>;
}

function Canoe() {
  return <group rotation={[0,0.25,0]}><mesh position={[0,0.12,0]} scale={[0.72,0.12,0.22]}><sphereGeometry args={[1,18,8]} /><meshStandardMaterial color="#7d5d42" roughness={1} /></mesh><mesh position={[0,0.2,0]} scale={[0.55,0.08,0.14]}><sphereGeometry args={[1,14,8]} /><meshStandardMaterial color="#3f5960" /></mesh></group>;
}

function Pier() {
  return <group>{[-0.25,0.25].map((x)=><mesh key={x} position={[x,-0.06,0]}><cylinderGeometry args={[0.04,0.05,0.55,7]} /><meshStandardMaterial color="#66513d" /></mesh>)}{[-0.3,-0.1,0.1,0.3].map((z)=><mesh key={z} position={[0,0.15,z]}><boxGeometry args={[0.7,0.07,0.16]} /><meshStandardMaterial color="#80654b" roughness={1} /></mesh>)}</group>;
}

function Waterfall() {
  const ref=useRef<Mesh>(null); useFrame(({clock})=>{if(!ref.current)return; ref.current.material; ref.current.scale.y=1+Math.sin(clock.getElapsedTime()*1.3)*0.025;});
  return <group><mesh position={[0,0.75,-0.05]} scale={[0.65,1.3,0.18]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#606a67" roughness={1} flatShading /></mesh><mesh ref={ref} position={[0,0.65,0.17]} scale={[0.23,0.75,0.03]}><planeGeometry args={[1,1]} /><meshStandardMaterial color="#9ed0dc" transparent opacity={0.75} /></mesh><mesh position={[0,0.03,0.2]} scale={[0.52,0.05,0.35]}><sphereGeometry args={[1,14,8]} /><meshStandardMaterial color="#afd9df" transparent opacity={0.45} /></mesh></group>;
}

function LeafMacro({ color = '#6f9865' }: { color?: string }) {
  return <group rotation={[0.2,0.2,-0.5]}><mesh position={[0,0.4,0]} scale={[0.42,0.65,0.06]}><sphereGeometry args={[1,18,12]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh><mesh position={[0,0,0]} rotation={[0,0,0.05]}><cylinderGeometry args={[0.015,0.02,0.9,6]} /><meshStandardMaterial color="#55714e" /></mesh></group>;
}

function MacroFlower({ color }: { color: string }) {
  return <group>{Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2; return <mesh key={i} position={[Math.cos(a)*0.22,0.42,Math.sin(a)*0.22]} rotation={[0,-a,0]} scale={[0.2,0.08,0.12]}><sphereGeometry args={[1,12,8]} /><meshStandardMaterial color={color} /></mesh>;})}<mesh position={[0,0.42,0]} scale={0.16}><sphereGeometry args={[1,12,10]} /><meshStandardMaterial color="#dfc56a" /></mesh><mesh position={[0,0.08,0]}><cylinderGeometry args={[0.025,0.035,0.65,7]} /><meshStandardMaterial color="#5e8358" /></mesh></group>;
}

function Planet({ color, scale = 1 }: { color: string; scale?: number }) {
  const group=useRef<Group>(null); useFrame(({clock})=>{if(group.current)group.current.rotation.y=clock.getElapsedTime()*0.08;});
  return <group ref={group} position={[0,0.7,0]} scale={scale}><mesh scale={0.36}><sphereGeometry args={[1,24,18]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.14} roughness={0.75} /></mesh><mesh rotation={[Math.PI/2.5,0.2,0]}><torusGeometry args={[0.52,0.025,8,40]} /><meshStandardMaterial color="#d4c8a3" transparent opacity={0.5} /></mesh></group>;
}

function CloudHero({ dark = false }: { dark?: boolean }) {
  return <group position={[0,0.6,0]}>{([[-0.28,0,0],[0,0.13,0],[0.34,-0.02,0]] as Vec3[]).map((p,i)=><mesh key={i} position={p} scale={[0.45+i*0.08,0.25+i*0.03,0.26]}><sphereGeometry args={[1,14,10]} /><meshStandardMaterial color={dark?'#59616c':'#dce2e2'} roughness={1} /></mesh>)}</group>;
}

export function NatureWorldHero({ world }: Props) {
  const name=world.name.toLowerCase();
  const palette=NATURE_WORLD_PALETTES[world.palette];
  let hero: React.ReactNode = null;

  if (/basket|foraging/.test(name)) hero=<Basket />;
  else if (/honeycomb|honey/.test(name)) hero=<Honeycomb />;
  else if (/nest|robin eggs/.test(name)) hero=<Nest />;
  else if (/acorn cup/.test(name)) hero=<AcornCup />;
  else if (/pumpkin|gourd|squash/.test(name)) hero=<Pumpkin pale={/white|ghost/.test(name)} green={/green|striped/.test(name)} />;
  else if (/apple/.test(name)) hero=<Apple bitten={/half-eaten|core|rotting|worm/.test(name)} />;
  else if (/hay bale/.test(name)) hero=<HayBale />;
  else if (/fountain/.test(name)) hero=<Fountain />;
  else if (/potting|herb pot|terra cotta/.test(name)) hero=<Pot />;
  else if (/garden gate/.test(name)) hero=<GardenGate />;
  else if (/balanced stacked stones|stacked stones|stone garden/.test(name)) hero=<ZenStones />;
  else if (/bonsai/.test(name)) hero=<Bonsai />;
  else if (/bamboo water|water spout|water feature/.test(name)) hero=<BambooSpout />;
  else if (/sea glass/.test(name)) hero=<SeaGlass />;
  else if (/conch|nautilus|whelk|wentletrap|tulip shell|auger shell/.test(name)) hero=<Shell spiral />;
  else if (/shell|sand dollar|oyster|mussel|murex|scallop|limpet|clam|barnacle|urchin/.test(name)) hero=<Shell />;
  else if (/geode|amethyst|quartz|bismuth|malachite|pyrite|azurite|celestite|ruby|emerald|citrine|lapis|fluorite|aquamarine|tourmaline|agate/.test(name)) hero=<Geode color={/amethyst|fluorite/.test(name)?'#a48bd2':/ruby/.test(name)?'#d85b67':/emerald|malachite/.test(name)?'#5dac78':/citrine|pyrite/.test(name)?'#d4b35f':/tourmaline/.test(name)?'#df88b5':palette.accent} />;
  else if (/animal skull/.test(name)) hero=<Skull />;
  else if (/observatory/.test(name)) hero=<Observatory />;
  else if (/canoe/.test(name)) hero=<Canoe />;
  else if (/pier|beaver dam/.test(name)) hero=<Pier />;
  else if (/waterfall|cascade|blowhole/.test(name)) hero=<Waterfall />;
  else if (/single .*leaf|maple leaf|ginkgo leaf|leaf on|transparent .*leaf|mahogany leaf/.test(name)) hero=<LeafMacro color={/red|maple/.test(name)?'#a55d52':/yellow|ginkgo/.test(name)?'#c8ae59':palette.accent} />;
  else if (world.scene.depth==='macro' && /flower|bloom|blossom|peony|orchid|tulip|rose|crocus|poppy|hydrangea|magnolia|daisy|lilac/.test(name)) hero=<MacroFlower color={palette.accent} />;
  else if (/jupiter/.test(name)) hero=<Planet color="#c59b74" scale={1.15} />;
  else if (/mars/.test(name)) hero=<Planet color="#b9654f" scale={0.9} />;
  else if (/venus/.test(name)) hero=<Planet color="#d6c394" scale={0.96} />;
  else if (/cloud|supercell|thunderhead|storm front|overcast|stratus|cumulus|cirrus/.test(name) && world.scene.depth==='macro') hero=<CloudHero dark={/dark|storm|wall|ominous/.test(name)} />;

  if (!hero) return null;
  return <HeroStage world={world}>{hero}</HeroStage>;
}
