// Replays locally recorded landmark takes through the real gesture reducer so
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
  landmarks: number[][] | null;
}

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

function toPoints(landmarks: number[][]): GesturePoint[] {
  return landmarks.map(([x, y, z]) => ({ x, y, z: z ?? 0 }));
}
function pct(n: number, d: number): string { return d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(0)}%`; }
function stats(xs: number[]) {
  if (!xs.length) return { min: NaN, med: NaN, max: NaN };
  const sorted = [...xs].sort((a, b) => a - b);
  return { min: sorted[0], med: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
}
function palmCenter(landmarks: GesturePoint[]): GesturePoint | null {
  const points = [0, 5, 9, 13, 17].map((index) => landmarks[index]).filter(Boolean);
  if (points.length !== 5) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / 5,
    y: points.reduce((sum, point) => sum + point.y, 0) / 5,
  };
}
function palmWidth(landmarks: GesturePoint[]): number {
  const a = landmarks[5];
  const b = landmarks[17];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Pass one or more locally downloaded gesture-takes-*.jsonl files.');
  process.exit(1);
}

const seen = new Set<string>();
const frames: Frame[] = [];
for (const file of files) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || seen.has(line)) continue;
    seen.add(line);
    frames.push(JSON.parse(line) as Frame);
  }
}

const byLabel = new Map<string, Frame[]>();
for (const frame of frames) {
  if (!byLabel.has(frame.label)) byLabel.set(frame.label, []);
  byLabel.get(frame.label)!.push(frame);
}

console.log(`\n${frames.length} distinct frames across ${byLabel.size} labels\n`);
console.log('='.repeat(78));

for (const [label, raw] of byLabel) {
  const takes = [...raw].sort((a, b) => a.t - b.t);
  const sessions: Frame[][] = [[takes[0]]];
  for (let index = 1; index < takes.length; index++) {
    if (takes[index].t - takes[index - 1].t > 5000) sessions.push([]);
    sessions[sessions.length - 1].push(takes[index]);
  }
  const span = sessions.reduce((sum, session) => sum + (session[session.length - 1].t - session[0].t) / 1000, 0);
  const fps = span > 0 ? takes.length / span : 0;

  const actions: GestureAction[] = [];
  for (const session of sessions) {
    let tracker = initialGestureTracker();
    for (const frame of session) {
      const observation = frame.landmarks
        ? {
            landmarks: toPoints(frame.landmarks),
            gesture: frame.gesture as never,
            confidence: frame.confidence,
            handedness: frame.handedness ?? undefined,
            other: frame.other ? { landmarks: toPoints(frame.other.landmarks), handedness: frame.other.handedness ?? undefined } : undefined,
          }
        : null;
      const update = updateGestureTracker(tracker, observation, frame.t);
      tracker = update.tracker;
      if (update.action) actions.push(update.action);
    }
  }

  const isIdle = label.startsWith('idle');
  const expected = EXPECTED[label];
  const hits = isIdle ? 0 : actions.filter((action) => action.type === expected).length;
  const wrong = isIdle ? actions : actions.filter((action) => action.type !== expected);

  const pinchRatios: number[] = [];
  let hammerPoses = 0;
  let pinches = 0;
  let secrets = 0;
  let lowConf = 0;
  let noHand = 0;
  const cannedCounts = new Map<string, number>();
  for (const frame of takes) {
    if (!frame.landmarks) { noHand += 1; continue; }
    const landmarks = toPoints(frame.landmarks);
    const width = palmWidth(landmarks);
    const thumb = landmarks[4];
    const index = landmarks[8];
    if (width > 0.02 && thumb && index) pinchRatios.push(Math.hypot(thumb.x - index.x, thumb.y - index.y) / width);
    if (isHammerPose(landmarks)) hammerPoses += 1;
    if (isPinching(landmarks)) pinches += 1;
    if (isSecretCirclePose(landmarks)) secrets += 1;
    if (frame.confidence < 0.65) lowConf += 1;
    if (frame.gesture) cannedCounts.set(frame.gesture, (cannedCounts.get(frame.gesture) ?? 0) + 1);
  }

  const pr = stats(pinchRatios);
  const canned = [...cannedCounts.entries()].sort((a, b) => b[1] - a[1]).map(([gesture, count]) => `${gesture}:${count}`).join(' ');
  console.log(`\n${label.toUpperCase().padEnd(12)} ${takes.length} frames · ${span.toFixed(1)}s · ${fps.toFixed(1)} fps`);
  if (noHand) console.log(`  no hand       ${pct(noHand, takes.length)} of frames`);
  if (isIdle) console.log(`  expected      NOTHING -> ${actions.length === 0 ? 'SILENT (pass)' : `*** ${actions.length} FALSE POSITIVE(S) ***`}`);
  else console.log(`  expected      ${expected} -> ${hits > 0 ? `FIRED x${hits}` : 'NEVER FIRED'}`);
  if (wrong.length) {
    const counts = new Map<string, number>();
    for (const action of wrong) counts.set(action.type, (counts.get(action.type) ?? 0) + 1);
    const rate = span > 0 ? (wrong.length / span) * 60 : 0;
    console.log(`  ${isIdle ? 'FALSE FIRES' : 'SPURIOUS'} ${[...counts.entries()].map(([type, count]) => `${type} x${count}`).join(', ')} (${rate.toFixed(1)}/min)`);
  }
  console.log(`  canned        ${canned || 'none'}`);
  console.log(`  conf < 0.65   ${pct(lowConf, takes.length)}`);
  console.log(`  pinch ratio   min ${pr.min.toFixed(3)} / med ${pr.med.toFixed(3)} / max ${pr.max.toFixed(3)}`);
  console.log(`  pose rates    pinch ${pct(pinches, takes.length)}  hammer ${pct(hammerPoses, takes.length)}  secret ${pct(secrets, takes.length)}`);

  const points = takes.map((frame) => {
    if (!frame.landmarks) return null;
    const center = palmCenter(toPoints(frame.landmarks));
    return center ? { x: 1 - center.x, y: center.y, at: frame.t } : null;
  }).filter(Boolean) as { x: number; y: number; at: number }[];
  let maxDx = 0;
  let maxDy = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (points[j].at - points[i].at > 420) break;
      maxDx = Math.max(maxDx, Math.abs(points[j].x - points[i].x));
      maxDy = Math.max(maxDy, points[j].y - points[i].y);
    }
  }
  console.log(`  motion/420ms  max |dx| ${maxDx.toFixed(3)}   max dy ${maxDy.toFixed(3)}`);
}
console.log(`\n${'='.repeat(78)}\n`);
