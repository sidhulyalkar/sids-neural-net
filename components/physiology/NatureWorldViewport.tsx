'use client';

import dynamic from 'next/dynamic';
import { NatureWorld2D } from '@/components/physiology/nature2d/NatureWorld2D';
import type { PersonaMoodSelfReport, PersonaSnapshot } from '@/lib/physiology/schema';
import type { PersonaActivity } from '@/lib/physiology/world';

export type NatureRenderMode = '2d' | '3d';

type Props = {
  mode: NatureRenderMode;
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
  worldId: string;
  activity: PersonaActivity;
};

const Experimental3D = dynamic(
  () => import('@/components/physiology/PhysioPersonaAtlasScene').then((module) => module.PhysioPersonaAtlasScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-xs text-text-secondary/55 sm:h-[620px]">
        loading experimental Three.js world…
      </div>
    ),
  }
);

export function NatureWorldViewport(props: Props) {
  if (props.mode === '3d') {
    return (
      <Experimental3D
        snapshot={props.snapshot}
        mood={props.mood}
        accent={props.accent}
        worldId={props.worldId}
        activity={props.activity}
      />
    );
  }

  return (
    <NatureWorld2D
      snapshot={props.snapshot}
      mood={props.mood}
      accent={props.accent}
      worldId={props.worldId}
      activity={props.activity}
    />
  );
}
