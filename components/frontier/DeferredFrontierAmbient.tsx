'use client';

import { useEffect, useState } from 'react';
import { BackgroundCanvas } from './BackgroundCanvas';
import { FrontierRuntimeControls } from './FrontierRuntimeControls';
import { SignalTelemetryBridge } from './signals/SignalTelemetryBridge';
import { MeshStateBridge } from './sync/MeshStateBridge';

export function DeferredFrontierAmbient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(() => setReady(true), { timeout: 2200 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(id);
  }, []);

  if (!ready) return null;

  return (
    <>
      <BackgroundCanvas />
      <SignalTelemetryBridge />
      <MeshStateBridge />
      <FrontierRuntimeControls />
    </>
  );
}
