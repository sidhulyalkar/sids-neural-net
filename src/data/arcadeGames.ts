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

const stretchicornRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_STRETCHICORN_URL) ?? '/game-runtimes/stretchicorn/index.html';
const uniricoRuntime = cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNIRICO_URL) ?? '/game-runtimes/unirico/index.html';

export const arcadeGames: ArcadeGame[] = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    subtitle: 'STRETCH · SNAP · SHUCK.',
    description:
      'A compact desktop action game about steering an elastic unicorn from both ends, charging a rainbow spring, and fighting an increasingly unreasonable corn army across 13 trials.',
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
    description:
      'A precision canvas game built around movement, momentum, compact level geometry, reactive sound, and a deliberately tiny web-game runtime.',
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
    subtitle: 'HOP · SLAP · REFLECT.',
    description:
      'A deterministic frog-and-pond arcade game with a custom WebGL2 presentation layer. WASD commits the frog to short cardinal movement while the arrow keys snap a tongue in four directions. Time a tongue slap against an incoming insect attack to bat it back faster. Thirty fixed pond arenas combine flies, bees, mosquitoes, beetles, reeds, mud, shallow water, slick algae, poison, driftwood, optional routes, boss insects, and server-verified competitive runs, all on top of the same capped 120 Hz replayable simulation.',
    version: 'v0.12.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'frog', 'pond', 'tongue combat', 'projectile reflection', 'webgl2', 'normal mapping', 'fixed arenas', 'terrain tactics', 'deterministic replay', 'verified leaderboard'],
    controls: [
      { input: 'W A S D', action: 'Commit to short cardinal movement; one direction can remain queued' },
      { input: 'Arrow Keys', action: 'Tongue-slap in four directions or reflect an attack arriving from that side' },
      { input: 'Pond terrain', action: 'Use mud, water, algae, reeds, stones, and poison against both sides' },
      { input: 'Explore', action: 'Open optional routes and temporary heal, speed, shield, reach, or flow pickups' },
      { input: 'P / M', action: 'Pause / mute' },
      { input: 'Fullscreen', action: 'Expand the pond across the display' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  const canonicalSlug = slug === 'mosslight' ? 'sylvaria' : slug;
  return arcadeGames.find((game) => game.slug === canonicalSlug);
}
