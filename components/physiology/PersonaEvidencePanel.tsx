'use client';

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, FileJson, FlaskConical, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { CameraSession } from '@/lib/media/CameraSession';
import {
  PersonaSnapshotSchema,
  dominantSleepStage,
  type PersonaSignal,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signalValue(signal: PersonaSignal): string {
  if (!signal.available || signal.value === null) return 'unknown';
  if (typeof signal.value === 'number') return `${signal.value}${signal.unit ? ` ${signal.unit}` : ''}`;
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
        <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-text-secondary/70">{signal.evidence}</span>
      </div>
      <p className={`mt-4 font-mono text-xl ${signal.available ? 'text-text-primary' : 'text-text-secondary/45'}`}>{signalValue(signal)}</p>
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
  const stages = [['wake', snapshot.sleep.wake], ['light', snapshot.sleep.light], ['deep', snapshot.sleep.deep], ['REM', snapshot.sleep.rem]] as const;
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

type Props = {
  snapshot: PersonaSnapshot;
  sourceLabel: string;
  accent: string;
  onAccent: (accent: string) => void;
  onSnapshot: (snapshot: PersonaSnapshot, fileName: string) => void;
  onResetDemo: () => void;
};

export function PersonaEvidencePanel({ snapshot, sourceLabel, accent, onAccent, onSnapshot, onResetDemo }: Props) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<'off' | 'active' | 'error'>('off');
  const [cameraMessage, setCameraMessage] = useState('camera is off');
  const cameraRef = useRef<CameraSession | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    setCameraState('off');
    setCameraMessage('camera is off');
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    const video = videoRef.current;
    if (!video) {
      setCameraState('error');
      setCameraMessage('camera surface is unavailable');
      return;
    }
    setCameraMessage('requesting local camera permission...');
    try {
      const camera = cameraRef.current ?? new CameraSession();
      cameraRef.current = camera;
      await camera.start(video, { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' });
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
    let red = 0; let green = 0; let blue = 0; let count = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      const r = pixels[index]; const g = pixels[index + 1]; const b = pixels[index + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < 25 || brightness > 245) continue;
      red += r; green += g; blue += b; count += 1;
    }
    if (count === 0) {
      setCameraMessage('not enough visual information to sample an appearance seed');
      return;
    }
    onAccent(rgbToSoftHex(red / count, green / count, blue / count));
    setCameraMessage('appearance seed sampled locally; only the derived color is retained');
  };

  const loadSnapshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = PersonaSnapshotSchema.parse(JSON.parse(await file.text()));
      onSnapshot(parsed, file.name);
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError('That file is not a valid physioatlas.persona.v1 snapshot.');
    }
  };

  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3"><FlaskConical className="h-4 w-4 text-cyan/70" /><div><h2 className="font-mono text-sm text-text-primary">research + evidence layer</h2><p className="mt-1 text-[0.68rem] text-text-secondary/50">Open the scientific machinery underneath the playful atlas.</p></div></div>
        <span className="font-mono text-[0.62rem] text-text-secondary/45 group-open:hidden">show</span><span className="hidden font-mono text-[0.62rem] text-text-secondary/45 group-open:inline">hide</span>
      </summary>
      <div className="border-t border-white/10 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-cyan/70" /><h3 className="font-mono text-sm text-text-primary">evidence source</h3></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onResetDemo} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"><RotateCcw className="h-3.5 w-3.5" /> demo stream</button>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"><Upload className="h-3.5 w-3.5" /> local snapshot<input className="sr-only" type="file" accept="application/json,.json" onChange={loadSnapshot} /></label>
            </div>
            <p className="mt-3 text-[0.68rem] text-text-secondary/55">source: {sourceLabel}</p>
            {loadError && <p className="mt-2 text-[0.68rem] text-rose-200/80">{loadError}</p>}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Camera className="h-4 w-4 text-cyan/70" /><h3 className="font-mono text-sm text-text-primary">local appearance seed</h3></div><div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: accent }} aria-label="avatar accent" /></div>
            <video ref={videoRef} muted playsInline className="mt-4 aspect-video w-full rounded-lg border border-white/10 bg-black/30 object-cover" />
            <div className="mt-3 flex flex-wrap gap-2">
              {cameraState !== 'active'
                ? <button type="button" onClick={startCamera} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan"><Camera className="h-3.5 w-3.5" /> enable camera</button>
                : <><button type="button" onClick={sampleAppearance} className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-cyan/35 hover:text-cyan">sample appearance</button><button type="button" onClick={stopCamera} className="min-h-10 rounded-md border border-white/10 px-3 text-xs text-text-secondary hover:border-white/25 hover:text-text-primary">camera off</button></>}
            </div>
            <p className="mt-3 text-[0.68rem] leading-5 text-text-secondary/55">{cameraMessage}</p>
          </section>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">{snapshot.signals.map((signal) => <SignalCard key={signal.key} signal={signal} />)}</div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)]">
          <SleepPanel snapshot={snapshot} />
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan/70" /><h3 className="font-mono text-sm text-text-primary">privacy boundary</h3></div>
            <div className="mt-4 space-y-2 text-xs text-text-secondary/60"><p>raw RF: {snapshot.privacy.raw_rf_included ? 'included' : 'not included'}</p><p>raw camera: {snapshot.privacy.raw_camera_included ? 'included' : 'not included'}</p><p>biometric template: {snapshot.privacy.biometric_template_included ? 'included' : 'not included'}</p><p>mode: {snapshot.mode}</p></div>
          </div>
        </div>
      </div>
    </details>
  );
}
