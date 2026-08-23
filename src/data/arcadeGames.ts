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
  sourceCommit?: string;
  launchUrl?: string;
  aspectRatio: `${number} / ${number}`;
  nativeSize?: { width: number; height: number };
  tags: string[];
  controls: ArcadeControl[];
  accent: 'rainbow' | 'cyan';
};

export const arcadeGames: ArcadeGame[] = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    subtitle: 'STRETCH · SNAP · SHUCK.',
    description:
      'A 13 KB desktop arcade-action game where you steer an enchanted unicorn from both ends, load a rainbow spring, and fight an increasingly unreasonable corn army across 13 trials and four difficulty modes.',
    version: 'v0.21.1',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/stretchicorn',
    sourceCommit: '5635de71cae80a7728a45b11fd660fd87112c351',
    launchUrl: '/game-runtimes/stretchicorn/index.html',
    aspectRatio: '960 / 640',
    nativeSize: { width: 960, height: 640 },
    tags: ['arcade action', 'js13k', 'canvas', 'procedural audio'],
    controls: [
      { input: '1 / 2 / 3 / 4', action: 'Easy / Normal / Hard / Impossible' },
      { input: 'W A S D', action: 'Move the vulnerable body' },
      { input: 'Arrow Keys', action: 'Steer the safe head / horn' },
      { input: 'Space', action: 'Horn strike / Rainbow Snap' },
      { input: 'P / M', action: 'Pause / return to menu' },
      { input: 'C / R / S', action: 'Controls / rules / audio settings' },
    ],
    accent: 'rainbow',
  },
  {
    slug: 'unirico',
    title: 'uniRico',
    subtitle: 'AIM THE HORN · BEND THE RAINBOW · FIX THE SKY.',
    description:
      'A 13 KB rainbow-ricochet puzzle game where one magical shot bends through prisms, portals, weather, gravity, spin, polarity, and grumpy clouds across a 40-level campaign, with adaptive touch controls and procedural music.',
    version: 'v0.18.0',
    status: 'playable',
    sourceVisibility: 'public',
    repoUrl: 'https://github.com/sidhulyalkar/uniRico',
    sourceCommit: '8dfe88461dd3644d234300ba2e586f46491548a5',
    launchUrl: '/game-runtimes/unirico/index.html',
    aspectRatio: '16 / 10',
    tags: ['puzzle', 'js13k', 'canvas', 'mobile', 'procedural audio'],
    controls: [
      { input: 'Mouse / pointer', action: 'Aim the rainbow' },
      { input: 'Click', action: 'Fire immediately' },
      { input: 'M / Esc', action: 'Pause / menu' },
      { input: 'R / H', action: 'Restart / help' },
      { input: 'P / S', action: 'Path preview / sound' },
      { input: 'Touch', action: 'Tap to fire or drag + release to aim' },
    ],
    accent: 'cyan',
  },
];

export function getArcadeGame(slug: string) {
  return arcadeGames.find((game) => game.slug === slug);
}
