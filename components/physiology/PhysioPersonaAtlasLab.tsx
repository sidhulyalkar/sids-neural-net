'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Compass,
  Download,
  Heart,
  Layers3,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { NatureWorldAtlas } from '@/components/physiology/NatureWorldAtlas';
import { PersonaEvidencePanel } from '@/components/physiology/PersonaEvidencePanel';
import { PhysioPersonaAtlasScene } from '@/components/physiology/PhysioPersonaAtlasScene';
import { usePersonaWorld } from '@/components/physiology/usePersonaWorld';
import { createDemoPersonaSnapshot } from '@/lib/physiology/demo';
import type { PersonaMoodSelfReport, PersonaSnapshot } from '@/lib/physiology/schema';
import {
  atlasSummary,
  explainNatureRecommendation,
  getNatureWorld,
  suggestNatureWorld,
  suggestWorldActivity,
} from '@/lib/physiology/natureWorldsExpanded';
import {
  ACTIVITIES,
  TRAIT_COPY,
  TRAIT_LABELS,
  type PersonaTrait,
} from '@/lib/physiology/world';

const MOODS: Array<{ value: PersonaMoodSelfReport; label: string; copy: string; icon: string }> = [
  { value: 'calm', label: 'calm', copy: 'gentler pacing and quieter recommendations', icon: '🌙' },
  { value: 'curious', label: 'curious', copy: 'novel details and investigative places', icon: '🔎' },
  { value: 'energized', label: 'energized', copy: 'active routes, weather, peaks, and motion', icon: '⚡' },
  { value: 'sleepy', label: 'sleepy', copy: 'night worlds, shelter, water, and soft light', icon: '😴' },
];

const TRAITS: PersonaTrait[] = ['curiosity', 'energy', 'collector', 'explorer', 'calmWorlds', 'wildWorlds'];
const DEFAULT_ACCENT = '#72c6d6';

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function BlueprintCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.13em] text-cyan/55">{label}</p>
      <p className="mt-2 text-[0.7rem] leading-5 text-text-secondary/65">{value}</p>
    </div>
  );
}

export function PhysioPersonaAtlasLab() {
  const [snapshot, setSnapshot] = useState<PersonaSnapshot>(() => createDemoPersonaSnapshot(0));
  const [source, setSource] = useState<'demo' | 'file'>('demo');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mood, setMood] = useState<PersonaMoodSelfReport>('curious');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const startedAt = useRef(Date.now());
  const world = usePersonaWorld('curious');

  const currentWorld = getNatureWorld(world.worldId);
  const currentActivity = ACTIVITIES[world.activity];
  const recommendedWorld = suggestNatureWorld(world.profile, world.atlas, mood);
  const recommendedActivity = suggestWorldActivity(world.profile, recommendedWorld, mood);
  const recommendationCopy = explainNatureRecommendation(world.profile, world.atlas, recommendedWorld, mood);
  const summary = atlasSummary(world.atlas);
  const favorite = world.atlas.favorites.includes(currentWorld.id);

  useEffect(() => {
    if (source !== 'demo') return;
    const update = () => setSnapshot(createDemoPersonaSnapshot((Date.now() - startedAt.current) / 1000));
    const interval = window.setInterval(update, 650);
    return () => window.clearInterval(interval);
  }, [source]);

  const resetDemo = () => {
    startedAt.current = Date.now();
    setSource('demo');
    setFileName(null);
    setSnapshot(createDemoPersonaSnapshot(0));
  };

  const downloadProfile = () => {
    const payload = {
      schema: 'sid.physio-persona.export.v2',
      exportedAt: new Date().toISOString(),
      persona: world.profile,
      atlas: world.atlas,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'physio-persona-nature-atlas.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-cyan/20 bg-cyan/[0.045]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan/80" /><p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-cyan/70">physio persona nature atlas</p></div>
            <h2 className="mt-3 max-w-3xl text-xl font-medium text-text-primary sm:text-2xl">900 tiny worlds, one creature, and an inspectable memory of what you actually choose.</h2>
            <p className="mt-3 max-w-4xl text-xs leading-6 text-text-secondary/70">
              The atlas is rendered as layered 2.5D nature dioramas inside a real 3D scene. Physiology can animate the body. Self-reported mood can tint this visit. Only explicit world, activity, favorite, and slider choices become persistent game-preference signals.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[0.62rem] text-text-secondary/60 sm:flex sm:flex-wrap sm:justify-end">
            <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5">{summary.discovered}/900 discovered</span>
            <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5">{summary.collectionsVisited}/17 collections</span>
            <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5">♥ {summary.favorites}</span>
            <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5">{world.profile.adventures} explicit adventures</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_minmax(22rem,0.58fr)]">
        <div>
          <PhysioPersonaAtlasScene snapshot={snapshot} mood={mood} accent={accent} worldId={world.worldId} activity={world.activity} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.68rem] text-text-secondary/55">
            <span>drag to orbit · scroll to zoom · deterministic 2.5D parallax scene</span>
            <span className="font-mono">observability {percentage(snapshot.overall_observability)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.028] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-cyan/60">expedition · {String(currentWorld.index).padStart(3, '0')}/900</p>
                <h2 className="mt-1 text-base font-medium text-text-primary">{currentWorld.icon} {currentWorld.name}</h2>
                <p className="mt-2 text-xs leading-5 text-text-secondary/65">{currentWorld.description}</p>
              </div>
              <button type="button" onClick={() => world.toggleFavorite(currentWorld.id)} aria-label={`${favorite ? 'Remove' : 'Add'} current world ${favorite ? 'from' : 'to'} favorites`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${favorite ? 'border-rose-300/30 bg-rose-300/10 text-rose-200' : 'border-white/10 text-text-secondary hover:border-white/20'}`}><Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-text-secondary/50">
              <span className="rounded-lg border border-white/10 p-2.5">{currentWorld.scene.collectionLabel}</span>
              <span className="rounded-lg border border-white/10 p-2.5">{currentWorld.scene.depth} depth</span>
              <span className="rounded-lg border border-white/10 p-2.5">{currentWorld.scene.atmosphere}</span>
              <span className="rounded-lg border border-white/10 p-2.5">seed {currentWorld.seed}</span>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
              <p className="text-xs text-text-primary">{currentActivity.icon} {currentActivity.name}</p>
              <p className="mt-1 text-[0.68rem] leading-5 text-text-secondary/55">{currentActivity.description}</p>
            </div>
            <button type="button" onClick={() => world.wander(mood)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan/25 bg-cyan/[0.06] px-4 text-sm text-cyan/90 transition hover:border-cyan/45 hover:bg-cyan/[0.1]"><Compass className="h-4 w-4" /> wander somewhere unexpected</button>
            <p className="mt-2 text-[0.61rem] leading-4 text-text-secondary/40">Wandering records discovery but does not train the preference vector because the recommender made the choice.</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2"><Moon className="h-4 w-4 text-cyan/70" /><h2 className="font-mono text-sm text-text-primary">how does this visit feel?</h2></div>
            <p className="mt-2 text-[0.68rem] leading-5 text-text-secondary/55">Self-report only. Mood can alter recommendations and atmosphere without becoming a permanent personality label.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {MOODS.map((item) => (
                <button key={item.value} type="button" onClick={() => setMood(item.value)} className={`rounded-xl border p-3 text-left transition ${mood === item.value ? 'border-cyan/40 bg-cyan/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
                  <span className="text-xs font-medium text-text-primary">{item.icon} {item.label}</span>
                  <span className="mt-1 block text-[0.62rem] leading-4 text-text-secondary/50">{item.copy}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-cyan/70" /><h2 className="font-mono text-sm text-text-primary">scene blueprint · why this world looks different</h2></div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-text-secondary/60">Every atlas entry carries an authored-by-rule rendering brief. The renderer turns these fields into depth layers, focal props, atmosphere, motion, and camera behavior instead of merely recoloring one biome.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[0.6rem] text-text-secondary/45">{currentWorld.scene.renderCues.length} render cues</span>
        </div>
        <div className="mt-5 rounded-xl border border-cyan/15 bg-cyan/[0.025] p-4"><p className="text-xs leading-6 text-text-secondary/72">{currentWorld.scene.visualThesis}</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BlueprintCard label="foreground" value={currentWorld.scene.foreground} />
          <BlueprintCard label="midground" value={currentWorld.scene.midground} />
          <BlueprintCard label="backdrop" value={currentWorld.scene.backdrop} />
          <BlueprintCard label="motion" value={currentWorld.scene.motion} />
          <BlueprintCard label="lighting" value={currentWorld.scene.lighting} />
          <BlueprintCard label="camera" value={currentWorld.scene.camera} />
          <BlueprintCard label="interaction" value={currentWorld.scene.interactionCue} />
          <div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="font-mono text-[0.58rem] uppercase tracking-[0.13em] text-cyan/55">visual vocabulary</p><div className="mt-2 flex flex-wrap gap-1.5">{currentWorld.scene.renderCues.map((cue) => <span key={cue} className="rounded-full border border-white/10 px-2 py-1 font-mono text-[0.55rem] text-text-secondary/55">{cue}</span>)}</div></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan/70" /><h2 className="font-mono text-sm text-text-primary">what should the tiny creature do?</h2></div>
          <p className="mt-2 text-xs leading-5 text-text-secondary/60">Activities are constrained by the current world. Picking one is an explicit and inspectable game-preference signal.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {currentWorld.activities.map((activityId) => {
              const item = ACTIVITIES[activityId];
              return <button key={activityId} type="button" onClick={() => world.chooseActivity(activityId, mood)} className={`min-h-10 rounded-full border px-3 text-xs transition ${world.activity === activityId ? 'border-cyan/40 bg-cyan/[0.08] text-cyan' : 'border-white/10 bg-white/[0.025] text-text-secondary hover:border-white/20 hover:text-text-primary'}`}>{item.icon} {item.name}</button>;
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><Compass className="h-4 w-4 text-cyan/70" /><h2 className="font-mono text-sm text-text-primary">world director suggestion</h2></div><span className="font-mono text-[0.6rem] text-text-secondary/45">transparent recommendation</span></div>
          <div className="mt-4 rounded-xl border border-cyan/15 bg-cyan/[0.035] p-4">
            <p className="text-sm text-text-primary">{recommendedWorld.icon} {String(recommendedWorld.index).padStart(3, '0')} · {recommendedWorld.name} · {ACTIVITIES[recommendedActivity].icon} {ACTIVITIES[recommendedActivity].name}</p>
            <p className="mt-2 text-xs leading-6 text-text-secondary/60">{recommendationCopy}</p>
            <button type="button" onClick={() => world.chooseWorld(recommendedWorld.id, mood)} className="mt-3 min-h-9 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/30 hover:text-cyan">choose this explicitly</button>
          </div>
        </section>
      </div>

      <NatureWorldAtlas currentWorldId={world.worldId} progress={world.atlas} onChooseWorld={(worldId) => world.chooseWorld(worldId, mood)} onToggleFavorite={world.toggleFavorite} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-cyan/70" /><h2 className="font-mono text-sm text-text-primary">inspectable persona</h2></div><span className="font-mono text-[0.62rem] text-text-secondary/45">localStorage only</span></div>
          <p className="mt-2 text-xs leading-5 text-text-secondary/60">These are game preferences, not psychological traits. Drag a slider whenever the learned behavior feels wrong.</p>
          <div className="mt-5 space-y-4">
            {TRAITS.map((trait) => (
              <div key={trait}>
                <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-text-primary">{TRAIT_LABELS[trait]}</p><p className="mt-0.5 text-[0.62rem] text-text-secondary/45">{TRAIT_COPY[trait]}</p></div><span className="font-mono text-[0.68rem] text-text-secondary/55">{percentage(world.profile.traits[trait])}</span></div>
                <input aria-label={TRAIT_LABELS[trait]} className="mt-2 w-full cursor-pointer" type="range" min="0" max="100" value={Math.round(world.profile.traits[trait] * 100)} onChange={(event) => world.setTrait(trait, Number(event.target.value) / 100)} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={downloadProfile} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-white/20 hover:text-text-primary"><Download className="h-3.5 w-3.5" /> export persona + atlas</button>
            <button type="button" onClick={() => world.reset(mood)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-rose-300/25 hover:text-rose-200"><RotateCcw className="h-3.5 w-3.5" /> reset local world</button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan/70" /><h2 className="font-mono text-sm text-text-primary">field journal</h2></div><span className="font-mono text-[0.62rem] text-text-secondary/45">{world.profile.adventures} explicit adventures</span></div>
          {world.profile.memories.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs leading-6 text-text-secondary/50">No field notes yet. Explicitly choose a world or activity and the creature will begin keeping extremely serious tiny records.</div> : (
            <div className="mt-4 space-y-2.5">{world.profile.memories.slice(0, 8).map((memory) => <div key={memory.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-cyan/50">explicit choice</span><span className="text-[0.58rem] text-text-secondary/35">{new Date(memory.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><p className="mt-1.5 text-xs leading-5 text-text-secondary/65">{memory.note}</p></div>)}</div>
          )}
        </section>
      </div>

      <PersonaEvidencePanel
        snapshot={snapshot}
        sourceLabel={source === 'demo' ? 'synthetic demo stream' : fileName ?? 'local snapshot'}
        accent={accent}
        onAccent={setAccent}
        onSnapshot={(nextSnapshot, nextFileName) => { setSnapshot(nextSnapshot); setSource('file'); setFileName(nextFileName); }}
        onResetDemo={resetDemo}
      />
    </div>
  );
}
