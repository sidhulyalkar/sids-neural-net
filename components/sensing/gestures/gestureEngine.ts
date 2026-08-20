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
const MIN_MOTION_DURATION_MS = 100;
const ACTION_COOLDOWN_MS = 800;
/**
 * Navigation is a raised hand, not a swipe.
 *
 * A swipe cannot be told from its own return stroke — the hand travels the same
 * distance back along the same axis, so the recorded takes fire in whichever
 * direction the cooldown happens to sample. A raised hand is a static pose:
 * no motion window, no return stroke, nothing for the frame rate to alias.
 */
const RAISE_MAX_PALM_Y = 0.42;
const RAISE_DWELL_MS = 450;
/**
 * Navigating requires an open palm, not merely a raised hand.
 *
 * Reaching for something is also a raised hand, and it fired 6 navigations in a
 * 29s idle_reaching take. The shapes separate cleanly though: of frames where
 * the palm is raised, a deliberate raise is an open palm 85-97% of the time,
 * while reaching is only 9% (and general idle 0%) — a hand going for an object
 * is grasping, not open.
 */
const RAISE_REQUIRES_OPEN_PALM = true;
const PINCH_DWELL_MS = 180;
/**
 * Thumb-index gap over hand length, measured in 3D.
 *
 * 2D cannot see a pinch: the tips project onto the same point without touching,
 * so the old test fired on 13-18% of idle frames but only 4% of deliberate
 * pinches — inverted against reality. Adding z roughly halves the false rate at
 * the same recall (measured at 0.20: idle-ish negatives 6% -> 2%).
 */
const PINCH_RATIO = 0.2;
/**
 * MediaPipe does not score its canned classes on a common scale.
 *
 * Measured on real takes: Closed_Fist lands at p50 0.95, but Open_Palm at p50
 * 0.60. A single 0.65 gate discarded 92% of open palms, so the palette gesture
 * could never fire. This sits just above the recognizer's own 0.55 score
 * threshold rather than trying to be selective here.
 */
const MIN_POSE_CONFIDENCE = 0.55;
const SECRET_DWELL_MS = 900;
const SECRET_LOWER_FRAME_Y = 0.58;
const PRANK_COOLDOWN_MS = 30_000;
// Measured: a real downward strike moves the palm ~0.19-0.48 inside the window.
const HAMMER_DISTANCE = 0.15;
/**
 * How folded the fingers must be: max(tip-to-wrist / knuckle-to-wrist).
 *
 * A flat-handed chop had to be abandoned — it is the same physical motion as
 * lowering a raised hand, and no feature separated them (shape, start height,
 * end height and velocity all overlapped). A fist does separate: measured
 * below 0.85 on 70% of fist frames but 0-8% of raise/idle frames, because
 * nobody lowers a raised hand with their fingers curled into their palm.
 */
const HAMMER_CURL = 0.85;
/**
 * How long the chop buffer keeps tracking after the hand shape drops out.
 *
 * The strike is the blurriest part of the gesture, so the shape fails exactly
 * while the hand is moving fastest. Measured: positions recorded only on
 * shape-matching frames top out at dy 0.093, while the real strike travels
 * 0.649 — the motion lives entirely in the frames the shape test rejects.
 */
const HAMMER_GRACE_MS = 200;
/** Bridges frames where the circle pose flickers off and pinch would slip in. */
const SECRET_GRACE_MS = 260;

const POSE_ACTIONS: Partial<Record<CannedGesture, { action: GestureActionType; dwell: number }>> = {
  Closed_Fist: { action: 'close_palette', dwell: 450 },
  Thumb_Up: { action: 'activate', dwell: 650 },
};

/**
 * The palette opens on a flash: an open palm closed into a fist.
 *
 * A held open palm cannot be used — that is how a hand is raised to navigate,
 * so the two fired together (measured: open_palette x2 during raise_right, with
 * an open palm classified on 81% of those frames). Navigation *holds* the palm
 * open and never closes it; the palette gesture is defined by the transition,
 * which nothing else in the set performs.
 */
const OPEN_FLASH_MS = 900;
/**
 * Palms this close together (as a multiple of hand length) count as met.
 * Scaled by hand length so it holds regardless of distance from the camera.
 */
const CLAP_GAP = 1.1;
/** The palms must have been at least this far apart inside the approach window. */
const CLAP_APART = 2.0;
const CLAP_WINDOW_MS = 500;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function distance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Includes depth. Only meaningful where the tips may overlap in projection. */
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

/**
 * Wrist-to-middle-knuckle length as the scale reference.
 *
 * Palm width (index knuckle -> pinky knuckle) foreshortens to roughly a third
 * when the hand turns edge-on, which is exactly the chop pose — measured 0.154
 * flat vs 0.058 chopping. Anything normalized by it inflates ~2.6x mid-chop.
 * Hand length is taken along the rotation axis, so it stays stable.
 */
function getHandLength(landmarks: GesturePoint[]): number {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  return wrist && middleMcp ? distance(wrist, middleMcp) : 0;
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

/**
 * Closed fist: every fingertip folded back toward the wrist.
 *
 * Gates the downward hammer strike. Testing "no finger is extended" is not
 * enough — a relaxed or edge-on hand satisfies it, which fired on 56% of idle
 * talking frames. Requiring each tip to sit closer to the wrist than its own
 * knuckle is what makes a fist unambiguous.
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
    if (distance(tip, wrist) / knuckle >= HAMMER_CURL) return false;
  }
  return true;
}

/**
 * Thumb and index tips genuinely touching, judged in 3D and scaled by hand
 * length. Palm width is not usable here — it foreshortens — and neither is a
 * flat 2D gap, which a relaxed hand satisfies without the fingers meeting.
 */
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

function emitAction(
  tracker: GestureTracker,
  type: GestureActionType,
  now: number,
): { tracker: GestureTracker; action: GestureAction } {
  return {
    action: { id: tracker.nextActionId, type, at: now },
    tracker: {
      ...tracker,
      cooldownUntil: now + ACTION_COOLDOWN_MS,
      nextActionId: tracker.nextActionId + 1,
    },
  };
}

/**
 * Pure temporal gesture reducer. It applies dwell, travel-distance, and cooldown
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
        pose: 'None',
        poseStartedAt: now,
        poseLatched: false,
        hammerSamples: [],
        hammerSeenAt: null,
        secretStartedAt: null,
        secretSeenAt: null,
        secretLatched: false,
        openPalmSeenAt: null,
        raiseHand: null,
        raiseStartedAt: null,
        raiseLatched: false,
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
  let tracker: GestureTracker = { ...previous };

  const secretCandidate = isSecretCirclePose(observation.landmarks);
  const hammerCandidate = isHammerPose(observation.landmarks);

  // The hammer is the fastest gesture, so it is the most motion-blurred: the
  // shape drops out for a frame or two exactly while the hand is moving. Keep
  // recording positions through that window — merely preserving the buffer
  // without adding to it loses the strike itself, which is the whole gesture.
  const hammerSeenAt = hammerCandidate ? now : previous.hammerSeenAt;
  const hammerAlive = hammerSeenAt !== null && now - hammerSeenAt <= HAMMER_GRACE_MS;
  const keptHammer = previous.hammerSamples.filter((sample) => now - sample.at <= SAMPLE_WINDOW_MS);
  tracker = {
    ...tracker,
    hammerSeenAt: hammerAlive ? hammerSeenAt : null,
    hammerSamples: point && (hammerCandidate || hammerAlive) ? [...keptHammer, point] : [],
  };

  const pose = observation.confidence >= MIN_POSE_CONFIDENCE ? observation.gesture : 'None';
  if (pose !== tracker.pose) {
    tracker = { ...tracker, pose, poseStartedAt: now, poseLatched: false };
  }
  if (pose === 'Open_Palm') tracker = { ...tracker, openPalmSeenAt: now };

  // The circle pose is only recognized on ~43% of frames while pinch hits ~52%
  // of the same frames, so a strict test lets pinch fire in the gaps before the
  // prank's longer dwell completes. Treat the secret as held across brief drops.
  const secretSeenAt = secretCandidate ? now : previous.secretSeenAt;
  const secretActive =
    secretCandidate || (secretSeenAt !== null && now - secretSeenAt <= SECRET_GRACE_MS);

  const pinching = isPinching(observation.landmarks);
  if (cursor) cursor.pinching = pinching;
  if (secretActive) {
    tracker = {
      ...tracker,
      secretSeenAt,
      secretStartedAt: tracker.secretStartedAt ?? now,
    };
  } else {
    tracker = { ...tracker, secretSeenAt: null, secretStartedAt: null, secretLatched: false };
  }

  const canAct = now >= tracker.cooldownUntil;

  // The made-you-look circle deliberately outranks pinch. Its longer dwell
  // prevents the pose from clicking a target before the secret is recognized.
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
    return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
  }

  // Pinch no longer emits an action. It survives only to drive the air cursor's
  // pinching state and to disambiguate the secret circle.
  //
  // Measured against idle takes with hands visible, pinch-to-activate produced
  // every remaining false positive (~5-8/min) and neither lever fixed it: ratio
  // 0.20/0.17/0.15/0.12 traded 10/9/6/2 real fires against a 6/5/3/3 false
  // floor, and dwell only destroyed recall. Thumb_up already emits activate at
  // 105/105 classifier confidence with zero false positives, so the pinch was
  // buying nothing but misfires.

  // Two palms brought together. Requires both hands, so it is the only gesture
  // that reads observation.other. The approach test (they were CLAP_APART
  // recently) is what separates a clap from hands that merely rest near each
  // other while idle.
  const other = observation.other ?? null;
  const otherPalm = other ? getPalmCenter(other.landmarks) : null;
  const clapGap =
    palm && otherPalm ? distance(palm, otherPalm) / Math.max(getHandLength(observation.landmarks), 1e-6) : null;

  if (clapGap !== null) {
    const wasApart =
      tracker.clapApartAt !== null && now - tracker.clapApartAt <= CLAP_WINDOW_MS;
    if (clapGap >= CLAP_APART) tracker = { ...tracker, clapApartAt: now };
    if (canAct && !tracker.clapLatched && clapGap <= CLAP_GAP && wasApart) {
      tracker = { ...tracker, clapLatched: true, clapApartAt: null };
      const emitted = emitAction(tracker, 'activate', now);
      return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
    }
    if (clapGap > CLAP_GAP) tracker = { ...tracker, clapLatched: false };
  } else {
    tracker = { ...tracker, clapApartAt: null, clapLatched: false };
  }

  // A downward strike with a closed fist scrolls one page. The fist is what
  // makes this distinguishable from simply putting a raised hand down.
  //
  // Measure the largest downward excursion ending at the newest sample, rather
  // than the buffer's endpoints. A chop is a strike *and a recovery*: once the
  // sample rate is high enough to hold both in one window, first-to-last
  // cancels out to nothing and the gesture is never seen. Faster sampling made
  // that worse, not better, which is what gave the bug away.
  const hammerLast = tracker.hammerSamples[tracker.hammerSamples.length - 1];
  if (canAct && hammerLast) {
    for (const start of tracker.hammerSamples) {
      if (hammerLast.at - start.at < MIN_MOTION_DURATION_MS) continue;
      const dx = Math.abs(hammerLast.x - start.x);
      const dy = hammerLast.y - start.y;
      if (dy >= HAMMER_DISTANCE && dy > dx) {
        tracker = { ...tracker, poseLatched: true, hammerSamples: [] };
        const emitted = emitAction(tracker, 'page_down', now);
        emitted.tracker.cooldownUntil = now + 1200;
        return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
      }
    }
  }

  // Raise a hand to navigate: right hand forward, left hand back. Handedness
  // comes straight from MediaPipe; the dwell keeps a hand that merely passes
  // through the top of frame from paging the site.
  const raised =
    point !== null &&
    point.y <= RAISE_MAX_PALM_Y &&
    (!RAISE_REQUIRES_OPEN_PALM || pose === 'Open_Palm');
  const hand = observation.handedness ?? null;
  if (raised && hand) {
    if (tracker.raiseHand !== hand) {
      tracker = { ...tracker, raiseHand: hand, raiseStartedAt: now, raiseLatched: false };
    }
    if (
      canAct &&
      !tracker.raiseLatched &&
      tracker.raiseStartedAt !== null &&
      now - tracker.raiseStartedAt >= RAISE_DWELL_MS
    ) {
      tracker = { ...tracker, raiseLatched: true, poseLatched: true, openPalmSeenAt: null };
      const emitted = emitAction(tracker, hand === 'Right' ? 'navigate_next' : 'navigate_previous', now);
      return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
    }
  } else {
    tracker = { ...tracker, raiseHand: null, raiseStartedAt: null, raiseLatched: false };
  }

  // Palm flashed shut: open the palette. Firing here also latches the pose, so
  // the same fist does not immediately close what it just opened.
  if (
    canAct &&
    pose === 'Closed_Fist' &&
    !tracker.poseLatched &&
    tracker.openPalmSeenAt !== null &&
    now - tracker.openPalmSeenAt <= OPEN_FLASH_MS
  ) {
    tracker = { ...tracker, poseLatched: true, openPalmSeenAt: null };
    const emitted = emitAction(tracker, 'open_palette', now);
    return { tracker: emitted.tracker, action: emitted.action, cursor, pose, confidence: observation.confidence };
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
