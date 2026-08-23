import { FRONTIER_SOURCE_WEIGHTS } from './config';
import { classifyFrontierLane } from './sources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceKind, FrontierSourceStatus } from './types';

export type FrontierIngestSourceId = 'arxiv' | 'huggingface' | 'github' | 'paperswithcode' | 'hackernews' | 'rss';

type IngestOptions = {
  query?: string;
  limit?: number;
  fallbackEndpoint?: string;
  signal?: AbortSignal;
};

type AdapterResult = {
  items: FrontierItem[];
  status: FrontierSourceStatus;
};

type SourceAdapter = {
  id: FrontierIngestSourceId;
  label: string;
  minIntervalMs: number;
  load: (query: string, limit: number, signal?: AbortSignal) => Promise<FrontierItem[]>;
};

const DAY_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 7_000;
const DEFAULT_LIMIT = 12;
const USER_AGENT = 'sids-neural-net-frontier/3.0 (+https://sidhulyalkar.com/frontier)';

const XML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
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

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&([a-zA-Z]+|#39);/g, (match, key: string) => XML_ENTITIES[key] ?? match)
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTag(block: string, tag: string): string {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function allTags(block: string, tag: string): string[] {
  const escaped = tag.replace(':', '\\:');
  const regex = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
  return Array.from(block.matchAll(regex), (match) => decodeXml(match[1])).filter(Boolean);
}

function attribute(block: string, tag: string, name: string): string {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

function normalizeDate(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'source']) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return value;
  }
}

function sourceScores(publishedAt: string, source: FrontierSourceKind, credibility: number, momentum = 0.58) {
  const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / 3.2);
  const sourceWeight = FRONTIER_SOURCE_WEIGHTS[source] ?? 1;
  const quality = clamp(credibility * sourceWeight);
  const importance = clamp(0.48 + quality * 0.22 + freshness * 0.12);
  const novelty = clamp(0.52 + freshness * 0.28);
  const boundedMomentum = clamp(momentum + freshness * 0.18);
  const baseScore = clamp(quality * 0.31 + freshness * 0.25 + importance * 0.2 + novelty * 0.12 + boundedMomentum * 0.12);
  return { quality, importance, novelty, momentum: boundedMomentum, baseScore };
}

function item(input: {
  key: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  sourceLabel: string;
  sourceKind: FrontierSourceKind;
  publishedAt?: string;
  tags?: string[];
  authors?: string[];
  credibility: number;
  momentum?: number;
  metrics?: Array<{ label: string; value: string; detail?: string }>;
}): FrontierItem {
  const publishedAt = normalizeDate(input.publishedAt);
  const title = input.title.replace(/\s+/g, ' ').trim();
  const summary = (input.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 900);
  const lane = classifyFrontierLane(`${title} ${summary} ${(input.tags ?? []).join(' ')}`);
  return {
    id: `ingest-${input.sourceKind}-${stableId(input.key)}`,
    title,
    summary,
    url: canonicalUrl(input.url),
    source: input.source,
    sourceLabel: input.sourceLabel,
    sourceKind: input.sourceKind,
    publishedAt,
    lane,
    tags: Array.from(new Set([...(input.tags ?? []), lane.replaceAll('_', ' '), input.sourceLabel.toLowerCase()])),
    authors: input.authors,
    metrics: input.metrics,
    ...sourceScores(publishedAt, input.sourceKind, input.credibility, input.momentum),
    why: `Fresh ${input.sourceLabel} signal normalized by FRONTIER's multi-source ingestor.`,
  };
}

async function boundedFetch(url: string, init: RequestInit = {}, outerSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const abort = () => controller.abort();
  outerSignal?.addEventListener('abort', abort, { once: true });
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/atom+xml, application/rss+xml, application/xml, text/xml, */*;q=0.2',
        ...(typeof window === 'undefined' ? { 'User-Agent': USER_AGENT } : {}),
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', abort);
  }
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await boundedFetch(url, {}, signal);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchJson<T>(url: string, headers: HeadersInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await boundedFetch(url, { headers }, signal);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export function parseArxivAtom(xml: string): FrontierItem[] {
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)).flatMap((match) => {
    const block = match[1];
    const title = firstTag(block, 'title');
    const summary = firstTag(block, 'summary');
    const id = firstTag(block, 'id');
    if (!title || !id) return [];
    const alternate = attribute(block, 'link', 'href') || id;
    const authors = Array.from(block.matchAll(/<author>([\s\S]*?)<\/author>/gi), (author) => firstTag(author[1], 'name')).filter(Boolean);
    const categories = Array.from(block.matchAll(/<category\b[^>]*term=["']([^"']+)["'][^>]*\/?>(?:<\/category>)?/gi), (entry) => entry[1]);
    return [item({
      key: id,
      title,
      summary,
      url: alternate,
      source: 'export.arxiv.org',
      sourceLabel: 'arXiv',
      sourceKind: 'arxiv',
      publishedAt: firstTag(block, 'published') || firstTag(block, 'updated'),
      tags: categories,
      authors,
      credibility: 0.9,
    })];
  });
}

type HfDailyPaper = {
  paper?: {
    id?: string;
    title?: string;
    summary?: string;
    publishedAt?: string;
    submittedOnDailyAt?: string;
    authors?: Array<{ name?: string }>;
    upvotes?: number;
    githubRepo?: string;
    projectPage?: string;
    ai_summary?: string;
    ai_keywords?: string[];
  };
  title?: string;
  summary?: string;
  publishedAt?: string;
  upvotes?: number;
};

export function parseHuggingFaceDailyPapers(payload: unknown): FrontierItem[] {
  if (!Array.isArray(payload)) return [];
  return (payload as HfDailyPaper[]).flatMap((entry) => {
    const paper = entry.paper ?? entry;
    const id = 'id' in paper ? paper.id : undefined;
    const title = paper.title;
    if (!id || !title) return [];
    const summary = ('ai_summary' in paper && paper.ai_summary) || paper.summary || '';
    const upvotes = ('upvotes' in paper ? paper.upvotes : undefined) ?? entry.upvotes ?? 0;
    const url = `https://huggingface.co/papers/${id}`;
    return [item({
      key: id,
      title,
      summary,
      url,
      source: 'huggingface.co',
      sourceLabel: 'HF Daily Papers',
      sourceKind: 'huggingface',
      publishedAt: ('publishedAt' in paper ? paper.publishedAt : undefined) || ('submittedOnDailyAt' in paper ? paper.submittedOnDailyAt : undefined) || entry.publishedAt,
      tags: [
        ...(('ai_keywords' in paper && paper.ai_keywords) || []),
        ...(('githubRepo' in paper && paper.githubRepo) ? ['code-linked'] : []),
      ],
      authors: ('authors' in paper ? paper.authors : undefined)?.flatMap((author) => author.name ? [author.name] : []),
      credibility: 0.91,
      momentum: clamp(0.48 + Math.log10(upvotes + 1) / 6),
      metrics: upvotes ? [{ label: 'HF upvotes', value: String(upvotes) }] : undefined,
    })];
  });
}

type GithubSearchPayload = {
  items?: Array<{
    id?: number;
    full_name?: string;
    html_url?: string;
    description?: string | null;
    created_at?: string;
    pushed_at?: string;
    stargazers_count?: number;
    forks_count?: number;
    language?: string | null;
    topics?: string[];
  }>;
};

export function parseGithubTrending(payload: GithubSearchPayload): FrontierItem[] {
  return (payload.items ?? []).flatMap((repo) => {
    if (!repo.id || !repo.full_name || !repo.html_url) return [];
    const stars = repo.stargazers_count ?? 0;
    return [item({
      key: String(repo.id),
      title: repo.full_name,
      summary: repo.description ?? '',
      url: repo.html_url,
      source: 'github.com',
      sourceLabel: 'GitHub Trending',
      sourceKind: 'github',
      publishedAt: repo.pushed_at || repo.created_at,
      tags: [...(repo.topics ?? []), ...(repo.language ? [repo.language] : []), 'trending repository'],
      credibility: 0.84,
      momentum: clamp(0.5 + Math.log10(stars + 1) / 8),
      metrics: [
        { label: 'stars', value: stars.toLocaleString() },
        { label: 'forks', value: String(repo.forks_count ?? 0) },
      ],
    })];
  });
}

type PwcPayload = {
  results?: Array<{
    id?: string;
    title?: string;
    abstract?: string;
    url_abs?: string;
    url_pdf?: string;
    published?: string;
    proceeding?: string;
    authors?: string[];
    repository?: string;
  }>;
};

export function parsePapersWithCode(payload: PwcPayload): FrontierItem[] {
  return (payload.results ?? []).flatMap((paper) => {
    if (!paper.id || !paper.title) return [];
    const url = paper.url_abs || `https://paperswithcode.com/paper/${paper.id}`;
    return [item({
      key: paper.id,
      title: paper.title,
      summary: paper.abstract ?? '',
      url,
      source: 'paperswithcode.com',
      sourceLabel: 'Papers with Code',
      sourceKind: 'paperswithcode',
      publishedAt: paper.published,
      tags: [paper.proceeding ?? '', paper.repository ? 'code-linked' : ''].filter(Boolean),
      authors: paper.authors,
      credibility: 0.88,
    })];
  });
}

type HackerNewsPayload = {
  hits?: Array<{
    objectID?: string;
    title?: string;
    story_title?: string;
    url?: string;
    story_url?: string;
    created_at?: string;
    points?: number;
    num_comments?: number;
    author?: string;
    _tags?: string[];
  }>;
};

export function parseHackerNews(payload: HackerNewsPayload): FrontierItem[] {
  return (payload.hits ?? []).flatMap((hit) => {
    const id = hit.objectID;
    const title = hit.title || hit.story_title;
    if (!id || !title) return [];
    const url = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${id}`;
    const points = hit.points ?? 0;
    return [item({
      key: id,
      title,
      url,
      source: 'news.ycombinator.com',
      sourceLabel: 'Hacker News',
      sourceKind: 'hackernews',
      publishedAt: hit.created_at,
      tags: [...(hit._tags ?? []), 'technical discussion'],
      authors: hit.author ? [hit.author] : undefined,
      credibility: 0.76,
      momentum: clamp(0.45 + Math.log10(points + (hit.num_comments ?? 0) + 1) / 7),
      metrics: [
        { label: 'points', value: String(points) },
        { label: 'comments', value: String(hit.num_comments ?? 0) },
      ],
    })];
  });
}

export function parseRss(xml: string, sourceUrl: string): FrontierItem[] {
  const sourceHost = (() => {
    try { return new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { return 'rss'; }
  })();
  const channelTitle = firstTag(xml, 'title') || sourceHost;
  const blocks = [
    ...Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi), (match) => match[1]),
    ...Array.from(xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi), (match) => match[1]),
  ];
  return blocks.flatMap((block) => {
    const title = firstTag(block, 'title');
    const link = firstTag(block, 'link') || attribute(block, 'link', 'href') || firstTag(block, 'guid') || firstTag(block, 'id');
    if (!title || !link) return [];
    const summary = firstTag(block, 'description') || firstTag(block, 'summary') || firstTag(block, 'content:encoded') || firstTag(block, 'content');
    const categories = [...allTags(block, 'category'), ...allTags(block, 'dc:subject')];
    return [item({
      key: link,
      title,
      summary,
      url: link,
      source: sourceHost,
      sourceLabel: channelTitle,
      sourceKind: 'rss',
      publishedAt: firstTag(block, 'pubDate') || firstTag(block, 'published') || firstTag(block, 'updated') || firstTag(block, 'dc:date'),
      tags: categories,
      authors: [firstTag(block, 'author') || firstTag(block, 'dc:creator')].filter(Boolean),
      credibility: 0.82,
    })];
  });
}

class SourceRateLimiter {
  private readonly nextAt = new Map<string, number>();

  async wait(key: string, intervalMs: number, signal?: AbortSignal): Promise<void> {
    const now = performanceNow();
    const readyAt = Math.max(now, this.nextAt.get(key) ?? 0);
    this.nextAt.set(key, readyAt + intervalMs);
    const delay = readyAt - now;
    if (delay <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}

function performanceNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function normalizeQuery(value?: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 160);
}

function configuredRssFeeds(): string[] {
  const raw = typeof process !== 'undefined'
    ? (process.env.FRONTIER_TARGET_RSS_FEEDS || process.env.FRONTIER_RSS_FEEDS || '')
    : '';
  const configured = raw.split(',').map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set([
    'https://github.blog/feed/',
    'https://www.theguardian.com/football/rss',
    ...configured,
  ])).slice(0, 10);
}

function adapters(): SourceAdapter[] {
  return [
    {
      id: 'arxiv', label: 'arXiv', minIntervalMs: 700,
      load: async (query, limit, signal) => {
        const search = query ? `all:${JSON.stringify(query)}` : '(cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:q-bio.NC)';
        const url = new URL('https://export.arxiv.org/api/query');
        url.searchParams.set('search_query', search);
        url.searchParams.set('start', '0');
        url.searchParams.set('max_results', String(limit));
        url.searchParams.set('sortBy', 'submittedDate');
        url.searchParams.set('sortOrder', 'descending');
        return parseArxivAtom(await fetchText(url.toString(), signal));
      },
    },
    {
      id: 'huggingface', label: 'HF Daily Papers', minIntervalMs: 500,
      load: async (_query, limit, signal) => {
        const url = new URL('https://huggingface.co/api/daily_papers');
        url.searchParams.set('limit', String(Math.min(100, Math.max(limit, 20))));
        const parsed = parseHuggingFaceDailyPapers(await fetchJson<unknown>(url.toString(), {}, signal));
        return parsed.slice(0, limit);
      },
    },
    {
      id: 'github', label: 'GitHub Trending', minIntervalMs: 650,
      load: async (query, limit, signal) => {
        const from = new Date(Date.now() - 14 * DAY_MS).toISOString().slice(0, 10);
        const q = `${query ? `${query} ` : ''}created:>=${from} stars:>5`;
        const token = typeof process !== 'undefined' ? (process.env.FRONTIER_GITHUB_TOKEN || process.env.GITHUB_TOKEN) : undefined;
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(30, limit)}`;
        return parseGithubTrending(await fetchJson<GithubSearchPayload>(url, headers, signal));
      },
    },
    {
      id: 'paperswithcode', label: 'Papers with Code', minIntervalMs: 800,
      load: async (query, limit, signal) => {
        const url = new URL('https://paperswithcode.com/api/v1/papers/');
        url.searchParams.set('page', '1');
        url.searchParams.set('ordering', '-published');
        if (query) url.searchParams.set('q', query);
        const parsed = parsePapersWithCode(await fetchJson<PwcPayload>(url.toString(), {}, signal));
        return parsed.slice(0, limit);
      },
    },
    {
      id: 'hackernews', label: 'Hacker News', minIntervalMs: 350,
      load: async (query, limit, signal) => {
        const since = Math.floor((Date.now() - 3 * DAY_MS) / 1000);
        const url = new URL('https://hn.algolia.com/api/v1/search_by_date');
        url.searchParams.set('tags', 'story');
        url.searchParams.set('numericFilters', `created_at_i>${since}`);
        url.searchParams.set('hitsPerPage', String(Math.min(50, limit)));
        if (query) url.searchParams.set('query', query);
        return parseHackerNews(await fetchJson<HackerNewsPayload>(url.toString(), {}, signal));
      },
    },
    {
      id: 'rss', label: 'Targeted RSS', minIntervalMs: 500,
      load: async (_query, limit, signal) => {
        const results = await Promise.allSettled(configuredRssFeeds().map(async (feed) => parseRss(await fetchText(feed, signal), feed)));
        return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).slice(0, limit);
      },
    },
  ];
}

export function dedupeIngestedItems(items: FrontierItem[]): FrontierItem[] {
  const seen = new Set<string>();
  return items.filter((entry) => {
    const urlKey = canonicalUrl(entry.url).toLowerCase();
    const titleKey = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(urlKey) || seen.has(titleKey)) return false;
    seen.add(urlKey);
    seen.add(titleKey);
    return true;
  });
}

export class FrontierSourceIngestor {
  private readonly limiter = new SourceRateLimiter();
  private readonly sourceAdapters = new Map(adapters().map((adapter) => [adapter.id, adapter]));

  async ingest(source: FrontierIngestSourceId, options: IngestOptions = {}): Promise<AdapterResult> {
    const adapter = this.sourceAdapters.get(source);
    if (!adapter) throw new Error(`Unknown FRONTIER source: ${source}`);
    const query = normalizeQuery(options.query);
    const limit = Math.max(1, Math.min(40, options.limit ?? DEFAULT_LIMIT));

    try {
      await this.limiter.wait(source, adapter.minIntervalMs, options.signal);
      const items = await adapter.load(query, limit, options.signal);
      return {
        items: dedupeIngestedItems(items).slice(0, limit),
        status: { id: source as FrontierSourceKind, label: adapter.label, ok: true, count: items.length },
      };
    } catch (error) {
      if (typeof window !== 'undefined' && options.fallbackEndpoint) {
        try {
          const url = new URL(options.fallbackEndpoint, window.location.origin);
          url.searchParams.set('source', source);
          if (query) url.searchParams.set('q', query);
          url.searchParams.set('limit', String(limit));
          const response = await fetch(url.toString(), { signal: options.signal, cache: 'no-store' });
          if (!response.ok) throw new Error(`fallback ${response.status}`);
          const payload = await response.json() as FrontierFeedResponse;
          return {
            items: payload.items ?? [],
            status: payload.sources?.[0] ?? { id: source as FrontierSourceKind, label: adapter.label, ok: true, count: payload.items?.length ?? 0 },
          };
        } catch {
          // Fall through to the degraded status. A blocked CORS source should
          // never prevent the rest of the feed from rendering.
        }
      }
      return {
        items: [],
        status: {
          id: source as FrontierSourceKind,
          label: adapter.label,
          ok: false,
          count: 0,
          message: error instanceof Error ? error.message.slice(0, 140) : 'source unavailable',
        },
      };
    }
  }

  async ingestMany(sources: FrontierIngestSourceId[], options: IngestOptions = {}): Promise<FrontierFeedResponse> {
    const unique = Array.from(new Set(sources));
    const results = await Promise.all(unique.map((source) => this.ingest(source, options)));
    const items = dedupeIngestedItems(results.flatMap((result) => result.items))
      .sort((left, right) => right.baseScore - left.baseScore)
      .slice(0, 120);
    return {
      generatedAt: new Date().toISOString(),
      items,
      sources: results.map((result) => result.status),
    };
  }
}

export async function getMultiSourceFrontierFeed(focusTopics: string[] = []): Promise<FrontierFeedResponse> {
  const ingestor = new FrontierSourceIngestor();
  const query = normalizeQuery(focusTopics.slice(0, 3).join(' '));
  return ingestor.ingestMany(['arxiv', 'huggingface', 'github', 'paperswithcode', 'hackernews', 'rss'], {
    query,
    limit: query ? 8 : 12,
  });
}
