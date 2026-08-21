import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const game = fs.readFileSync(`${root}/game-v81.js`, 'utf8');
const visuals = fs.readFileSync(`${root}/visual-system-v8.js`, 'utf8');
const styles = fs.readFileSync(`${root}/sylvaria-v8.css`, 'utf8');
const arcade = fs.readFileSync('src/data/arcadeGames.ts', 'utf8');
const doc = fs.readFileSync('docs/SYLVARIA_V08_COUNTERCUT.md', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('Sylvaria: Countercut'), 'Countercut title missing');
expect(html.includes('./game-v81.js') && !html.includes('./game-v8.js') && !html.includes('./game-v5.js'), 'production shell must load only Countercut v0.8.1 gameplay');
expect(html.includes('./visual-system-v8.js') && html.includes('./sylvaria-v8.css'), 'Countercut visual stack missing');
expect(html.includes('bufferable cardinal step-dashes') && html.includes('physically open dash lanes'), 'v0.8.1 movement/routing tutorial missing');
expect(html.includes('id="grazeState"'), 'Flow graze telemetry missing from HUD');

expect(game.includes("const VERSION='0.8.1'") || game.includes("const VERSION = '0.8.1'"), 'runtime version must be 0.8.1');
expect(game.includes('const FIXED_DT=1/120') || (game.includes('const FIXED_DT = 1 / 120') && game.includes('while (accumulator >= FIXED_DT)')), 'fixed 120 Hz combat simulation missing');
expect(game.includes('moveBuffer') && game.includes('life:.13') && game.includes('requestDash'), 'buffered step chaining missing');
expect(game.includes('heldMoves') && game.includes('heldOrder') && game.includes('repeatCadence'), 'game-timed held WASD cadence missing');
expect(game.includes('resolveDashTarget') && game.includes('blockedSteps') && game.includes('blockers()'), 'physical dash obstacle routing missing');
expect(game.includes('dashDistance:blueprint.dash') && game.includes('Math.floor((depth-10)/4)*3'), 'progressive dash-length risk/reward scaling missing');
expect(game.includes("arrowup:'up'") && game.includes("arrowdown:'down'") && game.includes("arrowleft:'left'") && game.includes("arrowright:'right'"), 'four cardinal machete cuts missing');
expect(game.includes('counterShot') && game.includes('shotApproachDirection') && game.includes('perfectWindow'), 'directional projectile counter timing missing');
expect(game.includes('slash.x=state.player.x') && game.includes('slash.y=state.player.y'), 'active machete cut must travel with Sprid during a dash');
expect(game.includes('drawMachete') && game.includes('drawCounterCompass'), 'machete/arrival-side combat readability layer missing');
expect(game.includes('state.stats.grazes') && game.includes('p.dash&&!shot.grazed'), 'dash-graze Flow mechanic missing');
expect(game.includes('entityRand') && !game.includes('enemy.clock=1+Math.random()'), 'enemy timing must use deterministic entity RNG');
expect(game.includes('chooseIntent') && game.includes('beginTelegraph') && game.includes('enemy.intent'), 'locked attack-intent telegraphs missing');
expect(game.includes('shieldProvider') && game.includes("candidate.type==='chair'"), 'Committee Chair shield support missing');
expect(game.includes('beneficiaryId') && game.includes("enemy.type==='broker'"), 'interceptable Subsidy Broker transfers missing');
expect(game.includes('state.player.hp+(perfectGrove?1:0)') && game.includes('fullGroves'), 'persistent heartwood/perfect-grove recovery loop missing');
expect(game.includes('state.debris') && game.includes('deadwood') && game.includes('resolveDashTarget'), 'deadwood must be both choppable and route-blocking');
expect(game.includes('nearestLivingTree') && game.includes("endRun('The grove was clear-cut')"), 'living-tree defense failure state missing');
expect(game.includes('proceduralBlueprint') && game.includes('rngFrom(hash(`sylvaria-countercut-room-${depth}`))'), 'seeded post-room-10 generation missing');

for (const enemy of ['feller', 'foreman', 'lobbyist', 'skidder', 'drone', 'chair', 'broker', 'mech']) {
  expect(game.includes(`${enemy}:{`) || game.includes(`${enemy}: {`), `missing enemy archetype ${enemy}`);
}
for (const title of ['Trailhead Trespass', 'Nailgun Nursery', 'Red Tape Ravine', 'Skidder Switchback', 'Sawdisc Wetland', 'Committee Canopy', 'Subsidy Grove', 'Clearcut Conveyor', 'Four-Way Firebreak', 'PAC-a-Saw Summit']) {
  expect(game.includes(`title:'${title}'`) || game.includes(`title: '${title}'`), `missing authored room ${title}`);
}
expect(game.includes("name:'PAC-a-Saw'") && game.includes('boss.phase=2') && game.includes('boss.phase=3'), 'three-phase PAC-a-Saw boss missing');
expect(game.includes("boss.state='recover'") && game.includes("vulnerable:state.boss.state==='recover'"), 'boss punish windows must be explicit and observable');
expect(game.includes("key==='p'&&state.mode==='paused'") && game.includes("state.mode='paused'"), 'P must toggle pause/resume from keyboard');
expect(game.includes('class CountercutAudio') && game.includes("key==='m'"), 'lightweight combat SFX/mute control missing');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__') && game.includes('spawnCounterShot') && game.includes('placeDeadwoodAhead'), 'playtest instrumentation missing');

expect(visuals.includes("version: '0.8.1'") && visuals.includes('requestFullscreen'), 'v0.8.1 immersive visual shell missing');
expect(visuals.includes('routeGeometry: true') && visuals.includes('lockedIntentTelegraphs: true'), 'visual snapshot must expose routing and telegraph contracts');
expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'aspect-safe combat HUD styling missing');
expect(arcade.includes("version: 'v0.8.1'") && arcade.includes('COUNTERCUT') && arcade.includes('buffered cardinal step-dashes'), 'Game Network metadata is not on Countercut v0.8.1');
expect(doc.includes('120 Hz') && doc.includes('deadwood') && doc.includes('Sprid'), 'Countercut implementation document is incomplete');

for (const [name, source] of [['game-v81.js', game], ['visual-system-v8.js', visuals]]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}

if (errors.length) {
  console.error(`Sylvaria Countercut validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Sylvaria Countercut PASS: v0.8.1 buffered step movement, physical route geometry, four-direction machete counters, locked intents, deterministic enemy decisions, support interactions, persistent heartwood, dash grazes, ten authored rooms, PAC-a-Saw punish windows, seeded deep rooms, fixed-step simulation, and updated Game Network metadata.');
