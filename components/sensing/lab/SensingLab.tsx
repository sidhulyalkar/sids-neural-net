'use client';

// Diagnostic instrument for the local sensing stack. It intentionally exposes
// camera health, raw observable facial activations, hand landmarks and gesture
// state so failures can be localized without assigning psychological meaning.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraSession } from '@/lib/media/CameraSession';
import { blendshapesToExpression, EXPRESSION_SIGNALS } from '../expression';
import { useFaceLandmarker } from '../useFaceLandmarker';
import { useGestureRecognizer } from '../useGestureRecognizer';
import {
  initialGestureTracker,
  isHammerPose,
  isPinching,
  isSecretCirclePose,
  updateGestureTracker,
  type GesturePoint,
} from '../gestures';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const GESTURE_LABELS = ['raise_right', 'raise_left', 'open_palm', 'fist', 'thumb_up', 'clap', 'hammer_down', 'circle'] as const;
const IDLE_LABELS = ['idle', 'idle_typing', 'idle_talking', 'idle_reading', 'idle_reaching'] as const;

type Diag = {
  brightness: number;
  faceFound: boolean;
  handFound: boolean;
  gesture: string;
  gestureScore: number;
  expressionSignals: Record<string, number>;
  topBlendshapes: string[];
  pinchRatio: number;
  pinching: boolean;
  hammerPose: boolean;
  secretPose: boolean;
  lastAction: string;
  fps: number;
  delegates: string;
  handedness: string;
  raised: string;
  hands: string;
};

const EMPTY: Diag = {
  brightness: 0,
  faceFound: false,
  handFound: false,
  gesture: '-',
  gestureScore: 0,
  expressionSignals: {},
  topBlendshapes: [],
  pinchRatio: 0,
  pinching: false,
  hammerPose: false,
  secretPose: false,
  lastAction: 'none',
  fps: 0,
  delegates: '…',
  handedness: '—',
  raised: '—',
  hands: 'none',
};

function meanLuma(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const { data } = ctx.getImageData(0, 0, width, height);
  let sum = 0;
  let samples = 0;
  for (let i = 0; i < data.length; i += 64) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    samples += 1;
  }
  return samples ? sum / samples : 0;
}

function palmWidth(landmarks: GesturePoint[]): number {
  const a = landmarks[5];
  const b = landmarks[17];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

export function SensingLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const trackerRef = useRef(initialGestureTracker());
  const lastRef = useRef(0);
  const recordingRef = useRef(false);
  const labelRef = useRef<string>(GESTURE_LABELS[0]);
  const takesRef = useRef<unknown[]>([]);
  const runFaceRef = useRef(false);
  const runHandRef = useRef(true);
  const errorRef = useRef('');

  const [status, setStatus] = useState('idle');
  const [diag, setDiag] = useState<Diag>(EMPTY);
  const [recording, setRecording] = useState(false);
  const [label, setLabel] = useState<string>(GESTURE_LABELS[0]);
  const [takeCount, setTakeCount] = useState(0);
  const [runFace, setRunFace] = useState(false);
  const [runHand, setRunHand] = useState(true);
  runFaceRef.current = runFace;
  runHandRef.current = runHand;

  const { load: loadFace, detect: detectFace, close: closeFace, getDelegate: faceDelegate } = useFaceLandmarker();
  const { load: loadHand, detect: detectHand, close: closeHand, getDelegate: handDelegate } = useGestureRecognizer();

  const reportError = useCallback((stage: string, error: unknown) => {
    const line = `${stage} error: ${String((error as Error)?.message ?? error).split('\n')[0].slice(0, 160)}`;
    if (errorRef.current === line) return;
    errorRef.current = line;
    setStatus(line);
  }, []);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const video = videoRef.current;
    const probe = probeRef.current;
    const overlay = overlayRef.current;
    if (!video || !probe || !overlay || video.readyState < 2 || document.hidden) return;

    const onCpu = faceDelegate() === 'CPU' || handDelegate() === 'CPU';
    const now = performance.now();
    if (now - lastRef.current < 1000 / (onCpu ? 6 : 30)) return;
    const previous = lastRef.current;
    lastRef.current = now;

    const probeContext = probe.getContext('2d', { willReadFrequently: true });
    if (!probeContext) return;
    probeContext.drawImage(video, 0, 0, probe.width, probe.height);

    const next: Diag = {
      ...EMPTY,
      brightness: meanLuma(probeContext, probe.width, probe.height),
      fps: previous ? Math.round(1000 / (now - previous)) : 0,
      delegates: `face ${faceDelegate() ?? '…'} · hand ${handDelegate() ?? '…'}`,
    };

    try {
      const blendshapes = runFaceRef.current ? detectFace(video, now) : null;
      if (blendshapes) {
        next.faceFound = true;
        next.expressionSignals = blendshapesToExpression(blendshapes).signals;
        next.topBlendshapes = Object.entries(blendshapes)
          .filter(([key]) => key !== '_neutral')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key, value]) => `${key} ${value.toFixed(2)}`);
      }
    } catch (error) {
      reportError('face', error);
    }

    let landmarks: GesturePoint[] | null = null;
    try {
      const observation = runHandRef.current ? detectHand(video, now) : null;
      if (observation) {
        landmarks = observation.landmarks;
        next.handFound = true;
        next.gesture = observation.gesture;
        next.gestureScore = observation.confidence;
        const palmY = [0, 5, 9, 13, 17].reduce((sum, index) => sum + (observation.landmarks[index]?.y ?? 0), 0) / 5;
        next.handedness = observation.handedness ?? '—';
        next.hands = observation.other ? 'two' : 'one';
        next.raised = palmY <= 0.42 ? `raised (${palmY.toFixed(2)})` : `down (${palmY.toFixed(2)})`;
        const width = palmWidth(observation.landmarks);
        const thumb = observation.landmarks[4];
        const index = observation.landmarks[8];
        next.pinchRatio = width > 0 && thumb && index ? Math.hypot(thumb.x - index.x, thumb.y - index.y) / width : 0;
        next.pinching = isPinching(observation.landmarks);
        next.hammerPose = isHammerPose(observation.landmarks);
        next.secretPose = isSecretCirclePose(observation.landmarks);
      }

      if (runHandRef.current) {
        const update = updateGestureTracker(trackerRef.current, observation, now);
        trackerRef.current = update.tracker;
        if (update.action) next.lastAction = `${update.action.type} @ ${new Date().toLocaleTimeString()}`;
      }

      if (recordingRef.current && runHandRef.current) {
        takesRef.current.push({
          t: Math.round(now),
          label: labelRef.current,
          gesture: observation?.gesture ?? null,
          confidence: observation?.confidence ?? 0,
          handedness: observation?.handedness ?? null,
          other: observation?.other ? {
            handedness: observation.other.handedness ?? null,
            landmarks: observation.other.landmarks.map((point) => [+point.x.toFixed(4), +point.y.toFixed(4), +(point.z ?? 0).toFixed(4)]),
          } : null,
          landmarks: observation?.landmarks.map((point) => [+point.x.toFixed(4), +point.y.toFixed(4), +(point.z ?? 0).toFixed(4)]) ?? null,
        });
        setTakeCount(takesRef.current.length);
      }
    } catch (error) {
      reportError('hand', error);
    }

    setDiag((current) => ({ ...next, lastAction: next.lastAction === 'none' ? current.lastAction : next.lastAction }));
    const context = overlay.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, overlay.width, overlay.height);
    if (!landmarks) return;
    context.strokeStyle = '#66e3ff';
    context.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
      const p = landmarks[a];
      const q = landmarks[b];
      if (!p || !q) continue;
      context.beginPath();
      context.moveTo(p.x * overlay.width, p.y * overlay.height);
      context.lineTo(q.x * overlay.width, q.y * overlay.height);
      context.stroke();
    }
    context.fillStyle = '#a78bfa';
    for (const point of landmarks) {
      context.beginPath();
      context.arc(point.x * overlay.width, point.y * overlay.height, 3, 0, Math.PI * 2);
      context.fill();
    }
  }, [detectFace, detectHand, faceDelegate, handDelegate, reportError]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    cameraRef.current?.stop();
    const camera = new CameraSession();
    cameraRef.current = camera;
    setStatus('requesting camera');
    try {
      await camera.start(video, { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } });
      setStatus('loading models');
      await Promise.all([loadFace(), loadHand()]);
      setStatus('running');
      trackerRef.current = initialGestureTracker();
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      camera.stop();
      setStatus(`failed: ${(error as Error).message}`);
    }
  }, [loadFace, loadHand, tick]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    cameraRef.current?.stop();
    closeFace();
    closeHand();
  }, [closeFace, closeHand]);

  function download() {
    const jsonl = takesRef.current.map((take) => JSON.stringify(take)).join('\n');
    const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gesture-takes-${Date.now()}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const cameraDead = diag.brightness < 8;
  return (
    <main className="min-h-screen bg-[#020306] p-6 text-slate-200">
      <h1 className="mb-1 text-xl font-semibold">Sensing Lab</h1>
      <p className="mb-4 max-w-3xl text-sm text-slate-400">Local diagnostic for visible activation and hand-gesture signals. No emotion or mental-state classifier is used, and nothing is uploaded.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={start} className="rounded bg-cyan-500/20 px-3 py-1.5 text-sm text-cyan-200 ring-1 ring-cyan-400/40">Start camera</button>
        <label className="flex items-center gap-1.5 text-sm text-slate-300"><input suppressHydrationWarning type="checkbox" checked={runHand} onChange={(event) => setRunHand(event.target.checked)} /> hand model</label>
        <label className="flex items-center gap-1.5 text-sm text-slate-300"><input suppressHydrationWarning type="checkbox" checked={runFace} onChange={(event) => setRunFace(event.target.checked)} /> face model</label>
        <span className="text-sm text-slate-400">{diag.fps} fps</span>
      </div>
      <p className="mb-3 max-w-3xl break-words text-xs text-amber-300/80">status: {status}</p>

      <div className="grid gap-6 lg:grid-cols-[640px_1fr]">
        <div className="relative h-[480px] w-[640px] max-w-full overflow-hidden rounded-lg ring-1 ring-white/10">
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          <canvas ref={overlayRef} width={640} height={480} className="absolute inset-0 h-full w-full -scale-x-100" />
          <canvas ref={probeRef} width={160} height={120} className="hidden" />
        </div>
        <div className="space-y-4 text-sm">
          {status === 'running' && <div className={`rounded-lg p-3 ring-1 ${cameraDead ? 'bg-red-500/10 text-red-200 ring-red-400/40' : 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/40'}`}><div className="font-semibold">{cameraDead ? 'Camera is sending black frames' : 'Camera is sending real frames'}</div><div className="mt-1 opacity-80">mean luma {diag.brightness.toFixed(1)} / 255</div></div>}
          <Row label="delegate" value={diag.delegates} />
          <Row label="face detected" value={diag.faceFound ? 'yes' : 'no'} bad={!diag.faceFound} />
          <div className="rounded bg-white/5 p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">observable expression signals</div>
            {EXPRESSION_SIGNALS.map((signal) => {
              const value = diag.expressionSignals[signal] ?? 0;
              return <div key={signal} className="flex items-center gap-2"><span className="w-28 text-xs text-slate-400">{signal}</span><div className="h-1.5 flex-1 rounded bg-white/10"><div className="h-full rounded bg-cyan-400" style={{ width: `${value * 100}%` }} /></div><span className="w-10 text-right text-xs tabular-nums">{value.toFixed(2)}</span></div>;
            })}
          </div>
          <div className="rounded bg-white/5 p-3"><div className="mb-1 text-xs uppercase tracking-wide text-slate-400">top blendshapes</div><div className="font-mono text-xs">{diag.topBlendshapes.join(' · ') || '—'}</div></div>
          <Row label="hand detected" value={diag.handFound ? 'yes' : 'no'} bad={!diag.handFound} />
          <Row label="hands visible" value={diag.hands} />
          <Row label="handedness" value={diag.handedness} />
          <Row label="raised?" value={diag.raised} />
          <Row label="canned gesture" value={`${diag.gesture} (${diag.gestureScore.toFixed(2)})`} />
          <Row label="pinch ratio" value={`${diag.pinchRatio.toFixed(3)} ${diag.pinching ? '→ PINCH' : ''}`} />
          <Row label="hammer pose" value={diag.hammerPose ? 'yes' : 'no'} />
          <Row label="secret circle" value={diag.secretPose ? 'yes' : 'no'} />
          <Row label="last action" value={diag.lastAction} />
          <div className="rounded-lg bg-white/5 p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">local gesture calibration</div>
            {label.startsWith('idle') && <p className="mb-2 text-xs text-slate-400">Behave normally. Any action fired during an idle take is a false positive worth catching.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <select value={label} onChange={(event) => { setLabel(event.target.value); labelRef.current = event.target.value; }} className="rounded bg-black/40 px-2 py-1 text-sm ring-1 ring-white/15">
                <optgroup label="gesture — should fire">{GESTURE_LABELS.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>
                <optgroup label="idle — should stay silent">{IDLE_LABELS.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>
              </select>
              <button onClick={() => { const next = !recording; setRecording(next); recordingRef.current = next; }} className={`rounded px-3 py-1 text-sm ring-1 ${recording ? 'bg-red-500/20 text-red-200 ring-red-400/40' : 'bg-white/10 ring-white/20'}`}>{recording ? 'Stop' : 'Record'}</button>
              <button onClick={download} disabled={!takeCount} className="rounded bg-white/10 px-3 py-1 text-sm ring-1 ring-white/20 disabled:opacity-40">Download {takeCount} frames</button>
              <button onClick={() => { takesRef.current = []; setTakeCount(0); }} className="rounded px-3 py-1 text-sm text-slate-400">Clear</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return <div className="flex items-center justify-between rounded bg-white/5 px-3 py-1.5"><span className="text-xs uppercase tracking-wide text-slate-400">{label}</span><span className={`font-mono text-xs ${bad ? 'text-amber-300' : 'text-slate-100'}`}>{value}</span></div>;
}
