import {
  FRONTIER_SPORTS_LEAGUES,
  parseSportsHighlights,
  parseSportsScoreboard,
  parseSportsStandings,
} from './sportsStateSources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-state-deep/1.2 (+https://sidhulyalkar.com/frontier)';
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

    // GitHub-hosted acquisition occasionally gets transient DNS/edge failures
    // when many requests hit the same ESPN host at once. Retry once with a
    // small deterministic backoff instead of stretching the request timeout.
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

async function preferredTeamSchedule(config: LeagueConfig, teamId: string): Promise<EspnScoreboard | undefined> {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/teams/${teamId}/schedule`;

  // The unqualified endpoint follows ESPN's active-season authority and avoids
  // edge cases where a calendar-year value maps differently across NFL, NBA,
  // and European soccer. Keep the explicit year as a bounded fallback for
  // off-season windows where the default slate can legitimately be empty.
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

  const payloads: EspnScoreboard[] = [];
  // Keep this lane deliberately narrow and sequential. Favorite-team state is
  // more valuable than broad league state, and avoiding a same-host burst makes
  // it much more reliable on CI/serverless transports.
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
}> {
  // Acquire the small personalized lane first. League-wide endpoints are useful
  // enrichment, but they must not starve Patriots/Warriors/Chelsea/City state.
  const favoriteRun = await favoriteTeamSchedules(config);
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

  // Merge rather than substitute so a successful full slate retains broad
  // utility while favorite-team schedule events are guaranteed representation.
  const scoreboard = mergeScoreboards([favoriteRun.scoreboard, scoreboardRun.value]);
  const standings = standingsRun.value;
  const rawItems = [
    ...(scoreboard ? parseSportsScoreboard(scoreboard, config) : []),
    ...(scoreboard ? parseSportsHighlights(scoreboard, config) : []),
    ...(standings ? parseSportsStandings(standings, config) : []),
  ];
  const items = Array.from(new Map(rawItems.map((item) => [item.id, item])).values());

  return {
    items,
    scoreboardOk: scoreboardRun.ok,
    standingsOk: standingsRun.ok,
    favoriteScheduleOk: favoriteRun.attempted === 0 || favoriteRun.successful > 0,
  };
}

/**
 * Archive-only sports acquisition. The request path deliberately keeps the
 * short transport in sportsStateSources.ts; this companion prioritizes small
 * favorite-team schedules, then enriches them with league-wide state. The deep
 * lanes run sequentially so same-host DNS/edge throttling cannot erase every
 * favorite at once during a cold archive build.
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
          favoritesPresent ? `${favoritesPresent} favorite-team state signal${favoritesPresent === 1 ? '' : 's'}` : 'no favorite-team state in current slate',
        ].filter(Boolean).join(' · ') || undefined
      : 'deep sports state acquisition returned no usable ESPN state',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
