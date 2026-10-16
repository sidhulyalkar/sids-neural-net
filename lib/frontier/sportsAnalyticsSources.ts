import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-analytics/1.2 (+https://sidhulyalkar.com/frontier)';
const DAY_MS = 86_400_000;
const REQUEST_QUERY_TIMEOUT_MS = 3_800;
const DEEP_QUERY_TIMEOUT_MS = 6_500;
const FANTASYPROS_FEED_URL = 'https://www.fantasypros.com/feed/';

type SportsAnalyticsQuery = {
  id: string;
  label: string;
  query: string;
  tags: string[];
  weight: number;
  /** Every evidence group must contribute at least one returned-text match. */
  evidenceGroups: readonly (readonly string[])[];
};

const PINNED_QUERIES: readonly SportsAnalyticsQuery[] = [
  {
    id: 'nfl-analytics',
    label: 'NFL analytics',
    query: 'NFL Patriots analytics player tracking EPA CPOE play-by-play fourth down win probability',
    tags: ['nfl', 'patriots', 'sports analytics', 'player tracking', 'play-by-play', 'epa', 'cpoe'],
    weight: 1,
    evidenceGroups: [
      ['nfl', 'patriots', 'quarterback', 'wide receiver', 'running back', 'tight end'],
      ['analytics', 'epa', 'cpoe', 'player tracking', 'play-by-play', 'fourth down', 'win probability', 'next gen stats', 'nflverse', 'nflfastr'],
    ],
  },
  {
    id: 'fantasy-football',
    label: 'Fantasy football models',
    query: 'fantasy football superflex 2QB ADP target share route participation air yards projections analytics',
    tags: ['fantasy football', 'superflex', '2qb', 'adp', 'target share', 'player usage'],
    weight: 1,
    evidenceGroups: [
      ['fantasy football', 'fantasy', 'superflex', '2qb', '2 qb', 'adp', 'waiver wire'],
      ['projection', 'ranking', 'draft', 'target share', 'route participation', 'air yards', 'snap share', 'usage', 'injury', 'depth chart', 'waiver'],
    ],
  },
  {
    id: 'nfl-role-news',
    label: 'NFL role and availability',
    query: 'NFL fantasy football injury depth chart training camp role change snap share route participation beat reporter',
    tags: ['nfl', 'fantasy football', 'injury', 'depth chart', 'player usage', 'decision edge'],
    weight: 1,
    evidenceGroups: [
      ['nfl', 'fantasy football', 'patriots', 'quarterback', 'wide receiver', 'running back', 'tight end'],
      ['injury', 'depth chart', 'training camp', 'role', 'snap share', 'route participation', 'beat reporter', 'practice', 'starter'],
    ],
  },
  {
    id: 'sports-data-viz',
    label: 'Sports data visualization',
    query: 'sports analytics data visualization player tracking open source football basketball soccer',
    tags: ['sports analytics', 'sports data', 'visualization'],
    weight: 0.92,
    evidenceGroups: [
      ['sports', 'football', 'basketball', 'soccer', 'nfl', 'nba'],
      ['analytics', 'data visualization', 'tracking', 'expected value', 'expected points', 'expected goals', 'xg', 'model'],
    ],
  },
] as const;

const ROTATING_QUERIES: readonly SportsAnalyticsQuery[] = [
  {
    id: 'nba-analytics',
    label: 'Warriors and NBA analytics',
    query: 'Golden State Warriors NBA analytics lineup tracking shot quality expected value player impact visualization',
    tags: ['warriors', 'nba', 'sports analytics', 'player tracking', 'visualization'],
    weight: 0.9,
    evidenceGroups: [
      ['golden state warriors', 'warriors', 'nba', 'basketball'],
      ['analytics', 'lineup', 'tracking', 'shot quality', 'expected value', 'player impact', 'visualization'],
    ],
  },
  {
    id: 'soccer-analytics',
    label: 'Chelsea, Man City and soccer analytics',
    query: 'Chelsea Manchester City soccer analytics xG xThreat tracking pressing set pieces data visualization',
    tags: ['chelsea', 'man city', 'soccer analytics', 'xg', 'xthreat', 'sports data', 'visualization'],
    weight: 0.9,
    evidenceGroups: [
      ['chelsea', 'manchester city', 'man city', 'soccer', 'premier league', 'football'],
      ['analytics', 'xg', 'xthreat', 'tracking', 'pressing', 'set piece', 'visualization'],
    ],
  },
] as const;

const FANTASY_DECISION_TERMS = [
  'fantasy football', 'superflex', '2qb', '2 qb', 'adp', 'mock draft', 'draft',
  'ranking', 'rankings', 'projection', 'projections', 'sleeper', 'breakout', 'bust',
  'target share', 'route participation', 'air yards', 'waiver', 'injury', 'depth chart',
] as const;

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

function cleanText(value: string | undefined): string {
  return (value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return cleanText(match?.[1]);
}

function xmlTagAttribute(block: string, tag: string, attribute: string): string {
  const opening = block.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '';
  return cleanText(opening.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]);
}

function publisherHost(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function summarize(value: string, maxLength = 280): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, boundary > 170 ? boundary : maxLength).trim()}…`;
}

function ageDays(publishedAt: string, now = Date.now()): number {
  return Math.max(0, (now - new Date(publishedAt).getTime()) / DAY_MS);
}

function dailyRotationIndex(): number {
  const day = new Date().toISOString().slice(0, 10);
  return Array.from(day).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function evidenceTermMatches(text: string, term: string): boolean {
  const lower = text.toLowerCase();
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  if (/^[a-z0-9]+$/.test(needle) && needle.length <= 4) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(needle)}(?=$|[^a-z0-9])`, 'i').test(lower);
  }
  return lower.includes(needle);
}

export function sportsAnalyticsEvidenceMatches(text: string, spec: SportsAnalyticsQuery): boolean {
  return spec.evidenceGroups.every((group) => group.some((term) => evidenceTermMatches(text, term)));
}

export function sportsAnalyticsQueries(deep = false): SportsAnalyticsQuery[] {
  if (deep) return [...PINNED_QUERIES, ...ROTATING_QUERIES];
  const rotating = ROTATING_QUERIES[dailyRotationIndex() % ROTATING_QUERIES.length];
  return [...PINNED_QUERIES, rotating];
}

export function parseSportsAnalyticsNewsRss(xml: string, spec: SportsAnalyticsQuery): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 6).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url) return [];

    const publishedRaw = xmlTag(block, 'pubDate');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date().toISOString()
      : new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt) > 10) return [];

    const rawSummary = xmlTag(block, 'description');
    const summary = summarize(rawSummary || `${spec.label} signal.`);
    // Search intent is retrieval evidence, not semantic evidence. Google News can
    // return fuzzy neighbors; never let the query itself stamp NFL/fantasy/etc.
    // onto a result that does not corroborate the concept in returned content.
    if (!sportsAnalyticsEvidenceMatches(`${title} ${rawSummary}`, spec)) return [];

    const sourceLabel = xmlTag(block, 'source') || 'Sports analytics';
    const publisherUrl = xmlTagAttribute(block, 'source', 'url');
    const source = publisherHost(publisherUrl) || 'news.google.com';
    const freshness = Math.exp(-ageDays(publishedAt) / 4.5);
    const quality = 0.72;
    const importance = 0.6 + spec.weight * 0.08;
    const novelty = 0.58;
    const momentum = 0.5;
    const baseScore = clamp(
      importance * 0.3 + quality * 0.24 + momentum * 0.12 + freshness * 0.22 + novelty * 0.12
    );

    return [{
      id: `sports-analytics-${spec.id}-${stableId(`${url}-${index}`)}`,
      title,
      summary,
      url,
      source,
      sourceLabel,
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'sports' as const,
      tags: Array.from(new Set([...spec.tags, 'sports analytics', 'targeted discovery'])).slice(0, 10),
      importance,
      quality,
      momentum,
      novelty,
      baseScore,
      why: `${spec.label} has a dedicated discovery budget because it is a high-value personal analysis topic.`,
    } satisfies FrontierItem];
  });
}

export function parseFantasyProsRss(xml: string, now = Date.now()): FrontierItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 24).flatMap((block, index) => {
    const title = xmlTag(block, 'title');
    const url = xmlTag(block, 'link') || xmlTag(block, 'guid');
    if (!title || !url || publisherHost(url) !== 'fantasypros.com') return [];
    const publishedRaw = xmlTag(block, 'pubDate') || xmlTag(block, 'dc:date');
    const publishedAt = Number.isNaN(Date.parse(publishedRaw))
      ? new Date(now).toISOString()
      : new Date(publishedRaw).toISOString();
    if (ageDays(publishedAt, now) > 10) return [];

    const summary = summarize(xmlTag(block, 'description') || xmlTag(block, 'content:encoded') || 'Fresh FantasyPros analysis.');
    const evidence = `${title} ${summary}`.toLowerCase();
    const decisionTerms = FANTASY_DECISION_TERMS.filter((term) => evidenceTermMatches(evidence, term));
    const footballContext = evidence.includes('fantasy football')
      || evidence.includes(' nfl ')
      || evidence.startsWith('nfl ')
      || evidence.includes(' quarterback')
      || evidence.includes(' running back')
      || evidence.includes(' wide receiver')
      || evidence.includes(' tight end');
    if (!footballContext || !decisionTerms.length) return [];

    const tags = Array.from(new Set([
      'fantasy football', 'decision edge', 'player usage',
      ...decisionTerms.slice(0, 5),
      ...(evidence.includes('superflex') ? ['superflex'] : []),
      ...(evidenceTermMatches(evidence, '2qb') || evidence.includes('2 qb') ? ['2qb'] : []),
    ])).slice(0, 10);
    const freshness = Math.exp(-ageDays(publishedAt, now) / 4.5);
    const importance = 0.7;
    const quality = 0.8;
    const momentum = 0.55;
    const novelty = 0.52;
    const baseScore = clamp(
      importance * 0.3 + quality * 0.25 + momentum * 0.13 + freshness * 0.23 + novelty * 0.09
    );
    return [{
      id: `fantasypros-${stableId(`${url}-${index}`)}`,
      title,
      summary,
      url,
      source: 'fantasypros.com',
      sourceLabel: 'FantasyPros',
      sourceKind: 'rss' as const,
      publishedAt,
      lane: 'sports' as const,
      tags,
      importance,
      quality,
      momentum,
      novelty,
      baseScore,
      why: 'Fresh publisher-direct fantasy football decision material, independent of the broad search mesh.',
    } satisfies FrontierItem];
  })
    .sort((left, right) => right.baseScore - left.baseScore)
    .slice(0, 6);
}

async function fetchQuery(spec: SportsAnalyticsQuery, timeoutMs: number): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(spec.query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, text/xml' },
      signal: controller.signal,
      next: { revalidate: 60 * 35 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseSportsAnalyticsNewsRss(await response.text(), spec).slice(0, 3);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFantasyProsFeed(): Promise<FrontierItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEP_QUERY_TIMEOUT_MS);
  try {
    const response = await fetch(FANTASYPROS_FEED_URL, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: controller.signal,
      redirect: 'follow',
      next: { revalidate: 60 * 30 },
    });
    if (!response.ok) throw new Error(`FantasyPros: ${response.status} ${response.statusText}`);
    return parseFantasyProsRss(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSportsAnalyticsFeed(options: { deep?: boolean } = {}): Promise<FrontierFeedResponse> {
  const deep = Boolean(options.deep);
  const queries = sportsAnalyticsQueries(deep);
  const timeoutMs = deep ? DEEP_QUERY_TIMEOUT_MS : REQUEST_QUERY_TIMEOUT_MS;
  const [queryRuns, fantasyRun] = await Promise.all([
    Promise.allSettled(queries.map((spec) => fetchQuery(spec, timeoutMs))),
    deep
      ? fetchFantasyProsFeed().then(
          (items) => ({ ok: true as const, items }),
          () => ({ ok: false as const, items: [] as FrontierItem[] }),
        )
      : Promise.resolve({ ok: true as const, items: [] as FrontierItem[] }),
  ]);
  const searchItems = queryRuns.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const items = Array.from(new Map(
    [...fantasyRun.items, ...searchItems].map((item) => [item.url.toLowerCase(), item])
  ).values());
  const failures = queryRuns.filter((run) => run.status === 'rejected').length;
  const degradations = [
    failures ? `${failures}/${queryRuns.length} focused searches degraded` : '',
    deep && !fantasyRun.ok ? 'FantasyPros direct feed degraded' : '',
  ].filter(Boolean);
  const status: FrontierSourceStatus = {
    id: 'rss',
    label: deep ? 'Sports analytics + FantasyPros deep radar' : 'Sports analytics radar',
    ok: items.length > 0 || failures < queryRuns.length || fantasyRun.ok,
    count: items.length,
    message: items.length
      ? (degradations.length ? degradations.join(' · ') : undefined)
      : (degradations.length ? `sports analytics yielded no relevant items · ${degradations.join(' · ')}` : 'sports analytics discovery yielded no relevant items'),
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
