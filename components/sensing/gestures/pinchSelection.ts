export const PINCH_HOLD_MS = 150;
export const TARGET_LOCK_MS = 120;

export interface PinchSelectionState {
  /** A release has been observed since the hand appeared or the last activation. */
  armed: boolean;
  pinching: boolean;
  pinchStartedAt: number | null;
  /** Target captured on pinch onset. Selection never follows the cursor mid-pinch. */
  pinchTargetKey: string | null;
  targetKey: string | null;
  targetStartedAt: number | null;
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
    fired: false,
  };
}

/**
 * Converts the noisy per-frame pinch boolean into a deliberate UI selection.
 *
 * Safety gates:
 * - the user must first release before a pinch can activate anything;
 * - a target must remain stable long enough to visibly "lock";
 * - the pinch itself must dwell briefly instead of firing on a single frame;
 * - the target is captured at pinch onset, so moving while pinched cannot click
 *   a different neighboring control;
 * - one pinch produces at most one activation until release.
 *
 * Keeping this state machine DOM-free makes its false-positive behavior fully
 * deterministic and unit-testable. The controller supplies opaque target keys.
 */
export function updatePinchSelection(
  previous: PinchSelectionState,
  frame: PinchSelectionFrame,
): PinchSelectionUpdate {
  let state: PinchSelectionState = { ...previous };

  if (frame.targetKey !== previous.targetKey) {
    state.targetKey = frame.targetKey;
    state.targetStartedAt = frame.targetKey ? frame.now : null;
  }

  const targetLocked = Boolean(
    state.targetKey &&
      state.targetStartedAt !== null &&
      frame.now - state.targetStartedAt >= TARGET_LOCK_MS,
  );

  if (!frame.pinching) {
    state = {
      ...state,
      armed: true,
      pinching: false,
      pinchStartedAt: null,
      pinchTargetKey: null,
      fired: false,
    };
    return { state, activate: false, targetLocked };
  }

  if (!previous.pinching) {
    state = {
      ...state,
      pinching: true,
      pinchStartedAt: frame.now,
      pinchTargetKey: frame.targetKey,
      fired: false,
    };
  } else {
    state.pinching = true;
  }

  const pinchHeld =
    state.pinchStartedAt !== null && frame.now - state.pinchStartedAt >= PINCH_HOLD_MS;
  const sameTarget =
    state.pinchTargetKey !== null && state.pinchTargetKey === state.targetKey;

  if (state.armed && !state.fired && pinchHeld && sameTarget && targetLocked) {
    state = { ...state, armed: false, fired: true };
    return { state, activate: true, targetLocked };
  }

  return { state, activate: false, targetLocked };
}
