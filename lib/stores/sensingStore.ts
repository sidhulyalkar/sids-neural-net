// Global state for the ambient emotion sensing layer.
// First zustand store in the app. Kept intentionally small — the heavy work
// (camera, inference) lives in SensingProvider; this only holds observable state.

import { create } from 'zustand';
import { neutralReading, type EmotionReading } from '@/components/sensing/emotion/types';
import type {
  CannedGesture,
  GestureAction,
  GestureCursor,
  GestureUpdate,
} from '@/components/sensing/gestures';

export type SensingStatus =
  | 'idle' // off, never started
  | 'requesting' // waiting on camera permission
  | 'running' // active inference loop
  | 'denied' // user blocked camera
  | 'unsupported' // no camera / no WebGL / SSR
  | 'error'; // runtime failure

export type GestureStatus = 'idle' | 'loading' | 'running' | 'error';

interface SensingState {
  /** User intent: has the ambient layer been switched on? */
  enabled: boolean;
  status: SensingStatus;
  reading: EmotionReading;
  fps: number;
  error: string | null;
  gestureEnabled: boolean;
  gestureStatus: GestureStatus;
  gesturePose: CannedGesture;
  gestureConfidence: number;
  gestureCursor: GestureCursor | null;
  gestureAction: GestureAction | null;
  gestureFps: number;
  gestureError: string | null;

  setEnabled: (enabled: boolean) => void;
  setStatus: (status: SensingStatus) => void;
  setReading: (reading: EmotionReading) => void;
  setFps: (fps: number) => void;
  setError: (error: string | null) => void;
  setGestureEnabled: (enabled: boolean) => void;
  setGestureStatus: (status: GestureStatus) => void;
  setGestureUpdate: (update: GestureUpdate) => void;
  setGestureFps: (fps: number) => void;
  setGestureError: (error: string | null) => void;
  resetGestures: () => void;
  /** Return to a clean disabled state (also on camera release). */
  reset: () => void;
}

export const useSensingStore = create<SensingState>((set) => ({
  enabled: false,
  status: 'idle',
  reading: neutralReading(),
  fps: 0,
  error: null,
  gestureEnabled: false,
  gestureStatus: 'idle',
  gesturePose: 'None',
  gestureConfidence: 0,
  gestureCursor: null,
  gestureAction: null,
  gestureFps: 0,
  gestureError: null,

  setEnabled: (enabled) => set({ enabled }),
  setStatus: (status) => set({ status }),
  setReading: (reading) => set({ reading }),
  setFps: (fps) => set({ fps }),
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
  setGestureEnabled: (gestureEnabled) => set({ gestureEnabled }),
  setGestureStatus: (gestureStatus) => set({ gestureStatus }),
  setGestureUpdate: (update) =>
    set((state) => ({
      gesturePose: update.pose,
      gestureConfidence: update.confidence,
      gestureCursor: update.cursor,
      gestureAction: update.action ?? state.gestureAction,
    })),
  setGestureFps: (gestureFps) => set({ gestureFps }),
  setGestureError: (gestureError) =>
    set({ gestureError, gestureStatus: gestureError ? 'error' : 'idle' }),
  resetGestures: () =>
    set({
      gestureEnabled: false,
      gestureStatus: 'idle',
      gesturePose: 'None',
      gestureConfidence: 0,
      gestureCursor: null,
      gestureAction: null,
      gestureFps: 0,
      gestureError: null,
    }),
  reset: () =>
    set({
      status: 'idle',
      reading: neutralReading(),
      fps: 0,
      error: null,
      gestureEnabled: false,
      gestureStatus: 'idle',
      gesturePose: 'None',
      gestureConfidence: 0,
      gestureCursor: null,
      gestureAction: null,
      gestureFps: 0,
      gestureError: null,
    }),
}));
