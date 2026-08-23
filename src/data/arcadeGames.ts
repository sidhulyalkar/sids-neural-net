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
    subtitle: 'ASCEND · SLING · TURN PRESSURE INTO HEIGHT.',
    description: 'A fast vertical action platformer about climbing one ancient tree while the Fellworks dismantle it around you. Movement is the primary weapon. Arrow keys drive running and air steering, Space handles jumping and Bark Grip launches, W casts the elastic Sapline to authored Resin Knots, Shift spends one Canopy Step, and D draws a compact machete only during attacks or counters. Sylvaria v3.2 replaces shelf-only traversal with authoritative sloped BarkRails arranged as recoverable, speed, and mastery routes. Every Resin Knot obeys the same deterministic 120 Hz spring physics; its resin vein previews the natural release tangent while stored spring energy changes the knot and line presentation. Sapline damping is adaptive only in the radial direction so bungee oscillation settles without erasing tangential speed. Downstrikes, Plunges, Bark Grip, vines, flexible limbs, projectile redirects, and route-mounted Resin Knots feed one continuous momentum grammar. The climb culminates in the Crown Girdler, a tree-mounted mechanical parasite whose physical clamps must be broken before its core opens.',
    version: 'v3.2.0-alpha.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/sylvaria-v3/index.html',
    aspectRatio: '16 / 9',
    nativeSize: { width: 1280, height: 720 },
    tags: ['action platformer', 'vertical ascent', 'dark forest', 'sapline', 'elastic tether', 'barkrail', 'momentum platforming', 'tree traversal', 'branch physics', 'vine swinging', 'wall movement', 'aerial combat', 'projectile counter', 'boss combat', 'custom keybinds', '120 hz simulation'],
    controls: [
      { input: '← / →', action: 'Run, air-steer, and pump Sapline swing direction' },
      { input: 'Space', action: 'Variable jump; Bark Grip wall launch; vine release' },
      { input: 'W', action: 'Hold Sapline to a Resin Knot; release to preserve the slingshot velocity' },
      { input: 'D', action: 'Draw the short machete for contextual slash and projectile redirect' },
      { input: '↑ + D', action: 'Upward slash' },
      { input: '↓ + D', action: 'Downstrike; becomes a committed Plunge at high falling speed' },
      { input: 'Shift', action: 'Spend Canopy Step; attack during it for a dash slash' },
      { input: 'E / ↑', action: 'Grab a nearby vine' },
      { input: 'Settings', action: 'Rebind every action; mappings persist locally' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  const canonicalSlug = slug === 'mosslight' ? 'sylvaria' : slug;
  return arcadeGames.find((game) => game.slug === canonicalSlug);
}
