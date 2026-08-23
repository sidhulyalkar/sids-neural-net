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
    subtitle: 'ROOT · CLIMB · SWING · STRIKE.',
    description: 'A horizontal dark-forest action platformer built around living tree traversal. Run across roots, compress flexible branches into natural launchers, use Bark Grip to cling and wall-launch from living trunks, preserve momentum through hanging vines, rebound from enemies with a downward machete strike, and use one aerial Canopy Step to connect difficult routes. Combat stays deliberately readable: the Clearcut Logger teaches grounded spacing through telegraphed axe swings, while the Nailgun Ranger teaches trunk cover and oversized nail projectiles that can be reflected back into the fight. The first multi-screen Old Growth Trial is intentionally focused on making movement and combat feel excellent before Sylvaria expands into a larger interconnected forest world.',
    version: 'v2.0.0-alpha.2',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/sylvaria-v2/index.html',
    aspectRatio: '16 / 9',
    nativeSize: { width: 1280, height: 720 },
    tags: ['action platformer', 'dark forest', 'tree traversal', 'branch physics', 'vine swinging', 'wall movement', 'machete combat', 'projectile reflection', '120 hz simulation'],
    controls: [
      { input: 'A / D', action: 'Run and steer in the air' },
      { input: 'Space', action: 'Variable jump; Bark Grip wall launch; release a held vine' },
      { input: 'J', action: 'Machete slash and projectile reflection' },
      { input: 'W / S + J', action: 'Upward slash or aerial downslash rebound' },
      { input: 'Shift', action: 'Spend the current aerial Canopy Step' },
      { input: 'E', action: 'Grab or release a nearby vine' },
      { input: 'R', action: 'Restart after defeat or completion' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  const canonicalSlug = slug === 'mosslight' ? 'sylvaria' : slug;
  return arcadeGames.find((game) => game.slug === canonicalSlug);
}
