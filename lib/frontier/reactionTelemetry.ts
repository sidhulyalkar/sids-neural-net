import type { FrontierAmbientReactionKind } from './reaction';

export const FRONTIER_REACTION_OBSERVATION_EVENT = 'frontier:reaction-observation';
export const FRONTIER_REACTION_REVIEW_EVENT = 'frontier:reaction-review';

export type FrontierReactionObservationTelemetry = {
  episodeId: string;
  kind: FrontierAmbientReactionKind;
  confidence: number;
  intensity: number;
  occurredAt: number;
};

export type FrontierReactionReviewTelemetry = {
  episodeId: string;
  kind: FrontierAmbientReactionKind;
  confirmed: boolean;
  reviewedAt: number;
};

export function emitFrontierReactionObservation(detail: FrontierReactionObservationTelemetry): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FRONTIER_REACTION_OBSERVATION_EVENT, { detail }));
}

export function emitFrontierReactionReview(detail: FrontierReactionReviewTelemetry): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FRONTIER_REACTION_REVIEW_EVENT, { detail }));
}
