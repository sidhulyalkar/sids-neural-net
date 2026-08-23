'use client';

// Diagnostic instrument for the local sensing stack. It exposes camera health,
// observable facial activations, hand landmarks and gesture state without
// assigning psychological meaning or uploading sensor data.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraSession } from '@/lib/media/CameraSession';
import { blendshapesToExpression, EXPRESSION_SIGNALS } from '../expression';
import { useFaceLandmarker } from '../useFaceLandmarker';
import { useGestureRecognizer } from '../useGestureRecognizer';
import { initialGestureTracker, isPinching, updateGestureTracker, type GesturePoint } from '../gestures';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const GESTURE_LABELS = ['raise_right', 'raise_left', 'open_palm', 'fist', 'thumb_up', 'clap', 'hammer_down', 'circle'] as const;

type DiagnosticFrame = {
  brightness: number;
  faceFound: boolean;
  handFound: boolean;
  gesture: string;
  gestureScore: number;
  expressionSignals: Record<string, number>;
  pinch: boolean;
  fps: number;
  delegates: string;
  lastAction: string;
};

const EMPTY: DiagnosticFrame = {
  brightness: 0,
  faceFound: false,
  handFound: false,
  gesture: '—',
  gestureScore: 0,
  expressionSignals: {},
  pinch: false,
  fps: 0,
  delegates: '…',
  lastAction: 'none',
};

function meanLuma(context: CanvasRenderingContext2D, width: number, height: number) {
  const data = context.getImageData(0, 0, width, height).data;
  let sum = 0;
  let samples = 0;
  for (let index = 0; index < data.length; index += 64) {
    sum += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    samples += 1;
  }
  return samples ? sum / samples : 0;
}

function drawHand(canvas: HTMLCanvasElement, landmarks: GesturePoint[] | null) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.strokeStyle = '#66e3ff';
  context.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const from = landmarks[a];
    const to = landmarks[b];
    if (!from || !to) continue;
    context.beginPath();
    context.moveTo(from.x * canvas.width, from.y * canvas.height);
    context.lineTo(to.x * canvas.width, to.y * canvas.height);
    context.stroke();
  }
  context.fillStyle = '#a78bfa';
  for (const point of landmarks) {
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2"><span className="text-slate-500">{label}</span><span className="font-mono text-xs text-slate-200">{value}</span></div>;
}

export function SensingLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<() => void>(() => undefined);
  const trackerRef = useRef(initialGestureTracker());
  const lastRef = useRef(0);
  const recordingRef = useRef(false);
  const captureRef = useRef<unknown[]>([]);
  const labelRef = useRef<string>(GESTURE_LABELS[0]);

  const [status, setStatus] = useState('idle');
  const [diag, setDiag] = useState<DiagnosticFrame>(EMPTY);
  const [runFace, setRunFace] = useState(false);
  const [runHand, setRunHand] = useState(true);
  const [recording, setRecording] = useState(false);
  const [label, setLabel] = useState<string>(GESTURE_LABELS[0]);
  const [sampleCount, setSampleCount] = useState(0);

  const { load: loadFace, detect: detectFace, close: closeFace, getDelegate: faceDelegate } = useFaceLandmarker();
  const { load: loadHand, detect: detectHand, close: closeHand, getDelegate: handDelegate } = useGestureRecognizer();

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  useEffect(() => {
    tickRef.current = () => {
      rafRef.current = requestAnimationFrame(() => tickRef.current());
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const probe = probeRef.current;
      if (!video || !overlay || !probe || video.readyState < 2 || document.hidden) return;

      const now = performance.now();
      const cpuMode = faceDelegate() === 'CPU' || handDelegate() === 'CPU';
      if (now - lastRef.current < 1000 / (cpuMode ? 7 : 30)) return;
      const previous = lastRef.current;
      lastRef.current = now;

      const probeContext = probe.getContext('2d', { willReadFrequently: true });
      if (!probeContext) return;
      probeContext.drawImage(video, 0, 0, probe.width, probe.height);

      const next: DiagnosticFrame = {
        ...EMPTY,
        brightness: meanLuma(probeContext, probe.width, probe.height),
        fps: previous ? Math.round(1000 / (now - previous)) : 0,
        delegates: `face ${faceDelegate() ?? '…'} · hand ${handDelegate() ?? '…'}`,
      };

      if (runFace) {
        try {
          const blendshapes = detectFace(video, now);
          if (blendshapes) {
            next.faceFound = true;
            next.expressionSignals = blendshapesToExpression(blendshapes).signals;
          }
        } catch (error) {
          setStatus(`face: ${error instanceof Error ? error.message : 'inference failed'}`);
        }
      }

      let landmarks: GesturePoint[] | null = null;
      if (runHand) {
        try {
          const observation = detectHand(video, now);
          if (observation) {
            landmarks = observation.landmarks;
            next.handFound = true;
            next.gesture = observation.gesture;
            next.gestureScore = observation.confidence;
            next.pinch = isPinching(observation.landmarks);
          }
          const update = updateGestureTracker(trackerRef.current, observation, now);
          trackerRef.current = update.tracker;
          if (update.action) next.lastAction = update.action.type;

          if (recordingRef.current) {
            captureRef.current.push({
              t: Math.round(now),
              label: labelRef.current,
              gesture: observation?.gesture ?? null,
              confidence: observation?.confidence ?? 0,
              handedness: observation?.handedness ?? null,
              landmarks: observation?.landmarks.map((point) => [Number(point.x.toFixed(4)), Number(point.y.toFixed(4)), Number((point.z ?? 0).toFixed(4))]) ?? null,
            });
            setSampleCount(captureRef.current.length);
          }
        } catch (error) {
          setStatus(`hand: ${error instanceof Error ? error.message : 'inference failed'}`);
        }
      }

      setDiag((current) => ({ ...next, lastAction: next.lastAction === 'none' ? current.lastAction : next.lastAction }));
      drawHand(overlay, landmarks);
    };
  }, [detectFace, detectHand, faceDelegate, handDelegate, runFace, runHand]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    cameraRef.current?.stop();
    const camera = new CameraSession();
    cameraRef.current = camera;
    setStatus('requesting camera');
    try {
      await camera.start(video, { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } });
      setStatus('loading models');
      await Promise.all([loadFace(), loadHand()]);
      trackerRef.current = initialGestureTracker();
      lastRef.current = 0;
      setStatus('running');
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch (error) {
      camera.stop();
      setStatus(`failed: ${error instanceof Error ? error.message : 'camera/model startup failed'}`);
    }
  }, [loadFace, loadHand]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    cameraRef.current?.stop();
    closeFace();
    closeHand();
  }, [closeFace, closeHand]);

  const toggleRecording = () => {
    const next = !recordingRef.current;
    recordingRef.current = next;
    if (next) {
      captureRef.current = [];
      setSampleCount(0);
    }
    setRecording(next);
  };

  const download = () => {
    const jsonl = captureRef.current.map((sample) => JSON.stringify(sample)).join('\n');
    const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gesture-takes-${Date.now()}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#020306] p-5 text-slate-200 sm:p-7">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan/70">local instrument · no upload</p>
        <h1 className="mt-2 text-2xl font-light">Sensing Lab</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Camera health, observable facial activation and hand-gesture diagnostics. No emotion or mental-state classifier is used.</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} className="border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">Start camera</button>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={runHand} onChange={(event) => setRunHand(event.target.checked)} /> hand model</label>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={runFace} onChange={(event) => setRunFace(event.target.checked)} /> face model</label>
          <span className="font-mono text-xs text-slate-500">{status} · {diag.fps} fps</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,640px)_1fr]">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-white/10 bg-black">
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
            <canvas ref={overlayRef} width={640} height={480} className="absolute inset-0 h-full w-full -scale-x-100" />
            <canvas ref={probeRef} width={160} height={120} className="hidden" />
          </div>

          <aside className="border border-white/10 bg-white/[0.02] p-4">
            <Metric label="camera luma" value={diag.brightness.toFixed(1)} />
            <Metric label="delegates" value={diag.delegates} />
            <Metric label="face" value={runFace ? (diag.faceFound ? 'detected' : 'searching') : 'disabled'} />
            <Metric label="hand" value={runHand ? (diag.handFound ? 'detected' : 'searching') : 'disabled'} />
            <Metric label="gesture" value={`${diag.gesture} ${diag.gestureScore.toFixed(2)}`} />
            <Metric label="pinch" value={diag.pinch ? 'active' : 'inactive'} />
            <Metric label="last action" value={diag.lastAction} />

            {runFace && <div className="mt-5 space-y-2">{EXPRESSION_SIGNALS.map((signal) => {
              const value = diag.expressionSignals[signal] ?? 0;
              return <div key={signal} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-xs"><span className="text-slate-500">{signal}</span><div className="h-1 bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${Math.round(value * 100)}%` }} /></div><span className="text-right font-mono text-slate-400">{value.toFixed(2)}</span></div>;
            })}</div>}
          </aside>
        </div>

        <section className="mt-6 border border-white/10 bg-white/[0.015] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={label} onChange={(event) => setLabel(event.target.value)} className="border border-white/10 bg-black px-3 py-2 text-xs">{GESTURE_LABELS.map((value) => <option key={value}>{value}</option>)}</select>
            <button type="button" onClick={toggleRecording} className={`border px-3 py-2 text-xs ${recording ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : 'border-white/10 text-slate-300'}`}>{recording ? 'Stop capture' : 'Capture calibration take'}</button>
            <button type="button" onClick={download} disabled={!sampleCount} className="border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-30">Download JSONL</button>
            <span className="font-mono text-[10px] text-slate-500">{sampleCount} local samples</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Calibration samples exist only in memory until you explicitly download them. They are never sent to the site or committed automatically.</p>
        </section>
      </div>
    </main>
  );
}
