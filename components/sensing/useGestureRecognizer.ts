'use client';

import { useCallback, useRef } from 'react';
import type { CannedGesture, GesturePoint, HandObservation } from './gestures';

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
}

/** Lifecycle-safe, lazy MediaPipe GestureRecognizer wrapper. */
export function useGestureRecognizer(): GestureRecognizerHandle {
  const recognizerRef = useRef<GestureRecognizerLike | null>(null);
  const generationRef = useRef(0);
  const loadingRef = useRef<{ generation: number; promise: Promise<void> } | null>(null);

  const load = useCallback(async () => {
    if (recognizerRef.current) return;
    const generation = generationRef.current;
    if (loadingRef.current?.generation === generation) return loadingRef.current.promise;

    const promise = (async () => {
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

      let recognizer: GestureRecognizerLike;
      try {
        recognizer = (await GestureRecognizer.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        })) as unknown as GestureRecognizerLike;
      } catch (gpuError) {
        console.warn('[gestures] GPU delegate unavailable; falling back to CPU', gpuError);
        recognizer = (await GestureRecognizer.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        })) as unknown as GestureRecognizerLike;
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
      const result = recognizer.recognizeForVideo(video, timestampMs);
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
    [],
  );

  const close = useCallback(() => {
    generationRef.current += 1;
    recognizerRef.current?.close();
    recognizerRef.current = null;
  }, []);

  return { load, detect, close };
}
