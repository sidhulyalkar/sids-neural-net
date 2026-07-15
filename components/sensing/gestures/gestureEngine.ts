import {
  initialGestureTracker,
  type CannedGesture,
  type GestureAction,
  type GestureActionType,
  type GesturePoint,
  type GestureTracker,
  type GestureUpdate,
  type HandObservation,
} from './types';

const SAMPLE_WINDOW_MS = 420;
const SWIPE_MIN_DURATION_MS = 100;
const SWIPE_DISTANCE = 0.24;
const SWIPE_MAX_VERTICAL_DRIFT = 0.16;
const ACTION_COOLDOWN_MS = 800;
const PINCH_DWELL_MS = 180;
const PINCH_RATIO = 0.28;
const MIN_POSE_CONFIDENCE = 0.65;
const SECRET_DWELL_MS = 900;
const SECRET_LOWER_FRAME_Y = 0.58;
const PRANK_COOLDOWN_MS = 30_000;
const CHOP_DISTANCE = 0.2;
const CHOP_MAX_HORIZONTAL_DRIFT = 0.12;

const POSE_ACTIONS: Partial<Record<CannedGesture, { action: GestureActionType; dwell: number }>> = {
  Open_Palm: { action: 'open_palette', dwell: 700 },
  Closed_Fist: { action: 'close_palette', dwell: 450 },
  Thumb_Up: { action: 'activate', dwell: 650 },
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function distance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function fingerExtended(landmarks: GesturePoint[], pipIndex: number, tipIndex: number): boolean {
  const wrist = landmarks[0];
  const pip = landmarks[pipIndex];
  const tip = landmarks[tipIndex];
  if (!wrist || !pip || !tip) return false;
  return distance(tip, wrist) > distance(pip, wrist) * 1.16;
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

/** Flat, fingers-together hand shape used to gate downward chop motion. */
export function isKarateChopPose(landmarks: GesturePoint[]): boolean {
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  const thumbTip = landmarks[4];
  const tips = [8, 12, 16, 20].map((index) => landmarks[index]);
  if (!indexMcp || !pinkyMcp || !thumbTip || tips.some((tip) => !tip)) return false;

  const palmWidth = distance(indexMcp, pinkyMcp);
  if (palmWidth < 0.02) return false;
  const fingersTogether = tips
    .slice(1)
    .every((tip, index) => distance(tips[index]!, tip!) / palmWidth < 0.48);
  const thumbTucked = distance(thumbTip, indexMcp) / palmWidth < 0.9;

  return (
    thumbTucked &&
    fingersTogether &&
    fingerExtended(landmarks, 6, 8) &&
    fingerExtended(landmarks, 10, 12) &&
    fingerExtended(landmarks, 14, 16) &&
    fingerExtended(landmarks, 18, 20)
  );
}

export function isPinching(landmarks: GesturePoint[]): boolean {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  if (!thumbTip || !indexTip || !indexMcp || !pinkyMcp) return false;

  const palmWidth = distance(indexMcp, pinkyMcp);
  if (palmWidth < 0.02) return false;
  return distance(thumbTip, indexTip) / palmWidth <= PINCH_RATIO;
}

function emitAction(
  tracker: GestureTracker,
  type: GestureActionType,
  now: number,
): { tracker: GestureTracker; action: GestureAction } {
  return {
    action: { id: tracker.nextActionId, type, at: now },
    tracker: {
      ...tracker,
      samples: [],
      cooldownUntil: now + ACTION_COOLDOWN_MS,
      nextActionId: tracker.nextActionId + 1,
    },
  };
}

/**
 * Pure temporal gesture reducer. It applies dwell, swipe-distance, and cooldown
 * gates so a held pose cannot repeatedly trigger website actions.
 */
export function updateGestureTracker(
  previous: GestureTracker,
  observation: HandObservation | null,
  now: number,
): GestureUpdate {
  if (!observation) {
    return {
      tracker: {
        ...previous,
        samples: [],
        pose: 'None',
        poseStartedAt: now,
        poseLatched: false,
        pinchStartedAt: null,
        pinchLatched: false,
        chopSamples: [],
        secretStartedAt: null,
        secretLatched: false,
      },
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
  const palm = getPalmCenter(observation.landmarks);
  const point = palm ? { x: clamp01(1 - palm.x), y: clamp01(palm.y), at: now } : null;
  let tracker: GestureTracker = {
    ...previous,
    samples: point
      ? [...previous.samples.filter((sample) => now - sample.at <= SAMPLE_WINDOW_MS), point]
      : [],
  };

  const secretCandidate = isSecretCirclePose(observation.landmarks);
  const chopCandidate = isKarateChopPose(observation.landmarks);
  tracker = {
    ...tracker,
    chopSamples:
      chopCandidate && point
        ? [...previous.chopSamples.filter((sample) => now - sample.at <= SAMPLE_WINDOW_MS), point]
        : [],
  };

  const pose = observation.confidence >= MIN_POSE_CONFIDENCE ? observation.gesture : 'None';
  if (pose !== tracker.pose) {
    tracker = { ...tracker, pose, poseStartedAt: now, poseLatched: false };
  }

  const pinching = isPinching(observation.landmarks);
  if (cursor) cursor.pinching = pinching;
  if (secretCandidate) {
    tracker = {
      ...tracker,
      pinchStartedAt: null,
      pinchLatched: false,
      secretStartedAt: tracker.secretStartedAt ?? now,
    };
  } else if (!pinching) {
    tracker = { ...tracker, pinchStartedAt: null, pinchLatched: false };
  } else if (tracker.pinchStartedAt === null) {
    tracker = { ...tracker, pinchStartedAt: now };
  }
  if (!secretCandidate) {
    tracker = { ...tracker, secretStartedAt: null, secretLatched: false };
  }

  const canAct = now >= tracker.cooldownUntil;

  // The made-you-look circle deliberately outranks pinch. Its longer dwell
  // prevents the pose from clicking a target before the secret is recognized.
  if (
    canAct &&
    now >= tracker.prankCooldownUntil &&
    secretCandidate &&
    !tracker.secretLatched &&
    tracker.secretStartedAt !== null &&
    now - tracker.secretStartedAt >= SECRET_DWELL_MS
  ) {
    tracker = { ...tracker, secretLatched: true, poseLatched: true };
    const emitted = emitAction(tracker, 'prank', now);
    emitted.tracker.prankCooldownUntil = now + PRANK_COOLDOWN_MS;
    return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
  }

  // A deliberate pinch activates the interactive element under the air cursor.
  if (
    canAct &&
    !secretCandidate &&
    pinching &&
    !tracker.pinchLatched &&
    tracker.pinchStartedAt !== null &&
    now - tracker.pinchStartedAt >= PINCH_DWELL_MS
  ) {
    tracker = { ...tracker, pinchLatched: true, poseLatched: true };
    const emitted = emitAction(tracker, 'activate', now);
    return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
  }

  // A fast downward motion with a flat, fingers-together hand scrolls one page.
  const chopFirst = tracker.chopSamples[0];
  const chopLast = tracker.chopSamples[tracker.chopSamples.length - 1];
  if (canAct && chopFirst && chopLast && chopLast.at - chopFirst.at >= SWIPE_MIN_DURATION_MS) {
    const dx = Math.abs(chopLast.x - chopFirst.x);
    const dy = chopLast.y - chopFirst.y;
    if (dy >= CHOP_DISTANCE && dx <= CHOP_MAX_HORIZONTAL_DRIFT) {
      tracker = { ...tracker, poseLatched: true, chopSamples: [] };
      const emitted = emitAction(tracker, 'page_down', now);
      emitted.tracker.cooldownUntil = now + 1200;
      return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
    }
  }

  // Swipes use mirrored palm coordinates so direction feels natural in selfie view.
  const first = tracker.samples[0];
  const last = tracker.samples[tracker.samples.length - 1];
  if (canAct && first && last && last.at - first.at >= SWIPE_MIN_DURATION_MS) {
    const dx = last.x - first.x;
    const dy = Math.abs(last.y - first.y);
    if (Math.abs(dx) >= SWIPE_DISTANCE && dy <= SWIPE_MAX_VERTICAL_DRIFT) {
      tracker = { ...tracker, poseLatched: true };
      const emitted = emitAction(tracker, dx < 0 ? 'navigate_next' : 'navigate_previous', now);
      return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
    }
  }

  const poseAction = POSE_ACTIONS[pose];
  if (canAct && poseAction && !tracker.poseLatched && now - tracker.poseStartedAt >= poseAction.dwell) {
    tracker = { ...tracker, poseLatched: true };
    const emitted = emitAction(tracker, poseAction.action, now);
    return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
  }

  return { tracker, action: null, cursor, pose, confidence: observation.confidence };
}

export { initialGestureTracker };
