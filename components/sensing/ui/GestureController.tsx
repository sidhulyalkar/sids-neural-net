'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import {
  ChevronDown,
  Hand,
  Menu,
  MousePointer2,
  MoveHorizontal,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { siteNavItems } from '@/src/data/siteNav';
import { useSensingStore } from '@/lib/stores/sensingStore';
import type { GestureActionType } from '../gestures';
import {
  initialPinchSelectionState,
  updatePinchSelection,
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
const TARGET_PROBE_RADIUS_PX = 20;
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

/**
 * Resolve a gesture target with a small forgiving halo around the air cursor.
 * Direct hits always win. Nearby probes make compact links/buttons selectable
 * without turning the page into one giant invisible click surface.
 */
function interactiveAt(x: number, y: number): HTMLElement | null {
  const px = x * window.innerWidth;
  const py = y * window.innerHeight;
  const probes = [
    [0, 0],
    [TARGET_PROBE_RADIUS_PX, 0],
    [-TARGET_PROBE_RADIUS_PX, 0],
    [0, TARGET_PROBE_RADIUS_PX],
    [0, -TARGET_PROBE_RADIUS_PX],
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
  return bestDistance <= TARGET_PROBE_RADIUS_PX ? best : null;
}

function targetKey(target: HTMLElement | null): string | null {
  if (!target) return null;
  let id = targetIds.get(target);
  if (!id) {
    id = nextTargetId;
    nextTargetId += 1;
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
    // A synthetic/legacy target may not accept focus options. Clicking still works.
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

type GuidePhase = 'hidden' | 'visible' | 'fading';

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
  const [pranked, setPranked] = useState(false);
  const handledActionRef = useRef(0);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const prankTimeoutRef = useRef<number | null>(null);
  const guideFadeTimeoutRef = useRef<number | null>(null);
  const guideHideTimeoutRef = useRef<number | null>(null);
  const uiFrameRef = useRef<number | null>(null);
  const pinchSelectionRef = useRef(initialPinchSelectionState());

  const currentRouteIndex = useMemo(() => routeIndex(pathname), [pathname]);

  const scheduleUi = useCallback((update: () => void) => {
    if (uiFrameRef.current !== null) window.cancelAnimationFrame(uiFrameRef.current);
    uiFrameRef.current = window.requestAnimationFrame(() => {
      uiFrameRef.current = null;
      update();
    });
  }, []);

  const showFeedback = useCallback(
    (label: string, duration = 1200) => {
      scheduleUi(() => setFeedback(label));
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(null), duration);
    },
    [scheduleUi],
  );

  const showGuide = useCallback(() => {
    if (guideFadeTimeoutRef.current !== null) window.clearTimeout(guideFadeTimeoutRef.current);
    if (guideHideTimeoutRef.current !== null) window.clearTimeout(guideHideTimeoutRef.current);
    scheduleUi(() => setGuidePhase('visible'));
    guideFadeTimeoutRef.current = window.setTimeout(() => setGuidePhase('fading'), 5400);
    guideHideTimeoutRef.current = window.setTimeout(() => setGuidePhase('hidden'), 6500);
  }, [scheduleUi]);

  useEffect(() => {
    if (enabled && status === 'running') showGuide();
  }, [enabled, status, showGuide]);

  useEffect(() => {
    const reopenGuide = () => showGuide();
    window.addEventListener(GESTURE_GUIDE_EVENT, reopenGuide);
    return () => window.removeEventListener(GESTURE_GUIDE_EVENT, reopenGuide);
  }, [showGuide]);

  useEffect(() => {
    if (enabled) return;
    pinchSelectionRef.current = initialPinchSelectionState();
    scheduleUi(() => {
      setPaletteOpen(false);
      setFeedback(null);
      setTargetText(null);
      setTargetLocked(false);
      setGuidePhase('hidden');
      setPranked(false);
    });
    handledActionRef.current = 0;
    document.documentElement.removeAttribute('data-sensing-pranked');
    if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
    if (guideFadeTimeoutRef.current !== null) window.clearTimeout(guideFadeTimeoutRef.current);
    if (guideHideTimeoutRef.current !== null) window.clearTimeout(guideHideTimeoutRef.current);
  }, [enabled, scheduleUi]);

  useEffect(
    () => () => {
      if (uiFrameRef.current !== null) window.cancelAnimationFrame(uiFrameRef.current);
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
      if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
      if (guideFadeTimeoutRef.current !== null) window.clearTimeout(guideFadeTimeoutRef.current);
      if (guideHideTimeoutRef.current !== null) window.clearTimeout(guideHideTimeoutRef.current);
      document.documentElement.removeAttribute('data-sensing-pranked');
    },
    [],
  );

  useEffect(() => {
    if (!enabled || status !== 'running' || !cursor) {
      pinchSelectionRef.current = initialPinchSelectionState();
      scheduleUi(() => {
        setTargetText(null);
        setTargetLocked(false);
      });
      return;
    }

    if (paletteOpen) {
      const list = document.querySelector<HTMLElement>('[cmdk-list]');
      if (cursor.y < 0.22) list?.scrollBy({ top: -18 });
      if (cursor.y > 0.78) list?.scrollBy({ top: 18 });
    }

    const target = interactiveAt(cursor.x, cursor.y);
    const key = targetKey(target);
    const selection = updatePinchSelection(pinchSelectionRef.current, {
      pinching: cursor.pinching,
      targetKey: key,
      now: performance.now(),
    });
    pinchSelectionRef.current = selection.state;

    const label = targetLabel(target);
    scheduleUi(() => {
      setTargetText(label);
      setTargetLocked(selection.targetLocked);
    });

    if (!selection.activate || !target || document.hidden) return;
    const blocked = isTyping() || hasBlockingDialog();
    if (!paletteOpen && blocked) {
      showFeedback('Selection paused while typing');
      return;
    }

    activateTarget(target);
    showFeedback('Pinch selected');
  }, [cursor, enabled, paletteOpen, scheduleUi, showFeedback, status]);

  useEffect(() => {
    if (!enabled || !action || action.id === handledActionRef.current || document.hidden) return;
    handledActionRef.current = action.id;

    const blocked = isTyping() || hasBlockingDialog();
    switch (action.type) {
      case 'navigate_next': {
        if (blocked || paletteOpen) return;
        router.push(siteNavItems[(currentRouteIndex + 1) % siteNavItems.length].href);
        break;
      }
      case 'navigate_previous': {
        if (blocked || paletteOpen) return;
        router.push(siteNavItems[(currentRouteIndex - 1 + siteNavItems.length) % siteNavItems.length].href);
        break;
      }
      case 'open_palette':
        if (!blocked) scheduleUi(() => setPaletteOpen(true));
        break;
      case 'close_palette':
        scheduleUi(() => setPaletteOpen(false));
        break;
      case 'activate': {
        if ((!paletteOpen && blocked) || !cursor) return;
        const target = interactiveAt(cursor.x, cursor.y);
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
      case 'prank': {
        document.documentElement.setAttribute('data-sensing-pranked', 'true');
        scheduleUi(() => setPranked(true));
        if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
        prankTimeoutRef.current = window.setTimeout(() => {
          document.documentElement.removeAttribute('data-sensing-pranked');
          setPranked(false);
        }, 3200);
        break;
      }
    }

    showFeedback(ACTION_LABELS[action.type], action.type === 'prank' ? 3200 : 1200);
  }, [action, currentRouteIndex, cursor, enabled, paletteOpen, router, scheduleUi, showFeedback]);

  if (!enabled || status !== 'running') return null;

  const cursorStatus = feedback
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
          className={`pointer-events-none fixed left-1/2 top-16 z-[95] w-[min(92vw,760px)] -translate-x-1/2 transition-all duration-700 ${
            guidePhase === 'fading' ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
          }`}
          role="status"
          aria-live="polite"
        >
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
                  <h2 className="mt-1 text-base font-semibold text-text-primary">Your hand is now the pointer.</h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Aim first, wait for the green lock, then pinch. Release before the next selection.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-bg-deep/60 px-2.5 py-1 font-mono text-[9px] text-text-muted">
                fades automatically
              </span>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <MousePointer2 className="h-4 w-4 text-cyan" />
                <div className="mt-2 text-xs font-semibold text-text-primary">Point to aim</div>
                <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Index fingertip steers the violet cursor.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <Hand className="h-4 w-4 text-green" />
                <div className="mt-2 text-xs font-semibold text-text-primary">Pinch to select</div>
                <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Green means locked. Touch thumb + index briefly.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <MoveHorizontal className="h-4 w-4 text-violet" />
                <div className="mt-2 text-xs font-semibold text-text-primary">Raise to navigate</div>
                <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Open right hand goes next. Open left goes back.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <Menu className="h-4 w-4 text-amber" />
                <div className="mt-2 text-xs font-semibold text-text-primary">Flash the menu</div>
                <div className="mt-1 text-[10px] leading-relaxed text-text-muted">Open palm → fist opens navigation. Fist closes it.</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-2 font-mono text-[9px] text-text-muted">
              <ChevronDown className="h-3 w-3" />
              Downward closed-fist strike scrolls the page
              <span className="text-white/20">·</span>
              camera landmarks stay local
            </div>
          </div>
        </div>
      )}

      {cursor && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[90] -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-50"
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
              <span className={`block font-mono text-[8px] font-semibold uppercase tracking-[0.18em] ${targetLocked ? 'text-green' : 'text-cyan'}`}>
                {targetLocked ? 'locked · pinch' : 'acquiring target'}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[9px] text-text-secondary">{targetText}</span>
            </div>
          )}
        </div>
      )}

      <div
        className="pointer-events-none fixed left-1/2 top-5 z-[90] -translate-x-1/2 rounded-full border border-violet/25 bg-bg-panel/85 px-3 py-1.5 font-mono text-[10px] text-text-secondary backdrop-blur"
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

      {paletteOpen && (
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
          <Command className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet/30 bg-bg-panel/98 shadow-glow-violet">
            <div className="border-b border-white/10 bg-gradient-to-r from-violet/15 via-transparent to-cyan/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-violet/25 bg-violet/15 text-violet">
                    <Hand className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-violet">Gesture navigator</div>
                    <div className="mt-1 text-sm font-semibold text-text-primary">Point, lock, pinch.</div>
                    <div className="mt-0.5 text-[10px] text-text-muted">Move near an item until the cursor turns green.</div>
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
