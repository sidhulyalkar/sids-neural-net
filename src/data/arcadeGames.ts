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
const sylvariaSequoiaRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_SYLVARIA_SEQUOIA_URL) ?? '/game-runtimes/sylvaria-sequoia/index.html';

export const arcadeGames: ArcadeGame[] = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    subtitle: 'STRETCH · SNAP · SHUCK.',
    description:
      'A compact desktop action game about steering an elastic unicorn from both ends, charging a rainbow spring, and fighting an increasingly unreasonable corn army across 13 trials. v0.21.1 adds four difficulty modes, Splitcorn cleanup chains, Impossible piercing pressure, and a secret three-boss Impossible Encore.',
    version: 'v0.21.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/stretchicorn',
    launchUrl: stretchicornRuntime,
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'js13k', 'canvas', 'procedural audio', 'difficulty modes', 'splitcorn'],
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
    slug: 'sylvaria-sequoia',
    title: 'Sylvaria: Sequoia',
    subtitle: 'CHAIN AIR · PULL SAP · BREAK THE CROWNLINE.',
    description:
      'A kinetic twin-sequoia aerial climber built around renewable Air Kicks, bark rebounds, Launch Burls, Resin Rings, authored route grammars, and an elastic Sapline. Skilled interactions refresh the second jump so long aerial chains are possible; 5× flow arms a stronger SAP SURGE and a varied 7× chain ignites CROWNVELOCITY. The tower progresses from forgiving Rootways into increasingly compositional high-canopy routes instead of merely stretching the same jumps farther apart.',
    version: 'v0.3.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: sylvariaSequoiaRuntime,
    aspectRatio: '3 / 2',
    nativeSize: { width: 960, height: 640 },
    tags: ['vertical climber', 'aerial combos', 'double jump', 'sapline', 'momentum', 'route grammar', 'telemetry', 'canvas'],
    controls: [
      { input: 'A / D · ← / →', action: 'Run, air-correct, and pump Sapline swings' },
      { input: 'Space · W · ↑', action: 'Jump; press again airborne for the momentum-preserving Air Kick' },
      { input: 'Shift · E', action: 'Hold to Sapline, release to slingshot; strong releases refresh Air Kick' },
      { input: 'Resin Rings', action: 'Thread them to extend Flow and refresh the aerial kick' },
      { input: 'Launch Burls', action: 'Jump from the glowing burl for extra lift and a combo link' },
      { input: 'Sequoia bark', action: 'Hit with speed to rebound, extend Flow, and refresh Air Kick' },
      { input: 'T · J', action: 'Telemetry panel · copy run telemetry JSON' },
      { input: 'R · N · P', action: 'Retry seed · new route seed · pause' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
