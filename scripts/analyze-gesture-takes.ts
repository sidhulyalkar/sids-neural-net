// Replays recorded landmark takes through the real gesture reducer so
// thresholds can be tuned against measured hands instead of guesses.
//
//   npx tsx scripts/analyze-gesture-takes.ts ~/Downloads/gesture-takes-*.jsonl

import { readFileSync } from 'node:fs';
import {
  initialGestureTracker,
  isHammerPose,
  isPinching,
  isSecretCirclePose,
  updateGestureTracker,
} from '../components/sensing/gestures';
import type { GestureAction, GesturePoint } from '../components/sensing/gestures';

interface Frame {
  t: number;
  label: string;
  gesture: string | null;
  confidence: number;
  handedness?: string | null;
  other?: { handedness?: string | null; landmarks: number[][] } | null;
  /** null when no hand was visible that frame — replayed as a null observation. */
  landmarks: number[][] | null;
}

/** Which action each label is supposed to produce. `idle*` must produce none. */
const EXPECTED: Record<string, string> = {
  raise_right: 'navigate_next',
  raise_left: 'navigate_previous',
  open_palm: 'open_palette',
  fist: 'close_palette',
  thumb_up: 'activate',
  hammer_down: 'page_down',
  clap: 'activate',
  circle: 'prank',
};

function toPoints(l: number[][]): GesturePoint[] {
  return l.map(([x, y, z]) => ({ x, y, z: z ?? 0 }));
}

function pct(n: number, d: number): string {
  return d === 0 ? '  n/a' : `${((n / d) * 100).toFixed(0).padStart(3)}%`;
}

function stats(xs: number[]): { min: number; med: number; max: number } {
  if (!xs.length) return { min: NaN, med: NaN, max: NaN };
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
}

function palmCenter(l: GesturePoint[]): GesturePoint | null {
  const pts = [0, 5, 9, 13, 17].map((i) => l[i]).filter(Boolean);
  if (pts.length !== 5) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / 5,
    y: pts.reduce((s, p) => s + p.y, 0) / 5,
  };
}

function palmWidth(l: GesturePoint[]): number {
  const a = l[5], b = l[17];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

// Dedupe: the lab appends until "Clear", so files are cumulative snapshots.
const files = process.argv.slice(2);
const seen = new Set<string>();
const frames: Frame[] = [];
for (const f of files) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const key = line;
    if (seen.has(key)) continue;
    seen.add(key);
    frames.push(JSON.parse(line) as Frame);
  }
}

const byLabel = new Map<string, Frame[]>();
for (const f of frames) {
  if (!byLabel.has(f.label)) byLabel.set(f.label, []);
  byLabel.get(f.label)!.push(f);
}

console.log(`\n${frames.length} distinct frames across ${byLabel.size} labels\n`);
console.log('='.repeat(78));

for (const [label, raw] of byLabel) {
  const takes = [...raw].sort((a, b) => a.t - b.t);

  // `t` is performance.now(), which restarts on every page load. A big jump
  // means a new recording session: replaying across one invents a false gap.
  const SESSION_GAP_MS = 5000;
  const sessions: Frame[][] = [[takes[0]]];
  for (let i = 1; i < takes.length; i++) {
    if (takes[i].t - takes[i - 1].t > SESSION_GAP_MS) sessions.push([]);
    sessions[sessions.length - 1].push(takes[i]);
  }
  const span = sessions.reduce((s, ss) => s + (ss[ss.length - 1].t - ss[0].t) / 1000, 0);
  const fps = takes.length / span;

  // Replay through the real reducer, resetting between sessions.
  const actions: GestureAction[] = [];
  for (const session of sessions) {
    let tracker = initialGestureTracker();
    for (const f of session) {
      // A frame with no hand is a real signal: live, it resets the tracker.
      const observation = f.landmarks
        ? {
            landmarks: toPoints(f.landmarks),
            gesture: f.gesture as never,
            confidence: f.confidence,
            handedness: f.handedness ?? undefined,
            other: f.other
              ? { landmarks: toPoints(f.other.landmarks), handedness: f.other.handedness ?? undefined }
              : undefined,
          }
        : null;
      const u = updateGestureTracker(tracker, observation, f.t);
      tracker = u.tracker;
      if (u.action) actions.push(u.action);
    }
  }

  const isIdle = label.startsWith('idle');
  const expected = EXPECTED[label];
  const hits = isIdle ? 0 : actions.filter((a) => a.type === expected).length;
  const wrong = isIdle ? actions : actions.filter((a) => a.type !== expected);

  // Measured geometry.
  const pinchRatios: number[] = [];
  let hammerPoses = 0, pinches = 0, secrets = 0, lowConf = 0, noHand = 0;
  const cannedCounts = new Map<string, number>();
  for (const f of takes) {
    if (!f.landmarks) { noHand++; continue; }
    const l = toPoints(f.landmarks);
    const pw = palmWidth(l);
    const t4 = l[4], t8 = l[8];
    if (pw > 0.02 && t4 && t8) pinchRatios.push(Math.hypot(t4.x - t8.x, t4.y - t8.y) / pw);
    if (isHammerPose(l)) hammerPoses++;
    if (isPinching(l)) pinches++;
    if (isSecretCirclePose(l)) secrets++;
    if (f.confidence < 0.65) lowConf++;
    if (f.gesture) cannedCounts.set(f.gesture, (cannedCounts.get(f.gesture) ?? 0) + 1);
  }

  const pr = stats(pinchRatios);
  const canned = [...cannedCounts.entries()].sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${g}:${n}`).join(' ');

  console.log(`\n${label.toUpperCase().padEnd(12)} ${takes.length} frames · ${span.toFixed(1)}s · ${fps.toFixed(1)} fps`);
  if (noHand) console.log(`  no hand       ${pct(noHand, takes.length)} of frames (tracker resets on these)`);

  if (isIdle) {
    // Silence is the pass condition here.
    console.log(`  expected      NOTHING  ->  ${actions.length === 0 ? 'SILENT (pass)' : `*** ${actions.length} FALSE POSITIVE(S) ***`}`);
  } else {
    console.log(`  expected      ${expected}  ->  ${hits > 0 ? `FIRED x${hits}` : 'NEVER FIRED'}`);
  }
  if (wrong.length) {
    const w = new Map<string, number>();
    for (const a of wrong) w.set(a.type, (w.get(a.type) ?? 0) + 1);
    const rate = (wrong.length / span) * 60;
    console.log(`  ${isIdle ? 'FALSE FIRES  ' : 'SPURIOUS     '} ${[...w.entries()].map(([t, n]) => `${t} x${n}`).join(', ')}  (${rate.toFixed(1)}/min)`);
  }
  console.log(`  canned        ${canned}`);
  console.log(`  conf < 0.65   ${pct(lowConf, takes.length)}  (MIN_POSE_CONFIDENCE gate)`);
  console.log(`  pinch ratio   min ${pr.min.toFixed(3)} / med ${pr.med.toFixed(3)} / max ${pr.max.toFixed(3)}   (threshold <= 0.28)`);
  console.log(`  pose rates    pinch ${pct(pinches, takes.length)}  hammer ${pct(hammerPoses, takes.length)}  secret ${pct(secrets, takes.length)}`);

  // Motion analysis, mirrored exactly like the engine does.
  const pts = takes.map((f) => {
    if (!f.landmarks) return null;
    const p = palmCenter(toPoints(f.landmarks));
    return p ? { x: 1 - p.x, y: p.y, at: f.t } : null;
  }).filter(Boolean) as { x: number; y: number; at: number }[];

  let maxDx = 0, maxDy = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[j].at - pts[i].at > 420) break;
      maxDx = Math.max(maxDx, Math.abs(pts[j].x - pts[i].x));
      maxDy = Math.max(maxDy, pts[j].y - pts[i].y);
    }
  }
  console.log(`  motion/420ms  max |dx| ${maxDx.toFixed(3)} (swipe needs >= 0.24)   max dy ${maxDy.toFixed(3)} (chop needs >= 0.20)`);

  // Longest unbroken run of chop pose — the engine wipes the buffer on any miss.
  if (label === 'hammer_down') {
    let run = 0, best = 0, bestMs = 0, runStart = 0;
    for (const f of takes) {
      if (f.landmarks && isHammerPose(toPoints(f.landmarks))) {
        if (run === 0) runStart = f.t;
        run++;
        if (run > best) { best = run; bestMs = f.t - runStart; }
      } else run = 0;
    }
    console.log(`  longest hammer-pose run: ${best} frames / ${bestMs}ms  (needs >= 100ms unbroken)`);
  }
}
console.log(`\n${'='.repeat(78)}\n`);
