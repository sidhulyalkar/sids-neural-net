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
    subtitle: 'COUNTERCUT · COMPOSE THE ECOSYSTEM · ENTER VERDANT FLOW.',
    description:
      'A directional forest-defense fighter where Sprid turns hostile bullet geometry and a living combat ecology into deliberate chain reactions. The fully qualified v0.9.1 foundation remains protected: persistent one-command WASD step-dashes, four cardinal arrival-side Countercuts, 840/1040 px/s returns, Crosscuts, Long Returns, penetration, symmetric terrain, forage, fungi, and fixed projectile caps. Ecological Synergy adds composition without new buttons: returned shots can trigger mushrooms, wave-origin returns can bloom toxic spores farther, committed dash-cuts can shear gas clouds into new lanes, cautious enemies steer away from danger while reckless Skidders remain baitable, and PAC-a-Saw bulldozes deadwood and rubble. Linking perfect Countercuts, return routes, hazard finishes, and spore routes at high Flow ignites a short Verdant Flow state that strengthens ecological interactions without changing the protected movement or Countercut numbers.',
    version: 'v0.10.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: '/game-runtimes/mosslight-v2/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['counter combat', 'directional melee', 'step dash', 'forest defense', 'ecological synergy', 'verdant flow', 'terrain tactics', 'forage', 'forest chemistry', 'toxic spores', 'hazard-aware AI', 'destructible foliage', 'environmental combat', 'procedural rooms', 'canvas', 'bosses', 'projectile reflection', 'counter routing', 'bullet patterns', 'enemy evasion', 'flow'],
    controls: [
      { input: 'W A S D', action: 'Cardinal step-dashes with a persistent one-command queue; terrain changes the commitment, not the input grammar' },
      { input: 'Arrow Keys', action: 'Aim Sprid\'s machete up / down / left / right for attacks, arrival-side counters, foliage chops, ice fractures, and committed spore shears' },
      { input: 'WASD + Arrow Keys', action: 'Dash and cut independently to fracture ice or directionally shear an active spore cloud' },
      { input: 'Returned shots', action: 'Countercut projectiles can trigger fungi; wave-origin and perfect returns can amplify a toxic bloom without spending the return' },
      { input: 'Verdant Flow', action: 'Chain perfect counters, Crosscuts, Long Returns, terrain routes, hazard finishes, and spore routes to amplify ecological interactions' },
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
