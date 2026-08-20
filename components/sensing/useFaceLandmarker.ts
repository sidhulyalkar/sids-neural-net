'use client';

// Thin React wrapper around MediaPipe FaceLandmarker.
// Loads WASM + model lazily (client-only) and turns a <video> frame into a
// BlendshapeMap. The model/WASM are fetched once from a pinned CDN and cached;
// the webcam frames themselves never leave the browser.

import { useCallback, useRef } from 'react';
import type { BlendshapeMap } from './expression/types';
import { quietMediapipeInfoLogs } from './quietMediapipeLogs';

const MEDIAPIPE_VERSION = '0.10.17';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

interface FaceLandmarkerLike {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }> };
  close(): void;
}

export interface FaceLandmarkerHandle {
  load: () => Promise<void>;
  detect: (video: HTMLVideoElement, timestampMs: number) => BlendshapeMap | null;
  close: () => void;
  getDelegate: () => 'GPU' | 'CPU' | null;
}

export function useFaceLandmarker(): FaceLandmarkerHandle {
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const generationRef = useRef(0);
  const loadingRef = useRef<{ generation: number; promise: Promise<void> } | null>(null);
  const delegateRef = useRef<'GPU' | 'CPU'>('GPU');
  const forceCpuRef = useRef(false);

  const load = useCallback(async () => {
    if (landmarkerRef.current) return;
    const generation = generationRef.current;
    if (loadingRef.current?.generation === generation) return loadingRef.current.promise;

    const promise = (async () => {
      quietMediapipeInfoLogs();
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = { outputFaceBlendshapes: true, runningMode: 'VIDEO' as const, numFaces: 1 };
      const create = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
        }) as unknown as Promise<FaceLandmarkerLike>;

      let landmarker: FaceLandmarkerLike;
      if (forceCpuRef.current) {
        landmarker = await create('CPU');
        delegateRef.current = 'CPU';
      } else {
        try {
          landmarker = await create('GPU');
          delegateRef.current = 'GPU';
        } catch (gpuError) {
          console.warn('[sensing] GPU delegate unavailable; falling back to CPU', gpuError);
          landmarker = await create('CPU');
          delegateRef.current = 'CPU';
        }
      }

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
    let result: { faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }> };
    try {
      result = landmarker.detectForVideo(video, timestampMs);
    } catch (error) {
      if (delegateRef.current === 'GPU' && !forceCpuRef.current) {
        console.warn('[sensing] GPU inference failed; rebuilding on CPU', error);
        forceCpuRef.current = true;
        landmarkerRef.current = null;
        try { landmarker.close(); } catch { /* broken graphs can also fail on close */ }
        void load();
        return null;
      }
      throw error;
    }

    const categories = result.faceBlendshapes?.[0]?.categories;
    if (!categories?.length) return null;
    const map: BlendshapeMap = {};
    for (const category of categories) map[category.categoryName] = category.score;
    return map;
  }, [load]);

  const close = useCallback(() => {
    generationRef.current += 1;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  }, []);

  const getDelegate = useCallback(() => (landmarkerRef.current ? delegateRef.current : null), []);
  return { load, detect, close, getDelegate };
}
