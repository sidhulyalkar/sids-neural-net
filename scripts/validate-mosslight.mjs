import fs from 'node:fs';

const root = 'public/game-runtimes/mosslight-v2';
const read = (path) => fs.readFileSync(path, 'utf8');
const html = read(`${root}/index.html`);
const files = Object.fromEntries(['model','world','movement','battle-core','render','boot'].map((name) => [name, read(`${root}/v091/${name}.js`)]));
const styles = read(`${root}/sylvaria-v8.css`);
const arcade = read('src/data/arcadeGames.ts');
const doc = read('docs/SYLVARIA_V09_ENVIRONMENTAL_RESONANCE.md');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const has = (source, ...needles) => needles.every((needle) => source.includes(needle));

expect(has(html, 'Sylvaria: Environmental Resonance', 'id="fieldState"', 'field kit', 'Explore Mid-Fight'), 'v0.9.1 shell/tutorial is incomplete');
expect(html.includes('<script type="module" src="./v091/boot.js"></script>'), 'production shell must boot the canonical v091 module graph');
for (const retired of ['./game-v90.js','./game-v82.js','./game-v81.js','./input-buffer-v81.js','./visual-system-v9.js']) expect(!html.includes(retired), `retired runtime still wired: ${retired}`);

expect(has(files.model, "VERSION='0.9.1'", 'FIXED_DT=1/120', 'MAX_SHOTS=128', 'MAX_PENDING=72'), 'protected fixed-step/cap constants changed');
for (const terrain of ['ice','mud','sand','water','bramble','grass','shards']) expect(files.model.includes(`${terrain}:`), `missing terrain ${terrain}`);
for (const forage of ['heartleaf','rushResin','barkguard','edgeStone','flowSap']) expect(files.model.includes(`${forage}:`), `missing forage reward ${forage}`);
for (const mushroom of ['heartcap','swiftcap','guardcap','edgecap','venomcap','ghostcap']) expect(files.model.includes(`${mushroom}:`), `missing mushroom ${mushroom}`);
for (const enemy of ['feller','foreman','lobbyist','skidder','drone','chair','broker','surveyor','mech','mulcher']) expect(files.model.includes(`${enemy}:`), `missing enemy ${enemy}`);
for (const title of ['Trailhead Trespass','Nailgun Nursery','Red Tape Ravine','Skidder Switchback','Sawdisc Wetland','Committee Canopy','Subsidy Grove','Clearcut Conveyor','Four-Way Firebreak','PAC-a-Saw Summit']) expect(files.model.includes(`title:'${title}'`), `missing authored room ${title}`);
expect(has(files.model, 'secrets:', 'mushrooms:', 'proceduralBlueprint', 'sylvaria-v091-room-${depth}'), 'deterministic exploration/deep-room grammar missing');

expect(has(files.world, 'function terrainAt', 'function mobilityAt', 'function evadeDestinationSafe', "['mud','bramble','shards'].includes(p.type)"), 'shared terrain/evade sampler missing');
expect(has(files.world, 'function resolveEnemyDeath', 'function updateBossPhases', 'function resolveBossDeath', 'function damageEnemy', 'function damageBoss'), 'centralized damage/death pipeline missing');
expect(has(files.world, "damageBoss(.45,null,{hazard:true", "damageEnemy(e,.55,null,{hazard:true", 'hazardKills'), 'terrain hazards bypass centralized bookkeeping');
expect(has(files.world, 'function spawnGasCloud', 'function updateGas', 'gasRoutes', "damageEnemy(e,.7,null,{hazard:true,gas:true"), 'symmetric toxic-spore system missing');
expect(has(files.world, 'function rewardExploration', 'function maybeReleaseGrassCache', 'function breakDeadwood', 'function breakBrittle', 'function cutMushroom', 'function collectPickup'), 'environmental discovery/reward pipeline missing');
expect(has(files.world, "i.type==='rushResin'", "i.type==='barkguard'", "i.type==='edgeStone'", "i.type==='flowSap'"), 'temporary forage effects incomplete');

expect(has(files.movement, 'function queueMove', 'function consumeMoveQueue', 'state.moveQueue={key,serial:++state.inputSerial}', 'if(consumeMoveQueue())return'), 'persistent one-command movement queue changed');
expect(!files.movement.includes('moveQueue.life') && !files.movement.includes('moveBuffer'), 'movement queue must not be stopwatch-expiring');
expect(has(files.movement, 'function resolveDashTarget', 'F.mobilityAt', "['mud','sand'].includes(end.type)"), 'terrain-aware Sprid routing missing');
expect(has(files.movement, 'function tryDashCutIce', 'function segmentCircleHit', 'p.dashEcho>0', 'p.dashEcho=.085', "type:'shards'", 'state.stats.iceFractures++'), 'live dash-cut ice fracture / echo window missing');
expect(has(files.movement, 'function counterShot', 'function shotApproachDirection', 'function chooseReturnTarget', 'speed=perfect?1040:840', "s.pattern='return'"), 'protected Countercut routing/speeds changed');
expect(has(files.movement, 'reflectedTravel', 'crosscuts', 'longReturns', 's.pierces=perfect?1:0', 'ricochets'), 'Crosscut/Long Return/penetration rewards missing');
expect(has(files.movement, 'p.buffs.edge>0?24:0', 'p.buffs.rush>0?1.08:1'), 'field-kit combat benefits are not wired into reach/movement');

for (const pattern of ['straight','zigzag','wave','spiral','swerve','wobble','return']) expect(files['battle-core'].includes(`'${pattern}'`), `missing projectile pattern ${pattern}`);
expect(has(files['battle-core'], 'function moveToward', 'F.mobilityAt(e.x,e.y)', 'speed*mob.move*dt'), 'ordinary enemy mud/terrain drag missing');
expect(has(files['battle-core'], "e.type==='skidder'&&e.state==='charge'", 'speed=420*global*mob.move'), 'Skidder charge terrain drag missing');
expect(has(files['battle-core'], 'function maybeBeginEvade', 'function safeEvadeDestination', 'ESCAPE JAMMED'), 'terrain-aware evasion missing');
expect(has(files['battle-core'], 'function ventBoss', 'b.sawAngle', 'b.heat', 'b.exhaustClock', 'function bossAttack'), 'PAC-a-Saw heat/exhaust anticipation state missing');
expect(has(files['battle-core'], 'MAX_SHOTS', 'MAX_PENDING', 'scheduleShot', 'updatePendingShots'), 'projectile cap/scheduler integration missing');

expect(has(files.render, 'function rebuildTerrainCache', 'terrainCanvas', 'drawTerrainPatch', 'drawGrass', 'drawMushrooms', 'drawGas', 'drawPickups'), 'cached/material ecology renderer missing');
expect(has(files.render, 'function saw(', 'function drawBoss', 'b.sawAngle', 'b.heat', "strokeStyle=heat>.6?'#ffd27b'"), 'PAC-a-Saw high-contrast industrial saw rendering missing');
expect(has(files.render, 'drawEnemy', "e.type==='surveyor'", "e.type==='mulcher'", 'afterimages'), 'enemy silhouette/locomotion readability missing');
expect(has(files.render, "s.pattern==='zigzag'", "s.pattern==='spiral'", "s.pattern==='swerve'", "s.pattern==='wobble'"), 'projectile visual signatures missing');
expect(has(files.render, "p.shieldCharges>0", "p.buffs.edge>0", 'fieldState'), 'temporary field-kit feedback missing');

expect(has(files.boot, "import './movement.js'", "import './battle-core.js'", "import './render.js'"), 'canonical v0.9.1 module graph missing');
expect(has(files.boot, 'while(accumulator>=FIXED_DT)', 'function labEnemyTravel', 'F.moveToward(e,state.player,ENEMY_TYPES[type].speed,FIXED_DT)'), 'fixed simulation / isolated enemy mobility fixture missing');
expect(has(files.boot, 'function labClearGeometry', 'function placeMushroom', 'triggerMushroom', 'applyHazardToEnemy', 'applyHazardToBoss'), 'v0.9.1 environmental playtest hooks missing');
for (const flag of ['resilientMoveQueue','projectilePatternReadability','counterRouting','terrainReadability','symmetricTerrainRules','environmentalDiscovery','symmetricSporeHazards','pacIndustrialSilhouette','pacExhaustTelegraph']) expect(files.boot.includes(`${flag}:true`), `visual/playtest contract missing ${flag}`);

expect(styles.includes('aspect-ratio:3/2') && styles.includes('#runRail'), 'aspect-safe sparse HUD styling missing');
expect(arcade.includes('v0.9.1') && /forage|ecology|fracture/i.test(arcade), 'Game Network metadata is not on v0.9.1');
expect(/0\.9\.1/.test(doc) && /forage|forest chemistry/i.test(doc) && /hazard/i.test(doc) && /PAC-a-Saw/.test(doc), 'v0.9.1 implementation document incomplete');

for (const name of ['model','world','movement','battle-core','render']) {
  try { new Function(files[name]); } catch (error) { errors.push(`${name}.js does not compile: ${error.message}`); }
}
try {
  const stripped = files.boot.replace(/^import\s+['"][^'"]+['"];?/gm, '');
  new Function(stripped);
} catch (error) { errors.push(`boot.js does not compile after import stripping: ${error.message}`); }

if (errors.length) {
  console.error(`Sylvaria v0.9.1 validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log('Sylvaria v0.9.1 PASS: protected 120 Hz Countercut and persistent queue, live dash-cut ice fracture, laboratory-proven shared terrain mobility, centralized hazard bookkeeping, deterministic forage/mushroom ecology, symmetric toxic spores, cached material rendering, and industrial PAC-a-Saw anticipation are wired without changing projectile caps.');
