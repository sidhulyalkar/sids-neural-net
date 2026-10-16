import { applyAmbientBehaviorEvent } from './ambientBehavior';
import type { FrontierAmbientReaction } from './reaction';
import { useFrontierStore } from './store';
import type { FrontierItem } from './types';

function apply(item: FrontierItem, reaction: FrontierAmbientReaction, kind: 'ambient_reaction' | 'ambient_retraction'): boolean {
  const current = useFrontierStore.getState();
  const next = applyAmbientBehaviorEvent(current.behavior, item, {
    kind,
    ambientReaction: reaction.kind,
    confidence: reaction.confidence,
    intensity: reaction.intensity,
    durationMs: reaction.durationMs,
  });
  if (next === current.behavior) return false;
  useFrontierStore.setState({ behavior: next });
  return true;
}

/**
 * Passive cue admission is deliberately separate from FrontierStore's explicit
 * interaction methods. The caller must first apply inference, attribution and
 * trust gates before reaching this boundary.
 */
export function admitAmbientReaction(item: FrontierItem, reaction: FrontierAmbientReaction): boolean {
  return apply(item, reaction, 'ambient_reaction');
}

/**
 * Exact compensating debit for an already-admitted passive cue. Retraction stays
 * available even if implicit learning has since been disabled.
 */
export function retractAmbientReaction(item: FrontierItem, reaction: FrontierAmbientReaction): boolean {
  return apply(item, reaction, 'ambient_retraction');
}
