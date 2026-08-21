import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const game = fs.readFileSync(`${root}/game-v90.js`, 'utf8');
const visuals = fs.readFileSync(`${root}/visual-system-v9.js`, 'utf8');
const styles = fs.readFileSync(`${root}/sylvaria-v8.css`, 'utf8');
const arcade = fs.readFileSync('src/data/arcadeGames.ts', 'utf8');
const doc = fs.readFileSync('docs/SYLVARIA_V09_ENVIRONMENTAL_RESONANCE.md', 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(html.includes('Sylvaria: Environmental Resonance'), 'v0.9 title missing');
expect(html.includes('./game-v90.js') && html.includes('./visual-system-v9.js'), 'production shell must load v0.9 runtime and visual system');
expect(!html.includes('./game-v82.js') && !html.includes('./game-v81.js') && !html.includes('./input-buffer-v81.js') && !html.includes('./game-v8.js') && !html.includes('./game-v5.js'), 'retired Sylvaria gameplay/input core is still wired');
expect(html.includes('terrain / routes') && html.includes('id="terrainState"'), 'environmental routing telemetry missing');
expect(html.includes('Terrain adds decisions, not buttons') && html.includes('same rules for Sprid and his enemies'), 'shared-terrain tutorial language missing');

expect(game.includes("const VERSION = '0.9.0'"), 'runtime version must be 0.9.0');
expect(game.includes('const FIXED_DT = 1 / 120') && game.includes('while (accumulator >= FIXED_DT)'), 'fixed 120 Hz combat simulation missing');
expect(game.includes('const MAX_SHOTS = 128') && game.includes('const MAX_PENDING = 72'), 'projectile scheduling caps changed');
expect(game.includes('const MAX_PARTICLES = 280'), 'v0.9 particle cap missing');

// Protected movement grammar: persistent one-command queue, never a stopwatch buffer.
expect(game.includes('moveQueue: null') && game.includes('function queueMove') && game.includes('function consumeMoveQueue'), 'persistent one-command movement queue missing');
expect(game.includes('state.moveQueue = { key, serial: ++state.inputSerial }'), 'movement queue must explicitly retain the newest command');
expect(!game.includes('moveBuffer') && !game.includes('moveQueue.life') && !game.includes('life:.13'), 'movement buffering must not expire on a stopwatch');
expect(game.includes('if (consumeMoveQueue()) return') && game.includes('p.dash = null') && game.includes('p.dashCooldown = 0'), 'queued movement must drain after committed dash completion');
expect(game.includes('heldMoves') && game.includes('heldOrder') && game.includes('repeatCadence'), 'game-timed held WASD cadence missing');
expect(game.includes('resolveDashTarget') && game.includes('blockedSteps') && game.includes('blockers()'), 'physical dash obstacle routing missing');
expect(game.includes('Math.floor((depth - 10) / 4) * 3'), 'progressive dash-length risk/reward scaling missing');

// Protected Countercut grammar.
expect(game.includes("arrowup: 'up'") && game.includes("arrowdown: 'down'") && game.includes("arrowleft: 'left'") && game.includes("arrowright: 'right'"), 'four cardinal machete cuts missing');
expect(game.includes('counterShot') && game.includes('shotApproachDirection') && game.includes('perfectWindow'), 'directional projectile counter timing missing');
expect(game.includes('slash.x = state.player.x') && game.includes('slash.y = state.player.y'), 'active cut must travel with Sprid during a dash');
expect(game.includes("shot.pattern = 'return'") && game.includes('const speed = perfect ? 1040 : 840'), 'high-speed normalized return missing');
expect(game.includes('chooseReturnTarget') && game.includes('returnVector') && game.includes('counterTargetId'), 'restrained counter target assist missing');
expect(game.includes('reflectedTravel') && game.includes('longReturns'), 'distance-scaled Long Return reward missing');
expect(game.includes('originalOwnerId') && game.includes('crosscuts') && game.includes('target.id !== shot.originalOwnerId'), 'cross-enemy return reward missing');
expect(game.includes('shot.pierces = perfect ? 1 : 0') && game.includes('ricochets'), 'perfect-counter penetration reward missing');
expect(game.includes('counterStagger') && game.includes("enemy.state = 'recover'"), 'returned shots must stagger evasive enemies');

for (const pattern of ['straight', 'zigzag', 'wave', 'spiral', 'swerve', 'wobble', 'return']) {
  expect(game.includes(`'${pattern}'`), `missing projectile pattern ${pattern}`);
}
expect(game.includes('function applyProjectilePattern') && game.includes('normalizeShotSpeed'), 'deterministic projectile-pattern integrator missing');
expect(game.includes('scheduleShot') && game.includes('updatePendingShots') && game.includes('queueVolley'), 'staggered volley scheduler missing');
expect(game.includes('entityRand'), 'deterministic per-enemy gameplay RNG missing');

// Environmental Resonance terrain grammar.
for (const terrain of ['ice', 'mud', 'sand', 'water', 'bramble', 'grass', 'shards']) {
  expect(game.includes(`${terrain}: {`) || game.includes(`'${terrain}'`), `missing terrain state ${terrain}`);
}
expect(game.includes('function terrainAt') && game.includes('function mobilityAt'), 'shared terrain sampler missing');
expect(game.includes('const startMobility = mobilityAt(startX, startY)') && game.includes('baseDistance * startMobility.dash'), 'Sprid dash commitment is not terrain-aware');
expect(game.includes('function moveToward') && game.includes('const mobility = mobilityAt(enemy.x, enemy.y)') && game.includes('speed * mobility.move * dt'), 'ordinary enemy movement is not using shared terrain mobility');
expect(game.includes("enemy.type === 'skidder' && enemy.state === 'charge'") && game.includes('420 * global * mobility.move'), 'Skidder charge does not obey terrain mobility');
expect(game.includes('function evadeDestinationSafe') && game.includes("['mud', 'bramble', 'shards'].includes(terrain.type)"), 'unsafe terrain must be rejected for evasive destinations');
expect(game.includes('ESCAPE JAMMED') && game.includes('terrainRoutes'), 'terrain must be able to jam evasive enemies and reward routing');
expect(game.includes('function applyTerrainHazard') && game.includes("kind === 'player'") && game.includes("kind === 'boss'"), 'terrain hazards must handle player, enemy, and boss symmetrically');
expect(game.includes('function knockIntoTerrain') && game.includes('TERRAIN ROUTE'), 'reflected knockback terrain routing missing');

// Forest manipulation should enrich combat without adding a new button.
expect(game.includes('state.foliage') && game.includes('grassCut') && game.includes('blade.cut = true'), 'destructible tall grass missing');
expect(game.includes('state.brittle') && game.includes('function breakBrittle') && game.includes('COUNTER BREAK'), 'brittle route barriers / reflected break missing');
expect(game.includes('function fractureIce') && game.includes("patch.type = 'shards'") && game.includes('state.player.dash && slash.age <= slash.perfectWindow'), 'contextual dash-cut ice fracture missing');
expect(game.includes('deadwood') && game.includes('state.debris'), 'deadwood route shaping missing');
expect(game.includes('nearestLivingTree') && game.includes("endRun('The grove was clear-cut')"), 'living-tree defense failure state missing');

// Rendering must remain inexpensive and mechanically readable.
expect(game.includes("document.createElement('canvas')") && game.includes('terrainCanvas.width = W') && game.includes('function rebuildTerrainCache'), 'cached terrain canvas missing');
expect(game.includes('state.terrainCacheDirty') && game.includes('ctx.drawImage(terrainCanvas, 0, 0)'), 'terrain cache invalidation/draw path missing');
expect(game.includes('function drawGrass') && game.includes('function drawBrittle'), 'procedural environmental rendering missing');
expect(game.includes('function drawEnemySilhouette') && game.includes('locomotion') && game.includes('recoil'), 'enemy silhouette/locomotion/recoil states missing');
expect(game.includes('afterimages') && game.includes('enemy.afterimages.push'), 'blink/backstep afterimages missing');
expect(game.includes("shot.pattern === 'zigzag'") && game.includes("shot.pattern === 'spiral'") && game.includes("shot.pattern === 'wave'") && game.includes("shot.pattern === 'swerve'") && game.includes("shot.pattern === 'wobble'"), 'projectile visual signatures missing');

expect(game.includes('maybeBeginEvade') && game.includes('safeEvadeDestination') && game.includes('updateEvade'), 'enemy evasion state machine missing');
expect(game.includes("['lobbyist', 'broker', 'surveyor'].includes(enemy.type) ? 'blink' : 'backstep'"), 'blink/backstep role split missing');
expect(game.includes("enemy.intent = { kind: 'evade'"), 'evasion destination telegraph missing');
expect(game.includes('state.stats.grazes') && game.includes('p.dash && !shot.grazed'), 'dash-graze Flow mechanic missing');
expect(game.includes('chooseIntent') && game.includes('beginTelegraph') && game.includes('enemy.intent'), 'locked attack-intent telegraphs missing');
expect(game.includes('shieldProvider') && game.includes("candidate.type === 'chair'"), 'Committee Chair shield support missing');
expect(game.includes('beneficiaryId') && game.includes("enemy.type === 'broker'"), 'interceptable Subsidy Broker transfer missing');
expect(game.includes('perfect ? 1 : 0') && game.includes('fullGroves'), 'persistent heartwood / Perfect Grove recovery missing');
expect(game.includes('proceduralBlueprint') && game.includes('sylvaria-v9-room-${depth}'), 'deterministic post-room-10 terrain generation missing');

for (const enemy of ['feller', 'foreman', 'lobbyist', 'skidder', 'drone', 'chair', 'broker', 'surveyor', 'mech', 'mulcher']) {
  expect(game.includes(`${enemy}: {`), `missing enemy archetype ${enemy}`);
}
for (const title of ['Trailhead Trespass', 'Nailgun Nursery', 'Red Tape Ravine', 'Skidder Switchback', 'Sawdisc Wetland', 'Committee Canopy', 'Subsidy Grove', 'Clearcut Conveyor', 'Four-Way Firebreak', 'PAC-a-Saw Summit']) {
  expect(game.includes(`title: '${title}'`), `missing authored room ${title}`);
}
expect(game.includes("name: 'PAC-a-Saw'") && game.includes('boss.phase = 2') && game.includes('boss.phase = 3'), 'three-phase PAC-a-Saw boss missing');
expect(game.includes("boss.state = 'recover'") && game.includes("vulnerable: state.boss.state === 'recover'"), 'boss punish windows must remain explicit and observable');
expect(game.includes("key === 'p' && state.mode === 'paused'") && game.includes("state.mode = 'paused'"), 'P must toggle pause/resume');
expect(game.includes('class CountercutAudio') && game.includes("key === 'm'"), 'lightweight combat SFX/mute control missing');
expect(game.includes('window.__MOSSLIGHT_PLAYTEST__') && game.includes('placeTerrain') && game.includes('setEnemyPosition') && game.includes('fractureIce'), 'v0.9 environmental playtest instrumentation missing');

expect(visuals.includes("version: '0.9.0'") && visuals.includes('requestFullscreen'), 'v0.9 immersive visual shell missing');
for (const flag of ['resilientMoveQueue', 'projectilePatternReadability', 'evasiveEnemyCues', 'counterRouting', 'terrainReadability', 'symmetricTerrainRules', 'cachedTerrainLayer', 'destructibleFoliage', 'combatAnimationStates', 'proceduralSilhouettes']) {
  expect(visuals.includes(`${flag}: true`), `visual snapshot missing ${flag}`);
}
expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'aspect-safe sparse HUD styling missing');
expect(arcade.includes("version: 'v0.9.0'") && arcade.includes('SHAPE THE GROUND') && arcade.includes('terrain tactics'), 'Game Network metadata is not on Environmental Resonance v0.9');
expect(doc.includes('Shared terrain matrix') && doc.includes('120 Hz') && doc.includes('Canvas 2D') && doc.includes('Tall grass'), 'v0.9 implementation document incomplete');

for (const [name, source] of [['game-v90.js', game], ['visual-system-v9.js', visuals]]) {
  try { new Function(source); } catch (error) { errors.push(`${name} does not compile: ${error instanceof Error ? error.message : String(error)}`); }
}

if (errors.length) {
  console.error(`Sylvaria Environmental Resonance validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Sylvaria Environmental Resonance PASS: v0.9.0 persistent movement queue, 120 Hz Countercut, 840/1040 returns, shared terrain mobility, terrain-aware enemy movement and evasion, destructible grass and brittle barriers, contextual ice fracture, hazard knockback routing, cached Canvas 2D terrain, procedural combat silhouettes, ten authored terrain rooms, deterministic deep remixes, and unchanged projectile caps.');
