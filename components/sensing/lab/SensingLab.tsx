'use client';

// Dev instrument for the sensing layer. Unlike the production layer, this shows
// the camera feed and every intermediate value, so a failure can be localized to
// a stage: camera -> frame content -> model -> heuristic -> action.
//
// Also records labeled landmark takes to JSONL for offline threshold tuning.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFaceLandmarker } from '../useFaceLandmarker';
import { useGestureRecognizer } from '../useGestureRecognizer';
import { blendshapesToEmotion } from '../emotion';
import {
  initialGestureTracker,
  isHammerPose,
  isPinching,
  isSecretCirclePose,
  updateGestureTracker,
} from '../gestures';
import type { GesturePoint } from '../gestures';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const GESTURE_LABELS = [
  'raise_right', 'raise_left', 'open_palm', 'fist', 'thumb_up', 'clap', 'hammer_down', 'circle',
] as const;

/**
 * Negative takes: normal activity that must NOT trigger anything. Any action
 * fired during one of these is a false positive, which gesture takes — where
 * you are always performing on purpose — structurally cannot reveal.
 */
const IDLE_LABELS = [
  'idle', 'idle_typing', 'idle_talking', 'idle_reading', 'idle_reaching',
] as const;

interface Diag {
  brightness: number;
  faceFound: boolean;
  handFound: boolean;
  gesture: string;
  gestureScore: number;
  emotion: string;
  emotionScores: Record<string, number>;
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
}

const EMPTY: Diag = {
  brightness: 0, faceFound: false, handFound: false, gesture: '-', gestureScore: 0,
  emotion: '-', emotionScores: {}, topBlendshapes: [], pinchRatio: 0,
  pinching: false, hammerPose: false, secretPose: false, lastAction: 'none', fps: 0, delegates: '…',
  handedness: '—', raised: '—', hands: 'none',
};

/** Mean luma over a downsampled frame. Near 0 means the camera is sending black. */
function meanLuma(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4 * 16) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return sum / (data.length / (4 * 16));
}

function palmWidth(l: GesturePoint[]): number {
  const a = l[5], b = l[17];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

export function SensingLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const trackerRef = useRef(initialGestureTracker());
  const lastRef = useRef(0);
  const recordingRef = useRef(false);
  const labelRef = useRef<string>(GESTURE_LABELS[0]);
  const takesRef = useRef<unknown[]>([]);

  const [status, setStatus] = useState('idle');
  const [diag, setDiag] = useState<Diag>(EMPTY);
  const [recording, setRecording] = useState(false);
  const [label, setLabel] = useState<string>(GESTURE_LABELS[0]);
  const [takeCount, setTakeCount] = useState(0);

  // CPU inference of both models at 15fps locks up the main thread, so each
  // model is opt-in and the loop slows down when a model falls back to CPU.
  const [runFace, setRunFace] = useState(false);
  const [runHand, setRunHand] = useState(true);
  const runFaceRef = useRef(runFace);
  const runHandRef = useRef(runHand);
  runFaceRef.current = runFace;
  runHandRef.current = runHand;
  const errorRef = useRef('');

  // Destructure: the hooks return a fresh object each render, so depending on
  // the object identity would re-run effects (and tear down the camera) every
  // render. The individual callbacks are stable.
  const { load: loadFace, detect: detectFace, close: closeFace, getDelegate: faceDelegate } = useFaceLandmarker();
  const { load: loadHand, detect: detectHand, close: closeHand, getDelegate: handDelegate } = useGestureRecognizer();

  // MediaPipe graph errors are multi-kilobyte. Setting state with the full text
  // every frame is its own render storm, so keep the first line and only once.
  const reportError = useCallback((stage: string, err: unknown) => {
    const line = `${stage} error: ${String((err as Error)?.message ?? err).split('\n')[0].slice(0, 160)}`;
    if (errorRef.current === line) return;
    errorRef.current = line;
    setStatus(line);
  }, []);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const video = videoRef.current;
    const probe = probeRef.current;
    const overlay = overlayRef.current;
    if (!video || !probe || !overlay || video.readyState < 2) return;

    const onCpu = faceDelegate() === 'CPU' || handDelegate() === 'CPU';
    const now = performance.now();
    if (now - lastRef.current < 1000 / (onCpu ? 6 : 30)) return;
    const prev = lastRef.current;
    lastRef.current = now;

    const pctx = probe.getContext('2d', { willReadFrequently: true });
    if (!pctx) return;
    pctx.drawImage(video, 0, 0, probe.width, probe.height);
    const brightness = meanLuma(pctx, probe.width, probe.height);

    const next: Diag = {
      ...EMPTY,
      brightness,
      fps: prev ? Math.round(1000 / (now - prev)) : 0,
      delegates: `face ${faceDelegate() ?? '…'} · hand ${handDelegate() ?? '…'}`,
    };

    try {
      const bs = runFaceRef.current ? detectFace(video, now) : null;
      if (bs) {
        next.faceFound = true;
        const reading = blendshapesToEmotion(bs);
        next.emotion = reading.dominant;
        next.emotionScores = reading.scores as unknown as Record<string, number>;
        next.topBlendshapes = Object.entries(bs)
          .filter(([k]) => k !== '_neutral')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => `${k} ${v.toFixed(2)}`);
      }
    } catch (err) {
      reportError('face', err);
    }

    let landmarks: GesturePoint[] | null = null;
    try {
      const obs = runHandRef.current ? detectHand(video, now) : null;
      if (obs) {
        landmarks = obs.landmarks;
        next.handFound = true;
        next.gesture = obs.gesture;
        next.gestureScore = obs.confidence;
        const palmY = [0, 5, 9, 13, 17].reduce((s, i) => s + (obs.landmarks[i]?.y ?? 0), 0) / 5;
        next.handedness = obs.handedness ?? '—';
        next.hands = obs.other ? 'TWO (clap possible)' : 'one';
        next.raised = palmY <= 0.42 ? `RAISED (palm y ${palmY.toFixed(2)})` : `down (palm y ${palmY.toFixed(2)})`;
        const pw = palmWidth(obs.landmarks);
        const t = obs.landmarks[4], ix = obs.landmarks[8];
        next.pinchRatio = pw > 0 && t && ix ? Math.hypot(t.x - ix.x, t.y - ix.y) / pw : 0;
        next.pinching = isPinching(obs.landmarks);
        next.hammerPose = isHammerPose(obs.landmarks);
        next.secretPose = isSecretCirclePose(obs.landmarks);
      }
      if (runHandRef.current) {
        const update = updateGestureTracker(trackerRef.current, obs, now);
        trackerRef.current = update.tracker;
        if (update.action) next.lastAction = `${update.action.type} @ ${new Date().toLocaleTimeString()}`;
      }

      // Record no-hand frames too. Live, a null observation resets the tracker;
      // omitting those frames would splice together moments that were never
      // contiguous and invent actions the real pipeline could never fire.
      if (recordingRef.current && runHandRef.current) {
        takesRef.current.push({
          t: Math.round(now),
          label: labelRef.current,
          gesture: obs?.gesture ?? null,
          confidence: obs?.confidence ?? 0,
          handedness: obs?.handedness ?? null,
          // Second hand, when visible. The clap is the only gesture needing it.
          other: obs?.other
            ? {
                handedness: obs.other.handedness ?? null,
                landmarks: obs.other.landmarks.map((p) => [
                  +p.x.toFixed(4), +p.y.toFixed(4), +(p.z ?? 0).toFixed(4),
                ]),
              }
            : null,
          // z is recorded because 2D tip distance cannot tell a real pinch from
          // a relaxed hand whose thumb and index merely overlap in projection.
          landmarks: obs
            ? obs.landmarks.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.z ?? 0).toFixed(4)])
            : null,
        });
        setTakeCount(takesRef.current.length);
      }
    } catch (err) {
      reportError('hand', err);
    }

    setDiag((d) => ({ ...next, lastAction: next.lastAction === 'none' ? d.lastAction : next.lastAction }));

    const octx = overlay.getContext('2d');
    if (octx) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      if (landmarks) {
        octx.strokeStyle = '#66e3ff';
        octx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
          const p = landmarks[a], q = landmarks[b];
          if (!p || !q) continue;
          octx.beginPath();
          octx.moveTo(p.x * overlay.width, p.y * overlay.height);
          octx.lineTo(q.x * overlay.width, q.y * overlay.height);
          octx.stroke();
        }
        octx.fillStyle = '#a78bfa';
        for (const p of landmarks) {
          octx.beginPath();
          octx.arc(p.x * overlay.width, p.y * overlay.height, 3, 0, Math.PI * 2);
          octx.fill();
        }
      }
    }
  }, [detectFace, detectHand, faceDelegate, handDelegate, reportError]);

  const start = useCallback(async () => {
    setStatus('requesting camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }, audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setStatus('loading models');
      await Promise.all([loadFace(), loadHand()]);
      setStatus('running');
      trackerRef.current = initialGestureTracker();
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setStatus(`failed: ${(err as Error).message}`);
    }
  }, [loadFace, loadHand, tick]);

  // Teardown only on unmount.
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    closeFace();
    closeHand();
  }, [closeFace, closeHand]);

  function download() {
    const jsonl = takesRef.current.map((t) => JSON.stringify(t)).join('\n');
    const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gesture-takes-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cameraDead = diag.brightness < 8;

  return (
    <main className="min-h-screen bg-[#020306] p-6 text-slate-200">
      <h1 className="mb-1 text-xl font-semibold">Sensing Lab</h1>
      <p className="mb-4 text-sm text-slate-400">
        Local diagnostic. Nothing leaves this device; recordings download to your Downloads folder.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={start} className="rounded bg-cyan-500/20 px-3 py-1.5 text-sm text-cyan-200 ring-1 ring-cyan-400/40">
          Start camera
        </button>
        <label className="flex items-center gap-1.5 text-sm text-slate-300">
          {/* suppressHydrationWarning: extensions stamp data-has-listeners onto
              inputs before hydration. Harmless, but the dev overlay it triggers
              covers this instrument. Safe here — dev-only, no SSR-sensitive state. */}
          <input suppressHydrationWarning type="checkbox" checked={runHand} onChange={(e) => setRunHand(e.target.checked)} />
          hand model
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-300">
          <input suppressHydrationWarning type="checkbox" checked={runFace} onChange={(e) => setRunFace(e.target.checked)} />
          face model
        </label>
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
          {status === 'running' && (
            <div className={`rounded-lg p-3 ring-1 ${cameraDead ? 'bg-red-500/10 text-red-200 ring-red-400/40' : 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/40'}`}>
              <div className="font-semibold">
                {cameraDead ? 'Camera is sending black frames' : 'Camera is sending real frames'}
              </div>
              <div className="mt-1 opacity-80">
                mean luma {diag.brightness.toFixed(1)} / 255 — {cameraDead
                  ? 'models cannot detect anything in a black frame. Check macOS camera permission for Chrome, close other apps using the camera, and confirm you see yourself above.'
                  : 'frames have content, so detection failures are model/threshold issues.'}
              </div>
            </div>
          )}

          <Row label="delegate" value={diag.delegates} />
          <Row label="face detected" value={diag.faceFound ? 'yes' : 'no'} bad={!diag.faceFound} />
          <Row label="emotion" value={`${diag.emotion}`} />
          <div className="rounded bg-white/5 p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">emotion scores</div>
            {Object.entries(diag.emotionScores).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-16 text-xs text-slate-400">{k}</span>
                <div className="h-1.5 flex-1 rounded bg-white/10">
                  <div className="h-full rounded bg-cyan-400" style={{ width: `${v * 100}%` }} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums">{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="rounded bg-white/5 p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">top blendshapes</div>
            <div className="font-mono text-xs">{diag.topBlendshapes.join(' · ') || '—'}</div>
          </div>

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
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">record takes</div>
            {label.startsWith('idle') && (
              <p className="mb-2 text-xs text-slate-400">
                Behave normally — type, talk, reach around. Anything that fires under
                LAST ACTION is a false positive worth catching.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={label}
                onChange={(e) => { setLabel(e.target.value); labelRef.current = e.target.value; }}
                className="rounded bg-black/40 px-2 py-1 text-sm ring-1 ring-white/15"
              >
                <optgroup label="gesture — should fire">
                  {GESTURE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </optgroup>
                <optgroup label="idle — should stay silent">
                  {IDLE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </optgroup>
              </select>
              <button
                onClick={() => { const n = !recording; setRecording(n); recordingRef.current = n; }}
                className={`rounded px-3 py-1 text-sm ring-1 ${recording ? 'bg-red-500/20 text-red-200 ring-red-400/40' : 'bg-white/10 ring-white/20'}`}
              >
                {recording ? 'Stop' : 'Record'}
              </button>
              <button onClick={download} disabled={!takeCount} className="rounded bg-white/10 px-3 py-1 text-sm ring-1 ring-white/20 disabled:opacity-40">
                Download {takeCount} frames
              </button>
              <button onClick={() => { takesRef.current = []; setTakeCount(0); }} className="rounded px-3 py-1 text-sm text-slate-400">
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded bg-white/5 px-3 py-1.5">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`font-mono text-xs ${bad ? 'text-amber-300' : 'text-slate-100'}`}>{value}</span>
    </div>
  );
}
