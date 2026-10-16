import {
  FRONTIER_SPORTS_LEAGUES,
  parseSportsHighlights,
  parseSportsScoreboard,
  parseSportsStandings,
} from './sportsStateSources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-state-deep/1.3 (+https://sidhulyalkar.com/frontier)';
const DEEP_FETCH_TIMEOUT_MS = 6_500;
const DEEP_FETCH_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 240;
const CURRENT_SEASON = new Date().getUTCFullYear();

type EspnScoreboard = Parameters<typeof parseSportsScoreboard>[0];
type EspnStandings = Parameters<typeof parseSportsStandings>[0];
type LeagueConfig = (typeof FRONTIER_SPORTS_LEAGUES)[number];
type EspnEvent = NonNullable<EspnScoreboard['events']>[number];

const FAVORITE_TEAM_IDS: Readonly<Record<string, readonly string[]>> = {
  nfl: ['17'], // New England Patriots
  nba: ['9'], // Golden State Warriors
  'premier-league': ['363', '382'], // Chelsea, Manchester City
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasEvents(payload: EspnScoreboard | undefined): payload is EspnScoreboard {
  return Boolean(payload?.events?.length);
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < DEEP_FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEEP_FETCH_TIMEOUT_MS);
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
      if (!response.ok) {
        const error = new Error(`${response.status} ${response.statusText}`);
        if (!retryableStatus(response.status) || attempt === DEEP_FETCH_ATTEMPTS - 1) throw error;
        lastError = error;
      } else {
        return await response.json() as T;
      }
    } catch (error) {
      lastError = error;
      if (attempt === DEEP_FETCH_ATTEMPTS - 1) throw error;
    } finally {
      clearTimeout(timer);
    }

    await sleep(RETRY_BACKOFF_MS * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new Error('ESPN deep fetch failed');
}

function mergeScoreboards(payloads: Array<EspnScoreboard | undefined>): EspnScoreboard | undefined {
  const byId = new Map<string, EspnEvent>();
  let anonymous = 0;
  for (const payload of payloads) {
    for (const event of payload?.events ?? []) {
      const id = event.id || `anonymous-${anonymous++}`;
      if (!byId.has(id)) byId.set(id, event);
    }
  }
  const events = Array.from(byId.values());
  return events.length ? { events } : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeEspnEvent(value: unknown): value is EspnEvent {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && Array.isArray(value.competitions);
}

/**
 * ESPN's CDN envelopes scoreboards and schedules below content.sbData and
 * schedule-specific containers rather than returning the Site API shape at the
 * root. Walk only a shallow bounded object graph and recover arrays that are
 * already made of normal ESPN event objects. This keeps one canonical parser.
 */
function scoreboardFromCdnEnvelope(payload: unknown): EspnScoreboard | undefined {
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

function cdnUrl(config: LeagueConfig, resource: 'scoreboard' | 'schedule', explicitYear = false): string {
  const url = new URL(`https://cdn.espn.com/core/${cdnLeagueSlug(config)}/${resource}`);
  url.searchParams.set('xhr', '1');
  if (config.id === 'premier-league') url.searchParams.set('league', config.league);
  if (explicitYear) url.searchParams.set('year', String(CURRENT_SEASON));
  return url.toString();
}

async function cdnScoreboard(config: LeagueConfig): Promise<EspnScoreboard | undefined> {
  try {
    const payload = await fetchJson<unknown>(cdnUrl(config, 'scoreboard'), 60 * 3);
    return scoreboardFromCdnEnvelope(payload);
  } catch {
    return undefined;
  }
}

async function cdnSchedule(config: LeagueConfig): Promise<EspnScoreboard | undefined> {
  try {
    const current = scoreboardFromCdnEnvelope(
      await fetchJson<unknown>(cdnUrl(config, 'schedule'), 60 * 15),
    );
    if (hasEvents(current)) return current;
  } catch {
    // Retry with the explicit calendar year below.
  }

  try {
    return scoreboardFromCdnEnvelope(
      await fetchJson<unknown>(cdnUrl(config, 'schedule', true), 60 * 15),
    );
  } catch {
    return undefined;
  }
}

async function preferredTeamSchedule(config: LeagueConfig, teamId: string): Promise<EspnScoreboard | undefined> {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/teams/${teamId}/schedule`;

  try {
    const current = await fetchJson<EspnScoreboard>(base, 60 * 15);
    if (hasEvents(current)) return current;
  } catch {
    // Fall through to the explicit-season retry below.
  }

  const seasonal = new URL(base);
  seasonal.searchParams.set('season', String(CURRENT_SEASON));
  try {
    const payload = await fetchJson<EspnScoreboard>(seasonal.toString(), 60 * 15);
    return hasEvents(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}

async function favoriteTeamSchedules(config: LeagueConfig): Promise<{
  scoreboard?: EspnScoreboard;
  successful: number;
  attempted: number;
}> {
  const teamIds = FAVORITE_TEAM_IDS[config.id] ?? [];
  if (!teamIds.length) return { successful: 0, attempted: 0 };

  // A league schedule from ESPN's CDN is a different network authority than
  // site.api.espn.com and already contains the same event objects. Prefer it as
  // the deployment-safe favorite-team source, then keep the tiny team endpoint
  // as a precision fallback when the CDN has no schedule payload.
  const cdn = await cdnSchedule(config);
  if (hasEvents(cdn)) {
    return { scoreboard: cdn, successful: teamIds.length, attempted: teamIds.length };
  }

  const payloads: EspnScoreboard[] = [];
  for (const teamId of teamIds) {
    const payload = await preferredTeamSchedule(config, teamId);
    if (payload) payloads.push(payload);
  }

  return {
    scoreboard: mergeScoreboards(payloads),
    successful: payloads.length,
    attempted: teamIds.length,
  };
}

async function deepLeagueFeed(config: LeagueConfig): Promise<{
  items: FrontierItem[];
  scoreboardOk: boolean;
  standingsOk: boolean;
  favoriteScheduleOk: boolean;
  cdnOk: boolean;
}> {
  const favoriteRun = await favoriteTeamSchedules(config);
  const cdnBoard = await cdnScoreboard(config);
  const scoreboardEndpoint = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard`;
  const standingsEndpoint = `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`;
  const [scoreboardRun, standingsRun] = await Promise.all([
    fetchJson<EspnScoreboard>(scoreboardEndpoint, 60 * 3).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: undefined }),
    ),
    fetchJson<EspnStandings>(standingsEndpoint, 60 * 15).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: undefined }),
    ),
  ]);

  const scoreboard = mergeScoreboards([favoriteRun.scoreboard, cdnBoard, scoreboardRun.value]);
  const standings = standingsRun.value;
  const rawItems = [
    ...(scoreboard ? parseSportsScoreboard(scoreboard, config) : []),
    ...(scoreboard ? parseSportsHighlights(scoreboard, config) : []),
    ...(standings ? parseSportsStandings(standings, config) : []),
  ];
  const items = Array.from(new Map(rawItems.map((item) => [item.id, item])).values());

  return {
    items,
    scoreboardOk: scoreboardRun.ok || Boolean(cdnBoard),
    standingsOk: standingsRun.ok,
    favoriteScheduleOk: favoriteRun.attempted === 0 || favoriteRun.successful > 0,
    cdnOk: Boolean(cdnBoard || favoriteRun.scoreboard),
  };
}

/**
 * Archive-only sports acquisition. ESPN's CDN is the deployment-safe primary
 * for schedules/scoreboards; Site API calls are retained as enrichment rather
 * than a single point of failure. All recovered events still flow through the
 * same tested parser and personalization rules in sportsStateSources.ts.
 */
export async function getDeepSportsStateFeed(): Promise<FrontierFeedResponse> {
  const fulfilled: Awaited<ReturnType<typeof deepLeagueFeed>>[] = [];
  let transportFailures = 0;

  for (const config of FRONTIER_SPORTS_LEAGUES) {
    try {
      fulfilled.push(await deepLeagueFeed(config));
    } catch {
      transportFailures += 1;
    }
  }

  const items = Array.from(new Map(fulfilled.flatMap((run) => run.items).map((item) => [item.id, item])).values());
  const partialTransports = fulfilled.filter((run) => !run.scoreboardOk || !run.standingsOk).length;
  const favoriteFallbackFailures = fulfilled.filter((run) => !run.favoriteScheduleOk).length;
  const cdnFailures = fulfilled.filter((run) => !run.cdnOk).length;
  const favoritesPresent = items.filter((item) => item.tags.some((tag) => [
    'patriots', 'new england patriots', 'warriors', 'golden state warriors',
    'chelsea', 'chelsea fc', 'manchester city', 'man city',
  ].includes(tag))).length;
  const status: FrontierSourceStatus = {
    id: 'sports_state',
    label: 'Live sports state · deep archive',
    ok: items.length > 0,
    count: items.length,
    message: items.length
      ? [
          transportFailures ? `${transportFailures} league transport${transportFailures === 1 ? '' : 's'} failed` : '',
          partialTransports ? `${partialTransports} league${partialTransports === 1 ? '' : 's'} partial` : '',
          favoriteFallbackFailures ? `${favoriteFallbackFailures} favorite schedule fallback${favoriteFallbackFailures === 1 ? '' : 's'} failed` : '',
          cdnFailures ? `${cdnFailures} ESPN CDN lane${cdnFailures === 1 ? '' : 's'} unavailable` : '',
          favoritesPresent ? `${favoritesPresent} favorite-team state signal${favoritesPresent === 1 ? '' : 's'}` : 'no favorite-team state in current slate',
        ].filter(Boolean).join(' · ') || undefined
      : 'deep sports state acquisition returned no usable ESPN state',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
