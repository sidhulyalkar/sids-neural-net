import {
  initialGestureTracker,
  type CannedGesture,
  type GestureAction,
  type GestureActionType,
  type GesturePoint,
  type GestureTracker,
  type GestureUpdate,
  type HandObservation,
  type PositionSample,
} from './types';

const ACTION_COOLDOWN_MS = 650;
const FIST_BACK_DWELL_MS = 420;
const MIN_POSE_CONFIDENCE = 0.55;

/** Thumb-index gap over wrist-to-middle-knuckle hand length, measured in 3D. */
const PINCH_RATIO = 0.2;

/** Two-finger scrolling is a short vertical stroke, not a dwell. */
const SCROLL_WINDOW_MS = 520;
const SCROLL_MIN_DURATION_MS = 90;
const SCROLL_DISTANCE = 0.07;
const SCROLL_AXIS_DOMINANCE = 1.15;
const SCROLL_COOLDOWN_MS = 260;
const SCROLL_GRACE_MS = 140;

const SECRET_DWELL_MS = 900;
const SECRET_LOWER_FRAME_Y = 0.58;
const SECRET_GRACE_MS = 260;
const PRANK_COOLDOWN_MS = 30_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function distance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance3(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function average(points: GesturePoint[]): GesturePoint {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function getPalmCenter(landmarks: GesturePoint[]): GesturePoint | null {
  const points = [0, 5, 9, 13, 17].map((index) => landmarks[index]).filter(Boolean);
  return points.length === 5 ? average(points) : null;
}

function getHandLength(landmarks: GesturePoint[]): number {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  return wrist && middleMcp ? distance3(wrist, middleMcp) : 0;
}

function fingerExtended(landmarks: GesturePoint[], pipIndex: number, tipIndex: number): boolean {
  const wrist = landmarks[0];
  const pip = landmarks[pipIndex];
  const tip = landmarks[tipIndex];
  if (!wrist || !pip || !tip) return false;
  return distance(tip, wrist) > distance(pip, wrist) * 1.16;
}

function getTwoFingerCenter(landmarks: GesturePoint[]): GesturePoint | null {
  const index = landmarks[8];
  const middle = landmarks[12];
  return index && middle ? average([index, middle]) : null;
}

/**
 * Index + middle extended while ring + pinky are folded.
 *
 * MediaPipe's canned `Victory` pose is accepted too, but geometry is retained as
 * a fallback because fingers can be nearly parallel while scrolling and no
 * longer resemble a textbook V sign.
 */
export function isTwoFingerScrollPose(landmarks: GesturePoint[]): boolean {
  if (getHandLength(landmarks) < 0.02) return false;
  return (
    fingerExtended(landmarks, 6, 8) &&
    fingerExtended(landmarks, 10, 12) &&
    !fingerExtended(landmarks, 14, 16) &&
    !fingerExtended(landmarks, 18, 20)
  );
}

/**
 * Closed fist geometry used as a fallback when MediaPipe's canned classifier
 * flickers. The name remains exported for compatibility with owner tooling.
 */
export function isHammerPose(landmarks: GesturePoint[]): boolean {
  const wrist = landmarks[0];
  if (!wrist || getHandLength(landmarks) < 0.02) return false;

  for (const [mcpIndex, tipIndex] of [[5, 8], [9, 12], [13, 16], [17, 20]] as const) {
    const mcp = landmarks[mcpIndex];
    const tip = landmarks[tipIndex];
    if (!mcp || !tip) return false;
    const knuckle = distance(mcp, wrist);
    if (knuckle < 1e-6) return false;
    if (distance(tip, wrist) / knuckle >= 0.85) return false;
  }
  return true;
}

/** Genuine thumb-index contact, normalized by hand length and judged in 3D. */
export function isPinching(landmarks: GesturePoint[]): boolean {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  if (!thumbTip || !indexTip || !wrist || !middleMcp) return false;

  const handLength = distance3(wrist, middleMcp);
  if (handLength < 0.02) return false;
  return distance3(thumbTip, indexTip) / handLength <= PINCH_RATIO;
}

/** Thumb-index circle with the remaining three fingers extended, held low. */
export function isSecretCirclePose(landmarks: GesturePoint[]): boolean {
  const palm = getPalmCenter(landmarks);
  const indexMcp = landmarks[5];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middleTip = landmarks[12];
  if (!palm || !indexMcp || !indexTip || !middleMcp || !middleTip) return false;

  const indexCurledRelativeToMiddle =
    distance(indexTip, indexMcp) < distance(middleTip, middleMcp) * 0.72;
  return (
    palm.y >= SECRET_LOWER_FRAME_Y &&
    isPinching(landmarks) &&
    indexCurledRelativeToMiddle &&
    fingerExtended(landmarks, 10, 12) &&
    fingerExtended(landmarks, 14, 16) &&
    fingerExtended(landmarks, 18, 20)
  );
}

function emitAction(
  tracker: GestureTracker,
  type: GestureActionType,
  now: number,
  deltaY?: number,
): { tracker: GestureTracker; action: GestureAction } {
  return {
    action: { id: tracker.nextActionId, type, at: now, ...(deltaY === undefined ? {} : { deltaY }) },
    tracker: {
      ...tracker,
      cooldownUntil: now + ACTION_COOLDOWN_MS,
      nextActionId: tracker.nextActionId + 1,
    },
  };
}

function resetTransientTracker(previous: GestureTracker, now: number): GestureTracker {
  return {
    ...previous,
    pose: 'None',
    poseStartedAt: now,
    poseLatched: false,
    scrollSamples: [],
    scrollSeenAt: null,
    hammerSamples: [],
    hammerSeenAt: null,
    secretStartedAt: null,
    secretSeenAt: null,
    secretLatched: false,
    openPalmSeenAt: null,
    raiseHand: null,
    raiseStartedAt: null,
    raiseLatched: false,
  };
}

function appendScrollSample(
  previous: PositionSample[],
  point: PositionSample,
  now: number,
): PositionSample[] {
  return [...previous.filter((sample) => now - sample.at <= SCROLL_WINDOW_MS), point].slice(-24);
}

/**
 * Production gesture grammar intentionally stays small:
 *
 * - point + pinch -> click (the controller owns target-lock safety)
 * - closed fist dwell -> browser back
 * - index + middle fingers + vertical motion -> scroll in either direction
 *
 * The old raised-hand navigation, palm->fist palette transition, clap activate,
 * thumb-up activate and downward-fist page scroll are deliberately not emitted.
 * A fist now has one meaning everywhere.
 */
export function updateGestureTracker(
  previous: GestureTracker,
  observation: HandObservation | null,
  now: number,
): GestureUpdate {
  if (!observation) {
    return {
      tracker: resetTransientTracker(previous, now),
      action: null,
      cursor: null,
      pose: 'None',
      confidence: 0,
    };
  }

  const indexTip = observation.landmarks[8];
  const cursor = indexTip
    ? { x: clamp01(1 - indexTip.x), y: clamp01(indexTip.y), pinching: false }
    : null;

  const rawPose: CannedGesture =
    observation.confidence >= MIN_POSE_CONFIDENCE ? observation.gesture : 'None';
  const fistCandidate = rawPose === 'Closed_Fist' || isHammerPose(observation.landmarks);
  const twoFingerCandidate = rawPose === 'Victory' || isTwoFingerScrollPose(observation.landmarks);
  const effectivePose: CannedGesture = fistCandidate
    ? 'Closed_Fist'
    : twoFingerCandidate
      ? 'Victory'
      : rawPose;

  let tracker: GestureTracker = { ...previous };
  if (effectivePose !== tracker.pose) {
    tracker = { ...tracker, pose: effectivePose, poseStartedAt: now, poseLatched: false };
  }

  const secretCandidate = isSecretCirclePose(observation.landmarks);
  const secretSeenAt = secretCandidate ? now : previous.secretSeenAt;
  const secretActive =
    secretCandidate || (secretSeenAt !== null && now - secretSeenAt <= SECRET_GRACE_MS);

  if (secretActive) {
    tracker = {
      ...tracker,
      secretSeenAt,
      secretStartedAt: tracker.secretStartedAt ?? now,
    };
  } else {
    tracker = { ...tracker, secretSeenAt: null, secretStartedAt: null, secretLatched: false };
  }

  // The easter-egg circle should never leak through as a click.
  if (cursor) cursor.pinching = isPinching(observation.landmarks) && !secretActive;

  const twoFingerCenter = getTwoFingerCenter(observation.landmarks);
  const scrollSeenAt = twoFingerCandidate ? now : previous.scrollSeenAt;
  const scrollAlive =
    twoFingerCandidate || (scrollSeenAt !== null && now - scrollSeenAt <= SCROLL_GRACE_MS);
  if (twoFingerCenter && scrollAlive) {
    const point: PositionSample = {
      x: clamp01(1 - twoFingerCenter.x),
      y: clamp01(twoFingerCenter.y),
      at: now,
    };
    tracker = {
      ...tracker,
      scrollSeenAt,
      scrollSamples: appendScrollSample(previous.scrollSamples, point, now),
    };
  } else {
    tracker = { ...tracker, scrollSeenAt: null, scrollSamples: [] };
  }

  const canAct = now >= tracker.cooldownUntil;

  if (
    canAct &&
    now >= tracker.prankCooldownUntil &&
    secretActive &&
    !tracker.secretLatched &&
    tracker.secretStartedAt !== null &&
    now - tracker.secretStartedAt >= SECRET_DWELL_MS
  ) {
    tracker = { ...tracker, secretLatched: true, poseLatched: true };
    const emitted = emitAction(tracker, 'prank', now);
    emitted.tracker.prankCooldownUntil = now + PRANK_COOLDOWN_MS;
    return {
      tracker: emitted.tracker,
      action: emitted.action,
      cursor,
      pose: effectivePose,
      confidence: observation.confidence,
    };
  }

  // Scan for the largest recent vertical excursion ending at the newest sample.
  // This supports scroll-down and scroll-up with the same gesture while rejecting
  // horizontal V-sign movement and ordinary hand tremor.
  const scrollLast = tracker.scrollSamples[tracker.scrollSamples.length - 1];
  if (canAct && twoFingerCandidate && scrollLast) {
    for (const start of tracker.scrollSamples) {
      const duration = scrollLast.at - start.at;
      if (duration < SCROLL_MIN_DURATION_MS) continue;
      const dx = Math.abs(scrollLast.x - start.x);
      const dy = scrollLast.y - start.y;
      if (Math.abs(dy) < SCROLL_DISTANCE || Math.abs(dy) <= dx * SCROLL_AXIS_DOMINANCE) continue;

      const deltaY = Math.sign(dy) * clamp(Math.abs(dy) * 3.5, 0.34, 0.82);
      tracker = { ...tracker, scrollSamples: [scrollLast], poseLatched: true };
      const emitted = emitAction(tracker, 'scroll', now, deltaY);
      emitted.tracker.cooldownUntil = now + SCROLL_COOLDOWN_MS;
      emitted.tracker.scrollSamples = [scrollLast];
      return {
        tracker: emitted.tracker,
        action: emitted.action,
        cursor,
        pose: effectivePose,
        confidence: observation.confidence,
      };
    }
  }

  if (
    canAct &&
    effectivePose === 'Closed_Fist' &&
    !tracker.poseLatched &&
    now - tracker.poseStartedAt >= FIST_BACK_DWELL_MS
  ) {
    tracker = { ...tracker, poseLatched: true };
    const emitted = emitAction(tracker, 'history_back', now);
    return {
      tracker: emitted.tracker,
      action: emitted.action,
      cursor,
      pose: effectivePose,
      confidence: observation.confidence,
    };
  }

  return {
    tracker,
    action: null,
    cursor,
    pose: effectivePose,
    confidence: observation.confidence,
  };
}

export { initialGestureTracker };
