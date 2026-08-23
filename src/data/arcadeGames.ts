export type ArcadeControl = {
  input: string;
  action: string;
};

export type ArcadeGame = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  version: string;
  status: 'playable' | 'preview';
  sourceVisibility: 'public' | 'private';
  repoUrl?: string;
  launchUrl?: string;
  aspectRatio: `${number} / ${number}`;
  nativeSize?: { width: number; height: number };
  tags: string[];
  controls: ArcadeControl[];
  accent: 'rainbow' | 'cyan';
};

const cleanRuntimeUrl = (value: string | undefined) => {
  const url = value?.trim();
  return url && (/^https:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : undefined;
};

const stretchicornRuntime = cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_STRETCHICORN_URL) ?? '/game-runtimes/stretchicorn/index.html';
const uniricoRuntime = cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNIRICO_URL) ?? '/game-runtimes/unirico/index.html';

export const arcadeGames: ArcadeGame[] = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    subtitle: 'STRETCH · SNAP · SHUCK.',
    description: 'A compact desktop action game about steering an elastic unicorn from both ends, charging a rainbow spring, and fighting an increasingly unreasonable corn army across 13 trials.',
    version: 'v0.21.0',
    status: 'playable',
    sourceVisibility: 'private',
    launchUrl: stretchicornRuntime,
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'js13k', 'canvas', 'procedural audio'],
    controls: [
      { input: 'W A S D', action: 'Move vulnerable body' },
      { input: 'Arrow Keys', action: 'Aim head / horn' },
      { input: 'Space', action: 'Horn strike / Rainbow Snap' },
      { input: 'P', action: 'Pause / resume' },
      { input: 'M', action: 'Return to menu' },
    ],
    accent: 'rainbow',
  },
  {
    slug: 'unirico',
    title: 'uniRico',
    subtitle: 'A tiny rainbow movement experiment.',
    description: 'A precision canvas game built around movement, momentum, compact level geometry, reactive sound, and a deliberately tiny web-game runtime.',
    version: 'v0.17.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/uniRico',
    launchUrl: uniricoRuntime,
    aspectRatio: '16 / 10',
    tags: ['movement', 'js13k', 'canvas', 'level design'],
    controls: [
      { input: 'Keyboard', action: 'Move and interact' },
      { input: 'Game menu', action: 'Rules and controls live inside the game' },
    ],
    accent: 'cyan',
  },
  {
    slug: 'sylvaria',
    title: 'Sylvaria',
    subtitle: 'DRAW THE LINE · SURVIVE THE FOREST.',
    description: 'A deterministic 120 Hz dark-forest survival prototype built around one multiplying verb: Cutstep. WASD moves the guardian while Arrow keys or mouse aim independently; Space or click instantly carves a short movement-and-attack line with no charge delay. Three segment charges create rapid geometric chains: straight continuations become Thrusts, right-angle turns become Crosscuts, and hard reversals burst nearby projectiles back into the fight. Dense misty pine, oak, cedar, burnscar, and ancient-grove environments obscure threats through regrowing undergrowth, so carving brush creates temporary sightlines and ecological micro-refills. Projectiles, enemies, deadwood, brittle machinery, discoveries, and boss openings can all intersect the same line. v0.15 deliberately scopes toward a fast replayable clearing prototype before infinite-run progression is rebuilt; ranking remains paused while the new authoritative physics are qualified.',
    version: 'v0.15.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'dark forest', 'cutstep', 'independent aim', 'segmented movement', 'projectile reflection', 'geometry combat', 'regrowing undergrowth', 'environmental combat', 'webgl2', '120 hz simulation'],
    controls: [
      { input: 'W A S D', action: 'Move freely without changing the aimed Cutstep line' },
      { input: 'Arrow Keys', action: 'Aim the next Cutstep in crisp 8-way directional chords' },
      { input: 'Mouse', action: 'Free-angle aim; left click instantly Cutsteps along the pointer line' },
      { input: 'Space', action: 'Instant Cutstep on key-down with no hold, charge, or release delay' },
      { input: 'Cutstep chain', action: 'Draw straight, right-angle, and reversal geometry to trigger Thrust, Crosscut, and Reversal techniques' },
      { input: 'Forest ecology', action: 'Carve regrowing understory for temporary visibility and segment micro-refills' },
      { input: 'P / M', action: 'Pause / mute' },
      { input: 'Fullscreen', action: 'Expand the forest across the display' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  const canonicalSlug = slug === 'mosslight' ? 'sylvaria' : slug;
  return arcadeGames.find((game) => game.slug === canonicalSlug);
}
