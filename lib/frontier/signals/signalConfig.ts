export const FRONTIER_SIGNAL_BRIDGE_CONFIG_KEY = 'frontier-signal-bridge-v1';
export const FRONTIER_SIGNAL_CONFIG_EVENT = 'frontier:signal-config';

export type FrontierSignalBridgeConfig = {
  enabled?: boolean;
  url?: string;
};

export function readFrontierSignalBridgeConfig(): FrontierSignalBridgeConfig {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FRONTIER_SIGNAL_BRIDGE_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FrontierSignalBridgeConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeFrontierSignalBridgeConfig(config: FrontierSignalBridgeConfig): void {
  if (typeof window === 'undefined') return;
  const next = {
    enabled: Boolean(config.enabled),
    url: config.url?.trim().slice(0, 240) || undefined,
  };
  window.localStorage.setItem(FRONTIER_SIGNAL_BRIDGE_CONFIG_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(FRONTIER_SIGNAL_CONFIG_EVENT));
}
