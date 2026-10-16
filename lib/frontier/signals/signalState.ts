export const FRONTIER_SIGNAL_LOAD_EVENT = 'frontier:signal-load';

let currentLoad = 0;
let currentUpdatedAt = 0;

export function frontierSignalLoadSnapshot(now = Date.now()): number {
  if (!currentUpdatedAt || now - currentUpdatedAt > 30_000) return 0;
  return Math.max(0, Math.min(1, currentLoad));
}

export function publishFrontierSignalLoad(load: number, at = Date.now()): void {
  currentLoad = Math.max(0, Math.min(1, Number.isFinite(load) ? load : 0));
  currentUpdatedAt = at;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRONTIER_SIGNAL_LOAD_EVENT, {
      detail: { load: currentLoad, at: currentUpdatedAt },
    }));
  }
}

export function resetFrontierSignalLoad(): void {
  currentLoad = 0;
  currentUpdatedAt = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FRONTIER_SIGNAL_LOAD_EVENT, {
      detail: { load: 0, at: Date.now() },
    }));
  }
}
