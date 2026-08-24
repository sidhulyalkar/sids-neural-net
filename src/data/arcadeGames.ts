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
    subtitle: 'RUN · STICK · VAULT THE CANOPY.',
    description:
      'A kinetic sequoia climber rebuilt around sparse routes, open Grove Chambers, branchless amber-anchor runs, and harder SAPRUN / SLINGSHOT lines. Running converts earned momentum into jump height, passive bark remains a low-energy redirect, and deliberate Bark Cling → Bark Kick is the wall skill. The no-charge Sap Stick is the central navigation tool: hold Shift to preview an amber lock, tap Space to tether for a fixed 0.22-second beat, then auto-vault with preserved momentum and a refreshed Air Kick. The forest now changes continuously with altitude rather than behaving like one repeated backdrop: humid mossy ROOTWAYS open into sunlit REDWOOD RUN trunks, SAPWORK gains glowing resin sheen, HIGH CANOPY becomes colder, clearer and windier with lichen and drifting needles, and CROWNLINE breaks into exposed sky, cloud wisps and distant birds. The production art stack combines deterministic puzzle-fit sequoia bark, deep flake shadows, organic branch ecology, volumetric-looking light, atmospheric haze and a mascot-style Pip while keeping collision geometry exact.',
    version: 'v0.4.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: sylvariaSequoiaRuntime,
    aspectRatio: '3 / 2',
    nativeSize: { width: 960, height: 640 },
    tags: ['vertical climber', 'sap stick', 'branchless routes', 'procedural bark', 'altitude biomes', 'atmospheric lighting', 'aerial combos', 'double jump', 'bark cling', 'grove chambers', 'momentum', 'route grammar', 'telemetry', 'canvas'],
    controls: [
      { input: 'A / D · ← / →', action: 'Run to build real momentum; committed movement still powers jump height' },
      { input: 'Space · W · ↑', action: 'Jump; a separate airborne press uses the renewable Air Kick' },
      { input: 'Hold Shift', action: 'Preview the best reachable amber Sap Stick lock without committing' },
      { input: 'Shift + Space', action: 'Cast Sap Stick: no charge, 0.22 s tether, then automatic momentum vault + Air Kick refresh' },
      { input: 'Hold toward bark', action: 'Catch a brief Bark Cling; passive wall contact itself gives no Flow or Air Kick refresh' },
      { input: 'Jump while clinging', action: 'Perform Bark Kick, gain a BARK Flow link, and restore Air Kick' },
      { input: '2+ floor clear / Rings / Burls', action: 'Build Flow through deliberate multi-floor and authored aerial lines' },
      { input: 'T · J', action: 'Telemetry panel · copy run telemetry JSON' },
      { input: 'R · N · P', action: 'Retry seed · new route seed · pause' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}