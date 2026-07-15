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
  /** The second hand, when two are visible. Only the clap reads it. */
  other?: { landmarks: GesturePoint[]; handedness?: string };
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
  pose: CannedGesture;
  poseStartedAt: number;
  poseLatched: boolean;
  /** Last frame the two palms were clearly apart, so a clap needs an approach. */
  clapApartAt: number | null;
  clapLatched: boolean;
  hammerSamples: PositionSample[];
  /** Last frame the hammer shape was seen, so a blurred frame mid-swing does not wipe the buffer. */
  hammerSeenAt: number | null;
  secretStartedAt: number | null;
  /** Last frame the circle was seen; bridges the gaps that let pinch fire mid-secret. */
  secretSeenAt: number | null;
  secretLatched: boolean;
  /** Last frame an open palm was classified, for the open->close flash. */
  openPalmSeenAt: number | null;
  /** Which hand is currently held up ('Left' | 'Right'), null when none is. */
  raiseHand: string | null;
  raiseStartedAt: number | null;
  raiseLatched: boolean;
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
    pose: 'None',
    poseStartedAt: 0,
    poseLatched: false,
    clapApartAt: null,
    clapLatched: false,
    hammerSamples: [],
    hammerSeenAt: null,
    secretStartedAt: null,
    secretSeenAt: null,
    secretLatched: false,
    openPalmSeenAt: null,
    raiseHand: null,
    raiseStartedAt: null,
    raiseLatched: false,
    prankCooldownUntil: 0,
    cooldownUntil: 0,
    nextActionId: 1,
  };
}
