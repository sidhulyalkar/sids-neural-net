'use client';

// Thin React wrapper around MediaPipe FaceLandmarker.
// Loads WASM + model lazily (client-only) and turns a <video> frame into a
// BlendshapeMap. The model/WASM are fetched once from a pinned CDN and cached;
// the webcam frames themselves never leave the browser.

import { useCallback, useRef } from 'react';
import type { BlendshapeMap } from './emotion/types';

// Pinned to the installed @mediapipe/tasks-vision version for reproducibility.
const MEDIAPIPE_VERSION = '0.10.17';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Minimal structural type so we don't depend on MediaPipe types at module load.
interface FaceLandmarkerLike {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }> };
  close(): void;
}

export interface FaceLandmarkerHandle {
  /** Load WASM + model. Idempotent. Resolves when ready to detect. */
  load: () => Promise<void>;
  /** Run detection on the current video frame. Returns null if no face / not ready. */
  detect: (video: HTMLVideoElement, timestampMs: number) => BlendshapeMap | null;
  /** Release the underlying MediaPipe resources. */
  close: () => void;
}

export function useFaceLandmarker(): FaceLandmarkerHandle {
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const generationRef = useRef(0);
  const loadingRef = useRef<{ generation: number; promise: Promise<void> } | null>(null);

  const load = useCallback(async () => {
    if (landmarkerRef.current) return;
    const generation = generationRef.current;
    if (loadingRef.current?.generation === generation) return loadingRef.current.promise;

    const promise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO' as const,
        numFaces: 1,
      };

      let landmarker: FaceLandmarkerLike;
      try {
        landmarker = (await FaceLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        })) as unknown as FaceLandmarkerLike;
      } catch (gpuError) {
        // WebGL may be unavailable, blocked, or unstable on older/mobile GPUs.
        // CPU mode is slower but preserves the feature instead of failing closed.
        console.warn('[sensing] GPU delegate unavailable; falling back to CPU', gpuError);
        landmarker = (await FaceLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        })) as unknown as FaceLandmarkerLike;
      }

      // Disable/unmount can happen while WASM or the model is still loading.
      // Never publish (or leak) a resource created for an obsolete lifecycle.
      if (generation !== generationRef.current) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;
    })();
    loadingRef.current = { generation, promise };

    try {
      await promise;
    } finally {
      if (loadingRef.current?.promise === promise) loadingRef.current = null;
    }
  }, []);

  const detect = useCallback((video: HTMLVideoElement, timestampMs: number): BlendshapeMap | null => {
    const landmarker = landmarkerRef.current;
    if (!landmarker) return null;

    const result = landmarker.detectForVideo(video, timestampMs);
    const categories = result.faceBlendshapes?.[0]?.categories;
    if (!categories || categories.length === 0) return null;

    const map: BlendshapeMap = {};
    for (const c of categories) map[c.categoryName] = c.score;
    return map;
  }, []);

  const close = useCallback(() => {
    generationRef.current += 1;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  }, []);

  return { load, detect, close };
}
