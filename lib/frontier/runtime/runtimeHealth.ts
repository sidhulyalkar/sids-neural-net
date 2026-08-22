export const FRONTIER_RUNTIME_HEALTH_EVENT = 'frontier:runtime-health';

export type FrontierRuntimeSubsystem =
  | 'vector-archive'
  | 'sequence-model'
  | 'signal-processor'
  | 'signal-bridge'
  | 'mesh'
  | 'live-daemon';

export type FrontierRuntimeStatus = 'idle' | 'starting' | 'ready' | 'degraded' | 'failed';

export type FrontierRuntimeHealth = {
  subsystem: FrontierRuntimeSubsystem;
  status: FrontierRuntimeStatus;
  updatedAt: number;
  message?: string;
  consecutiveFailures?: number;
};

export type FrontierRuntimeSnapshot = {
  overall: FrontierRuntimeStatus;
  entries: FrontierRuntimeHealth[];
  degraded: FrontierRuntimeSubsystem[];
};

const health = new Map<FrontierRuntimeSubsystem, FrontierRuntimeHealth>();

function statusRank(status: FrontierRuntimeStatus): number {
  switch (status) {
    case 'failed': return 4;
    case 'degraded': return 3;
    case 'starting': return 2;
    case 'ready': return 1;
    case 'idle': return 0;
  }
}

export function publishFrontierRuntimeHealth(
  subsystem: FrontierRuntimeSubsystem,
  status: FrontierRuntimeStatus,
  options: { message?: string; consecutiveFailures?: number; at?: number } = {}
): FrontierRuntimeHealth {
  const entry: FrontierRuntimeHealth = {
    subsystem,
    status,
    updatedAt: options.at ?? Date.now(),
    message: options.message?.slice(0, 240),
    consecutiveFailures: Number.isFinite(options.consecutiveFailures)
      ? Math.max(0, Math.floor(options.consecutiveFailures ?? 0))
      : undefined,
  };
  health.set(subsystem, entry);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<FrontierRuntimeHealth>(FRONTIER_RUNTIME_HEALTH_EVENT, { detail: entry }));
  }
  return entry;
}

export function frontierRuntimeHealthSnapshot(): FrontierRuntimeSnapshot {
  const entries = Array.from(health.values())
    .sort((left, right) => left.subsystem.localeCompare(right.subsystem));
  const degraded = entries
    .filter((entry) => entry.status === 'degraded' || entry.status === 'failed')
    .map((entry) => entry.subsystem);
  const overall = entries.reduce<FrontierRuntimeStatus>(
    (current, entry) => statusRank(entry.status) > statusRank(current) ? entry.status : current,
    'idle'
  );
  return { overall, entries, degraded };
}

export function resetFrontierRuntimeHealth(): void {
  health.clear();
}

export const FRONTIER_WORKER_REQUEST_TIMEOUT_MS = 8_000;
