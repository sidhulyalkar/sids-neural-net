'use client';

import { lazy, Suspense, useEffect, useState } from 'react';

const DeferredBackgroundCanvas = lazy(() =>
  import('./BackgroundCanvas').then((module) => ({ default: module.BackgroundCanvas })),
);
const DeferredRuntimeControls = lazy(() =>
  import('./FrontierRuntimeControls').then((module) => ({ default: module.FrontierRuntimeControls })),
);
const DeferredSignalTelemetryBridge = lazy(() =>
  import('./signals/SignalTelemetryBridge').then((module) => ({ default: module.SignalTelemetryBridge })),
);
const DeferredMeshStateBridge = lazy(() =>
  import('./sync/MeshStateBridge').then((module) => ({ default: module.MeshStateBridge })),
);

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function shouldRenderAmbientCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Keep FRONTIER's first useful paint and first interaction path free of
 * decorative/synchronization work. These systems are useful once the reader is
 * settled, but none is required to render or turn the first content page.
 */
export function FrontierDeferredExtras() {
  const [ready, setReady] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    let cancelled = false;
    const mount = () => {
      if (cancelled) return;
      setAmbientEnabled(shouldRenderAmbientCanvas());
      setReady(true);
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(mount, { timeout: 1_800 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const handle = window.setTimeout(mount, 1_000);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      {ambientEnabled ? <DeferredBackgroundCanvas /> : null}
      <DeferredSignalTelemetryBridge />
      <DeferredMeshStateBridge />
      <DeferredRuntimeControls />
    </Suspense>
  );
}
