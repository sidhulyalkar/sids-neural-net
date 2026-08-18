import type { PersonaMoodSelfReport } from './schema';

export const PERSONA_WORLD_STORAGE_KEY = 'sid.physio-persona.world.v1';

export type PersonaBiome =
  | 'alpine'
  | 'jungle'
  | 'cave'
  | 'river'
  | 'coast'
  | 'meadow';

export type PersonaActivity =
  | 'explore'
  | 'collect'
  | 'garden'
  | 'rest'
  | 'stargaze'
  | 'build-cairn'
  | 'skip-stones'
  | 'warm-fire'
  | 'fish'
  | 'snow-angel'
  | 'chase-fireflies';

export type PersonaTrait =
  | 'curiosity'
  | 'energy'
  | 'collector'
  | 'explorer'
  | 'calmWorlds'
  | 'wildWorlds';

export type WorldMemory = {
  id: string;
  createdAt: string;
  biome: PersonaBiome;
  activity: PersonaActivity;
  mood: PersonaMoodSelfReport;
  note: string;
};

export type PersonaWorldProfile = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  visits: number;
  adventures: number;
  traits: Record<PersonaTrait, number>;
  biomeAffinity: Record<PersonaBiome, number>;
  activityCounts: Partial<Record<PersonaActivity, number>>;
  memories: WorldMemory[];
};

export type BiomeDefinition = {
  id: PersonaBiome;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  sky: string;
  fog: string;
  ground: string;
  accent: string;
  secondary: string;
  water: string;
  activities: PersonaActivity[];
};

export type ActivityDefinition = {
  id: PersonaActivity;
  name: string;
  icon: string;
  description: string;
  memory: string;
};

export const TRAIT_LABELS: Record<PersonaTrait, string> = {
  curiosity: 'curiosity',
  energy: 'energy',
  collector: 'collector',
  explorer: 'explorer',
  calmWorlds: 'calm worlds',
  wildWorlds: 'wild worlds',
};

export const TRAIT_COPY: Record<PersonaTrait, string> = {
  curiosity: 'leans toward unfamiliar places and odd little discoveries',
  energy: 'prefers active tasks over staying put',
  collector: 'likes gathering tiny treasures and keeping souvenirs',
  explorer: 'wanders farther and changes locations more often',
  calmWorlds: 'prefers quiet water, gardens, fires, dusk, and gentle weather',
  wildWorlds: 'prefers cliffs, storms, dense jungle, snow, and lively motion',
};

export const BIOMES: Record<PersonaBiome, BiomeDefinition> = {
  alpine: {
    id: 'alpine',
    name: 'snowy mountain ridge',
    shortName: 'snow ridge',
    description: 'A tiny alpine shelf with pines, soft snow, distant peaks, and suspiciously good stargazing.',
    icon: '🏔️',
    sky: '#7896ad',
    fog: '#b9cad6',
    ground: '#dbe7ec',
    accent: '#bde7f3',
    secondary: '#35566b',
    water: '#86c7dc',
    activities: ['explore', 'collect', 'build-cairn', 'snow-angel', 'stargaze', 'rest'],
  },
  jungle: {
    id: 'jungle',
    name: 'deep fern jungle',
    shortName: 'fern jungle',
    description: 'Huge leaves, mossy stones, glowing bugs, and enough vines to make every ten steps feel heroic.',
    icon: '🌿',
    sky: '#25463f',
    fog: '#244e42',
    ground: '#203d31',
    accent: '#79c995',
    secondary: '#527e4f',
    water: '#4b9e8a',
    activities: ['explore', 'collect', 'chase-fireflies', 'garden', 'rest'],
  },
  cave: {
    id: 'cave',
    name: 'warm fire cave',
    shortName: 'fire cave',
    description: 'A snug stone cave with a tiny fire, warm rocks, glittering mineral motes, and absolutely no rent.',
    icon: '🔥',
    sky: '#17171d',
    fog: '#24212a',
    ground: '#29272c',
    accent: '#f0a55b',
    secondary: '#665a65',
    water: '#536a78',
    activities: ['warm-fire', 'collect', 'rest', 'stargaze'],
  },
  river: {
    id: 'river',
    name: 'river bend',
    shortName: 'river bend',
    description: 'A quiet bend with reeds, skipping stones, driftwood, dragonflies, and a bridge that is mostly decorative.',
    icon: '🏞️',
    sky: '#7da6ad',
    fog: '#94b4b1',
    ground: '#55725d',
    accent: '#86cdb7',
    secondary: '#836f53',
    water: '#4f91a1',
    activities: ['skip-stones', 'fish', 'collect', 'explore', 'rest'],
  },
  coast: {
    id: 'coast',
    name: 'windy little coast',
    shortName: 'ocean coast',
    description: 'A pocket-sized coastline with rolling water, shells, sea grass, and heroic winds for a very small explorer.',
    icon: '🌊',
    sky: '#77a6bc',
    fog: '#a5c4cf',
    ground: '#b9aa7f',
    accent: '#78c6d3',
    secondary: '#6e8d83',
    water: '#3e88a8',
    activities: ['collect', 'explore', 'skip-stones', 'stargaze', 'rest'],
  },
  meadow: {
    id: 'meadow',
    name: 'wildflower meadow',
    shortName: 'meadow',
    description: 'Soft grass, tiny flowers, a vegetable patch, wandering fireflies, and peak lying-down-looking-at-clouds infrastructure.',
    icon: '🌼',
    sky: '#85aaa7',
    fog: '#a8c3b5',
    ground: '#52775a',
    accent: '#d5c978',
    secondary: '#8d6c79',
    water: '#79aeb6',
    activities: ['garden', 'chase-fireflies', 'collect', 'rest', 'stargaze', 'explore'],
  },
};

export const ACTIVITIES: Record<PersonaActivity, ActivityDefinition> = {
  explore: {
    id: 'explore',
    name: 'go wandering',
    icon: '🥾',
    description: 'Poke around somewhere suspiciously scenic.',
    memory: 'went wandering and investigated every unnecessary side path',
  },
  collect: {
    id: 'collect',
    name: 'collect tiny treasures',
    icon: '🪨',
    description: 'Gather glowing motes, shells, pebbles, leaves, or whatever looks important.',
    memory: 'collected a handful of tiny treasures of questionable practical value',
  },
  garden: {
    id: 'garden',
    name: 'tend the garden',
    icon: '🌱',
    description: 'Water tiny plants and take the job much too seriously.',
    memory: 'carefully tended a tiny garden and inspected every sprout',
  },
  rest: {
    id: 'rest',
    name: 'take a tiny nap',
    icon: '🍄',
    description: 'Find the comfiest patch of nature and become temporarily unavailable.',
    memory: 'found an excellent nap spot and accomplished absolutely nothing',
  },
  stargaze: {
    id: 'stargaze',
    name: 'stargaze',
    icon: '✨',
    description: 'Sit very still and inspect the enormous sky with tiny-person intensity.',
    memory: 'stargazed until several constellations became unofficial friends',
  },
  'build-cairn': {
    id: 'build-cairn',
    name: 'build a cairn',
    icon: '🗿',
    description: 'Stack rocks into a monument no one asked for.',
    memory: 'built a very small cairn and considered it excellent architecture',
  },
  'skip-stones': {
    id: 'skip-stones',
    name: 'skip stones',
    icon: '💦',
    description: 'Attempt increasingly unnecessary stone-skipping records.',
    memory: 'skipped stones with steadily increasing and poorly documented ambition',
  },
  'warm-fire': {
    id: 'warm-fire',
    name: 'warm by the fire',
    icon: '🪵',
    description: 'Sit beside a tiny campfire and rotate occasionally for even toasting.',
    memory: 'sat beside the fire and achieved optimal tiny-person toastiness',
  },
  fish: {
    id: 'fish',
    name: 'go fishing',
    icon: '🎣',
    description: 'Fish peacefully, with no guarantee that fish participate.',
    memory: 'went fishing and mostly became acquainted with the river',
  },
  'snow-angel': {
    id: 'snow-angel',
    name: 'make snow angels',
    icon: '❄️',
    description: 'Use an entire alpine vista for one extremely silly task.',
    memory: 'made a snow angel and briefly became a highly inefficient snowplow',
  },
  'chase-fireflies': {
    id: 'chase-fireflies',
    name: 'chase fireflies',
    icon: '🪲',
    description: 'Follow glowing bugs in directions that are probably not strategic.',
    memory: 'chased glowing fireflies and lost every argument about navigation',
  },
};

const BIOME_TRAIT_WEIGHTS: Record<PersonaBiome, Partial<Record<PersonaTrait, number>>> = {
  alpine: { explorer: 0.72, wildWorlds: 0.64, curiosity: 0.32 },
  jungle: { curiosity: 0.82, explorer: 0.66, wildWorlds: 0.68 },
  cave: { calmWorlds: 0.78, collector: 0.42, curiosity: 0.28 },
  river: { calmWorlds: 0.72, explorer: 0.42, collector: 0.25 },
  coast: { explorer: 0.62, calmWorlds: 0.4, wildWorlds: 0.32 },
  meadow: { calmWorlds: 0.82, collector: 0.36, curiosity: 0.28 },
};

const MOOD_BIOME_WEIGHTS: Record<PersonaMoodSelfReport, Partial<Record<PersonaBiome, number>>> = {
  calm: { river: 0.28, meadow: 0.3, cave: 0.2, coast: 0.12 },
  curious: { jungle: 0.32, alpine: 0.2, river: 0.14, coast: 0.12 },
  energized: { alpine: 0.3, coast: 0.24, jungle: 0.2, river: 0.12 },
  sleepy: { cave: 0.34, meadow: 0.27, river: 0.2, coast: 0.08 },
};

const ACTIVITY_TRAIT_DELTAS: Record<PersonaActivity, Partial<Record<PersonaTrait, number>>> = {
  explore: { curiosity: 0.025, explorer: 0.05, energy: 0.015 },
  collect: { collector: 0.055, curiosity: 0.015 },
  garden: { calmWorlds: 0.045, collector: 0.018 },
  rest: { calmWorlds: 0.04 },
  stargaze: { curiosity: 0.035, calmWorlds: 0.028 },
  'build-cairn': { collector: 0.025, explorer: 0.025, calmWorlds: 0.012 },
  'skip-stones': { energy: 0.032, explorer: 0.018 },
  'warm-fire': { calmWorlds: 0.055 },
  fish: { calmWorlds: 0.038, explorer: 0.015 },
  'snow-angel': { energy: 0.045, wildWorlds: 0.028 },
  'chase-fireflies': { curiosity: 0.042, energy: 0.028, wildWorlds: 0.012 },
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createDefaultWorldProfile(now = new Date()): PersonaWorldProfile {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    visits: 1,
    adventures: 0,
    traits: {
      curiosity: 0.58,
      energy: 0.52,
      collector: 0.48,
      explorer: 0.62,
      calmWorlds: 0.58,
      wildWorlds: 0.42,
    },
    biomeAffinity: {
      alpine: 0.5,
      jungle: 0.5,
      cave: 0.5,
      river: 0.5,
      coast: 0.5,
      meadow: 0.5,
    },
    activityCounts: {},
    memories: [],
  };
}

export function loadWorldProfile(raw: string | null): PersonaWorldProfile {
  if (!raw) return createDefaultWorldProfile();
  try {
    const candidate = JSON.parse(raw) as Partial<PersonaWorldProfile>;
    if (candidate.schemaVersion !== 1 || !candidate.traits || !candidate.biomeAffinity) {
      return createDefaultWorldProfile();
    }
    const base = createDefaultWorldProfile();
    return {
      ...base,
      ...candidate,
      schemaVersion: 1,
      visits: Math.max(1, Number(candidate.visits ?? 1)),
      adventures: Math.max(0, Number(candidate.adventures ?? 0)),
      traits: Object.fromEntries(
        Object.entries(base.traits).map(([key, value]) => [
          key,
          clamp(Number(candidate.traits?.[key as PersonaTrait] ?? value)),
        ])
      ) as Record<PersonaTrait, number>,
      biomeAffinity: Object.fromEntries(
        Object.entries(base.biomeAffinity).map(([key, value]) => [
          key,
          clamp(Number(candidate.biomeAffinity?.[key as PersonaBiome] ?? value)),
        ])
      ) as Record<PersonaBiome, number>,
      activityCounts: candidate.activityCounts ?? {},
      memories: Array.isArray(candidate.memories) ? candidate.memories.slice(0, 12) : [],
    };
  } catch {
    return createDefaultWorldProfile();
  }
}

export function incrementVisit(profile: PersonaWorldProfile): PersonaWorldProfile {
  return {
    ...profile,
    visits: profile.visits + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function setTraitValue(
  profile: PersonaWorldProfile,
  trait: PersonaTrait,
  value: number
): PersonaWorldProfile {
  return {
    ...profile,
    updatedAt: new Date().toISOString(),
    traits: {
      ...profile.traits,
      [trait]: clamp(value),
    },
  };
}

export function scoreBiome(
  profile: PersonaWorldProfile,
  biome: PersonaBiome,
  mood: PersonaMoodSelfReport
): number {
  const affinity = profile.biomeAffinity[biome] * 0.58;
  const traitScore = Object.entries(BIOME_TRAIT_WEIGHTS[biome]).reduce(
    (score, [trait, weight]) => score + profile.traits[trait as PersonaTrait] * Number(weight),
    0
  );
  const moodScore = MOOD_BIOME_WEIGHTS[mood][biome] ?? 0;
  return affinity + traitScore * 0.34 + moodScore;
}

export function suggestBiome(
  profile: PersonaWorldProfile,
  mood: PersonaMoodSelfReport,
  offset = 0
): PersonaBiome {
  const ranked = (Object.keys(BIOMES) as PersonaBiome[])
    .map((biome) => ({ biome, score: scoreBiome(profile, biome, mood) }))
    .sort((a, b) => b.score - a.score);
  return ranked[Math.abs(offset) % ranked.length]?.biome ?? 'meadow';
}

function activityScore(
  profile: PersonaWorldProfile,
  activity: PersonaActivity,
  mood: PersonaMoodSelfReport
): number {
  const deltas = ACTIVITY_TRAIT_DELTAS[activity];
  const traitMatch = Object.entries(deltas).reduce(
    (score, [trait, weight]) => score + profile.traits[trait as PersonaTrait] * Number(weight) * 8,
    0
  );
  const count = profile.activityCounts[activity] ?? 0;
  const novelty = 0.34 / (1 + count * 0.45);
  const moodBoost =
    mood === 'sleepy' && ['rest', 'stargaze', 'warm-fire', 'fish'].includes(activity)
      ? 0.32
      : mood === 'energized' && ['explore', 'skip-stones', 'snow-angel', 'chase-fireflies'].includes(activity)
        ? 0.3
        : mood === 'curious' && ['explore', 'collect', 'stargaze', 'chase-fireflies'].includes(activity)
          ? 0.25
          : mood === 'calm' && ['garden', 'rest', 'fish', 'warm-fire', 'stargaze'].includes(activity)
            ? 0.26
            : 0;
  return traitMatch + novelty + moodBoost;
}

export function suggestActivity(
  profile: PersonaWorldProfile,
  biome: PersonaBiome,
  mood: PersonaMoodSelfReport,
  offset = 0
): PersonaActivity {
  const ranked = BIOMES[biome].activities
    .map((activity) => ({ activity, score: activityScore(profile, activity, mood) }))
    .sort((a, b) => b.score - a.score);
  return ranked[Math.abs(offset) % ranked.length]?.activity ?? 'explore';
}

export function recordAdventure(
  profile: PersonaWorldProfile,
  biome: PersonaBiome,
  activity: PersonaActivity,
  mood: PersonaMoodSelfReport
): PersonaWorldProfile {
  const now = new Date();
  const deltas = ACTIVITY_TRAIT_DELTAS[activity];
  const nextTraits = { ...profile.traits };
  Object.entries(deltas).forEach(([trait, delta]) => {
    const key = trait as PersonaTrait;
    nextTraits[key] = clamp(nextTraits[key] + Number(delta));
  });

  const biomeTraits = BIOME_TRAIT_WEIGHTS[biome];
  Object.entries(biomeTraits).forEach(([trait, weight]) => {
    const key = trait as PersonaTrait;
    nextTraits[key] = clamp(nextTraits[key] + Number(weight) * 0.008);
  });

  const memory: WorldMemory = {
    id: `${now.getTime()}-${biome}-${activity}`,
    createdAt: now.toISOString(),
    biome,
    activity,
    mood,
    note: `${ACTIVITIES[activity].memory} in the ${BIOMES[biome].shortName}.`,
  };

  return {
    ...profile,
    updatedAt: now.toISOString(),
    adventures: profile.adventures + 1,
    traits: nextTraits,
    biomeAffinity: {
      ...profile.biomeAffinity,
      [biome]: clamp(profile.biomeAffinity[biome] + 0.035),
    },
    activityCounts: {
      ...profile.activityCounts,
      [activity]: (profile.activityCounts[activity] ?? 0) + 1,
    },
    memories: [memory, ...profile.memories].slice(0, 12),
  };
}

export function explainRecommendation(
  profile: PersonaWorldProfile,
  biome: PersonaBiome,
  mood: PersonaMoodSelfReport
): string {
  const weightedTraits = Object.entries(BIOME_TRAIT_WEIGHTS[biome])
    .map(([trait, weight]) => ({
      trait: trait as PersonaTrait,
      score: profile.traits[trait as PersonaTrait] * Number(weight),
    }))
    .sort((a, b) => b.score - a.score);
  const strongest = weightedTraits[0]?.trait ?? 'curiosity';
  const moodPhrase: Record<PersonaMoodSelfReport, string> = {
    calm: 'the current calm mood favors gentler scenery',
    curious: 'the current curious mood favors places with things to investigate',
    energized: 'the current energized mood favors room to roam',
    sleepy: 'the current sleepy mood favors quieter shelter',
  };
  return `${BIOMES[biome].shortName} fits the local ${TRAIT_LABELS[strongest]} preference, and ${moodPhrase[mood]}. Mood only affects this visit; explicit choices train the saved profile.`;
}
