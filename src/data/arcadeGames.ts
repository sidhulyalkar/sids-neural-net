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
    subtitle: 'BUILD STRIDE · SKIP FLOORS · KEEP THE RUSH.',
    description:
      'A kinetic twin-sequoia climber where running builds Stride, Stride makes jumps higher, and every 2+ floor clear adds bounded speed carry so successful combos naturally snowball. Rootways begins with broad runway-like branches before the canopy tightens. Every launch carries a renewable Air Kick; bark can become a Bark Kick; Sap immediately helps through Sap Snap and Quick Sling before opening into charged pumping and SAP SURGE. A pure 6× Flow chain now ignites CROWNVELOCITY, while varied movement can ignite it earlier.',
    version: 'v0.3.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: sylvariaSequoiaRuntime,
    aspectRatio: '3 / 2',
    nativeSize: { width: 960, height: 640 },
    tags: ['vertical climber', 'stride', 'aerial combos', 'double jump', 'sapline', 'momentum', 'route grammar', 'telemetry', 'canvas'],
    controls: [
      { input: 'A / D · ← / →', action: 'Run to build Stride; sustained commitment also earns a Momentum Burst' },
      { input: 'Space · W · ↑', action: 'Jump; horizontal Stride increases height, and a second airborne press uses Air Kick' },
      { input: '2+ floor clear', action: 'Build Flow and receive bounded Combo Carry toward the next high jump' },
      { input: 'Shift · E', action: 'Tap for Sap Snap / Quick Sling; hold to pump and release a charged slingshot' },
      { input: 'Sequoia bark + Jump', action: 'Take the upward rebound or jump in the cling window for Bark Kick' },
      { input: 'Resin Rings', action: 'Thread them to extend Flow and refresh Air Kick' },
      { input: 'Launch Burls', action: 'Jump from the glowing burl for extra lift and a Flow link' },
      { input: 'T · J', action: 'Telemetry panel · copy run telemetry JSON' },
      { input: 'R · N · P', action: 'Retry seed · new route seed · pause' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
