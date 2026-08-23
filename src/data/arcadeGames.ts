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
    subtitle: 'CARVE · COUNTER · CREATE THE OPENING.',
    description:
      'A deterministic 120 Hz frog combat game built around committed movement, precise counters, and environmental problem solving. Sprid and the Reactive Blade now share one character rig, so every tongue sweep stays physically attached to the frog while authoritative combat geometry remains exact. Charge and steer exponential dashes, parry incoming fire during the opening five active ticks for piercing returns and mobility refunds, build Flow to accelerate blade recovery, bait fixed-timing evasions into punish windows, and read room-level call-and-response threat phrases instead of accidental projectile piles. Across thirty authored arenas, currents, mud, brambles, shards, spores, cover, armor angles, reflected shots, and boss guard breaks can all be combined into offensive routes. The v0.14 development runtime is fully playable; ranked submission is temporarily paused while its exact-source replay verifier is migrated to the new authoritative mechanics.',
    version: 'v0.14.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'frog', 'pond', 'counter combat', 'reactive blade', 'charged dash', 'projectile reflection', 'threat orchestration', 'boss guard break', 'environmental combos', 'webgl2', 'fixed arenas', 'terrain tactics', '120 hz simulation'],
    controls: [
      { input: 'W A S D', action: 'Carve continuous movement lines; combine directions for smooth diagonal steering' },
      { input: 'Space', action: 'Hold to charge, aim with movement input, release into an exponential dash; late presses buffer near recovery' },
      { input: 'Arrow Keys', action: 'Commit a directional Reactive Blade sweep; the opening five active ticks parry and the remaining arc attacks' },
      { input: 'Enemy openings', action: 'Bait fixed-timing evasions, punish the shrinking vulnerability window, then reposition for the response beat' },
      { input: 'Pond terrain', action: 'Route enemies and bosses through currents, brambles, shards, spores, cover, and reflected fire' },
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
