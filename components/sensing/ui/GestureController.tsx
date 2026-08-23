'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Hand,
  MousePointer2,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSensingStore } from '@/lib/stores/sensingStore';
import type { GestureActionType } from '../gestures';
import {
  CALIBRATION_BOOTSTRAP_PROFILE,
  CALIBRATION_STEPS,
  DEFAULT_GESTURE_CALIBRATION,
  deriveGestureCalibration,
  loadGestureCalibration,
  saveGestureCalibration,
  type CalibrationStepId,
  type GestureCalibrationProfile,
} from '../gestures/gestureCalibration';
import {
  initialPinchSelectionState,
  updatePinchSelection,
  type PinchSelectionConfig,
} from '../gestures/pinchSelection';

const GESTURE_GUIDE_EVENT = 'sensing:gesture-guide';
const GESTURE_RECALIBRATE_EVENT = 'sensing:gesture-recalibrate';
const CALIBRATION_TARGET = 'primary';
const AIM_SAMPLE_MS = 480;
const MIN_AIM_SAMPLES = 8;
const INTERACTIVE_SELECTOR = [
  '[data-gesture-target]',
  'a[href]',
  'button',
  '[role="button"]',
  '[role="link"]',
  '[cmdk-item]',
  'summary',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(', ');

const ACTION_LABELS: Partial<Record<GestureActionType, string>> = {
  history_back: 'Back',
  scroll: 'Two-finger scroll',
  activate: 'Target activated',
  prank: 'Okay, you got me. The site looked. 👀',
};

const targetIds = new WeakMap<HTMLElement, number>();
let nextTargetId = 1;

type GuidePhase = 'hidden' | 'visible' | 'fading';
type PanelKind = 'guide' | 'calibration' | 'complete';
type InteractionGate = 'pending' | 'calibrating' | 'ready';

function isTyping(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}

function hasBlockingDialog(): boolean {
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

function isUsableTarget(target: HTMLElement): boolean {
  if (target.closest('[data-gesture-ignore]')) return false;
  if (target.matches(':disabled, [aria-disabled="true"], [aria-hidden="true"]')) return false;
  const rect = target.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

function interactiveAt(x: number, y: number, probeRadiusPx: number): HTMLElement | null {
  const px = x * window.innerWidth;
  const py = y * window.innerHeight;
  const diagonal = probeRadiusPx * 0.7;
  const probes = [
    [0, 0],
    [probeRadiusPx, 0],
    [-probeRadiusPx, 0],
    [0, probeRadiusPx],
    [0, -probeRadiusPx],
    [diagonal, diagonal],
    [diagonal, -diagonal],
    [-diagonal, diagonal],
    [-diagonal, -diagonal],
  ] as const;
  const candidates = new Set<HTMLElement>();

  for (const [dx, dy] of probes) {
    const element = document.elementFromPoint(
      Math.min(window.innerWidth - 1, Math.max(0, px + dx)),
      Math.min(window.innerHeight - 1, Math.max(0, py + dy)),
    );
    const target = element?.closest<HTMLElement>(INTERACTIVE_SELECTOR) ?? null;
    if (target && isUsableTarget(target)) candidates.add(target);
  }

  let best: HTMLElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = distanceToRect(px, py, candidate.getBoundingClientRect());
    if (score < bestDistance) {
      best = candidate;
      bestDistance = score;
    }
  }
  return bestDistance <= probeRadiusPx ? best : null;
}

function targetKey(target: HTMLElement | null): string | null {
  if (!target) return null;
  let id = targetIds.get(target);
  if (!id) {
    id = nextTargetId++;
    targetIds.set(target, id);
  }
  return `gesture-target-${id}`;
}

function targetLabel(target: HTMLElement | null): string | null {
  const label =
    target?.getAttribute('aria-label') ||
    target?.getAttribute('title') ||
    target?.textContent?.trim() ||
    null;
  return label ? label.replace(/\s+/g, ' ').slice(0, 52) : null;
}

function activateTarget(target: HTMLElement): void {
  try {
    target.focus({ preventScroll: true });
  } catch {
    // Clicking still works for synthetic/legacy targets that reject focus options.
  }
  target.click();
}

function pinchConfig(profile: GestureCalibrationProfile): PinchSelectionConfig {
  return {
    pinchHoldMs: profile.pinchHoldMs,
    targetLockMs: profile.targetLockMs,
    releaseArmMs: profile.releaseArmMs,
  };
}

function isCalibrationTarget(target: HTMLElement | null): boolean {
  return target?.dataset.gestureCalibrationTarget === CALIBRATION_TARGET;
}

function scrollPage(deltaY = 0.5): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({
    top: window.innerHeight * deltaY,
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
}

export function GestureController() {
  const router = useRouter();
  const enabled = useSensingStore((state) => state.gestureEnabled);
  const status = useSensingStore((state) => state.gestureStatus);
  const cursor = useSensingStore((state) => state.gestureCursor);
  const pose = useSensingStore((state) => state.gesturePose);
  const action = useSensingStore((state) => state.gestureAction);
  const fps = useSensingStore((state) => state.gestureFps);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [targetText, setTargetText] = useState<string | null>(null);
  const [targetLocked, setTargetLocked] = useState(false);
  const [guidePhase, setGuidePhase] = useState<GuidePhase>('hidden');
  const [panelKind, setPanelKind] = useState<PanelKind>('guide');
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationStepIndex, setCalibrationStepIndex] = useState(0);
  const [calibrationProfile, setCalibrationProfile] = useState<GestureCalibrationProfile | null>(null);
  const [pranked, setPranked] = useState(false);

  const handledActionRef = useRef(0);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const prankTimeoutRef = useRef<number | null>(null);
  const guideFadeTimeoutRef = useRef<number | null>(null);
  const guideHideTimeoutRef = useRef<number | null>(null);
  const uiFrameRef = useRef<number | null>(null);
  const uiQueueRef = useRef<Array<() => void>>([]);
  const pinchSelectionRef = useRef(initialPinchSelectionState());
  const calibrationProfileRef = useRef<GestureCalibrationProfile | null>(null);
  const calibrationFallbackProfileRef = useRef<GestureCalibrationProfile | null>(null);
  const calibrationStepIndexRef = useRef(0);
  const interactionGateRef = useRef<InteractionGate>('pending');
  const sessionInitializedRef = useRef(false);
  const aimSeenAtRef = useRef<number | null>(null);
  const pointerSamplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const calibrationPinchStartedAtRef = useRef<number | null>(null);
  const calibrationPinchActivatedRef = useRef(false);
  const calibrationPinchDurationRef = useRef(300);

  const queueUi = useCallback((update: () => void) => {
    uiQueueRef.current.push(update);
    if (uiFrameRef.current !== null) return;
    uiFrameRef.current = window.requestAnimationFrame(() => {
      uiFrameRef.current = null;
      const queued = uiQueueRef.current.splice(0);
      for (const run of queued) run();
    });
  }, []);

  const clearGuideTimers = useCallback(() => {
    if (guideFadeTimeoutRef.current !== null) window.clearTimeout(guideFadeTimeoutRef.current);
    if (guideHideTimeoutRef.current !== null) window.clearTimeout(guideHideTimeoutRef.current);
    guideFadeTimeoutRef.current = null;
    guideHideTimeoutRef.current = null;
  }, []);

  const showFeedback = useCallback(
    (label: string, duration = 1200) => {
      queueUi(() => setFeedback(label));
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(null), duration);
    },
    [queueUi],
  );

  const showGuide = useCallback(() => {
    if (interactionGateRef.current === 'calibrating') return;
    clearGuideTimers();
    queueUi(() => {
      setPanelKind('guide');
      setGuidePhase('visible');
    });
    guideFadeTimeoutRef.current = window.setTimeout(() => setGuidePhase('fading'), 6200);
    guideHideTimeoutRef.current = window.setTimeout(() => setGuidePhase('hidden'), 7300);
  }, [clearGuideTimers, queueUi]);

  const beginCalibration = useCallback(() => {
    clearGuideTimers();
    calibrationFallbackProfileRef.current = loadGestureCalibration();
    interactionGateRef.current = 'calibrating';
    calibrationStepIndexRef.current = 0;
    aimSeenAtRef.current = null;
    pointerSamplesRef.current = [];
    calibrationPinchStartedAtRef.current = null;
    calibrationPinchActivatedRef.current = false;
    calibrationPinchDurationRef.current = 300;
    pinchSelectionRef.current = initialPinchSelectionState();
    queueUi(() => {
      setCalibrationActive(true);
      setCalibrationStepIndex(0);
      setPanelKind('calibration');
      setGuidePhase('visible');
    });
    showFeedback('Calibration started', 900);
  }, [clearGuideTimers, queueUi, showFeedback]);

  const cancelCalibration = useCallback(() => {
    if (interactionGateRef.current !== 'calibrating') return;

    const previousProfile = calibrationFallbackProfileRef.current;
    calibrationProfileRef.current = previousProfile ?? DEFAULT_GESTURE_CALIBRATION;
    interactionGateRef.current = 'ready';
    calibrationStepIndexRef.current = 0;
    aimSeenAtRef.current = null;
    pointerSamplesRef.current = [];
    calibrationPinchStartedAtRef.current = null;
    calibrationPinchActivatedRef.current = false;
    calibrationPinchDurationRef.current = 300;
    pinchSelectionRef.current = initialPinchSelectionState();
    clearGuideTimers();

    queueUi(() => {
      setCalibrationActive(false);
      setCalibrationStepIndex(0);
      setCalibrationProfile(previousProfile);
      setPanelKind('guide');
      setGuidePhase('visible');
    });

    showFeedback(
      previousProfile
        ? 'Recalibration cancelled · previous profile restored'
        : 'Calibration skipped · safe defaults active',
      1500,
    );
    guideFadeTimeoutRef.current = window.setTimeout(() => setGuidePhase('fading'), 5200);
    guideHideTimeoutRef.current = window.setTimeout(() => setGuidePhase('hidden'), 6300);
  }, [clearGuideTimers, queueUi, showFeedback]);

  const finishCalibration = useCallback(() => {
    const profile = deriveGestureCalibration({
      pointerSamples: pointerSamplesRef.current,
      pinchDurationMs: calibrationPinchDurationRef.current,
    });
    calibrationProfileRef.current = profile;
    calibrationFallbackProfileRef.current = profile;
    saveGestureCalibration(profile);
    interactionGateRef.current = 'ready';
    clearGuideTimers();
    queueUi(() => {
      setCalibrationProfile(profile);
      setCalibrationActive(false);
      setPanelKind('complete');
      setGuidePhase('visible');
    });
    showFeedback('Air controls calibrated', 1600);
    guideFadeTimeoutRef.current = window.setTimeout(() => setGuidePhase('fading'), 2200);
    guideHideTimeoutRef.current = window.setTimeout(() => setGuidePhase('hidden'), 3200);
  }, [clearGuideTimers, queueUi, showFeedback]);

  const advanceCalibration = useCallback(
    (stepId: CalibrationStepId) => {
      if (interactionGateRef.current !== 'calibrating') return false;
      const index = calibrationStepIndexRef.current;
      if (CALIBRATION_STEPS[index]?.id !== stepId) return false;

      const nextIndex = index + 1;
      showFeedback(`${CALIBRATION_STEPS[index].title} calibrated`, 750);
      if (nextIndex >= CALIBRATION_STEPS.length) {
        finishCalibration();
      } else {
        calibrationStepIndexRef.current = nextIndex;
        pinchSelectionRef.current = initialPinchSelectionState();
        queueUi(() => setCalibrationStepIndex(nextIndex));
      }
      return true;
    },
    [finishCalibration, queueUi, showFeedback],
  );

  useEffect(() => {
    if (!enabled || status !== 'running') {
      sessionInitializedRef.current = false;
      interactionGateRef.current = 'pending';
      return;
    }
    if (sessionInitializedRef.current) return;
    sessionInitializedRef.current = true;

    const stored = loadGestureCalibration();
    if (stored) {
      calibrationProfileRef.current = stored;
      calibrationFallbackProfileRef.current = stored;
      interactionGateRef.current = 'ready';
      queueUi(() => setCalibrationProfile(stored));
      showGuide();
    } else {
      beginCalibration();
    }
  }, [beginCalibration, enabled, queueUi, showGuide, status]);

  useEffect(() => {
    const reopenGuide = () => showGuide();
    const recalibrate = () => beginCalibration();
    window.addEventListener(GESTURE_GUIDE_EVENT, reopenGuide);
    window.addEventListener(GESTURE_RECALIBRATE_EVENT, recalibrate);
    return () => {
      window.removeEventListener(GESTURE_GUIDE_EVENT, reopenGuide);
      window.removeEventListener(GESTURE_RECALIBRATE_EVENT, recalibrate);
    };
  }, [beginCalibration, showGuide]);

  useEffect(() => {
    if (!calibrationActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelCalibration();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [calibrationActive, cancelCalibration]);

  useEffect(() => {
    if (enabled) return;
    pinchSelectionRef.current = initialPinchSelectionState();
    interactionGateRef.current = 'pending';
    queueUi(() => {
      setFeedback(null);
      setTargetText(null);
      setTargetLocked(false);
      setGuidePhase('hidden');
      setCalibrationActive(false);
      setPranked(false);
    });
    handledActionRef.current = 0;
    document.documentElement.removeAttribute('data-sensing-pranked');
    if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
    clearGuideTimers();
  }, [clearGuideTimers, enabled, queueUi]);

  useEffect(
    () => () => {
      if (uiFrameRef.current !== null) window.cancelAnimationFrame(uiFrameRef.current);
      uiQueueRef.current = [];
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
      if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
      clearGuideTimers();
      document.documentElement.removeAttribute('data-sensing-pranked');
    },
    [clearGuideTimers],
  );

  useEffect(() => {
    if (!enabled || status !== 'running' || !cursor || interactionGateRef.current === 'pending') {
      pinchSelectionRef.current = initialPinchSelectionState();
      queueUi(() => {
        setTargetText(null);
        setTargetLocked(false);
      });
      return;
    }

    const calibrating = interactionGateRef.current === 'calibrating';
    const profile = calibrating
      ? CALIBRATION_BOOTSTRAP_PROFILE
      : calibrationProfileRef.current ?? DEFAULT_GESTURE_CALIBRATION;

    let target = interactiveAt(cursor.x, cursor.y, profile.targetProbeRadiusPx);
    if (calibrating && !isCalibrationTarget(target)) target = null;

    const now = performance.now();
    const selection = updatePinchSelection(
      pinchSelectionRef.current,
      { pinching: cursor.pinching, targetKey: targetKey(target), now },
      pinchConfig(profile),
    );
    pinchSelectionRef.current = selection.state;

    const label = calibrating && target ? 'Calibration target' : targetLabel(target);
    queueUi(() => {
      setTargetText(label);
      setTargetLocked(selection.targetLocked);
    });

    if (calibrating) {
      const step = CALIBRATION_STEPS[calibrationStepIndexRef.current]?.id;
      const onCalibrationTarget = isCalibrationTarget(target);

      if (step === 'aim') {
        if (onCalibrationTarget && !cursor.pinching) {
          if (aimSeenAtRef.current === null) {
            aimSeenAtRef.current = now;
            pointerSamplesRef.current = [];
          }
          pointerSamplesRef.current.push({
            x: cursor.x * window.innerWidth,
            y: cursor.y * window.innerHeight,
          });
          if (pointerSamplesRef.current.length > 45) pointerSamplesRef.current.shift();

          if (
            selection.targetLocked &&
            now - aimSeenAtRef.current >= AIM_SAMPLE_MS &&
            pointerSamplesRef.current.length >= MIN_AIM_SAMPLES
          ) {
            advanceCalibration('aim');
          }
        } else {
          aimSeenAtRef.current = null;
          pointerSamplesRef.current = [];
        }
        return;
      }

      if (step === 'pinch') {
        if (cursor.pinching && calibrationPinchStartedAtRef.current === null) {
          calibrationPinchStartedAtRef.current = now;
        }
        if (selection.activate && onCalibrationTarget) {
          calibrationPinchActivatedRef.current = true;
          showFeedback('Pinch recognized · release', 900);
        }
        if (
          !cursor.pinching &&
          calibrationPinchActivatedRef.current &&
          calibrationPinchStartedAtRef.current !== null
        ) {
          calibrationPinchDurationRef.current = Math.max(
            140,
            now - calibrationPinchStartedAtRef.current,
          );
          calibrationPinchStartedAtRef.current = null;
          calibrationPinchActivatedRef.current = false;
          advanceCalibration('pinch');
        }
        return;
      }

      return;
    }

    if (!selection.activate || !target || document.hidden) return;
    const blocked = isTyping() || hasBlockingDialog();
    if (blocked) {
      showFeedback('Selection paused while typing');
      return;
    }

    activateTarget(target);
    showFeedback('Pinch selected');
  }, [advanceCalibration, cursor, enabled, queueUi, showFeedback, status]);

  useEffect(() => {
    if (!enabled || !action || action.id === handledActionRef.current || document.hidden) return;
    handledActionRef.current = action.id;

    if (interactionGateRef.current === 'pending') return;
    if (interactionGateRef.current === 'calibrating') {
      const step = CALIBRATION_STEPS[calibrationStepIndexRef.current]?.id;
      if (action.type === 'history_back' && step === 'back') {
        advanceCalibration('back');
      } else if (action.type === 'scroll' && typeof action.deltaY === 'number') {
        if (step === 'scroll-down' && action.deltaY > 0) advanceCalibration('scroll-down');
        if (step === 'scroll-up' && action.deltaY < 0) advanceCalibration('scroll-up');
      }
      return;
    }

    const blocked = isTyping() || hasBlockingDialog();
    switch (action.type) {
      case 'history_back':
        if (blocked) return;
        if (window.history.length > 1) router.back();
        else router.push('/');
        break;
      case 'scroll':
        if (blocked || typeof action.deltaY !== 'number') return;
        scrollPage(action.deltaY);
        break;
      case 'activate': {
        if (blocked || !cursor) return;
        const profile = calibrationProfileRef.current ?? DEFAULT_GESTURE_CALIBRATION;
        const target = interactiveAt(cursor.x, cursor.y, profile.targetProbeRadiusPx);
        if (!target) return;
        activateTarget(target);
        break;
      }
      case 'prank':
        document.documentElement.setAttribute('data-sensing-pranked', 'true');
        queueUi(() => setPranked(true));
        if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
        prankTimeoutRef.current = window.setTimeout(() => {
          document.documentElement.removeAttribute('data-sensing-pranked');
          setPranked(false);
        }, 3200);
        break;
      default:
        return;
    }

    showFeedback(ACTION_LABELS[action.type] ?? action.type, action.type === 'prank' ? 3200 : 1000);
  }, [action, advanceCalibration, cursor, enabled, queueUi, router, showFeedback]);

  if (!enabled || status !== 'running') return null;

  const currentCalibrationStep = CALIBRATION_STEPS[calibrationStepIndex];
  const cursorStatus = calibrationActive
    ? `Calibration ${calibrationStepIndex + 1}/${CALIBRATION_STEPS.length} · ${currentCalibrationStep?.short ?? ''}`
    : feedback
      ? feedback
      : targetLocked
        ? 'Target locked · pinch to click'
        : cursor?.pinching
          ? 'Pinching · release to re-arm'
          : pose === 'Victory'
            ? 'Two-finger scroll ready'
            : pose === 'Closed_Fist'
              ? 'Fist · back'
              : pose.replaceAll('_', ' ');

  return (
    <>
      {guidePhase !== 'hidden' && (
        <div
          className={`fixed left-1/2 top-14 z-[95] w-[min(94vw,820px)] -translate-x-1/2 transition-all duration-700 ${
            guidePhase === 'fading' ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
          } ${panelKind === 'calibration' ? 'pointer-events-none' : ''}`}
          role="status"
          aria-live="polite"
        >
          {panelKind === 'calibration' ? (
            <CalibrationPanel
              stepIndex={calibrationStepIndex}
              targetLocked={targetLocked}
              pinching={Boolean(cursor?.pinching)}
              hasPreviousProfile={Boolean(calibrationProfile)}
              onCancel={cancelCalibration}
            />
          ) : panelKind === 'complete' ? (
            <CalibrationComplete profile={calibrationProfile} />
          ) : (
            <GestureGuide
              profile={calibrationProfile}
              onRecalibrate={beginCalibration}
            />
          )}
        </div>
      )}

      {cursor && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
        >
          <div
            className={`relative grid h-8 w-8 place-items-center rounded-full border-2 backdrop-blur-sm transition-all duration-100 ${
              cursor.pinching && targetLocked
                ? 'scale-75 border-green bg-green/25 shadow-glow-green'
                : cursor.pinching
                  ? 'scale-75 border-amber bg-amber/25 shadow-glow-amber'
                  : targetLocked
                    ? 'border-green bg-green/15 shadow-glow-green'
                    : targetText
                      ? 'border-cyan bg-cyan/10 shadow-glow-cyan'
                      : 'border-violet bg-violet/10 shadow-glow-violet'
            }`}
          >
            {targetLocked && !cursor.pinching && (
              <span className="absolute h-11 w-11 rounded-full border border-green/35" />
            )}
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          {targetText && (
            <div className="absolute left-5 top-7 w-max max-w-56 rounded-xl border border-white/10 bg-bg-deep/95 px-2.5 py-1.5 shadow-lg backdrop-blur">
              <span
                className={`block font-mono text-[8px] font-semibold uppercase tracking-[0.18em] ${
                  targetLocked ? 'text-green' : 'text-cyan'
                }`}
              >
                {targetLocked ? 'locked · pinch' : 'acquiring target'}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[9px] text-text-secondary">
                {targetText}
              </span>
            </div>
          )}
        </div>
      )}

      <div
        className="pointer-events-none fixed left-1/2 top-5 z-[90] max-w-[90vw] -translate-x-1/2 rounded-full border border-violet/25 bg-bg-panel/85 px-3 py-1.5 text-center font-mono text-[10px] text-text-secondary backdrop-blur"
        aria-live="polite"
      >
        <span className={targetLocked ? 'text-green' : 'text-violet'}>{cursorStatus}</span>
        <span className="mx-2 text-white/20">·</span>
        {fps} fps
      </div>

      {pranked && (
        <div
          className="pointer-events-none fixed inset-x-4 top-[42%] z-[100] text-center"
          role="status"
          aria-live="assertive"
        >
          <span className="inline-block rounded-2xl border border-amber/45 bg-bg-deep/95 px-6 py-4 font-mono text-sm font-semibold text-amber shadow-glow-amber backdrop-blur">
            Okay, you got me. The site looked. 👀
          </span>
        </div>
      )}
    </>
  );
}

function CalibrationPanel({
  stepIndex,
  targetLocked,
  pinching,
  hasPreviousProfile,
  onCancel,
}: {
  stepIndex: number;
  targetLocked: boolean;
  pinching: boolean;
  hasPreviousProfile: boolean;
  onCancel: () => void;
}) {
  const step = CALIBRATION_STEPS[stepIndex];
  const showTarget = step?.id === 'aim' || step?.id === 'pinch';

  return (
    <div className="overflow-hidden rounded-3xl border border-violet/35 bg-bg-panel/97 shadow-glow-violet backdrop-blur-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet/20 via-cyan/10 to-transparent px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-violet/30 bg-violet/15 text-violet">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-violet">
                  Air-control calibration
                </span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
              </div>
              <h2 className="mt-1 text-base font-semibold text-text-primary">
                Five gestures. One meaning each.
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Point + pinch clicks, a fist goes back, and two fingers scroll. The real page stays sandboxed until this course finishes.
              </p>
            </div>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-2" data-gesture-ignore>
            <span className="rounded-full border border-white/10 bg-bg-deep/60 px-2.5 py-1 font-mono text-[9px] text-text-muted">
              {stepIndex + 1}/{CALIBRATION_STEPS.length}
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-bg-deep/60 px-2.5 py-1 font-mono text-[9px] text-text-muted transition hover:border-white/25 hover:text-text-primary"
              aria-label={hasPreviousProfile ? 'Keep current calibration' : 'Skip calibration'}
            >
              <X className="h-3 w-3" />
              {hasPreviousProfile ? 'keep current' : 'skip'}
            </button>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet transition-[width] duration-300"
            style={{ width: `${(stepIndex / CALIBRATION_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-5">
        {CALIBRATION_STEPS.map((item, index) => {
          const complete = index < stepIndex;
          const active = index === stepIndex;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-3 transition-all ${
                complete
                  ? 'border-green/35 bg-green/10'
                  : active
                    ? 'border-violet/45 bg-violet/12 shadow-glow-violet'
                    : 'border-white/10 bg-white/[0.025] opacity-55'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <CalibrationIcon step={item.id} complete={complete} />
                {complete && <Check className="h-3.5 w-3.5 text-green" />}
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${complete ? 'text-green' : active ? 'text-text-primary' : 'text-text-muted'}`}>
                {item.title}
              </div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-text-muted">
                {complete ? 'validated' : active ? 'do this now' : 'queued'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan">
              Current checkpoint
            </div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{step?.short}</div>
          </div>

          {showTarget ? (
            <button
              type="button"
              data-gesture-target
              data-gesture-calibration-target={CALIBRATION_TARGET}
              onClick={(event) => event.preventDefault()}
              className={`pointer-events-auto relative grid h-20 w-44 place-items-center overflow-hidden rounded-2xl border-2 transition-all ${
                pinching && targetLocked
                  ? 'scale-95 border-green bg-green/20 shadow-glow-green'
                  : targetLocked
                    ? 'border-green bg-green/10 shadow-glow-green'
                    : 'border-cyan/45 bg-cyan/5 shadow-glow-cyan'
              }`}
              aria-label="Calibration target"
            >
              <span className={`absolute h-12 w-12 rounded-full border ${targetLocked ? 'border-green/50' : 'border-cyan/30'}`} />
              <span className={`h-2.5 w-2.5 rounded-full ${targetLocked ? 'bg-green' : 'bg-cyan'}`} />
              <span className="absolute bottom-2 font-mono text-[8px] uppercase tracking-[0.16em] text-text-muted">
                {step?.id === 'aim'
                  ? targetLocked
                    ? 'hold steady'
                    : 'aim here'
                  : targetLocked
                    ? 'pinch + release'
                    : 'find green lock'}
              </span>
            </button>
          ) : (
            <GesturePrompt step={step?.id} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-2 font-mono text-[9px] text-text-muted">
        <Sparkles className="h-3 w-3 text-violet" />
        Esc exits calibration
        <span className="text-white/20">·</span>
        only derived pointer + pinch timing are stored
      </div>
    </div>
  );
}

function GesturePrompt({ step }: { step: CalibrationStepId | undefined }) {
  if (step === 'back') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-violet/25 bg-violet/[0.06] px-5 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet/25 bg-violet/10">
          <Hand className="h-5 w-5 text-violet" />
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-text-primary">Close your hand into a fist</div>
          <div className="mt-0.5 text-[10px] text-text-muted">Hold it briefly. During normal use this means browser back.</div>
        </div>
      </div>
    );
  }

  if (step === 'scroll-down' || step === 'scroll-up') {
    const down = step === 'scroll-down';
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-cyan/25 bg-cyan/[0.05] px-5 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan/25 bg-cyan/10">
          {down ? <ChevronDown className="h-5 w-5 text-cyan" /> : <ChevronUp className="h-5 w-5 text-cyan" />}
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-text-primary">Hold up index + middle fingers</div>
          <div className="mt-0.5 text-[10px] text-text-muted">
            Move both fingers {down ? 'downward' : 'upward'} in one clear vertical stroke.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function GestureGuide({
  profile,
  onRecalibrate,
}: {
  profile: GestureCalibrationProfile | null;
  onRecalibrate: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-violet/30 bg-bg-panel/95 shadow-glow-violet backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-violet/15 via-cyan/10 to-transparent px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-violet/30 bg-violet/15 text-violet">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-violet">
                Air controls online
              </span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
            </div>
            <h2 className="mt-1 text-base font-semibold text-text-primary">Three gestures. No hidden navigation grammar.</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Pinch clicks. Fist goes back. Two fingers move the page up or down.
            </p>
          </div>
        </div>
        <button
          type="button"
          data-gesture-ignore
          onClick={onRecalibrate}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-bg-deep/60 px-2.5 py-1.5 font-mono text-[9px] text-text-muted transition hover:border-violet/35 hover:text-violet"
        >
          <RotateCcw className="h-3 w-3" />
          recalibrate
        </button>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-3">
        <GuideCard icon={<MousePointer2 className="h-4 w-4 text-green" />} title="Pinch = click">
          Aim at a control, wait for the cursor to turn green, pinch briefly, then release.
        </GuideCard>
        <GuideCard icon={<ArrowLeft className="h-4 w-4 text-violet" />} title="Fist = back">
          Close your hand into a fist and hold briefly to go back one browser-history page.
        </GuideCard>
        <GuideCard icon={<ChevronDown className="h-4 w-4 text-cyan" />} title="Two fingers = scroll">
          Hold up index + middle fingers and move them vertically. Down scrolls down; up scrolls up.
        </GuideCard>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-white/10 px-4 py-2 font-mono text-[8px] text-text-muted">
        {profile ? (
          <>
            <span className="rounded-full border border-green/20 bg-green/5 px-2 py-1 text-green">calibrated</span>
            <span>halo {profile.targetProbeRadiusPx}px</span>
            <span className="text-white/20">·</span>
            <span>lock {profile.targetLockMs}ms</span>
            <span className="text-white/20">·</span>
            <span>pinch {profile.pinchHoldMs}ms</span>
          </>
        ) : (
          <span className="rounded-full border border-amber/20 bg-amber/5 px-2 py-1 text-amber">
            safe defaults active · calibrate whenever your setup changes
          </span>
        )}
      </div>
    </div>
  );
}

function CalibrationComplete({ profile }: { profile: GestureCalibrationProfile | null }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-green/35 bg-bg-panel/97 shadow-glow-green backdrop-blur-xl">
      <div className="flex flex-col items-center px-6 py-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-green/35 bg-green/15 text-green">
          <Check className="h-6 w-6" />
        </div>
        <div className="mt-3 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-green">
          {CALIBRATION_STEPS.length} / {CALIBRATION_STEPS.length} validated
        </div>
        <h2 className="mt-1 text-lg font-semibold text-text-primary">Air controls ready.</h2>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-text-muted">
          Pinch click, fist back, and two-finger scrolling all worked on this camera setup. Move the device later? Recalibrate from the Hands live control.
        </p>
        {profile && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 font-mono text-[9px] text-text-muted">
            <span className="rounded-full border border-white/10 bg-bg-deep/45 px-2.5 py-1">halo {profile.targetProbeRadiusPx}px</span>
            <span className="rounded-full border border-white/10 bg-bg-deep/45 px-2.5 py-1">lock {profile.targetLockMs}ms</span>
            <span className="rounded-full border border-white/10 bg-bg-deep/45 px-2.5 py-1">pinch {profile.pinchHoldMs}ms</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CalibrationIcon({ step, complete }: { step: CalibrationStepId; complete: boolean }) {
  if (complete) return <Check className="h-4 w-4 text-green" />;
  switch (step) {
    case 'aim':
      return <MousePointer2 className="h-4 w-4 text-cyan" />;
    case 'pinch':
      return <Hand className="h-4 w-4 text-green" />;
    case 'back':
      return <ArrowLeft className="h-4 w-4 text-violet" />;
    case 'scroll-down':
      return <ChevronDown className="h-4 w-4 text-cyan" />;
    case 'scroll-up':
      return <ChevronUp className="h-4 w-4 text-cyan" />;
  }
}

function GuideCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      {icon}
      <div className="mt-2 text-xs font-semibold text-text-primary">{title}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-text-muted">{children}</div>
    </div>
  );
}
