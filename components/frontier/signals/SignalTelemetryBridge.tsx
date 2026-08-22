'use client';

import { useEffect } from 'react';
import { connectLocalSignalSocket } from '@/lib/frontier/signals/signalBridge';
import { useSignalProcessor } from './useSignalProcessor';

const CONFIG_KEY = 'frontier-signal-bridge-v1';
export const FRONTIER_SIGNAL_SAMPLES_EVENT = 'frontier:signal-samples';

type SignalBridgeConfig = {
  enabled?: boolean;
  url?: string;
};

function readConfig(): SignalBridgeConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SignalBridgeConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Invisible opt-in bridge. Nothing is connected by default. A local sensor
 * relay can be enabled with localStorage config, while Web Bluetooth callers
 * can dispatch frontier:signal-samples after an explicit user gesture.
 */
export function SignalTelemetryBridge() {
  const { push } = useSignalProcessor();

  useEffect(() => {
    const onSamples = (event: Event) => {
      const custom = event as CustomEvent<{ values?: number[] | Float32Array }>;
      const values = custom.detail?.values;
      if (values?.length) void push(values).catch(() => undefined);
    };
    window.addEventListener(FRONTIER_SIGNAL_SAMPLES_EVENT, onSamples);

    const config = readConfig();
    let disconnect: (() => void) | undefined;
    if (config.enabled && config.url) {
      try {
        disconnect = connectLocalSignalSocket({
          url: config.url,
          onSamples: (values) => { void push(values).catch(() => undefined); },
        });
      } catch {
        // Invalid or unavailable local bridge leaves FRONTIER fully offline.
      }
    }

    return () => {
      window.removeEventListener(FRONTIER_SIGNAL_SAMPLES_EVENT, onSamples);
      disconnect?.();
    };
  }, [push]);

  return null;
}
