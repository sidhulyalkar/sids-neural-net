'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Camera, CameraOff, Check, Sparkles, X } from 'lucide-react';
import { VisionSignalSource } from '@/components/perceptual-cortex/VisionSignalSource';
import { admitAmbientReaction, retractAmbientReaction } from '@/lib/frontier/ambientBehaviorStore';
import {
  createLongitudinalExposure,
  createLongitudinalReaction,
  currentLongitudinalSessionId,
  isSensorObservableLongitudinalExposure,
} from '@/lib/frontier/longitudinalEvents';
import type { LongitudinalExposure } from '@/lib/frontier/longitudinalModel';
import { frontierLongitudinalStore } from '@/lib/frontier/longitudinalStore';
import {
  ReactionInferenceEngine,
  type FrontierAmbientReaction,
  type FrontierAmbientReactionKind,
  type ReactionInferenceSnapshot,
} from '@/lib/frontier/reaction';
import { selectReactionTarget } from '@/lib/frontier/reactionTarget';
import {
  applyReactionTrust,
  reactionTrustAccuracy,
  reactionTrustAuthority,
  reactionTrustQuarantined,
  recordReactionObservation,
  recordReactionReview,
} from '@/lib/frontier/reactionTrust';
import {
  createSensorObservabilityAccumulator,
  observeSensorSample,
  sensorObservabilityArchiveFields,
  type SensorObservabilityAccumulator,
} from '@/lib/frontier/sensorObservability';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierHistoryEntry, FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-reaction-loop.module.css';

type Props = { feedActive: boolean };
type LoopState = 'off' | 'requesting' | 'calibrating' | 'active' | 'error';
type RenderedTarget = { item: FrontierItem; element: HTMLElement; score: number; visibleFraction: number };
type ActiveExposure = {
  id: string;
  sessionId: string;
  item: FrontierItem;
  startedAt: number;
  scoreSum: number;
  visibleSum: number;
  minScore: number;
  samples: number;
  sensor: SensorObservabilityAccumulator;
};
type SignalFeedback = {
  reaction: FrontierAmbientReaction;
  admittedReaction?: FrontierAmbientReaction;
  reactionEpisodeId: string;
  target: FrontierItem;
  suggestion?: FrontierItem;
  review?: 'confirmed' | 'contradicted';
  reviewAccuracy?: number;
  reviewCount?: number;
  quarantined?: boolean;
};

const EMPTY_SNAPSHOT: ReactionInferenceSnapshot = {
  phase: 'idle',
  calibration: 0,
  confidence: 0,
  scores: { affinity: 0, interest: 0, surprise: 0, friction: 0 },
};

const SIGNAL_COPY: Record<FrontierAmbientReactionKind, { title: string; detail: string; action: string }> = {
  affinity: {
    title: 'Positive reaction cue',
    detail: 'A sustained positive expression cue appeared here. It remains weak evidence below clicks, saves, dwell, and explicit reactions.',
    action: 'Follow the thread',
  },
  interest: {
    title: 'Attention cue',
    detail: 'An active expression cue plus stable attention held here. Neutral forward posture alone cannot trigger this signal.',
    action: 'Keep exploring',
  },
  surprise: {
    title: 'Novelty cue',
    detail: 'A novelty cue held long enough to clear the confidence gate. Confirmed repetitions can gently broaden adjacent exploration.',
    action: 'Try an adjacent wildcard',
  },
  friction: {
    title: 'Friction cue',
    detail: 'A tension cue appeared here. It may guide this local suggestion, but facial tension never becomes dislike or ranking evidence by itself.',
    action: 'Switch angle',
  },
};

const subscribeHydration = () => () => undefined;
const hydratedClientSnapshot = () => true;
const hydratedServerSnapshot = () => false;

function visibleFraction(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return Math.min(1, (visibleWidth * visibleHeight) / (rect.width * rect.height));
}

function renderedTargets(history: Record<string, FrontierHistoryEntry>, visibleOnly = true): RenderedTarget[] {
  const active = document.activeElement;
  const targets: RenderedTarget[] = [];
  for (const element of document.querySelectorAll<HTMLElement>('[data-frontier-fluid-card]')) {
    const id = element.dataset.frontierFluidCard;
    if (!id) continue;
    const entry = history[id];
    if (!entry) continue;
    const fraction = visibleFraction(element);
    if (visibleOnly && fraction < 0.22) continue;
    const rect = element.getBoundingClientRect();
    const viewportCenter = window.innerHeight * 0.46;
    const cardCenter = (rect.top + rect.bottom) * 0.5;
    const centerProximity = Math.max(0, 1 - Math.abs(cardCenter - viewportCenter) / Math.max(1, window.innerHeight * 0.6));
    const hovered = element.matches(':hover') ? 0.18 : 0;
    const focused = active instanceof Node && element.contains(active) ? 0.16 : 0;
    const expanded = element.querySelector('[aria-expanded="true"]') ? 0.12 : 0;
    targets.push({
      item: entry.item,
      element,
      visibleFraction: fraction,
      score: fraction * 0.55 + centerProximity * 0.35 + hovered + focused + expanded,
    });
  }
  return targets.sort((left, right) => right.score - left.score);
}

function dominantRenderedTarget(history: Record<string, FrontierHistoryEntry>): RenderedTarget | undefined {
  const targets = renderedTargets(history, true);
  const id = selectReactionTarget(targets.map((target) => ({
    id: target.item.id,
    score: target.score,
    visibleFraction: target.visibleFraction,
  })));
  return id ? targets.find((target) => target.item.id === id) : undefined;
}

function overlap(left: FrontierItem, right: FrontierItem): number {
  const a = new Set(left.tags.slice(0, 8).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  const b = new Set(right.tags.slice(0, 8).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const tag of a) if (b.has(tag)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function chooseSuggestion(
  target: FrontierItem,
  kind: FrontierAmbientReactionKind,
  history: Record<string, FrontierHistoryEntry>,
): FrontierItem | undefined {
  const candidates = renderedTargets(history, false).filter((candidate) => candidate.item.id !== target.id);
  return candidates.map(({ item }) => {
    const semanticOverlap = overlap(target, item);
    const sameLane = Number(item.lane === target.lane);
    const differentLane = 1 - sameLane;
    const quality = Math.max(0, Math.min(1, item.quality));
    const novelty = Math.max(0, Math.min(1, item.novelty));
    const importance = Math.max(0, Math.min(1, item.importance));
    let score = quality * 0.28 + importance * 0.12;
    if (kind === 'affinity') score += semanticOverlap * 0.4 + sameLane * 0.16 + novelty * 0.04;
    if (kind === 'interest') score += semanticOverlap * 0.3 + sameLane * 0.12 + novelty * 0.12;
    if (kind === 'surprise') score += novelty * 0.36 + differentLane * 0.18 + (1 - semanticOverlap) * 0.1;
    if (kind === 'friction') score += differentLane * 0.28 + (1 - semanticOverlap) * 0.18 + novelty * 0.08;
    return { item, score };
  }).sort((left, right) => right.score - left.score)[0]?.item;
}

function findRenderedElement(itemId: string, history: Record<string, FrontierHistoryEntry>): HTMLElement | undefined {
  return renderedTargets(history, false).find((candidate) => candidate.item.id === itemId)?.element;
}

function materializeExposure(active: ActiveExposure, endedAt: number): LongitudinalExposure {
  const samples = Math.max(1, active.samples);
  const measurement = sensorObservabilityArchiveFields(active.sensor);
  return createLongitudinalExposure(active.item, {
    id: active.id,
    sessionId: active.sessionId,
    startedAt: active.startedAt,
    endedAt,
    attributionMean: active.scoreSum / samples,
    attributionMin: active.minScore,
    visibleFractionMean: active.visibleSum / samples,
    sensorSampledMs: measurement.sensorSampledMs,
    faceObservableMs: measurement.faceObservableMs,
  });
}

export function FrontierReactionLoop({ feedActive }: Props) {
  const implicitLearning = useFrontierStore((state) => state.behavior.implicitLearning);
  const mounted = useSyncExternalStore(subscribeHydration, hydratedClientSnapshot, hydratedServerSnapshot);
  const sourceRef = useRef<VisionSignalSource | null>(null);
  const engineRef = useRef(new ReactionInferenceEngine());
  const activeExposureRef = useRef<ActiveExposure | undefined>(undefined);
  const feedActiveRef = useRef(feedActive);
  const lastUiUpdateRef = useRef(0);
  const clearSignalTimerRef = useRef<number | undefined>(undefined);
  const [state, setState] = useState<LoopState>('off');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<ReactionInferenceSnapshot>(EMPTY_SNAPSHOT);
  const [feedback, setFeedback] = useState<SignalFeedback>();

  useEffect(() => { feedActiveRef.current = feedActive; }, [feedActive]);

  const flushExposure = useCallback((endedAt = Date.now()) => {
    const active = activeExposureRef.current;
    activeExposureRef.current = undefined;
    if (!active) return;
    const exposure = materializeExposure(active, endedAt);
    void frontierLongitudinalStore.recordExposure(exposure).catch(() => undefined);
  }, []);

  const trackExposure = useCallback((
    target: RenderedTarget | undefined,
    faceObservable: boolean,
    wallNow: number,
    sampleNow: number,
  ) => {
    const active = activeExposureRef.current;
    if (!target) {
      if (active) flushExposure(wallNow);
      return;
    }
    if (!active || active.item.id !== target.item.id) {
      if (active) flushExposure(wallNow);
      const seed = createLongitudinalExposure(target.item, {
        startedAt: wallNow,
        endedAt: wallNow,
        attributionMean: target.score,
        attributionMin: target.score,
        visibleFractionMean: target.visibleFraction,
        sensorSampledMs: 0,
        faceObservableMs: 0,
      });
      activeExposureRef.current = {
        id: seed.id,
        sessionId: seed.sessionId,
        item: target.item,
        startedAt: wallNow,
        scoreSum: target.score,
        visibleSum: target.visibleFraction,
        minScore: target.score,
        samples: 1,
        sensor: createSensorObservabilityAccumulator(sampleNow, faceObservable),
      };
      return;
    }
    active.scoreSum += target.score;
    active.visibleSum += target.visibleFraction;
    active.minScore = Math.min(active.minScore, target.score);
    active.samples += 1;
    active.sensor = observeSensorSample(active.sensor, sampleNow, faceObservable);
  }, [flushExposure]);

  const clearSignalLater = useCallback(() => {
    if (clearSignalTimerRef.current !== undefined) window.clearTimeout(clearSignalTimerRef.current);
    clearSignalTimerRef.current = window.setTimeout(() => {
      setFeedback(undefined);
      clearSignalTimerRef.current = undefined;
    }, 8_000);
  }, []);

  const disable = useCallback(() => {
    flushExposure();
    sourceRef.current?.disable();
    sourceRef.current = null;
    engineRef.current.reset();
    if (clearSignalTimerRef.current !== undefined) window.clearTimeout(clearSignalTimerRef.current);
    clearSignalTimerRef.current = undefined;
    setSnapshot(EMPTY_SNAPSHOT);
    setFeedback(undefined);
    setError('');
    setState('off');
  }, [flushExposure]);

  useEffect(() => {
    const closeInactiveExposure = () => {
      if (document.visibilityState === 'hidden') flushExposure();
    };
    const closeOnPageHide = () => flushExposure();
    document.addEventListener('visibilitychange', closeInactiveExposure);
    window.addEventListener('pagehide', closeOnPageHide);
    return () => {
      document.removeEventListener('visibilitychange', closeInactiveExposure);
      window.removeEventListener('pagehide', closeOnPageHide);
      flushExposure();
      sourceRef.current?.disable();
      if (clearSignalTimerRef.current !== undefined) window.clearTimeout(clearSignalTimerRef.current);
    };
  }, [flushExposure]);

  useEffect(() => useFrontierStore.subscribe((current, previous) => {
    if (previous.behavior.implicitLearning && !current.behavior.implicitLearning) disable();
  }), [disable]);

  useEffect(() => {
    if (!feedActive) flushExposure();
  }, [feedActive, flushExposure]);

  const enable = useCallback(async () => {
    if (!implicitLearning || sourceRef.current) return;
    setError('');
    setFeedback(undefined);
    setSnapshot(EMPTY_SNAPSHOT);
    setState('requesting');
    engineRef.current.reset();
    const source = new VisionSignalSource();
    sourceRef.current = source;

    try {
      await source.enable((_hands, face) => {
        const history = useFrontierStore.getState().history;
        const target = feedActiveRef.current && document.visibilityState === 'visible'
          ? dominantRenderedTarget(history)
          : undefined;
        const wallNow = Date.now();
        const sampleNow = performance.now();
        trackExposure(target, face.active, wallNow, sampleNow);
        const next = engineRef.current.push(face, target?.item.id, sampleNow);
        if (sampleNow - lastUiUpdateRef.current >= 140 || next.reaction) {
          setSnapshot(next);
          setState(next.phase === 'calibrating' ? 'calibrating' : 'active');
          lastUiUpdateRef.current = sampleNow;
        }

        if (next.reaction && target) {
          const trustStat = recordReactionObservation(next.reaction);
          const trustAuthority = reactionTrustAuthority(trustStat);
          const rankedReaction = applyReactionTrust(next.reaction);
          const activeExposure = activeExposureRef.current;
          const exposureQualified = Boolean(
            activeExposure && isSensorObservableLongitudinalExposure(materializeExposure(activeExposure, wallNow)),
          );
          const admittedReaction = exposureQualified && next.reaction.kind !== 'friction' && rankedReaction.confidence > 0
            ? rankedReaction
            : undefined;
          if (admittedReaction) admitAmbientReaction(target.item, admittedReaction);

          const reactionEpisode = createLongitudinalReaction(target.item, next.reaction, {
            exposureId: activeExposure?.id ?? `unlinked-${target.item.id}-${wallNow}`,
            sessionId: activeExposure?.sessionId ?? currentLongitudinalSessionId(),
            occurredAt: wallNow,
            latencyMs: activeExposure ? wallNow - activeExposure.startedAt : 0,
            targetScore: target.score,
            visibleFraction: target.visibleFraction,
            trustAuthority,
          });
          void frontierLongitudinalStore.recordReaction(reactionEpisode).catch(() => undefined);
          setFeedback({
            reaction: next.reaction,
            admittedReaction,
            reactionEpisodeId: reactionEpisode.id,
            target: target.item,
            suggestion: chooseSuggestion(target.item, next.reaction.kind, useFrontierStore.getState().history),
          });
          clearSignalLater();
        }
      }, (message) => {
        flushExposure();
        sourceRef.current?.disable();
        sourceRef.current = null;
        setError(message);
        setState('error');
      }, { hands: false });
      if (sourceRef.current === source) setState('calibrating');
    } catch (caught) {
      flushExposure();
      source.disable();
      if (sourceRef.current === source) sourceRef.current = null;
      setError(caught instanceof Error ? caught.message : 'Camera permission was not granted.');
      setState('error');
    }
  }, [clearSignalLater, flushExposure, implicitLearning, trackExposure]);

  const toggle = () => {
    if (state === 'off' || state === 'error') void enable();
    else disable();
  };

  const reviewReaction = (confirmed: boolean) => {
    if (!feedback || feedback.review) return;
    if (!confirmed && feedback.admittedReaction) retractAmbientReaction(feedback.target, feedback.admittedReaction);

    const stat = recordReactionReview(feedback.reaction.kind, confirmed);
    const accuracy = reactionTrustAccuracy(stat);
    void frontierLongitudinalStore.reviewReaction(
      feedback.reactionEpisodeId,
      confirmed ? 'confirmed' : 'contradicted',
    ).catch(() => false);
    setFeedback((current) => current ? {
      ...current,
      review: confirmed ? 'confirmed' : 'contradicted',
      reviewAccuracy: accuracy,
      reviewCount: stat.confirmed + stat.contradicted,
      quarantined: reactionTrustQuarantined(stat),
    } : current);
    clearSignalLater();
  };

  const followSuggestion = () => {
    if (!feedback?.suggestion) return;
    const history = useFrontierStore.getState().history;
    const element = findRenderedElement(feedback.suggestion.id, history);
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => {
      const primary = element.querySelector<HTMLElement>('a[data-frontier-fluid-primary-link="true"], a[href]');
      primary?.focus({ preventScroll: true });
    }, reduced ? 0 : 420);
    setFeedback(undefined);
  };

  const active = state === 'active' || state === 'calibrating' || state === 'requesting';
  const triggerClass = [
    styles.trigger,
    active ? styles.triggerActive : '',
    state === 'calibrating' || state === 'requesting' ? styles.triggerCalibrating : '',
    state === 'error' ? styles.triggerError : '',
  ].filter(Boolean).join(' ');
  const triggerTitle = !implicitLearning
    ? 'Enable learning in Radar before using the reaction loop'
    : active
      ? 'Disable local reaction loop'
      : 'Enable local reaction loop';

  const showPanel = mounted && (state === 'requesting' || state === 'calibrating' || state === 'error' || Boolean(feedback));
  const signalCopy = feedback ? SIGNAL_COPY[feedback.reaction.kind] : undefined;
  const confidence = feedback ? Math.round(feedback.reaction.confidence * 100) : Math.round(snapshot.confidence * 100);

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={toggle}
        disabled={!implicitLearning}
        aria-label={triggerTitle}
        aria-pressed={active}
        title={triggerTitle}
      >
        {state === 'off' ? <Camera size={12} /> : state === 'error' ? <CameraOff size={12} /> : <Sparkles size={12} />}
      </button>

      {showPanel ? createPortal(
        <aside className={styles.panel} aria-live="polite" aria-label="Local reaction loop status">
          <div className={styles.topline}>
            <span>Reaction loop</span>
            <span className={styles.local}>local · opt-in</span>
          </div>

          {state === 'requesting' ? (
            <>
              <p className={styles.message}>Requesting camera access…</p>
              <p className={styles.detail}>The camera is used only to derive transient expression cues in your browser.</p>
            </>
          ) : null}

          {state === 'calibrating' && !feedback ? (
            <>
              <p className={styles.message}>Learning a neutral baseline. Read the feed naturally for a moment.</p>
              <p className={styles.detail}>Calibration uses a robust session-local median so one blink or expression cannot define your baseline.</p>
              <div className={styles.progressTrack} aria-label={`Reaction calibration ${Math.round(snapshot.calibration * 100)}%`}>
                <div className={styles.progress} style={{ transform: `scaleX(${Math.max(0, Math.min(1, snapshot.calibration))})` }} />
              </div>
            </>
          ) : null}

          {state === 'error' ? (
            <>
              <p className={styles.message}>Reaction loop unavailable.</p>
              <p className={styles.detail}>{error || 'The local vision model could not start.'}</p>
            </>
          ) : null}

          {feedback && signalCopy ? (
            <>
              <p className={styles.message}>{signalCopy.title} · {confidence}% gate confidence</p>
              <p className={styles.detail}>{signalCopy.detail}</p>
              <div className={styles.target}>{feedback.target.title}</div>
              {!feedback.admittedReaction ? (
                <p className={styles.reviewed}>Observed locally, but not admitted to preference learning because attribution, sensor coverage, face observability, or trust did not clear the gate.</p>
              ) : null}

              {!feedback.review ? (
                <div className={styles.reviewRow} aria-label="Correct the reaction cue">
                  <span className={styles.reviewPrompt}>Was that cue accurate?</span>
                  <button type="button" className={styles.reviewButton} onClick={() => reviewReaction(true)}><Check size={10} aria-hidden="true" /> Yes</button>
                  <button type="button" className={styles.reviewButton} onClick={() => reviewReaction(false)}><X size={10} aria-hidden="true" /> Not really</button>
                </div>
              ) : (
                <p className={styles.reviewed}>
                  {feedback.review === 'confirmed' ? 'Confirmed.' : 'Corrected.'}
                  {feedback.quarantined
                    ? ' This cue is now quarantined from recommendation authority until its reliability recovers.'
                    : ' Cue authority will adjust on future reactions.'}
                  {feedback.reviewAccuracy !== undefined && feedback.reviewCount
                    ? ` ${Math.round(feedback.reviewAccuracy * 100)}% agreement across ${feedback.reviewCount} reviewed ${feedback.reaction.kind} cue${feedback.reviewCount === 1 ? '' : 's'}.`
                    : ''}
                </p>
              )}

              {feedback.suggestion ? (
                <button type="button" className={styles.suggestion} onClick={followSuggestion}>
                  <span>{signalCopy.action}: {feedback.suggestion.title}</span>
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              ) : null}
            </>
          ) : null}

          <p className={styles.privacy}>No video, landmarks, face identity, biometric template, or raw expression stream is stored. Target-attributed wall time, bounded local inference time, face-observable time, sparse cue episodes, and your corrections stay local.</p>
        </aside>,
        document.body,
      ) : null}
    </>
  );
}