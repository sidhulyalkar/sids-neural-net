'use client';

// Heavy opt-in sensing runtime. This module is dynamically imported only after
// explicit consent by InteractionCapabilityProvider. It reports observable
// facial dynamics and hand gestures, never psychological-state labels.

import { useCallback, useEffect, useRef } from 'react';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { CameraSession } from '@/lib/media/CameraSession';
import { useFaceLandmarker } from './useFaceLandmarker';
import { useGestureRecognizer } from './useGestureRecognizer';
import { SensingHud } from './ui/SensingHud';
import { GestureControl } from './ui/GestureControl';
import { GestureController } from './ui/GestureController';
import { initialGestureTracker, updateGestureTracker } from './gestures';
import { isCameraPermissionDenied } from './errors';
import {
  blendshapesToExpression,
  expressionToTokens,
  neutralReading,
  rgbToCss,
  rgbTriplet,
  smoothReading,
  type ExpressionReading,
} from './expression';

const FACE_INTERVAL_MS = 1000 / 12;
const HAND_INTERVAL_MS = 1000 / 30;
const SIGNAL_VARS = ['--mood-active', '--mood-primary', '--mood-secondary', '--mood-glow', '--cyan', '--cyan-rgb'] as const;

function applyTokens(reading: ExpressionReading): void {
  const tokens = expressionToTokens(reading);
  const root = document.documentElement.style;
  root.setProperty('--mood-active', '1');
  root.setProperty('--mood-primary', rgbTriplet(tokens.primaryRGB));
  root.setProperty('--mood-secondary', rgbTriplet(tokens.secondaryRGB));
  root.setProperty('--mood-glow', String(tokens.glow));
  root.setProperty('--cyan', rgbToCss(tokens.accentRGB));
  root.setProperty('--cyan-rgb', rgbTriplet(tokens.accentRGB));
}

function clearTokens(): void {
  const root = document.documentElement.style;
  for (const variable of SIGNAL_VARS) root.removeProperty(variable);
}

export function SensingProvider() {
  const enabled = useSensingStore((state) => state.enabled);
  const status = useSensingStore((state) => state.status);
  const setStatus = useSensingStore((state) => state.setStatus);
  const setReading = useSensingStore((state) => state.setReading);
  const setFps = useSensingStore((state) => state.setFps);
  const setError = useSensingStore((state) => state.setError);
  const reset = useSensingStore((state) => state.reset);
  const gestureEnabled = useSensingStore((state) => state.gestureEnabled);
  const setGestureStatus = useSensingStore((state) => state.setGestureStatus);
  const setGestureUpdate = useSensingStore((state) => state.setGestureUpdate);
  const setGestureFps = useSensingStore((state) => state.setGestureFps);
  const setGestureError = useSensingStore((state) => state.setGestureError);
  const resetGestures = useSensingStore((state) => state.resetGestures);

  const { load: loadFace, detect: detectFace, close: closeFace } = useFaceLandmarker();
  const { load: loadGestures, detect: detectGesture, close: closeGestures } = useGestureRecognizer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<ExpressionReading>(neutralReading());
  const lastFaceInferRef = useRef(0);
  const lastHandInferRef = useRef(0);
  const gestureTrackerRef = useRef(initialGestureTracker());
  const gestureReadyRef = useRef(false);
  const gestureEnabledRef = useRef(gestureEnabled);
  const pausedRef = useRef(false);
  gestureEnabledRef.current = gestureEnabled;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    cameraRef.current = null;
  }, []);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const video = videoRef.current;
    if (!video || pausedRef.current || video.readyState < 2) return;
    const now = performance.now();

    if (now - lastFaceInferRef.current >= FACE_INTERVAL_MS) {
      const previousAt = lastFaceInferRef.current;
      lastFaceInferRef.current = now;
      try {
        const blendshapes = detectFace(video, now);
        const frame = blendshapes ? blendshapesToExpression(blendshapes) : neutralReading();
        const smoothed = smoothReading(smoothedRef.current, frame);
        smoothedRef.current = smoothed;
        applyTokens(smoothed);
        setReading(smoothed);
        if (previousAt > 0) setFps(Math.round(1000 / (now - previousAt)));
      } catch (error) {
        console.error('[sensing] face inference error', error);
      }
    }

    if (gestureEnabledRef.current && gestureReadyRef.current && now - lastHandInferRef.current >= HAND_INTERVAL_MS) {
      const previousAt = lastHandInferRef.current;
      lastHandInferRef.current = now;
      try {
        const observation = detectGesture(video, now);
        const update = updateGestureTracker(gestureTrackerRef.current, observation, now);
        gestureTrackerRef.current = update.tracker;
        setGestureUpdate(update);
        if (previousAt > 0) setGestureFps(Math.round(1000 / (now - previousAt)));
      } catch (error) {
        console.error('[sensing] gesture inference error', error);
      }
    }
  }, [detectFace, detectGesture, setReading, setFps, setGestureUpdate, setGestureFps]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      setStatus('requesting');
      const camera = new CameraSession();
      cameraRef.current = camera;
      try {
        await camera.start(video, { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } });
        if (cancelled) {
          camera.stop();
          return;
        }
        await loadFace();
        if (cancelled) return;
        smoothedRef.current = neutralReading();
        lastFaceInferRef.current = 0;
        pausedRef.current = document.hidden;
        setStatus('running');
        rafRef.current = requestAnimationFrame(tick);
      } catch (error) {
        if (cancelled) return;
        if (isCameraPermissionDenied(error)) setStatus('denied');
        else if (error instanceof Error && error.message.includes('unavailable')) setStatus('unsupported');
        else setError(error instanceof Error ? error.message : 'Failed to start camera');
        stopCamera();
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopLoop();
      stopCamera();
      closeFace();
      closeGestures();
      clearTokens();
      reset();
    };
  }, [enabled, loadFace, closeFace, closeGestures, tick, setStatus, setError, stopCamera, stopLoop, reset]);

  useEffect(() => {
    if (!gestureEnabled) {
      gestureReadyRef.current = false;
      closeGestures();
      resetGestures();
      return;
    }
    if (status !== 'running') return;
    let cancelled = false;
    setGestureStatus('loading');
    gestureTrackerRef.current = initialGestureTracker();
    lastHandInferRef.current = 0;
    void loadGestures()
      .then(() => {
        if (cancelled) return;
        gestureReadyRef.current = true;
        setGestureStatus('running');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        gestureReadyRef.current = false;
        setGestureError(error instanceof Error ? error.message : 'Failed to load hand controls');
      });
    return () => {
      cancelled = true;
      gestureReadyRef.current = false;
      closeGestures();
    };
  }, [gestureEnabled, status, loadGestures, closeGestures, setGestureStatus, setGestureError, resetGestures]);

  useEffect(() => {
    const onVisibility = () => { pausedRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <>
      <video ref={videoRef} playsInline muted className="sr-only" aria-hidden="true" tabIndex={-1} />
      <SensingHud />
      <GestureControl />
      <GestureController />
    </>
  );
}
