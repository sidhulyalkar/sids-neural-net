import { createInitialProfile } from './config';
import type { FrontierProfile } from './types';

/**
 * Bring an older local FRONTIER profile forward when the product's explicit
 * cold-start taste map expands.
 *
 * Existing topic values always win, including negatives, so learned dislikes
 * are never erased. New topics are only backfilled when absent. Lane defaults
 * are refreshed only while the profile is still very young; mature profiles
 * keep their learned lane shape exactly.
 */
export function migrateFrontierProfile(profile: FrontierProfile): FrontierProfile {
  const defaults = createInitialProfile();
  const mature = profile.meaningfulInteractions >= 12;

  const laneAffinity = { ...profile.laneAffinity };
  for (const [lane, seed] of Object.entries(defaults.laneAffinity)) {
    const current = laneAffinity[lane as keyof typeof laneAffinity];
    if (current === undefined) {
      laneAffinity[lane as keyof typeof laneAffinity] = seed;
    } else if (!mature && current >= -0.05) {
      laneAffinity[lane as keyof typeof laneAffinity] = Math.max(current, seed);
    }
  }

  const topicAffinity = { ...profile.topicAffinity };
  for (const [topic, seed] of Object.entries(defaults.topicAffinity)) {
    if (topicAffinity[topic] === undefined) topicAffinity[topic] = seed;
  }

  return {
    ...profile,
    laneAffinity,
    topicAffinity,
    sourceAffinity: { ...(profile.sourceAffinity ?? {}) },
    interestPairs: { ...(profile.interestPairs ?? {}) },
    knownTopics: { ...(profile.knownTopics ?? {}) },
    curiosity: Number.isFinite(profile.curiosity) ? profile.curiosity : defaults.curiosity,
    meaningfulInteractions: Number.isFinite(profile.meaningfulInteractions)
      ? Math.max(0, profile.meaningfulInteractions)
      : 0,
  };
}
