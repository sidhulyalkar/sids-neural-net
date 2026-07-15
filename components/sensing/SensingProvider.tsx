'use client';

// Site-wide ambient emotion layer. Mounted once in the root layout.
// Owns: camera lifecycle, the throttled inference loop, and writing mood
// tokens to :root. Does nothing (and touches no camera) until the user
// explicitly enables it via SensingToggle.

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSensingStore } from '@/lib/stores/sensingStore';
import { useFaceLandmarker } from './useFaceLandmarker';
import { useGestureRecognizer } from './useGestureRecognizer';
import { SensingToggle } from './ui/SensingToggle';
import { SensingHud } from './ui/SensingHud';
import { GestureControl } from './ui/GestureControl';
import { GestureController } from './ui/GestureController';
import { initialGestureTracker, updateGestureTracker } from './gestures';
import { isCameraPermissionDenied } from './errors';
import {
  blendshapesToEmotion,
  emotionToTokens,
  neutralReading,
  rgbToCss,
  rgbTriplet,
  smoothReading,
  type EmotionReading,
} from './emotion';

/** ~12 FPS is plenty for mood; keeps CPU/GPU cost low. */
const FACE_INTERVAL_MS = 1000 / 12;
// Hands run at 30: a chop lasts ~200ms, which 15 FPS samples ~3 times — too few
// to survive the frames motion blur costs us. Measured chop takes came through
// at an effective 6.5-11 FPS, which aliased the strike away entirely.
const HAND_INTERVAL_MS = 1000 / 30;

/** CSS custom properties we override on <html> while active. */
const MOOD_VARS = ['--mood-active', '--mood-primary', '--mood-secondary', '--mood-glow', '--cyan', '--cyan-rgb'] as const;

function applyTokens(reading: EmotionReading): void {
  const tokens = emotionToTokens(reading);
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
  for (const v of MOOD_VARS) root.removeProperty(v);
}

export function SensingProvider() {
  // The lab route drives the same models from its own camera. Mounting this
  // layer there too would run two cameras and four models at once.
  const pathname = usePathname();
  if (pathname?.startsWith('/sensing-lab')) return null;
  return <SensingLayer />;
}

function SensingLayer() {
  const enabled = useSensingStore((s) => s.enabled);
  const status = useSensingStore((s) => s.status);
  const setStatus = useSensingStore((s) => s.setStatus);
  const setReading = useSensingStore((s) => s.setReading);
  const setFps = useSensingStore((s) => s.setFps);
  const setError = useSensingStore((s) => s.setError);
  const reset = useSensingStore((s) => s.reset);
  const gestureEnabled = useSensingStore((s) => s.gestureEnabled);
  const setGestureStatus = useSensingStore((s) => s.setGestureStatus);
  const setGestureUpdate = useSensingStore((s) => s.setGestureUpdate);
  const setGestureFps = useSensingStore((s) => s.setGestureFps);
  const setGestureError = useSensingStore((s) => s.setGestureError);
  const resetGestures = useSensingStore((s) => s.resetGestures);

  const { load: loadFace, detect: detectFace, close: closeFace } = useFaceLandmarker();
  const {
    load: loadGestures,
    detect: detectGesture,
    close: closeGestures,
  } = useGestureRecognizer();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<EmotionReading>(neutralReading());
  const lastFaceInferRef = useRef(0);
  const lastHandInferRef = useRef(0);
  const gestureTrackerRef = useRef(initialGestureTracker());
  const gestureReadyRef = useRef(false);
  const gestureEnabledRef = useRef(gestureEnabled);
  const pausedRef = useRef(false);
  gestureEnabledRef.current = gestureEnabled;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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
        // No face -> ease back toward neutral so colors relax.
        const frame = blendshapes ? blendshapesToEmotion(blendshapes) : neutralReading();
        const smoothed = smoothReading(smoothedRef.current, frame);
        smoothedRef.current = smoothed;
        applyTokens(smoothed);
        setReading(smoothed);
        if (previousAt > 0) setFps(Math.round(1000 / (now - previousAt)));
      } catch (err) {
        // A transient inference hiccup shouldn't tear down the whole layer.
        console.error('[sensing] face inference error', err);
      }
    }

    if (
      gestureEnabledRef.current &&
      gestureReadyRef.current &&
      now - lastHandInferRef.current >= HAND_INTERVAL_MS
    ) {
      const previousAt = lastHandInferRef.current;
      lastHandInferRef.current = now;
      try {
        const observation = detectGesture(video, now);
        const update = updateGestureTracker(gestureTrackerRef.current, observation, now);
        gestureTrackerRef.current = update.tracker;
        setGestureUpdate(update);
        if (previousAt > 0) setGestureFps(Math.round(1000 / (now - previousAt)));
      } catch (err) {
        console.error('[sensing] gesture inference error', err);
      }
    }
  }, [detectFace, detectGesture, setReading, setFps, setGestureUpdate, setGestureFps]);

  // Main lifecycle: react to enable/disable.
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      setStatus('requesting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        await loadFace();
        if (cancelled) return;

        smoothedRef.current = neutralReading();
        lastFaceInferRef.current = 0;
        pausedRef.current = document.hidden;
        setStatus('running');
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const denied = isCameraPermissionDenied(err);
        if (denied) {
          setStatus('denied');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to start camera');
        }
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

  // Gesture recognition is independently enabled but reuses the active camera.
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
      .catch((err: unknown) => {
        if (cancelled) return;
        gestureReadyRef.current = false;
        setGestureError(err instanceof Error ? err.message : 'Failed to load hand controls');
      });

    return () => {
      cancelled = true;
      gestureReadyRef.current = false;
      closeGestures();
    };
  }, [gestureEnabled, status, loadGestures, closeGestures, setGestureStatus, setGestureError, resetGestures]);

  // Pause the loop when the tab is hidden; resume on return.
  useEffect(() => {
    function onVisibility() {
      pausedRef.current = document.hidden;
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <>
      {/* Hidden capture surface — never rendered to the user. */}
      <video ref={videoRef} playsInline muted className="sr-only" aria-hidden="true" tabIndex={-1} />
      <SensingToggle />
      <SensingHud />
      <GestureControl />
      <GestureController />
    </>
  );
}
