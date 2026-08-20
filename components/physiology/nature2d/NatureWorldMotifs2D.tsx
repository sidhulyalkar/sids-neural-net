import {
  NATURE_WORLD_PALETTES,
  type RichNatureWorldDefinition,
} from '@/lib/physiology/natureWorldsExpanded';

type Props = {
  world: RichNatureWorldDefinition;
  pointerX: number;
  pointerY: number;
};

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value) + 0x6d2b79f5 | 0;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function NatureWorldMotifs2D({ world, pointerX, pointerY }: Props) {
  const cues = world.scene.renderCues;
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const random = seeded(world.seed + 401);
  const shift = `translate(${pointerX * 9} ${pointerY * 5})`;
  const nearShift = `translate(${pointerX * 15} ${pointerY * 8})`;

  return (
    <svg viewBox="0 0 1200 720" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g transform={shift}>
        {cues.includes('path') && (
          <path d="M 585 720 C 548 650 515 620 560 568 C 612 506 664 515 650 445" fill="none" stroke="#b59c78" strokeWidth="62" strokeLinecap="round" opacity="0.48" />
        )}

        {cues.includes('bridge') && (
          <g transform="translate(354 505) rotate(-4)">
            <path d="M 0 40 Q 120 -30 245 35" fill="none" stroke="#73563d" strokeWidth="20" strokeLinecap="round" />
            {[20,55,90,125,160,195,230].map((x, index) => <rect key={x} x={x-14} y={24-Math.sin(index/6*Math.PI)*38} width="28" height="13" rx="3" fill="#9a7650" transform={`rotate(${index*1.6-5} ${x} 30)`} />)}
            <path d="M 7 18 Q 120 -54 236 14" fill="none" stroke="#c6ab7f" strokeWidth="3" opacity="0.5" />
          </g>
        )}

        {cues.includes('web') && (
          <g transform="translate(875 245)" opacity="0.56" stroke="#eef8f6" fill="none">
            {[25,48,72,96].map((r) => <circle key={r} cx="0" cy="0" r={r} strokeWidth="1.3" />)}
            {[0,45,90,135,180,225,270,315].map((angle) => <line key={angle} x1="0" y1="0" x2={Math.cos(angle*Math.PI/180)*105} y2={Math.sin(angle*Math.PI/180)*105} strokeWidth="1.2" />)}
            {[[-42,-18],[-2,39],[47,7],[18,-57]].map(([x,y],index)=><circle key={index} cx={x} cy={y} r="3.5" fill="#f4ffff" stroke="none" opacity="0.8" />)}
          </g>
        )}

        {cues.includes('cave') && (
          <g opacity="0.7">
            <path d="M 80 565 Q 115 340 316 307 Q 470 329 505 565 Z" fill="#34383a" />
            <path d="M 151 565 Q 164 405 315 374 Q 428 401 442 565 Z" fill="#171d1e" />
            {[188,244,302,361,409].map((x,index)=><path key={x} d={`M ${x} 356 L ${x+10} ${395+index%2*24} L ${x+24} 355 Z`} fill="#555b59" opacity="0.55" />)}
          </g>
        )}

        {cues.includes('ruin') && (
          <g transform="translate(168 454)" opacity="0.58">
            <rect x="0" y="0" width="45" height="132" fill="#817d6f" />
            <rect x="168" y="-18" width="45" height="150" fill="#77766a" />
            <path d="M 36 18 Q 106 -72 178 8 L 178 38 Q 108 -22 36 51 Z" fill="#888477" />
            <path d="M 70 58 Q 106 20 143 55 L 143 128 L 70 128 Z" fill="#444943" opacity="0.7" />
            {[22,83,146,196].map((x)=><circle key={x} cx={x} cy={random()*90+20} r="4" fill="#6b8a68" />)}
          </g>
        )}

        {cues.includes('coral') && (
          <g transform="translate(820 598)" opacity="0.85">
            {[-74,-42,-10,26,61].map((x,index)=><g key={x} transform={`translate(${x} 0)`}><path d={`M 0 0 Q ${index%2?18:-16} -37 2 -88`} fill="none" stroke={index%3===0?'#c67e87':index%3===1?'#b28cc2':'#e2a36f'} strokeWidth={10-index%3} strokeLinecap="round" /><path d="M 2 -50 Q -24 -70 -28 -92 M 0 -32 Q 25 -48 30 -73" fill="none" stroke={index%2?'#c67e87':'#b28cc2'} strokeWidth="7" strokeLinecap="round" /></g>)}
          </g>
        )}

        {cues.includes('kelp') && (
          <g transform="translate(232 632)" opacity="0.68" fill="none" stroke="#547b61" strokeLinecap="round">
            {[0,34,67,103,140].map((x,index)=><path key={x} d={`M ${x} 0 C ${x-25} -48, ${x+31} -93, ${x+(index%2?4:-8)} -168`} strokeWidth={10-index%3} />)}
          </g>
        )}

        {cues.includes('reed') && (
          <g transform="translate(964 620)" strokeLinecap="round">
            {[-62,-38,-13,12,36,58].map((x,index)=><g key={x}><path d={`M ${x} 0 Q ${x+(index%2?8:-8)} -72 ${x+3} -139`} stroke="#748265" strokeWidth="4" fill="none" /><ellipse cx={x+3} cy="-146" rx="8" ry="19" fill="#76684e" /></g>)}
          </g>
        )}

        {cues.includes('lily') && (
          <g opacity="0.8">
            {[[308,573,28],[392,594,21],[486,565,25],[713,590,23]].map(([cx,cy,r],index)=><g key={index}><ellipse cx={cx} cy={cy} rx={r} ry={r*0.38} fill="#648c67" transform={`rotate(${index*17-9} ${cx} ${cy})`} /><path d={`M ${cx} ${cy} L ${cx+r} ${cy-4}`} stroke={palette.water} strokeWidth="4" /><circle cx={cx-3} cy={cy-10} r="7" fill={index%2?'#e7c7da':'#f1e6c1'} /></g>)}
          </g>
        )}

        {cues.includes('shell') && (
          <g opacity="0.67">
            {[[184,612],[267,638],[1015,607],[1092,643]].map(([cx,cy],index)=><g key={index} transform={`translate(${cx} ${cy}) rotate(${index*23-18}) scale(${0.72+index*0.08})`}><path d="M -22 8 Q -25 -26 0 -35 Q 27 -24 24 9 Q 0 24 -22 8 Z" fill="#e5d4c4" stroke="#bca99b" strokeWidth="2" />{[-12,-4,4,12].map((x)=><path key={x} d={`M ${x} 11 Q ${x/2} -15 0 -31`} fill="none" stroke="#c8b5a5" strokeWidth="1.4" />)}</g>)}
          </g>
        )}

        {cues.includes('log') && (
          <g transform="translate(150 573) rotate(-9)" opacity="0.78">
            <rect x="0" y="0" width="260" height="43" rx="21" fill="#6a513d" />
            <ellipse cx="252" cy="21" rx="22" ry="21" fill="#8a6a4d" />
            <circle cx="252" cy="21" r="11" fill="none" stroke="#604938" strokeWidth="2" />
            <path d="M 82 1 Q 96 -22 111 -2 M 156 3 Q 169 -18 182 2" stroke="#6f9169" strokeWidth="5" fill="none" />
          </g>
        )}

        {cues.includes('roots') && (
          <g transform="translate(747 528)" stroke="#66503d" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.7">
            <path d="M 0 -135 Q -18 -42 -104 37" />
            <path d="M 22 -127 Q 34 -43 126 43" />
            <path d="M 9 -83 Q -5 -3 -20 82" />
            <path d="M 10 -44 Q 89 4 173 18" />
          </g>
        )}

        {cues.includes('lightning') && (
          <path d="M 793 72 L 742 180 L 785 174 L 726 306 L 842 151 L 794 158 L 843 72 Z" fill="#f0f4d3" opacity="0.72" />
        )}

        {cues.includes('meteor') && (
          <g transform="translate(930 112) rotate(-28)">
            <path d="M -164 0 L -12 0" stroke={palette.glow} strokeWidth="5" strokeLinecap="round" opacity="0.2" />
            <path d="M -95 0 L -9 0" stroke="#f5ead8" strokeWidth="3" strokeLinecap="round" opacity="0.72" />
            <circle cx="0" cy="0" r="7" fill="#fff1cf" />
          </g>
        )}
      </g>

      <g transform={nearShift} opacity="0.8">
        {cues.includes('grass') && [24,72,108,1120,1155,1185].map((x,index)=><path key={x} d={`M ${x} 720 Q ${x+(index%2?18:-16)} 664 ${x+(index%3-1)*7} 607`} stroke="#708663" strokeWidth="7" fill="none" strokeLinecap="round" />)}
      </g>
    </svg>
  );
}
