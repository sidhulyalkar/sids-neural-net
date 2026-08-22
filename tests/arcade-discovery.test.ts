import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames, getArcadeGame } from '../src/data/arcadeGames';
import { primaryNavItems, siteNavItems } from '../src/data/siteNav';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');
const v091Root = 'public/game-runtimes/mosslight-v2/v091';
const v091Modules = ['model.js', 'world.js', 'movement.js', 'battle-core.js', 'render.js', 'boot.js', 'fullscreen.js'];
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
  assert.deepEqual(arcadeGames.map((game) => game.slug), ['stretchicorn', 'unirico', 'sylvaria']);
  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable', `${game.title} should be playable`);
    assert.ok(game.launchUrl, `${game.title} should have a launch URL`);
  }
});

test('Sylvaria Forage and Fracture v0.9.1 is canonical while Mosslight remains a compatibility alias', () => {
  const sylvaria = arcadeGames.find((game) => game.slug === 'sylvaria');
  assert.ok(sylvaria);
  assert.equal(sylvaria.title, 'Sylvaria');
  assert.equal(sylvaria.version, 'v0.9.1');
  assert.match(sylvaria.subtitle, /COUNTERCUT/);
  assert.match(sylvaria.subtitle, /FORAGE/);
  assert.match(sylvaria.subtitle, /FRACTURE/);
  assert.match(sylvaria.description, /Sprid/);
  assert.match(sylvaria.description, /840\/1040 px\/s/);
  assert.match(sylvaria.description, /mushroom|fungi/i);
  assert.match(sylvaria.description, /toxic spore/i);
  assert.ok(sylvaria.tags.includes('terrain tactics'));
  assert.ok(sylvaria.tags.includes('forage'));
  assert.ok(sylvaria.tags.includes('forest chemistry'));
  assert.ok(sylvaria.controls.some((control) => control.input === 'W A S D' && /persistent one-command/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Arrow Keys' && /machete/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Explore' && /grass|deadwood|rubble|fungi/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');
});

test('v0.9.1 production runtime uses one canonical modular graph and preserves display infrastructure', () => {
  const runtime = readRepoFile('public/game-runtimes/mosslight-v2/index.html');
  assert.match(runtime, /Sylvaria: Environmental Resonance/);
  assert.match(runtime, /fieldState/);
  assert.match(runtime, /v091\/fullscreen\.js/);
  assert.match(runtime, /type="module" src="\.\/v091\/boot\.js"/);
  assert.match(runtime, /render-scale-v7\.js/);
  assert.match(runtime, /render-optimizer-v6\.js/);
  assert.match(runtime, /sylvaria-v8\.css/);
  assert.doesNotMatch(runtime, /game-v90\.js|visual-system-v9\.js|game-v82\.js|game-v81\.js|input-buffer-v81\.js|game-v8\.js|game-v5\.js/);

  for (const moduleName of v091Modules) {
    assert.ok(existsSync(join(root, v091Root, moduleName)), `missing canonical v0.9.1 module ${moduleName}`);
  }
  for (const retired of ['combat.js', 'battle.js']) {
    assert.equal(existsSync(join(root, v091Root, retired)), false, `superseded v0.9.1 module should not remain: ${retired}`);
  }

  const scaleIndex = runtime.indexOf('render-scale-v7.js');
  const optimizerIndex = runtime.indexOf('render-optimizer-v6.js');
  const fullscreenIndex = runtime.indexOf('v091/fullscreen.js');
  const bootIndex = runtime.indexOf('v091/boot.js');
  assert.ok(scaleIndex >= 0 && scaleIndex < optimizerIndex);
  assert.ok(optimizerIndex < fullscreenIndex && fullscreenIndex < bootIndex);

  const renderScale = readRepoFile('public/game-runtimes/mosslight-v2/render-scale-v7.js');
  const optimizer = readRepoFile('public/game-runtimes/mosslight-v2/render-optimizer-v6.js');
  const fullscreen = readRepoFile(`${v091Root}/fullscreen.js`);
  assert.match(renderScale, /devicePixelRatio/);
  assert.match(renderScale, /SylvariaDisplayScale/);
  assert.match(optimizer, /gradientCache/);
  assert.match(optimizer, /fps-downshift/);
  assert.match(fullscreen, /requestFullscreen/);
});

test('v0.9.1 protects Countercut while adding shared ecology, temporary forage, and centralized hazards', () => {
  const model = readRepoFile(`${v091Root}/model.js`);
  const world = readRepoFile(`${v091Root}/world.js`);
  const movement = readRepoFile(`${v091Root}/movement.js`);
  const battle = readRepoFile(`${v091Root}/battle-core.js`);
  const render = readRepoFile(`${v091Root}/render.js`);
  const boot = readRepoFile(`${v091Root}/boot.js`);
  const doc = readRepoFile('docs/SYLVARIA_V09_ENVIRONMENTAL_RESONANCE.md');

  assert.match(model, /VERSION='0\.9\.1'/);
  assert.match(model, /FIXED_DT=1\/120/);
  assert.match(model, /MAX_SHOTS=128/);
  assert.match(model, /MAX_PENDING=72/);
  for (const terrain of ['ice', 'mud', 'sand', 'water', 'bramble', 'grass', 'shards']) assert.match(model, new RegExp(`${terrain}:`));
  for (const forage of ['heartleaf', 'rushResin', 'barkguard', 'edgeStone', 'flowSap']) assert.match(model, new RegExp(`${forage}:`));
  for (const mushroom of ['heartcap', 'swiftcap', 'guardcap', 'edgecap', 'venomcap', 'ghostcap']) assert.match(model, new RegExp(`${mushroom}:`));

  assert.match(movement, /state\.moveQueue=\{key,serial:\+\+state\.inputSerial\}/);
  assert.doesNotMatch(movement, /moveBuffer|moveQueue\.life/);
  assert.match(movement, /speed=perfect\?1040:840/);
  assert.match(movement, /function tryDashCutIce/);
  assert.match(movement, /p\.dashEcho>0/);
  assert.match(movement, /p\.dashEcho=\.085/);
  assert.match(movement, /type:'shards'/);
  assert.match(movement, /p\.buffs\.edge>0\?24:0/);

  assert.match(world, /function terrainAt/);
  assert.match(world, /function mobilityAt/);
  assert.match(world, /function resolveEnemyDeath/);
  assert.match(world, /function updateBossPhases/);
  assert.match(world, /function resolveBossDeath/);
  assert.match(world, /function updateGas/);
  assert.match(world, /function rewardExploration/);
  assert.match(world, /function collectPickup/);
  assert.match(world, /hazardKills/);
  assert.match(world, /gasRoutes/);

  assert.match(battle, /function moveToward/);
  assert.match(battle, /speed\*mob\.move\*dt/);
  assert.match(battle, /speed=420\*global\*mob\.move/);
  assert.match(battle, /ESCAPE JAMMED/);
  assert.match(battle, /function ventBoss/);
  assert.match(battle, /b\.sawAngle/);
  assert.match(battle, /b\.heat/);
  assert.match(battle, /b\.exhaustClock/);

  assert.match(render, /function drawMushrooms/);
  assert.match(render, /function drawGas/);
  assert.match(render, /function drawPickups/);
  assert.match(render, /function drawBoss/);
  assert.match(render, /strokeStyle=heat>\.6\?'#ffd27b'/);
  assert.match(render, /b\.sawAngle/);

  assert.match(boot, /function labEnemyTravel/);
  assert.match(boot, /F\.moveToward\(e,state\.player,ENEMY_TYPES\[type\]\.speed,FIXED_DT\)/);
  assert.match(boot, /environmentalDiscovery:true/);
  assert.match(boot, /symmetricSporeHazards:true/);
  assert.match(boot, /pacIndustrialSilhouette:true/);
  assert.match(boot, /pacExhaustTelegraph:true/);

  assert.match(doc, /85 ms post-dash echo window/);
  assert.match(doc, /forest chemistry/i);
  assert.match(doc, /centralized hazard bookkeeping/i);
  assert.match(doc, /PAC-a-Saw/);
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
    'docs/SYLVARIA_V09_ENVIRONMENTAL_RESONANCE.md',
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
    headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
  };
  const globalHeaders = vercelConfig.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? [];
  const frameOption = globalHeaders.find((header) => header.key === 'X-Frame-Options')?.value;
  assert.equal(frameOption, 'SAMEORIGIN');
  assert.notEqual(frameOption, 'DENY');
  for (const source of ['/game-runtimes/stretchicorn/(.*)', '/game-runtimes/mosslight-v2/(.*)']) {
    const runtimeHeaders = vercelConfig.headers?.find((rule) => rule.source === source)?.headers ?? [];
    assert.ok(runtimeHeaders.some((header) => header.key === 'Content-Security-Policy' && header.value === "frame-ancestors 'self'"), `${source} must remain frameable by the portfolio origin only`);
  }
});

test('v0.9.1 browser and combat validation keep the four-engine queue gauntlet plus ecology proofs', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-sylvaria-browsers.mjs');
  const combatTest = readRepoFile('scripts/playtest-sylvaria-countercut.mjs');
  assert.match(workflow, /playwright@1\.55\.0 install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(browserTest, /name:'chrome-stable'/);
  assert.match(browserTest, /channel:'chrome'/);
  assert.match(browserTest, /0\.9\.1/);
  assert.match(browserTest, /bufferedMove/);
  assert.match(browserTest, /ArrowUp/);
  assert.match(browserTest, /environmentalDiscovery/);
  assert.match(combatTest, /labEnemyTravel/);
  assert.match(combatTest, /iceFractures/);
  assert.match(combatTest, /triggerMushroom/);
  assert.match(combatTest, /Venomcap|venomcap/);
  assert.match(combatTest, /hazardKills/);
  assert.match(combatTest, /applyHazardToBoss/);
  assert.match(combatTest, /terrainRoutes/);
  assert.match(combatTest, /1040|1000/);
});

test('the embedded Stretchicorn release is complete', () => {
  const runtimeRoot = 'public/game-runtimes/stretchicorn';
  const runtimeModules = ['src/style.css', 'src/00-core.js', 'src/01-combat.js', 'src/02-update.js', 'src/03-render.js', 'src/04-ui-input.js'];
  assert.ok(existsSync(join(root, runtimeRoot, 'index.html')));
  for (const runtimeModule of runtimeModules) assert.ok(existsSync(join(root, runtimeRoot, runtimeModule)), `missing Stretchicorn runtime file: ${runtimeModule}`);
  const html = readRepoFile(`${runtimeRoot}/index.html`);
  for (const runtimeModule of runtimeModules.filter((entry) => entry.endsWith('.js'))) assert.match(html, new RegExp(runtimeModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(arcadeGames.find((game) => game.slug === 'stretchicorn')?.launchUrl, '/game-runtimes/stretchicorn/index.html');
});