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
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_STRETCHICORN_URL) ??
  '/game-runtimes/stretchicorn/index.html';
const uniricoRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNIRICO_URL) ?? '/game-runtimes/unirico/index.html';
const unicornStampedeRuntime =
  cleanRuntimeUrl(process.env.NEXT_PUBLIC_ARCADE_UNICORN_STAMPEDE_URL) ??
  '/game-runtimes/unicorn-stampede/index.html';

export const arcadeGames: ArcadeGame[] = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    subtitle: 'STRETCH · SNAP · SHUCK.',
    description:
      'Live main build: a 13-trial desktop arcade-action game where you control both ends of a living rainbow unicorn, build tension, Snap through corn armies, parry gold kernels, dodge cyan piercing pressure, and fight three authored bosses. Four difficulty modes, anti-pin boss Phase Shifts, a split-core Cobtopus Prime finale, and the bounded Impossible Encore ship from stretchicorn main (dist/stretchicorn-local.html).',
    version: 'main',
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
      'Live main build: a 50-level deterministic rainbow-ricochet puzzle campaign where a unicorn bends one shot through prisms, portals, weather, gravity, spin, polarity, and ordered cloud locks. Includes the Reflection Gauntlet, the authoritative visible desktop trajectory, and precision mobile AIM wheel + separate FIRE control — served from uniRico main src/.',
    version: 'main',
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
    subtitle: 'MANAGE THE HERD · WRECK THE TOWN · LEAVE RAINBOWS.',
    description:
      'Live post-js13k showcase build: manage six semi-autonomous unicorns across Prismborough, Washwater Bay, and Cloudtop Heights. Steer one unicorn directly, use Smart Shift to jump attention across the herd, crack the Rainbow Whip near the active unicorn to build charge, dash through buildings, rescue captured herd members, collect power-ups, team up on major landmarks, and conquer the town. The expanded main build adds richer world-specific motion, Cloudtop anti-stuck behavior, adaptive music, separate audio/accessibility options, gamepad + touch controls, fullscreen presentation, and post-run telemetry while the exact 13 KB competition build remains frozen on its release branch.',
    version: 'main',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/unicorn-stampede',
    launchUrl: unicornStampedeRuntime,
    aspectRatio: '1280 / 720',
    nativeSize: { width: 1280, height: 720 },
    tags: ['arcade strategy', 'js13k', 'herd AI', 'three reactive worlds', 'adaptive audio', 'gamepad + touch'],
    controls: [
      { input: 'W A S D', action: 'Steer the active unicorn and paint the town' },
      { input: 'Shift', action: 'Smart-switch to another herd member; moving first sends the current unicorn onward' },
      { input: 'Click near unicorn', action: 'Crack the Rainbow Whip and build charge' },
      { input: 'Space', action: 'Dash / smash; higher whip charge makes the dash stronger' },
      { input: 'A / D (title)', action: 'Choose Prismborough, Washwater Bay, or Cloudtop Heights' },
      { input: 'P / Esc', action: 'Pause / resume' },
      { input: 'O', action: 'Open showcase options: motion, shake, contrast, music, SFX, touch' },
      { input: 'Gamepad / Touch', action: 'Steer, switch, whip, dash, and pause with native showcase controls' },
    ],
    accent: 'rainbow',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
