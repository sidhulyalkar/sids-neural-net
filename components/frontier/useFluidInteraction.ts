'use client';

import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { FrontierItem } from '@/lib/frontier/types';
import {
  FRONTIER_FLUID_DOUBLE_MS,
  qualifiesFrontierFluidPairPress,
  qualifiesFrontierFluidRelease,
  resolveFrontierFluidIntent,
  type FrontierFluidClickState,
  type FrontierFluidPress,
  type FrontierFluidReleasePoint,
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
  const releasePoint = useRef<FrontierFluidReleasePoint | undefined>(undefined);
  const press = useRef<FrontierFluidPress | undefined>(undefined);
  const armedPairPress = useRef(false);
  const suppressClick = useRef(false);
  const suppressDoubleClick = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const continuingPair = event.isPrimary && event.button === 0 && qualifiesFrontierFluidPairPress(
      releasePoint.current,
      {
        x: event.clientX,
        y: event.clientY,
        at: event.timeStamp,
        doubleMs,
      },
    );

    if (!event.isPrimary || event.button !== 0 || (!continuingPair && !shouldRouteTarget(event.target))) {
      press.current = undefined;
      armedPairPress.current = false;
      return;
    }

    armedPairPress.current = continuingPair;
    press.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: event.timeStamp,
    };
  }, [doubleMs]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const started = press.current;
    const ownsPair = armedPairPress.current;
    press.current = undefined;
    armedPairPress.current = false;

    if (!event.isPrimary || event.button !== 0 || (!ownsPair && !shouldRouteTarget(event.target))) return;
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
    suppressClick.current = ownsPair || Boolean(primaryFluidAnchor(event.target));

    if (resolved.intent === 'external') {
      suppressDoubleClick.current = true;
      releasePoint.current = undefined;
      onCollapse(item);
      onExternalOpen?.(item);
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    releasePoint.current = {
      x: event.clientX,
      y: event.clientY,
      at: event.timeStamp,
    };
    if (resolved.intent === 'expand') onExpand(item);
    else if (resolved.intent === 'collapse') onCollapse(item);
  }, [doubleMs, expanded, item, onCollapse, onExpand, onExternalOpen]);

  const onPointerCancel = useCallback(() => {
    press.current = undefined;
    armedPairPress.current = false;
  }, []);

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onDoubleClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressDoubleClick.current && !shouldRouteTarget(event.target)) return;
    suppressDoubleClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    // Pointer ownership is resolved in capture phase. Expansion can move the
    // original hit coordinate over native video/audio controls before release
    // two. Those controls must remain fully native for ordinary single clicks,
    // but an already-qualified pair belongs to the card and cannot be allowed
    // to disappear inside a child before the state machine sees pointerup.
    onPointerDownCapture: onPointerDown,
    onPointerUpCapture: onPointerUp,
    onPointerCancelCapture: onPointerCancel,
    onClickCapture,
    onDoubleClickCapture,
  };
}
