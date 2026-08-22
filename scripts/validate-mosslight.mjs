import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const read = (path) => fs.readFileSync(path, 'utf8');
const html = read(`${root}/index.html`);
const files = Object.fromEntries(['model','world','movement','battle-core','render','boot'].map((name) => [name, read(`${root}/v091/${name}.js`)]));
const synergy = read(`${root}/v091/synergy-v010.js`);
const rooms = read(`${root}/v011/rooms-v011.js`);
const presentation = read(`${root}/v011/presentation-v011.js`);
const replay = read(`${root}/v011/replay-v011.js`);
const inputGuard = read(`${root}/v011/input-guard-v011.js`);
const competitive = read(`${root}/v011/competitive-v011.js`);
const coach = read(`${root}/v011/coach-v011.js`);
const entry = read(`${root}/v011-entry.js`);
const styles = read(`${root}/sylvaria-v8.css`);
const minimalStyles = read(`${root}/sylvaria-minimal-v011.css`);
const arcade = read('src/data/arcadeGames.ts');
const serverReplay = read('src/lib/sylvaria/replay.ts');
const leaderboard = read('src/lib/sylvaria/leaderboard.ts');
const submitRoute = read('app/api/sylvaria/leaderboard/submit/route.ts');
const headless = read('src/lib/sylvaria/headless.ts');
const nextConfig = read('next.config.ts');
const doc9 = read('docs/SYLVARIA_V09_ENVIRONMENTAL_RESONANCE.md');
const doc10 = read('docs/SYLVARIA_V010_ECOLOGICAL_SYNERGY.md');
const profiler = read('scripts/profile-sylvaria-size.mjs');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const has = (source, ...needles) => needles.every((needle) => source.includes(needle));

expect(has(html, '<title>Sylvaria</title>', 'sylvaria-minimal-v011.css', 'id="fieldState"', '30 fixed arenas', 'start run', 'learn controls', 'id="rankPanel"', 'id="rankedSubmit"'), 'v0.11.1 minimal shell is incomplete');
expect(html.includes('<script type="module" src="./v011-entry.js"></script>'), 'production shell must load the v0.11.1 entrypoint');
expect(!html.includes('<script type="module" src="./v010-entry.js"></script>'), 'production shell must not directly load the retired v0.10 adapter');
expect(!html.includes('<script type="module" src="./v091/boot.js"></script>'), 'production shell must not bypass the v0.11.1 entrypoint');
for (const retired of ['./game-v90.js','./game-v82.js','./game-v81.js','./input-buffer-v81.js','./visual-system-v9.js']) expect(!html.includes(retired), `retired runtime still wired: ${retired}`);
expect(has(entry, "import './v091/model.js'", "import('./v011/rooms-v011.js')", "import('./v091/boot.js')", "import('./v091/synergy-v010.js')", "import('./v011/presentation-v011.js')", "import('./v011/replay-v011.js')", "import('./v011/input-guard-v011.js')", "import('./v011/competitive-v011.js')", "import('./v011/coach-v011.js')", "VERSION='0.11.1'", 'roomCount=rooms.length', 'expandedArenas:true', 'minimalPresentation:true', 'deterministicReplay:true', 'competitiveRuns:true', 'actionCoach:true', 'repeatSafeControls:true'), 'v0.11.1 entry/load-order adapter incomplete');

expect(has(files.model, "VERSION='0.9.1'", 'FIXED_DT=1/120', 'MAX_SHOTS=128', 'MAX_PENDING=72'), 'protected fixed-step/cap constants changed');
for (const terrain of ['ice','mud','sand','water','bramble','grass','shards']) expect(files.model.includes(`${terrain}:`), `missing terrain ${terrain}`);
for (const forage of ['heartleaf','rushResin','barkguard','edgeStone','flowSap']) expect(files.model.includes(`${forage}:`), `missing field reward ${forage}`);
for (const mushroom of ['heartcap','swiftcap','guardcap','edgecap','venomcap','ghostcap']) expect(files.model.includes(`${mushroom}:`), `missing mushroom ${mushroom}`);
for (const enemy of ['feller','foreman','lobbyist','skidder','drone','chair','broker','surveyor','mech','mulcher']) expect(files.model.includes(`${enemy}:`), `missing enemy ${enemy}`);
expect(has(files.model, 'proceduralBlueprint', 'sylvaria-v091-room-${depth}'), 'deterministic endless-room fallback missing');
expect(has(files.world, 'function terrainAt', 'function mobilityAt', 'function evadeDestinationSafe', "['mud','bramble','shards'].includes(p.type)"), 'shared terrain/evade sampler missing');
expect(has(files.world, 'function resolveEnemyDeath', 'function updateBossPhases', 'function resolveBossDeath', 'function damageEnemy', 'function damageBoss'), 'centralized damage/death pipeline missing');
expect(has(files.world, "damageBoss(.45,null,{hazard:true", "damageEnemy(e,.55,null,{hazard:true", 'hazardKills'), 'terrain hazards bypass centralized bookkeeping');
expect(has(files.world, 'function spawnGasCloud', 'function updateGas', 'gasRoutes', "damageEnemy(e,.7,null,{hazard:true,gas:true"), 'symmetric poison system missing');
expect(has(files.world, 'function rewardExploration', 'function maybeReleaseGrassCache', 'function breakDeadwood', 'function breakBrittle', 'function cutMushroom', 'function collectPickup'), 'exploration/reward pipeline missing');
expect(has(files.movement, 'function queueMove', 'function consumeMoveQueue', 'state.moveQueue={key,serial:++state.inputSerial}', 'if(consumeMoveQueue())return'), 'persistent one-command movement queue changed');
expect(!files.movement.includes('moveQueue.life') && !files.movement.includes('moveBuffer'), 'movement queue must not be stopwatch-expiring');
expect(has(files.movement, 'function resolveDashTarget', 'F.mobilityAt', "['mud','sand'].includes(end.type)"), 'terrain-aware routing missing');
expect(has(files.movement, 'function tryDashCutIce', 'p.dashEcho>0', 'p.dashEcho=.085', "type:'shards'", 'state.stats.iceFractures++'), 'live dash-cut ice fracture / echo window missing');
expect(has(files.movement, 'function counterShot', 'function shotApproachDirection', 'function chooseReturnTarget', 'speed=perfect?1040:840', "s.pattern='return'"), 'protected reflection routing/speeds changed');
expect(has(files.movement, 'reflectedTravel', 'crosscuts', 'longReturns', 's.pierces=perfect?1:0'), 'Crosscut/Long Return/penetration rewards missing');
expect(files['battle-core'].includes('state.stats.ricochets++'), 'perfect-return penetration bookkeeping missing');
expect(has(files.movement, 'p.buffs.edge>0?24:0', 'p.buffs.rush>0?1.08:1'), 'temporary field benefits are not wired into substrate');
for (const pattern of ['straight','zigzag','wave','spiral','swerve','wobble','return']) expect(files['battle-core'].includes(`'${pattern}'`), `missing projectile pattern ${pattern}`);
expect(has(files['battle-core'], 'function moveToward', 'F.mobilityAt(e.x,e.y)', 'speed*mob.move*dt'), 'ordinary enemy terrain drag missing');
expect(has(files['battle-core'], "e.type==='skidder'&&e.state==='charge'", 'speed=420*global*mob.move'), 'Skidder charge terrain drag missing');
expect(has(files['battle-core'], 'function maybeBeginEvade', 'function safeEvadeDestination', 'ESCAPE JAMMED'), 'terrain-aware evasion missing');
expect(has(files['battle-core'], 'function ventBoss', 'b.sawAngle', 'b.heat', 'b.exhaustClock'), 'boss anticipation state missing');
expect(has(files['battle-core'], 'MAX_SHOTS', 'MAX_PENDING', 'scheduleShot', 'updatePendingShots'), 'projectile caps/scheduler changed');
expect(has(files.render, 'function rebuildTerrainCache', 'terrainCanvas', 'drawGrass', 'drawMushrooms', 'drawGas', 'drawPickups'), 'cached/material renderer missing');
expect(has(files.render, 'function saw(', 'function drawBoss', 'b.sawAngle', 'b.heat'), 'industrial boss rendering missing');
expect(has(files.render, "s.pattern==='zigzag'", "s.pattern==='spiral'", "s.pattern==='swerve'", "s.pattern==='wobble'"), 'projectile signatures missing');
expect(has(files.boot, 'while(accumulator>=FIXED_DT)', 'function labEnemyTravel', 'F.moveToward(e,state.player,ENEMY_TYPES[type].speed,FIXED_DT)'), 'fixed simulation / isolated mobility lab missing');

expect(has(synergy, "const VERSION='0.10.0'", 'originPattern', 'mushroomReturns', 'function triggerReturnEcology', 'ecologyHits', 'WAVE-SPORE BLOOM'), 'returned-shot mushroom interaction missing');
expect(has(synergy, 'function shearGas', 'gasShears', 'SPORE SHEAR'), 'committed gas-shear contract missing');
expect(has(synergy, "const VERSION='0.10.0',CAUTIOUS", 'hazardScoreAt', 'steerCautious', "['foreman','lobbyist','chair','broker','surveyor']"), 'cautious hazard-aware steering missing');
expect(!synergy.includes("CAUTIOUS=new Set(['foreman','lobbyist','chair','broker','surveyor','skidder']"), 'Skidder must remain deliberately reckless');
expect(has(synergy, 'const baseEvade=F.evadeDestinationSafe', 'state.gasClouds.some', 'c.r+r+16'), 'gas-aware evade rejection missing');
expect(has(synergy, 'function bulldozeBoss', 'bossBulldozes', 'INDUSTRIAL BULLDOZE'), 'boss bulldozer interaction missing');
expect(!synergy.slice(synergy.indexOf('function bulldozeBoss'), synergy.indexOf('function chooseThreat')).includes('rewardExploration'), 'boss bulldozing must not grant exploration rewards');
expect(has(synergy, 'function maybeVerdant', 'p.flow<75', 'state.synergyChain<3', 'state.verdantTimer=3.6', 'flowActivations'), 'bounded internal Flow gate missing');
expect(has(synergy, 'perfectCounters', 'crosscuts', 'longReturns', 'terrainRoutes', 'hazardKills', 'gasRoutes'), 'internal Flow state is not driven by actual core/ecology events');
expect(!synergy.includes('1040') && !synergy.includes('840'), 'interaction layer must not redefine protected return speeds');
expect(!synergy.includes('moveQueue=') && !synergy.includes('queueMove('), 'interaction layer must not rewrite protected movement queue');
expect(has(synergy, 'function chooseThreat', 'closing=', 'bestT', 'function drawThreat', 'drawReturnPriority', 'drawPacHeat'), 'visual-priority overlay incomplete');
expect(has(synergy, 'const baseRender=F.render', 'baseRender();drawThreat', 'drawReturnPriority();drawPacHeat()'), 'priority overlay must remain post-render and geometry-neutral');

expect(has(rooms, 'ROOMS=Object.freeze', "R('Clearing'", "R('Lower Canopy'", "R('Access Road'", "bossName:'Surveyor'", "bossName:'Harvester'", "bossName:'Mulcher'", 'if(depth>=1&&depth<=ROOMS.length)', 'legacyRoomBlueprint(depth)', "title:`Depth ${depth}`"), '30-arena authored progression/fallback is incomplete');
const authoredRoomCalls = (rooms.match(/\bR\('/g) || []).length;
expect(authoredRoomCalls >= 30, `expected at least 30 authored arena declarations, found ${authoredRoomCalls}`);
expect(!/Trailhead Trespass|Nailgun Nursery|Red Tape Ravine|Committee Canopy|Subsidy Grove|PAC-a-Saw Summit/.test(rooms), 'retired pun-heavy room names leaked into current arena table');

expect(has(presentation, "version:'0.11.1'", "HEARTLEAF/gi,'HEAL'", "RUSH RESIN/gi,'SPEED'", "BARKGUARD/gi,'SHIELD'", "EDGE STONE/gi,'REACH'", "PAC-a-Saw/gi,'BOSS'", 'const baseRender=F.render', 'p.flow/100'), 'minimal presentation translation/Flow ring incomplete');
expect(has(inputGuard, "key==='p'||key==='m'", 'event.repeat', 'stopImmediatePropagation', 'repeatSafe:true'), 'pause/mute repeat guard missing');
expect(has(coach, "version:'0.11.1'", 'WASD · move', 'arrow keys · cut', 'cut toward incoming shots · reflect', 'stats.counters>0', 'remember()'), 'action-driven first-run coach incomplete');
expect(has(competitive, "version:'0.11.1'", '/api/sylvaria/leaderboard', '/api/sylvaria/run-ticket', '/api/sylvaria/leaderboard/submit', 'ranked replay ready', 'new best', 'current===run', 'Replay.envelope'), 'competitive client flow incomplete');
expect(has(leaderboard, 'SYLVARIA_TICKET_START_GRACE_MS = 5_000', 'assertSylvariaReplayFitsTicketWindow', 'replay predates its run ticket'), 'ranked ticket-age binding missing');
expect(has(submitRoute, 'assertSylvariaReplayFitsTicketWindow(ticket, envelope.durationTicks)'), 'ranked submit endpoint does not enforce ticket age');
const visibleSurface = `${html}\n${arcade}`;
expect(!/Sprid|Sprig|Verdant Flow|Ecological Synergy|PAC-a-Saw|Heartleaf|Rush Resin|Barkguard|Edge Stone|Flow Sap/i.test(visibleSurface), 'retired branded terminology remains on current player-facing surfaces');
expect(has(html, 'Move with WASD', 'Cut with the arrow keys', 'Simple inputs. Difficult rooms.', 'health', 'top verified runs', 'post score'), 'minimal control/competition copy is incomplete');
expect(has(minimalStyles, '#roomCard', '#runRail', '.telemetryHidden', '.menuPanel', '.rankPanel', '.rankedSubmit', 'box-shadow:none'), 'minimal UI stylesheet missing hierarchy reductions');
expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'base aspect-safe HUD styling missing');
expect(has(arcade, "version: 'v0.11.1'", 'REFLECT · MOVE · USE THE ROOM.', '30-arena', 'deterministic replay', 'fixed arenas'), 'Game Network metadata is not on v0.11.1');

expect(has(replay, "VERSION='0.11.1'", 'MAX_EVENTS=20000', 'MAX_TICKS=144000', 'MAX_BYTES=120*1024', "invalidate('visibility changed')", "invalidate('input event limit')"), 'browser replay recorder version/limits/hardening incomplete');
expect(has(serverReplay, "SYLVARIA_ENGINE_VERSION = '0.11.1'", 'SYLVARIA_MAX_REPLAY_TICKS = 120 * 60 * 20', 'SYLVARIA_MAX_REPLAY_EVENTS = 20_000', 'SYLVARIA_MAX_REPLAY_BYTES = 120 * 1024'), 'server replay contract is not aligned to v0.11.1');
expect(has(headless, "`${ROOT}/v011/rooms-v011.js`", "'v011', 'rooms-v011.js'", 'SYLVARIA_RANKED_VERIFY_MAX_WALL_MS = 8_000', 'exceeded CPU budget'), 'Node verifier does not hash/load authored arenas with CPU bounds');
expect(nextConfig.includes('./public/game-runtimes/mosslight-v2/v011/rooms-v011.js'), 'serverless output tracing omits authored arena source');

expect(/0\.9\.1/.test(doc9) && /forage|forest chemistry/i.test(doc9), 'qualified v0.9.1 implementation document missing');
expect(/0\.10\.0/.test(doc10) && /Countercut-authored chain reactions/.test(doc10) && /Verdant Flow/.test(doc10) && /13 KiB/.test(doc10), 'historical v0.10 implementation contract incomplete');
expect(has(profiler, 'gzipSync', 'brotliCompressSync', 'competitionLimitBytes', 'readableRuntime', 'portfolioPayload', 'competitionGap'), 'runtime size telemetry missing');

for (const [name, source] of Object.entries({model:files.model,world:files.world,movement:files.movement,'battle-core':files['battle-core'],render:files.render,'synergy-v010':synergy,'rooms-v011':rooms,'presentation-v011':presentation,'replay-v011':replay,'input-guard-v011':inputGuard,'competitive-v011':competitive,'coach-v011':coach})) {
  try { new Function(source); } catch (error) { errors.push(`${name}.js does not compile: ${error.message}`); }
}
try {
  const stripped = files.boot.replace(/import\s+['"][^'"]+['"];?/g, '');
  new Function(stripped);
} catch (error) { errors.push(`boot.js does not compile after import stripping: ${error.message}`); }

if (errors.length) {
  console.error(`Sylvaria v0.11.1 validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('Sylvaria v0.11.1 PASS: protected 120 Hz reflection/queue mechanics remain unchanged; 30 fixed arenas, minimal vocabulary, repeat-safe controls, action coaching, verified competitive targets, bounded replay capture, authored-room engine hashing, CPU-bounded Node verification, and inherited terrain/poison interactions are wired without rewriting the qualified core.');
