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
      'A 13KB desktop arcade-action game about steering an elastic unicorn from both ends across 13 corn-packed trials. v0.21.1 adds four difficulty modes, Splitcorn enemy chains, anti-parry piercing pressure on Impossible, and a secret three-boss Impossible Encore.',
    version: 'v0.21.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/stretchicorn',
    launchUrl: stretchicornRuntime,
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'js13k', 'canvas', 'procedural audio', 'difficulty modes', 'boss encore'],
    controls: [
      { input: '1 / 2 / 3 / 4', action: 'Start Easy / Normal / Hard / Impossible' },
      { input: 'W A S D', action: 'Move vulnerable body' },
      { input: 'Arrow Keys', action: 'Aim head / horn' },
      { input: 'Space', action: 'Horn strike / Rainbow Snap' },
      { input: 'C', action: 'Controls / rebinding' },
      { input: 'R', action: 'Rules' },
      { input: 'S', action: 'Music + SFX settings' },
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
    subtitle: 'COUNTERCUT · FORAGE · FRACTURE · ROUTE THE FOREST.',
    description:
      'A directional forest-defense fighter where Sprid turns hostile bullet patterns and a living combat ecology into tactical weapons. The protected persistent one-command WASD step queue and four cardinal machete Countercuts still define every fight, while terrain and exploration now create optional mid-combat advantages. Ice can be dash-cut into dangerous shards, mud and sand slow enemies under the same mobility rules as Sprid, grass, deadwood, and rubble can hide healing, Flow, speed, guard, or temporary reach rewards, and readable mushrooms can either help or vent symmetric toxic spore clouds that damage both sides. Straight, zigzag, wave, spiral, swerve, and wobble fire still converts into 840/1040 px/s returns, with Crosscuts, Long Returns, penetration, hazard routes, and spore traps rewarding deliberate positioning across ten authored ecology lessons and deterministic deep-run remixes.',
    version: 'v0.9.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['counter combat', 'directional melee', 'step dash', 'forest defense', 'terrain tactics', 'forage', 'forest chemistry', 'toxic spores', 'destructible foliage', 'environmental combat', 'procedural rooms', 'canvas', 'bosses', 'projectile reflection', 'counter routing', 'bullet patterns', 'enemy evasion', 'flow'],
    controls: [
      { input: 'W A S D', action: 'Cardinal step-dashes with a persistent one-command queue; terrain changes the commitment, not the input grammar' },
      { input: 'Arrow Keys', action: 'Aim Sprid\'s machete up / down / left / right for attacks, arrival-side counters, foliage chops, mushrooms, and contextual ice fractures' },
      { input: 'WASD + Arrow Keys', action: 'Dash and cut in independent directions at the same time' },
      { input: 'Explore', action: 'Open grass, deadwood, rubble, and readable fungi for temporary tactical rewards or symmetric hazards' },
      { input: 'Counter routing', action: 'Return bullets at high speed; cross-target, long-distance, penetration, hazard-routed, and spore-assisted hits earn extra value' },
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
