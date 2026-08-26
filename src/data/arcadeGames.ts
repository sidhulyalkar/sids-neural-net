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
    subtitle: 'LAND HIGHER · BRIDGE WITH SAP · MASTER THE CROWN LINE.',
    description:
      'A kinetic sequoia climber built around player-authored momentum, sparse nearest-node Sap bridges, and a deterministic 25-floor mastery rhythm. v0.6.2 keeps the hardened one-use Sap authority from v0.6.1, then adds Crown split records, real near-Crown miss feedback, and a local-only Mastery Lab that measures death bands, route/stage friction, threat exposure, momentum burns, Sap use/recharge discipline, same-seed retries, restart latency, and recent improvement. Those measurements never alter route RNG, phase pressure, or movement tuning: the same seed remains the same challenge, so improvement is legible instead of secretly assisted. Production delivery is also collapsed into one manifest-checked runtime bundle with a SHA-256 and Brotli budget while the readable source modules remain independently testable. The larger Living Canopy quest remains intact: discover five Heartseeds, wake the Living Crown at floor 250, master six Canopy Wonders, and ring the Skyheart at floor 360 before the endless Elder Canopy.',
    version: 'v0.6.2',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/sids-neural-net',
    launchUrl: sylvariaSequoiaRuntime,
    aspectRatio: '3 / 2',
    nativeSize: { width: 960, height: 640 },
    tags: ['vertical climber', 'mastery telemetry', 'crown splits', 'same-seed retries', 'canopy contracts', 'cone tokens', 'living canopy', 'heartseeds', 'canopy wonders', 'skyheart', 'nearest-node sap', 'momentum', 'procedural routes', 'deterministic difficulty', 'single-bundle runtime', 'canvas'],
    controls: [
      { input: 'A / D · ← / →', action: 'Run on logs to build Stride; while tethered, steer the Sap swing left or right' },
      { input: 'Space · W · ↑', action: 'Jump; a separate airborne press spends the renewable Air Kick' },
      { input: 'Land on a new higher log', action: 'Rearm exactly one Sap connection and advance log-based Contracts' },
      { input: 'Press Shift', action: 'Connect to the strict nearest eligible unused amber node; no buffered or directional target substitution' },
      { input: 'Hold Shift + steer', action: 'Shape the tether arc with A/D while retaining player-authored momentum' },
      { input: 'Release Shift', action: 'Detach with a small bounded momentum nudge; Sap remains spent until the next higher-log landing' },
      { input: 'Crown every 25 floors', action: 'Record a comparable split and enter the next Breathe → Build → Test → Crown mastery cycle' },
      { input: 'Cone Tokens', action: 'Collect golden cones on log lines, climb through altitude milestones, and finish Contracts to earn currency' },
      { input: '3 Canopy Contracts', action: 'Complete one mixed log/Sap objective plus two seed-selected movement missions each run' },
      { input: 'B · 1 / 2 / 3 / 4', action: 'Open the between-run Canopy Shop · buy Extra Life / Stride Seed / Resin Flask / Trail Map' },
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
