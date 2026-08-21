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

test('Sylvaria v0.7 is canonical while the previous Mosslight URL remains a compatibility alias', () => {
  const sylvaria = arcadeGames.find((game) => game.slug === 'sylvaria');
  assert.ok(sylvaria);
  assert.equal(sylvaria.title, 'Sylvaria');
  assert.equal(sylvaria.version, 'v0.7.0');
  assert.match(sylvaria.subtitle, /MOSSGLINT RUN/);
  assert.match(sylvaria.description, /Sprid/);
  assert.match(sylvaria.description, /full-device/);
  assert.ok(sylvaria.controls.some((control) => control.input === 'F' && /portal gate/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Enter' && /open portal/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Fullscreen' && /device display/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');

  const runtime = readRepoFile('public/game-runtimes/mosslight-v2/index.html');
  assert.match(runtime, /Sylvaria: Mossglint Run/);
  assert.match(runtime, /Sprid/);
  assert.match(runtime, /game-v5\.js/);
  assert.match(runtime, /render-scale-v7\.js/);
  assert.match(runtime, /render-optimizer-v6\.js/);
  assert.match(runtime, /visual-system-v7\.js/);
  assert.match(runtime, /sylvaria-v7\.css/);
  assert.doesNotMatch(runtime, /visual-system-v6\.js/);
  assert.doesNotMatch(runtime, /game-v4\.js/);
});

test('Sylvaria v0.7 keeps high-DPI rendering, gameplay, and immersion layers in the safe order', () => {
  const runtime = readRepoFile('public/game-runtimes/mosslight-v2/index.html');
  const renderScale = readRepoFile('public/game-runtimes/mosslight-v2/render-scale-v7.js');
  const optimizer = readRepoFile('public/game-runtimes/mosslight-v2/render-optimizer-v6.js');
  const visuals = readRepoFile('public/game-runtimes/mosslight-v2/visual-system-v7.js');
  const styles = readRepoFile('public/game-runtimes/mosslight-v2/sylvaria-v7.css');
  const doc = readRepoFile('docs/SYLVARIA_V07_IMMERSION_SYSTEM.md');

  const renderScaleIndex = runtime.indexOf('render-scale-v7.js');
  const optimizerIndex = runtime.indexOf('render-optimizer-v6.js');
  const gameIndex = runtime.indexOf('game-v5.js');
  const visualIndex = runtime.indexOf('visual-system-v7.js');
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

  for (const theme of ['forest', 'volcanic', 'reef', 'ice', 'celestial']) {
    assert.match(visuals, new RegExp(`${theme}: \\{`));
  }
  assert.match(visuals, /collection === 'celestial'/);
  assert.match(visuals, /scene\.renderCues/);
  assert.match(visuals, /sylWorldBackdrop/);
  assert.match(visuals, /drawForestBackdrop/);
  assert.match(visuals, /drawVolcanicBackdrop/);
  assert.match(visuals, /drawReefBackdrop/);
  assert.match(visuals, /drawIceBackdrop/);
  assert.match(visuals, /drawCelestialBackdrop/);
  assert.match(visuals, /detectReactions/);
  assert.match(visuals, /installFullscreenControl/);
  assert.match(visuals, /WORLD_RULES/);
  assert.match(visuals, /playtest\.version = '0\.7\.0'/);

  assert.match(styles, /100svh/);
  assert.match(styles, /safe-area-inset-top/);
  assert.match(styles, /--syl-playfield-w/);
  assert.match(styles, /--syl-playfield-h/);
  assert.match(styles, /#sylWorldBackdrop/);
  assert.match(styles, /data-syl-pseudo-fullscreen/);

  assert.match(doc, /logical 960×640/);
  assert.match(doc, /high-DPI/);
  assert.match(doc, /full-device/);
  assert.match(doc, /five world families/i);
  assert.match(doc, /performance budget/i);
  assert.match(doc, /visual QA matrix/i);
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

test('Game Network browser validation includes actual Google Chrome Stable', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-arcade-browsers.mjs');

  assert.match(workflow, /playwright@1\.55\.0 install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name: 'chrome-stable'/);
  assert.match(browserTest, /channel: 'chrome'/);
  assert.match(browserTest, /testSylvaria\(page, engineName\)/);
  assert.match(browserTest, /testStretchicorn\(page, engineName\)/);
  assert.match(browserTest, /testUniRico\(page, engineName\)/);
  assert.match(browserTest, /page\.keyboard\.press\('f'\)/);
  assert.match(browserTest, /SylvariaVisualSystem/);
  assert.match(browserTest, /SylvariaRenderBudget/);
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
