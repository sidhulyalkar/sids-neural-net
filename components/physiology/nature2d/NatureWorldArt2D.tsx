'use client';

import type {
  NatureRenderCue,
  RichNatureWorldDefinition,
} from '@/lib/physiology/natureWorldsExpanded';
import { NATURE_WORLD_PALETTES } from '@/lib/physiology/natureWorldsExpanded';

type Props = {
  world: RichNatureWorldDefinition;
  pointerX: number;
  pointerY: number;
};

type XY = [number, number];

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function points(seed: number, count: number, minX: number, maxX: number, minY: number, maxY: number): XY[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => [
    minX + random() * (maxX - minX),
    minY + random() * (maxY - minY),
  ]);
}

function has(cues: NatureRenderCue[], ...needles: NatureRenderCue[]): boolean {
  return needles.some((cue) => cues.includes(cue));
}

function Mountains({ color, accent, seed, snow }: { color: string; accent: string; seed: number; snow: boolean }) {
  const random = seededRandom(seed);
  const peaks = Array.from({ length: 5 }, (_, index) => ({
    x: -80 + index * 320 + random() * 120,
    y: 345 - random() * 125,
    w: 290 + random() * 180,
  }));
  return (
    <g>
      {peaks.map((peak, index) => (
        <g key={index} opacity={0.55 + index * 0.06}>
          <path d={`M ${peak.x} 485 L ${peak.x + peak.w * 0.5} ${peak.y} L ${peak.x + peak.w} 485 Z`} fill={color} />
          {snow && <path d={`M ${peak.x + peak.w * 0.28} ${peak.y + (485 - peak.y) * 0.43} L ${peak.x + peak.w * 0.5} ${peak.y} L ${peak.x + peak.w * 0.7} ${peak.y + (485 - peak.y) * 0.4} L ${peak.x + peak.w * 0.57} ${peak.y + 46} L ${peak.x + peak.w * 0.48} ${peak.y + 28} L ${peak.x + peak.w * 0.4} ${peak.y + 54} Z`} fill={accent} opacity="0.8" />}
        </g>
      ))}
    </g>
  );
}

function CloudBank({ color, seed, storm }: { color: string; seed: number; storm: boolean }) {
  return (
    <g opacity={storm ? 0.72 : 0.46}>
      {points(seed, storm ? 7 : 5, 70, 1130, 70, 245).map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${0.8 + (index % 3) * 0.18})`}>
          <ellipse cx="0" cy="8" rx="66" ry="25" fill={color} />
          <circle cx="-34" cy="0" r="28" fill={color} />
          <circle cx="4" cy="-13" r="39" fill={color} />
          <circle cx="43" cy="3" r="30" fill={color} />
        </g>
      ))}
    </g>
  );
}

function Pine({ x, y, scale, color, trunk, frost }: { x: number; y: number; scale: number; color: string; trunk: string; frost: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-8" y="-105" width="16" height="110" rx="7" fill={trunk} />
      <path d="M 0 -190 L -72 -83 L 72 -83 Z" fill={color} />
      <path d="M 0 -150 L -66 -50 L 66 -50 Z" fill={color} opacity="0.94" />
      <path d="M 0 -112 L -55 -18 L 55 -18 Z" fill={color} opacity="0.9" />
      {frost && <path d="M 0 -190 L -33 -141 L -8 -148 L 8 -134 L 35 -139 Z" fill="#eef9fc" opacity="0.82" />}
    </g>
  );
}

function BroadTree({ x, y, scale, color, trunk, blossom }: { x: number; y: number; scale: number; color: string; trunk: string; blossom: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M -14 0 C -16 -90 -6 -125 -22 -175 C 15 -149 12 -104 19 -61 L 26 0 Z" fill={trunk} />
      {[[0,-182,74],[-56,-145,58],[62,-145,61],[-18,-112,60]].map(([cx, cy, r], index) => (
        <circle key={index} cx={cx} cy={cy} r={r} fill={blossom ? (index % 2 ? '#dca8bc' : '#efc6d4') : color} opacity={0.94 - index * 0.05} />
      ))}
      {blossom && points(Math.round(x * 9 + y), 8, -92, 92, -210, -90).map(([px, py], index) => <circle key={index} cx={px} cy={py} r="4" fill="#ffe7ef" opacity="0.75" />)}
    </g>
  );
}

function Bamboo({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[-20, 0, 23].map((offset, index) => (
        <g key={offset} transform={`translate(${offset} 0)`}>
          <rect x="-5" y="-205" width="10" height="210" rx="4" fill={index % 2 ? '#738e59' : color} />
          {[-155, -103, -54].map((leafY, leafIndex) => <ellipse key={leafY} cx={leafIndex % 2 ? 26 : -26} cy={leafY} rx="29" ry="7" transform={`rotate(${leafIndex % 2 ? -28 : 28} ${leafIndex % 2 ? 26 : -26} ${leafY})`} fill="#7e9c65" />)}
        </g>
      ))}
    </g>
  );
}

function Palm({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M -7 0 Q -25 -105 8 -180" fill="none" stroke="#7c5d43" strokeWidth="15" strokeLinecap="round" />
      {[-80,-45,-12,18,48,78].map((angle) => <path key={angle} d="M 7 -181 Q 77 -204 112 -168 Q 56 -171 10 -178" fill={color} transform={`rotate(${angle} 7 -181)`} opacity="0.93" />)}
    </g>
  );
}

function Cactus({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-18" y="-125" width="36" height="128" rx="18" fill={color} />
      <path d="M -12 -78 Q -57 -92 -55 -49 L -55 -24" fill="none" stroke={color} strokeWidth="27" strokeLinecap="round" />
      <path d="M 12 -93 Q 55 -112 54 -69 L 54 -44" fill="none" stroke={color} strokeWidth="25" strokeLinecap="round" />
      <path d="M -8 -116 L -8 -8 M 7 -116 L 7 -8" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
    </g>
  );
}

function Grass({ seed, color, y, count = 28 }: { seed: number; color: string; y: number; count?: number }) {
  return (
    <g opacity="0.72">
      {points(seed, count, 0, 1200, y - 18, y + 18).map(([x, py], index) => (
        <path key={index} d={`M ${x} ${py} Q ${x + (index % 2 ? 9 : -9)} ${py - 29 - (index % 5) * 4} ${x + (index % 3 - 1) * 6} ${py - 47 - (index % 4) * 5}`} fill="none" stroke={color} strokeWidth={2 + (index % 2)} strokeLinecap="round" />
      ))}
    </g>
  );
}

function Flowers({ seed, color, y, count = 19 }: { seed: number; color: string; y: number; count?: number }) {
  const flowerColors = [color, '#e9c7d8', '#efdd99', '#a9cce0', '#d3b4dc'];
  return (
    <g>
      {points(seed, count, 45, 1155, y - 38, y + 22).map(([x, py], index) => (
        <g key={index} transform={`translate(${x} ${py}) scale(${0.55 + (index % 4) * 0.12})`}>
          <path d="M 0 0 L 0 -28" stroke="#668159" strokeWidth="3" />
          {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-34" rx="8" ry="4" transform={`rotate(${angle} 0 -34) translate(8 0)`} fill={flowerColors[index % flowerColors.length]} />)}
          <circle cx="0" cy="-34" r="4" fill="#e6c96b" />
        </g>
      ))}
    </g>
  );
}

function Mushrooms({ seed, glow, y }: { seed: number; glow: string; y: number }) {
  return (
    <g>
      {points(seed, 10, 80, 1120, y - 22, y + 20).map(([x, py], index) => {
        const scale = 0.55 + (index % 4) * 0.12;
        return (
          <g key={index} transform={`translate(${x} ${py}) scale(${scale})`}>
            <rect x="-5" y="-30" width="10" height="31" rx="5" fill="#eadfca" />
            <path d="M -24 -28 Q 0 -58 24 -28 Q 19 -18 0 -18 Q -19 -18 -24 -28 Z" fill={index % 3 === 0 ? '#b86063' : glow} opacity={index % 3 === 0 ? 0.94 : 0.72} />
            {index % 3 !== 0 && <circle cx="0" cy="-30" r="34" fill={glow} opacity="0.08" />}
          </g>
        );
      })}
    </g>
  );
}

function Rocks({ seed, color, y, crystal }: { seed: number; color: string; y: number; crystal: boolean }) {
  return (
    <g>
      {points(seed, crystal ? 12 : 8, 55, 1145, y - 20, y + 30).map(([x, py], index) => crystal ? (
        <path key={index} d={`M ${x - 10} ${py} L ${x - 5} ${py - 40 - (index % 4) * 8} L ${x + 7} ${py - 52 - (index % 3) * 9} L ${x + 13} ${py} Z`} fill={index % 2 ? color : '#c9eef4'} opacity={0.55 + (index % 3) * 0.12} />
      ) : (
        <ellipse key={index} cx={x} cy={py} rx={18 + (index % 4) * 6} ry={10 + (index % 3) * 4} fill={color} opacity="0.8" />
      ))}
    </g>
  );
}

function Water({ water, glow, y, ocean }: { water: string; glow: string; y: number; ocean: boolean }) {
  return (
    <g>
      <path d={`M 0 ${y} Q 210 ${y - 16} 420 ${y} T 840 ${y} T 1260 ${y} L 1260 760 L 0 760 Z`} fill={water} opacity="0.86" />
      {[0,1,2,3].map((index) => (
        <path key={index} d={`M ${80 + index * 260} ${y + 35 + index * 14} Q ${150 + index * 260} ${y + 22 + index * 14} ${225 + index * 260} ${y + 34 + index * 14}`} fill="none" stroke={glow} strokeWidth={ocean ? 5 : 3} strokeLinecap="round" opacity={0.18 + index * 0.04} />
      ))}
    </g>
  );
}

function Rainbow({ y }: { y: number }) {
  const colors = ['#f3a7a7','#efc37e','#ece59a','#9ed8b6','#93cce5','#c4a7e3'];
  return (
    <g opacity="0.56">
      {colors.map((color, index) => <path key={color} d={`M 300 ${y + index * 7} Q 600 ${y - 305 + index * 7} 900 ${y + index * 7}`} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" />)}
    </g>
  );
}

function Aurora({ color, glow }: { color: string; glow: string }) {
  return (
    <g opacity="0.5">
      {[0,1,2].map((index) => <path key={index} d={`M -30 ${120 + index * 45} C 210 ${20 + index * 28}, 350 ${210 + index * 34}, 585 ${95 + index * 20} S 980 ${55 + index * 30}, 1240 ${150 + index * 44}`} fill="none" stroke={index === 1 ? glow : color} strokeWidth={30 - index * 6} strokeLinecap="round" opacity={0.5 - index * 0.1} />)}
    </g>
  );
}

function HeroSubject({ world }: { world: RichNatureWorldDefinition }) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const name = world.name.toLowerCase();
  const focal = world.scene.focalSubject.toLowerCase();
  const macro = world.scene.depth === 'macro';
  const x = macro ? 650 : 820;
  const y = macro ? 465 : 505;
  const scale = macro ? 1.55 : 1;

  if (/honeycomb/.test(name)) {
    return <g transform={`translate(${x} ${y - 80}) scale(${scale})`}>{[[-32,0],[0,-19],[32,0],[-32,38],[0,19],[32,38]].map(([cx,cy],i)=><polygon key={i} points={`${cx-18},${cy} ${cx-9},${cy-16} ${cx+9},${cy-16} ${cx+18},${cy} ${cx+9},${cy+16} ${cx-9},${cy+16}`} fill={i%2?'#d9a844':'#efc766'} stroke="#a97831" strokeWidth="3" />)}<path d="M 33 50 Q 45 75 33 99" stroke="#e6b64e" strokeWidth="7" strokeLinecap="round" /></g>;
  }
  if (/nest|egg/.test(name)) {
    return <g transform={`translate(${x} ${y - 20}) scale(${scale})`}><ellipse cx="0" cy="0" rx="72" ry="24" fill="#70553d" /><path d="M -70 0 Q 0 58 70 0" fill="#8a6947" />{[-25,0,25].map((cx)=><ellipse key={cx} cx={cx} cy="-19" rx="14" ry="20" fill="#a9cbd8" />)}</g>;
  }
  if (/pumpkin|gourd|squash/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>{[-32,0,32].map((cx,i)=><ellipse key={cx} cx={cx} cy="-32" rx="45" ry="39" fill={/white|ghost/.test(name)?'#ece2d6':/green/.test(name)?'#748a61':i===1?'#dc8047':'#ca6f3f'} />)}<path d="M 0 -71 L 8 -97" stroke="#5b6542" strokeWidth="9" strokeLinecap="round" /></g>;
  }
  if (/apple|crabapple/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}><circle cx="0" cy="-42" r="48" fill={/green/.test(name)?'#91a45d':'#bd5551'} /><circle cx="27" cy="-45" r="39" fill={/green/.test(name)?'#80954f':'#ad4848'} /><path d="M 6 -87 L 11 -112" stroke="#574433" strokeWidth="8" /><ellipse cx="25" cy="-105" rx="20" ry="8" fill="#708b5c" transform="rotate(-25 25 -105)" /></g>;
  }
  if (/sea glass/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>{[['#91c6b8',-42,-28],['#a9cce0',8,-10],['#d8b7c9',48,-38],['#d7d0a8',-5,-56]].map(([color,cx,cy],i)=><path key={i} d={`M ${Number(cx)-24} ${Number(cy)} Q ${Number(cx)-12} ${Number(cy)-24} ${Number(cx)+10} ${Number(cy)-18} Q ${Number(cx)+31} ${Number(cy)-6} ${Number(cx)+17} ${Number(cy)+18} Q ${Number(cx)-8} ${Number(cy)+29} ${Number(cx)-24} ${Number(cy)} Z`} fill={String(color)} opacity="0.72" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />)}</g>;
  }
  if (/shell|conch|nautilus|whelk|murex|scallop|clam|oyster|mussel|cowrie|limpet|sand dollar/.test(name)) {
    return <g transform={`translate(${x} ${y - 20}) scale(${scale})`}><path d="M -70 30 Q -70 -62 0 -78 Q 70 -61 73 30 Q 0 62 -70 30 Z" fill="#ead9ca" stroke="#b9a799" strokeWidth="4" />{[-45,-25,-5,15,35,55].map((offset)=><path key={offset} d={`M ${offset} 34 Q ${offset*0.5} -32 0 -73`} fill="none" stroke="#c8b5a6" strokeWidth="3" opacity="0.7" />)}<circle cx="0" cy="-4" r="9" fill="#f1c8cc" opacity="0.75" /></g>;
  }
  if (/geode|amethyst|quartz|crystal|bismuth|malachite|pyrite|azurite|celestite|ruby|emerald|citrine|fluorite|aquamarine|tourmaline/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M -74 -6 Q -68 -78 -20 -94 Q 42 -101 75 -27 Q 64 34 0 46 Q -54 39 -74 -6 Z" fill="#514f58" />{[-38,-12,15,41].map((cx,i)=><path key={cx} d={`M ${cx-12} 12 L ${cx-7} ${-54-i*5} L ${cx+7} ${-76+i*4} L ${cx+16} 10 Z`} fill={i%2?palette.glow:palette.accent} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />)}</g>;
  }
  if (/bonsai/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M -55 0 L 55 0 L 42 28 L -42 28 Z" fill="#755744" /><path d="M 0 0 Q -12 -78 18 -130" fill="none" stroke="#5b4638" strokeWidth="15" strokeLinecap="round" />{[[-45,-132],[17,-150],[54,-122],[0,-105]].map(([cx,cy],i)=><ellipse key={i} cx={cx} cy={cy} rx="44" ry="27" fill={i%2?'#4b6b50':'#5b795b'} />)}</g>;
  }
  if (/observatory/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}><rect x="-60" y="-78" width="120" height="80" rx="8" fill="#68747e" /><path d="M -66 -78 A 66 66 0 0 1 66 -78 Z" fill="#87939e" /><path d="M 20 -126 L 82 -177" stroke="#c0cbd2" strokeWidth="16" strokeLinecap="round" /><circle cx="88" cy="-182" r="17" fill="#dfe8ec" /></g>;
  }
  if (/canoe/.test(name)) {
    return <g transform={`translate(${x} ${y - 5}) scale(${scale}) rotate(-5)`}><path d="M -105 -18 Q 0 29 105 -18 Q 74 32 0 43 Q -72 31 -105 -18 Z" fill="#805f44" /><path d="M -70 -7 Q 0 17 70 -7" fill="none" stroke="#b08a60" strokeWidth="5" /></g>;
  }
  if (/pier|bridge/.test(name)) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>{[-60,-20,20,60].map((cx)=><rect key={cx} x={cx-14} y="-38" width="28" height="100" fill="#6f533c" />)}<rect x="-115" y="-55" width="230" height="30" rx="5" fill="#8a6a4b" /></g>;
  }
  if (/waterfall|cascade|blowhole/.test(name)) {
    return <g transform={`translate(${x} ${y - 130}) scale(${scale})`}><path d="M -92 -65 Q -14 -101 90 -62 L 73 126 Q 0 160 -82 123 Z" fill="#596f68" /><path d="M -25 -71 Q 8 -52 31 -64 L 18 125 Q 1 147 -17 123 Z" fill="#9fdbe5" opacity="0.84" /><ellipse cx="0" cy="132" rx="65" ry="13" fill="#cff5f7" opacity="0.45" /></g>;
  }
  if (/mushroom|toadstool|fungi|mycelium/.test(name) || world.scene.renderCues.includes('mushroom')) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M -16 0 Q -15 -55 0 -79 Q 17 -55 16 0 Z" fill="#e8ddca" /><path d="M -90 -65 Q 0 -153 90 -65 Q 66 -31 0 -35 Q -67 -32 -90 -65 Z" fill={world.scene.atmosphere==='glow'?palette.glow:'#b85f65'} opacity="0.94" />{world.scene.atmosphere==='glow'&&<circle cx="0" cy="-68" r="104" fill={palette.glow} opacity="0.08" />}</g>;
  }
  if (/flower|bloom|blossom|peony|tulip|orchid|daisy|rose|lotus|lily|poppy|hydrangea|wisteria|magnolia/.test(name) || world.scene.renderCues.includes('flower')) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M 0 0 Q -9 -70 0 -120" fill="none" stroke="#66835d" strokeWidth="10" />{[0,60,120,180,240,300].map((angle)=><ellipse key={angle} cx="0" cy="-150" rx="31" ry="17" fill={palette.accent} transform={`rotate(${angle} 0 -150) translate(29 0)`} opacity="0.86" />)}<circle cx="0" cy="-150" r="18" fill="#f0d987" /></g>;
  }
  if (/moon|planet|venus|jupiter|mars/.test(name)) {
    return <g transform={`translate(${x} ${macro ? 300 : 250}) scale(${scale})`}><circle cx="0" cy="0" r={macro ? 88 : 63} fill={/mars/.test(name)?'#ca735f':/jupiter/.test(name)?'#d6b88f':'#e7e4d4'} /><circle cx="-25" cy="-15" r="16" fill="rgba(80,70,75,0.09)" /><circle cx="32" cy="24" r="11" fill="rgba(80,70,75,0.08)" /></g>;
  }
  if (/tree|oak|baobab|redwood|banyan|willow/.test(name) || world.scene.renderCues.includes('tree')) {
    return <BroadTree x={x} y={y + 10} scale={scale * 1.15} color={palette.secondary} trunk="#614b3d" blossom={/cherry|blossom/.test(name)} />;
  }

  return (
    <g transform={`translate(${x} ${y - 35}) scale(${scale})`}>
      <circle cx="0" cy="0" r="66" fill={palette.accent} opacity="0.12" />
      <circle cx="0" cy="0" r="46" fill="rgba(255,255,255,0.09)" />
      <text x="0" y="15" textAnchor="middle" fontSize="58" opacity="0.9">{world.icon}</text>
      <text x="0" y="91" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.45)">{focal.slice(0, 26)}</text>
    </g>
  );
}

function Wildlife({ world, seed }: { world: RichNatureWorldDefinition; seed: number }) {
  if (world.wildlife.length === 0 && !has(world.scene.renderCues, 'animal', 'bird', 'fish', 'insect', 'reptile', 'mammal')) return null;
  const positions = points(seed, Math.min(4, Math.max(1, world.wildlife.length + 1)), 140, 1060, 250, 455);
  return (
    <g opacity="0.8">
      {positions.map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${0.55 + index * 0.08})`}>
          <ellipse cx="0" cy="0" rx="24" ry="14" fill="rgba(27,39,39,0.52)" />
          <circle cx="23" cy="-7" r="9" fill="rgba(27,39,39,0.52)" />
          {has(world.scene.renderCues, 'bird') && <path d="M -18 -4 Q -42 -29 -59 -8 Q -35 -10 -17 6" fill="rgba(27,39,39,0.48)" />}
          {has(world.scene.renderCues, 'fish') && <path d="M -23 0 L -46 -16 L -46 16 Z" fill="rgba(27,39,39,0.5)" />}
          {has(world.scene.renderCues, 'insect') && <><ellipse cx="-7" cy="-14" rx="14" ry="8" fill="rgba(235,246,240,0.24)" transform="rotate(-25 -7 -14)" /><ellipse cx="9" cy="-15" rx="14" ry="8" fill="rgba(235,246,240,0.24)" transform="rotate(25 9 -15)" /></>}
        </g>
      ))}
    </g>
  );
}

export function NatureWorldArt2D({ world, pointerX, pointerY }: Props) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const cues = world.scene.renderCues;
  const snowy = has(cues, 'snow', 'ice') || ['snow','frost'].includes(world.scene.atmosphere);
  const watery = has(cues, 'water', 'river', 'lake', 'pond', 'ocean', 'waterfall') || ['shore','reef','river','lake','wetland'].includes(world.terrain);
  const desert = world.terrain === 'desert' || has(cues, 'sand', 'cactus', 'agave', 'yucca');
  const forested = world.terrain === 'forest' || has(cues, 'pine', 'oak', 'tree', 'bamboo', 'willow', 'palm');
  const floral = has(cues, 'flower', 'sunflower');
  const mushroom = has(cues, 'mushroom');
  const crystal = has(cues, 'crystal', 'ice');
  const mountains = has(cues, 'mountain', 'canyon') || ['mountain','canyon'].includes(world.terrain);
  const clouded = has(cues, 'cloud') || ['fog','mist','rain','storm'].includes(world.scene.atmosphere);
  const horizonY = watery ? 474 : 512;
  const parallax = (depth: number) => `translate(${pointerX * depth} ${pointerY * depth * 0.55})`;
  const treePositions = points(world.seed + 11, Math.round(5 + world.scene.density * 5), 40, 1160, 465, 525);
  const foregroundTrees = points(world.seed + 13, forested ? 4 : 0, 20, 1180, 610, 650);
  const cactusPositions = points(world.seed + 19, desert ? 6 : 0, 60, 1140, 505, 560);

  return (
    <svg viewBox="0 0 1200 720" className="absolute inset-0 h-full w-full" role="img" aria-label={`${world.name}, animated illustrated nature world`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky-${world.index}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.sky} />
          <stop offset="0.58" stopColor={palette.fog} stopOpacity="0.82" />
          <stop offset="1" stopColor={palette.ground} />
        </linearGradient>
        <linearGradient id={`ground-${world.index}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.ground} />
          <stop offset="1" stopColor={palette.secondary} />
        </linearGradient>
        <radialGradient id={`sun-${world.index}`}>
          <stop offset="0" stopColor={palette.glow} stopOpacity="0.95" />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={`soft-${world.index}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18" /></filter>
      </defs>

      <rect width="1200" height="720" fill={`url(#sky-${world.index})`} />
      <circle cx={world.scene.atmosphere === 'sunset' ? 940 : 220} cy={world.scene.atmosphere === 'sunset' ? 235 : 155} r="138" fill={`url(#sun-${world.index})`} opacity={world.scene.atmosphere === 'night' ? 0.08 : 0.55} filter={`url(#soft-${world.index})`} />

      <g transform={parallax(2)}>
        {has(cues, 'moon') && <circle cx="930" cy="135" r="48" fill="#e8e6d8" opacity="0.88" />}
        {has(cues, 'sun') && <circle cx={world.scene.atmosphere === 'sunset' ? 930 : 250} cy={world.scene.atmosphere === 'sunset' ? 250 : 150} r="43" fill={palette.glow} opacity="0.86" />}
        {has(cues, 'aurora') && <Aurora color={palette.accent} glow={palette.glow} />}
        {has(cues, 'rainbow') && <Rainbow y={390} />}
        {clouded && <CloudBank color={world.scene.atmosphere === 'storm' ? '#45505f' : '#ecf0e7'} seed={world.seed + 5} storm={world.scene.atmosphere === 'storm'} />}
      </g>

      <g transform={parallax(4)}>
        {mountains && <Mountains color={palette.secondary} accent={palette.glow} seed={world.seed + 7} snow={snowy} />}
        {has(cues, 'island') && <path d="M 340 475 Q 590 355 865 475 Z" fill={palette.secondary} opacity="0.65" />}
        {world.scene.depth === 'horizon' && <path d="M 0 452 Q 265 420 532 451 T 1200 450 L 1200 535 L 0 535 Z" fill={palette.secondary} opacity="0.28" />}
      </g>

      <g transform={parallax(7)}>
        {watery && <Water water={palette.water} glow={palette.glow} y={horizonY} ocean={has(cues, 'ocean')} />}
        {!watery && <path d={`M 0 ${horizonY} Q 225 ${horizonY - 42} 410 ${horizonY - 8} Q 660 ${horizonY - 68} 840 ${horizonY - 17} Q 1010 ${horizonY - 51} 1200 ${horizonY - 18} L 1200 720 L 0 720 Z`} fill={`url(#ground-${world.index})`} />}
        {desert && <path d="M 0 545 Q 290 470 548 548 Q 790 610 1200 506 L 1200 720 L 0 720 Z" fill={palette.ground} opacity="0.93" />}
        {forested && treePositions.map(([x, y], index) => {
          const scale = 0.55 + (index % 4) * 0.12;
          if (has(cues, 'bamboo')) return <Bamboo key={index} x={x} y={y} scale={scale} color={palette.accent} />;
          if (has(cues, 'palm')) return <Palm key={index} x={x} y={y} scale={scale} color={palette.secondary} />;
          if (has(cues, 'pine')) return <Pine key={index} x={x} y={y} scale={scale} color={palette.secondary} trunk="#5b493a" frost={snowy} />;
          return <BroadTree key={index} x={x} y={y} scale={scale * 0.82} color={palette.secondary} trunk="#5e493a" blossom={/cherry|blossom/.test(world.name.toLowerCase())} />;
        })}
        {cactusPositions.map(([x, y], index) => <Cactus key={index} x={x} y={y} scale={0.5 + (index % 3) * 0.12} color={index % 2 ? '#72825b' : '#697a55'} />)}
        {has(cues, 'reed') && Grass({ seed: world.seed + 29, color: '#7d8a62', y: 550, count: 22 })}
        {floral && <Flowers seed={world.seed + 31} color={palette.accent} y={555} count={Math.round(12 + world.scene.density * 16)} />}
        {mushroom && <Mushrooms seed={world.seed + 37} glow={palette.glow} y={570} />}
        {has(cues, 'rock') && <Rocks seed={world.seed + 41} color={palette.secondary} y={570} crystal={false} />}
        {crystal && <Rocks seed={world.seed + 43} color={palette.accent} y={565} crystal />}
        {has(cues, 'grass') && <Grass seed={world.seed + 47} color={palette.accent} y={570} count={32} />}
        <Wildlife world={world} seed={world.seed + 53} />
      </g>

      <g transform={parallax(11)}>
        <HeroSubject world={world} />
      </g>

      <g transform={parallax(16)} opacity="0.88">
        {foregroundTrees.map(([x, y], index) => has(cues, 'pine') ? <Pine key={index} x={x} y={y} scale={0.68 + index * 0.08} color={palette.secondary} trunk="#594737" frost={snowy} /> : <BroadTree key={index} x={x} y={y} scale={0.62 + index * 0.07} color={palette.secondary} trunk="#5c4638" blossom={false} />)}
        {has(cues, 'fern') && points(world.seed + 61, 11, 10, 1190, 635, 705).map(([x, y], index) => <g key={index} transform={`translate(${x} ${y}) rotate(${index%2?12:-12})`}><path d="M 0 0 Q 4 -42 0 -78" stroke="#6c8b67" strokeWidth="5" fill="none" />{[-65,-49,-34,-18].map((py,j)=><ellipse key={py} cx={j%2?14:-14} cy={py} rx="19" ry="6" transform={`rotate(${j%2?-30:30} ${j%2?14:-14} ${py})`} fill="#759b71" />)}</g>)}
        {has(cues, 'leaf') && points(world.seed + 67, 9, 0, 1200, 20, 690).map(([x,y],index)=><ellipse key={index} cx={x} cy={y} rx="13" ry="5" fill={palette.accent} opacity="0.5" transform={`rotate(${index*31} ${x} ${y})`} />)}
      </g>
    </svg>
  );
}
