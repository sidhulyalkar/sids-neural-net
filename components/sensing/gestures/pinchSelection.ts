export const PINCH_HOLD_MS = 150;
export const TARGET_LOCK_MS = 120;
export const RELEASE_ARM_MS = 100;

export interface PinchSelectionConfig {
  pinchHoldMs: number;
  targetLockMs: number;
  releaseArmMs: number;
}

export const DEFAULT_PINCH_SELECTION_CONFIG: PinchSelectionConfig = {
  pinchHoldMs: PINCH_HOLD_MS,
  targetLockMs: TARGET_LOCK_MS,
  releaseArmMs: RELEASE_ARM_MS,
};

export interface PinchSelectionState {
  /** A stable release has been observed since the hand appeared or the last activation. */
  armed: boolean;
  pinching: boolean;
  pinchStartedAt: number | null;
  /** Target captured on pinch onset. Selection never follows the cursor mid-pinch. */
  pinchTargetKey: string | null;
  targetKey: string | null;
  targetStartedAt: number | null;
  /** Start of the current unpinched interval, used to reject one-frame dropouts. */
  releaseStartedAt: number | null;
  fired: boolean;
}

export interface PinchSelectionFrame {
  pinching: boolean;
  targetKey: string | null;
  now: number;
}

export interface PinchSelectionUpdate {
  state: PinchSelectionState;
  activate: boolean;
  targetLocked: boolean;
}

export function initialPinchSelectionState(): PinchSelectionState {
  return {
    armed: false,
    pinching: false,
    pinchStartedAt: null,
    pinchTargetKey: null,
    targetKey: null,
    targetStartedAt: null,
    releaseStartedAt: null,
    fired: false,
  };
}

/**
 * Converts the noisy per-frame pinch boolean into a deliberate UI selection.
 *
 * Safety gates:
 * - a stable release must occur before pinch can activate anything;
 * - a target must remain stable long enough to visibly "lock";
 * - the pinch itself must dwell briefly instead of firing on a single frame;
 * - the target is captured at pinch onset, so moving while pinched cannot click
 *   a different neighboring control;
 * - one pinch produces at most one activation until a stable release;
 * - one-frame pinch dropouts do not re-arm the selector.
 *
 * The config is deliberately narrow: calibration may tune timing, but it cannot
 * remove these safety invariants. Keeping the state machine DOM-free makes its
 * false-positive behavior deterministic and unit-testable.
 */
export function updatePinchSelection(
  previous: PinchSelectionState,
  frame: PinchSelectionFrame,
  config: PinchSelectionConfig = DEFAULT_PINCH_SELECTION_CONFIG,
): PinchSelectionUpdate {
  let state: PinchSelectionState = { ...previous };

  if (frame.targetKey !== previous.targetKey) {
    state.targetKey = frame.targetKey;
    state.targetStartedAt = frame.targetKey ? frame.now : null;
  }

  const targetLocked = Boolean(
    state.targetKey &&
      state.targetStartedAt !== null &&
      frame.now - state.targetStartedAt >= config.targetLockMs,
  );

  if (!frame.pinching) {
    const releaseStartedAt = previous.pinching || previous.releaseStartedAt === null
      ? frame.now
      : previous.releaseStartedAt;
    const releaseStable = frame.now - releaseStartedAt >= config.releaseArmMs;

    state = {
      ...state,
      armed: previous.armed || releaseStable,
      pinching: false,
      pinchStartedAt: null,
      pinchTargetKey: null,
      releaseStartedAt,
      fired: releaseStable ? false : previous.fired,
    };
    return { state, activate: false, targetLocked };
  }

  if (!previous.pinching) {
    state = {
      ...state,
      pinching: true,
      pinchStartedAt: frame.now,
      pinchTargetKey: frame.targetKey,
      releaseStartedAt: null,
    };
  } else {
    state.pinching = true;
    state.releaseStartedAt = null;
  }

  const pinchHeld =
    state.pinchStartedAt !== null && frame.now - state.pinchStartedAt >= config.pinchHoldMs;
  const sameTarget = state.pinchTargetKey !== null && state.pinchTargetKey === state.targetKey;

  if (state.armed && !state.fired && pinchHeld && sameTarget && targetLocked) {
    state = { ...state, armed: false, fired: true };
    return { state, activate: true, targetLocked };
  }

  return { state, activate: false, targetLocked };
}
