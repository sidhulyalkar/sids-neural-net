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
    subtitle: 'COUNTERCUT · READ THE STORM, SHAPE THE GROUND.',
    description:
      'A directional forest-defense fighter where Sprid turns hostile bullet patterns and the terrain itself into tactical weapons. The persistent one-command WASD step queue and four cardinal machete Countercuts remain unchanged, but deterministic ice, mud, sand, shallow water, brambles, tall grass, and brittle route barriers now alter commitments for Sprid and enemies under the same mobility rules. Ice extends movement, drag zones trap evasive units, hazardous ground rewards reflected knockback, grass and deadwood can be chopped into cleaner sightlines, and brittle barriers can be opened with the machete or a returned projectile. Straight, zigzag, wave, spiral, swerve, and wobble fire still converts into high-speed returns, with Crosscuts, Long Returns, perfect penetration, and terrain routes rewarding deliberate spatial planning across ten authored rooms and seeded deep-run remixes.',
    version: 'v0.9.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['counter combat', 'directional melee', 'step dash', 'forest defense', 'terrain tactics', 'destructible foliage', 'environmental combat', 'procedural rooms', 'canvas', 'bosses', 'projectile reflection', 'counter routing', 'bullet patterns', 'enemy evasion', 'flow'],
    controls: [
      { input: 'W A S D', action: 'Cardinal step-dashes with a persistent one-command queue; terrain changes the commitment, not the input grammar' },
      { input: 'Arrow Keys', action: 'Aim Sprid\'s machete up / down / left / right for attacks, arrival-side counters, foliage chops, and contextual breaks' },
      { input: 'WASD + Arrow Keys', action: 'Dash and cut in independent directions at the same time' },
      { input: 'Counter routing', action: 'Return bullets at high speed; cross-target, long-distance, penetration, and hazard-routed hits earn extra value' },
      { input: 'P', action: 'Pause / resume' },
      { input: 'M', action: 'Mute / restore Countercut sound effects' },
      { input: 'Fullscreen', action: 'Expand the forest arena across the device display' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  const canonicalSlug = slug === 'mosslight' ? 'sylvaria' : slug;
  return arcadeGames.find((game) => game.slug === canonicalSlug);
}
