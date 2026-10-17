import { frontierAcquisitionFromQuery, mergeFrontierAcquisition } from './acquisitionProvenance';
import { FRONTIER_SOURCE_WEIGHTS } from './config';
import { classifyFrontierLane } from './sources';
import { assessFrontierHost } from './sourceTrust';
import type { FrontierFeedResponse, FrontierItem, FrontierLaneId, FrontierMedia } from './types';

const USER_AGENT = 'sids-neural-net-frontier/2.0 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;

type GdeltArticle = {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

type GdeltPayload = { articles?: GdeltArticle[] };

type AdaptiveOpenAlexWork = {
  id?: string;
  display_name?: string;
  title?: string;
  doi?: string | null;
  publication_date?: string;
  cited_by_count?: number;
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string } | null } | null;
  open_access?: { oa_url?: string | null };
  authorships?: Array<{ author?: { display_name?: string } }>;
  topics?: Array<{ display_name?: string; score?: number }>;
};

type AdaptiveGithubRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description?: string | null;
  pushed_at?: string;
  updated_at?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string | null;
  topics?: string[];
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function stableId(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseGdeltDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const compact = value.replace(/[^0-9]/g, '');
  if (compact.length >= 14) {
    const parsed = new Date(`${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(8, 10)}:${compact.slice(10, 12)}:${compact.slice(12, 14)}Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function sourceHost(url: string, fallback = ''): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return fallback; }
}

function liveScores(publishedAt: string, quality: number, relevance = 0.75) {
  const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / 1.8);
  const importance = clamp(0.42 + relevance * 0.24 + quality * 0.12);
  const novelty = clamp(0.58 + freshness * 0.18);
  const momentum = clamp(0.42 + freshness * 0.36);
  const baseScore = clamp(importance * 0.28 + quality * 0.3 + momentum * 0.15 + freshness * 0.19 + novelty * 0.08);
  return { importance, novelty, momentum, quality, baseScore };
}

async function fetchJson<T>(url: string, headers: HeadersInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_500);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function laneForTopic(topic: string, articleTitle = ''): FrontierLaneId {
  return classifyFrontierLane(`${topic} ${articleTitle}`);
}

export function parseGdeltArticles(payload: GdeltPayload, topic: string): FrontierItem[] {
  const perDomain = new Map<string, number>();
  return (payload.articles ?? []).flatMap((article) => {
    if (!article.url || !article.title) return [];
    const domain = article.domain || sourceHost(article.url, 'web');
    const count = perDomain.get(domain) ?? 0;
    if (count >= 2) return [];
    perDomain.set(domain, count + 1);

    const publishedAt = parseGdeltDate(article.seendate);
    const lane = laneForTopic(topic, article.title);
    // GDELT does discovery, not source certification. Use the same publisher
    // registry as the server feed gate so scoring and admission cannot drift.
    const trust = assessFrontierHost(domain).score;
    const quality = clamp(trust * (FRONTIER_SOURCE_WEIGHTS.gdelt ?? 1));
    const relevance = article.title.toLowerCase().includes(topic.toLowerCase()) ? 0.92 : 0.72;
    const media: FrontierMedia | undefined = article.socialimage?.startsWith('http')
      ? { type: 'image', url: article.socialimage, alt: article.title, aspectRatio: 'landscape' }
      : undefined;
    return [{
      id: `gdelt-${stableId(article.url)}`,
      title: article.title.trim(),
      summary: '',
      url: article.url,
      source: domain,
      sourceLabel: domain,
      sourceKind: 'gdelt' as const,
      publishedAt,
      lane,
      tags: Array.from(new Set([topic.toLowerCase(), lane.replaceAll('_', ' '), 'live web'])),
      media,
      metrics: [
        { label: 'source quality', value: trust >= 0.9 ? 'high' : trust >= 0.8 ? 'strong' : 'standard' },
        ...(article.sourcecountry ? [{ label: 'source', value: article.sourcecountry }] : []),
      ],
      ...liveScores(publishedAt, quality, relevance),
      why: `Live web discovery for ${topic}; publisher trust and recency are included in ranking.`,
    }];
  });
}

async function gdeltTopic(topic: string): Promise<FrontierItem[]> {
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', `"${topic.replace(/"/g, '')}"`);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', '12');
  url.searchParams.set('timespan', '48h');
  url.searchParams.set('sort', 'datedesc');
  const payload = await fetchJson<GdeltPayload>(url.toString());
  return parseGdeltArticles(payload, topic);
}

function isResearchFocus(topic: string): boolean {
  const lane = classifyFrontierLane(topic);
  return ['ml_data', 'ai_frontier', 'neuro_frontier', 'methods', 'broad_science', 'competitions'].includes(lane);
}

export function parseAdaptiveOpenAlexWorks(
  results: AdaptiveOpenAlexWork[],
  topic: string,
): FrontierItem[] {
  const acquisition = frontierAcquisitionFromQuery('openalex-adaptive-search', topic);
  return results.flatMap((work) => {
    const title = work.display_name || work.title;
    if (!work.id || !title) return [];
    const publishedAt = work.publication_date ? new Date(`${work.publication_date}T12:00:00Z`).toISOString() : new Date().toISOString();
    const sourceLabel = work.primary_location?.source?.display_name || 'OpenAlex';
    const target = work.open_access?.oa_url || work.primary_location?.landing_page_url || work.doi || work.id;
    const citations = work.cited_by_count ?? 0;
    const lane = laneForTopic(topic, title);
    const quality = clamp(0.78 * (FRONTIER_SOURCE_WEIGHTS.openalex ?? 1));
    return [{
      id: `oa-live-${stableId(work.id)}`,
      title,
      summary: '',
      url: target,
      source: sourceHost(target, 'openalex.org'),
      sourceLabel,
      sourceKind: 'openalex' as const,
      publishedAt,
      lane,
      acquisition,
      tags: Array.from(new Set([topic.toLowerCase(), lane.replaceAll('_', ' '), ...(work.topics ?? []).slice(0, 3).flatMap((entry) => entry.display_name ? [entry.display_name.toLowerCase()] : [])])),
      authors: (work.authorships ?? []).slice(0, 5).flatMap((entry) => entry.author?.display_name ? [entry.author.display_name] : []),
      metrics: [{ label: 'citations', value: String(citations) }],
      ...liveScores(publishedAt, quality, 0.9),
      why: `Fresh scholarly search matching ${topic}.`,
    }];
  });
}

async function openAlexTopic(topic: string): Promise<FrontierItem[]> {
  const from = new Date(Date.now() - 12 * DAY_MS).toISOString().slice(0, 10);
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', topic);
  url.searchParams.set('filter', `from_publication_date:${from}`);
  url.searchParams.set('sort', 'publication_date:desc,cited_by_count:desc');
  url.searchParams.set('per-page', '5');
  if (process.env.OPENALEX_EMAIL) url.searchParams.set('mailto', process.env.OPENALEX_EMAIL);
  if (process.env.OPENALEX_API_KEY) url.searchParams.set('api_key', process.env.OPENALEX_API_KEY);
  const payload = await fetchJson<{ results?: AdaptiveOpenAlexWork[] }>(url.toString());
  return parseAdaptiveOpenAlexWorks(payload.results ?? [], topic);
}

const BUILDER_BRIDGE_INTEREST = /\b(?:skate(?:board|boarding)?|mountain bik(?:e|ing)|mtb|rock climb(?:ing)?|boulder(?:ing)?|disc golf|sports?|game development|gaming|music)\b/i;
const BUILDER_BRIDGE_METHOD = /\b(?:open source|github|code|analytics?|analysis|computer vision|pose estimation|telemetry|gps|biomechanics|kinematics|simulation|physics|visuali[sz]ation|creative coding|dataset|tracking)\b/i;

export function isCrossInterestBuilderFocus(topic: string): boolean {
  return BUILDER_BRIDGE_INTEREST.test(topic) && BUILDER_BRIDGE_METHOD.test(topic);
}

export function isBuilderDiscoveryFocus(topic: string): boolean {
  const lane = classifyFrontierLane(topic);
  return ['ml_data', 'ai_frontier', 'neuro_frontier', 'methods', 'builder_signal', 'creative_tech', 'competitions'].includes(lane)
    || isCrossInterestBuilderFocus(topic);
}

async function githubTopic(topic: string): Promise<FrontierItem[]> {
  const since = new Date(Date.now() - 12 * DAY_MS).toISOString().slice(0, 10);
  const q = `${topic} pushed:>=${since}`;
  const token = process.env.FRONTIER_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=5`;
  const payload = await fetchJson<{ items?: AdaptiveGithubRepo[] }>(url, headers);
  return (payload.items ?? []).flatMap((repo) => {
    if (!repo.id || !repo.full_name || !repo.html_url) return [];
    const publishedAt = repo.pushed_at || repo.updated_at || new Date().toISOString();
    const stars = repo.stargazers_count ?? 0;
    const quality = clamp((0.62 + Math.min(0.25, Math.log10(stars + 1) / 16)) * (FRONTIER_SOURCE_WEIGHTS.github ?? 1));
    const lane = laneForTopic(topic, `${repo.full_name} ${repo.description ?? ''}`);
    return [{
      id: `gh-live-${repo.id}`,
      title: repo.full_name,
      summary: repo.description?.trim() || '',
      url: repo.html_url,
      source: 'github.com',
      sourceLabel: 'GitHub',
      sourceKind: 'github' as const,
      publishedAt,
      lane,
      tags: Array.from(new Set([topic.toLowerCase(), ...(repo.topics ?? []).slice(0, 4), ...(repo.language ? [repo.language.toLowerCase()] : [])])),
      metrics: [
        { label: 'stars', value: stars.toLocaleString() },
        { label: 'forks', value: String(repo.forks_count ?? 0) },
      ],
      ...liveScores(publishedAt, quality, 0.84),
      why: `Fresh open-source search matching ${topic}.`,
    }];
  });
}

export function dedupeFrontierLiveItems(items: FrontierItem[]): FrontierItem[] {
  const seen = new Map<string, FrontierItem>();
  for (const item of items) {
    const key = item.url.toLowerCase().replace(/[?#].*$/, '');
    const existing = seen.get(key);
    if (existing) {
      existing.acquisition = mergeFrontierAcquisition(existing.acquisition, item.acquisition);
      continue;
    }
    seen.set(key, { ...item });
  }
  return Array.from(seen.values());
}

export async function getAdaptiveLiveDiscovery(topics: string[]): Promise<FrontierFeedResponse> {
  const focus = Array.from(new Set(topics.map((topic) => topic.trim().toLowerCase()).filter(Boolean))).slice(0, 7);
  if (!focus.length) return { generatedAt: new Date().toISOString(), items: [], sources: [] };

  const gdeltRuns = await Promise.allSettled(focus.map((topic) => gdeltTopic(topic)));
  const researchTopics = focus.filter(isResearchFocus).slice(0, 3);
  const bridgeBuilder = focus.find(isCrossInterestBuilderFocus);
  const ordinaryBuilders = focus.filter((topic) => isBuilderDiscoveryFocus(topic) && topic !== bridgeBuilder);
  // Preserve the historical maximum of two GitHub searches. One intersection
  // may take the first slot; learned/general builder interests still retain the
  // second instead of being displaced by a new source fanout.
  const builderTopics = Array.from(new Set([
    ...(bridgeBuilder ? [bridgeBuilder] : []),
    ...ordinaryBuilders,
  ])).slice(0, 2);
  const [researchRuns, builderRuns] = await Promise.all([
    Promise.allSettled(researchTopics.map((topic) => openAlexTopic(topic))),
    Promise.allSettled(builderTopics.map((topic) => githubTopic(topic))),
  ]);

  const gdeltItems = gdeltRuns.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const researchItems = researchRuns.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const builderItems = builderRuns.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const items = dedupeFrontierLiveItems([...researchItems, ...builderItems, ...gdeltItems])
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 72);

  const failedGdelt = gdeltRuns.filter((result) => result.status === 'rejected').length;
  const failedResearch = researchRuns.filter((result) => result.status === 'rejected').length;
  const failedBuilder = builderRuns.filter((result) => result.status === 'rejected').length;

  return {
    generatedAt: new Date().toISOString(),
    items,
    sources: [
      { id: 'gdelt', label: 'Live web', ok: gdeltItems.length > 0 || failedGdelt < gdeltRuns.length, count: gdeltItems.length, message: failedGdelt ? `${failedGdelt} focused searches degraded` : undefined },
      ...(researchTopics.length ? [{ id: 'openalex' as const, label: 'Adaptive papers', ok: researchItems.length > 0 || failedResearch < researchRuns.length, count: researchItems.length, message: failedResearch ? `${failedResearch} focused searches degraded` : undefined }] : []),
      ...(builderTopics.length ? [{ id: 'github' as const, label: 'Adaptive code', ok: builderItems.length > 0 || failedBuilder < builderRuns.length, count: builderItems.length, message: failedBuilder ? `${failedBuilder} focused searches degraded` : undefined }] : []),
    ],
  };
}
