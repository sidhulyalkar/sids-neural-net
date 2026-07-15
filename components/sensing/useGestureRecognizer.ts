'use client';

import { useCallback, useRef } from 'react';
import type { CannedGesture, GesturePoint, HandObservation } from './gestures';
import { quietMediapipeInfoLogs } from './quietMediapipeLogs';

const MEDIAPIPE_VERSION = '0.10.17';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

interface GestureResultLike {
  landmarks: GesturePoint[][];
  gestures: Array<Array<{ categoryName: string; score: number }>>;
  handedness?: Array<Array<{ categoryName: string }>>;
}

interface GestureRecognizerLike {
  recognizeForVideo(video: HTMLVideoElement, timestampMs: number): GestureResultLike;
  close(): void;
}

const CANNED_GESTURES = new Set<CannedGesture>([
  'None',
  'Closed_Fist',
  'Open_Palm',
  'Pointing_Up',
  'Thumb_Down',
  'Thumb_Up',
  'Victory',
  'ILoveYou',
]);

function toCannedGesture(value: string | undefined): CannedGesture {
  return value && CANNED_GESTURES.has(value as CannedGesture)
    ? (value as CannedGesture)
    : 'Unknown';
}

export interface GestureRecognizerHandle {
  load: () => Promise<void>;
  detect: (video: HTMLVideoElement, timestampMs: number) => HandObservation | null;
  close: () => void;
  /** Delegate backing the live recognizer, for diagnostics. */
  getDelegate: () => 'GPU' | 'CPU' | null;
}

/** Lifecycle-safe, lazy MediaPipe GestureRecognizer wrapper. */
export function useGestureRecognizer(): GestureRecognizerHandle {
  const recognizerRef = useRef<GestureRecognizerLike | null>(null);
  const generationRef = useRef(0);
  const loadingRef = useRef<{ generation: number; promise: Promise<void> } | null>(null);
  const delegateRef = useRef<'GPU' | 'CPU'>('GPU');
  const forceCpuRef = useRef(false);

  const load = useCallback(async () => {
    if (recognizerRef.current) return;
    const generation = generationRef.current;
    if (loadingRef.current?.generation === generation) return loadingRef.current.promise;

    const promise = (async () => {
      quietMediapipeInfoLogs();
      const { FilesetResolver, GestureRecognizer } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        runningMode: 'VIDEO' as const,
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
        cannedGesturesClassifierOptions: { scoreThreshold: 0.55 },
      };
      const create = (delegate: 'GPU' | 'CPU') =>
        GestureRecognizer.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
        }) as unknown as Promise<GestureRecognizerLike>;

      let recognizer: GestureRecognizerLike;
      if (forceCpuRef.current) {
        recognizer = await create('CPU');
        delegateRef.current = 'CPU';
      } else {
        try {
          recognizer = await create('GPU');
          delegateRef.current = 'GPU';
        } catch (gpuError) {
          console.warn('[gestures] GPU delegate unavailable; falling back to CPU', gpuError);
          recognizer = await create('CPU');
          delegateRef.current = 'CPU';
        }
      }

      if (generation !== generationRef.current) {
        recognizer.close();
        return;
      }
      recognizerRef.current = recognizer;
    })();
    loadingRef.current = { generation, promise };

    try {
      await promise;
    } finally {
      if (loadingRef.current?.promise === promise) loadingRef.current = null;
    }
  }, []);

  const detect = useCallback(
    (video: HTMLVideoElement, timestampMs: number): HandObservation | null => {
      const recognizer = recognizerRef.current;
      if (!recognizer) return null;

      let result: GestureResultLike;
      try {
        result = recognizer.recognizeForVideo(video, timestampMs);
      } catch (err) {
        // A GPU delegate can construct successfully and still fail on every
        // inference (Firefox/WebGL emits "No texture2d array ..."). Construction
        // -time fallback never sees this, so rebuild on CPU the first time an
        // inference throws instead of failing for the rest of the session.
        if (delegateRef.current === 'GPU' && !forceCpuRef.current) {
          console.warn('[gestures] GPU inference failed; rebuilding on CPU', err);
          forceCpuRef.current = true;
          recognizerRef.current = null;
          try {
            recognizer.close();
          } catch {
            // A broken graph can also throw on close; the rebuild matters more.
          }
          void load();
          return null;
        }
        throw err;
      }

      const landmarks = result.landmarks[0];
      if (!landmarks?.length) return null;
      const category = result.gestures[0]?.[0];
      return {
        landmarks,
        gesture: toCannedGesture(category?.categoryName),
        confidence: category?.score ?? 0,
        handedness: result.handedness?.[0]?.[0]?.categoryName,
      };
    },
    [load],
  );

  const close = useCallback(() => {
    generationRef.current += 1;
    recognizerRef.current?.close();
    recognizerRef.current = null;
  }, []);

  const getDelegate = useCallback(() => (recognizerRef.current ? delegateRef.current : null), []);

  return { load, detect, close, getDelegate };
}
