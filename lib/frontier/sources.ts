import { FRONTIER_IMPORTANCE_TERMS, FRONTIER_LANES, FRONTIER_SOURCE_WEIGHTS } from './config';
import type {
  FrontierFeedResponse,
  FrontierItem,
  FrontierLaneId,
  FrontierMedia,
  FrontierSourceKind,
  FrontierSourceStatus,
} from './types';

const USER_AGENT = 'sids-neural-net-frontier/1.0 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;

type SourceRun = { items: FrontierItem[]; status: FrontierSourceStatus };

type HNItem = {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
};

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  owner?: { login?: string; avatar_url?: string };
};

type OpenAlexWork = {
  id: string;
  title?: string;
  doi?: string | null;
  publication_date?: string;
  cited_by_count?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string } | null;
  } | null;
  open_access?: { oa_url?: string | null };
  topics?: Array<{ display_name?: string; score?: number }>;
  abstract_inverted_index?: Record<string, number[]>;
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  profile?: { long_name?: string };
  thumbnail?: { src?: string };
  video?: { duration?: string };
};

type FootballMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  homeTeam?: { name?: string; shortName?: string };
  awayTeam?: { name?: string; shortName?: string };
  score?: { fullTime?: { home?: number | null; away?: number | null } };
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

function cleanText(value: string | undefined | null): string {
  if (!value) return '';
  return decodeXml(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function summarize(value: string, maxLength = 300): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 180 ? boundary : maxLength).trim()}…`;
}

function abstractFromIndex(index?: Record<string, number[]>): string {
  if (!index) return '';
  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words.push({ word, position });
  }
  return words.sort((a, b) => a.position - b.position).map((entry) => entry.word).join(' ');
}

function keywordScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((score, keyword) => score + (lower.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

export function classifyFrontierLane(text: string): FrontierLaneId {
  const lower = text.toLowerCase();
  let best: { lane: FrontierLaneId; score: number } = { lane: 'wildcards', score: 0 };

  for (const lane of FRONTIER_LANES) {
    if (lane.id === 'must_know' || lane.id === 'wildcards') continue;
    const score = keywordScore(lower, lane.keywords) * lane.weight;
    if (score > best.score) best = { lane: lane.id, score };
  }

  return best.score > 0 ? best.lane : 'wildcards';
}

function inferTags(text: string, lane: FrontierLaneId, extra: string[] = []): string[] {
  const lower = text.toLowerCase();
  const laneTerms = FRONTIER_LANES.find((candidate) => candidate.id === lane)?.keywords ?? [];
  const matched = laneTerms.filter((term) => lower.includes(term.toLowerCase())).slice(0, 5);
  return Array.from(new Set([...matched, ...extra.map((tag) => tag.toLowerCase()), lane.replaceAll('_', ' ')]))
    .filter(Boolean)
    .slice(0, 8);
}

function scoreItem(
  text: string,
  sourceKind: FrontierSourceKind,
  publishedAt: string,
  rawMomentum = 0.45,
  rawQuality = 0.65
) {
  const lower = text.toLowerCase();
  const importanceHits = FRONTIER_IMPORTANCE_TERMS.filter((term) => lower.includes(term)).length;
  const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / 5);
  const importance = clamp(0.38 + importanceHits * 0.095 + rawMomentum * 0.16);
  const quality = clamp(rawQuality * (FRONTIER_SOURCE_WEIGHTS[sourceKind] ?? 1));
  const momentum = clamp(rawMomentum);
  const novelty = clamp(0.5 + Math.min(0.22, importanceHits * 0.025) + (sourceKind === 'github' ? 0.08 : 0));
  const baseScore = clamp(importance * 0.31 + quality * 0.27 + momentum * 0.16 + freshness * 0.18 + novelty * 0.08);
  return { importance, quality, momentum, novelty, baseScore };
}

async function fetchJson<T>(url: string, init: RequestInit & { next?: { revalidate?: number } } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 15 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function runSource(
  id: FrontierSourceKind,
  label: string,
  task: () => Promise<FrontierItem[]>
): Promise<SourceRun> {
  try {
    const items = await task();
    return { items, status: { id, label, ok: true, count: items.length } };
  } catch (error) {
    return {
      items: [],
      status: {
        id,
        label,
        ok: false,
        count: 0,
        message: error instanceof Error ? error.message.slice(0, 120) : 'source unavailable',
      },
    };
  }
}

async function hackerNewsItems(): Promise<FrontierItem[]> {
  const ids = await fetchJson<number[]>('https://hacker-news.firebaseio.com/v0/topstories.json', {
    next: { revalidate: 60 * 10 },
  });
  const stories = await Promise.all(
    ids.slice(0, 12).map((id) =>
      fetchJson<HNItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { next: { revalidate: 60 * 10 } })
        .catch(() => null)
    )
  );

  return stories.flatMap((story) => {
    if (!story?.title || !story.id) return [];
    const publishedAt = new Date((story.time ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const text = `${story.title}`;
    const lane = classifyFrontierLane(text);
    const score = Math.log10(Math.max(1, story.score ?? 1)) / 3;
    const comments = Math.log10(Math.max(1, story.descendants ?? 1)) / 3;
    const scores = scoreItem(text, 'hackernews', publishedAt, clamp(score * 0.65 + comments * 0.35), 0.58);
    return [{
      id: `hn-${story.id}`,
      title: story.title,
      summary: `${story.score ?? 0} points · ${story.descendants ?? 0} comments. Community momentum is treated as a signal, not a proxy for truth.`,
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      source: 'news.ycombinator.com', sourceLabel: 'Hacker News', sourceKind: 'hackernews' as const,
      publishedAt, lane, tags: inferTags(text, lane, ['discussion']),
      metrics: [
        { label: 'points', value: String(story.score ?? 0) },
        { label: 'comments', value: String(story.descendants ?? 0) },
      ],
      ...scores,
      why: 'High-signal technical discussion with enough momentum to merit inspection.',
    }];
  });
}

async function githubItems(): Promise<FrontierItem[]> {
  const since = new Date(Date.now() - 8 * DAY_MS).toISOString().slice(0, 10);
  const queries = [
    'machine learning data analysis',
    'mechanistic interpretability agents',
    'football soccer analytics',
    'neural decoding neuroscience',
  ];
  const token = process.env.FRONTIER_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const payloads = await Promise.all(
    queries.map((query) => {
      const q = `${query} pushed:>=${since}`;
      return fetchJson<{ items?: GithubRepo[] }>(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=5`,
        { headers, next: { revalidate: 60 * 45 } }
      ).catch(() => ({ items: [] }));
    })
  );

  const seen = new Set<number>();
  return payloads.flatMap((payload) => (payload.items ?? []).flatMap((repo) => {
    if (seen.has(repo.id)) return [];
    seen.add(repo.id);
    const publishedAt = repo.pushed_at || repo.updated_at;
    const text = `${repo.name} ${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`;
    const lane = classifyFrontierLane(text);
    const momentum = clamp(Math.log10(repo.stargazers_count + 1) / 5 + Math.min(0.25, repo.forks_count / 500));
    const scores = scoreItem(text, 'github', publishedAt, momentum, 0.68);
    const media: FrontierMedia | undefined = repo.owner?.avatar_url
      ? { type: 'image', url: repo.owner.avatar_url, alt: `${repo.owner.login ?? 'GitHub'} avatar`, aspectRatio: 'landscape' }
      : undefined;
    return [{
      id: `gh-${repo.id}`,
      title: repo.full_name,
      summary: summarize(repo.description || 'Recently active open-source project worth inspecting at the source.'),
      url: repo.html_url,
      source: 'github.com', sourceLabel: 'GitHub', sourceKind: 'github' as const,
      publishedAt, lane,
      tags: inferTags(text, lane, [...(repo.topics ?? []).slice(0, 4), repo.language ?? '']),
      media,
      metrics: [
        { label: 'stars', value: repo.stargazers_count.toLocaleString() },
        { label: 'forks', value: repo.forks_count.toLocaleString() },
        ...(repo.language ? [{ label: 'language', value: repo.language }] : []),
      ],
      ...scores,
      why: 'Fresh builder signal: active code is useful evidence that an idea is becoming executable.',
    }];
  }));
}

async function openAlexItems(): Promise<FrontierItem[]> {
  const from = new Date(Date.now() - 8 * DAY_MS).toISOString().slice(0, 10);
  const queries = [
    'machine learning data analysis causal inference',
    'neural decoding brain computer interface neuroai',
    'artificial intelligence agents interpretability reasoning',
    'football soccer analytics tracking expected goals',
  ];
  const mailto = process.env.OPENALEX_EMAIL || process.env.EMAIL;

  const payloads = await Promise.all(queries.map(async (query) => {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('filter', `from_publication_date:${from}`);
    url.searchParams.set('sort', 'publication_date:desc,cited_by_count:desc');
    url.searchParams.set('per-page', '6');
    if (mailto) url.searchParams.set('mailto', mailto);
    if (process.env.OPENALEX_API_KEY) url.searchParams.set('api_key', process.env.OPENALEX_API_KEY);
    return fetchJson<{ results?: OpenAlexWork[] }>(url.toString(), { next: { revalidate: 60 * 60 } })
      .catch(() => ({ results: [] }));
  }));

  const seen = new Set<string>();
  return payloads.flatMap((payload) => (payload.results ?? []).flatMap((work) => {
    if (!work.id || !work.title || seen.has(work.id)) return [];
    seen.add(work.id);
    const publishedAt = work.publication_date ? new Date(`${work.publication_date}T12:00:00Z`).toISOString() : new Date().toISOString();
    const topics = (work.topics ?? []).filter((topic) => topic.display_name).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const abstract = abstractFromIndex(work.abstract_inverted_index);
    const text = `${work.title} ${abstract} ${topics.map((topic) => topic.display_name).join(' ')}`;
    const lane = classifyFrontierLane(text);
    const citations = work.cited_by_count ?? 0;
    const scores = scoreItem(text, 'openalex', publishedAt, clamp(0.35 + Math.log10(citations + 1) / 5), 0.82);
    const sourceName = work.primary_location?.source?.display_name || 'OpenAlex';
    return [{
      id: `oa-${stableId(work.id)}`,
      title: cleanText(work.title),
      summary: summarize(abstract || `Recent scholarly work indexed by OpenAlex. Open the primary source for methods, evidence, and limitations.`),
      url: work.open_access?.oa_url || work.primary_location?.landing_page_url || work.doi || work.id,
      source: sourceName, sourceLabel: sourceName, sourceKind: 'openalex' as const,
      publishedAt, lane,
      authors: (work.authorships ?? []).flatMap((authorship) => authorship.author?.display_name ? [authorship.author.display_name] : []).slice(0, 5),
      tags: inferTags(text, lane, topics.flatMap((topic) => topic.display_name ? [topic.display_name] : []).slice(0, 4)),
      metrics: [{ label: 'citations', value: citations.toLocaleString() }],
      ...scores,
      readMinutes: 12,
      why: 'Primary scholarly evidence close to your active technical and scientific frontier.',
    }];
  }));
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return cleanText(match?.[1] ?? '');
}

function xmlAttribute(block: string, tagPattern: string, attribute: string): string | undefined {
  const tag = block.match(new RegExp(`<${tagPattern}\\b[^>]*>`, 'i'))?.[0];
  if (!tag) return undefined;
  const match = tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'));
  return match?.[1] ? decodeXml(match[1]) : undefined;
}

export function parseFrontierRss(xml: string, sourceLabel = 'RSS'): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 18).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url) return [];
    const description = xmlTag(block, 'description') || xmlTag(block, 'content:encoded');
    const publishedRaw = xmlTag(block, 'pubDate') || xmlTag(block, 'dc:date');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw)) ? new Date().toISOString() : new Date(publishedRaw).toISOString();
    const text = `${title} ${description}`;
    const lane = classifyFrontierLane(text);
    const image = xmlAttribute(block, 'media:content|media:thumbnail|enclosure', 'url');
    const scores = scoreItem(text, 'rss', publishedAt, 0.5, 0.7);
    return [{
      id: `rss-${stableId(`${sourceLabel}-${url}-${index}`)}`,
      title,
      summary: summarize(description || 'Fresh item from a monitored specialist feed.'),
      url,
      source: sourceLabel, sourceLabel, sourceKind: 'rss' as const,
      publishedAt, lane, tags: inferTags(text, lane, [sourceLabel]),
      media: image ? { type: 'image', url: image, alt: title, aspectRatio: 'landscape' } : undefined,
      ...scores,
      why: 'Direct specialist feed signal, retained even when social ranking has not noticed it yet.',
    }];
  });
}

async function rssItems(): Promise<FrontierItem[]> {
  const defaults = ['https://www.theguardian.com/football/rss'];
  const custom = (process.env.FRONTIER_RSS_FEEDS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const feeds = Array.from(new Set([...defaults, ...custom])).slice(0, 8);
  const payloads = await Promise.all(feeds.map(async (url) => {
    const xml = await fetchText(url);
    const host = new URL(url).hostname.replace(/^www\./, '');
    return parseFrontierRss(xml, host);
  }));
  return payloads.flat();
}

async function footballItems(): Promise<FrontierItem[]> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) return [];
  const from = new Date(Date.now() - 3 * DAY_MS).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 10 * DAY_MS).toISOString().slice(0, 10);
  const payload = await fetchJson<{ matches?: FootballMatch[] }>(
    `https://api.football-data.org/v4/competitions/PL/matches?dateFrom=${from}&dateTo=${to}`,
    { headers: { 'X-Auth-Token': token }, next: { revalidate: 60 * 30 } }
  );

  return (payload.matches ?? []).slice(0, 20).map((match) => {
    const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Home';
    const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Away';
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;
    const finished = typeof homeScore === 'number' && typeof awayScore === 'number';
    const title = finished ? `${home} ${homeScore}–${awayScore} ${away}` : `${home} vs ${away}`;
    const summary = finished
      ? `Premier League · Matchweek ${match.matchday ?? '—'} · ${match.status.toLowerCase()}`
      : `Premier League · Matchweek ${match.matchday ?? '—'} · ${new Date(match.utcDate).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT`;
    const scores = scoreItem(title, 'football_data', match.utcDate, finished ? 0.72 : 0.58, 0.95);
    return {
      id: `fd-${match.id}`,
      title,
      summary,
      url: 'https://www.premierleague.com/fixtures',
      source: 'football-data.org', sourceLabel: 'Premier League data', sourceKind: 'football_data' as const,
      publishedAt: match.utcDate,
      lane: 'premier_league' as const,
      tags: ['premier league', 'fixture', finished ? 'result' : 'upcoming', home.toLowerCase(), away.toLowerCase()],
      metrics: [
        { label: 'matchweek', value: String(match.matchday ?? '—') },
        { label: 'status', value: match.status.replaceAll('_', ' ').toLowerCase() },
      ],
      ...scores,
      importance: Math.max(scores.importance, 0.62),
      why: 'Structured matchday context keeps the football radar grounded in the actual schedule.',
    };
  });
}

async function braveItems(): Promise<FrontierItem[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return [];
  const queries = [
    'Premier League tactics analytics transfers',
    'machine learning data analysis new tool benchmark',
    'neuroscience AI neural decoding research',
    'AI agents interpretability model release',
  ];
  const payloads = await Promise.all(queries.map((query) =>
    fetchJson<{ web?: { results?: BraveResult[] } }>(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&freshness=pw&text_decorations=false`,
      { headers: { 'X-Subscription-Token': token }, next: { revalidate: 60 * 60 } }
    ).catch(() => ({ web: { results: [] } }))
  ));

  const seen = new Set<string>();
  return payloads.flatMap((payload) => (payload.web?.results ?? []).flatMap((result) => {
    if (!result.url || !result.title || seen.has(result.url)) return [];
    seen.add(result.url);
    const text = `${result.title} ${result.description ?? ''}`;
    const lane = classifyFrontierLane(text);
    const scores = scoreItem(text, 'brave_web', new Date().toISOString(), 0.5, 0.62);
    return [{
      id: `web-${stableId(result.url)}`,
      title: cleanText(result.title),
      summary: summarize(result.description || 'Fresh web discovery. Prefer the linked primary evidence when available.'),
      url: result.url,
      source: result.profile?.long_name || new URL(result.url).hostname.replace(/^www\./, ''),
      sourceLabel: result.profile?.long_name || new URL(result.url).hostname.replace(/^www\./, ''),
      sourceKind: 'brave_web' as const,
      publishedAt: new Date().toISOString(), lane,
      tags: inferTags(text, lane, ['web discovery']),
      media: result.thumbnail?.src ? { type: 'image', url: result.thumbnail.src, alt: result.title, aspectRatio: 'landscape' } : undefined,
      ...scores,
      why: 'Broad-web exploration expands discovery beyond the fixed source list.',
    }];
  }));
}

function canonicalKey(item: FrontierItem): string {
  try {
    const url = new URL(item.url);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref']) url.searchParams.delete(key);
    return url.toString().toLowerCase();
  } catch {
    return item.title.toLowerCase().replace(/\W+/g, ' ').trim();
  }
}

function dedupe(items: FrontierItem[]): FrontierItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = canonicalKey(item);
    const titleKey = item.title.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(key) || seen.has(titleKey)) return false;
    seen.add(key);
    seen.add(titleKey);
    return true;
  });
}

export async function getFrontierFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.all([
    runSource('hackernews', 'Hacker News', hackerNewsItems),
    runSource('github', 'GitHub', githubItems),
    runSource('openalex', 'OpenAlex', openAlexItems),
    runSource('rss', 'Specialist feeds', rssItems),
    process.env.FOOTBALL_DATA_API_KEY
      ? runSource('football_data', 'Football Data', footballItems)
      : Promise.resolve({ items: [], status: { id: 'football_data', label: 'Football Data', ok: false, count: 0, message: 'optional key not configured' } } as SourceRun),
    process.env.BRAVE_SEARCH_API_KEY
      ? runSource('brave_web', 'Broad web', braveItems)
      : Promise.resolve({ items: [], status: { id: 'brave_web', label: 'Broad web', ok: false, count: 0, message: 'optional key not configured' } } as SourceRun),
  ]);

  const items = dedupe(runs.flatMap((run) => run.items))
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 120);

  return {
    generatedAt: new Date().toISOString(),
    items,
    sources: runs.map((run) => run.status),
  };
}
