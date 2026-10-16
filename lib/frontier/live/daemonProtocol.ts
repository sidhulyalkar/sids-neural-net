import type { FrontierItem, FrontierSourceStatus } from '../types';

export type FrontierDaemonConfig = {
  focusSignature: string;
  visible: boolean;
  lastActivityAt: number;
  excludeSignatures: string[];
};

export type FrontierDaemonPollReason = 'manual' | 'manual-refresh' | 'near-end' | 'visibility';

export type FrontierDaemonRequest =
  | { type: 'configure'; config: FrontierDaemonConfig }
  | { type: 'activity'; at: number; visible: boolean }
  | { type: 'poll-now'; reason: FrontierDaemonPollReason }
  | { type: 'stop' };

export type FrontierDaemonStatus = {
  leader: boolean;
  polling: boolean;
  lastPollAt?: number;
  nextPollAt?: number;
  consecutiveFailures: number;
  consecutiveEmpty: number;
  mode: 'web-lock' | 'single-worker-fallback';
};

export type FrontierDaemonResponse =
  | { type: 'status'; status: FrontierDaemonStatus }
  | { type: 'fresh'; items: FrontierItem[]; generatedAt: string; sources: FrontierSourceStatus[] }
  | { type: 'error'; message: string };
