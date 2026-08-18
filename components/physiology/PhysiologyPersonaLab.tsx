'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  CameraOff,
  FileJson,
  FlaskConical,
  Moon,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { PhysioPersonaScene } from '@/components/physiology/PhysioPersonaScene';
import { createDemoPersonaSnapshot } from '@/lib/physiology/demo';
import {
  PersonaSnapshotSchema,
  dominantSleepStage,
  type PersonaMoodSelfReport,
  type PersonaSignal,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';

const MOODS: Array<{ value: PersonaMoodSelfReport; label: string; copy: string }> = [
  { value: 'calm', label: 'calm', copy: 'slower, softer idle motion' },
  { value: 'curious', label: 'curious', copy: 'more attentive exploration' },
  { value: 'energized', label: 'energized', copy: 'bouncier movement' },
  { value: 'sleepy', label: 'sleepy', copy: 'heavy eyes and quiet motion' },
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
          <div className="mb-1 flex justify-between gap-2">
            <span>confidence</span>
            <span>{percentage(signal.confidence)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan/60" style={{ width: percentage(signal.confidence) }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2">
            <span>observable</span>
            <span>{percentage(signal.observability)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white/45" style={{ width: percentage(signal.observability) }} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-[0.68rem] leading-5 text-text-secondary/55">{signal.claim_boundary}</p>
    </article>
  );
}

function SleepPanel({ snapshot }: { snapshot: PersonaSnapshot }) {
  if (!snapshot.sleep) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-text-secondary/60">
        Sleep estimate abstained or is not present in this snapshot.
      </div>
    );
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
        <span className="font-mono text-[0.65rem] text-text-secondary/60">
          {snapshot.sleep.reference_status}
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {stages.map(([stage, value]) => (
          <div key={stage} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-xs">
            <span className="text-text-secondary/70">{stage}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan/55" style={{ width: percentage(value) }} />
            </div>
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
  return `#${[soften(red), soften(green), soften(blue)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
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

  useEffect(() => {
    if (source !== 'demo') return;
    const update = () => {
      setSnapshot(createDemoPersonaSnapshot((Date.now() - startedAt.current) / 1000));
    };
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

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-cyan/20 bg-cyan/[0.045] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-cyan/80" />
          <div>
            <p className="text-sm font-medium text-text-primary">research demo, not a health assessment</p>
            <p className="mt-1 max-w-4xl text-xs leading-6 text-text-secondary/70">
              The avatar only consumes presentation-safe evidence objects. Weak values can abstain. Synthetic values are labelled synthetic. A local JSON replay never leaves this browser.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
        <div>
          <PhysioPersonaScene snapshot={snapshot} mood={mood} accent={accent} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.68rem] text-text-secondary/55">
            <span>drag to orbit · scroll to zoom · avatar motion is evidence-reactive</span>
            <span className="font-mono">observability {percentage(snapshot.overall_observability)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">evidence source</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetDemo}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-text-secondary transition hover:border-cyan/35 hover:text-cyan"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                demo stream
              </button>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-text-secondary transition hover:border-cyan/35 hover:text-cyan">
                <Upload className="h-3.5 w-3.5" />
                load local snapshot
                <input className="sr-only" type="file" accept="application/json,.json" onChange={loadSnapshot} />
              </label>
            </div>
            <p className="mt-3 text-[0.68rem] leading-5 text-text-secondary/55">
              {source === 'demo' ? 'Synthetic stream is active.' : `Local replay: ${fileName ?? 'snapshot'}. No upload occurs.`}
            </p>
            {loadError && <p className="mt-2 text-xs text-rose-300/80">{loadError}</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {cameraState === 'active' ? <Camera className="h-4 w-4 text-cyan/70" /> : <CameraOff className="h-4 w-4 text-text-secondary/50" />}
                <h2 className="font-mono text-sm text-text-primary">local appearance seed</h2>
              </div>
              <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: accent }} aria-label="avatar accent" />
            </div>

            <video ref={videoRef} muted playsInline className="mt-4 aspect-video w-full rounded-lg border border-white/10 bg-black/30 object-cover" />
            <div className="mt-3 flex flex-wrap gap-2">
              {cameraState !== 'active' ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"
                >
                  <Camera className="h-3.5 w-3.5" /> enable camera
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={sampleAppearance}
                    className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"
                  >
                    sample appearance
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-white/25 hover:text-text-primary"
                  >
                    camera off
                  </button>
                </>
              )}
            </div>
            <p className="mt-3 text-[0.68rem] leading-5 text-text-secondary/55">{cameraMessage}</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan/70" />
              <h2 className="font-mono text-sm text-text-primary">self-report animation</h2>
            </div>
            <p className="mt-2 text-[0.68rem] leading-5 text-text-secondary/55">
              This is intentionally user-labelled. The camera is not treated as ground-truth mood.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {MOODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    mood === option.value
                      ? 'border-cyan/40 bg-cyan/[0.08] text-cyan'
                      : 'border-white/10 bg-white/[0.02] text-text-secondary hover:border-white/20'
                  }`}
                >
                  <span className="block text-xs font-medium">{option.label}</span>
                  <span className="mt-1 block text-[0.62rem] leading-4 opacity-60">{option.copy}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan/70" />
          <h2 className="font-mono text-sm text-text-primary">live evidence objects</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.signals.map((signal) => (
            <SignalCard key={signal.key} signal={signal} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Moon className="h-4 w-4 text-cyan/70" />
            <h2 className="font-mono text-sm text-text-primary">sleep-state layer</h2>
          </div>
          <SleepPanel snapshot={snapshot} />
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan/70" />
            <h2 className="font-mono text-sm text-text-primary">privacy contract</h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary/70">
              <span>raw RF</span><span className="text-right text-emerald-200/75">excluded</span>
              <span>raw camera</span><span className="text-right text-emerald-200/75">excluded</span>
              <span>biometric template</span><span className="text-right text-emerald-200/75">excluded</span>
              <span>identity</span><span className="text-right">{snapshot.privacy.identity_included ? 'consented alias' : 'anonymous'}</span>
              <span>processing preference</span><span className="text-right">{snapshot.privacy.local_processing_preferred ? 'local' : 'unspecified'}</span>
            </div>
            <p className="mt-4 border-t border-white/10 pt-4 text-[0.68rem] leading-5 text-text-secondary/55">
              Schema: {snapshot.schema_version}. Clinical claims are disabled by contract.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
