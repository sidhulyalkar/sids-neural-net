'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  CameraOff,
  Compass,
  Download,
  FileJson,
  FlaskConical,
  Leaf,
  Moon,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import { PhysioPersonaScene } from '@/components/physiology/PhysioPersonaScene';
import { usePersonaWorld } from '@/components/physiology/usePersonaWorld';
import { createDemoPersonaSnapshot } from '@/lib/physiology/demo';
import {
  PersonaSnapshotSchema,
  dominantSleepStage,
  type PersonaMoodSelfReport,
  type PersonaSignal,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';
import {
  ACTIVITIES,
  BIOMES,
  TRAIT_COPY,
  TRAIT_LABELS,
  explainRecommendation,
  suggestActivity,
  suggestBiome,
  type PersonaTrait,
} from '@/lib/physiology/world';

const MOODS: Array<{ value: PersonaMoodSelfReport; label: string; copy: string; icon: string }> = [
  { value: 'calm', label: 'calm', copy: 'gentle light and slower wandering', icon: '🌙' },
  { value: 'curious', label: 'curious', copy: 'more investigating and little discoveries', icon: '🔎' },
  { value: 'energized', label: 'energized', copy: 'brighter worlds and bouncier tasks', icon: '⚡' },
  { value: 'sleepy', label: 'sleepy', copy: 'dusk, stars, fires, and cozy places', icon: '😴' },
];

const TRAITS: PersonaTrait[] = [
  'curiosity',
  'energy',
  'collector',
  'explorer',
  'calmWorlds',
  'wildWorlds',
];

const DEFAULT_ACCENT = '#72c6d6';

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signalValue(signal: PersonaSignal): string {
  if (!signal.available || signal.value === null) return 'unknown';
  if (typeof signal.value === 'number') {
    return `${signal.value}${signal.unit ? ` ${signal.unit}` : ''}`;
  }
  return String(signal.value);
}

function SignalCard({ signal }: { signal: PersonaSignal }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cyan/60">{signal.origin}</p>
          <h3 className="mt-1 text-sm font-medium text-text-primary">{signal.label}</h3>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-text-secondary/70">
          {signal.evidence}
        </span>
      </div>
      <p className={`mt-4 font-mono text-xl ${signal.available ? 'text-text-primary' : 'text-text-secondary/45'}`}>
        {signalValue(signal)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[0.68rem] text-text-secondary/65">
        <div>
          <div className="mb-1 flex justify-between gap-2"><span>confidence</span><span>{percentage(signal.confidence)}</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan/60" style={{ width: percentage(signal.confidence) }} /></div>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2"><span>observable</span><span>{percentage(signal.observability)}</span></div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/45" style={{ width: percentage(signal.observability) }} /></div>
        </div>
      </div>
      <p className="mt-4 text-[0.68rem] leading-5 text-text-secondary/55">{signal.claim_boundary}</p>
    </article>
  );
}

function SleepPanel({ snapshot }: { snapshot: PersonaSnapshot }) {
  if (!snapshot.sleep) {
    return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-text-secondary/60">Sleep estimate abstained or is not present in this snapshot.</div>;
  }
  const stages = [
    ['wake', snapshot.sleep.wake],
    ['light', snapshot.sleep.light],
    ['deep', snapshot.sleep.deep],
    ['REM', snapshot.sleep.rem],
  ] as const;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cyan/60">four-stage research estimate</p>
          <p className="mt-1 text-sm text-text-primary">dominant: {dominantSleepStage(snapshot)}</p>
        </div>
        <span className="font-mono text-[0.65rem] text-text-secondary/60">{snapshot.sleep.reference_status}</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {stages.map(([stage, value]) => (
          <div key={stage} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-xs">
            <span className="text-text-secondary/70">{stage}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan/55" style={{ width: percentage(value) }} /></div>
            <span className="text-right font-mono text-text-secondary/55">{percentage(value)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[0.68rem] leading-5 text-text-secondary/55">{snapshot.sleep.claim_boundary}</p>
    </div>
  );
}

function rgbToSoftHex(red: number, green: number, blue: number): string {
  const soften = (value: number) => Math.round(value * 0.62 + 255 * 0.38);
  return `#${[soften(red), soften(green), soften(blue)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function PhysiologyPersonaLab() {
  const [snapshot, setSnapshot] = useState<PersonaSnapshot>(() => createDemoPersonaSnapshot(0));
  const [source, setSource] = useState<'demo' | 'file'>('demo');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mood, setMood] = useState<PersonaMoodSelfReport>('curious');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [cameraState, setCameraState] = useState<'off' | 'active' | 'error'>('off');
  const [cameraMessage, setCameraMessage] = useState('camera is off');
  const startedAt = useRef<number>(Date.now());
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const world = usePersonaWorld('curious');

  const recommendedBiome = suggestBiome(world.profile, mood);
  const recommendedActivity = suggestActivity(world.profile, recommendedBiome, mood);
  const recommendationCopy = explainRecommendation(world.profile, recommendedBiome, mood);
  const biomeDefinition = BIOMES[world.biome];
  const activityDefinition = ACTIVITIES[world.activity];

  useEffect(() => {
    if (source !== 'demo') return;
    const update = () => setSnapshot(createDemoPersonaSnapshot((Date.now() - startedAt.current) / 1000));
    const interval = window.setInterval(update, 650);
    return () => window.clearInterval(interval);
  }, [source]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('off');
    setCameraMessage('camera is off');
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setCameraMessage('requesting local camera permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('active');
      setCameraMessage('local camera active; frames are not uploaded');
    } catch (error) {
      console.error(error);
      setCameraState('error');
      setCameraMessage('camera permission unavailable');
    }
  };

  const sampleAppearance = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setCameraMessage('camera frame is not ready yet');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < 25 || brightness > 245) continue;
      red += r;
      green += g;
      blue += b;
      count += 1;
    }
    if (count === 0) {
      setCameraMessage('not enough visual information to sample an appearance seed');
      return;
    }
    setAccent(rgbToSoftHex(red / count, green / count, blue / count));
    setCameraMessage('appearance seed sampled locally; only the derived color is retained');
  };

  const loadSnapshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const parsed = PersonaSnapshotSchema.parse(raw);
      setSnapshot(parsed);
      setSource('file');
      setFileName(file.name);
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError('That file is not a valid physioatlas.persona.v1 snapshot.');
    }
  };

  const resetDemo = () => {
    startedAt.current = Date.now();
    setSource('demo');
    setFileName(null);
    setLoadError(null);
    setSnapshot(createDemoPersonaSnapshot(0));
  };

  const downloadProfile = () => {
    const blob = new Blob([JSON.stringify(world.profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'physio-persona-world.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-cyan/20 bg-cyan/[0.045] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan/80" />
          <div>
            <p className="text-sm font-medium text-text-primary">a tiny local nature world that learns from choices, not diagnoses</p>
            <p className="mt-1 max-w-4xl text-xs leading-6 text-text-secondary/70">
              Mood changes this visit&apos;s atmosphere. Only explicit world and activity choices update the persistent persona. The preference vector, adventure history, and world affinities stay in this browser and can be edited, exported, or erased at any time.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.38fr)_minmax(22rem,0.62fr)]">
        <div>
          <PhysioPersonaScene
            snapshot={snapshot}
            mood={mood}
            accent={accent}
            biome={world.biome}
            activity={world.activity}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.68rem] text-text-secondary/55">
            <span>drag to orbit · scroll to zoom · the world is procedural and local-first</span>
            <span className="font-mono">observability {percentage(snapshot.overall_observability)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.028] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cyan/60">right now</p>
                <h2 className="mt-1 text-base font-medium text-text-primary">{biomeDefinition.icon} {biomeDefinition.name}</h2>
                <p className="mt-2 text-xs leading-5 text-text-secondary/65">{biomeDefinition.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[0.62rem] text-text-secondary/60">visit {world.profile.visits}</span>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
              <p className="text-xs text-text-primary">{activityDefinition.icon} {activityDefinition.name}</p>
              <p className="mt-1 text-[0.68rem] leading-5 text-text-secondary/55">{activityDefinition.description}</p>
            </div>
            <button
              type="button"
              onClick={() => world.wander(mood)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan/25 bg-cyan/[0.06] px-4 text-sm text-cyan/90 transition hover:border-cyan/45 hover:bg-cyan/[0.1]"
            >
              <Compass className="h-4 w-4" /> let the little explorer wander
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">how does this visit feel?</h2>
            </div>
            <p className="mt-2 text-[0.68rem] leading-5 text-text-secondary/55">Self-report only. Mood changes lighting, pace, and recommendations, but it is not written into the persistent trait vector.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {MOODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMood(item.value)}
                  className={`rounded-xl border p-3 text-left transition ${mood === item.value ? 'border-cyan/40 bg-cyan/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                >
                  <span className="text-xs font-medium text-text-primary">{item.icon} {item.label}</span>
                  <span className="mt-1 block text-[0.62rem] leading-4 text-text-secondary/50">{item.copy}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">world map</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.values(BIOMES).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => world.chooseBiome(item.id, mood)}
                  className={`rounded-xl border p-3 text-left transition ${world.biome === item.id ? 'border-cyan/40 bg-cyan/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                >
                  <span className="text-xs text-text-primary">{item.icon} {item.shortName}</span>
                  <span className="mt-1 block font-mono text-[0.58rem] text-text-secondary/45">affinity {percentage(world.profile.biomeAffinity[item.id])}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan/70" />
            <h2 className="font-mono text-sm text-text-primary">what should the tiny creature do?</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-secondary/60">The available tasks change with the biome. Choosing one becomes a tiny transparent training signal.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {biomeDefinition.activities.map((activityId) => {
              const item = ACTIVITIES[activityId];
              return (
                <button
                  key={activityId}
                  type="button"
                  onClick={() => world.chooseActivity(activityId, mood)}
                  className={`min-h-10 rounded-full border px-3 text-xs transition ${world.activity === activityId ? 'border-cyan/40 bg-cyan/[0.08] text-cyan' : 'border-white/10 bg-white/[0.025] text-text-secondary hover:border-white/20 hover:text-text-primary'}`}
                >
                  {item.icon} {item.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">world director suggestion</h2>
            </div>
            <span className="font-mono text-[0.62rem] text-text-secondary/45">transparent recommendation</span>
          </div>
          <div className="mt-4 rounded-xl border border-cyan/15 bg-cyan/[0.035] p-4">
            <p className="text-sm text-text-primary">{BIOMES[recommendedBiome].icon} {BIOMES[recommendedBiome].name} · {ACTIVITIES[recommendedActivity].icon} {ACTIVITIES[recommendedActivity].name}</p>
            <p className="mt-2 text-xs leading-6 text-text-secondary/60">{recommendationCopy}</p>
            <button
              type="button"
              onClick={() => world.chooseBiome(recommendedBiome, mood)}
              className="mt-3 min-h-9 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/30 hover:text-cyan"
            >
              go there
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">inspectable persona</h2>
            </div>
            <span className="font-mono text-[0.62rem] text-text-secondary/45">localStorage only</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-secondary/60">These are game preferences, not psychological traits. Drag any slider to correct the persona directly.</p>
          <div className="mt-5 space-y-4">
            {TRAITS.map((trait) => (
              <div key={trait}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-text-primary">{TRAIT_LABELS[trait]}</p>
                    <p className="mt-0.5 text-[0.62rem] text-text-secondary/45">{TRAIT_COPY[trait]}</p>
                  </div>
                  <span className="font-mono text-[0.68rem] text-text-secondary/55">{percentage(world.profile.traits[trait])}</span>
                </div>
                <input
                  aria-label={TRAIT_LABELS[trait]}
                  className="mt-2 w-full cursor-pointer"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(world.profile.traits[trait] * 100)}
                  onChange={(event) => world.setTrait(trait, Number(event.target.value) / 100)}
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={downloadProfile} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-white/20 hover:text-text-primary"><Download className="h-3.5 w-3.5" /> export profile</button>
            <button type="button" onClick={() => world.reset(mood)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-rose-300/25 hover:text-rose-200"><RotateCcw className="h-3.5 w-3.5" /> reset local persona</button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">tiny adventure log</h2>
            </div>
            <span className="font-mono text-[0.62rem] text-text-secondary/45">{world.profile.adventures} adventures</span>
          </div>
          {world.profile.memories.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs leading-6 text-text-secondary/50">No tiny history yet. Pick a world or task and the creature will begin accumulating very serious field notes.</div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {world.profile.memories.slice(0, 7).map((memory) => (
                <div key={memory.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-cyan/50">{BIOMES[memory.biome].shortName}</span>
                    <span className="text-[0.58rem] text-text-secondary/35">{new Date(memory.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-text-secondary/65">{memory.note}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-4 w-4 text-cyan/70" />
            <div>
              <h2 className="font-mono text-sm text-text-primary">research + evidence layer</h2>
              <p className="mt-1 text-[0.68rem] text-text-secondary/50">Open the machinery underneath the tiny world.</p>
            </div>
          </div>
          <span className="font-mono text-[0.62rem] text-text-secondary/45 group-open:hidden">show</span>
          <span className="hidden font-mono text-[0.62rem] text-text-secondary/45 group-open:inline">hide</span>
        </summary>
        <div className="border-t border-white/10 p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-cyan/70" /><h3 className="font-mono text-sm text-text-primary">evidence source</h3></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={resetDemo} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"><RotateCcw className="h-3.5 w-3.5" /> demo stream</button>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"><Upload className="h-3.5 w-3.5" /> local snapshot<input className="sr-only" type="file" accept="application/json,.json" onChange={loadSnapshot} /></label>
              </div>
              <p className="mt-3 text-[0.68rem] leading-5 text-text-secondary/55">{source === 'demo' ? 'Synthetic stream is active.' : `Local replay: ${fileName ?? 'snapshot'}. No upload occurs.`}</p>
              {loadError && <p className="mt-2 text-xs text-rose-300/80">{loadError}</p>}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">{cameraState === 'active' ? <Camera className="h-4 w-4 text-cyan/70" /> : <CameraOff className="h-4 w-4 text-text-secondary/50" />}<h3 className="font-mono text-sm text-text-primary">local appearance seed</h3></div>
                <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: accent }} aria-label="avatar accent" />
              </div>
              <video ref={videoRef} muted playsInline className="mt-4 aspect-video w-full rounded-lg border border-white/10 bg-black/30 object-cover" />
              <div className="mt-3 flex flex-wrap gap-2">
                {cameraState !== 'active' ? (
                  <button type="button" onClick={startCamera} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"><Camera className="h-3.5 w-3.5" /> enable camera</button>
                ) : (
                  <><button type="button" onClick={sampleAppearance} className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan">sample appearance</button><button type="button" onClick={stopCamera} className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-white/25 hover:text-text-primary">camera off</button></>
                )}
              </div>
              <p className="mt-3 text-[0.68rem] leading-5 text-text-secondary/55">{cameraMessage}</p>
            </section>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {snapshot.signals.map((signal) => <SignalCard key={signal.key} signal={signal} />)}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)]">
            <SleepPanel snapshot={snapshot} />
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan/70" /><h3 className="font-mono text-sm text-text-primary">privacy boundary</h3></div>
              <div className="mt-4 space-y-2 text-xs text-text-secondary/60">
                <p>raw RF: {snapshot.privacy.raw_rf_included ? 'included' : 'not included'}</p>
                <p>raw camera: {snapshot.privacy.raw_camera_included ? 'included' : 'not included'}</p>
                <p>biometric template: {snapshot.privacy.biometric_template_included ? 'included' : 'not included'}</p>
                <p>mode: {snapshot.mode}</p>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
