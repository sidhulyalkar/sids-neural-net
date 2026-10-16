// Lightweight global state for the opt-in signal interaction layer.
// Camera and model code are dynamically loaded only after explicit consent.

import { create } from 'zustand';
import { neutralReading, type ExpressionReading } from '@/components/sensing/expression/types';
import type {
  CannedGesture,
  GestureAction,
  GestureCursor,
  GestureUpdate,
} from '@/components/sensing/gestures';

export type SensingStatus = 'idle' | 'requesting' | 'running' | 'denied' | 'unsupported' | 'error';
export type GestureStatus = 'idle' | 'loading' | 'running' | 'error';

interface SensingState {
  enabled: boolean;
  status: SensingStatus;
  reading: ExpressionReading;
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
  setReading: (reading: ExpressionReading) => void;
  setFps: (fps: number) => void;
  setError: (error: string | null) => void;
  setGestureEnabled: (enabled: boolean) => void;
  setGestureStatus: (status: GestureStatus) => void;
  setGestureUpdate: (update: GestureUpdate) => void;
  setGestureFps: (fps: number) => void;
  setGestureError: (error: string | null) => void;
  resetGestures: () => void;
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
  setGestureUpdate: (update) => set((state) => ({
    gesturePose: update.pose,
    gestureConfidence: update.confidence,
    gestureCursor: update.cursor,
    gestureAction: update.action ?? state.gestureAction,
  })),
  setGestureFps: (gestureFps) => set({ gestureFps }),
  setGestureError: (gestureError) => set({ gestureError, gestureStatus: gestureError ? 'error' : 'idle' }),
  resetGestures: () => set({
    gestureEnabled: false,
    gestureStatus: 'idle',
    gesturePose: 'None',
    gestureConfidence: 0,
    gestureCursor: null,
    gestureAction: null,
    gestureFps: 0,
    gestureError: null,
  }),
  reset: () => set({
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
