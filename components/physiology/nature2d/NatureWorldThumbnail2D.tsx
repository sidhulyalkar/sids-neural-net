import {
  NATURE_WORLD_PALETTES,
  type RichNatureWorldDefinition,
} from '@/lib/physiology/natureWorldsExpanded';

type Props = { world: RichNatureWorldDefinition };

export function NatureWorldThumbnail2D({ world }: Props) {
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const cues = world.scene.renderCues;
  const mountains = cues.includes('mountain') || cues.includes('canyon');
  const water = cues.some((cue) => ['water','river','lake','pond','ocean','waterfall'].includes(cue)) || ['shore','reef','river','lake','wetland'].includes(world.terrain);
  const trees = cues.some((cue) => ['pine','oak','tree','bamboo','willow','palm'].includes(cue));
  const flowers = cues.includes('flower') || cues.includes('sunflower');
  const cactus = cues.includes('cactus') || cues.includes('agave') || cues.includes('yucca');
  const night = world.scene.atmosphere === 'night' || cues.includes('stars');
  const glow = world.scene.atmosphere === 'glow' || cues.includes('glow');
  const uid = `thumb-${world.index}`;

  return (
    <div className="relative mb-3 h-16 overflow-hidden rounded-lg border border-white/10 bg-black/15">
      <svg viewBox="0 0 240 96" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={palette.sky} />
            <stop offset="0.62" stopColor={palette.fog} />
            <stop offset="1" stopColor={palette.ground} />
          </linearGradient>
        </defs>
        <rect width="240" height="96" fill={`url(#${uid}-sky)`} />
        {night && <>{[[25,17],[62,11],[102,22],[157,13],[208,25],[187,8]].map(([x,y],index)=><circle key={index} cx={x} cy={y} r={index%2?0.8:1.2} fill="#f5f7ff" opacity="0.75" />)}</>}
        {cues.includes('moon') && <circle cx="194" cy="22" r="11" fill="#ece9d8" opacity="0.9" />}
        {cues.includes('sun') && <circle cx="45" cy="24" r="12" fill={palette.glow} opacity="0.9" />}
        {mountains && <><path d="M -15 67 L 40 30 L 96 67 Z" fill={palette.secondary} opacity="0.58" /><path d="M 55 67 L 128 21 L 196 67 Z" fill={palette.secondary} opacity="0.72" /><path d="M 145 67 L 202 39 L 260 67 Z" fill={palette.secondary} opacity="0.52" /></>}
        {water ? <path d="M 0 59 Q 45 54 86 59 T 171 59 T 250 58 L 250 100 L 0 100 Z" fill={palette.water} opacity="0.88" /> : <path d="M 0 63 Q 52 48 108 62 Q 165 51 240 59 L 240 100 L 0 100 Z" fill={palette.ground} opacity="0.94" />}
        {trees && [25,66,178,216].map((x,index)=><g key={x} transform={`translate(${x} ${72-index%2*4}) scale(${0.52+index*0.05})`}><rect x="-3" y="-28" width="6" height="30" rx="2" fill="#5a4637" /><path d="M 0 -62 L -20 -29 L 20 -29 Z" fill={palette.secondary} /><path d="M 0 -47 L -18 -17 L 18 -17 Z" fill={palette.secondary} opacity="0.9" /></g>)}
        {cactus && [38,198].map((x,index)=><g key={x} transform={`translate(${x} 73) scale(${0.6+index*0.1})`}><rect x="-5" y="-34" width="10" height="36" rx="5" fill="#72835e" /><path d="M -3 -23 Q -15 -27 -14 -15" fill="none" stroke="#72835e" strokeWidth="7" strokeLinecap="round" /></g>)}
        {flowers && [28,53,76,167,196,220].map((x,index)=><g key={x} transform={`translate(${x} ${76-(index%3)*2})`}><path d="M 0 0 L 0 -10" stroke="#67825a" strokeWidth="1.5" /><circle cx="0" cy="-11" r="3.4" fill={index%2?palette.accent:'#e8c5d6'} /><circle cx="0" cy="-11" r="1" fill="#f0d77c" /></g>)}
        {cues.includes('mushroom') && [48,93,188].map((x,index)=><g key={x} transform={`translate(${x} ${78-index%2*3})`}><rect x="-2" y="-9" width="4" height="10" rx="2" fill="#e5dbc9" /><path d="M -8 -8 Q 0 -18 8 -8 Q 5 -4 0 -4 Q -5 -4 -8 -8 Z" fill={glow?palette.glow:'#b85f64'} /></g>)}
        {cues.includes('rainbow') && <path d="M 64 58 Q 120 0 180 58" fill="none" stroke="#eab7ca" strokeWidth="4" opacity="0.7" />}
        {cues.includes('aurora') && <path d="M -10 28 C 40 4 74 45 122 19 S 203 6 250 32" fill="none" stroke={palette.glow} strokeWidth="8" opacity="0.45" />}
        {glow && [34,91,151,206].map((x,index)=><circle key={x} cx={x} cy={42-index%2*10} r="2.2" fill={palette.glow} opacity="0.9" />)}
        <circle cx="133" cy="65" r="9" fill="rgba(255,255,255,0.10)" />
        <text x="133" y="69" textAnchor="middle" fontSize="11">{world.icon}</text>
      </svg>
    </div>
  );
}
