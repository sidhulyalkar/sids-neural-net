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
    subtitle: 'GLIDE · SWEEP · RETURN FIRE.',
    description:
      'A deterministic frog combat game built around continuous pond movement and a timing-driven tongue weapon. Glide smoothly with combined WASD input, hold and release Space to charge an omnidirectional burst, then use the arrow keys to swing a broad tongue arc through enemies and incoming fire. Catch projectiles in the opening five active ticks to parry them into 1160 px/s piercing returns; the rest of the sweep remains an offensive melee blade. Skimmers orbit, Striders read and evade the sweep, Dragonflies fire high-speed precision lanes, Shellback beetles armor their front, and legacy insect roles combine with currents, mud, reeds, poison, cover, and reflected projectiles across thirty fixed arenas and deterministic endless play.',
    version: 'v0.13.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'frog', 'pond', 'kinetic combat', 'tongue arc', 'charged dash', 'projectile reflection', 'reactive ai', 'webgl2', 'fixed arenas', 'terrain tactics', 'deterministic replay', 'verified leaderboard'],
    controls: [
      { input: 'W A S D', action: 'Glide continuously; combine directions for smooth diagonal steering' },
      { input: 'Space', action: 'Hold to charge, steer while charging, release for an omnidirectional dash; presses can buffer near recovery' },
      { input: 'Arrow Keys', action: 'Start a directional tongue sweep; opening contact parries projectiles and later arc contact strikes enemies' },
      { input: 'Pond terrain', action: 'Use currents, mud, reeds, stones, poison, and reflected fire against both sides' },
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
