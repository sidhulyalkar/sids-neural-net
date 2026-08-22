import type { FrontierItem, FrontierReaction } from '@/lib/frontier/types';

export const FRONTIER_SEMANTIC_TELEMETRY_EVENT = 'frontier:semantic-telemetry';

export type FrontierSemanticTelemetryKind =
  | 'dwell'
  | 'expand'
  | 'open'
  | 'save'
  | 'reaction'
  | 'visibility-depth';

export type FrontierSemanticTelemetry = {
  kind: FrontierSemanticTelemetryKind;
  item: FrontierItem;
  at: number;
  dwellMs?: number;
  reaction?: FrontierReaction;
  depth?: number;
};

const REACTION_WEIGHTS: Record<FrontierReaction, number> = {
  up: 1,
  down: -1.5,
  love: 1.25,
  important: 1.05,
  surprise: 0.72,
  useful: 0.9,
  read: 0.42,
  known: 0.12,
  later: 0.22,
  meh: -0.62,
  hide: -1.85,
};

export function semanticTelemetryWeight(event: FrontierSemanticTelemetry): number {
  switch (event.kind) {
    case 'reaction': return event.reaction ? REACTION_WEIGHTS[event.reaction] : 0;
    case 'save': return 0.8;
    case 'open': return 0.46;
    case 'expand': return 0.36;
    case 'dwell': {
      const seconds = Math.max(0, Math.min(120, (event.dwellMs ?? 0) / 1000));
      if (seconds < 1.5) return 0;
      return Math.min(0.62, 0.08 + Math.log1p(seconds - 1.5) / 8.5);
    }
    case 'visibility-depth': {
      const depth = Math.max(0, Math.min(1, event.depth ?? 0));
      return depth < 0.45 ? 0 : 0.06 + depth * 0.16;
    }
  }
}

export function emitFrontierSemanticTelemetry(event: Omit<FrontierSemanticTelemetry, 'at'> & { at?: number }): void {
  if (typeof window === 'undefined') return;
  const detail: FrontierSemanticTelemetry = { ...event, at: event.at ?? Date.now() };
  window.dispatchEvent(new CustomEvent<FrontierSemanticTelemetry>(FRONTIER_SEMANTIC_TELEMETRY_EVENT, { detail }));
}

export function listenFrontierSemanticTelemetry(
  listener: (event: FrontierSemanticTelemetry) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const custom = event as CustomEvent<FrontierSemanticTelemetry>;
    if (custom.detail?.item) listener(custom.detail);
  };
  window.addEventListener(FRONTIER_SEMANTIC_TELEMETRY_EVENT, handler);
  return () => window.removeEventListener(FRONTIER_SEMANTIC_TELEMETRY_EVENT, handler);
}
