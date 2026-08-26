import {
  FRONTIER_SPORTS_LEAGUES,
  parseSportsHighlights,
  parseSportsScoreboard,
  parseSportsStandings,
} from './sportsStateSources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-state-deep/1.1 (+https://sidhulyalkar.com/frontier)';
const DEEP_FETCH_TIMEOUT_MS = 6_500;
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

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
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
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
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

async function favoriteTeamSchedules(config: LeagueConfig): Promise<{
  scoreboard?: EspnScoreboard;
  successful: number;
  attempted: number;
}> {
  const teamIds = FAVORITE_TEAM_IDS[config.id] ?? [];
  if (!teamIds.length) return { successful: 0, attempted: 0 };

  const runs = await Promise.allSettled(teamIds.map((teamId) => {
    const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/teams/${teamId}/schedule`);
    url.searchParams.set('season', String(CURRENT_SEASON));
    return fetchJson<EspnScoreboard>(url.toString(), 60 * 15);
  }));
  const payloads = runs.flatMap((run) => run.status === 'fulfilled' ? [run.value] : []);
  return {
    scoreboard: mergeScoreboards(payloads),
    successful: payloads.length,
    attempted: runs.length,
  };
}

async function deepLeagueFeed(config: LeagueConfig): Promise<{
  items: FrontierItem[];
  scoreboardOk: boolean;
  standingsOk: boolean;
  favoriteScheduleOk: boolean;
}> {
  const scoreboardEndpoint = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard`;
  const standingsEndpoint = `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`;
  const [scoreboardRun, standingsRun, favoriteRun] = await Promise.all([
    fetchJson<EspnScoreboard>(scoreboardEndpoint, 60 * 3).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: undefined }),
    ),
    fetchJson<EspnStandings>(standingsEndpoint, 60 * 15).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: undefined }),
    ),
    favoriteTeamSchedules(config),
  ]);

  // Favorite-team schedules are much smaller than league-wide scoreboards and
  // make a reliable archive fallback on constrained CI/serverless transports.
  // Merge rather than substitute so a successful full slate retains broad
  // utility while the favorite events are guaranteed to be represented.
  const scoreboard = mergeScoreboards([scoreboardRun.value, favoriteRun.scoreboard]);
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
 * short transport in sportsStateSources.ts; this companion spends a larger
 * bounded budget during the daily build and has small favorite-team schedule
 * fallbacks so transient league-wide ESPN latency cannot erase Patriots,
 * Warriors, Chelsea, or Manchester City state from cold start.
 */
export async function getDeepSportsStateFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.allSettled(FRONTIER_SPORTS_LEAGUES.map(deepLeagueFeed));
  const fulfilled = runs.flatMap((run) => run.status === 'fulfilled' ? [run.value] : []);
  const items = Array.from(new Map(fulfilled.flatMap((run) => run.items).map((item) => [item.id, item])).values());
  const transportFailures = runs.filter((run) => run.status === 'rejected').length;
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
