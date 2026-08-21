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
    subtitle: 'COUNTERCUT · READ THE STORM, ROUTE THE RETURN.',
    description:
      'A directional counter-fighting expedition through forests under active clear-cut pressure. Sprid moves through a persistent one-command WASD step queue while independently aiming four cardinal machete cuts. Hostile fire now uses readable straight, zigzag, wave, spiral, swerve, and wobble trajectories; successful counters strip those patterns away and launch high-speed returns that can be routed into any enemy. Long returns, cross-enemy hits, and perfect-counter penetration reward spatial planning, while ranged enemies backstep or blink away from melee pressure and returned shots stagger them out of escape. Living trees and deadwood remain physical combat geometry, heartwood persists between rooms, and ten authored rooms grow into deterministic seeded counter-routing scenarios.',
    version: 'v0.8.2',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['counter combat', 'directional melee', 'step dash', 'forest defense', 'procedural rooms', 'canvas', 'bosses', 'projectile reflection', 'counter routing', 'bullet patterns', 'enemy evasion', 'flow'],
    controls: [
      { input: 'W A S D', action: 'Cardinal step-dashes with a persistent one-command queue; hold for game-timed repeat bursts' },
      { input: 'Arrow Keys', action: 'Aim Sprid\'s machete up / down / left / right for attacks and arrival-side projectile counters' },
      { input: 'WASD + Arrow Keys', action: 'Dash and cut in independent directions at the same time' },
      { input: 'Counter routing', action: 'Return bullets at high speed; cross-target and long-distance hits earn extra damage and score' },
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
