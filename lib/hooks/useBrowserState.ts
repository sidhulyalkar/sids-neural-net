'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => undefined;

/** Hydration signal without a mount effect or an extra client render. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Reactive media query backed by the browser as an external store. */
export function useMediaQuery(query: string, serverFallback = false) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

/** Reactive viewport width for adaptive experiences without mount-time setState. */
export function useViewportWidth(serverFallback = 1440) {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('resize', onStoreChange, { passive: true });
      return () => window.removeEventListener('resize', onStoreChange);
    },
    () => window.innerWidth,
    () => serverFallback,
  );
}
