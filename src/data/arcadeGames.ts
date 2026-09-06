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
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_STRETCHICORN_URL) ?? '/game-runtimes/stretchicorn/v0.38.0/index.html';
const uniricoRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNIRICO_URL) ?? '/game-runtimes/unirico/v0.20.0/index.html';
const unicornStampedeRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNICORN_STAMPEDE_URL) ??
  '/game-runtimes/unicorn-stampede/index.html';

export const arcadeGames: ArcadeGame[] = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    subtitle: 'STRETCH · SNAP · SHUCK.',
    description:
      'The current v0.38.0 main release: a 13-trial desktop arcade-action game where you control both ends of a living rainbow unicorn, build tension, Snap through corn armies, parry gold kernels, dodge cyan piercing pressure, and fight three authored bosses. Four difficulty modes, anti-pin boss Phase Shifts, a split-core Cobtopus Prime finale, and the bounded Impossible Encore all ship in the pinned standalone build.',
    version: 'v0.38.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/stretchicorn',
    launchUrl: stretchicornRuntime,
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'js13k', '13 trials', 'procedural audio', 'four difficulties', 'authored bosses'],
    controls: [
      { input: '1 / 2 / 3 / 4', action: 'Start Easy / Normal / Hard / Impossible' },
      { input: 'W A S D', action: 'Move the vulnerable body / heart' },
      { input: 'Arrow Keys', action: 'Aim / steer the safe head and horn' },
      { input: 'Space', action: 'Horn strike / charged Rainbow Snap' },
      { input: 'C', action: 'Rebind controls' },
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
      'A 50-level deterministic rainbow-ricochet puzzle campaign where a unicorn bends one shot through prisms, portals, weather, gravity, spin, polarity, and ordered cloud locks. v0.20.0 adds the ten-level Reflection Gauntlet, preserves the authoritative visible desktop trajectory, and keeps the precision mobile AIM wheel + separate FIRE control.',
    version: 'v0.20.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/uniRico',
    launchUrl: uniricoRuntime,
    aspectRatio: '16 / 10',
    nativeSize: { width: 960, height: 600 },
    tags: ['ricochet puzzle', 'js13k', '50 levels', 'reflection gauntlet', 'procedural audio', 'mobile controls'],
    controls: [
      { input: 'Mouse / pointer', action: 'Choose the visible trajectory on desktop' },
      { input: 'Click', action: 'Fire the currently displayed trajectory' },
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
    slug: 'unicorn-stampede',
    title: 'Unicorn Stampede',
    subtitle: 'STEER · RELEASE · WHIP · SWITCH.',
    description:
      'A six-unicorn arcade-strategy riot for js13kGames 2026. Directly control only two unicorns at a time while the rest keep running the routes and impulses you leave behind — steer Blue with WASD and release to leave them working, crack the Rainbow Whip on Yellow for vector launches and Prism chains, then switch attention as the town fights your rainbow catastrophe. Campaign worlds, Smart Attention Director, and Stampede+ encore all ship in the live main dist/local.html build.',
    version: 'v0.20.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/unicorn-stampede',
    launchUrl: unicornStampedeRuntime,
    aspectRatio: '1280 / 720',
    nativeSize: { width: 1280, height: 720 },
    tags: ['arcade strategy', 'js13k', 'herd control', 'prism chains', 'campaign worlds', 'attention management'],
    controls: [
      { input: 'W A S D', action: 'Steer current Blue unicorn; release to leave its route running' },
      { input: 'Mouse + Click', action: 'Aim Rainbow Whip beside Yellow and crack for launch / Prism chain' },
      { input: 'Space', action: 'Dash both currently controlled unicorns' },
      { input: 'A / D (title)', action: 'Choose an unlocked campaign world' },
      { input: 'P / Esc', action: 'Pause' },
      { input: 'M', action: 'Mute / unmute' },
      { input: 'T (title)', action: 'Replay Little Cross tutorial' },
    ],
    accent: 'rainbow',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
