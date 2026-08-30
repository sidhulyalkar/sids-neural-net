'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Camera, CameraOff, Sparkles } from 'lucide-react';
import { VisionSignalSource } from '@/components/perceptual-cortex/VisionSignalSource';
import {
  ReactionInferenceEngine,
  type FrontierAmbientReaction,
  type FrontierAmbientReactionKind,
  type ReactionInferenceSnapshot,
} from '@/lib/frontier/reaction';
import { useFrontierStore } from '@/lib/frontier/store';
import type { FrontierHistoryEntry, FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-reaction-loop.module.css';

type Props = { feedActive: boolean };
type LoopState = 'off' | 'requesting' | 'calibrating' | 'active' | 'error';
type RenderedTarget = { item: FrontierItem; element: HTMLElement; score: number };
type SignalFeedback = {
  reaction: FrontierAmbientReaction;
  target: FrontierItem;
  suggestion?: FrontierItem;
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
    detail: 'This card produced a sustained positive expression cue. It will count as weak evidence, below any click, save, or explicit reaction.',
    action: 'Follow the thread',
  },
  interest: {
    title: 'Attention cue',
    detail: 'A stable, forward-attention cue held here. Repeated signals can gently strengthen this topic in future sessions.',
    action: 'Keep exploring',
  },
  surprise: {
    title: 'Novelty cue',
    detail: 'A brief high-novelty reaction held long enough to clear the confidence gate. It can slightly increase adjacent exploration.',
    action: 'Try an adjacent wildcard',
  },
  friction: {
    title: 'Friction cue',
    detail: 'A friction cue appeared here. FRONTIER records it for context, but it will not treat it as dislike without behavioral or explicit corroboration.',
    action: 'Switch angle',
  },
};

function visibleFraction(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return Math.min(1, (visibleWidth * visibleHeight) / (rect.width * rect.height));
}

function normalizedUrl(value: string): string {
  try {
    const url = new URL(value, window.location.href);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim().replace(/\/$/, '');
  }
}

function historyMaps(history: Record<string, FrontierHistoryEntry>) {
  const byUrl = new Map<string, FrontierHistoryEntry>();
  const byTitle = new Map<string, FrontierHistoryEntry>();
  for (const entry of Object.values(history)) {
    byUrl.set(normalizedUrl(entry.item.url), entry);
    byTitle.set(entry.item.title.trim().toLowerCase(), entry);
  }
  return { byUrl, byTitle };
}

function resolveEntry(
  element: HTMLElement,
  history: Record<string, FrontierHistoryEntry>,
  maps: ReturnType<typeof historyMaps>
): FrontierHistoryEntry | undefined {
  const explicitId = element.dataset.frontierItemId;
  if (explicitId && history[explicitId]) return history[explicitId];
  for (const anchor of element.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const matched = maps.byUrl.get(normalizedUrl(anchor.href));
    if (matched) return matched;
  }
  const title = element.querySelector('h3')?.textContent?.trim().toLowerCase();
  return title ? maps.byTitle.get(title) : undefined;
}

function renderedTargets(history: Record<string, FrontierHistoryEntry>, visibleOnly = true): RenderedTarget[] {
  const active = document.activeElement;
  const maps = historyMaps(history);
  const targets: RenderedTarget[] = [];
  for (const element of document.querySelectorAll<HTMLElement>('article')) {
    const entry = resolveEntry(element, history, maps);
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
    targets.push({ item: entry.item, element, score: fraction * 0.55 + centerProximity * 0.35 + hovered + focused + expanded });
  }
  return targets.sort((left, right) => right.score - left.score);
}

function overlap(left: FrontierItem, right: FrontierItem): number {
  const a = new Set(left.tags.slice(0, 8).map((tag) => tag.toLowerCase()));
  const b = new Set(right.tags.slice(0, 8).map((tag) => tag.toLowerCase()));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const tag of a) if (b.has(tag)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function chooseSuggestion(
  target: FrontierItem,
  kind: FrontierAmbientReactionKind,
  history: Record<string, FrontierHistoryEntry>
): FrontierItem | undefined {
  const candidates = renderedTargets(history, false).filter((candidate) => candidate.item.id !== target.id);
  const ranked = candidates.map(({ item }) => {
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
  }).sort((left, right) => right.score - left.score);
  return ranked[0]?.item;
}

function findRenderedElement(itemId: string, history: Record<string, FrontierHistoryEntry>): HTMLElement | undefined {
  return renderedTargets(history, false).find((candidate) => candidate.item.id === itemId)?.element;
}

export function FrontierReactionLoop({ feedActive }: Props) {
  const implicitLearning = useFrontierStore((state) => state.behavior.implicitLearning);
  const sourceRef = useRef<VisionSignalSource | null>(null);
  const engineRef = useRef(new ReactionInferenceEngine());
  const feedActiveRef = useRef(feedActive);
  const lastUiUpdateRef = useRef(0);
  const clearSignalTimerRef = useRef<number | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<LoopState>('off');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<ReactionInferenceSnapshot>(EMPTY_SNAPSHOT);
  const [feedback, setFeedback] = useState<SignalFeedback>();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { feedActiveRef.current = feedActive; }, [feedActive]);

  const clearSignalLater = useCallback(() => {
    if (clearSignalTimerRef.current !== undefined) window.clearTimeout(clearSignalTimerRef.current);
    clearSignalTimerRef.current = window.setTimeout(() => {
      setFeedback(undefined);
      clearSignalTimerRef.current = undefined;
    }, 8_000);
  }, []);

  const disable = useCallback(() => {
    sourceRef.current?.disable();
    sourceRef.current = null;
    engineRef.current.reset();
    if (clearSignalTimerRef.current !== undefined) window.clearTimeout(clearSignalTimerRef.current);
    clearSignalTimerRef.current = undefined;
    setSnapshot(EMPTY_SNAPSHOT);
    setFeedback(undefined);
    setError('');
    setState('off');
  }, []);

  useEffect(() => () => {
    sourceRef.current?.disable();
    if (clearSignalTimerRef.current !== undefined) window.clearTimeout(clearSignalTimerRef.current);
  }, []);

  useEffect(() => {
    if (!implicitLearning && state !== 'off') disable();
  }, [disable, implicitLearning, state]);

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
        const target = feedActiveRef.current ? renderedTargets(history, true)[0] : undefined;
        const next = engineRef.current.push(face, target?.item.id, performance.now());
        const now = performance.now();
        if (now - lastUiUpdateRef.current >= 140 || next.reaction) {
          setSnapshot(next);
          setState(next.phase === 'calibrating' ? 'calibrating' : 'active');
          lastUiUpdateRef.current = now;
        }
        if (next.reaction && target) {
          useFrontierStore.getState().recordAmbientReaction(target.item, next.reaction);
          setFeedback({
            reaction: next.reaction,
            target: target.item,
            suggestion: chooseSuggestion(target.item, next.reaction.kind, useFrontierStore.getState().history),
          });
          clearSignalLater();
        }
      }, (message) => {
        sourceRef.current?.disable();
        sourceRef.current = null;
        setError(message);
        setState('error');
      }, { hands: false, face: true });
      if (sourceRef.current === source) setState('calibrating');
    } catch (caught) {
      source.disable();
      if (sourceRef.current === source) sourceRef.current = null;
      setError(caught instanceof Error ? caught.message : 'Camera permission was not granted.');
      setState('error');
    }
  }, [clearSignalLater, implicitLearning]);

  const toggle = () => {
    if (state === 'off' || state === 'error') void enable();
    else disable();
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
              <p className={styles.detail}>Calibration is session-local so the model compares cues with you, now, rather than a generic face template.</p>
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
              {feedback.suggestion ? (
                <button type="button" className={styles.suggestion} onClick={followSuggestion}>
                  <span>{signalCopy.action}: {feedback.suggestion.title}</span>
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              ) : null}
            </>
          ) : null}

          <p className={styles.privacy}>No video, landmarks, face identity, biometric template, or raw expression stream is stored. Only sparse content-linked reaction aggregates persist locally.</p>
        </aside>,
        document.body
      ) : null}
    </>
  );
}
