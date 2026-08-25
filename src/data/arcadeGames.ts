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
const uniricoRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNIRICO_URL) ?? '/game-runtimes/unirico/v0.19.0/index.html';
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
    subtitle: 'RAINBOW RICOCHET · READ · AIM · BOUNCE.',
    description:
      'A 40-level rainbow-ricochet puzzle game where a unicorn bends one shot through prisms, portals, weather, gravity, spin, polarity, and increasingly grumpy cloud locks. v0.19.0 adds first-seen mechanic demonstrations plus a precision mobile AIM wheel and separate FIRE button, so learning and touch control use the same deterministic physics as live play.',
    version: 'v0.19.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/uniRico',
    launchUrl: uniricoRuntime,
    aspectRatio: '16 / 10',
    nativeSize: { width: 960, height: 600 },
    tags: ['ricochet puzzle', 'js13k', 'canvas', 'procedural audio', 'mobile controls', 'guided tutorials'],
    controls: [
      { input: 'Mouse / pointer', action: 'Aim on desktop' },
      { input: 'Click', action: 'Fire on desktop' },
      { input: 'AIM wheel', action: 'Choose angle without firing on mobile' },
      { input: 'FIRE', action: 'Launch the selected angle on mobile' },
      { input: 'M / Esc', action: 'Pause / menu' },
      { input: 'R', action: 'Restart level' },
      { input: 'H', action: 'Help / deterministic solution demo' },
      { input: 'P / S', action: 'Path preview / music + SFX' },
      { input: 'Space / Enter', action: 'Continue' },
    ],
    accent: 'cyan',
  },
  {
    slug: 'sylvaria-sequoia',
    title: 'Sylvaria: Sequoia',
    subtitle: 'FIND THE HEARTSEEDS · DISCOVER THE WONDERS · RING THE SKYHEART.',
    description:
      'A kinetic sequoia climber where height is only the beginning. Build Stride to turn horizontal momentum into huge jumps, chain Flow through multi-floor skips, Bark Kicks, Rings and Clean Sap, and use one-button Shift Sap Stick to swing through sparse open-air routes. Five persistent Heartseeds tempt you off the safest line and wake the Living Crown at floor 250. Beyond it, six persistent Canopy Wonders turn advanced movement skills into keys: bring Flow to the Wind Choir, cling into the Lightning Hollow, intercept the Sunwing Migration at speed, paint the Resin Aurora with Clean Sap, reach the Elder Bough with deep Stride and Flow, and cross the Crown Echo in CROWNVELOCITY. Discover all six and the Skyheart at floor 360 becomes the game’s ultimate finite destination before the endless mastery climb. Altitude changes the movement vocabulary through BREAKAWAY branches, moving PENDULUM anchors, CONEFALL, deterministic crosswind, pulsing resonance rings, elder-wind pulses, and long set-piece routes including CHOIRLINE, MIGRATION, ELDERSPAN, ECHOFLIGHT and SKYHEART. Persistent objectives provide curiosity and completion without permanent stat grinding, while the forest, route reading, and player-owned momentum remain the center of the game.',
    version: 'v0.5.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: sylvariaSequoiaRuntime,
    aspectRatio: '3 / 2',
    nativeSize: { width: 960, height: 640 },
    tags: ['vertical climber', 'living canopy', 'heartseeds', 'canopy wonders', 'skyheart', 'sap stick', 'momentum', 'aerial combos', 'moving anchors', 'breakaway branches', 'crosswind', 'procedural routes', 'persistent discovery', 'canvas'],
    controls: [
      { input: 'A / D · ← / →', action: 'Run to build Stride; while Sap Sticking, steer the swing left or right' },
      { input: 'Space · W · ↑', action: 'Jump; a separate airborne press spends the renewable Air Kick' },
      { input: 'Press Shift', action: 'Fire Sap Stick immediately at the best reachable amber knot' },
      { input: 'Hold Shift + steer', action: 'Stay tethered and shape the swing with screen-horizontal control' },
      { input: 'Release Shift', action: 'Vault with preserved momentum + Air Kick refresh; a fast shaped release earns Clean Sap' },
      { input: 'Hold toward bark', action: 'Catch Bark Cling; jump while clinging for Bark Kick + Air Kick refresh' },
      { input: 'Heartseeds 0/5', action: 'Take optional risky detours; each discovery persists and advances the Living Crown quest' },
      { input: 'Living Crown · floor 250', action: 'Collect all five Heartseeds, then reach the Crown to awaken the postgame ascent' },
      { input: 'Canopy Wonders 0/6', action: 'Use Flow, Bark, speed, Clean Sap, Stride and CROWNVELOCITY as six different discovery keys' },
      { input: 'Skyheart · floor 360', action: 'Awaken the Crown + discover all six Wonders, then survive the Elder Sky to ring the final bell' },
      { input: '0 · N · P', action: 'Retry current seed · generate a new route seed · pause' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
