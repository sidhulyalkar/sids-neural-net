import type { FrontierProfile } from './types';

export type GoogleSubscriptionSignal = {
  channelId: string;
  title: string;
};

export type GoogleLikedVideoSignal = {
  videoId: string;
  title: string;
  channelTitle?: string;
};

export type FrontierPreferenceImport = {
  provider: 'google-youtube';
  importedAt: string;
  topics: Array<{ key: string; weight: number }>;
  sourceAffinity: Record<string, number>;
  summary: {
    subscriptions: number;
    likedVideos: number;
    learnedTopics: number;
  };
};

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'and', 'are', 'because', 'been', 'before', 'being', 'best',
  'but', 'can', 'channel', 'could', 'did', 'does', 'doing', 'from', 'full', 'have', 'here', 'into', 'just',
  'like', 'more', 'most', 'new', 'official', 'only', 'our', 'out', 'over', 'part', 'review', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'through', 'today', 'video', 'what', 'when',
  'where', 'which', 'with', 'would', 'your', 'you', 'feat', 'ft', 'live', 'episode', 'ep', 'shorts',
]);

const ALIASES: Record<string, string> = {
  'man city': 'manchester city',
  mcfc: 'manchester city',
  'chelsea fc': 'chelsea',
  'new england patriots': 'patriots',
  'golden state warriors': 'warriors',
  mtb: 'mountain biking',
  bci: 'brain computer interface',
  edm: 'electronic music',
};

function clean(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9+.#&' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonical(value: string): string {
  const normalized = clean(value);
  return ALIASES[normalized] ?? normalized;
}

function titleTerms(value: string): string[] {
  const words = clean(value)
    .split(' ')
    .map((word) => word.replace(/^['-]+|['-]+$/g, ''))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
  const terms = new Set<string>();
  for (const word of words) terms.add(canonical(word));
  for (let index = 0; index < words.length - 1; index += 1) {
    const phrase = `${words[index]} ${words[index + 1]}`;
    if (phrase.length <= 42) terms.add(canonical(phrase));
  }
  return Array.from(terms).filter((term) => term.length >= 3);
}

function addScore(scores: Map<string, number>, key: string, delta: number): void {
  const normalized = canonical(key);
  if (!normalized || normalized.length > 56 || STOPWORDS.has(normalized)) return;
  scores.set(normalized, Math.min(0.34, (scores.get(normalized) ?? 0) + delta));
}

export function deriveGooglePreferenceImport(
  subscriptions: GoogleSubscriptionSignal[],
  likedVideos: GoogleLikedVideoSignal[],
  now = new Date()
): FrontierPreferenceImport {
  const scores = new Map<string, number>();

  for (const subscription of subscriptions.slice(0, 250)) {
    addScore(scores, subscription.title, 0.055);
    for (const term of titleTerms(subscription.title).slice(0, 4)) addScore(scores, term, 0.012);
  }

  for (const video of likedVideos.slice(0, 200)) {
    if (video.channelTitle) addScore(scores, video.channelTitle, 0.035);
    for (const term of titleTerms(video.title).slice(0, 8)) addScore(scores, term, 0.018);
  }

  const topics = Array.from(scores.entries())
    .map(([key, weight]) => ({ key, weight: Number(weight.toFixed(4)) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 72);

  return {
    provider: 'google-youtube',
    importedAt: now.toISOString(),
    topics,
    sourceAffinity: { youtube: 0.18 },
    summary: {
      subscriptions: subscriptions.length,
      likedVideos: likedVideos.length,
      learnedTopics: topics.length,
    },
  };
}

export function applyPreferenceImportToProfile(
  profile: FrontierProfile,
  preferenceImport: FrontierPreferenceImport
): FrontierProfile {
  const topicAffinity = { ...profile.topicAffinity };
  for (const topic of preferenceImport.topics) {
    const key = canonical(topic.key);
    if (!key) continue;
    topicAffinity[key] = Math.max(-0.8, Math.min(1.4, (topicAffinity[key] ?? 0) + topic.weight));
  }
  const sourceAffinity = { ...profile.sourceAffinity };
  for (const [source, weight] of Object.entries(preferenceImport.sourceAffinity)) {
    sourceAffinity[source] = Math.max(-0.5, Math.min(0.8, (sourceAffinity[source] ?? 0) + weight));
  }
  return {
    ...profile,
    topicAffinity,
    sourceAffinity,
    meaningfulInteractions: profile.meaningfulInteractions + Math.min(12, Math.ceil(preferenceImport.topics.length / 6)),
  };
}
