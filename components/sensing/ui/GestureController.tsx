'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import {
  Check,
  ChevronDown,
  Hand,
  Menu,
  MousePointer2,
  MoveHorizontal,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { siteNavItems } from '@/src/data/siteNav';
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

const ACTION_LABELS: Record<GestureActionType, string> = {
  navigate_next: 'Next section',
  navigate_previous: 'Previous section',
  open_palette: 'Navigation opened',
  close_palette: 'Navigation closed',
  activate: 'Target activated',
  page_down: 'Page down',
  prank: 'Okay, you got me. The site looked. 👀',
};

const GESTURE_GUIDE_EVENT = 'sensing:gesture-guide';
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
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not([data-gesture-palette])'));
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
    // Some synthetic/legacy targets do not accept focus options. Clicking still works.
  }
  target.click();
}

function routeIndex(pathname: string): number {
  const exact = siteNavItems.findIndex((item) => item.href === pathname);
  if (exact >= 0) return exact;
  const candidates = siteNavItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.href !== '/' && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.item.href.length - a.item.href.length);
  return candidates[0]?.index ?? 0;
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

export function GestureController() {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = useSensingStore((state) => state.gestureEnabled);
  const status = useSensingStore((state) => state.gestureStatus);
  const cursor = useSensingStore((state) => state.gestureCursor);
  const pose = useSensingStore((state) => state.gesturePose);
  const action = useSensingStore((state) => state.gestureAction);
  const fps = useSensingStore((state) => state.gestureFps);

  const [paletteOpen, setPaletteOpen] = useState(false);
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
  const calibrationStepIndexRef = useRef(0);
  const interactionGateRef = useRef<InteractionGate>('pending');
  const sessionInitializedRef = useRef(false);
  const aimSeenAtRef = useRef<number | null>(null);
  const pointerSamplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const calibrationPinchStartedAtRef = useRef<number | null>(null);
  const calibrationPinchActivatedRef = useRef(false);
  const calibrationPinchDurationRef = useRef(300);

  const currentRouteIndex = useMemo(() => routeIndex(pathname), [pathname]);

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
    guideFadeTimeoutRef.current = window.setTimeout(() => setGuidePhase('fading'), 5400);
    guideHideTimeoutRef.current = window.setTimeout(() => setGuidePhase('hidden'), 6500);
  }, [clearGuideTimers, queueUi]);

  const beginCalibration = useCallback(() => {
    clearGuideTimers();
    interactionGateRef.current = 'calibrating';
    calibrationStepIndexRef.current = 0;
    aimSeenAtRef.current = null;
    pointerSamplesRef.current = [];
    calibrationPinchStartedAtRef.current = null;
    calibrationPinchActivatedRef.current = false;
    calibrationPinchDurationRef.current = 300;
    pinchSelectionRef.current = initialPinchSelectionState();
    queueUi(() => {
      setPaletteOpen(false);
      setCalibrationActive(true);
      setCalibrationStepIndex(0);
      setPanelKind('calibration');
      setGuidePhase('visible');
    });
    showFeedback('Calibration started', 900);
  }, [clearGuideTimers, queueUi, showFeedback]);

  const finishCalibration = useCallback(() => {
    const profile = deriveGestureCalibration({
      pointerSamples: pointerSamplesRef.current,
      pinchDurationMs: calibrationPinchDurationRef.current,
    });
    calibrationProfileRef.current = profile;
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
    guideFadeTimeoutRef.current = window.setTimeout(() => setGuidePhase('fading'), 1900);
    guideHideTimeoutRef.current = window.setTimeout(() => setGuidePhase('hidden'), 2800);
  }, [clearGuideTimers, queueUi, showFeedback]);

  const advanceCalibration = useCallback(
    (stepId: CalibrationStepId) => {
      if (interactionGateRef.current !== 'calibrating') return false;
      const index = calibrationStepIndexRef.current;
      if (CALIBRATION_STEPS[index]?.id !== stepId) return false;

      const nextIndex = index + 1;
      showFeedback(`${CALIBRATION_STEPS[index].title} calibrated`, 700);
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
      interactionGateRef.current = 'ready';
      queueUi(() => setCalibrationProfile(stored));
      showGuide();
    } else {
      beginCalibration();
    }
  }, [beginCalibration, enabled, queueUi, showGuide, status]);

  useEffect(() => {
    const reopenGuide = () => showGuide();
    window.addEventListener(GESTURE_GUIDE_EVENT, reopenGuide);
    return () => window.removeEventListener(GESTURE_GUIDE_EVENT, reopenGuide);
  }, [showGuide]);

  useEffect(() => {
    if (enabled) return;
    pinchSelectionRef.current = initialPinchSelectionState();
    interactionGateRef.current = 'pending';
    queueUi(() => {
      setPaletteOpen(false);
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

    if (!calibrating && paletteOpen) {
      const list = document.querySelector<HTMLElement>('[cmdk-list]');
      if (cursor.y < 0.22) list?.scrollBy({ top: -18 });
      if (cursor.y > 0.78) list?.scrollBy({ top: 18 });
    }

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
    if (!paletteOpen && blocked) {
      showFeedback('Selection paused while typing');
      return;
    }

    activateTarget(target);
    showFeedback('Pinch selected');
  }, [
    advanceCalibration,
    cursor,
    enabled,
    paletteOpen,
    queueUi,
    showFeedback,
    status,
  ]);

  useEffect(() => {
    if (!enabled || !action || action.id === handledActionRef.current || document.hidden) return;
    handledActionRef.current = action.id;

    if (interactionGateRef.current === 'pending') return;
    if (interactionGateRef.current === 'calibrating') {
      switch (action.type) {
        case 'navigate_next':
          advanceCalibration('raise-right');
          break;
        case 'navigate_previous':
          advanceCalibration('raise-left');
          break;
        case 'open_palette':
          advanceCalibration('menu');
          break;
        case 'page_down':
          advanceCalibration('scroll');
          break;
        default:
          break;
      }
      return;
    }

    const profile = calibrationProfileRef.current ?? DEFAULT_GESTURE_CALIBRATION;
    const blocked = isTyping() || hasBlockingDialog();
    switch (action.type) {
      case 'navigate_next':
        if (blocked || paletteOpen) return;
        router.push(siteNavItems[(currentRouteIndex + 1) % siteNavItems.length].href);
        break;
      case 'navigate_previous':
        if (blocked || paletteOpen) return;
        router.push(siteNavItems[(currentRouteIndex - 1 + siteNavItems.length) % siteNavItems.length].href);
        break;
      case 'open_palette':
        if (!blocked) queueUi(() => setPaletteOpen(true));
        break;
      case 'close_palette':
        queueUi(() => setPaletteOpen(false));
        break;
      case 'activate': {
        if ((!paletteOpen && blocked) || !cursor) return;
        const target = interactiveAt(cursor.x, cursor.y, profile.targetProbeRadiusPx);
        if (!target) {
          showFeedback('No target under cursor');
          return;
        }
        activateTarget(target);
        break;
      }
      case 'page_down': {
        if (blocked || paletteOpen) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({
          top: window.innerHeight * 0.8,
          behavior: reducedMotion ? 'auto' : 'smooth',
        });
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
    }

    showFeedback(ACTION_LABELS[action.type], action.type === 'prank' ? 3200 : 1200);
  }, [
    action,
    advanceCalibration,
    currentRouteIndex,
    cursor,
    enabled,
    paletteOpen,
    queueUi,
    router,
    showFeedback,
  ]);

  if (!enabled || status !== 'running') return null;

  const currentCalibrationStep = CALIBRATION_STEPS[calibrationStepIndex];
  const cursorStatus = calibrationActive
    ? `Calibration ${calibrationStepIndex + 1}/${CALIBRATION_STEPS.length} · ${currentCalibrationStep?.short ?? ''}`
    : feedback
      ? feedback
      : targetLocked
        ? 'Target locked · pinch to select'
        : cursor?.pinching
          ? 'Pinching · release to re-arm'
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

      {paletteOpen && !calibrationActive && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-bg-deep/70 px-4 pt-[10vh] backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Gesture navigation"
          data-gesture-palette
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaletteOpen(false);
          }}
        >
          <Command className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet/30 bg-bg-panel/95 shadow-glow-violet">
            <div className="border-b border-white/10 bg-gradient-to-r from-violet/15 via-transparent to-cyan/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-violet/25 bg-violet/15 text-violet">
                    <Hand className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-violet">
                      Gesture navigator
                    </div>
                    <div className="mt-1 text-sm font-semibold text-text-primary">Point, lock, pinch.</div>
                    <div className="mt-0.5 text-[10px] text-text-muted">
                      Move near an item until the cursor turns green.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaletteOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-xl border border-white/10 p-2 text-text-muted transition hover:border-white/20 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[9px] text-text-muted">
                <span className="rounded-full border border-white/10 bg-bg-deep/50 px-2 py-1">green = locked</span>
                <span className="rounded-full border border-white/10 bg-bg-deep/50 px-2 py-1">pinch = choose</span>
                <span className="rounded-full border border-white/10 bg-bg-deep/50 px-2 py-1">fist = close</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <Search className="h-4 w-4 text-violet" />
              <Command.Input
                autoFocus
                placeholder="Search the neural net…"
                className="h-12 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
            <Command.List className="max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-text-muted">
                No matching signal.
              </Command.Empty>
              <Command.Group heading="Navigate" className="text-xs text-text-muted">
                {siteNavItems.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => {
                      router.push(item.href);
                      setPaletteOpen(false);
                    }}
                    className="group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-text-secondary outline-none transition data-[selected=true]:bg-violet/15 data-[selected=true]:text-text-primary"
                  >
                    <Hand className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet/70" />
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-[11px] text-text-muted">{item.description}</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="border-t border-white/10 px-4 py-2 text-center font-mono text-[9px] text-text-muted">
              Point + green lock + pinch to choose · release between selections · closed fist to cancel
            </div>
          </Command>
        </div>
      )}
    </>
  );
}

function CalibrationPanel({
  stepIndex,
  targetLocked,
  pinching,
}: {
  stepIndex: number;
  targetLocked: boolean;
  pinching: boolean;
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
                  Personal air-control calibration
                </span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />
              </div>
              <h2 className="mt-1 text-base font-semibold text-text-primary">
                Teach the site how your hand moves.
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Six quick checkpoints, usually 10–30 seconds. Real navigation and scrolling stay sandboxed until all six pass.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-bg-deep/60 px-2.5 py-1 font-mono text-[9px] text-text-muted">
            {stepIndex + 1}/{CALIBRATION_STEPS.length}
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet transition-[width] duration-300"
            style={{ width: `${(stepIndex / CALIBRATION_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
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
                {complete ? 'selected' : active ? 'do this now' : 'queued'}
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
            <div className="rounded-2xl border border-white/10 bg-bg-deep/45 px-5 py-3 font-mono text-[9px] text-text-muted">
              The gesture is being recognized live. It will not affect the page during calibration.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-2 font-mono text-[9px] text-text-muted">
        <Sparkles className="h-3 w-3 text-violet" />
        only derived cursor jitter + timing are saved locally
        <span className="text-white/20">·</span>
        no frames or landmarks stored
      </div>
    </div>
  );
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
            <h2 className="mt-1 text-base font-semibold text-text-primary">Your calibrated hand is the pointer.</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Aim first, wait for green lock, pinch, then release before the next selection.
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

      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <GuideCard icon={<MousePointer2 className="h-4 w-4 text-cyan" />} title="Point to aim">
          Index fingertip steers the cursor. Your local profile adds a forgiving target halo.
        </GuideCard>
        <GuideCard icon={<Hand className="h-4 w-4 text-green" />} title="Pinch to select">
          Green means locked. Touch thumb + index briefly, then release.
        </GuideCard>
        <GuideCard icon={<MoveHorizontal className="h-4 w-4 text-violet" />} title="Raise to navigate">
          Open right hand goes next. Open left goes back.
        </GuideCard>
        <GuideCard icon={<Menu className="h-4 w-4 text-amber" />} title="Flash the menu">
          Open palm → fist opens navigation. A held fist closes it.
        </GuideCard>
      </div>

      {profile && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-white/10 px-4 py-2 font-mono text-[8px] text-text-muted">
          <span className="rounded-full border border-green/20 bg-green/5 px-2 py-1 text-green">calibrated</span>
          <span>target halo {profile.targetProbeRadiusPx}px</span>
          <span className="text-white/20">·</span>
          <span>lock {profile.targetLockMs}ms</span>
          <span className="text-white/20">·</span>
          <span>pinch {profile.pinchHoldMs}ms</span>
          <span className="text-white/20">·</span>
          <span>jitter {profile.pointerJitterPx}px</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-2 font-mono text-[9px] text-text-muted">
        <ChevronDown className="h-3 w-3" />
        Downward closed-fist strike scrolls the page
        <span className="text-white/20">·</span>
        calibration stays on this browser
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
          6 / 6 calibrated
        </div>
        <h2 className="mt-1 text-lg font-semibold text-text-primary">Air controls unlocked.</h2>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-text-muted">
          The site learned your pointer steadiness and pinch cadence, and verified every navigation gesture on this camera setup.
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
    case 'raise-right':
    case 'raise-left':
      return <MoveHorizontal className="h-4 w-4 text-violet" />;
    case 'menu':
      return <Menu className="h-4 w-4 text-amber" />;
    case 'scroll':
      return <ChevronDown className="h-4 w-4 text-cyan" />;
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
