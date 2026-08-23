import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames, getArcadeGame } from '../src/data/arcadeGames';
import { primaryNavItems, siteNavItems } from '../src/data/siteNav';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const runtime = 'public/game-runtimes/mosslight-v2';
const sideviewRuntime = 'public/game-runtimes/sylvaria-v2';
const ascentRuntime = 'public/game-runtimes/sylvaria-v3';
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

test('current Sylvaria metadata describes the Sapline ancient-tree action platformer actually launched by production', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria');
  assert.equal(game.version, 'v3.1.0-alpha.1');
  assert.equal(game.launchUrl, '/game-runtimes/sylvaria-v3/index.html');
  assert.equal(game.aspectRatio, '16 / 9');
  assert.deepEqual(game.nativeSize,{width:1280,height:720});
  assert.match(game.subtitle,/ASCEND.*SLING.*HEIGHT/);
  for (const phrase of [/vertical/i,/ancient tree/i,/Rootreach/i,/Movement is the primary weapon/i,/Arrow keys/i,/Sapline/i,/Resin Knots/i,/Canopy Step/i,/short machete/i,/Bark Grip/i,/deadwood/i,/downward enemy hits/i,/Crown Feller/i,/120 Hz/i]) assert.match(game.description, phrase);
  for (const tag of ['action platformer','vertical ascent','dark forest','sapline','elastic tether','momentum platforming','tree traversal','branch physics','vine swinging','wall movement','aerial combat','projectile counter','boss combat','custom keybinds','120 hz simulation']) assert.ok(game.tags.includes(tag));
  assert.ok(game.controls.some((control) => control.input === '← / →' && /run/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Space' && /jump/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'W' && /Sapline/i.test(control.action) && /Resin Knot/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'D' && /machete/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === '↑ + D' && /upward/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === '↓ + D' && /Downstrike/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Shift' && /Canopy Step/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');
});

test('the top-down v0.15 Cutstep experiment remains preserved and reconstructible but is no longer the public Sylvaria launch', () => {
  const html = read(`${runtime}/index.html`),entry11=read(`${runtime}/v011-entry.js`),entry12=read(`${runtime}/v012-entry.js`),entry13=read(`${runtime}/v013-entry.js`),entry14=read(`${runtime}/v014-entry.js`),entry15=read(`${runtime}/v015-entry.js`);
  assert.match(html, /Sylvaria · Cutstep Forest/);
  assert.match(html, /src="\.\/v015-entry\.js"/);
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
  assert.match(entry15,/v0\.15 Cutstep alpha · verifier migration required/);
  assert.notEqual(arcadeGames.find((game)=>game.slug==='sylvaria')?.launchUrl,'/game-runtimes/mosslight-v2/index.html');
});

test('the side-view v2 Old Growth Trial remains preserved beneath the current ascent runtime',()=>{
  const html=read(`${sideviewRuntime}/index.html`);
  assert.match(html,/OLD GROWTH TRIAL/);
  assert.match(html,/game-v2\.js/);
  assert.ok(existsSync(join(root,sideviewRuntime,'game-v2.js')));
  assert.notEqual(arcadeGames.find((game)=>game.slug==='sylvaria')?.launchUrl,'/game-runtimes/sylvaria-v2/index.html');
});

test('the exact-source v0.13 verifier remains reconstructible beneath the archived top-down lineage', () => {
  const model=read(`${v091}/model.js`),movement=read(`${v091}/movement.js`),kinetics=read(`${v013}/kinetic-combat-v013.js`),replay=read(`${v013}/replay-v013.js`),serverReplay=read('src/lib/sylvaria/replay.ts');
  assert.match(model,/FIXED_DT=1\/120/);assert.match(model,/MAX_SHOTS=128/);assert.match(model,/MAX_PENDING=72/);
  assert.match(movement,/state\.moveQueue=\{key,serial:\+\+state\.inputSerial\}/);
  assert.match(kinetics,/Object\.assign\(F,\{beginDashCharge,releaseDashCharge/);
  assert.match(replay,/VERSION='0\.13\.0'/);assert.match(serverReplay,/SYLVARIA_ENGINE_VERSION = '0\.13\.0'/);
  assert.match(read(`${runtime}/v015-entry.js`),/ranked:false/);
});

test('the public Sylvaria shell uses ascent, Sapline, and directional combat vocabulary with no top-down combat language', () => {
  const visible=[read(`${ascentRuntime}/index.html`),read('src/data/arcadeGames.ts')].join('\n');
  for(const word of ['Sylvaria','ancient tree','Rootreach','branch','vine','Bark Grip','Sapline','Resin Knots','Canopy Step','machete','upslash','downstrike','plunge','Crown Feller'])assert.match(visible,new RegExp(word,'i'));
  assert.doesNotMatch(visible,/Kinetic Pond|Cutstep|Thrust|Crosscut|Reversal|156° tongue|Reactive Blade/i);
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
  for(const source of ['/game-runtimes/stretchicorn/(.*)','/game-runtimes/mosslight-v2/(.*)','/game-runtimes/sylvaria-v2/(.*)','/game-runtimes/sylvaria-v3/(.*)']){const headers=config.headers?.find((rule)=>rule.source===source)?.headers??[];assert.ok(headers.some((header)=>header.key==='Content-Security-Policy'&&header.value==="frame-ancestors 'self'"),`missing frame policy for ${source}`)}
});

test('the embedded Stretchicorn release is complete', () => {
  const rootPath='public/game-runtimes/stretchicorn',modules=['src/style.css','src/00-core.js','src/01-combat.js','src/02-update.js','src/03-render.js','src/04-ui-input.js'];assert.ok(existsSync(join(root,rootPath,'index.html')));for(const moduleName of modules)assert.ok(existsSync(join(root,rootPath,moduleName)),`missing Stretchicorn runtime file ${moduleName}`);const html=read(`${rootPath}/index.html`);for(const moduleName of modules.filter((name)=>name.endsWith('.js')))assert.ok(html.includes(moduleName));assert.equal(arcadeGames.find((game)=>game.slug==='stretchicorn')?.launchUrl,'/game-runtimes/stretchicorn/index.html');
});
