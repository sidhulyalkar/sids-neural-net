import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames, getArcadeGame } from '../src/data/arcadeGames';
import { primaryNavItems, siteNavItems } from '../src/data/siteNav';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const runtime = 'public/game-runtimes/mosslight-v2';
const v091 = `${runtime}/v091`;
const v011 = `${runtime}/v011`;
const v012 = `${runtime}/v012`;

const gameNetworkSurfaces = [
  'app/page.tsx', 'app/arcade/page.tsx', 'app/arcade/[slug]/page.tsx',
  'components/arcade/ArcadePlaySpace.tsx', 'components/layout/ArcadeDiscovery.tsx',
  'components/layout/Footer.tsx', 'src/data/siteNav.ts',
];

test('the Game Network exposes every current game as a playable entry', () => {
  assert.deepEqual(arcadeGames.map((game) => game.slug), ['stretchicorn', 'unirico', 'sylvaria']);
  for (const game of arcadeGames) {
    assert.equal(game.status, 'playable');
    assert.ok(game.launchUrl);
  }
});

test('Sylvaria v0.12 presents the frog pond while the ranked engine stays on qualified v0.11.1', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria');
  assert.equal(game.version, 'v0.12.0');
  assert.match(game.subtitle, /HOP.*SLAP.*REFLECT/);
  assert.match(game.description, /frog-and-pond/i);
  assert.match(game.description, /Thirty fixed pond arenas/i);
  assert.match(game.description, /120 Hz/);
  assert.match(game.description, /server-verified/i);
  assert.match(game.description, /WebGL2/i);
  assert.doesNotMatch(`${game.subtitle} ${game.description}`, /Sprid|Verdant Flow|Ecological Synergy|PAC-a-Saw/i);
  for (const tag of ['fixed arenas', 'deterministic replay', 'frog', 'webgl2']) assert.ok(game.tags.includes(tag));
  assert.ok(game.controls.some((control) => control.input === 'W A S D' && /movement|queued/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Arrow Keys' && /tongue|reflect/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Explore' && /optional routes|temporary/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');
});

test('v0.12 boots WebGL frog presentation over the qualified v0.11.1 simulation substrate', () => {
  const html = read(`${runtime}/index.html`);
  const entry11 = read(`${runtime}/v011-entry.js`);
  const entry12 = read(`${runtime}/v012-entry.js`);
  const rooms = read(`${v011}/rooms-v011.js`);
  const replay = read(`${v011}/replay-v011.js`);
  const pond = read(`${v012}/webgl-pond-v012.js`);
  const atlasEntry = read(`${v012}/art-atlas-v012.js`);
  const atlas = read(`${v012}/art-atlas-pro-v012.js`);
  const synergy = read(`${v091}/synergy-v010.js`);

  assert.match(html, /Sylvaria · Frog Pond/);
  assert.match(html, /sylvaria-pond-v012\.css/);
  assert.match(html, /v091\/fullscreen\.js/);
  assert.match(html, /src="\.\/v012-entry\.js"/);
  assert.doesNotMatch(html, /src="\.\/v010-entry\.js"|src="\.\/v091\/boot\.js"/);

  for (const moduleName of ['model.js', 'world.js', 'movement.js', 'battle-core.js', 'render.js', 'boot.js', 'fullscreen.js']) {
    assert.ok(existsSync(join(root, v091, moduleName)), `missing v0.9.1 module ${moduleName}`);
  }
  for (const moduleName of ['rooms-v011.js', 'presentation-v011.js', 'replay-v011.js']) {
    assert.ok(existsSync(join(root, v011, moduleName)), `missing v0.11.1 module ${moduleName}`);
  }
  for (const moduleName of ['webgl-pond-v012.js', 'art-atlas-v012.js', 'art-atlas-pro-v012.js']) {
    assert.ok(existsSync(join(root, v012, moduleName)), `missing v0.12 module ${moduleName}`);
  }

  assert.match(entry11, /VERSION='0\.11\.1'/);
  for (const flag of ['expandedArenas', 'minimalPresentation', 'deterministicReplay', 'ecologicalSynergy', 'hazardAwareAI', 'flow', 'threatPriority', 'bossBulldoze', 'returnEcology', 'gasShear']) assert.ok(entry11.includes(`${flag}:true`));
  assert.match(entry12, /PRESENTATION='0\.12\.0',ENGINE='0\.11\.1'/);
  assert.match(entry12, /createPondRenderer/);
  assert.match(entry12, /F\.render=/);
  assert.doesNotMatch(entry12, /F\.(?:update|updateMovement|updateEnemies|updateShots|cut|dashStep|counterShot)\s*=/);
  assert.match(pond, /getContext\('webgl2'/);
  assert.match(pond, /emit\('tongue'/);
  assert.match(atlasEntry, /art-atlas-pro-v012\.js/);
  assert.match(atlas, /function frog/);
  assert.match(atlas, /function fastHeight/);
  assert.doesNotMatch(atlas, /getImageData|putImageData|willReadFrequently|\.roundRect\(/);
  assert.match(rooms, /bossName:'Surveyor'/);
  assert.match(rooms, /bossName:'Harvester'/);
  assert.match(rooms, /bossName:'Mulcher'/);
  assert.match(replay, /VERSION='0\.11\.1'/);
  assert.match(synergy, /window\.SylvariaSynergy/);
});

test('v0.11.1 leaves protected Countercut and queue mechanics in the v0.9.1 movement substrate', () => {
  const model = read(`${v091}/model.js`);
  const movement = read(`${v091}/movement.js`);
  const synergy = read(`${v091}/synergy-v010.js`);
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
  assert.doesNotMatch(synergy, /moveQueue=|function queueMove|1040|840/);
});

test('the inherited ecological subsystem still composes returned fire spores cautious AI Flow and boss routing', () => {
  const synergy = read(`${v091}/synergy-v010.js`);
  const doc = read('docs/SYLVARIA_V010_ECOLOGICAL_SYNERGY.md');
  for (const token of ['originPattern', 'triggerReturnEcology', 'mushroomReturns', 'WAVE-SPORE BLOOM', 'shearGas', 'gasShears', 'SPORE SHEAR', 'hazardScoreAt', 'steerCautious', 'bulldozeBoss', 'bossBulldozes', 'INDUSTRIAL BULLDOZE', 'chooseThreat', 'drawThreat', 'drawReturnPriority', 'drawPacHeat']) assert.ok(synergy.includes(token), `missing ecology token ${token}`);
  assert.match(synergy, /CAUTIOUS=new Set\(\['foreman','lobbyist','chair','broker','surveyor'\]\)/);
  assert.match(synergy, /p\.flow<75/);
  assert.match(synergy, /state\.synergyChain<3/);
  assert.match(synergy, /state\.verdantTimer=3\.6/);
  assert.match(doc, /Countercut-authored chain reactions/);
  assert.match(doc, /Skidder Bruisers are deliberately excluded/);
  assert.match(doc, /Verdant Flow/);
  assert.match(doc, /Visual priority under chaos/);
  assert.match(doc, /13 KiB target/);
});

test('Sylvaria size profiling separates readable portfolio code from a future competition pack', () => {
  const profiler = read('scripts/profile-sylvaria-size.mjs');
  const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
  assert.equal(pkg.scripts?.['profile:sylvaria'], 'node scripts/profile-sylvaria-size.mjs');
  for (const token of ['gzipSync', 'brotliCompressSync', 'competitionLimitBytes', 'readableRuntime', 'portfolioPayload', 'competitionGap', 'art-atlas-pro-v012.js']) assert.ok(profiler.includes(token));
  assert.match(profiler, /NOT treated as a competition-ready package/);
});

test('Game Network fullscreen removes portfolio chrome and gives the iframe the whole display', () => {
  const source = read('components/arcade/ArcadePlaySpace.tsx');
  for (const token of ['data-arcade-fullscreen', "requestFullscreen({ navigationUI: 'hide' })", "fullscreen ? 'hidden'", 'absolute inset-0 flex items-stretch justify-stretch p-0', 'relative h-full w-full overflow-hidden bg-black']) assert.ok(source.includes(token));
  assert.match(source, /aspectRatio: game\.aspectRatio/);
});

test('current Sylvaria player-facing surfaces keep the vocabulary restrained', () => {
  const visible = [read(`${runtime}/index.html`), read('src/data/arcadeGames.ts')].join('\n');
  assert.doesNotMatch(visible, /Sprid|Sprig|Verdant Flow|Ecological Synergy|PAC-a-Saw|Heartleaf|Rush Resin|Barkguard|Edge Stone|Flow Sap/i);
  for (const word of ['Sylvaria', 'frog', 'tongue', 'reflect', 'pond']) assert.match(visible, new RegExp(word, 'i'));
});

test('Game Network naming is consistent across every visible discovery surface', () => {
  assert.ok(siteNavItems.some((item) => item.href === '/arcade' && item.label === 'Game Network'));
  assert.ok(primaryNavItems.some((item) => item.href === '/arcade'));
  for (const path of gameNetworkSurfaces) assert.doesNotMatch(read(path), /Game Arcade|game arcade/, `${path} contains old naming`);
  assert.match(read('app/page.tsx'), /href="\/arcade"/);
  assert.match(read('components/layout/Footer.tsx'), /href: '\/arcade', label: 'Game Network'/);
  const discovery = read('components/layout/ArcadeDiscovery.tsx');
  assert.match(discovery, /'\/about': 'core'/);
  assert.match(discovery, /'\/projects': 'builds'/);
  assert.match(discovery, /href="\/arcade"/);
});

test('the Game Network index stays intentionally minimal', () => {
  const page = read('app/arcade/page.tsx');
  const catalog = read('components/arcade/ArcadeCatalog.tsx');
  assert.match(page, />\s*game network\s*</);
  assert.doesNotMatch(page, /interactive lobe|games docked|future-game ready|canvas \+ web runtimes/i);
  assert.doesNotMatch(catalog, /game\.subtitle|game\.version|game\.description|game\.tags/);
});

test('Vercel allows same-origin game embedding without allowing cross-site framing', () => {
  const config = JSON.parse(read('vercel.json')) as { headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }> };
  const global = config.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? [];
  assert.equal(global.find((header) => header.key === 'X-Frame-Options')?.value, 'SAMEORIGIN');
  for (const source of ['/game-runtimes/stretchicorn/(.*)', '/game-runtimes/mosslight-v2/(.*)']) {
    const headers = config.headers?.find((rule) => rule.source === source)?.headers ?? [];
    assert.ok(headers.some((header) => header.key === 'Content-Security-Policy' && header.value === "frame-ancestors 'self'"));
  }
});

test('v0.12 browser validation keeps WebGL frog presentation and v0.11.1 replay parity in the same gate', () => {
  const workflow = read('.github/workflows/ci.yml');
  const browser = read('scripts/playtest-sylvaria-browsers.mjs');
  const parity = read('scripts/playtest-sylvaria-replay-parity.mjs');
  const combat = read('scripts/playtest-sylvaria-countercut.mjs');
  const synergy = read('scripts/playtest-sylvaria-synergy.mjs');
  for (const token of ['Chrome Stable Chromium Firefox and WebKit', 'profile:sylvaria', 'playtest-sylvaria-replay-parity.mjs', 'playtest-sylvaria-synergy.mjs']) assert.ok(workflow.includes(token));
  for (const token of ["name:'chrome-stable'", "channel:'chrome'", '0.12.0', '0.11.1', 'SylvariaPondRenderer', 'frogPond', 'tongueAttack', 'tonguePulses', 'bufferedMove', 'ArrowUp', 'expandedArenas', 'minimalPresentation']) assert.ok(browser.includes(token));
  assert.match(parity, /simulateSylvariaReplay/);
  assert.match(parity, /0\.11\.1/);
  for (const token of ['labEnemyTravel', 'iceFractures', 'hazardKills']) assert.ok(combat.includes(token));
  assert.match(combat, /1040|1000/);
  for (const token of ['mushroomReturns', 'gasShears', 'hazardScoreAt', 'bossBulldozes', 'verdantTimer', 'threatTti']) assert.ok(synergy.includes(token));
});

test('the embedded Stretchicorn release is complete', () => {
  const rootPath = 'public/game-runtimes/stretchicorn';
  const modules = ['src/style.css', 'src/00-core.js', 'src/01-combat.js', 'src/02-update.js', 'src/03-render.js', 'src/04-ui-input.js'];
  assert.ok(existsSync(join(root, rootPath, 'index.html')));
  for (const moduleName of modules) assert.ok(existsSync(join(root, rootPath, moduleName)), `missing Stretchicorn runtime file ${moduleName}`);
  const html = read(`${rootPath}/index.html`);
  for (const moduleName of modules.filter((name) => name.endsWith('.js'))) assert.ok(html.includes(moduleName));
  assert.equal(arcadeGames.find((game) => game.slug === 'stretchicorn')?.launchUrl, '/game-runtimes/stretchicorn/index.html');
});
