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

test('Sylvaria Ecological Synergy v0.10 is canonical while Mosslight remains a compatibility alias', () => {
  const sylvaria = arcadeGames.find((game) => game.slug === 'sylvaria');
  assert.ok(sylvaria);
  assert.equal(sylvaria.title, 'Sylvaria');
  assert.equal(sylvaria.version, 'v0.10.0');
  assert.match(sylvaria.subtitle, /COUNTERCUT/);
  assert.match(sylvaria.subtitle, /VERDANT FLOW/);
  assert.match(sylvaria.description, /Sprid/);
  assert.match(sylvaria.description, /840\/1040 px\/s/);
  assert.match(sylvaria.description, /returned shots can trigger mushrooms/i);
  assert.match(sylvaria.description, /gas clouds/i);
  assert.ok(sylvaria.tags.includes('ecological synergy'));
  assert.ok(sylvaria.tags.includes('verdant flow'));
  assert.ok(sylvaria.tags.includes('hazard-aware AI'));
  assert.ok(sylvaria.controls.some((control) => control.input === 'W A S D' && /persistent one-command/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Arrow Keys' && /arrival-side/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Returned shots' && /trigger fungi/i.test(control.action)));
  assert.ok(sylvaria.controls.some((control) => control.input === 'Verdant Flow' && /Crosscuts|Long Returns|terrain routes/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');
});

test('v0.10 boots through an additive entrypoint over the qualified v0.9.1 substrate', () => {
  const runtime = readRepoFile('public/game-runtimes/mosslight-v2/index.html');
  const entry = readRepoFile('public/game-runtimes/mosslight-v2/v010-entry.js');
  const synergy = readRepoFile(`${v091Root}/synergy-v010.js`);
  assert.match(runtime, /Sylvaria: Ecological Synergy/);
  assert.match(runtime, /fieldState/);
  assert.match(runtime, /v091\/fullscreen\.js/);
  assert.match(runtime, /type="module" src="\.\/v010-entry\.js"/);
  assert.doesNotMatch(runtime, /type="module" src="\.\/v091\/boot\.js"/);
  assert.doesNotMatch(runtime, /game-v90\.js|visual-system-v9\.js|game-v82\.js|game-v81\.js|input-buffer-v81\.js|game-v8\.js|game-v5\.js/);
  for (const moduleName of v091Modules) assert.ok(existsSync(join(root, v091Root, moduleName)), `missing qualified v0.9.1 module ${moduleName}`);
  assert.ok(existsSync(join(root, v091Root, 'synergy-v010.js')));
  assert.match(entry, /import '\.\/v091\/boot\.js'/);
  assert.match(entry, /await import\('\.\/v091\/synergy-v010\.js'\)/);
  assert.match(entry, /VERSION='0\.10\.0'/);
  for (const flag of ['ecologicalSynergy', 'hazardAwareAI', 'verdantFlow', 'threatPriority', 'pacBulldoze', 'returnEcology', 'gasShear']) assert.match(entry, new RegExp(`${flag}:true`));
  assert.match(synergy, /window\.SylvariaSynergy/);
});

test('v0.10 leaves protected Countercut and queue mechanics in the v0.9.1 movement substrate', () => {
  const model = readRepoFile(`${v091Root}/model.js`);
  const movement = readRepoFile(`${v091Root}/movement.js`);
  const synergy = readRepoFile(`${v091Root}/synergy-v010.js`);
  assert.match(model, /VERSION='0\.9\.1'/);
  assert.match(model, /FIXED_DT=1\/120/);
  assert.match(model, /MAX_SHOTS=128/);
  assert.match(model, /MAX_PENDING=72/);
  assert.match(movement, /state\.moveQueue=\{key,serial:\+\+state\.inputSerial\}/);
  assert.doesNotMatch(movement, /moveBuffer|moveQueue\.life/);
  assert.match(movement, /speed=perfect\?1040:840/);
  assert.match(movement, /p\.dashEcho=\.085/);
  assert.match(movement, /crosscuts/);
  assert.match(movement, /longReturns/);
  assert.match(movement, /s\.pierces=perfect\?1:0/);
  assert.doesNotMatch(synergy, /moveQueue=|function queueMove/);
  assert.doesNotMatch(synergy, /1040|840/);
});

test('Ecological Synergy composes returned fire, spores, hazard personalities, Flow, and PAC bulldozing', () => {
  const synergy = readRepoFile(`${v091Root}/synergy-v010.js`);
  const doc = readRepoFile('docs/SYLVARIA_V010_ECOLOGICAL_SYNERGY.md');
  assert.match(synergy, /originPattern/);
  assert.match(synergy, /function triggerReturnEcology/);
  assert.match(synergy, /mushroomReturns/);
  assert.match(synergy, /WAVE-SPORE BLOOM/);
  assert.match(synergy, /function shearGas/);
  assert.match(synergy, /gasShears/);
  assert.match(synergy, /SPORE SHEAR/);
  assert.match(synergy, /CAUTIOUS=new Set\(\['foreman','lobbyist','chair','broker','surveyor'\]\)/);
  assert.match(synergy, /function hazardScoreAt/);
  assert.match(synergy, /function steerCautious/);
  assert.match(synergy, /const baseEvade=F\.evadeDestinationSafe/);
  assert.match(synergy, /function bulldozeBoss/);
  assert.match(synergy, /bossBulldozes/);
  assert.match(synergy, /INDUSTRIAL BULLDOZE/);
  assert.match(synergy, /p\.flow<75/);
  assert.match(synergy, /state\.synergyChain<3/);
  assert.match(synergy, /state\.verdantTimer=3\.6/);
  assert.match(synergy, /function chooseThreat/);
  assert.match(synergy, /function drawThreat/);
  assert.match(synergy, /function drawReturnPriority/);
  assert.match(synergy, /function drawPacHeat/);
  assert.match(doc, /Countercut-authored chain reactions/);
  assert.match(doc, /Skidder Bruisers are deliberately excluded/);
  assert.match(doc, /Verdant Flow/);
  assert.match(doc, /Visual priority under chaos/);
  assert.match(doc, /13 KiB target/);
});

test('Sylvaria size profiling separates readable portfolio code from a future competition pack', () => {
  const profiler = readRepoFile('scripts/profile-sylvaria-size.mjs');
  const pkg = JSON.parse(readRepoFile('package.json')) as { scripts?: Record<string, string> };
  assert.equal(pkg.scripts?.['profile:sylvaria'], 'node scripts/profile-sylvaria-size.mjs');
  assert.match(profiler, /gzipSync/);
  assert.match(profiler, /brotliCompressSync/);
  assert.match(profiler, /competitionLimitBytes/);
  assert.match(profiler, /readableRuntime/);
  assert.match(profiler, /portfolioPayload/);
  assert.match(profiler, /competitionGap/);
  assert.match(profiler, /NOT treated as a competition-ready package/);
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
    'docs/SYLVARIA_V010_ECOLOGICAL_SYNERGY.md',
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

test('v0.10 browser/combat validation keeps the four-engine queue gauntlet and adds synergy proofs', () => {
  const workflow = readRepoFile('.github/workflows/ci.yml');
  const browserTest = readRepoFile('scripts/playtest-sylvaria-browsers.mjs');
  const combatTest = readRepoFile('scripts/playtest-sylvaria-countercut.mjs');
  const synergyTest = readRepoFile('scripts/playtest-sylvaria-synergy.mjs');
  assert.match(workflow, /playwright@1\.55\.0 install chrome/);
  assert.match(workflow, /Chrome Stable Chromium Firefox and WebKit/);
  assert.match(workflow, /profile:sylvaria/);
  assert.match(workflow, /playtest-sylvaria-synergy\.mjs/);
  assert.match(browserTest, /name:'chrome-stable'/);
  assert.match(browserTest, /channel:'chrome'/);
  assert.match(browserTest, /0\.10\.0/);
  assert.match(browserTest, /bufferedMove/);
  assert.match(browserTest, /ArrowUp/);
  assert.match(browserTest, /ecologicalSynergy/);
  assert.match(browserTest, /verdantFlow/);
  assert.match(combatTest, /labEnemyTravel/);
  assert.match(combatTest, /iceFractures/);
  assert.match(combatTest, /hazardKills/);
  assert.match(combatTest, /1040|1000/);
  assert.match(synergyTest, /mushroomReturns/);
  assert.match(synergyTest, /gasShears/);
  assert.match(synergyTest, /hazardScoreAt/);
  assert.match(synergyTest, /bossBulldozes/);
  assert.match(synergyTest, /verdantTimer/);
  assert.match(synergyTest, /threatTti/);
});

test('the embedded Stretchicorn release is complete', () => {
  const runtimeRoot = 'public/game-runtimes/stretchicorn';
  const runtimeModules = ['src/style.css', 'src/00-core.js', 'src/01-combat.js', 'src/02-update.js', 'src/03-render.js', 'src/04-ui-input.js'];
  assert.ok(existsSync(join(root, runtimeRoot, 'index.html')));
  for (const runtimeModule of runtimeModules) assert.ok(existsSync(join(root, runtimeRoot, runtimeModule)), `missing Stretchicorn runtime file: ${runtimeModule}`);
  const html = readRepoFile(`${runtimeRoot}/index.html`);
  for (const runtimeModule of runtimeModules.filter((entryName) => entryName.endsWith('.js'))) assert.match(html, new RegExp(runtimeModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(arcadeGames.find((game) => game.slug === 'stretchicorn')?.launchUrl, '/game-runtimes/stretchicorn/index.html');
});
