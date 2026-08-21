import tasteProfile from '@/content/music/taste-profile.json';
import type { FrontierLaneId, FrontierRealm } from './types';

export type FrontierInterestTopic = {
  id: string;
  label: string;
  realm: Exclude<FrontierRealm, 'all'>;
  aliases: string[];
  glyph: string;
};

export type FrontierGameInterest = {
  title: string;
  aliases?: string[];
  steamAppId?: number;
  weight: number;
};

export const FRONTIER_TEAMS = [
  {
    id: 'patriots',
    label: 'New England Patriots',
    aliases: ['new england patriots', 'patriots', 'pats'],
    tags: ['new england patriots', 'patriots', 'nfl'],
  },
  {
    id: 'warriors',
    label: 'Golden State Warriors',
    aliases: ['golden state warriors', 'warriors', 'dubs', 'dub nation'],
    tags: ['golden state warriors', 'warriors', 'nba'],
  },
  {
    id: 'chelsea',
    label: 'Chelsea FC',
    aliases: ['chelsea fc', 'chelsea football club', 'chelsea', 'cfc'],
    tags: ['chelsea', 'chelsea fc', 'premier league'],
  },
  {
    id: 'man-city',
    label: 'Manchester City',
    aliases: ['manchester city', 'man city', 'mcfc'],
    tags: ['manchester city', 'man city', 'premier league'],
  },
] as const;

/**
 * Seeded from the Steam-library snapshot supplied for FRONTIER. App IDs are
 * included only for titles we want to poll through Steam's public news feed.
 */
export const FRONTIER_GAME_LIBRARY: FrontierGameInterest[] = [
  { title: 'ELDEN RING', aliases: ['elden ring'], steamAppId: 1245620, weight: 1.0 },
  { title: 'ENDER LILIES: Quietus of the Knights', aliases: ['ender lilies'], steamAppId: 1369630, weight: 1.0 },
  { title: 'Hollow Knight: Silksong', aliases: ['silksong', 'hollow knight silksong'], steamAppId: 1030300, weight: 0.98 },
  { title: 'Hollow Knight', aliases: ['hollow knight'], steamAppId: 367520, weight: 0.94 },
  { title: 'Nine Sols', aliases: ['nine sols'], steamAppId: 1809540, weight: 0.92 },
  { title: 'Dead Cells', aliases: ['dead cells'], steamAppId: 588650, weight: 0.9 },
  { title: 'Celeste', steamAppId: 504230, weight: 0.88 },
  { title: 'TUNIC', aliases: ['tunic'], steamAppId: 553420, weight: 0.86 },
  { title: 'Rain World', steamAppId: 312520, weight: 0.84 },
  { title: 'Outer Wilds', steamAppId: 753640, weight: 0.84 },
  { title: 'Ori and the Will of the Wisps', aliases: ['ori and the will of the wisps', 'ori'], steamAppId: 1057090, weight: 0.82 },
  { title: 'Cyberpunk 2077', steamAppId: 1091500, weight: 0.78 },
  { title: 'Deep Rock Galactic', steamAppId: 548430, weight: 0.76 },
  { title: 'Lethal Company', steamAppId: 1966720, weight: 0.76 },
  { title: 'Valheim', steamAppId: 892970, weight: 0.74 },
  { title: 'V Rising', steamAppId: 1604030, weight: 0.72 },
  { title: 'ASTRONEER', aliases: ['astroneer'], steamAppId: 361420, weight: 0.7 },
  { title: 'The Binding of Isaac: Rebirth', aliases: ['binding of isaac', 'isaac rebirth'], steamAppId: 250900, weight: 0.7 },
  { title: "Another Crab's Treasure", aliases: ['another crabs treasure', "another crab's treasure"], steamAppId: 1887840, weight: 0.7 },
  { title: 'Palworld', steamAppId: 1623730, weight: 0.68 },
  { title: 'ULTRAKILL', aliases: ['ultrakill'], steamAppId: 1229490, weight: 0.66 },
  { title: 'Blasphemous 2', aliases: ['blasphemous 2'], weight: 0.78 },
  { title: 'ENDER MAGNOLIA: Bloom in the Mist', aliases: ['ender magnolia'], weight: 0.86 },
  { title: 'Have a Nice Death', weight: 0.76 },
  { title: 'Haiku, the Robot', aliases: ['haiku the robot'], weight: 0.7 },
  { title: 'MIO: Memories in Orbit', aliases: ['mio memories in orbit'], weight: 0.72 },
  { title: 'Spiritfarer', aliases: ['spiritfarer'], weight: 0.68 },
  { title: 'Crab Champions', aliases: ['crab champions'], weight: 0.64 },
  { title: 'Marvel Rivals', aliases: ['marvel rivals'], weight: 0.62 },
  { title: 'Splitgate', aliases: ['splitgate'], weight: 0.6 },
];

type TasteArtist = { name: string; rank?: number };
const spotifyArtists = [
  ...((tasteProfile.topArtists ?? []) as TasteArtist[]),
  ...((tasteProfile.followedArtists ?? []) as TasteArtist[]),
]
  .filter((artist) => artist?.name)
  .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

export const FRONTIER_MUSIC_ARTISTS = Array.from(
  new Set(spotifyArtists.map((artist) => artist.name.trim()).filter(Boolean))
);

export const FRONTIER_SOUNDCLOUD_PROFILE = 'https://soundcloud.com/sidharth-hulyalkar/';

/** Every subreddit from the supplied subscription snapshot. */
export const FRONTIER_FOLLOWED_SUBREDDITS = [
  'AbandonedPorn', 'AnimalsBeingBros', 'AnimalsBeingDerps', 'announcements', 'Art', 'AskReddit',
  'askscience', 'Astroneer', 'aww', 'battlestations', 'BCI', 'BeAmazed', 'bioengineering', 'Biohackers',
  'bioinformatics', 'blackmagicfuckery', 'bouldering', 'BrainHackersLab', 'BrandNewSentence', 'ClashOfClans',
  'climbing', 'ClimbingPorn', 'computationalneuro', 'creepy', 'Damnthatsinteresting', 'dataisbeautiful',
  'deadcells', 'DIY', 'dubstep', 'EarthPorn', 'EDM', 'Eldenring', 'electricdaisycarnival', 'EngineeringPorn',
  'explainlikeimfive', 'ExposurePorn', 'food', 'funny', 'Futurology', 'gadgets', 'GetMotivated', 'gifs',
  'HollowKnight', 'houston', 'HumansBeingBros', 'husky', 'HuskyTantrums', 'IAmA', 'IASIP', 'Illenium',
  'imageprocessing', 'interestingasfuck', 'InternetIsBeautiful', 'Jokes', 'LifeProTips', 'listentothis',
  'MachineLearning', 'MapPorn', 'mildlyinteresting', 'mountainbiking', 'movies', 'MTB', 'Music',
  'NatureIsFuckingLit', 'nba', 'neurallace', 'neuroengineering', 'neuroscience', 'news', 'nextfuckinglevel',
  'nosleep', 'nottheonion', 'OldSchoolCool', 'pcmasterrace', 'PerfectTiming', 'photoshopbattles', 'pics',
  'ProgrammerHumor', 'rarepuppers', 'science', 'Showerthoughts', 'Silksong', 'SilksongIsntReal', 'singularity',
  'SipsTea', 'skiing', 'soccer', 'space', 'spaceporn', 'sports', 'technology', 'television', 'ThatsInsane',
  'TheBoys', 'theydidthemath', 'tifu', 'todayilearned',
] as const;

const SUBREDDIT_GROUPS = {
  learn: [
    'MachineLearning', 'computationalneuro', 'neuroscience', 'neuroengineering', 'neurallace', 'BCI',
    'BrainHackersLab', 'bioinformatics', 'bioengineering', 'science', 'askscience', 'dataisbeautiful',
    'imageprocessing', 'technology', 'Futurology', 'singularity', 'EngineeringPorn', 'theydidthemath',
  ],
  gamesMusic: [
    'Eldenring', 'HollowKnight', 'Silksong', 'SilksongIsntReal', 'deadcells', 'Astroneer', 'pcmasterrace',
    'dubstep', 'EDM', 'Illenium', 'electricdaisycarnival', 'listentothis', 'Music',
  ],
  culture: [
    'Damnthatsinteresting', 'interestingasfuck', 'SipsTea', 'BrandNewSentence', 'ProgrammerHumor',
    'nottheonion', 'Showerthoughts', 'todayilearned', 'funny', 'gifs', 'mildlyinteresting', 'nextfuckinglevel',
    'InternetIsBeautiful', 'PerfectTiming', 'blackmagicfuckery', 'ThatsInsane',
  ],
  life: [
    'mountainbiking', 'MTB', 'bouldering', 'climbing', 'ClimbingPorn', 'skiing', 'husky', 'HuskyTantrums',
    'AnimalsBeingBros', 'AnimalsBeingDerps', 'aww', 'rarepuppers', 'NatureIsFuckingLit', 'EarthPorn',
    'ExposurePorn', 'spaceporn', 'AbandonedPorn', 'Art', 'food',
  ],
} as const;

const TEAM_SUBREDDITS = ['Patriots', 'warriors', 'chelseafc', 'MCFC'] as const;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotatePick(values: readonly string[], count: number, seed: number): string[] {
  if (!values.length || count <= 0) return [];
  const start = seed % values.length;
  return Array.from({ length: Math.min(count, values.length) }, (_, index) => values[(start + index) % values.length]);
}

export function pickDailySubreddits(dayKey: string, custom: string[] = []): string[] {
  const seed = hashString(dayKey);
  return Array.from(new Set([
    ...TEAM_SUBREDDITS,
    ...rotatePick(SUBREDDIT_GROUPS.learn, 2, seed + 3),
    ...rotatePick(SUBREDDIT_GROUPS.gamesMusic, 2, seed + 7),
    ...rotatePick(SUBREDDIT_GROUPS.culture, 2, seed + 11),
    ...rotatePick(SUBREDDIT_GROUPS.life, 2, seed + 17),
    ...rotatePick(FRONTIER_FOLLOWED_SUBREDDITS, 1, seed + 23),
    ...custom,
  ])).slice(0, 15);
}

export function pickDailySteamGames(dayKey: string): FrontierGameInterest[] {
  const newsGames = FRONTIER_GAME_LIBRARY.filter((game) => game.steamAppId);
  const favorites = newsGames.slice(0, 2);
  const rotation = newsGames.slice(2);
  const seed = hashString(dayKey);
  const rotated = rotatePick(rotation.map((game) => String(game.steamAppId)), 4, seed + 31);
  const byId = new Map(newsGames.map((game) => [String(game.steamAppId), game]));
  return Array.from(new Map(
    [...favorites, ...rotated.flatMap((id) => byId.get(id) ? [byId.get(id)!] : [])]
      .map((game) => [game.title, game])
  ).values());
}

export const FRONTIER_PINNED_TOPICS: FrontierInterestTopic[] = [
  { id: 'new-papers', label: 'New papers', realm: 'learn', glyph: '§', aliases: ['paper', 'study', 'research', 'openalex'] },
  { id: 'open-source', label: 'Open source', realm: 'learn', glyph: '⌘', aliases: ['github', 'open source', 'repository', 'library'] },
  { id: 'neuroai', label: 'NeuroAI', realm: 'learn', glyph: '⌁', aliases: ['neuroai', 'neuroscience', 'neural decoding', 'bci'] },
  { id: 'ml-data', label: 'ML + data', realm: 'learn', glyph: '▦', aliases: ['machine learning', 'data analysis', 'statistics', 'causal'] },
  { id: 'patriots', label: 'Patriots', realm: 'play', glyph: 'NE', aliases: ['new england patriots', 'patriots', 'pats'] },
  { id: 'warriors', label: 'Warriors', realm: 'play', glyph: 'GS', aliases: ['golden state warriors', 'warriors', 'dubs', 'dub nation'] },
  { id: 'chelsea', label: 'Chelsea', realm: 'play', glyph: 'CFC', aliases: ['chelsea fc', 'chelsea football club', 'chelsea', 'cfc'] },
  { id: 'man-city', label: 'Man City', realm: 'play', glyph: 'MC', aliases: ['manchester city', 'man city', 'mcfc'] },
  { id: 'bass', label: 'Bass orbit', realm: 'play', glyph: '♫', aliases: ['dubstep', 'edm', 'bass music', ...FRONTIER_MUSIC_ARTISTS] },
  { id: 'games', label: 'Game radar', realm: 'play', glyph: '▣', aliases: ['metroidvania', 'roguelike', 'indie game', ...FRONTIER_GAME_LIBRARY.flatMap((game) => [game.title, ...(game.aliases ?? [])])] },
  { id: 'memes', label: 'Internet gold', realm: 'play', glyph: '☺', aliases: ['meme', 'funny', 'shitpost', 'viral', 'reddit', 'humor'] },
];

function includesAlias(text: string, aliases: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

export function personalLaneForText(text: string): FrontierLaneId | undefined {
  if (FRONTIER_TEAMS.some((team) => includesAlias(text, team.aliases))) return 'team_pulse';
  if (FRONTIER_GAME_LIBRARY.some((game) => includesAlias(text, [game.title, ...(game.aliases ?? [])]))) return 'gaming';
  if (includesAlias(text, ['dubstep', 'edm', 'bass music', 'bass music festival', ...FRONTIER_MUSIC_ARTISTS])) return 'music';
  if (includesAlias(text, ['meme', 'shitpost', 'funny clip', 'viral post'])) return 'internet_culture';
  return undefined;
}

export function personalInterestTags(text: string): string[] {
  const tags: string[] = [];
  for (const team of FRONTIER_TEAMS) {
    if (includesAlias(text, team.aliases)) tags.push(...team.tags);
  }
  for (const game of FRONTIER_GAME_LIBRARY) {
    if (includesAlias(text, [game.title, ...(game.aliases ?? [])])) tags.push(game.title.toLowerCase());
  }
  for (const artist of FRONTIER_MUSIC_ARTISTS) {
    if (text.toLowerCase().includes(artist.toLowerCase())) tags.push(artist.toLowerCase());
  }
  if (includesAlias(text, ['dubstep', 'edm', 'bass music'])) tags.push('bass music');
  return Array.from(new Set(tags)).slice(0, 8);
}

export function topicMatchesItem(topic: FrontierInterestTopic, text: string): boolean {
  return includesAlias(text, topic.aliases);
}
