export type FrontierScreenMatch = {
  title: string;
  tags: string[];
  prior: number;
};

/**
 * Explicit screen-history taste supplied by the owner. These are preference
 * anchors, not a claim that every future item about a franchise is useful.
 * Ranking still requires freshness, source provenance, learned behavior and
 * finite-run diversity.
 */
export const FRONTIER_ANIME_FAVORITES = [
  'Re:ZERO -Starting Life in Another World-',
  'Mushoku Tensei: Jobless Reincarnation',
  "Frieren: Beyond Journey's End",
  "Hell's Paradise",
  'JUJUTSU KAISEN',
  'Fire Force',
  'TSUKIMICHI -Moonlit Fantasy-',
  'The Water Magician',
  'DAN DA DAN',
  'Kabaneri of the Iron Fortress',
  'The Apothecary Diaries',
  'Kaiju No. 8',
  'Shangri-La Frontier',
  'Solo Leveling',
  'BLUE LOCK',
  'The Rising of the Shield Hero',
  'Tower of God',
  'Haikyu!!',
  'Wistoria: Wand and Sword',
  'The God of High School',
  'That Time I Got Reincarnated as a Slime',
  'My Hero Academia',
  'Demon Slayer: Kimetsu no Yaiba',
  'Ranking of Kings',
  'Golden Kamuy',
  'Attack on Titan',
  'Tokyo Ghoul',
  'The Faraway Paladin',
  'Kaguya-sama: Love is War',
  'The Case Study of Vanitas',
  'Undead Murder Farce',
  'THE PROMISED NEVERLAND',
  'Dr. STONE',
  'VINLAND SAGA',
  'MASHLE: MAGIC AND MUSCLES',
  'Fullmetal Alchemist: Brotherhood',
  'SPY x FAMILY',
  'PSYCHO-PASS',
  'Overlord: The Undead King',
  'Deadman Wonderland',
  'Death Note',
  'The Summer Hikaru Died',
  'Scissor Seven',
] as const;

export const FRONTIER_NETFLIX_SCREEN_FAVORITES = [
  'BEEF',
  'Alpha Males',
  'Breaking Bad',
  'Avatar: The Last Airbender',
  'Arrested Development',
  'BoJack Horseman',
  'Trailer Park Boys',
  'Brooklyn Nine-Nine',
  'Disenchantment',
  'Big Mouth',
  'Homeland',
  'Cobra Kai',
  'Death Note',
  'Inside Job',
  'DAN DA DAN',
  'Happy Gilmore 2',
  'Black Mirror',
  'Stranger Things',
  'Paradise PD',
  'Balls of Fury',
  'The Midnight Gospel',
  'The Summer Hikaru Died',
  'Scissor Seven',
  'Trailer Park Boys: The Animated Series',
  'Fixed',
  'Dead to Me',
  'The Fast and the Furious: Tokyo Drift',
  '13 Reasons Why',
  'Wallace & Gromit: Vengeance Most Fowl',
  'Despicable Me 3',
  'The Brothers Sun',
  '2 Fast 2 Furious',
  'Ghostbusters',
  'Maniac',
  'Hoops',
  'The Ridiculous 6',
  'Bad Trip',
  'Red Notice',
  'jackass 4.5',
  'Blockbuster',
  'The Platform 2',
  'Murderville',
  'Game Over, Man!',
  'The Fundamentals of Caring',
  'America: The Motion Picture',
  'Nick Kroll: Little Big Boy',
  'Hasan Minhaj: Homecoming King',
  'When We First Met',
] as const;

const TITLE_ALIASES: Record<string, readonly string[]> = {
  'Re:ZERO -Starting Life in Another World-': ['re zero', 're:zero'],
  'Mushoku Tensei: Jobless Reincarnation': ['mushoku tensei', 'jobless reincarnation'],
  "Frieren: Beyond Journey's End": ['frieren'],
  "Hell's Paradise": ['hells paradise', 'jigokuraku'],
  'JUJUTSU KAISEN': ['jujutsu kaisen', 'jjk'],
  'TSUKIMICHI -Moonlit Fantasy-': ['tsukimichi', 'moonlit fantasy'],
  'DAN DA DAN': ['dan da dan', 'dandadan'],
  'Kaiju No. 8': ['kaiju no 8', 'kaiju no. 8'],
  'BLUE LOCK': ['blue lock'],
  'Haikyu!!': ['haikyu', 'haikyuu'],
  'That Time I Got Reincarnated as a Slime': ['reincarnated as a slime', 'tensura'],
  'Demon Slayer: Kimetsu no Yaiba': ['demon slayer', 'kimetsu no yaiba'],
  'Kaguya-sama: Love is War': ['kaguya sama', 'love is war'],
  'THE PROMISED NEVERLAND': ['promised neverland'],
  'Dr. STONE': ['dr stone'],
  'VINLAND SAGA': ['vinland saga'],
  'MASHLE: MAGIC AND MUSCLES': ['mashle'],
  'SPY x FAMILY': ['spy x family', 'spy family'],
  'PSYCHO-PASS': ['psycho pass'],
  'BoJack Horseman': ['bojack horseman'],
  'Brooklyn Nine-Nine': ['brooklyn nine nine', 'brooklyn 99'],
  'Trailer Park Boys: The Animated Series': ['trailer park boys animated'],
  'The Midnight Gospel': ['midnight gospel'],
  'The Summer Hikaru Died': ['summer hikaru died'],
  'Wallace & Gromit: Vengeance Most Fowl': ['wallace and gromit vengeance most fowl', 'vengeance most fowl'],
  'The Fast and the Furious: Tokyo Drift': ['tokyo drift'],
  'America: The Motion Picture': ['america the motion picture'],
  'Game Over, Man!': ['game over man'],
  'jackass 4.5': ['jackass 4.5', 'jackass 4 5'],
};

const CONTEXTUAL_TITLE_TERMS: Record<string, readonly string[]> = {
  BEEF: ['netflix', 'series', 'show', 'season', 'comedy', 'television', 'tv'],
  Fixed: ['netflix', 'animation', 'animated', 'film', 'movie', 'comedy'],
  Hoops: ['netflix', 'animation', 'animated', 'series', 'show', 'comedy'],
  Maniac: ['netflix', 'series', 'show', 'television', 'tv'],
  Blockbuster: ['netflix', 'series', 'show', 'comedy', 'television', 'tv'],
  'Inside Job': ['netflix', 'animation', 'animated', 'series', 'show', 'comedy'],
  Homeland: ['series', 'show', 'season', 'television', 'tv'],
};

const FANTASY_PROGRESSION = new Set([
  'Re:ZERO -Starting Life in Another World-', 'Mushoku Tensei: Jobless Reincarnation', "Frieren: Beyond Journey's End",
  'TSUKIMICHI -Moonlit Fantasy-', 'The Water Magician', 'Shangri-La Frontier', 'Solo Leveling',
  'The Rising of the Shield Hero', 'Tower of God', 'Wistoria: Wand and Sword', 'That Time I Got Reincarnated as a Slime',
  'Ranking of Kings', 'The Faraway Paladin', 'Overlord: The Undead King', 'MASHLE: MAGIC AND MUSCLES',
]);

const DARK_ACTION_ANIME = new Set([
  "Hell's Paradise", 'JUJUTSU KAISEN', 'Fire Force', 'DAN DA DAN', 'Kabaneri of the Iron Fortress', 'Kaiju No. 8',
  'The God of High School', 'My Hero Academia', 'Demon Slayer: Kimetsu no Yaiba', 'Attack on Titan', 'Tokyo Ghoul',
  'Fullmetal Alchemist: Brotherhood', 'Deadman Wonderland',
]);

const MYSTERY_PSYCHOLOGICAL = new Set([
  'The Apothecary Diaries', 'The Case Study of Vanitas', 'Undead Murder Farce', 'THE PROMISED NEVERLAND', 'PSYCHO-PASS',
  'Death Note', 'The Summer Hikaru Died', 'Black Mirror', 'Maniac', 'Breaking Bad', 'Homeland', 'Stranger Things',
  '13 Reasons Why', 'The Platform 2', 'Dead to Me',
]);

const SPORTS_COMPETITION_ANIME = new Set(['BLUE LOCK', 'Haikyu!!', 'The God of High School']);

const WITTY_ANIME = new Set([
  'Kaguya-sama: Love is War', 'SPY x FAMILY', 'MASHLE: MAGIC AND MUSCLES', 'Golden Kamuy', 'Scissor Seven', 'DAN DA DAN',
]);

const ANIMATED_DARK_COMEDY = new Set([
  'BoJack Horseman', 'Disenchantment', 'Big Mouth', 'Inside Job', 'Paradise PD', 'The Midnight Gospel', 'Hoops',
  'Trailer Park Boys: The Animated Series', 'America: The Motion Picture', 'Fixed', 'Scissor Seven',
]);

const WITTY_DARK_COMEDY = new Set([
  'BEEF', 'Alpha Males', 'Arrested Development', 'Trailer Park Boys', 'Brooklyn Nine-Nine', 'BoJack Horseman',
  'Inside Job', 'Dead to Me', 'Murderville', 'Blockbuster', 'Bad Trip', 'Game Over, Man!', 'The Brothers Sun',
]);

const CHAOTIC_COMEDY = new Set([
  'Happy Gilmore 2', 'Balls of Fury', 'The Ridiculous 6', 'Bad Trip', 'jackass 4.5', 'Game Over, Man!',
  'Nick Kroll: Little Big Boy', 'Hasan Minhaj: Homecoming King', 'When We First Met', 'Ghostbusters',
]);

const ALL_FAVORITES = Array.from(new Set<string>([
  ...FRONTIER_ANIME_FAVORITES,
  ...FRONTIER_NETFLIX_SCREEN_FAVORITES,
]));

export const FRONTIER_SCREEN_FAVORITES = ALL_FAVORITES as readonly string[];

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function containsPhrase(text: string, phrase: string): boolean {
  const haystack = ` ${normalize(text)} `;
  const needle = ` ${normalize(phrase)} `;
  return needle.length > 2 && haystack.includes(needle);
}

function textHasAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => containsPhrase(text, term));
}

function aliasesFor(title: string): readonly string[] {
  return [title, ...(TITLE_ALIASES[title] ?? [])];
}

function hasRequiredTitleContext(title: string, text: string): boolean {
  const required = CONTEXTUAL_TITLE_TERMS[title];
  return !required || textHasAny(text, required);
}

export function matchedScreenFavorites(text: string): string[] {
  return ALL_FAVORITES.filter((title) =>
    hasRequiredTitleContext(title, text)
    && aliasesFor(title).some((alias) => containsPhrase(text, alias))
  );
}

export function screenTasteTags(text: string): string[] {
  const matched = matchedScreenFavorites(text);
  const tags = new Set<string>();
  if (matched.length) {
    tags.add('screen orbit');
    tags.add('screen favorite');
    tags.add(normalize(matched[0]));
  }

  const anime = matched.some((title) => (FRONTIER_ANIME_FAVORITES as readonly string[]).includes(title))
    || textHasAny(text, ['anime', 'manga', 'crunchyroll']);
  if (anime) tags.add('anime');

  if (matched.some((title) => FANTASY_PROGRESSION.has(title))
      || textHasAny(text, ['fantasy anime', 'isekai', 'dark fantasy', 'power progression', 'worldbuilding anime', 'dungeon anime'])) {
    tags.add('fantasy progression');
    tags.add('strong worldbuilding');
  }
  if (matched.some((title) => DARK_ACTION_ANIME.has(title))
      || textHasAny(text, ['dark shonen', 'supernatural action anime', 'battle anime', 'dark action anime'])) {
    tags.add('dark action anime');
  }
  if (matched.some((title) => MYSTERY_PSYCHOLOGICAL.has(title))
      || textHasAny(text, ['psychological anime', 'mystery anime', 'psychological thriller', 'mystery thriller', 'dark mystery'])) {
    tags.add('mystery psychological');
  }
  if (matched.some((title) => SPORTS_COMPETITION_ANIME.has(title)) || textHasAny(text, ['sports anime', 'tournament anime'])) {
    tags.add('competition anime');
  }
  if (matched.some((title) => WITTY_ANIME.has(title)) || textHasAny(text, ['anime comedy', 'action comedy anime'])) {
    tags.add('witty anime');
  }
  if (matched.some((title) => ANIMATED_DARK_COMEDY.has(title))
      || textHasAny(text, ['adult animation', 'animated comedy', 'dark animated comedy', 'animated satire'])) {
    tags.add('animated dark comedy');
  }
  if (matched.some((title) => WITTY_DARK_COMEDY.has(title))
      || textHasAny(text, ['dark comedy', 'black comedy', 'absurdist comedy', 'satirical comedy', 'workplace comedy', 'comedy satire'])) {
    tags.add('witty dark comedy');
  }
  if (matched.some((title) => CHAOTIC_COMEDY.has(title)) || textHasAny(text, ['absurd comedy', 'chaotic comedy'])) {
    tags.add('chaotic comedy');
  }
  if (anime || tags.has('mystery psychological')) tags.add('story rich');
  return Array.from(tags).slice(0, 10);
}

export function screenTastePrior(text: string): number {
  const matched = matchedScreenFavorites(text);
  const tags = screenTasteTags(text);
  if (matched.length) {
    const anime = matched.some((title) => (FRONTIER_ANIME_FAVORITES as readonly string[]).includes(title));
    return anime ? 0.15 : 0.135;
  }
  if (tags.includes('fantasy progression') || tags.includes('dark action anime')) return 0.1;
  if (tags.includes('animated dark comedy') || tags.includes('witty dark comedy')) return 0.095;
  if (tags.includes('mystery psychological')) return 0.085;
  if (tags.includes('anime')) return 0.07;
  return 0;
}

export function strongestScreenTasteLabel(text: string): string | undefined {
  const matched = matchedScreenFavorites(text);
  if (matched.length) return `${matched[0]} + adjacent screen taste`;
  const tags = screenTasteTags(text);
  if (tags.includes('fantasy progression')) return 'story-rich fantasy anime';
  if (tags.includes('dark action anime')) return 'dark action anime';
  if (tags.includes('mystery psychological')) return 'psychological + mystery stories';
  if (tags.includes('animated dark comedy')) return 'animated dark comedy';
  if (tags.includes('witty dark comedy')) return 'witty dark comedy';
  if (tags.includes('anime')) return 'anime';
  return undefined;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Rotating exact-title bundles keep the discovery surface finite. Explicit
 * searches still flow through the adaptive search mesh immediately; this is the
 * ambient daily radar that gradually sweeps the full catalog.
 */
export function screenFavoriteDiscoveryBundles(dayKey: string, bundleCount = 3, bundleSize = 5): string[][] {
  const size = Math.max(3, Math.min(7, bundleSize));
  const count = Math.max(1, Math.min(5, bundleCount));
  const start = stableHash(dayKey) % ALL_FAVORITES.length;
  const rotated = [...ALL_FAVORITES.slice(start), ...ALL_FAVORITES.slice(0, start)];
  return Array.from({ length: count }, (_, index) => rotated.slice(index * size, (index + 1) * size));
}
