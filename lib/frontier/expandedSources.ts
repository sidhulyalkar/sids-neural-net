import { FRONTIER_SOURCE_WEIGHTS } from './config';
import { classifyFrontierLane } from './sources';
import type { FrontierFeedResponse, FrontierItem, FrontierMedia, FrontierSourceKind, FrontierSourceStatus } from './types';

const DAY_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 7_500;
const USER_AGENT = 'sids-neural-net-frontier/3.1 (+https://sidhulyalkar.com/frontier)';

const lastStartedAt = new Map<string, number>();
const sourceChains = new Map<string, Promise<unknown>>();

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

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'value' in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === 'string' ? nested.trim() : '';
  }
  return '';
}

function stringList(value: unknown): string[] {
  const raw = value && typeof value === 'object' && 'value' in value
    ? (value as { value?: unknown }).value
    : value;
  return Array.isArray(raw) ? raw.flatMap((entry) => typeof entry === 'string' ? [entry.trim()] : []).filter(Boolean) : [];
}

function sourceScores(publishedAt: string, sourceKind: FrontierSourceKind, credibility: number, momentum = 0.56) {
  const ageDays = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / DAY_MS);
  const freshness = Math.exp(-ageDays / 3.5);
  const quality = clamp(credibility * (FRONTIER_SOURCE_WEIGHTS[sourceKind] ?? 1));
  const importance = clamp(0.46 + quality * 0.24 + freshness * 0.14);
  const novelty = clamp(0.52 + freshness * 0.28);
  const boundedMomentum = clamp(momentum + freshness * 0.17);
  const baseScore = clamp(quality * 0.31 + freshness * 0.26 + importance * 0.19 + novelty * 0.12 + boundedMomentum * 0.12);
  return { quality, importance, novelty, momentum: boundedMomentum, baseScore };
}

function makeItem(input: {
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
  media?: FrontierMedia;
  metrics?: Array<{ label: string; value: string; detail?: string }>;
}): FrontierItem {
  const parsed = input.publishedAt ? new Date(input.publishedAt) : new Date();
  const publishedAt = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  const title = input.title.replace(/\s+/g, ' ').trim();
  const summary = (input.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 1_000);
  const tags = (input.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const lane = classifyFrontierLane(`${title} ${summary} ${tags.join(' ')}`);
  return {
    id: `expanded-${input.sourceKind}-${stableId(input.key)}`,
    title,
    summary,
    url: input.url,
    source: input.source,
    sourceLabel: input.sourceLabel,
    sourceKind: input.sourceKind,
    publishedAt,
    lane,
    tags: Array.from(new Set([...tags, lane.replaceAll('_', ' ')])),
    authors: input.authors,
    media: input.media,
    metrics: input.metrics,
    ...sourceScores(publishedAt, input.sourceKind, input.credibility, input.momentum),
    why: `Fresh ${input.sourceLabel} signal from a public source, normalized and ranked locally by FRONTIER.`,
  };
}

async function boundedJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(typeof window === 'undefined' ? { 'User-Agent': USER_AGENT } : {}),
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function rateLimited<T>(key: string, minIntervalMs: number, run: () => Promise<T>): Promise<T> {
  const previous = sourceChains.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const wait = Math.max(0, minIntervalMs - (Date.now() - (lastStartedAt.get(key) ?? 0)));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStartedAt.set(key, Date.now());
    return run();
  });
  sourceChains.set(key, next);
  try {
    return await next;
  } finally {
    if (sourceChains.get(key) === next) sourceChains.delete(key);
  }
}

function queryMatch(item: FrontierItem, topics: string[]): boolean {
  if (!topics.length) return true;
  const haystack = `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase();
  return topics.some((topic) => {
    const terms = topic.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
    return terms.length ? terms.some((term) => haystack.includes(term)) : false;
  });
}

type RxivPayload = {
  collection?: Array<{
    doi?: string;
    title?: string;
    authors?: string;
    date?: string;
    version?: string;
    category?: string;
    abstract?: string;
    published?: string;
    server?: string;
  }>;
};

export function parseRxiv(payload: RxivPayload, server: 'biorxiv' | 'medrxiv'): FrontierItem[] {
  const sourceKind = server as FrontierSourceKind;
  const sourceLabel = server === 'biorxiv' ? 'bioRxiv' : 'medRxiv';
  return (payload.collection ?? []).flatMap((paper) => {
    if (!paper.doi || !paper.title) return [];
    const url = `https://www.${server}.org/content/${paper.doi}v${paper.version || '1'}`;
    const authors = (paper.authors ?? '').split(';').map((author) => author.trim()).filter(Boolean).slice(0, 12);
    return [makeItem({
      key: paper.doi,
      title: paper.title,
      summary: paper.abstract,
      url,
      source: `${server}.org`,
      sourceLabel,
      sourceKind,
      publishedAt: paper.date,
      tags: [paper.category ?? '', 'preprint', paper.published ? 'published-link-known' : ''].filter(Boolean),
      authors,
      credibility: server === 'biorxiv' ? 0.91 : 0.9,
      metrics: paper.version ? [{ label: 'version', value: paper.version }] : undefined,
    })];
  });
}

async function rxiv(server: 'biorxiv' | 'medrxiv', topics: string[]): Promise<FrontierItem[]> {
  return rateLimited(server, 650, async () => {
    const payload = await boundedJson<RxivPayload>(`https://api.biorxiv.org/details/${server}/7d/0/json`);
    const parsed = parseRxiv(payload, server);
    const focused = parsed.filter((entry) => queryMatch(entry, topics));
    return (focused.length >= 3 ? focused : parsed).slice(0, 14);
  });
}

type OpenReviewNote = {
  id?: string;
  forum?: string;
  cdate?: number;
  pdate?: number;
  mdate?: number;
  tmdate?: number;
  content?: Record<string, unknown>;
};

type OpenReviewPayload = { notes?: OpenReviewNote[] };

export function parseOpenReview(payload: OpenReviewPayload): FrontierItem[] {
  return (payload.notes ?? []).flatMap((note) => {
    if (!note.id) return [];
    const content = note.content ?? {};
    const title = textValue(content.title);
    if (!title) return [];
    const summary = textValue(content.abstract) || textValue(content['TL;DR']) || textValue(content.summary);
    const authors = stringList(content.authors);
    const tags = [
      ...stringList(content.keywords),
      ...stringList(content.subject_areas),
      textValue(content.venue),
      textValue(content.venueid),
      'peer review',
    ].filter(Boolean);
    const timestamp = note.pdate || note.cdate || note.tmdate || note.mdate;
    return [makeItem({
      key: note.id,
      title,
      summary,
      url: `https://openreview.net/forum?id=${encodeURIComponent(note.forum || note.id)}`,
      source: 'openreview.net',
      sourceLabel: 'OpenReview',
      sourceKind: 'openreview',
      publishedAt: timestamp ? new Date(timestamp).toISOString() : undefined,
      tags,
      authors,
      credibility: 0.92,
    })];
  });
}

async function openReview(topics: string[]): Promise<FrontierItem[]> {
  const topic = topics.find((entry) => /ai|machine|learning|model|neuro|data|vision|language|reason/i.test(entry)) || 'machine learning';
  return rateLimited('openreview', 650, async () => {
    const url = new URL('https://api2.openreview.net/notes/search');
    url.searchParams.set('query', topic);
    url.searchParams.set('source', 'forum');
    url.searchParams.set('sort', 'tmdate:desc');
    url.searchParams.set('limit', '12');
    return parseOpenReview(await boundedJson<OpenReviewPayload>(url.toString()));
  });
}

type LobstersStory = {
  short_id?: string;
  short_id_url?: string;
  created_at?: string;
  title?: string;
  url?: string;
  score?: number;
  comment_count?: number;
  tags?: string[];
  submitter_user?: { username?: string };
};

export function parseLobsters(payload: unknown): FrontierItem[] {
  if (!Array.isArray(payload)) return [];
  return (payload as LobstersStory[]).flatMap((story) => {
    if (!story.short_id || !story.title) return [];
    const points = story.score ?? 0;
    const comments = story.comment_count ?? 0;
    return [makeItem({
      key: story.short_id,
      title: story.title,
      url: story.url || story.short_id_url || `https://lobste.rs/s/${story.short_id}`,
      source: 'lobste.rs',
      sourceLabel: 'Lobsters',
      sourceKind: 'lobsters',
      publishedAt: story.created_at,
      tags: [...(story.tags ?? []), 'technical discussion'],
      authors: story.submitter_user?.username ? [story.submitter_user.username] : undefined,
      credibility: 0.8,
      momentum: clamp(0.5 + Math.log10(points + comments + 1) / 7),
      metrics: [
        { label: 'points', value: String(points) },
        { label: 'comments', value: String(comments) },
      ],
    })];
  });
}

async function lobsters(topics: string[]): Promise<FrontierItem[]> {
  return rateLimited('lobsters', 500, async () => {
    const parsed = parseLobsters(await boundedJson<unknown>('https://lobste.rs/newest.json'));
    const focused = parsed.filter((entry) => queryMatch(entry, topics));
    return (focused.length >= 3 ? focused : parsed).slice(0, 14);
  });
}

type NasaApod = {
  date?: string;
  title?: string;
  explanation?: string;
  media_type?: 'image' | 'video';
  url?: string;
  hdurl?: string;
  thumbnail_url?: string;
  copyright?: string;
};

export function parseNasaApod(payload: unknown): FrontierItem[] {
  const entries = Array.isArray(payload) ? payload as NasaApod[] : [payload as NasaApod];
  return entries.flatMap((entry) => {
    if (!entry.date || !entry.title || !entry.url) return [];
    const youtube = /(?:youtube\.com|youtu\.be)/i.test(entry.url);
    const media: FrontierMedia | undefined = entry.media_type === 'image'
      ? { type: 'image', url: entry.hdurl || entry.url, alt: entry.title, aspectRatio: 'landscape' }
      : youtube
        ? { type: 'youtube', url: entry.url, poster: entry.thumbnail_url, alt: entry.title, aspectRatio: 'landscape' }
        : entry.thumbnail_url
          ? { type: 'image', url: entry.thumbnail_url, alt: entry.title, aspectRatio: 'landscape' }
          : undefined;
    return [makeItem({
      key: entry.date,
      title: entry.title,
      summary: entry.explanation,
      url: `https://apod.nasa.gov/apod/ap${entry.date.replaceAll('-', '').slice(2)}.html`,
      source: 'nasa.gov',
      sourceLabel: 'NASA APOD',
      sourceKind: 'nasa',
      publishedAt: `${entry.date}T12:00:00Z`,
      tags: ['space', 'astronomy', 'visual science'],
      authors: entry.copyright ? [entry.copyright] : undefined,
      media,
      credibility: 0.97,
    })];
  });
}

async function nasa(): Promise<FrontierItem[]> {
  return rateLimited('nasa', 1_000, async () => {
    const end = new Date();
    const start = new Date(end.getTime() - 5 * DAY_MS);
    const params = new URLSearchParams({
      api_key: process.env.FRONTIER_NASA_API_KEY || 'DEMO_KEY',
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      thumbs: 'true',
    });
    return parseNasaApod(await boundedJson<unknown>(`https://api.nasa.gov/planetary/apod?${params.toString()}`)).slice(0, 6);
  });
}

function dedupe(items: FrontierItem[]): FrontierItem[] {
  const seen = new Set<string>();
  return items.filter((entry) => {
    let url = entry.url.toLowerCase();
    try {
      const parsed = new URL(entry.url);
      parsed.hash = '';
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'ref']) parsed.searchParams.delete(key);
      url = parsed.toString().toLowerCase();
    } catch {}
    const title = entry.title.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(url) || seen.has(title)) return false;
    seen.add(url);
    seen.add(title);
    return true;
  });
}

export async function getExpandedPublicFeed(focusTopics: string[] = []): Promise<FrontierFeedResponse> {
  const focus = Array.from(new Set(focusTopics.map((topic) => topic.trim()).filter(Boolean))).slice(0, 8);
  const runs = await Promise.allSettled([
    rxiv('biorxiv', focus),
    rxiv('medrxiv', focus),
    openReview(focus),
    lobsters(focus),
    nasa(),
  ]);
  const ids: Array<{ id: FrontierSourceKind; label: string }> = [
    { id: 'biorxiv', label: 'bioRxiv' },
    { id: 'medrxiv', label: 'medRxiv' },
    { id: 'openreview', label: 'OpenReview' },
    { id: 'lobsters', label: 'Lobsters' },
    { id: 'nasa', label: 'NASA' },
  ];
  const sources: FrontierSourceStatus[] = runs.map((result, index) => {
    const definition = ids[index];
    const count = result.status === 'fulfilled' ? result.value.length : 0;
    return {
      ...definition,
      ok: result.status === 'fulfilled',
      count,
      message: result.status === 'rejected' ? 'temporarily unavailable' : undefined,
    };
  });
  const items = dedupe(runs.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 60);
  return { generatedAt: new Date().toISOString(), items, sources };
}
