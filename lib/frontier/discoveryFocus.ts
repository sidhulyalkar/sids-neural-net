import { aggregatePreference } from './behavior';
import type { FrontierBehaviorModel, FrontierProfile } from './types';

const TOPIC_ALIASES: Record<string, string> = {
  mtb: 'mountain biking',
  climbing: 'rock climbing',
  patriots: 'new england patriots',
  warriors: 'golden state warriors',
  chelsea: 'chelsea fc',
  mcfc: 'manchester city',
  neuroai: 'neuroai neuroscience',
  'bass music': 'dubstep bass music',
  'open source': 'open source machine learning',
};

const GENERIC = new Set([
  'active sport',
  'active sports',
  'sports',
  'discussion',
  'reddit',
  'steam',
  'video',
  'highlight',
  'release',
  'wildcards',
  'world pulse',
]);

function normalizeTopic(value: string): string {
  const cleaned = value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return TOPIC_ALIASES[cleaned] ?? cleaned;
}

function behaviorScore(model: FrontierBehaviorModel | undefined, topic: string): number {
  if (!model?.rankingSnapshot) return 0;
  const direct = aggregatePreference(model.rankingSnapshot.topicStats[topic]);
  if (direct.confidence > 0) return direct.score * direct.confidence;

  const alias = Object.entries(TOPIC_ALIASES).find(([, canonical]) => canonical === topic)?.[0];
  if (!alias) return 0;
  const aliased = aggregatePreference(model.rankingSnapshot.topicStats[alias]);
  return aliased.score * aliased.confidence;
}

export function buildDiscoveryFocus(
  profile: FrontierProfile,
  behavior?: FrontierBehaviorModel,
  limit = 7
): string[] {
  const scores = new Map<string, number>();

  for (const [rawTopic, affinity] of Object.entries(profile.topicAffinity)) {
    const topic = normalizeTopic(rawTopic);
    if (!topic || GENERIC.has(topic) || affinity <= -0.15) continue;
    const knownPenalty = Math.max(0, profile.knownTopics[rawTopic] ?? profile.knownTopics[topic] ?? 0) * 0.12;
    const preference = behaviorScore(behavior, rawTopic) || behaviorScore(behavior, topic);
    const exposure = behavior?.topicStats[rawTopic]?.shown ?? behavior?.topicStats[topic]?.shown ?? 0;
    const underexposedBonus = exposure < 3 ? 0.05 : 0;
    const score = affinity + preference * 0.8 + underexposedBonus - knownPenalty;
    scores.set(topic, Math.max(scores.get(topic) ?? -Infinity, score));
  }

  if (behavior?.rankingSnapshot) {
    for (const [rawTopic, aggregate] of Object.entries(behavior.rankingSnapshot.topicStats)) {
      const topic = normalizeTopic(rawTopic);
      if (!topic || GENERIC.has(topic)) continue;
      const preference = aggregatePreference(aggregate);
      if (preference.confidence < 0.22 || preference.score <= 0.08) continue;
      const score = preference.score * preference.confidence * 0.9 + (profile.topicAffinity[rawTopic] ?? 0);
      scores.set(topic, Math.max(scores.get(topic) ?? -Infinity, score));
    }
  }

  const ranked = Array.from(scores.entries())
    .filter(([, score]) => Number.isFinite(score) && score > 0.08)
    .sort((a, b) => b[1] - a[1]);

  const selected: string[] = [];
  for (const [topic] of ranked) {
    if (selected.length >= Math.max(1, Math.min(10, limit))) break;
    if (selected.some((existing) => existing.includes(topic) || topic.includes(existing))) continue;
    selected.push(topic.slice(0, 64));
  }

  return selected;
}

export function encodeDiscoveryFocus(topics: string[]): string {
  return topics
    .slice(0, 10)
    .map((topic) => normalizeTopic(topic).replace(/[^a-z0-9 +.'-]/g, '').slice(0, 64))
    .filter(Boolean)
    .join('|');
}

export function decodeDiscoveryFocus(value: string | null): string[] {
  if (!value) return [];
  return Array.from(new Set(value
    .split('|')
    .map((topic) => normalizeTopic(topic).replace(/[^a-z0-9 +.'-]/g, '').trim().slice(0, 64))
    .filter((topic) => topic.length >= 2)))
    .slice(0, 10);
}
