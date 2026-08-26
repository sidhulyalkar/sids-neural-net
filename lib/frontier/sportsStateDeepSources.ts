import {
  FRONTIER_SPORTS_LEAGUES,
  parseSportsHighlights,
  parseSportsScoreboard,
  parseSportsStandings,
} from './sportsStateSources';
import type { FrontierFeedResponse, FrontierItem, FrontierSourceStatus } from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-state-deep/1.0 (+https://sidhulyalkar.com/frontier)';
const DEEP_FETCH_TIMEOUT_MS = 6_500;

type EspnScoreboard = Parameters<typeof parseSportsScoreboard>[0];
type EspnStandings = Parameters<typeof parseSportsStandings>[0];
type LeagueConfig = (typeof FRONTIER_SPORTS_LEAGUES)[number];

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEP_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

async function deepLeagueFeed(config: LeagueConfig): Promise<{
  items: FrontierItem[];
  scoreboardOk: boolean;
  standingsOk: boolean;
}> {
  const scoreboardEndpoint = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard`;
  const standingsEndpoint = `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`;
  const [scoreboardRun, standingsRun] = await Promise.allSettled([
    fetchJson<EspnScoreboard>(scoreboardEndpoint, 60 * 3),
    fetchJson<EspnStandings>(standingsEndpoint, 60 * 15),
  ]);
  const scoreboard = scoreboardRun.status === 'fulfilled' ? scoreboardRun.value : undefined;
  const standings = standingsRun.status === 'fulfilled' ? standingsRun.value : undefined;
  return {
    items: [
      ...(scoreboard ? parseSportsScoreboard(scoreboard, config) : []),
      ...(scoreboard ? parseSportsHighlights(scoreboard, config) : []),
      ...(standings ? parseSportsStandings(standings, config) : []),
    ],
    scoreboardOk: Boolean(scoreboard),
    standingsOk: Boolean(standings),
  };
}

/**
 * Archive-only sports acquisition. The request path deliberately keeps the
 * 3.2-second transport in sportsStateSources.ts; this companion spends a larger
 * bounded budget during the daily build so transient ESPN latency cannot erase
 * Patriots, Warriors, Chelsea, or Manchester City utility state from the
 * committed cold-start inventory.
 */
export async function getDeepSportsStateFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.allSettled(FRONTIER_SPORTS_LEAGUES.map(deepLeagueFeed));
  const fulfilled = runs.flatMap((run) => run.status === 'fulfilled' ? [run.value] : []);
  const items = fulfilled.flatMap((run) => run.items);
  const transportFailures = runs.filter((run) => run.status === 'rejected').length;
  const partialTransports = fulfilled.filter((run) => !run.scoreboardOk || !run.standingsOk).length;
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
          favoritesPresent ? `${favoritesPresent} favorite-team state signal${favoritesPresent === 1 ? '' : 's'}` : 'no favorite-team state in current slate',
        ].filter(Boolean).join(' · ') || undefined
      : 'deep sports state acquisition returned no usable ESPN state',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
