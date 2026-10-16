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
  other?: { landmarks: GesturePoint[]; handedness?: string };
}

export type GestureActionType =
  | 'history_back'
  | 'scroll'
  | 'activate'
  | 'prank'
  // Legacy names remain readable by older recordings/tools, but production no
  // longer emits them as part of the simplified gesture vocabulary.
  | 'navigate_next'
  | 'navigate_previous'
  | 'open_palette'
  | 'close_palette'
  | 'page_down';

export interface GestureAction {
  id: number;
  type: GestureActionType;
  at: number;
  /** Signed viewport fraction for two-finger scrolling. Positive means down. */
  deltaY?: number;
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
  /** Vertical motion history while index + middle fingers are extended. */
  scrollSamples: PositionSample[];
  /** Last frame the two-finger pose was confidently present. */
  scrollSeenAt: number | null;
  /** Legacy fields retained for offline-take compatibility. */
  clapApartAt: number | null;
  clapLatched: boolean;
  hammerSamples: PositionSample[];
  hammerSeenAt: number | null;
  secretStartedAt: number | null;
  secretSeenAt: number | null;
  secretLatched: boolean;
  openPalmSeenAt: number | null;
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
    scrollSamples: [],
    scrollSeenAt: null,
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
