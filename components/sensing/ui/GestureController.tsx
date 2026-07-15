'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { Hand, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { siteNavItems } from '@/src/data/siteNav';
import { useSensingStore } from '@/lib/stores/sensingStore';
import type { GestureActionType } from '../gestures';

const ACTION_LABELS: Record<GestureActionType, string> = {
  navigate_next: 'Next section',
  navigate_previous: 'Previous section',
  open_palette: 'Navigation opened',
  close_palette: 'Navigation closed',
  activate: 'Target activated',
  page_down: 'Karate scroll',
  prank: 'Okay, you got me. The site looked. 👀',
};

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

function interactiveAt(x: number, y: number): HTMLElement | null {
  const element = document.elementFromPoint(x * window.innerWidth, y * window.innerHeight);
  const target = element?.closest<HTMLElement>('a, button, [role="button"], [cmdk-item]') ?? null;
  if (!target || target.closest('[data-gesture-ignore]')) return null;
  if (target.matches(':disabled, [aria-disabled="true"]')) return null;
  return target;
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
  const [targetLabel, setTargetLabel] = useState<string | null>(null);
  const [pranked, setPranked] = useState(false);
  const handledActionRef = useRef(0);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const prankTimeoutRef = useRef<number | null>(null);

  const currentRouteIndex = useMemo(() => routeIndex(pathname), [pathname]);

  useEffect(() => {
    if (!enabled) {
      setPaletteOpen(false);
      setFeedback(null);
      setTargetLabel(null);
      setPranked(false);
      handledActionRef.current = 0;
      document.documentElement.removeAttribute('data-sensing-pranked');
      if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
    }
  }, [enabled]);

  useEffect(
    () => () => {
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
      if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
      document.documentElement.removeAttribute('data-sensing-pranked');
    },
    [],
  );

  useEffect(() => {
    if (!enabled || status !== 'running' || !cursor) {
      setTargetLabel(null);
      return;
    }
    if (paletteOpen) {
      const list = document.querySelector<HTMLElement>('[cmdk-list]');
      if (cursor.y < 0.22) list?.scrollBy({ top: -18 });
      if (cursor.y > 0.78) list?.scrollBy({ top: 18 });
    }
    const target = interactiveAt(cursor.x, cursor.y);
    const label = target?.getAttribute('aria-label') || target?.textContent?.trim() || null;
    setTargetLabel(label ? label.replace(/\s+/g, ' ').slice(0, 48) : null);
  }, [cursor, enabled, status, paletteOpen]);

  useEffect(() => {
    if (!enabled || !action || action.id === handledActionRef.current || document.hidden) return;
    handledActionRef.current = action.id;

    const blocked = isTyping() || hasBlockingDialog();
    switch (action.type) {
      case 'navigate_next': {
        if (blocked || paletteOpen) return;
        const next = siteNavItems[(currentRouteIndex + 1) % siteNavItems.length];
        router.push(next.href);
        break;
      }
      case 'navigate_previous': {
        if (blocked || paletteOpen) return;
        const previous = siteNavItems[
          (currentRouteIndex - 1 + siteNavItems.length) % siteNavItems.length
        ];
        router.push(previous.href);
        break;
      }
      case 'open_palette':
        if (!blocked) setPaletteOpen(true);
        break;
      case 'close_palette':
        setPaletteOpen(false);
        break;
      case 'activate': {
        // The command palette intentionally focuses its search input, so allow
        // pinch selection inside our own palette while retaining typing safety elsewhere.
        if ((!paletteOpen && blocked) || !cursor) return;
        interactiveAt(cursor.x, cursor.y)?.click();
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
        setPranked(true);
        if (prankTimeoutRef.current !== null) window.clearTimeout(prankTimeoutRef.current);
        prankTimeoutRef.current = window.setTimeout(() => {
          document.documentElement.removeAttribute('data-sensing-pranked');
          setPranked(false);
        }, 3200);
        break;
      }
    }

    setFeedback(ACTION_LABELS[action.type]);
    if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(
      () => setFeedback(null),
      action.type === 'prank' ? 3200 : 1200,
    );
  }, [action, currentRouteIndex, cursor, enabled, paletteOpen, router]);

  if (!enabled || status !== 'running') return null;

  return (
    <>
      {cursor && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[90] -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
        >
          <div
            className={`grid h-8 w-8 place-items-center rounded-full border-2 backdrop-blur-sm transition-transform ${
              cursor.pinching
                ? 'scale-75 border-amber bg-amber/25 shadow-glow-amber'
                : targetLabel
                  ? 'border-green bg-green/15 shadow-glow-green'
                  : 'border-violet bg-violet/10 shadow-glow-violet'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          {targetLabel && (
            <span className="absolute left-5 top-7 w-max max-w-48 rounded bg-bg-deep/90 px-2 py-1 font-mono text-[9px] text-text-secondary">
              {targetLabel}
            </span>
          )}
        </div>
      )}

      <div
        className="pointer-events-none fixed left-1/2 top-5 z-[90] -translate-x-1/2 rounded-full border border-violet/25 bg-bg-panel/85 px-3 py-1.5 font-mono text-[10px] text-text-secondary backdrop-blur"
        aria-live="polite"
      >
        <span className="text-violet">{feedback || pose.replaceAll('_', ' ')}</span>
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
          className="fixed inset-0 z-[80] flex items-start justify-center bg-bg-deep/65 px-4 pt-[12vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Gesture navigation"
          data-gesture-palette
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaletteOpen(false);
          }}
        >
          <Command className="w-full max-w-xl overflow-hidden rounded-2xl border border-violet/25 bg-bg-panel shadow-glow-violet">
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <Search className="h-4 w-4 text-violet" />
              <Command.Input
                autoFocus
                placeholder="Search the neural net…"
                className="h-12 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Command.List className="max-h-[55vh] overflow-y-auto p-2">
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
                    className="group flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-text-secondary outline-none data-[selected=true]:bg-violet/15 data-[selected=true]:text-text-primary"
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
            <div className="border-t border-white/10 px-4 py-2 font-mono text-[9px] text-text-muted">
              Point + pinch to choose · closed fist to cancel
            </div>
          </Command>
        </div>
      )}
    </>
  );
}
