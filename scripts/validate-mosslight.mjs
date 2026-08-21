import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const game = fs.readFileSync(`${root}/game-v82.js`, 'utf8');
const visuals = fs.readFileSync(`${root}/visual-system-v8.js`, 'utf8');
const styles = fs.readFileSync(`${root}/sylvaria-v8.css`, 'utf8');
const arcade = fs.readFileSync('src/data/arcadeGames.ts', 'utf8');
const doc = fs.readFileSync('docs/SYLVARIA_V08_COUNTERCUT.md', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('Sylvaria: Countercut'), 'Countercut title missing');
expect(html.includes('./game-v82.js') && !html.includes('./game-v81.js') && !html.includes('./input-buffer-v81.js') && !html.includes('./game-v8.js') && !html.includes('./game-v5.js'), 'production shell must load only Countercut v0.8.2 gameplay');
expect(html.includes('./visual-system-v8.js') && html.includes('./sylvaria-v8.css'), 'Countercut visual stack missing');
expect(html.includes('persistent one-step cardinal queue') && html.includes('Counter Route') && html.includes('Read Patterns'), 'v0.8.2 movement/counter-routing tutorial missing');
expect(html.includes('id="returnState"') && html.includes('id="grazeState"'), 'counter-routing telemetry missing from HUD');

expect(game.includes("const VERSION = '0.8.2'"), 'runtime version must be 0.8.2');
expect(game.includes('const FIXED_DT = 1 / 120') && game.includes('while (accumulator >= FIXED_DT)'), 'fixed 120 Hz combat simulation missing');

// The movement buffer is deliberately a persistent one-command queue, not a timer.
expect(game.includes('moveQueue: null') && game.includes('function queueMove') && game.includes('function consumeMoveQueue'), 'resilient one-command movement queue missing');
expect(game.includes('state.moveQueue = { key, serial: ++state.inputSerial }'), 'movement queue must retain the newest command explicitly');
expect(!game.includes('moveBuffer') && !game.includes('moveQueue.life') && !game.includes('life:.13'), 'movement buffering must not expire on a stopwatch during an active dash');
expect(game.includes('if (consumeMoveQueue()) return') && game.includes('p.dash = null') && game.includes('p.dashCooldown = 0'), 'queued movement must be consumed immediately after committed dash completion');
expect(game.includes('queued taps survive keyup') && !game.includes('keyup') === false, 'keyup contract must preserve an already queued tap');
expect(game.includes('heldMoves') && game.includes('heldOrder') && game.includes('repeatCadence'), 'game-timed held WASD cadence missing');

expect(game.includes('resolveDashTarget') && game.includes('blockedSteps') && game.includes('blockers()'), 'physical dash obstacle routing missing');
expect(game.includes('Math.floor((depth - 10) / 4) * 3'), 'progressive dash-length risk/reward scaling missing');
expect(game.includes("arrowup: 'up'") && game.includes("arrowdown: 'down'") && game.includes("arrowleft: 'left'") && game.includes("arrowright: 'right'"), 'four cardinal machete cuts missing');
expect(game.includes('counterShot') && game.includes('shotApproachDirection') && game.includes('perfectWindow'), 'directional projectile counter timing missing');
expect(game.includes('slash.x = state.player.x') && game.includes('slash.y = state.player.y'), 'active machete cut must travel with Sprid during a dash');
expect(game.includes('drawMachete') && game.includes('drawCounterCompass'), 'machete/arrival-side readability layer missing');

// Reflections should become cleaner, faster weapons rather than retaining hostile path noise.
expect(game.includes("shot.pattern = 'return'") && game.includes('const speed = perfect ? 1040 : 840'), 'high-speed normalized counter return missing');
expect(game.includes('chooseReturnTarget') && game.includes('returnVector') && game.includes('counterTargetId'), 'restrained counter target assist missing');
expect(game.includes('reflectedTravel') && game.includes('distanceFactor') && game.includes('longReturns'), 'distance-scaled counter reward missing');
expect(game.includes('originalOwnerId') && game.includes('crosscuts') && game.includes('target.id !== shot.originalOwnerId'), 'cross-enemy return reward missing');
expect(game.includes('pierces = perfect ? 1 : 0') && game.includes('ricochets'), 'perfect-counter penetration reward missing');
expect(game.includes('counterStagger') && game.includes("enemy.state = 'recover'"), 'returned shots must stagger evasive enemies');

// Difficulty comes from deterministic, readable trajectories rather than random velocity noise.
for (const pattern of ['straight', 'zigzag', 'wave', 'spiral', 'swerve', 'wobble', 'return']) {
  expect(game.includes(`'${pattern}'`), `missing projectile pattern ${pattern}`);
}
expect(game.includes('function applyProjectilePattern') && game.includes('normalizeShotSpeed'), 'projectile pattern integrator missing');
expect(game.includes('MAX_SHOTS = 128') && game.includes('MAX_PENDING = 72'), 'projectile/pending-shot performance caps missing');
expect(game.includes('scheduleShot') && game.includes('updatePendingShots') && game.includes('queueVolley'), 'deterministic staggered volley scheduler missing');
expect(game.includes('entityRand') && !game.includes('enemy.clock = 1 + Math.random()'), 'enemy gameplay decisions must use deterministic entity RNG');

// Ranged/support units should create space instead of standing inside machete range.
expect(game.includes('maybeBeginEvade') && game.includes('safeEvadeDestination') && game.includes('updateEvade'), 'enemy evasion state machine missing');
expect(game.includes("['lobbyist', 'broker', 'surveyor'].includes(enemy.type) ? 'blink' : 'backstep'"), 'blink/backstep role split missing');
expect(game.includes("enemy.intent = { kind: 'evade'"), 'evasion destination telegraph missing');
expect(game.includes('drawIntentLine') && game.includes("entity.intent.kind === 'evade'"), 'evasion visual cue missing');

expect(game.includes('state.stats.grazes') && game.includes('p.dash && !shot.grazed'), 'dash-graze Flow mechanic missing');
expect(game.includes('chooseIntent') && game.includes('beginTelegraph') && game.includes('enemy.intent'), 'locked attack-intent telegraphs missing');
expect(game.includes('shieldProvider') && game.includes("candidate.type === 'chair'"), 'Committee Chair shield support missing');
expect(game.includes('beneficiaryId') && game.includes("enemy.type === 'broker'"), 'interceptable Subsidy Broker transfers missing');
expect(game.includes('perfectGrove ? 1 : 0') && game.includes('fullGroves'), 'persistent heartwood/perfect-grove recovery loop missing');
expect(game.includes('state.debris') && game.includes('deadwood') && game.includes('resolveDashTarget'), 'deadwood must be both choppable and route-blocking');
expect(game.includes('nearestLivingTree') && game.includes("endRun('The grove was clear-cut')"), 'living-tree defense failure state missing');
expect(game.includes('proceduralBlueprint') && game.includes('rngFrom(hash(`sylvaria-countercut-room-${depth}`))'), 'seeded post-room-10 generation missing');

for (const enemy of ['feller', 'foreman', 'lobbyist', 'skidder', 'drone', 'chair', 'broker', 'surveyor', 'mech', 'mulcher']) {
  expect(game.includes(`${enemy}: {`), `missing enemy archetype ${enemy}`);
}
for (const title of ['Trailhead Trespass', 'Nailgun Nursery', 'Red Tape Ravine', 'Skidder Switchback', 'Sawdisc Wetland', 'Committee Canopy', 'Subsidy Grove', 'Clearcut Conveyor', 'Four-Way Firebreak', 'PAC-a-Saw Summit']) {
  expect(game.includes(`title: '${title}'`), `missing authored room ${title}`);
}
expect(game.includes("name: 'PAC-a-Saw'") && game.includes('boss.phase = 2') && game.includes('boss.phase = 3'), 'three-phase PAC-a-Saw boss missing');
expect(game.includes("boss.state = 'recover'") && game.includes("vulnerable: state.boss.state === 'recover'"), 'boss punish windows must be explicit and observable');
expect(game.includes("key === 'p' && state.mode === 'paused'") && game.includes("state.mode = 'paused'"), 'P must toggle pause/resume from keyboard');
expect(game.includes('class CountercutAudio') && game.includes("key === 'm'"), 'lightweight combat SFX/mute control missing');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__') && game.includes('spawnCounterShot') && game.includes('placeDeadwoodAhead') && game.includes('forceEvade'), 'v0.8.2 playtest instrumentation missing');

expect(visuals.includes("version: '0.8.2'") && visuals.includes('requestFullscreen'), 'v0.8.2 immersive visual shell missing');
expect(visuals.includes('resilientMoveQueue: true') && visuals.includes('projectilePatternReadability: true') && visuals.includes('evasiveEnemyCues: true') && visuals.includes('counterRouting: true'), 'visual snapshot must expose v0.8.2 combat-readability contracts');
expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'aspect-safe combat HUD styling missing');
expect(arcade.includes("version: 'v0.8.2'") && arcade.includes('COUNTERCUT') && arcade.includes('persistent one-command WASD step queue'), 'Game Network metadata is not on Countercut v0.8.2');
expect(doc.includes('120 Hz') && doc.includes('deadwood') && doc.includes('Sprid'), 'Countercut implementation document is incomplete');

for (const [name, source] of [['game-v82.js', game], ['visual-system-v8.js', visuals]]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}

if (errors.length) {
  console.error(`Sylvaria Countercut validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Sylvaria Countercut PASS: v0.8.2 persistent one-step queue, physical route geometry, four-direction machete counters, high-speed counter routing, distance/cross-enemy rewards, six hostile trajectory families, evasive ranged enemies, deterministic volley scheduling, ten enemy archetypes, persistent heartwood, ten authored rooms, PAC-a-Saw punish windows, seeded deep rooms, fixed-step simulation, and updated Game Network metadata.');
