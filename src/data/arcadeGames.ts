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
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
