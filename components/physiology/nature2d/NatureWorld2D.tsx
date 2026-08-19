'use client';

import { useEffect, useMemo, useState } from 'react';
import { NatureAtmosphereCanvas } from '@/components/physiology/nature2d/NatureAtmosphereCanvas';
import { NatureWorldArt2D } from '@/components/physiology/nature2d/NatureWorldArt2D';
import { Persona2D } from '@/components/physiology/nature2d/Persona2D';
import {
  NATURE_WORLD_PALETTES,
  getNatureWorld,
} from '@/lib/physiology/natureWorldsExpanded';
import type { PersonaMoodSelfReport, PersonaSnapshot } from '@/lib/physiology/schema';
import type { PersonaActivity } from '@/lib/physiology/world';

type Props = {
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
  worldId: string;
  activity: PersonaActivity;
};

type Ripple = { id: number; x: number; y: number };

function ActivityOverlay({ activity }: { activity: PersonaActivity }) {
  if (activity === 'warm-fire') {
    return (
      <g transform="translate(760 555)">
        <path d="M -35 20 L 35 -10 M -35 -10 L 35 20" stroke="#654432" strokeWidth="11" strokeLinecap="round" />
        <path d="M 0 -5 Q -40 -64 -5 -96 Q -4 -55 19 -78 Q 47 -38 10 1 Z" fill="#ff9a58" opacity="0.95">
          <animate attributeName="d" dur="1.1s" repeatCount="indefinite" values="M 0 -5 Q -40 -64 -5 -96 Q -4 -55 19 -78 Q 47 -38 10 1 Z;M 0 -5 Q -29 -69 3 -104 Q 8 -61 28 -82 Q 39 -42 10 1 Z;M 0 -5 Q -40 -64 -5 -96 Q -4 -55 19 -78 Q 47 -38 10 1 Z" />
        </path>
        <circle cx="0" cy="-42" r="70" fill="#ff9a58" opacity="0.09" />
      </g>
    );
  }
  if (activity === 'build-cairn') {
    return <g transform="translate(760 570)">{[[0,0,42,20],[-2,-27,32,16],[2,-50,22,13]].map(([x,y,rx,ry],index)=><ellipse key={index} cx={x} cy={y} rx={rx} ry={ry} fill={index===0?'#686f6e':index===1?'#7a807e':'#909694'} />)}</g>;
  }
  if (activity === 'garden') {
    return <g transform="translate(735 580)"><path d="M -85 0 L 85 0 L 67 48 L -72 48 Z" fill="#5c4838" opacity="0.9" />{[-55,-18,20,57].map((x,index)=><g key={x} transform={`translate(${x} 0)`}><path d="M 0 0 Q 0 -28 0 -48" stroke="#6e915e" strokeWidth="5" /><ellipse cx={index%2?9:-9} cy="-36" rx="12" ry="5" fill="#7da36c" transform={`rotate(${index%2?-25:25} ${index%2?9:-9} -36)`} /></g>)}</g>;
  }
  if (activity === 'collect') {
    return <g transform="translate(760 568)"><path d="M -48 5 Q 0 30 48 5 L 38 46 L -38 46 Z" fill="#8b6747" /><path d="M -30 8 Q 0 -35 30 8" fill="none" stroke="#a9855d" strokeWidth="7" />{[-26,0,26].map((x,index)=><circle key={x} cx={x} cy={-4-index*5} r="7" fill={index===0?'#b9e9d5':index===1?'#d7c2f2':'#efd48c'}><animate attributeName="opacity" values="0.4;1;0.4" dur={`${1.5+index*0.3}s`} repeatCount="indefinite" /></circle>)}</g>;
  }
  if (activity === 'stargaze') {
    return <g transform="translate(760 583)"><rect x="-63" y="-12" width="126" height="24" rx="10" fill="#6f647e" opacity="0.82" transform="rotate(-5)" /><path d="M 46 -16 L 72 -54" stroke="#b2bbc2" strokeWidth="5" /><circle cx="76" cy="-61" r="9" fill="#cbd5db" /></g>;
  }
  if (activity === 'skip-stones') {
    return <g transform="translate(790 545)">{[0,1,2].map((index)=><g key={index}><ellipse cx={index*42} cy={index*9} rx="18" ry="5" fill="none" stroke="rgba(225,248,250,0.5)" strokeWidth="2"><animate attributeName="rx" values="4;22;4" dur="1.7s" begin={`${index*0.25}s`} repeatCount="indefinite" /><animate attributeName="opacity" values="0.7;0;0" dur="1.7s" begin={`${index*0.25}s`} repeatCount="indefinite" /></ellipse></g>)}</g>;
  }
  if (activity === 'snow-angel') {
    return <g transform="translate(600 610)" opacity="0.34"><ellipse cx="0" cy="0" rx="42" ry="72" fill="none" stroke="#f5fdff" strokeWidth="9" /><path d="M -32 -10 Q -100 -70 -105 -6 M 32 -10 Q 100 -70 105 -6 M -20 57 L -62 115 M 20 57 L 62 115" fill="none" stroke="#f5fdff" strokeWidth="10" strokeLinecap="round" /></g>;
  }
  return null;
}

export function NatureWorld2D({ snapshot, mood, accent, worldId, activity }: Props) {
  const world = getNatureWorld(worldId);
  const palette = NATURE_WORLD_PALETTES[world.palette];
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setPointer({ x: 0, y: 0 });
    setRipples([]);
  }, [worldId]);

  const interactiveWater = useMemo(
    () => world.scene.renderCues.some((cue) => ['water','river','lake','pond','ocean','waterfall'].includes(cue)) || ['shore','reef','river','lake','wetland'].includes(world.terrain),
    [world]
  );

  const updatePointer = (clientX: number, clientY: number, element: HTMLDivElement) => {
    if (reducedMotion) return;
    const rect = element.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((clientY - rect.top) / rect.height - 0.5) * 2;
    setPointer({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  };

  const addRipple = (clientX: number, clientY: number, element: HTMLDivElement) => {
    if (!interactiveWater) return;
    const rect = element.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const ripple = { id: Date.now(), x, y };
    setRipples((current) => [...current.slice(-3), ripple]);
    window.setTimeout(() => setRipples((current) => current.filter((item) => item.id !== ripple.id)), 1350);
  };

  return (
    <div
      className="relative h-[500px] w-full touch-pan-y overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:h-[620px]"
      onPointerMove={(event) => updatePointer(event.clientX, event.clientY, event.currentTarget)}
      onPointerLeave={() => setPointer({ x: 0, y: 0 })}
      onPointerDown={(event) => addRipple(event.clientX, event.clientY, event.currentTarget)}
      style={{ cursor: interactiveWater ? 'crosshair' : 'default' }}
    >
      <NatureWorldArt2D world={world} pointerX={pointer.x} pointerY={pointer.y} />

      <svg viewBox="0 0 1200 720" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <ActivityOverlay activity={activity} />
        <Persona2D snapshot={snapshot} mood={mood} accent={accent} activity={activity} pointerX={pointer.x} pointerY={pointer.y} />
      </svg>

      <NatureAtmosphereCanvas world={world} pointerX={pointer.x} pointerY={pointer.y} />

      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          aria-hidden
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/60"
          style={{ left: `${ripple.x}%`, top: `${ripple.y}%`, animation: 'nature-ripple 1.25s ease-out forwards' }}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_36%,rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.035] to-transparent" />

      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 sm:left-5 sm:top-5">
        <span className="rounded-full border border-white/15 bg-black/25 px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-white/65 backdrop-blur">2D living illustration</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.58rem] text-white/45 backdrop-blur">{world.scene.depth} parallax</span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-4 pt-20 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/48">world {String(world.index).padStart(3, '0')} · {world.scene.collectionLabel}</p>
            <p className="mt-1 text-sm font-medium text-white/92">{world.icon} {world.name}</p>
            <p className="mt-1 hidden max-w-lg text-[0.65rem] leading-5 text-white/52 sm:block">{world.description}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-white/38">{world.scene.atmosphere} · {world.scene.density.toFixed(2)} density</p>
            {interactiveWater && <p className="mt-1 text-[0.6rem] text-cyan-100/55">tap the water for a ripple</p>}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes nature-ripple {
          0% { width: 1rem; height: 0.35rem; opacity: 0.75; transform: translate(-50%, -50%) scale(0.5); }
          70% { opacity: 0.25; }
          100% { width: 9rem; height: 2.3rem; opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>

      <span className="sr-only">Palette sky {palette.sky}; scene responds to pointer position with layered parallax.</span>
    </div>
  );
}
