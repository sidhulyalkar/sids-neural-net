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
    subtitle: 'FIND THE HEARTSEEDS · WAKE THE CROWN.',
    description:
      'A kinetic sequoia climber built around sparse routes and branchless amber-anchor runs, now with a real destination beyond score: five persistent Heartseeds are hidden off the safest climbing line across the canopy, and collecting all five wakes the Living Crown at floor 250. Each Heartseed asks for a voluntary mastery detour, permanently banks progress, and immediately restores useful movement or survival resources, turning every run into a choice between the clean route and one dangerous glowing prize. Crown Marks still appear every 25 floors, your personal best height persists, and the playfield HUD stays deliberately minimal so the forest remains the game. Running converts earned momentum into jump height, passive bark remains a low-energy redirect, and deliberate Bark Cling → Bark Kick is the wall skill. Sap Stick is a one-button movement tool: press Shift to fire immediately at the best reachable amber knot, hold Shift while using A/D or the arrow keys to shape the swing, then release Shift to vault with preserved momentum and a refreshed Air Kick. A short acquisition buffer forgives slightly early presses without making the grapple automatic. Ordinary Sap vaults preserve Flow rather than printing combo links; a fast, deliberately shaped Clean Sap release earns the SAP link. Difficulty changes vocabulary with altitude instead of merely shrinking platforms: WINDLINE, SKYHOOK, and CROWNWEAVE are joined by BREAKAWAY routes with crumbling branches, PENDULUM routes with moving Sap anchors, CONEFALL lanes under telegraphed falling sequoia cones, and THUNDERCROWN sequences that combine exposed anchors, unstable footing, wind, and falling hazards. ROOTWAYS remains readable, HIGH CANOPY becomes exposed and gusty, and CROWNLINE asks the player to combine momentum, Sap timing, Bark recovery, hazard reading, and route planning. The production art stack combines deterministic puzzle-fit sequoia bark, deep flake shadows, organic branch ecology, volumetric-looking light, atmospheric haze, cloud wisps and distant birds, glowing Heartseeds, and a mascot-style Pip while keeping collision geometry exact.',
    version: 'v0.4.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: sylvariaSequoiaRuntime,
    aspectRatio: '3 / 2',
    nativeSize: { width: 960, height: 640 },
    tags: ['vertical climber', 'heartseeds', 'living crown', 'crown trail', 'sap stick', 'breakaway branches', 'moving anchors', 'conefall', 'branchless routes', 'altitude biomes', 'crosswind', 'aerial combos', 'double jump', 'bark cling', 'momentum', 'route grammar', 'telemetry', 'canvas'],
    controls: [
      { input: 'A / D · ← / →', action: 'Run to build real momentum; while Sap Sticking, use the same keys to steer the swing left or right' },
      { input: 'Space · W · ↑', action: 'Jump; a separate airborne press uses the renewable Air Kick' },
      { input: 'Press Shift', action: 'Immediately fire Sap Stick at the best reachable amber knot; a short buffer catches slightly early presses' },
      { input: 'Hold Shift + steer', action: 'Stay tethered and shape swing direction / momentum with A/D or ←/→' },
      { input: 'Release Shift', action: 'Release the tether and vault with preserved momentum + Air Kick refresh; a fast shaped release can score Clean Sap' },
      { input: 'Hold toward bark', action: 'Catch a brief Bark Cling; passive wall contact itself gives no Flow or Air Kick refresh' },
      { input: 'Jump while clinging', action: 'Perform Bark Kick, gain a BARK Flow link, and restore Air Kick' },
      { input: 'Heartseeds', action: 'Leave the safest line to collect five persistent canopy relics; each banks permanently and refills useful movement/survival resources' },
      { input: 'Living Crown · floor 250', action: 'Collect all five Heartseeds, then reach the awakened Crown to complete the finite Heartwood objective' },
      { input: 'Breakaway / Pendulum / Conefall', action: 'Read crumbling branches, moving Sap anchors, and telegraphed falling cones as altitude introduces new rules' },
      { input: '2+ floor clear / Rings / Burls', action: 'Build Flow through deliberate multi-floor and authored aerial lines' },
      { input: 'Crown Mark every 25 floors', action: 'Chase short-horizon in-world Crown gates while pursuing Heartseeds and your persistent personal-best height' },
      { input: 'T · J', action: 'Telemetry panel · copy run telemetry JSON' },
      { input: '0 · N · P', action: 'Retry current seed · new route seed · pause' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
