'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import {
  bindFrontierAudioReactiveElement,
  frontierCanAnalyzeMediaElement,
} from '@/lib/frontier/audio/audioReactivity';

export function useExpandedAudioReactivity(
  rootRef: RefObject<HTMLElement | null>,
  expanded: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !expanded) return;
    const cleanups = new Map<HTMLMediaElement, () => void>();
    const metadataListeners = new Map<HTMLMediaElement, () => void>();

    const bind = (element: HTMLMediaElement) => {
      if (cleanups.has(element) || !frontierCanAnalyzeMediaElement(element)) return;
      cleanups.set(element, bindFrontierAudioReactiveElement(element));
    };

    const inspect = () => {
      for (const element of root.querySelectorAll<HTMLMediaElement>('video, audio')) {
        bind(element);
        if (metadataListeners.has(element)) continue;
        const onMetadata = () => bind(element);
        element.addEventListener('loadedmetadata', onMetadata);
        metadataListeners.set(element, () => element.removeEventListener('loadedmetadata', onMetadata));
      }
    };

    inspect();
    const observer = typeof MutationObserver === 'undefined'
      ? undefined
      : new MutationObserver(inspect);
    observer?.observe(root, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      for (const cleanup of cleanups.values()) cleanup();
      for (const cleanup of metadataListeners.values()) cleanup();
    };
  }, [expanded, rootRef]);
}
