'use client';

import { useEffect } from 'react';
import { publishFrontierRuntimeHealth } from '@/lib/frontier/runtime/runtimeHealth';
import { connectLocalSignalSocket } from '@/lib/frontier/signals/signalBridge';
import { useSignalProcessor } from './useSignalProcessor';

const CONFIG_KEY = 'frontier-signal-bridge-v1';
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
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

function retryDelay(failures: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, Math.min(5, failures - 1)));
}

/**
 * Invisible opt-in bridge. Nothing is connected by default. A local sensor
 * relay can be enabled with localStorage config, while Web Bluetooth callers
 * can dispatch frontier:signal-samples after an explicit user gesture.
 *
 * When an explicitly enabled localhost relay disappears, FRONTIER reconnects
 * with bounded exponential backoff. The recommendation system never depends on
 * this path: prolonged sensor failure simply removes signal-load modulation.
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
    let retryTimer: number | undefined;
    let failures = 0;
    let stopped = false;

    const clearRetry = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const scheduleReconnect = (message: string) => {
      if (stopped || !config.enabled || !config.url || retryTimer !== undefined) return;
      failures += 1;
      const delay = retryDelay(failures);
      publishFrontierRuntimeHealth('signal-bridge', 'degraded', {
        message: `${message}; retrying locally`,
        consecutiveFailures: failures,
      });
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, delay);
    };

    const connect = () => {
      if (stopped || !config.enabled || !config.url) return;
      disconnect?.();
      disconnect = undefined;
      publishFrontierRuntimeHealth('signal-bridge', 'starting');
      try {
        disconnect = connectLocalSignalSocket({
          url: config.url,
          onSamples: (values) => { void push(values).catch(() => undefined); },
          onStatus: (status) => {
            if (stopped) return;
            if (status === 'open') {
              failures = 0;
              clearRetry();
              publishFrontierRuntimeHealth('signal-bridge', 'ready');
            } else if (status === 'connecting') {
              publishFrontierRuntimeHealth('signal-bridge', 'starting');
            } else if (status === 'closed') {
              scheduleReconnect('local signal socket closed');
            } else {
              scheduleReconnect('local signal socket error');
            }
          },
        });
      } catch (error) {
        scheduleReconnect(error instanceof Error ? error.message : 'local signal bridge unavailable');
      }
    };

    if (config.enabled && config.url) connect();
    else publishFrontierRuntimeHealth('signal-bridge', 'idle');

    return () => {
      stopped = true;
      clearRetry();
      window.removeEventListener(FRONTIER_SIGNAL_SAMPLES_EVENT, onSamples);
      disconnect?.();
      publishFrontierRuntimeHealth('signal-bridge', 'idle');
    };
  }, [push]);

  return null;
}
