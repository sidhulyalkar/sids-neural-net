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

test('Sylvaria v0.14 advertises the unified combat game actually shipped by production', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria');
  assert.ok(game);
  assert.equal(game.title, 'Sylvaria');
  assert.equal(game.version, 'v0.14.0');
  assert.match(game.subtitle, /CARVE.*COUNTER.*CREATE THE OPENING/);
  assert.match(game.description, /120 Hz/i);
  assert.match(game.description, /one character rig/i);
  assert.match(game.description, /five active ticks/i);
  assert.match(game.description, /mobility refunds/i);
  assert.match(game.description, /Flow/i);
  assert.match(game.description, /fixed-timing evasions/i);
  assert.match(game.description, /thirty authored arenas/i);
  assert.match(game.description, /call-and-response threat phrases/i);
  assert.match(game.description, /boss guard breaks/i);
  assert.match(game.description, /ranked submission is temporarily paused/i);
  assert.doesNotMatch(game.description, /mid-swing/i);
  for (const tag of ['counter combat', 'reactive blade', 'charged dash', 'projectile reflection', 'threat orchestration', 'boss guard break', 'environmental combos', '120 hz simulation']) assert.ok(game.tags.includes(tag));
  assert.ok(game.controls.some((control) => control.input === 'W A S D' && /movement|diagonal|steering/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Space' && /charge|exponential|buffer/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Arrow Keys' && /Reactive Blade|five active ticks|parr/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Enemy openings' && /bait|punish|reposition/i.test(control.action)));
  assert.ok(game.controls.some((control) => control.input === 'Pond terrain' && /route|brambles|spores|reflected/i.test(control.action)));
  assert.equal(getArcadeGame('mosslight')?.slug, 'sylvaria');
  assert.equal(getArcadeGame('sylvaria')?.slug, 'sylvaria');
});

test('v0.14 boots the compatibility substrate then owns unified rig combat boss and threat flow', () => {
  const html = read(`${runtime}/index.html`);
  const entry11 = read(`${runtime}/v011-entry.js`);
  const entry12 = read(`${runtime}/v012-entry.js`);
  const entry13 = read(`${runtime}/v013-entry.js`);
  const entry14 = read(`${runtime}/v014-entry.js`);
  const kinetics = read(`${v013}/kinetic-combat-v013.js`);
  const ai = read(`${v013}/enemy-ai-v013.js`);
  const replay = read(`${v013}/replay-v013.js`);
  const presentation = read(`${v013}/kinetic-presentation-v013.js`);
  const rig = read(`${v014}/character-rig-v014.js`);
  const flow = read(`${v014}/combat-flow-v014.js`);
  const enemyFlow = read(`${v014}/enemy-flow-v014.js`);
  const bossFlow = read(`${v014}/boss-flow-v014.js`);
  const threats = read(`${v014}/threat-manager-v014.js`);
  const flowPresentation = read(`${v014}/flow-presentation-v014.js`);

  assert.match(html, /Sylvaria · Kinetic Pond/);
  assert.match(html, /sylvaria-pond-v012\.css/);
  assert.match(html, /v091\/fullscreen\.js/);
  assert.match(html, /src="\.\/v014-entry\.js"/);
  assert.doesNotMatch(html, /src="\.\/v013-entry\.js"|src="\.\/v012-entry\.js"|src="\.\/v010-entry\.js"|src="\.\/v091\/boot\.js"/);

  for (const moduleName of ['model.js', 'world.js', 'movement.js', 'battle-core.js', 'render.js', 'boot.js', 'fullscreen.js']) {
    assert.ok(existsSync(join(root, v091, moduleName)), `missing v0.9.1 baseline module ${moduleName}`);
  }
  for (const moduleName of ['rooms-v011.js', 'presentation-v011.js', 'input-guard-v011.js', 'competitive-v011.js']) {
    assert.ok(existsSync(join(root, v011, moduleName)), `missing inherited v0.11 module ${moduleName}`);
  }
  for (const moduleName of ['webgl-pond-v012.js', 'art-atlas-v012.js', 'art-atlas-pro-v012.js']) {
    assert.ok(existsSync(join(root, v012, moduleName)), `missing v0.12 graphics module ${moduleName}`);
  }
  for (const moduleName of ['kinetic-combat-v013.js', 'enemy-ai-v013.js', 'replay-v013.js', 'coach-v013.js', 'kinetic-presentation-v013.js']) {
    assert.ok(existsSync(join(root, v013, moduleName)), `missing v0.13 compatibility module ${moduleName}`);
  }
  for (const moduleName of ['character-rig-v014.js', 'combat-flow-v014.js', 'enemy-flow-v014.js', 'boss-flow-v014.js', 'threat-manager-v014.js', 'flow-presentation-v014.js']) {
    assert.ok(existsSync(join(root, v014, moduleName)), `missing playable v0.14 module ${moduleName}`);
  }

  assert.doesNotMatch(entry11, /replay-v011|coach-v011|competitive-v011/);
  assert.match(entry12, /PRESENTATION='0\.12\.0',ENGINE='0\.11\.1'/);
  for (const moduleName of ['kinetic-combat-v013.js', 'enemy-ai-v013.js', 'replay-v013.js', 'coach-v013.js', 'kinetic-presentation-v013.js']) assert.ok(entry13.includes(moduleName), `v0.13 parent missing ${moduleName}`);
  assert.match(entry14, /window\.SylvariaRankedDisabledReason='v0\.14 replay verifier migration'/);
  assert.match(entry14, /await import\('\.\/v013-entry\.js'\)/);
  for (const moduleName of ['character-rig-v014.js', 'combat-flow-v014.js', 'enemy-flow-v014.js', 'boss-flow-v014.js', 'threat-manager-v014.js', 'flow-presentation-v014.js']) assert.ok(entry14.includes(moduleName), `v0.14 production entry missing ${moduleName}`);
  assert.ok(entry14.indexOf('boss-flow-v014.js') < entry14.indexOf('threat-manager-v014.js'), 'threat manager must wrap the final boss flow');

  assert.match(kinetics, /moveSpeed:238/);
  assert.match(kinetics, /arcDegrees:156/);
  assert.match(kinetics, /parryWindow:5\/120/);
  assert.match(kinetics, /perfectReflectSpeed:1160/);
  assert.match(kinetics, /dashDecay:\.90483742/);
  assert.match(replay, /SCHEMA=2/);
  assert.match(replay, /space:\[12,13\]/);
  assert.match(rig, /SPRITE_FORWARD_OFFSET=Math\.PI\/2/);
  assert.match(rig, /mouthForAttack/);
  assert.match(flow, /parryDashRefund:12\/120/);
  assert.match(enemyFlow, /spec\.dodge=100/);
  assert.match(bossFlow, /guardByPhase:Object\.freeze\(\{1:3,2:4,3:5\}\)/);
  assert.match(threats, /ROOM_THREAT_PROFILES/);
  assert.match(threats, /actor===state\.boss/);
  assert.match(flowPresentation, /function drawBossFlow/);
  assert.match(presentation, /rig\?\.mouthForAttack/);
  for (const kind of ['skimmer','strider','sniper','shellback']) assert.ok(ai.includes(`${kind}:`), `missing kinetic enemy ${kind}`);
});

test('the old dash-step and v0.13 replay substrate stay reconstructible under v0.14 production', () => {
  const model = read(`${v091}/model.js`);
  const movement = read(`${v091}/movement.js`);
  const kinetics = read(`${v013}/kinetic-combat-v013.js`);
  const replay = read(`${v013}/replay-v013.js`);
  const serverReplay = read('src/lib/sylvaria/replay.ts');
  assert.match(model, /FIXED_DT=1\/120/);
  assert.match(model, /MAX_SHOTS=128/);
  assert.match(model, /MAX_PENDING=72/);
  assert.match(movement, /state\.moveQueue=\{key,serial:\+\+state\.inputSerial\}/);
  assert.match(movement, /speed=perfect\?1040:840/);
  assert.match(kinetics, /Object\.assign\(F,\{beginDashCharge,releaseDashCharge/);
  assert.match(kinetics, /queueMove\(\)\{state\.moveQueue=null;return false\}/);
  assert.match(kinetics, /function updateMovement\(dt\)/);
  assert.match(kinetics, /function updateSlashes\(dt\)/);
  assert.match(replay, /VERSION='0\.13\.0'/);
  assert.match(serverReplay, /SYLVARIA_ENGINE_VERSION = '0\.13\.0'/);
});

test('v0.14 keeps ecological consequences under the faster combat layer', () => {
  const synergy = read(`${v091}/synergy-v010.js`);
  const kinetics = read(`${v013}/kinetic-combat-v013.js`);
  const bossFlow = read(`${v014}/boss-flow-v014.js`);
  for (const token of ['triggerReturnEcology', 'mushroomReturns', 'hazardScoreAt', 'bulldozeBoss', 'bossBulldozes']) assert.ok(synergy.includes(token), `missing inherited ecology token ${token}`);
  assert.match(kinetics, /window\.SylvariaSynergy\?\.awardSynergy/);
  assert.match(kinetics, /function shearGasArc/);
  assert.match(kinetics, /F\.cutMushroom/);
  assert.match(kinetics, /F\.applyTerrainHazard/);
  assert.match(bossFlow, /if\(source\.hazard\)/);
});

test('Game Network fullscreen removes portfolio chrome and gives the iframe the whole display', () => {
  const source = read('components/arcade/ArcadePlaySpace.tsx');
  for (const token of ['data-arcade-fullscreen', "requestFullscreen({ navigationUI: 'hide' })", "fullscreen ? 'hidden'", 'absolute inset-0 flex items-stretch justify-stretch p-0', 'relative h-full w-full overflow-hidden bg-black']) assert.ok(source.includes(token));
  assert.match(source, /aspectRatio: game\.aspectRatio/);
});

test('current Sylvaria player-facing surfaces use the v0.14 pond combat vocabulary without obsolete prototype naming', () => {
  const visible = [read(`${runtime}/index.html`), read('src/data/arcadeGames.ts')].join('\n');
  assert.doesNotMatch(visible, /Sprig|Verdant Flow|Ecological Synergy|PAC-a-Saw|Heartleaf|Rush Resin|Barkguard|Edge Stone|Flow Sap/i);
  assert.doesNotMatch(visible, /mid-swing|middle of the active sweep is the sweet spot/i);
  for (const word of ['Sylvaria', 'Sprid', 'frog', 'Reactive Blade', 'reflect', 'pond', 'dash', 'parry', 'boss', 'guard']) assert.match(visible, new RegExp(word, 'i'));
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

test('the embedded Stretchicorn release is complete', () => {
  const rootPath = 'public/game-runtimes/stretchicorn';
  const modules = ['src/style.css', 'src/00-core.js', 'src/01-combat.js', 'src/02-update.js', 'src/03-render.js', 'src/04-ui-input.js'];
  assert.ok(existsSync(join(root, rootPath, 'index.html')));
  for (const moduleName of modules) assert.ok(existsSync(join(root, rootPath, moduleName)), `missing Stretchicorn runtime file ${moduleName}`);
  const html = read(`${rootPath}/index.html`);
  for (const moduleName of modules.filter((name) => name.endsWith('.js'))) assert.ok(html.includes(moduleName));
  assert.equal(arcadeGames.find((game) => game.slug === 'stretchicorn')?.launchUrl, '/game-runtimes/stretchicorn/index.html');
});
