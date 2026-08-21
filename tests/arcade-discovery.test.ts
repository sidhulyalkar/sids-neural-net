import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames, getArcadeGame } from '../src/data/arcadeGames';
import { primaryNavItems, siteNavItems } from '../src/data/siteNav';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

const gameNetworkSurfaces = [
  'app/page.tsx',
  'app/arcade/page.tsx',
  'app/arcade/[slug]/page.tsx',
  'components/arcade/ArcadePlaySpace.tsx',
  'components/layout/ArcadeDiscovery.tsx',
  'components/layout/Footer.tsx',
  'src/data/siteNav.ts',
];

test('the Game Network exposes every current game as a playable entry', () => {
  assert.deepEqual(
    arcadeGames.map((game) => game.slug),
    ['stretchicorn', 'unirico', 'sylvaria']
  );

  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
  }
});

test('Sylvaria Countercut v0.8.1 is canonical while Mosslight remains a compatibility alias', () => {
  const sylvaria = arcadeGames.find((game) => game.slug === 'sylvaria');
  assert.ok(sylvaria);
  assert.equal(sylvaria.title, 'Sylvaria');
  assert.equal(sylvaria.version, 'v0.8.1');
  assert.match(sylvaria.subtitle, /COUNTERCUT/);
  assert.match(sylvaria.description, /Sprid/);
  assert.match(sylvaria.description, /step-dash/i);
  assert.match(sylvaria.description, /machete/i);
  assert.ok(sylvaria.controls.some((control) => control.input === 'W A S D' && /step-dash/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Arrow Keys' && /machete/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'P' && /pause/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');

  const runtime = readRepoFile('public/game-runtimes/mosslight-v2/index.html');
  assert.match(runtime, /Sylvaria: Countercut/);
  assert.match(runtime, /Sprid/);
  assert.match(runtime, /game-v81\.js/);
  assert.match(runtime, /render-scale-v7\.js/);
  assert.match(runtime, /render-optimizer-v6\.js/);
  assert.match(runtime, /visual-system-v8\.js/);
  assert.match(runtime, /sylvaria-v8\.css/);
  assert.doesNotMatch(runtime, /game-v5\.js|Mossglint Run|fire charged gate/i);
});

test('Sylvaria Countercut keeps high-DPI rendering before gameplay and immersive visuals after gameplay', () => {
  const runtime = readRepoFile('public/game-runtimes/mosslight-v2/index.html');
  const renderScale = readRepoFile('public/game-runtimes/mosslight-v2/render-scale-v7.js');
  const optimizer = readRepoFile('public/game-runtimes/mosslight-v2/render-optimizer-v6.js');
  const visuals = readRepoFile('public/game-runtimes/mosslight-v2/visual-system-v8.js');
  const styles = readRepoFile('public/game-runtimes/mosslight-v2/sylvaria-v8.css');
  const doc = readRepoFile('docs/SYLVARIA_V08_COUNTERCUT.md');

  const renderScaleIndex = runtime.indexOf('render-scale-v7.js');
  const optimizerIndex = runtime.indexOf('render-optimizer-v6.js');
  const gameIndex = runtime.indexOf('game-v81.js');
  const visualIndex = runtime.indexOf('visual-system-v8.js');
  assert.ok(renderScaleIndex >= 0 && renderScaleIndex < optimizerIndex);
  assert.ok(optimizerIndex < gameIndex);
  assert.ok(gameIndex < visualIndex);

  assert.match(renderScale, /devicePixelRatio/);
  assert.match(renderScale, /SylvariaDisplayScale/);
  assert.match(renderScale, /ctx\.setTransform\(scale/);
  assert.match(optimizer, /GradientRequest/);
  assert.match(optimizer, /gradientCache/);
  assert.match(optimizer, /fps-downshift/);
  assert.match(optimizer, /fps-upshift/);

  assert.match(visuals, /routeGeometry: true/);
  assert.match(visuals, /lockedIntentTelegraphs: true/);
  assert.match(visuals, /requestFullscreen/);
  assert.match(visuals, /living trees are gameplay objectives and physical routing geometry/);
  assert.match(visuals, /deadwood physically blocks step-dashes/);
  assert.match(visuals, /version: '0\.8\.1'/);

  assert.match(styles, /100svh/);
  assert.match(styles, /aspect-ratio:3\/2/);
  assert.match(styles, /#sylWorldBackdrop/);
  assert.match(doc, /120 Hz/);
  assert.match(doc, /directional/i);
  assert.match(doc, /deadwood/i);
});

test('Game Network fullscreen removes portfolio chrome and gives the iframe the whole display', () => {
  const playSpace = readRepoFile('components/arcade/ArcadePlaySpace.tsx');
  assert.match(playSpace, /data-arcade-fullscreen/);
  assert.match(playSpace, /requestFullscreen\(\{ navigationUI: 'hide' \}\)/);
  assert.match(playSpace, /fullscreen \? 'hidden'/);
  assert.match(playSpace, /absolute inset-0 flex items-stretch justify-stretch p-0/);
  assert.match(playSpace, /relative h-full w-full overflow-hidden bg-black/);
  assert.match(playSpace, /style=\{fullscreen \? undefined : \{ aspectRatio: game\.aspectRatio \}\}/);
});

test('Sprid is the canonical Sylvaria protagonist name', () => {
  const sylvaria = arcadeGames.find((game) => game.slug === 'sylvaria');
  assert.ok(sylvaria);
  assert.match(sylvaria.description, /Sprid/);
  assert.ok(sylvaria.controls.some((control) => /Sprid/.test(control.action)));

  for (const path of [
    'public/game-runtimes/mosslight-v2/index.html',
    'src/data/arcadeGames.ts',
    'docs/MOSSLIGHT_MOSSGLINT_RUN_V04.md',
    'docs/MOSSLIGHT_V02_PLAYABILITY_AND_VISUAL_REVIEW.md',
    'docs/SYLVARIA_V06_VISUAL_SYSTEM.md',
    'docs/SYLVARIA_V07_IMMERSION_SYSTEM.md',
    'docs/SYLVARIA_V08_COUNTERCUT.md',
  ]) {
    const source = readRepoFile(path);
    assert.match(source, /Sprid/, `${path} should name Sprid`);
    assert.doesNotMatch(source, /Sprig/, `${path} still contains the retired Sprig name`);
  }
});

test('Game Network naming is consistent across every visible discovery surface', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Network'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));

  for (const path of gameNetworkSurfaces) {
    const source = readRepoFile(path);
    assert.doesNotMatch(source, /Game Arcade|game arcade/, `${path} still contains the old Game Arcade label`);
  }

  const home = readRepoFile('app/page.tsx');
  assert.match(home, /href="\/arcade"/);
  assert.match(home, /game network/i);
  assert.match(home, /data-gesture-target/);

  const footer = readRepoFile('components/layout/Footer.tsx');
  assert.match(footer, /href: '\/arcade', label: 'Game Network'/);

  const discovery = readRepoFile('components/layout/ArcadeDiscovery.tsx');
  assert.match(discovery, /'\/about': 'core'/);
  assert.match(discovery, /'\/projects': 'builds'/);
  assert.match(discovery, /href="\/arcade"/);
  assert.match(discovery, /game network/);
});

test('the Game Network index stays intentionally minimal', () => {
  const page = readRepoFile('app/arcade/page.tsx');
  const catalog = readRepoFile('components/arcade/ArcadeCatalog.tsx');

  assert.match(page, />\s*game network\s*</);
  assert.doesNotMatch(page, /interactive lobe|games docked|future-game ready|canvas \+ web runtimes/i);
  assert.doesNotMatch(catalog, /game\.subtitle|game\.version|game\.description|game\.tags/);
});

test('Vercel allows the site to embed its own game runtimes without allowing cross-site framing', () => {
  const vercelConfig = JSON.parse(readRepoFile('vercel.json')) as {
    headers?: Array<{
      source?: string;
      headers?: Array<{ key?: string; value?: string }>;
    }>;
  };

  const globalHeaders = vercelConfig.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? [];
  const frameOption = globalHeaders.find((header) => header.key === 'X-Frame-Options')?.value;
  assert.equal(frameOption, 'SAMEORIGIN');
  assert.notEqual(frameOption, 'DENY');

  for (const source of ['/game-runtimes/stretchicorn/(.*)', '/game-runtimes/mosslight-v2/(.*)']) {
    const runtimeHeaders = vercelConfig.headers?.find((rule) => rule.source === source)?.headers ?? [];
    assert.ok(
      runtimeHeaders.some(
        (header) => header.key === 'Content-Security-Policy' && header.value === "frame-ancestors 'self'"
      ),
      `${source} must remain frameable by the portfolio origin only`
    );
  }
});

test('Countercut browser validation includes actual Google Chrome Stable', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-sylvaria-browsers.mjs');
  const combatTest = readRepoFile('scripts/playtest-sylvaria-countercut.mjs');

  assert.match(workflow, /playwright@1\.55\.0 install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /ArrowUp/);
  assert.match(browserTest, /version !== '0\.8\.1'/);
  assert.match(combatTest, /spawnCounterShot/);
  assert.match(combatTest, /placeDeadwoodAhead/);
  assert.match(combatTest, /buffer/i);
});

test('the embedded Stretchicorn release is complete', () => {
  const runtimeRoot = 'public/game-runtimes/stretchicorn';
  const runtimeModules = [
    'src/style.css',
    'src/00-core.js',
    'src/01-combat.js',
    'src/02-update.js',
    'src/03-render.js',
    'src/04-ui-input.js',
  ];

  assert.ok(existsSync(join(root, runtimeRoot, 'index.html')));
  for (const runtimeModule of runtimeModules) {
    assert.ok(existsSync(join(root, runtimeRoot, runtimeModule)), `missing Stretchicorn runtime file: ${runtimeModule}`);
  }

  const html = readRepoFile(`${runtimeRoot}/index.html`);
  for (const runtimeModule of runtimeModules.filter((entry) => entry.endsWith('.js'))) {
    assert.match(html, new RegExp(runtimeModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(arcadeGames.find((game) => game.slug === 'stretchicorn')?.launchUrl, '/game-runtimes/stretchicorn/index.html');
});
