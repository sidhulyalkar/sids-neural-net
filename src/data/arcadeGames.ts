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
    subtitle: 'ASCEND · REBOUND · DEFEND THE CROWN.',
    description: 'A fast vertical dark-forest action platformer built around climbing one enormous ancient tree from roots to crown. Arrow keys drive movement and directional combat intent, D controls a fully directional machete, and Space jumps with generous coyote and buffering. Bark Grip turns the trunk into a wall-movement system; narrow living limbs flex into launchers; dead branches collapse if camped on; hanging vines preserve momentum; sap branches reward precise downward strikes with stronger rebounds and refreshed aerial mobility. Combat remains compact but expressive: grounded slashes, upslashes, aerial downslashes, high-speed plunges, wall attacks, dash slashes and projectile redirects all emerge from the same attack button. Five escalating tree regions introduce Clearcut Loggers, Nailgun Rangers, bark-climbing attackers, saw drones, cable trappers, moving machinery hazards and a three-phase Crown Feller at the Heartwood Crown. Controls are fully rebindable and persist on the device.',
    version: 'v3.0.0-alpha.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/sylvaria-v3/index.html',
    aspectRatio: '16 / 9',
    nativeSize: { width: 1280, height: 720 },
    tags: ['action platformer', 'vertical ascent', 'dark forest', 'tree traversal', 'branch physics', 'vine swinging', 'wall movement', 'aerial combat', 'machete combat', 'boss combat', 'custom keybinds', '120 hz simulation'],
    controls: [
      { input: '← / →', action: 'Run and steer in the air' },
      { input: 'Space', action: 'Variable jump; Bark Grip wall launch; vine release' },
      { input: 'D', action: 'Contextual machete slash and projectile redirect' },
      { input: '↑ + D', action: 'Upward aerial / grounded slash' },
      { input: '↓ + D', action: 'Downslash; becomes a heavy plunge at falling speed' },
      { input: 'Shift', action: 'Spend the current aerial dash; attack during it for a dash slash' },
      { input: 'E / ↑', action: 'Grab a nearby vine' },
      { input: 'Settings', action: 'Rebind controls; mappings persist locally' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  const canonicalSlug = slug === 'mosslight' ? 'sylvaria' : slug;
  return arcadeGames.find((game) => game.slug === canonicalSlug);
}
