import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const read = (path) => fs.readFileSync(path, 'utf8');
const html = read(`${root}/index.html`);
const files = Object.fromEntries(['model','world','movement','battle-core','render','boot'].map((name) => [name, read(`${root}/v091/${name}.js`)]));
const synergy = read(`${root}/v091/synergy-v010.js`);
const entry = read(`${root}/v010-entry.js`);
const styles = read(`${root}/sylvaria-v8.css`);
const arcade = read('src/data/arcadeGames.ts');
const doc9 = read('docs/SYLVARIA_V09_ENVIRONMENTAL_RESONANCE.md');
const doc10 = read('docs/SYLVARIA_V010_ECOLOGICAL_SYNERGY.md');
const profiler = read('scripts/profile-sylvaria-size.mjs');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const has = (source, ...needles) => needles.every((needle) => source.includes(needle));

// Production must boot v0.10 through an adapter while retaining the exact qualified v0.9.1 substrate.
expect(has(html, 'Sylvaria: Ecological Synergy', 'id="fieldState"', 'Chain Ecology', 'Verdant Flow'), 'v0.10 shell/tutorial is incomplete');
expect(html.includes('<script type="module" src="./v010-entry.js"></script>'), 'production shell must load the v0.10 entrypoint');
expect(!html.includes('<script type="module" src="./v091/boot.js"></script>'), 'production shell must not bypass the v0.10 entrypoint');
for (const retired of ['./game-v90.js','./game-v82.js','./game-v81.js','./input-buffer-v81.js','./visual-system-v9.js']) expect(!html.includes(retired), `retired runtime still wired: ${retired}`);
expect(has(entry, "import './v091/boot.js'", "await import('./v091/synergy-v010.js')", "const VERSION='0.10.0'", 'ecologicalSynergy:true', 'hazardAwareAI:true', 'verdantFlow:true', 'threatPriority:true'), 'v0.10 entry/version adapter incomplete');

// Protected v0.9.1 constants and mechanics remain mandatory.
expect(has(files.model, "VERSION='0.9.1'", 'FIXED_DT=1/120', 'MAX_SHOTS=128', 'MAX_PENDING=72'), 'protected fixed-step/cap constants changed');
for (const terrain of ['ice','mud','sand','water','bramble','grass','shards']) expect(files.model.includes(`${terrain}:`), `missing terrain ${terrain}`);
for (const forage of ['heartleaf','rushResin','barkguard','edgeStone','flowSap']) expect(files.model.includes(`${forage}:`), `missing forage reward ${forage}`);
for (const mushroom of ['heartcap','swiftcap','guardcap','edgecap','venomcap','ghostcap']) expect(files.model.includes(`${mushroom}:`), `missing mushroom ${mushroom}`);
for (const enemy of ['feller','foreman','lobbyist','skidder','drone','chair','broker','surveyor','mech','mulcher']) expect(files.model.includes(`${enemy}:`), `missing enemy ${enemy}`);
for (const title of ['Trailhead Trespass','Nailgun Nursery','Red Tape Ravine','Skidder Switchback','Sawdisc Wetland','Committee Canopy','Subsidy Grove','Clearcut Conveyor','Four-Way Firebreak','PAC-a-Saw Summit']) expect(files.model.includes(`title:'${title}'`), `missing authored room ${title}`);
expect(has(files.model, 'secrets:', 'mushrooms:', 'proceduralBlueprint', 'sylvaria-v091-room-${depth}'), 'deterministic ecology/deep-room grammar missing');

expect(has(files.world, 'function terrainAt', 'function mobilityAt', 'function evadeDestinationSafe', "['mud','bramble','shards'].includes(p.type)"), 'shared terrain/evade sampler missing');
expect(has(files.world, 'function resolveEnemyDeath', 'function updateBossPhases', 'function resolveBossDeath', 'function damageEnemy', 'function damageBoss'), 'centralized damage/death pipeline missing');
expect(has(files.world, "damageBoss(.45,null,{hazard:true", "damageEnemy(e,.55,null,{hazard:true", 'hazardKills'), 'terrain hazards bypass centralized bookkeeping');
expect(has(files.world, 'function spawnGasCloud', 'function updateGas', 'gasRoutes', "damageEnemy(e,.7,null,{hazard:true,gas:true"), 'symmetric toxic-spore system missing');
expect(has(files.world, 'function rewardExploration', 'function maybeReleaseGrassCache', 'function breakDeadwood', 'function breakBrittle', 'function cutMushroom', 'function collectPickup'), 'environmental discovery/reward pipeline missing');

expect(has(files.movement, 'function queueMove', 'function consumeMoveQueue', 'state.moveQueue={key,serial:++state.inputSerial}', 'if(consumeMoveQueue())return'), 'persistent one-command movement queue changed');
expect(!files.movement.includes('moveQueue.life') && !files.movement.includes('moveBuffer'), 'movement queue must not be stopwatch-expiring');
expect(has(files.movement, 'function resolveDashTarget', 'F.mobilityAt', "['mud','sand'].includes(end.type)"), 'terrain-aware Sprid routing missing');
expect(has(files.movement, 'function tryDashCutIce', 'p.dashEcho>0', 'p.dashEcho=.085', "type:'shards'", 'state.stats.iceFractures++'), 'live dash-cut ice fracture / echo window missing');
expect(has(files.movement, 'function counterShot', 'function shotApproachDirection', 'function chooseReturnTarget', 'speed=perfect?1040:840', "s.pattern='return'"), 'protected Countercut routing/speeds changed');
expect(has(files.movement, 'reflectedTravel', 'crosscuts', 'longReturns', 's.pierces=perfect?1:0'), 'Crosscut/Long Return/penetration rewards missing');
expect(files['battle-core'].includes('state.stats.ricochets++'), 'perfect-return penetration bookkeeping missing');
expect(has(files.movement, 'p.buffs.edge>0?24:0', 'p.buffs.rush>0?1.08:1'), 'field-kit benefits are not wired into v0.9.1 substrate');

for (const pattern of ['straight','zigzag','wave','spiral','swerve','wobble','return']) expect(files['battle-core'].includes(`'${pattern}'`), `missing projectile pattern ${pattern}`);
expect(has(files['battle-core'], 'function moveToward', 'F.mobilityAt(e.x,e.y)', 'speed*mob.move*dt'), 'ordinary enemy terrain drag missing');
expect(has(files['battle-core'], "e.type==='skidder'&&e.state==='charge'", 'speed=420*global*mob.move'), 'Skidder charge terrain drag missing');
expect(has(files['battle-core'], 'function maybeBeginEvade', 'function safeEvadeDestination', 'ESCAPE JAMMED'), 'terrain-aware evasion missing');
expect(has(files['battle-core'], 'function ventBoss', 'b.sawAngle', 'b.heat', 'b.exhaustClock'), 'PAC-a-Saw anticipation state missing');
expect(has(files['battle-core'], 'MAX_SHOTS', 'MAX_PENDING', 'scheduleShot', 'updatePendingShots'), 'projectile caps/scheduler changed');

expect(has(files.render, 'function rebuildTerrainCache', 'terrainCanvas', 'drawGrass', 'drawMushrooms', 'drawGas', 'drawPickups'), 'cached/material ecology renderer missing');
expect(has(files.render, 'function saw(', 'function drawBoss', 'b.sawAngle', 'b.heat'), 'PAC-a-Saw industrial rendering missing');
expect(has(files.render, "s.pattern==='zigzag'", "s.pattern==='spiral'", "s.pattern==='swerve'", "s.pattern==='wobble'"), 'projectile signatures missing');
expect(has(files.boot, 'while(accumulator>=FIXED_DT)', 'function labEnemyTravel', 'F.moveToward(e,state.player,ENEMY_TYPES[type].speed,FIXED_DT)'), 'fixed simulation / isolated mobility lab missing');

// v0.10 compositional layer. It may amplify ecology, but not protected movement/return values.
expect(has(synergy, "const VERSION='0.10.0'", 'originPattern', 'mushroomReturns', 'function triggerReturnEcology', 'ecologyHits', 'WAVE-SPORE BLOOM'), 'returned-shot mushroom composition missing');
expect(has(synergy, 'function shearGas', 'p.dash&&p.dashEcho', 'gasShears', 'SPORE SHEAR') || has(synergy, 'function shearGas', '!p.dash&&p.dashEcho<=0', 'gasShears', 'SPORE SHEAR'), 'committed gas-shear contract missing');
expect(has(synergy, "const VERSION='0.10.0',CAUTIOUS", 'hazardScoreAt', 'steerCautious', "['foreman','lobbyist','chair','broker','surveyor']"), 'cautious hazard-aware steering missing');
expect(!synergy.includes("'skidder'" ) || !synergy.includes("CAUTIOUS=new Set(['foreman','lobbyist','chair','broker','surveyor','skidder']"), 'Skidder must remain deliberately reckless');
expect(has(synergy, 'const baseEvade=F.evadeDestinationSafe', 'state.gasClouds.some', 'c.r+r+16'), 'gas-aware evade rejection missing');
expect(has(synergy, 'function bulldozeBoss', 'bossBulldozes', 'INDUSTRIAL BULLDOZE'), 'PAC-a-Saw bulldozer missing');
expect(!synergy.slice(synergy.indexOf('function bulldozeBoss'), synergy.indexOf('function chooseThreat')).includes('rewardExploration'), 'PAC bulldozing must not grant forage rewards');
expect(has(synergy, 'function maybeVerdant', 'p.flow<75', 'state.synergyChain<3', 'state.verdantTimer=3.6', 'flowActivations'), 'bounded Verdant Flow gate missing');
expect(has(synergy, 'perfectCounters', 'crosscuts', 'longReturns', 'terrainRoutes', 'hazardKills', 'gasRoutes'), 'Verdant Flow is not driven by actual core/ecology events');
expect(!synergy.includes('1040') && !synergy.includes('840'), 'synergy layer must not redefine protected return speeds');
expect(!synergy.includes('moveQueue=') && !synergy.includes('queueMove('), 'synergy layer must not rewrite protected movement queue');
expect(has(synergy, 'function chooseThreat', 'closing=', 'bestT', 'function drawThreat', 'drawReturnPriority', 'drawVerdant', 'drawPacHeat'), 'visual-priority overlay incomplete');
expect(has(synergy, 'const baseRender=F.render', 'baseRender();drawThreat', 'drawReturnPriority();drawPacHeat()'), 'priority overlay must remain post-render and geometry-neutral');

expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'aspect-safe sparse HUD styling missing');
expect(arcade.includes('v0.10.0') && /VERDANT FLOW|ecological synergy/i.test(arcade), 'Game Network metadata is not on v0.10');
expect(/0\.9\.1/.test(doc9) && /forage|forest chemistry/i.test(doc9), 'qualified v0.9.1 implementation document missing');
expect(/0\.10\.0/.test(doc10) && /Countercut-authored chain reactions/.test(doc10) && /Verdant Flow/.test(doc10) && /13 KiB/.test(doc10), 'v0.10 implementation contract incomplete');
expect(has(profiler, 'gzipSync', 'brotliCompressSync', 'competitionLimitBytes', 'readableRuntime', 'portfolioPayload', 'competitionGap'), 'v0.10 runtime size telemetry missing');

for (const name of ['model','world','movement','battle-core','render','synergy-v010']) {
  const source = name === 'synergy-v010' ? synergy : files[name];
  try { new Function(source); } catch (error) { errors.push(`${name}.js does not compile: ${error.message}`); }
}
try {
  const stripped = files.boot.replace(/import\s+['"][^'"]+['"];?/g, '');
  new Function(stripped);
} catch (error) { errors.push(`boot.js does not compile after import stripping: ${error.message}`); }
// v010-entry uses top-level await by design, so semantic string checks + the production browser/build gate validate it.

if (errors.length) {
  console.error(`Sylvaria v0.10 validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('Sylvaria v0.10 PASS: the CI-qualified v0.9.1 Countercut substrate remains protected while returned-shot ecology, committed gas shear, hazard-aware personalities, PAC bulldozing, bounded Verdant Flow, visual threat priority, and explicit size telemetry are wired as additive systems.');
