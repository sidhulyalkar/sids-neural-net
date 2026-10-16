import {
  FRONTIER_SPORTS_LEAGUES,
  parseSportsHighlights,
  parseSportsScoreboard,
} from './sportsStateSources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-state-cdn/1.0 (+https://sidhulyalkar.com/frontier)';
const FETCH_TIMEOUT_MS = 1_900;

type LeagueConfig = (typeof FRONTIER_SPORTS_LEAGUES)[number];
type EspnScoreboard = Parameters<typeof parseSportsScoreboard>[0];
type EspnEvent = NonNullable<EspnScoreboard['events']>[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeEspnEvent(value: unknown): value is EspnEvent {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && Array.isArray(value.competitions);
}

/**
 * cdn.espn.com wraps its data below product-specific envelope keys such as
 * content.sbData. Keep the transport detail outside the canonical parser by
 * recovering only arrays that are already ordinary ESPN event objects.
 */
export function parseEspnCdnScoreboardEnvelope(payload: unknown): EspnScoreboard | undefined {
  const events = new Map<string, EspnEvent>();
  const seenObjects = new Set<object>();

  const walk = (value: unknown, depth: number): void => {
    if (depth > 7 || !value) return;
    if (Array.isArray(value)) {
      if (value.length && value.every((candidate) => looksLikeEspnEvent(candidate))) {
        for (const event of value) events.set(event.id as string, event);
        return;
      }
      for (const child of value.slice(0, 80)) walk(child, depth + 1);
      return;
    }
    if (!isRecord(value) || seenObjects.has(value)) return;
    seenObjects.add(value);
    for (const child of Object.values(value)) walk(child, depth + 1);
  };

  walk(payload, 0);
  return events.size ? { events: Array.from(events.values()) } : undefined;
}

function cdnLeagueSlug(config: LeagueConfig): string {
  return config.id === 'premier-league' ? 'soccer' : config.id;
}

export function espnCdnSportsUrl(config: LeagueConfig, resource: 'scoreboard' | 'schedule'): string {
  const url = new URL(`https://cdn.espn.com/core/${cdnLeagueSlug(config)}/${resource}`);
  url.searchParams.set('xhr', '1');
  if (config.id === 'premier-league') url.searchParams.set('league', config.league);
  return url.toString();
}

async function fetchEnvelope(url: string, revalidateSeconds: number): Promise<EspnScoreboard | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.espn.com/',
      },
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseEspnCdnScoreboardEnvelope(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function mergeScoreboards(payloads: Array<EspnScoreboard | undefined>): EspnScoreboard | undefined {
  const events = new Map<string, EspnEvent>();
  for (const payload of payloads) {
    for (const event of payload?.events ?? []) {
      if (event.id && !events.has(event.id)) events.set(event.id, event);
    }
  }
  return events.size ? { events: Array.from(events.values()) } : undefined;
}

async function leagueFeed(config: LeagueConfig): Promise<FrontierItem[]> {
  // The small current-slate endpoint keeps live scores fresh; the season
  // schedule makes favorite-team state authoritative even in off-season or on
  // quiet days. Both are CDN-hosted so a Site API DNS failure cannot erase the
  // utility lane from a manual/focused request.
  const [scoreboardRun, scheduleRun] = await Promise.allSettled([
    fetchEnvelope(espnCdnSportsUrl(config, 'scoreboard'), 60 * 3),
    fetchEnvelope(espnCdnSportsUrl(config, 'schedule'), 60 * 15),
  ]);
  const scoreboard = mergeScoreboards([
    scoreboardRun.status === 'fulfilled' ? scoreboardRun.value : undefined,
    scheduleRun.status === 'fulfilled' ? scheduleRun.value : undefined,
  ]);
  if (!scoreboard) return [];

  return [
    ...parseSportsScoreboard(scoreboard, config),
    ...parseSportsHighlights(scoreboard, config),
  ];
}

/**
 * Bounded request-time sports utility. The deep archive can afford broader
 * enrichment and standings; first-paint refreshes only need the CDN authority
 * that has proven reliable in both GitHub Actions and Vercel.
 */
export async function getCdnSportsStateFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.allSettled(FRONTIER_SPORTS_LEAGUES.map(leagueFeed));
  const items = Array.from(new Map(
    runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []).map((item) => [item.id, item])
  ).values());
  const failures = runs.filter((run) => run.status === 'rejected').length;
  const favoriteSignals = items.filter((item) => item.tags.some((tag) => [
    'patriots', 'new england patriots', 'warriors', 'golden state warriors',
    'chelsea', 'chelsea fc', 'manchester city', 'man city',
  ].includes(tag))).length;
  const status: FrontierSourceStatus = {
    id: 'sports_state',
    label: 'Live sports state · ESPN CDN',
    ok: items.length > 0,
    count: items.length,
    message: items.length
      ? [
          failures ? `${failures} league feed${failures === 1 ? '' : 's'} degraded` : '',
          favoriteSignals ? `${favoriteSignals} favorite-team state signal${favoriteSignals === 1 ? '' : 's'}` : 'no favorite-team state in current slate',
        ].filter(Boolean).join(' · ') || undefined
      : 'ESPN CDN sports state temporarily unavailable',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
