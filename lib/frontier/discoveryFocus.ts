import { aggregatePreference } from './behavior';
import { positiveLiteralPairEvidence, type FrontierPairEvidenceIndex } from './pairEvidence';
import { FRONTIER_DISCOVERY_SEEDS } from './personalTaste';
import type { FrontierSessionIntent } from './sessionIntent';
import type { FrontierBehaviorModel, FrontierProfile } from './types';

const TOPIC_ALIASES: Record<string, string> = {
  mtb: 'mountain biking',
  climbing: 'rock climbing',
  'rock climbing': 'rock climbing',
  'mountain biking': 'mountain biking',
  'skate progression': 'skateboarding',
  patriots: 'new england patriots',
  warriors: 'golden state warriors',
  chelsea: 'chelsea fc',
  mcfc: 'manchester city',
  neuroai: 'neuroai neuroscience',
  'bass music': 'dubstep bass music',
  'open source': 'open source machine learning',
};

const FACET_SEARCH_TERMS: Record<string, string> = {
  'open-source': 'open source',
  analysis: 'analysis',
  'motion-science': 'biomechanics',
  telemetry: 'telemetry',
  visualization: 'visualization',
  simulation: 'simulation',
  technique: 'technique',
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
const SEMANTIC_PAIR_PREFIX = /^(?:topic|domain|facet):/;

/**
 * Cross-interest probes deliberately describe intersections instead of adding
 * more standalone hobbies. They consume the same bounded focus budget as the
 * existing adaptive discovery path, so richer retrieval does not mean more
 * network fanout.
 */
export const FRONTIER_CONNECTION_DISCOVERY_SEEDS = [
  'game development open source',
  'sports analytics open source',
  'skateboarding pose estimation',
  'mountain biking telemetry',
  'rock climbing biomechanics',
  'disc golf simulation',
  'scientific visualization game',
  'music visualization code',
] as const;

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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotate<T>(values: readonly T[], start: number): T[] {
  if (!values.length) return [];
  return Array.from({ length: values.length }, (_, index) => values[(start + index) % values.length]);
}

function rotatedDiscoverySeeds(now: Date): string[] {
  const dayKey = now.toISOString().slice(0, 10);
  const tasteStart = hashString(`${dayKey}-frontier-taste`) % FRONTIER_DISCOVERY_SEEDS.length;
  const connectionStart = hashString(`${dayKey}-frontier-connections`) % FRONTIER_CONNECTION_DISCOVERY_SEEDS.length;
  const taste = rotate(FRONTIER_DISCOVERY_SEEDS, tasteStart).map(normalizeTopic);
  const connections = rotate(FRONTIER_CONNECTION_DISCOVERY_SEEDS, connectionStart).map(normalizeTopic);
  return [connections[0], ...taste, ...connections.slice(1)].filter(Boolean);
}

function overlapsExisting(selected: readonly string[], topic: string): boolean {
  return selected.some((existing) => existing.includes(topic) || topic.includes(existing));
}

function hasBehaviorEvidence(behavior?: FrontierBehaviorModel): boolean {
  const snapshot = behavior?.rankingSnapshot;
  if (!snapshot) return false;
  return Object.keys(snapshot.topicStats).length > 0
    || Object.keys(snapshot.laneStats).length > 0
    || Object.keys(snapshot.sourceStats).length > 0
    || Object.keys(snapshot.formatStats).length > 0;
}

function pairQuery(pair: string): string | undefined {
  const rawParts = pair.split(' × ').map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (rawParts.some((part) => SEMANTIC_PAIR_PREFIX.test(part))) return undefined;
  const parts = rawParts.map(normalizeTopic);
  if (parts.length !== 2 || parts[0] === parts[1]) return undefined;
  if (parts.some((part) => GENERIC.has(part))) return undefined;
  if (parts[0].includes(parts[1]) || parts[1].includes(parts[0])) return undefined;
  return `${parts[0]} ${parts[1]}`.slice(0, 64);
}

function learnedConnectionTopics(
  profile: FrontierProfile,
  pairEvidence?: FrontierPairEvidenceIndex,
): Array<[string, number]> {
  const learned = new Map<string, number>();

  // Evidence-backed intersections own acquisition once history can support or
  // contradict them. Confidence and agreement are required before a bridge can
  // spend a network search slot.
  if (pairEvidence) {
    for (const evidence of positiveLiteralPairEvidence(pairEvidence).slice(0, 16)) {
      const topic = pairQuery(evidence.key);
      if (!topic) continue;
      learned.set(topic, Math.max(learned.get(topic) ?? -Infinity, evidence.affinity + evidence.confidence * 0.18 + 0.08));
    }
  }

  // Legacy scalar memory remains a compatibility fallback for old saves,
  // expansions, and backups. If the history ledger contains any evidence for a
  // pair, even contradictory evidence, that ledger owns the decision and the
  // stale scalar cannot resurrect the query.
  for (const [pair, affinity] of Object.entries(profile.interestPairs)) {
    if (!Number.isFinite(affinity) || affinity <= 0.08) continue;
    if (pairEvidence?.has(pair)) continue;
    const topic = pairQuery(pair);
    if (!topic) continue;
    learned.set(topic, Math.max(learned.get(topic) ?? -Infinity, affinity + 0.1));
  }

  return Array.from(learned.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12);
}

/**
 * One high-confidence current-session intersection may replace one ordinary
 * learned focus slot. It never increases the focus cap, never consumes the
 * explicit seed reserve, and disappears as session confidence decays.
 */
function sessionDiscoveryFocus(intent?: FrontierSessionIntent): string | undefined {
  if (!intent || intent.confidence < 0.28 || !intent.dominantTopicIds.length) return undefined;
  const topic = normalizeTopic(intent.dominantTopicIds[0]);
  if (!topic || GENERIC.has(topic)) return undefined;
  const facet = intent.dominantFacets
    .map((value) => FACET_SEARCH_TERMS[value])
    .find(Boolean);
  return `${topic}${facet ? ` ${facet}` : ''}`.slice(0, 64);
}

export function buildDiscoveryFocus(
  profile: FrontierProfile,
  behavior?: FrontierBehaviorModel,
  limit = 7,
  now = new Date(),
  pairEvidence?: FrontierPairEvidenceIndex,
  sessionIntent?: FrontierSessionIntent,
): string[] {
  if (profile.meaningfulInteractions <= 0 && !hasBehaviorEvidence(behavior)) return [];

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

  for (const [topic, score] of learnedConnectionTopics(profile, pairEvidence)) {
    scores.set(topic, Math.max(scores.get(topic) ?? -Infinity, score));
  }

  const ranked = Array.from(scores.entries())
    .filter(([, score]) => Number.isFinite(score) && score > 0.08)
    .sort((a, b) => b[1] - a[1]);

  const cap = Math.max(1, Math.min(10, limit));
  const seedReserve = Math.min(cap, profile.meaningfulInteractions < 20 ? 3 : 2);
  const learnedCap = Math.max(0, cap - seedReserve);
  const selected: string[] = [];
  const activeSession = sessionDiscoveryFocus(sessionIntent);

  // Current intent gets at most one seat inside the learned portion. This is a
  // retrieval hint, not a quota in the visible slate.
  if (activeSession && learnedCap > 0) selected.push(activeSession);

  for (const [topic] of ranked) {
    if (selected.length >= learnedCap) break;
    if (overlapsExisting(selected, topic)) continue;
    selected.push(topic.slice(0, 64));
  }

  for (const topic of rotatedDiscoverySeeds(now)) {
    if (selected.length >= cap) break;
    if (overlapsExisting(selected, topic)) continue;
    selected.push(topic.slice(0, 64));
  }

  for (const [topic] of ranked) {
    if (selected.length >= cap) break;
    if (overlapsExisting(selected, topic)) continue;
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
