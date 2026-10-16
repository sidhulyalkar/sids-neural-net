import type { PnCounter } from './meshSync';

export function pnCounterValueExcludingActor(counter: PnCounter, actorId: string): number {
  let positive = 0;
  let negative = 0;
  for (const [actor, value] of Object.entries(counter.positive)) {
    if (actor !== actorId && Number.isFinite(value)) positive += value;
  }
  for (const [actor, value] of Object.entries(counter.negative)) {
    if (actor !== actorId && Number.isFinite(value)) negative += value;
  }
  return positive - negative;
}

/**
 * Peer evidence is a prior, not a replacement for explicit feedback on the
 * current browser. Keep each reconciliation step conservative so a large
 * history imported from another device cannot abruptly rotate local taste.
 */
export function boundedPeerEngagementDelta(currentRemoteValue: number, appliedRemoteValue: number): number {
  if (!Number.isFinite(currentRemoteValue) || !Number.isFinite(appliedRemoteValue)) return 0;
  return Math.max(-1.5, Math.min(1.5, (currentRemoteValue - appliedRemoteValue) * 0.35));
}
