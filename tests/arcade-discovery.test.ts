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
const v013 = `${runtime}/v013`;
const v014 = `${runtime}/v014`;
const v015 = `${runtime}/v015`;
const gameNetworkSurfaces = ['app/page.tsx','app/arcade/page.tsx','app/arcade/[slug]/page.tsx','components/arcade/ArcadePlaySpace.tsx','components/layout/ArcadeDiscovery.tsx','components/layout/Footer.tsx','src/data/siteNav.ts'];

test('the Game Network exposes every current game as a playable entry', () => {
  assert.deepEqual(arcadeGames.map((game) => game.slug), ['stretchicorn', 'unirico', 'sylvaria']);
  for (const game of arcadeGames) { assert.equal(game.status, 'playable'); assert.ok(game.launchUrl); }
});

test('Sylvaria v0.15 advertises the Cutstep forest alpha actually shipped by production', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria');
  assert.equal(game.version, 'v0.15.0');
  assert.match(game.subtitle, /DRAW THE LINE.*SURVIVE THE FOREST/);
  for (const phrase of [/120 Hz/i,/Cutstep/i,/WASD/i,/Arrow keys or mouse/i,/no charge delay/i,/three segment/i,/Thrusts/i,/Crosscuts/i,/reversals/i,/misty pine/i,/oak/i,/cedar/i,/burnscar/i,/ancient-grove/i,/regrowing undergrowth/i,/ranking remains paused/i]) assert.match(game.description, phrase);
  for (const tag of ['dark forest','cutstep','independent aim','segmented movement','projectile reflection','geometry combat','regrowing undergrowth','120 hz simulation']) assert.ok(game.tags.includes(tag));
  assert.ok(game.controls.some((control) => control.input === 'W A S D' && /without changing.*aim/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Arrow Keys' && /aim/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Mouse' && /free-angle/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Space' && /instant.*no hold.*charge.*release/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Forest ecology' && /regrowing understory/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');
});

test('v0.15 boots v0.14 as a preserved substrate then owns the polished forest combat alpha', () => {
  const html = read(`${runtime}/index.html`),entry11=read(`${runtime}/v011-entry.js`),entry12=read(`${runtime}/v012-entry.js`),entry13=read(`${runtime}/v013-entry.js`),entry14=read(`${runtime}/v014-entry.js`),entry15=read(`${runtime}/v015-entry.js`);
  assert.match(html, /Sylvaria · Cutstep Forest/);
  assert.match(html, /sylvaria-forest-v015\.css/);
  assert.match(html, /src="\.\/v015-entry\.js"/);
  assert.doesNotMatch(html, /src="\.\/v014-entry\.js"|src="\.\/v013-entry\.js"|src="\.\/v012-entry\.js"/);
  for (const moduleName of ['model.js','world.js','movement.js','battle-core.js','render.js','boot.js','fullscreen.js']) assert.ok(existsSync(join(root,v091,moduleName)),`missing baseline ${moduleName}`);
  for (const moduleName of ['rooms-v011.js','presentation-v011.js','input-guard-v011.js','competitive-v011.js']) assert.ok(existsSync(join(root,v011,moduleName)),`missing inherited ${moduleName}`);
  for (const moduleName of ['webgl-pond-v012.js','art-atlas-v012.js','art-atlas-pro-v012.js']) assert.ok(existsSync(join(root,v012,moduleName)),`missing v0.12 renderer ${moduleName}`);
  for (const moduleName of ['kinetic-combat-v013.js','enemy-ai-v013.js','replay-v013.js','coach-v013.js','kinetic-presentation-v013.js']) assert.ok(existsSync(join(root,v013,moduleName)),`missing v0.13 substrate ${moduleName}`);
  for (const moduleName of ['character-rig-v014.js','combat-flow-v014.js','enemy-flow-v014.js','boss-flow-v014.js','threat-manager-v014.js','flow-presentation-v014.js']) assert.ok(existsSync(join(root,v014,moduleName)),`missing v0.14 substrate ${moduleName}`);
  for (const moduleName of ['cutstep-v015.js','encounter-director-v015.js','forest-world-v015.js','discoveries-v015.js','forest-actors-v015.js','cutstep-presentation-v015.js']) assert.ok(existsSync(join(root,v015,moduleName)),`missing v0.15 module ${moduleName}`);
  assert.doesNotMatch(entry11,/replay-v011|coach-v011|competitive-v011/);
  assert.match(entry12,/PRESENTATION='0\.12\.0',ENGINE='0\.11\.1'/);
  for(const moduleName of ['kinetic-combat-v013.js','enemy-ai-v013.js','replay-v013.js','coach-v013.js','kinetic-presentation-v013.js'])assert.ok(entry13.includes(moduleName));
  assert.match(entry14,/await import\('\.\/v013-entry\.js'\)/);
  assert.match(entry15,/await import\('\.\/v014-entry\.js'\)/);
  for(const moduleName of ['cutstep-v015.js','encounter-director-v015.js','forest-world-v015.js','discoveries-v015.js','forest-actors-v015.js','cutstep-presentation-v015.js'])assert.ok(entry15.includes(moduleName),`v0.15 entry missing ${moduleName}`);
  assert.match(entry15,/v0\.15 Cutstep alpha · verifier migration required/);
  assert.match(entry15,/POLISHED FOREST COMBAT ALPHA/);
});

test('the exact-source v0.13 verifier remains reconstructible beneath v0.15', () => {
  const model=read(`${v091}/model.js`),movement=read(`${v091}/movement.js`),kinetics=read(`${v013}/kinetic-combat-v013.js`),replay=read(`${v013}/replay-v013.js`),serverReplay=read('src/lib/sylvaria/replay.ts');
  assert.match(model,/FIXED_DT=1\/120/);assert.match(model,/MAX_SHOTS=128/);assert.match(model,/MAX_PENDING=72/);
  assert.match(movement,/state\.moveQueue=\{key,serial:\+\+state\.inputSerial\}/);
  assert.match(kinetics,/Object\.assign\(F,\{beginDashCharge,releaseDashCharge/);
  assert.match(replay,/VERSION='0\.13\.0'/);assert.match(serverReplay,/SYLVARIA_ENGINE_VERSION = '0\.13\.0'/);
  assert.match(entryRankBoundary(),/ranked:false/);
});
function entryRankBoundary(){return read(`${runtime}/v015-entry.js`)}

test('v0.15 keeps the useful deterministic combat substrate while replacing the public player verb', () => {
  const cut=read(`${v015}/cutstep-v015.js`),boss=read(`${v014}/boss-flow-v014.js`),threats=read(`${v014}/threat-manager-v014.js`),enemy=read(`${v014}/enemy-flow-v014.js`);
  assert.match(cut,/F\.beginDashCharge=\(\)=>false;F\.releaseDashCharge=\(\)=>false/);
  assert.match(cut,/kind:'thrust'/);assert.match(cut,/kind:'crosscut'/);assert.match(cut,/kind:'reversal'/);
  assert.match(boss,/guardByPhase:Object\.freeze\(\{1:3,2:4,3:5\}\)/);
  assert.match(threats,/ROOM_THREAT_PROFILES/);assert.match(enemy,/spec\.dodge=100/);
});

test('current Sylvaria player-facing surfaces use forest Cutstep vocabulary', () => {
  const visible=[read(`${runtime}/index.html`),read('src/data/arcadeGames.ts')].join('\n');
  for(const word of ['Sylvaria','forest','Cutstep','WASD','Arrow','mouse','Thrust','Crosscut','Reversal','undergrowth'])assert.match(visible,new RegExp(word,'i'));
  assert.doesNotMatch(visible,/Kinetic Pond|01 \/ pond|<b>lilies<\/b>|hold \/ release dash|156° tongue|Reactive Blade sweep/i);
});

test('Game Network fullscreen removes portfolio chrome and gives the iframe the whole display', () => {
  const source=read('components/arcade/ArcadePlaySpace.tsx');
  for(const token of ['data-arcade-fullscreen',"requestFullscreen({ navigationUI: 'hide' })","fullscreen ? 'hidden'",'absolute inset-0 flex items-stretch justify-stretch p-0','relative h-full w-full overflow-hidden bg-black'])assert.ok(source.includes(token));
  assert.match(source,/aspectRatio: game\.aspectRatio/);
});

test('Game Network naming is consistent across every visible discovery surface', () => {
  assert.ok(siteNavItems.some((item)=>item.href==='/arcade'&&item.label==='Game Network'));assert.ok(primaryNavItems.some((item)=>item.href==='/arcade'));
  for(const path of gameNetworkSurfaces)assert.doesNotMatch(read(path),/Game Arcade|game arcade/,`${path} contains old naming`);
  assert.match(read('app/page.tsx'),/href="\/arcade"/);assert.match(read('components/layout/Footer.tsx'),/href: '\/arcade', label: 'Game Network'/);
  const discovery=read('components/layout/ArcadeDiscovery.tsx');assert.match(discovery,/'\/about': 'core'/);assert.match(discovery,/'\/projects': 'builds'/);assert.match(discovery,/href="\/arcade"/);
});

test('the Game Network index stays intentionally minimal', () => {
  const page=read('app/arcade/page.tsx'),catalog=read('components/arcade/ArcadeCatalog.tsx');assert.match(page,/>\s*game network\s*</);assert.doesNotMatch(page,/interactive lobe|games docked|future-game ready|canvas \+ web runtimes/i);assert.doesNotMatch(catalog,/game\.subtitle|game\.version|game\.description|game\.tags/);
});

test('Vercel allows same-origin game embedding without allowing cross-site framing', () => {
  const config=JSON.parse(read('vercel.json')) as {headers?:Array<{source?:string;headers?:Array<{key?:string;value?:string}>}>};const global=config.headers?.find((rule)=>rule.source==='/(.*)')?.headers??[];assert.equal(global.find((header)=>header.key==='X-Frame-Options')?.value,'SAMEORIGIN');
  for(const source of ['/game-runtimes/stretchicorn/(.*)','/game-runtimes/mosslight-v2/(.*)']){const headers=config.headers?.find((rule)=>rule.source===source)?.headers??[];assert.ok(headers.some((header)=>header.key==='Content-Security-Policy'&&header.value==="frame-ancestors 'self'"))}
});

test('the embedded Stretchicorn release is complete', () => {
  const rootPath='public/game-runtimes/stretchicorn',modules=['src/style.css','src/00-core.js','src/01-combat.js','src/02-update.js','src/03-render.js','src/04-ui-input.js'];assert.ok(existsSync(join(root,rootPath,'index.html')));for(const moduleName of modules)assert.ok(existsSync(join(root,rootPath,moduleName)),`missing Stretchicorn runtime file ${moduleName}`);const html=read(`${rootPath}/index.html`);for(const moduleName of modules.filter((name)=>name.endsWith('.js')))assert.ok(html.includes(moduleName));assert.equal(arcadeGames.find((game)=>game.slug==='stretchicorn')?.launchUrl,'/game-runtimes/stretchicorn/index.html');
});
