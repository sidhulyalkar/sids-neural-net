export const FRONTIER_LIVE_DAEMON_LOCK = 'frontier_live_daemon';

export type FrontierLockManagerLike = {
  request(
    name: string,
    options: { mode: 'exclusive'; signal?: AbortSignal },
    callback: (lock: unknown) => Promise<void> | void
  ): Promise<void>;
};

export type FrontierDaemonCadenceInput = {
  visible: boolean;
  activeRecently: boolean;
  consecutiveEmpty: number;
  consecutiveFailures: number;
};

export function frontierDaemonPollInterval(input: FrontierDaemonCadenceInput): number {
  const base = input.visible
    ? input.activeRecently ? 45_000 : 120_000
    : 300_000;
  const emptyMultiplier = 1 + Math.min(3, Math.max(0, input.consecutiveEmpty)) * 0.35;
  const failureMultiplier = Math.pow(2, Math.min(3, Math.max(0, input.consecutiveFailures)));
  return Math.min(10 * 60_000, Math.round(base * emptyMultiplier * failureMultiplier));
}

/**
 * The callback retains the exclusive origin-scoped Web Lock until it settles.
 * Waiting contenders are aborted cleanly when their tab/worker is torn down.
 */
export async function runFrontierDaemonLeadership(
  lockManager: FrontierLockManagerLike,
  signal: AbortSignal,
  runLeader: (signal: AbortSignal) => Promise<void>
): Promise<void> {
  if (signal.aborted) return;
  try {
    await lockManager.request(
      FRONTIER_LIVE_DAEMON_LOCK,
      { mode: 'exclusive', signal },
      async () => {
        if (!signal.aborted) await runLeader(signal);
      }
    );
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
    throw error;
  }
}
