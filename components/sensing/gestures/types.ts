export type GesturePoint = {
  x: number;
  y: number;
  z?: number;
};

export type CannedGesture =
  | 'None'
  | 'Closed_Fist'
  | 'Open_Palm'
  | 'Pointing_Up'
  | 'Thumb_Down'
  | 'Thumb_Up'
  | 'Victory'
  | 'ILoveYou'
  | 'Unknown';

export interface HandObservation {
  landmarks: GesturePoint[];
  gesture: CannedGesture;
  confidence: number;
  handedness?: string;
}

export type GestureActionType =
  | 'navigate_next'
  | 'navigate_previous'
  | 'open_palette'
  | 'close_palette'
  | 'activate'
  | 'page_down'
  | 'prank';

export interface GestureAction {
  id: number;
  type: GestureActionType;
  at: number;
}

export interface GestureCursor {
  /** Mirrored viewport coordinates in the normalized 0..1 range. */
  x: number;
  y: number;
  pinching: boolean;
}

export interface PositionSample {
  x: number;
  y: number;
  at: number;
}

export interface GestureTracker {
  samples: PositionSample[];
  pose: CannedGesture;
  poseStartedAt: number;
  poseLatched: boolean;
  pinchStartedAt: number | null;
  pinchLatched: boolean;
  chopSamples: PositionSample[];
  secretStartedAt: number | null;
  secretLatched: boolean;
  prankCooldownUntil: number;
  cooldownUntil: number;
  nextActionId: number;
}

export interface GestureUpdate {
  tracker: GestureTracker;
  action: GestureAction | null;
  cursor: GestureCursor | null;
  pose: CannedGesture;
  confidence: number;
}

export function initialGestureTracker(): GestureTracker {
  return {
    samples: [],
    pose: 'None',
    poseStartedAt: 0,
    poseLatched: false,
    pinchStartedAt: null,
    pinchLatched: false,
    chopSamples: [],
    secretStartedAt: null,
    secretLatched: false,
    prankCooldownUntil: 0,
    cooldownUntil: 0,
    nextActionId: 1,
  };
}
