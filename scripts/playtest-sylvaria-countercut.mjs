import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');
const baseUrl = process.env.SYLVARIA_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_PLAYTEST_DIR || 'artifacts/sylvaria-countercut';
fs.mkdirSync(outputDir, { recursive: true });
const failures = [], consoleErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
const snap = () => page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const api = (fn, arg) => page.evaluate(({ fn, arg }) => window.__MOSSLIGHT_PLAYTEST__[fn](...(Array.isArray(arg) ? arg : arg === undefined ? [] : [arg])), { fn, arg });
const focus = () => page.locator('#c').focus();
const setRoom = (depth) => page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 10, d), depth);
const cleanLab = async (depth = 1) => { await setRoom(depth); await api('clearCombatants'); await api('labClearGeometry'); };
const assert = (condition, message) => { if (!condition) failures.push(message); };

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?forage-fracture-playtest=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.version === '0.9.1' && window.SylvariaVisualSystem?.version === '0.9.1');
const meta = await page.evaluate(() => ({
  title: window.__MOSSLIGHT_PLAYTEST__.title,
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  rooms: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
  visual: window.__MOSSLIGHT_PLAYTEST__.snapshot().visual,
  movement: window.MosslightDirector.movementPatterns,
  projectiles: window.MosslightDirector.projectilePatterns,
  terrain: window.MosslightDirector.terrainPatterns,
  forage: window.MosslightDirector.foragePatterns,
  mushrooms: window.MosslightDirector.mushroomPatterns,
}));
assert(meta.title === 'Sylvaria' && meta.version === '0.9.1', `runtime identity mismatch ${JSON.stringify(meta)}`);
assert(meta.rooms.length === 10 && meta.rooms.includes('PAC-a-Saw Summit'), 'ten-room authored curriculum missing');
for (const flag of ['resilientMoveQueue','projectilePatternReadability','evasiveEnemyCues','counterRouting','terrainReadability','symmetricTerrainRules','destructibleFoliage','combatAnimationStates','proceduralSilhouettes','environmentalDiscovery','symmetricSporeHazards','pacIndustrialSilhouette','pacExhaustTelegraph']) assert(meta.visual?.[flag], `visual contract missing ${flag}`);
for (const p of ['straight','zigzag','wave','spiral','swerve','wobble','return']) assert(meta.projectiles.includes(p), `projectile registry missing ${p}`);
for (const t of ['ice','mud','sand','water','bramble','grass','shards']) assert(meta.terrain.includes(t), `terrain registry missing ${t}`);
for (const f of ['heartleaf','rushResin','barkguard','edgeStone','flowSap']) assert(meta.forage.includes(f), `forage registry missing ${f}`);
for (const m of ['heartcap','swiftcap','guardcap','edgecap','venomcap','ghostcap']) assert(meta.mushrooms.includes(m), `mushroom registry missing ${m}`);
await page.screenshot({ path: path.join(outputDir, 'forage-fracture-v091-title.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await focus();

let before = await snap();
await page.keyboard.press('d');
await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player?.dashing, null, { timeout: 700 });
let after = await snap();
const tapDistance = after.player.x - before.player.x;
assert(tapDistance >= 38 && tapDistance <= 62, `clean D dash drifted from authored ~48px: ${tapDistance.toFixed(1)}`);
assert(after.stats.dashes === before.stats.dashes + 1, 'single D must create exactly one dash');

await setRoom(1); await focus(); before = await snap();
await page.keyboard.press('d'); await page.waitForTimeout(25); await page.keyboard.press('s');
const queueProbe = await snap();
assert(queueProbe.player.bufferedMove === 's' || queueProbe.stats.dashes >= before.stats.dashes + 2, `S did not enter persistent queue: ${JSON.stringify(queueProbe.player)}`);
await page.waitForFunction(({ d, y }) => { const s = window.__MOSSLIGHT_PLAYTEST__.snapshot(); return s.stats.dashes >= d + 2 && !s.player.dashing && !s.player.bufferedMove && s.player.y > y + 32; }, { d: before.stats.dashes, y: before.player.y }, { timeout: 1400 });
after = await snap();
assert(after.player.x > before.player.x + 32 && after.player.y > before.player.y + 32, 'queued east/south commitments did not both resolve');
assert(!after.player.bufferedMove, 'movement queue did not drain');

await setRoom(1); await focus(); before = await snap();
await page.keyboard.down('d'); await page.waitForTimeout(580); await page.keyboard.up('d'); await page.waitForTimeout(150); after = await snap();
assert(after.stats.dashes - before.stats.dashes >= 3, 'held D should repeat discrete game-timed dashes');
assert(after.player.x > before.player.x + 100, 'held D traversal was too small');

const keyFor = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' };
for (const direction of Object.keys(keyFor)) {
  await setRoom(2); await api('clearCombatants'); await page.evaluate((dir) => window.__MOSSLIGHT_PLAYTEST__.spawnCounterShot(dir), direction); await focus(); before = await snap();
  await page.waitForTimeout(50); await page.keyboard.press(keyFor[direction]); await page.waitForTimeout(100); after = await snap();
  assert(after.stats.counters > before.stats.counters, `${direction} Countercut failed`);
}
for (const pattern of ['zigzag','spiral','swerve','wobble']) {
  await setRoom(2); await api('clearCombatants'); await page.evaluate((p) => window.__MOSSLIGHT_PLAYTEST__.firePattern(p,'right',88), pattern); await focus(); before = await snap();
  assert(before.shots[0]?.pattern === pattern, `${pattern} shot family missing before counter`);
  await page.waitForTimeout(35); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); after = await snap();
  assert(after.stats.counters > before.stats.counters, `${pattern} shot was not counterable from actual right arrival side`);
}

// Crosscut + hazard route laboratory. The target is frozen in recovery so this
// measures reflected knockback geometry, not ordinary Surveyor locomotion.
await cleanLab(2);
await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setPlayerPosition(190,320);
  p.placeTerrain('bramble',535,320,28);
  p.spawnTestEnemy('foreman',760,320,'source-foreman');
  p.spawnTestEnemy('surveyor',500,320,'cross-target');
  const target = window.Sylvaria091.state.enemies.find((enemy) => enemy.id === 'cross-target');
  target.state = 'recover'; target.counterStagger = 2; target.clock = 2;
  p.spawnCounterShot('right',82,{ ownerId:'source-foreman', speed:245 });
});
await focus(); await page.waitForTimeout(40); before = await snap(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(35); let mid = await snap();
const returned = mid.shots.find((s) => s.friendly);
assert(returned && returned.speed >= 800 && returned.pattern === 'return', `normal Countercut return invalid: ${JSON.stringify(returned)}`);
assert(returned?.counterTargetId === 'cross-target', `return assist missed cross-target: ${returned?.counterTargetId}`);
await page.waitForTimeout(360); after = await snap();
assert(after.stats.crosscuts >= 1, 'cross-target reflected hit did not award Crosscut');
assert(after.stats.terrainRoutes >= 1, 'reflected knockback did not route stationary target into brambles');

await cleanLab(2); await page.evaluate(() => { const p=window.__MOSSLIGHT_PLAYTEST__; p.setPlayerPosition(175,320); p.spawnTestEnemy('foreman',790,320,'long-source'); p.spawnCounterShot('right',82,{ownerId:'long-source',speed:245}); }); await focus(); await page.waitForTimeout(40); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700); after=await snap();
assert(after.stats.longReturns >= 1, 'long-distance reflected hit did not award Long Return');
await cleanLab(2); await page.evaluate(() => { const p=window.__MOSSLIGHT_PLAYTEST__; p.setPlayerPosition(190,320); p.spawnTestEnemy('foreman',760,320,'perfect-source'); p.spawnCounterShot('right',68,{ownerId:'perfect-source',speed:180}); }); await focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(20); mid=await snap();
const perfect = mid.shots.find((s) => s.friendly);
assert(perfect?.speed >= 1000, `perfect 1040 return should exceed 1000px/s: ${perfect?.speed}`);
assert(perfect?.pierces === 1, `perfect return lost penetration charge: ${perfect?.pierces}`);

const groundTravel = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.labEnemyTravel('feller','ground',.30));
const mudTravel = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.labEnemyTravel('feller','mud',.30));
assert(groundTravel.distance > 10, `ground enemy fixture barely moved: ${groundTravel.distance}`);
assert(mudTravel.distance < groundTravel.distance * .68, `shared mud drag failed: ground ${groundTravel.distance.toFixed(2)} vs mud ${mudTravel.distance.toFixed(2)}`);

await cleanLab(1); await api('setPlayerPosition',[220,320]); before=await snap(); await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d')); await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player.dashing); after=await snap(); const groundDash=after.player.x-before.player.x;
await cleanLab(1); await api('setPlayerPosition',[220,320]); await api('placeTerrain',['mud',220,320,80]); before=await snap(); await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d')); await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player.dashing); after=await snap(); const mudDash=after.player.x-before.player.x;
assert(mudDash < groundDash*.82, `Sprid mud commitment not reduced: ground ${groundDash.toFixed(1)} vs mud ${mudDash.toFixed(1)}`);

await cleanLab(5); await api('setPlayerPosition',[220,320]); await api('placeTerrain',['ice',252,320,34]); before=await snap();
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.dash('right')); await page.waitForTimeout(25); await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(180); after=await snap();
assert(after.stats.iceFractures > before.stats.iceFractures, 'live dash-cut did not record ice fracture');
assert(after.terrain.some((t) => t.type === 'shards' && t.active), 'live dash-cut did not transform ice into shards');
assert(after.terrain.some((t) => t.type === 'ice' && !t.active), 'source ice patch remained active after fracture');

await cleanLab(7); let evadeStart=await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceEvade('surveyor',80)); let e0=evadeStart.enemies[0]; assert(e0?.evading && e0.intent?.kind==='evade','Surveyor did not telegraph safe-ground blink'); await page.waitForTimeout(340); let e1=(await snap()).enemies[0]; assert(e1&&Math.hypot(e1.x-e0.x,e1.y-e0.y)>=38,'Surveyor blink separation too small');
await cleanLab(7); await api('setPlayerPosition',[220,320]); await api('placeTerrain',['mud',300,320,95]); before=await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceEvade('surveyor',80)); assert(!before.enemies[0]?.evading && before.enemies[0]?.counterStagger>0,'mud did not jam Surveyor escape');

await setRoom(1); await api('clearCombatants'); let s=await snap(); const blade=s.foliage.find((b)=>!b.cut); assert(Boolean(blade),'room 1 has no grass blade'); if(blade){await api('setPlayerPosition',[blade.x-22,blade.y]); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(180); after=await snap(); assert(after.stats.grassCut>s.stats.grassCut,'machete did not cut tall grass');}
await setRoom(2); await api('clearCombatants'); s=await snap(); const log=s.debris.find((d)=>!d.dead); assert(Boolean(log),'room 2 has no deadwood'); if(log){await api('setPlayerPosition',[log.x-25,log.y]); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); after=await snap(); assert(after.debris.find((d)=>d.id===log.id)?.dead,'two cuts did not open deadwood');}
await setRoom(8); await api('clearCombatants'); s=await snap(); const rubble=s.brittle.find((b)=>!b.dead); assert(Boolean(rubble),'room 8 has no brittle rubble'); if(rubble){await api('setPlayerPosition',[rubble.x-25,rubble.y]); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); after=await snap(); assert(after.brittle.find((b)=>b.id===rubble.id)?.dead,'two cuts did not reshape brittle rubble'); assert(after.stats.brittleBroken>0,'rubble break not recorded');}

// Keep one inert laboratory enemy alive so the normal 800 ms room-clear timer
// cannot advance the room and reset temporary forage buffs during this sequence.
await cleanLab(3);
await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__;
  p.setPlayerPosition(220,320);
  p.spawnTestEnemy('mech',900,110,'forage-room-anchor');
  const anchor=window.Sylvaria091.state.enemies.find((enemy)=>enemy.id==='forage-room-anchor');
  anchor.state='recover'; anchor.counterStagger=99; anchor.clock=99;
  p.damagePlayer(1);
});
await page.waitForTimeout(700);
for (const [type,check] of [['heartcap','heart'],['swiftcap','rush'],['guardcap','guard'],['edgecap','edge']]) {
  const placed=await page.evaluate((t)=>window.__MOSSLIGHT_PLAYTEST__.placeMushroom(t,230,320),type); const m=placed.mushrooms.at(-1); await page.evaluate((id)=>window.__MOSSLIGHT_PLAYTEST__.triggerMushroom(id),m.id); await page.waitForTimeout(80); after=await snap();
  if(check==='heart') assert(after.player.hp>=5,'Heartcap/Heartleaf did not restore heartwood');
  if(check==='rush') assert(after.player.buffs.rush>0,'Swiftcap did not grant Rush Resin');
  if(check==='guard') assert(after.player.shieldCharges>0,'Guardcap did not grant Barkguard');
  if(check==='edge') assert(after.player.buffs.edge>0,'Edgecap did not grant Edge Stone reach');
}

await cleanLab(4); await api('setPlayerPosition',[200,320]); const toxicSetup=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.placeMushroom('venomcap',500,320);p.spawnTestEnemy('feller',500,320,'gas-target');return p.snapshot()}); const toxic=toxicSetup.mushrooms.at(-1); const hpBefore=toxicSetup.enemies.find((e)=>e.id==='gas-target').hp; await page.evaluate((id)=>window.__MOSSLIGHT_PLAYTEST__.triggerMushroom(id),toxic.id); await page.waitForTimeout(650); after=await snap(); const gasEnemy=after.enemies.find((e)=>e.id==='gas-target'); assert(after.gasClouds.length>0,'Venomcap did not create gas cloud'); assert(gasEnemy && gasEnemy.hp<hpBefore,'Venomcap gas did not damage enemy symmetrically');

await cleanLab(7); const hazardStart=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.spawnTestEnemy('feller',500,320,'hazard-kill');return p.snapshot()}); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.applyHazardToEnemy('hazard-kill',99)); after=await snap(); assert(after.stats.kills===hazardStart.stats.kills+1,'hazard enemy death bypassed kill count'); assert(after.stats.hazardKills===hazardStart.stats.hazardKills+1,'hazard enemy death bypassed hazard kill count');
await setRoom(10); before=await snap(); const phaseDamage=Math.ceil(before.boss.maxHp*.36); await page.evaluate((amount)=>window.__MOSSLIGHT_PLAYTEST__.applyHazardToBoss(amount),phaseDamage); after=await snap(); assert(after.boss.phase>=2,'environmental boss damage bypassed phase transition'); const killsBefore=after.stats.kills; await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.applyHazardToBoss(999)); after=await snap(); assert(after.boss.dead,'environmental boss finisher bypassed boss death'); assert(after.stats.kills===killsBefore+1 && after.stats.hazardKills>=1,'boss hazard death bookkeeping incomplete');

const blueprints=await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;return{a:p.roomBlueprint(22),b:p.roomBlueprint(22),early:p.roomBlueprint(1),late:p.roomBlueprint(30)}}); assert(JSON.stringify(blueprints.a)===JSON.stringify(blueprints.b),'deep room generation is not deterministic'); assert(blueprints.late.dash>=blueprints.early.dash,'dash progression regressed');
await setRoom(22); after=await snap(); assert(after.enemies.length>=4 && after.trees.filter((t)=>t.alive).length>=7,'deep room pressure bounds regressed');

await focus(); await page.keyboard.press('p'); await page.waitForTimeout(80); assert((await snap()).mode==='paused','P did not pause'); await page.keyboard.press('p'); await page.waitForTimeout(80); assert((await snap()).mode==='playing','P did not resume');
await page.waitForTimeout(650); after=await snap(); assert(after.shots.length<=128 && after.pendingShots<=72,`projectile caps violated: ${after.shots.length}/${after.pendingShots}`); assert(after.fps>=42,`headless FPS below 42: ${after.fps.toFixed(1)}`);
await page.screenshot({ path:path.join(outputDir,'forage-fracture-v091-deep-room.png'), fullPage:true });
await setRoom(10); await page.waitForTimeout(900); await page.screenshot({ path:path.join(outputDir,'pac-a-saw-v091-industrial.png'), fullPage:true });

const report={ meta, measurements:{ tapDistance, groundDash, mudDash, enemyGround:groundTravel.distance, enemyMud:mudTravel.distance, finalFps:after.fps }, final:after, consoleErrors, failures };
fs.writeFileSync(path.join(outputDir,'report-v091.json'),JSON.stringify(report,null,2));
await browser.close();
if(consoleErrors.length) failures.push(...consoleErrors.map((e)=>`console error: ${e}`));
if(failures.length){console.error(`Sylvaria v0.9.1 playtest failed with ${failures.length} issue(s):`);for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log(`Sylvaria v0.9.1 combat/ecology PASS: protected queue + Countercut, ${groundTravel.distance.toFixed(2)}→${mudTravel.distance.toFixed(2)} enemy mud drag, live ice fracture, terrain routing, forage buffs, toxic spore symmetry, centralized hazard kills/boss phases, deep progression, projectile caps, and ${after.fps.toFixed(1)} FPS verified.`);
