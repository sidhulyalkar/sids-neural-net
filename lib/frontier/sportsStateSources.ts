import type {
  FrontierFeedResponse,
  FrontierItem,
  FrontierLaneId,
  FrontierSportsCompetitor,
  FrontierSportsGame,
  FrontierSportsStanding,
  FrontierSourceStatus,
} from './types';

const USER_AGENT = 'sids-neural-net-frontier-sports-state/1.0 (+https://sidhulyalkar.com/frontier)';
const FETCH_TIMEOUT_MS = 3_200;
const DAY_MS = 86_400_000;

type FavoriteTeam = {
  abbreviations: readonly string[];
  tags: readonly string[];
};

export type FrontierSportsLeagueConfig = {
  id: string;
  sport: string;
  league: string;
  label: string;
  lane: FrontierLaneId;
  scoreboardUrl: string;
  standingsUrl: string;
  favoriteTeams: readonly FavoriteTeam[];
  tags: readonly string[];
};

export const FRONTIER_SPORTS_LEAGUES: readonly FrontierSportsLeagueConfig[] = [
  {
    id: 'nfl',
    sport: 'football',
    league: 'nfl',
    label: 'NFL',
    lane: 'sports',
    scoreboardUrl: 'https://www.espn.com/nfl/scoreboard',
    standingsUrl: 'https://www.espn.com/nfl/standings',
    favoriteTeams: [{ abbreviations: ['NE'], tags: ['new england patriots', 'patriots'] }],
    tags: ['nfl', 'football'],
  },
  {
    id: 'nba',
    sport: 'basketball',
    league: 'nba',
    label: 'NBA',
    lane: 'sports',
    scoreboardUrl: 'https://www.espn.com/nba/scoreboard',
    standingsUrl: 'https://www.espn.com/nba/standings',
    favoriteTeams: [{ abbreviations: ['GS', 'GSW'], tags: ['golden state warriors', 'warriors'] }],
    tags: ['nba', 'basketball'],
  },
  {
    id: 'premier-league',
    sport: 'soccer',
    league: 'eng.1',
    label: 'Premier League',
    lane: 'premier_league',
    scoreboardUrl: 'https://www.espn.com/soccer/scoreboard/_/league/eng.1',
    standingsUrl: 'https://www.espn.com/soccer/standings/_/league/eng.1',
    favoriteTeams: [
      { abbreviations: ['CHE'], tags: ['chelsea', 'chelsea fc'] },
      { abbreviations: ['MNC', 'MCI'], tags: ['manchester city', 'man city', 'mcfc'] },
    ],
    tags: ['premier league', 'soccer', 'football'],
  },
] as const;

type EspnLink = { href?: string; rel?: string[]; text?: string };
type EspnTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
};
type EspnCompetitor = {
  id?: string;
  homeAway?: 'home' | 'away';
  winner?: boolean;
  score?: string;
  team?: EspnTeam;
  records?: Array<{ name?: string; summary?: string }>;
};
type EspnHighlight = {
  id?: number | string;
  headline?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  originalPublishDate?: string;
  lastModified?: string;
  timeRestrictions?: { expirationDate?: string };
  links?: {
    source?: {
      href?: string;
      HD?: { href?: string };
    };
    web?: { href?: string; self?: { href?: string } };
  };
};
type EspnCompetition = {
  id?: string;
  date?: string;
  competitors?: EspnCompetitor[];
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      description?: string;
      detail?: string;
      shortDetail?: string;
    };
  };
  highlights?: EspnHighlight[];
  links?: EspnLink[];
};
type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: EspnCompetition[];
  links?: EspnLink[];
};
type EspnScoreboard = {
  events?: EspnEvent[];
};

type EspnStandingStat = {
  name?: string;
  abbreviation?: string;
  displayName?: string;
  value?: number;
  displayValue?: string;
};
type EspnStandingEntry = {
  team?: EspnTeam;
  stats?: EspnStandingStat[];
};
type EspnStandingNode = {
  children?: EspnStandingNode[];
  standings?: { entries?: EspnStandingEntry[] };
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function favoriteForAbbreviation(config: FrontierSportsLeagueConfig, abbreviation: string): FavoriteTeam | undefined {
  const upper = abbreviation.toUpperCase();
  return config.favoriteTeams.find((team) => team.abbreviations.some((candidate) => candidate === upper));
}

function favoriteTagsForEvent(config: FrontierSportsLeagueConfig, competition?: EspnCompetition): string[] {
  return (competition?.competitors ?? []).flatMap((competitor) => {
    const abbreviation = competitor.team?.abbreviation ?? '';
    return favoriteForAbbreviation(config, abbreviation)?.tags ?? [];
  });
}

function recordForCompetitor(competitor: EspnCompetitor): string | undefined {
  return competitor.records?.find((record) => record.name === 'overall')?.summary
    ?? competitor.records?.[0]?.summary;
}

function competitorForState(config: FrontierSportsLeagueConfig, competitor: EspnCompetitor, showScore: boolean): FrontierSportsCompetitor {
  const abbreviation = competitor.team?.abbreviation ?? '';
  return {
    id: competitor.id ?? competitor.team?.id,
    name: competitor.team?.displayName ?? competitor.team?.name ?? abbreviation || 'Team',
    shortName: competitor.team?.shortDisplayName ?? competitor.team?.name ?? abbreviation || 'Team',
    abbreviation,
    score: showScore ? competitor.score : undefined,
    record: recordForCompetitor(competitor),
    homeAway: competitor.homeAway,
    favorite: Boolean(favoriteForAbbreviation(config, abbreviation)),
    winner: competitor.winner,
  };
}

function eventWebUrl(event: EspnEvent, competition: EspnCompetition | undefined, fallback: string): string {
  const links = [...(event.links ?? []), ...(competition?.links ?? [])];
  return links.find((link) => link.href?.startsWith('https://www.espn.com/'))?.href ?? fallback;
}

function gameForEvent(config: FrontierSportsLeagueConfig, event: EspnEvent): FrontierSportsGame | undefined {
  const competition = event.competitions?.[0];
  if (!event.id || !competition) return undefined;
  const state = competition.status?.type?.state ?? 'pre';
  const completed = Boolean(competition.status?.type?.completed || state === 'post');
  const live = state === 'in';
  const date = competition.date ?? event.date;
  if (!date || Number.isNaN(Date.parse(date))) return undefined;
  return {
    id: event.id,
    date: new Date(date).toISOString(),
    status: competition.status?.type?.shortDetail
      ?? competition.status?.type?.detail
      ?? competition.status?.type?.description
      ?? (completed ? 'Final' : live ? 'Live' : 'Scheduled'),
    detail: competition.status?.type?.detail,
    live,
    completed,
    competitors: (competition.competitors ?? []).map((competitor) => competitorForState(config, competitor, completed || live)),
    url: eventWebUrl(event, competition, config.scoreboardUrl),
  };
}

function gamePriority(config: FrontierSportsLeagueConfig, event: EspnEvent, now: number): number {
  const competition = event.competitions?.[0];
  const favorite = favoriteTagsForEvent(config, competition).length > 0;
  const state = competition?.status?.type?.state;
  const eventAt = Date.parse(competition?.date ?? event.date ?? '') || now;
  const distanceDays = Math.abs(eventAt - now) / DAY_MS;
  return (favorite ? 100 : 0) + (state === 'in' ? 50 : state === 'post' ? 20 : 30) - Math.min(25, distanceDays);
}

function summarizeGames(games: FrontierSportsGame[]): string {
  const live = games.filter((game) => game.live).length;
  const finals = games.filter((game) => game.completed).length;
  const upcoming = games.filter((game) => !game.live && !game.completed).length;
  const parts = [
    live ? `${live} live` : '',
    finals ? `${finals} final${finals === 1 ? '' : 's'}` : '',
    upcoming ? `${upcoming} upcoming` : '',
  ].filter(Boolean);
  const favorite = games.find((game) => game.competitors.some((team) => team.favorite));
  if (!favorite) return parts.join(' · ') || 'Current games and schedule.';
  const matchup = favorite.competitors.map((team) => team.abbreviation || team.shortName).join(' · ');
  return `${parts.join(' · ') || 'Current slate'} · ${matchup} ${favorite.status}`;
}

export function parseSportsScoreboard(payload: EspnScoreboard, config: FrontierSportsLeagueConfig, now = Date.now()): FrontierItem[] {
  const rankedEvents = [...(payload.events ?? [])]
    .filter((event) => event.id && event.competitions?.[0])
    .sort((left, right) => gamePriority(config, right, now) - gamePriority(config, left, now));
  const games = rankedEvents.flatMap((event) => {
    const game = gameForEvent(config, event);
    return game ? [game] : [];
  }).slice(0, 6);
  if (!games.length) return [];

  const favoriteTags = rankedEvents.slice(0, 6).flatMap((event) => favoriteTagsForEvent(config, event.competitions?.[0]));
  const liveCount = games.filter((game) => game.live).length;
  const favoriteLive = games.some((game) => game.live && game.competitors.some((team) => team.favorite));
  const importance = favoriteLive ? 0.88 : liveCount ? 0.8 : favoriteTags.length ? 0.74 : 0.66;
  const freshness = 1;
  const quality = 0.86;
  const momentum = liveCount ? 0.82 : 0.58;
  const novelty = 0.35;
  const baseScore = clamp(importance * 0.34 + quality * 0.28 + momentum * 0.18 + freshness * 0.14 + novelty * 0.06);

  return [{
    id: `sports-state-${config.id}-scoreboard-${new Date(now).toISOString().slice(0, 10)}`,
    title: `${config.label} · scores + schedule`,
    summary: summarizeGames(games),
    url: config.scoreboardUrl,
    source: 'espn.com',
    sourceLabel: `ESPN · ${config.label}`,
    sourceKind: 'sports_state' as const,
    publishedAt: new Date(now).toISOString(),
    lane: config.lane,
    tags: Array.from(new Set([
      ...config.tags,
      ...favoriteTags,
      'sports state', 'scores', 'scoreboard', 'schedule', 'games', 'results', 'today',
    ])).slice(0, 14),
    sportsState: { kind: 'scoreboard', league: config.id, leagueLabel: config.label, games },
    metrics: [
      { label: 'live', value: String(liveCount) },
      { label: 'final', value: String(games.filter((game) => game.completed).length) },
      { label: 'upcoming', value: String(games.filter((game) => !game.live && !game.completed).length) },
    ],
    importance,
    quality,
    momentum,
    novelty,
    baseScore,
    why: `Current ${config.label} scores and schedule are a utility layer, separate from editorial sports recommendations.`,
  } satisfies FrontierItem];
}

function collectStandingEntries(node: EspnStandingNode, out: EspnStandingEntry[] = []): EspnStandingEntry[] {
  if (node.standings?.entries?.length) out.push(...node.standings.entries);
  for (const child of node.children ?? []) collectStandingEntries(child, out);
  return out;
}

function stat(entry: EspnStandingEntry, names: readonly string[]): EspnStandingStat | undefined {
  const normalized = names.map((name) => name.toLowerCase());
  return entry.stats?.find((candidate) => {
    const keys = [candidate.name, candidate.abbreviation, candidate.displayName]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return keys.some((key) => normalized.includes(key));
  });
}

function standingRecord(entry: EspnStandingEntry): string | undefined {
  const direct = stat(entry, ['overall', 'record'])?.displayValue;
  if (direct) return direct;
  const wins = stat(entry, ['wins', 'w'])?.displayValue;
  const losses = stat(entry, ['losses', 'l'])?.displayValue;
  const ties = stat(entry, ['ties', 't', 'draws', 'd'])?.displayValue;
  if (!wins && !losses && !ties) return undefined;
  return [wins ?? '0', losses ?? '0', ...(ties && ties !== '0' ? [ties] : [])].join('-');
}

export function parseSportsStandings(payload: EspnStandingNode, config: FrontierSportsLeagueConfig): FrontierItem[] {
  const entries = collectStandingEntries(payload);
  const seen = new Set<string>();
  const rows: FrontierSportsStanding[] = entries.flatMap((entry, index) => {
    const abbreviation = entry.team?.abbreviation ?? '';
    const name = entry.team?.displayName ?? entry.team?.name ?? abbreviation;
    const key = entry.team?.id ?? abbreviation ?? name;
    if (!name || !key || seen.has(key)) return [];
    seen.add(key);
    const rankStat = stat(entry, ['rank', 'playoffseed', 'playoff seed', 'seed']);
    const rank = Math.max(1, Math.round(rankStat?.value ?? Number(rankStat?.displayValue) || index + 1));
    const points = stat(entry, ['points', 'pts'])?.displayValue;
    return [{
      rank,
      team: name,
      abbreviation,
      record: standingRecord(entry),
      points,
      favorite: Boolean(favoriteForAbbreviation(config, abbreviation)),
    }];
  });
  if (!rows.length) return [];

  rows.sort((left, right) => left.rank - right.rank || left.team.localeCompare(right.team));
  const favorites = rows.filter((row) => row.favorite);
  const selected = Array.from(new Map(
    [...favorites, ...rows.slice(0, 8)].map((row) => [row.abbreviation || row.team, row])
  ).values()).slice(0, 10);
  const favoriteTags = favorites.flatMap((row) => favoriteForAbbreviation(config, row.abbreviation)?.tags ?? []);

  return [{
    id: `sports-state-${config.id}-standings`,
    title: `${config.label} · standings`,
    summary: favorites.length
      ? `${favorites.map((row) => `${row.abbreviation} #${row.rank}${row.record ? ` · ${row.record}` : ''}`).join(' · ')} · current table`
      : `Current ${config.label} table and records.`,
    url: config.standingsUrl,
    source: 'espn.com',
    sourceLabel: `ESPN · ${config.label}`,
    sourceKind: 'sports_state' as const,
    publishedAt: new Date().toISOString(),
    lane: config.lane,
    tags: Array.from(new Set([
      ...config.tags,
      ...favoriteTags,
      'sports state', 'standings', 'table', 'rankings', 'records',
    ])).slice(0, 14),
    sportsState: { kind: 'standings', league: config.id, leagueLabel: config.label, standings: selected },
    metrics: [
      { label: 'teams', value: String(rows.length) },
      ...(favorites[0] ? [{ label: favorites[0].abbreviation || 'favorite', value: `#${favorites[0].rank}` }] : []),
    ],
    importance: favorites.length ? 0.7 : 0.6,
    quality: 0.86,
    momentum: 0.45,
    novelty: 0.28,
    baseScore: favorites.length ? 0.72 : 0.64,
    why: `Current ${config.label} standings stay searchable without turning FRONTIER into a dedicated sports app.`,
  } satisfies FrontierItem];
}

function isHighlightExpired(highlight: EspnHighlight, now: number): boolean {
  const expiration = highlight.timeRestrictions?.expirationDate;
  return Boolean(expiration && Number.isFinite(Date.parse(expiration)) && Date.parse(expiration) <= now);
}

export function parseSportsHighlights(payload: EspnScoreboard, config: FrontierSportsLeagueConfig, now = Date.now()): FrontierItem[] {
  const candidates = (payload.events ?? []).flatMap((event) => {
    const competition = event.competitions?.[0];
    const favoriteTags = favoriteTagsForEvent(config, competition);
    const favorite = favoriteTags.length > 0;
    return (competition?.highlights ?? []).flatMap((highlight) => {
      const videoUrl = highlight.links?.source?.HD?.href ?? highlight.links?.source?.href;
      const sourceUrl = highlight.links?.web?.self?.href ?? highlight.links?.web?.href;
      const title = highlight.headline ?? highlight.description;
      if (!highlight.id || !videoUrl || !sourceUrl || !title || isHighlightExpired(highlight, now)) return [];
      const publishedRaw = highlight.originalPublishDate ?? highlight.lastModified ?? competition?.date ?? event.date;
      const publishedAt = publishedRaw && Number.isFinite(Date.parse(publishedRaw))
        ? new Date(publishedRaw).toISOString()
        : new Date(now).toISOString();
      return [{ event, competition, highlight, favoriteTags, favorite, title, videoUrl, sourceUrl, publishedAt }];
    });
  });

  return candidates
    .sort((left, right) => Number(right.favorite) - Number(left.favorite)
      || Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 2)
    .map((candidate) => {
      const quality = 0.82;
      const importance = candidate.favorite ? 0.76 : 0.64;
      const momentum = 0.68;
      const novelty = 0.5;
      const ageDays = Math.max(0, (now - Date.parse(candidate.publishedAt)) / DAY_MS);
      const freshness = Math.exp(-ageDays / 3);
      const baseScore = clamp(importance * 0.3 + quality * 0.25 + momentum * 0.17 + freshness * 0.18 + novelty * 0.1);
      return {
        id: `sports-highlight-${config.id}-${stableId(String(candidate.highlight.id))}`,
        title: candidate.title,
        summary: candidate.highlight.description ?? `${config.label} highlight from ESPN.`,
        url: candidate.sourceUrl,
        source: 'espn.com',
        sourceLabel: `ESPN · ${config.label}`,
        sourceKind: 'sports_state' as const,
        publishedAt: candidate.publishedAt,
        lane: candidate.favorite ? 'team_pulse' as const : config.lane,
        tags: Array.from(new Set([
          ...config.tags,
          ...candidate.favoriteTags,
          'sports highlight', 'highlight', 'watchable', 'video', 'direct video',
        ])).slice(0, 14),
        media: {
          type: 'video' as const,
          url: candidate.videoUrl,
          poster: candidate.highlight.thumbnail,
          alt: candidate.title,
          aspectRatio: 'wide' as const,
          duration: candidate.highlight.duration,
        },
        actionLabel: 'Watch highlight',
        importance,
        quality,
        momentum,
        novelty,
        baseScore,
        why: 'A source-hosted sports highlight replaces fragile rights-blocked third-party embeds when a direct clip is available.',
      } satisfies FrontierItem;
    });
}

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

async function leagueFeed(config: FrontierSportsLeagueConfig): Promise<FrontierItem[]> {
  const scoreboardEndpoint = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.league}/scoreboard`;
  const standingsEndpoint = `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`;
  const [scoreboardRun, standingsRun] = await Promise.allSettled([
    fetchJson<EspnScoreboard>(scoreboardEndpoint, 60 * 3),
    fetchJson<EspnStandingNode>(standingsEndpoint, 60 * 15),
  ]);
  const scoreboard = scoreboardRun.status === 'fulfilled' ? scoreboardRun.value : undefined;
  const standings = standingsRun.status === 'fulfilled' ? standingsRun.value : undefined;
  return [
    ...(scoreboard ? parseSportsScoreboard(scoreboard, config) : []),
    ...(scoreboard ? parseSportsHighlights(scoreboard, config) : []),
    ...(standings ? parseSportsStandings(standings, config) : []),
  ];
}

export async function getSportsStateFeed(): Promise<FrontierFeedResponse> {
  const runs = await Promise.allSettled(FRONTIER_SPORTS_LEAGUES.map(leagueFeed));
  const items = runs.flatMap((run) => run.status === 'fulfilled' ? run.value : []);
  const failures = runs.filter((run) => run.status === 'rejected').length;
  const status: FrontierSourceStatus = {
    id: 'sports_state',
    label: 'Live sports state',
    ok: items.length > 0,
    count: items.length,
    message: items.length
      ? (failures ? `${failures} league feed${failures === 1 ? '' : 's'} degraded` : undefined)
      : 'live sports scoreboards temporarily unavailable',
  };
  return { generatedAt: new Date().toISOString(), items, sources: [status] };
}
