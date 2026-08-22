'use client';

import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import {
  FRONTIER_FLUID_DOUBLE_MS,
  qualifiesFrontierFluidRelease,
  resolveFrontierFluidIntent,
  type FrontierFluidClickState,
  type FrontierFluidPress,
} from '@/lib/frontier/interaction/fluidPointer';

const INTERACTIVE_SELECTOR = [
  'button', 'input', 'textarea', 'select', 'video', 'audio', 'iframe',
  '[contenteditable="true"]', '[role="button"]', '[role="slider"]', '[role="textbox"]',
  '[data-frontier-fluid-native="true"]',
].join(',');

function primaryFluidAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>('a[data-frontier-fluid-primary-link="true"]');
}

function shouldRouteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (primaryFluidAnchor(target)) return true;
  return !target.closest(INTERACTIVE_SELECTOR) && !target.closest('a');
}

type Options = {
  item: FrontierItem;
  expanded: boolean;
  doubleMs?: number;
  onExpand: (item: FrontierItem) => void;
  onCollapse: (item: FrontierItem) => void;
  onExternalOpen?: (item: FrontierItem) => void;
};

export function useFluidInteraction({
  item,
  expanded,
  doubleMs = FRONTIER_FLUID_DOUBLE_MS,
  onExpand,
  onCollapse,
  onExternalOpen,
}: Options) {
  const clickState = useRef<FrontierFluidClickState>({ lastReleaseAt: 0 });
  const press = useRef<FrontierFluidPress | undefined>(undefined);
  const suppressClick = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || !shouldRouteTarget(event.target)) {
      press.current = undefined;
      return;
    }
    press.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: event.timeStamp,
    };
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const started = press.current;
    press.current = undefined;
    if (!event.isPrimary || event.button !== 0 || !shouldRouteTarget(event.target)) return;
    if (!qualifiesFrontierFluidRelease(started, {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: event.timeStamp,
    })) return;

    const resolved = resolveFrontierFluidIntent({
      state: clickState.current,
      at: event.timeStamp,
      expanded,
      doubleMs,
    });
    clickState.current = resolved.state;
    suppressClick.current = Boolean(primaryFluidAnchor(event.target));

    if (resolved.intent === 'external') {
      onCollapse(item);
      onExternalOpen?.(item);
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (resolved.intent === 'expand') onExpand(item);
    else if (resolved.intent === 'collapse') onCollapse(item);
  }, [doubleMs, expanded, item, onCollapse, onExpand, onExternalOpen]);

  const onPointerCancel = useCallback(() => { press.current = undefined; }, []);

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClick.current || !primaryFluidAnchor(event.target)) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onDoubleClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!shouldRouteTarget(event.target)) return;
    event.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
    onDoubleClickCapture,
  };
}
