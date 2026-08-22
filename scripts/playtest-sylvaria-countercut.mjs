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
const assert = (condition, message) => { if (!condition) failures.push(message); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
const snap = () => page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const focus = () => page.locator('#c').focus();
const api = (fn, arg) => page.evaluate(({ fn, arg }) => window.__MOSSLIGHT_PLAYTEST__[fn](...(Array.isArray(arg) ? arg : arg === undefined ? [] : [arg])), { fn, arg });
const setRoom = (depth) => page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 30, d), depth);
const cleanLab = async (depth = 1) => {
  await setRoom(depth);
  await api('clearCombatants');
  await api('labClearGeometry');
};

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?mechanics-gauntlet=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.version === '0.11.1' && window.SylvariaVisualSystem?.version === '0.11.1' && window.SylvariaReplay?.version === '0.11.1');
const meta = await page.evaluate(() => ({
  title: window.__MOSSLIGHT_PLAYTEST__.title,
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
  rooms: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
  visual: window.__MOSSLIGHT_PLAYTEST__.snapshot().visual,
  projectiles: window.MosslightDirector.projectilePatterns,
  terrain: window.MosslightDirector.terrainPatterns,
  forage: window.MosslightDirector.foragePatterns,
  mushrooms: window.MosslightDirector.mushroomPatterns,
}));
assert(meta.title === 'Sylvaria' && meta.version === '0.11.1', `runtime identity mismatch ${JSON.stringify(meta)}`);
assert(meta.roomCount === 30 && meta.rooms.length === 30, `fixed arena count mismatch ${meta.roomCount}/${meta.rooms.length}`);
assert(meta.rooms[0] === 'Clearing' && meta.rooms[9] === 'Surveyor' && meta.rooms[19] === 'Harvester' && meta.rooms[29] === 'Mulcher', `milestone arena names missing ${JSON.stringify(meta.rooms)}`);
for (const flag of ['resilientMoveQueue','projectilePatternReadability','evasiveEnemyCues','counterRouting','terrainReadability','symmetricTerrainRules','destructibleFoliage','environmentalDiscovery','symmetricSporeHazards','ecologicalSynergy','hazardAwareAI','threatPriority','returnEcology','gasShear','expandedArenas','minimalPresentation','deterministicReplay']) assert(meta.visual?.[flag], `visual contract missing ${flag}`);
for (const pattern of ['straight','zigzag','wave','spiral','swerve','wobble','return','return-ecology']) assert(meta.projectiles.includes(pattern), `projectile registry missing ${pattern}`);
for (const type of ['ice','mud','sand','water','bramble','grass','shards']) assert(meta.terrain.includes(type), `terrain registry missing ${type}`);
for (const type of ['heartleaf','rushResin','barkguard','edgeStone','flowSap']) assert(meta.forage.includes(type), `field-effect registry missing ${type}`);
for (const type of ['heartcap','swiftcap','guardcap','edgecap','venomcap','ghostcap']) assert(meta.mushrooms.includes(type), `mushroom registry missing ${type}`);
await page.screenshot({ path: path.join(outputDir, 'v0111-title.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await focus();

// 1. Single dash distance and persistent D -> S queue.
await cleanLab(1); await focus();
let before = await snap();
await page.keyboard.press('d');
await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player?.dashing, null, { timeout: 700 });
let after = await snap();
const tapDistance = after.player.x - before.player.x;
assert(tapDistance >= 38 && tapDistance <= 62, `clean D dash drifted from ~48px: ${tapDistance.toFixed(1)}`);
assert(after.stats.dashes === before.stats.dashes + 1, 'single D must create exactly one dash');

await cleanLab(1); await focus(); before = await snap();
await page.keyboard.press('d'); await page.waitForTimeout(25); await page.keyboard.press('s');
const queueProbe = await snap();
assert(queueProbe.player.bufferedMove === 's' || queueProbe.stats.dashes >= before.stats.dashes + 2, `S did not enter persistent queue: ${JSON.stringify(queueProbe.player)}`);
await page.waitForFunction(({ dashes, y }) => { const s = window.__MOSSLIGHT_PLAYTEST__.snapshot(); return s.stats.dashes >= dashes + 2 && !s.player.dashing && !s.player.bufferedMove && s.player.y > y + 32; }, { dashes: before.stats.dashes, y: before.player.y }, { timeout: 1400 });
after = await snap();
assert(after.player.x > before.player.x + 32 && after.player.y > before.player.y + 32, 'queued east/south commitments did not both resolve');
assert(!after.player.bufferedMove, 'movement queue did not drain');

// 2. Held movement repeats only as discrete game-timed dashes.
await cleanLab(1); await focus(); before = await snap();
await page.keyboard.down('d'); await page.waitForTimeout(580); await page.keyboard.up('d'); await page.waitForTimeout(150); after = await snap();
assert(after.stats.dashes - before.stats.dashes >= 3, 'held D should repeat discrete game-timed dashes');
assert(after.player.x > before.player.x + 100, 'held D traversal was too small');

// 3. Every actual arrival side and every nonlinear family remains reflectable.
const keyFor = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' };
for (const direction of Object.keys(keyFor)) {
  await cleanLab(2);
  await page.evaluate((dir) => window.__MOSSLIGHT_PLAYTEST__.spawnCounterShot(dir), direction);
  await focus(); before = await snap(); await page.waitForTimeout(50); await page.keyboard.press(keyFor[direction]); await page.waitForTimeout(100); after = await snap();
  assert(after.stats.counters > before.stats.counters, `${direction} arrival-side reflect failed`);
}
for (const pattern of ['zigzag','spiral','swerve','wobble']) {
  await cleanLab(2);
  await page.evaluate((p) => window.__MOSSLIGHT_PLAYTEST__.firePattern(p,'right',88), pattern);
  await focus(); before = await snap();
  assert(before.shots[0]?.pattern === pattern, `${pattern} family missing before reflect`);
  await page.waitForTimeout(35); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); after = await snap();
  assert(after.stats.counters > before.stats.counters, `${pattern} shot was not reflectable from its actual arrival side`);
}

// 4. Normal return, Crosscut, terrain routing, Long Return, perfect 1040 and penetration.
await cleanLab(2);
await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;
  p.setPlayerPosition(190,320); p.placeTerrain('bramble',535,320,28);
  p.spawnTestEnemy('foreman',760,320,'source-foreman'); p.spawnTestEnemy('surveyor',500,320,'cross-target');
  const target=G.state.enemies.find((enemy)=>enemy.id==='cross-target'); target.state='recover'; target.counterStagger=2; target.clock=2;
  p.spawnCounterShot('right',82,{ownerId:'source-foreman',speed:245});
});
await focus(); await page.waitForTimeout(40); before = await snap(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(35); let mid = await snap();
const returned = mid.shots.find((shot) => shot.friendly);
assert(returned && returned.speed >= 800 && returned.speed < 1000 && returned.pattern === 'return', `normal 840 return invalid ${JSON.stringify(returned)}`);
assert(returned?.counterTargetId === 'cross-target', `return assist missed cross-target ${returned?.counterTargetId}`);
await page.waitForTimeout(360); after = await snap();
assert(after.stats.crosscuts >= 1, 'reflected cross-target hit did not award Crosscut');
assert(after.stats.terrainRoutes >= 1, 'reflected knockback did not route target into brambles');

await cleanLab(2);
await page.evaluate(() => { const p=window.__MOSSLIGHT_PLAYTEST__; p.setPlayerPosition(175,320); p.spawnTestEnemy('foreman',790,320,'long-source'); p.spawnCounterShot('right',82,{ownerId:'long-source',speed:245}); });
await focus(); await page.waitForTimeout(40); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700); after=await snap();
assert(after.stats.longReturns >= 1, 'long-distance reflected hit did not award Long Return');

await cleanLab(2);
await page.evaluate(() => { const p=window.__MOSSLIGHT_PLAYTEST__; p.setPlayerPosition(190,320); p.spawnTestEnemy('foreman',760,320,'perfect-source'); p.spawnCounterShot('right',68,{ownerId:'perfect-source',speed:180}); });
await focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(20); mid=await snap();
const perfect = mid.shots.find((shot) => shot.friendly);
assert(perfect?.speed >= 1000 && perfect?.speed <= 1080, `perfect return should remain ~1040px/s: ${perfect?.speed}`);
assert(perfect?.pierces === 1, `perfect return lost penetration charge: ${perfect?.pierces}`);

// 5. Shared terrain physics: enemy mud drag and player mud commitment.
const groundTravel = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.labEnemyTravel('feller','ground',.30));
const mudTravel = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.labEnemyTravel('feller','mud',.30));
assert(groundTravel.distance > 10, `ground enemy fixture barely moved: ${groundTravel.distance}`);
assert(mudTravel.distance < groundTravel.distance * .68, `shared mud drag failed: ground ${groundTravel.distance.toFixed(2)} vs mud ${mudTravel.distance.toFixed(2)}`);

await cleanLab(1); await api('setPlayerPosition',[220,320]); before=await snap(); await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d')); await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player.dashing); after=await snap(); const groundDash=after.player.x-before.player.x;
await cleanLab(1); await api('setPlayerPosition',[220,320]); await api('placeTerrain',['mud',220,320,80]); before=await snap(); await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d')); await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player.dashing); after=await snap(); const mudDash=after.player.x-before.player.x;
assert(mudDash < groundDash*.82, `player mud commitment not reduced: ground ${groundDash.toFixed(1)} vs mud ${mudDash.toFixed(1)}`);

// 6. Dash-cut ice fracture creates active shards and removes the source ice.
await cleanLab(5); await api('setPlayerPosition',[220,320]); await api('placeTerrain',['ice',252,320,34]); before=await snap();
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.dash('right')); await page.waitForTimeout(25); await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(180); after=await snap();
assert(after.stats.iceFractures > before.stats.iceFractures, 'live dash-cut did not record ice fracture');
assert(after.terrain.some((patch) => patch.type === 'shards' && patch.active), 'live dash-cut did not transform ice into shards');
assert(after.terrain.some((patch) => patch.type === 'ice' && !patch.active), 'source ice remained active after fracture');

// 7. Evasive units can blink on safe ground but jam on mud.
await cleanLab(7); let evadeStart=await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceEvade('surveyor',80)); let e0=evadeStart.enemies[0];
assert(e0?.evading && e0.intent?.kind==='evade','Surveyor did not telegraph safe-ground blink'); await page.waitForTimeout(340); let e1=(await snap()).enemies[0];
assert(e1&&Math.hypot(e1.x-e0.x,e1.y-e0.y)>=38,'Surveyor blink separation too small');
await cleanLab(7); await api('setPlayerPosition',[220,320]); await api('placeTerrain',['mud',300,320,95]); before=await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceEvade('surveyor',80));
assert(!before.enemies[0]?.evading && before.enemies[0]?.counterStagger>0,'mud did not jam Surveyor escape');

// 8. Grass, deadwood, and brittle rubble remain interactive exploration geometry.
await setRoom(1); await api('clearCombatants'); let s=await snap(); const blade=s.foliage.find((item)=>!item.cut); assert(Boolean(blade),'room 1 has no grass blade');
if(blade){await api('setPlayerPosition',[blade.x-22,blade.y]); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(180); after=await snap(); assert(after.stats.grassCut>s.stats.grassCut,'machete did not cut tall grass');}
await setRoom(2); await api('clearCombatants'); s=await snap(); const log=s.debris.find((item)=>!item.dead); assert(Boolean(log),'room 2 has no deadwood');
if(log){await api('setPlayerPosition',[log.x-25,log.y]); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); after=await snap(); assert(after.debris.find((item)=>item.id===log.id)?.dead,'two cuts did not open deadwood');}
await setRoom(8); await api('clearCombatants'); s=await snap(); const rubble=s.brittle.find((item)=>!item.dead); assert(Boolean(rubble),'room 8 has no brittle rubble');
if(rubble){await api('setPlayerPosition',[rubble.x-25,rubble.y]); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.cut('right')); await page.waitForTimeout(210); after=await snap(); assert(after.brittle.find((item)=>item.id===rubble.id)?.dead,'two cuts did not reshape brittle rubble'); assert(after.stats.brittleBroken>0,'rubble break not recorded');}

// 9. Safe mushrooms still map to heal/speed/shield/reach field effects.
await cleanLab(3);
await page.evaluate(() => { const p=window.__MOSSLIGHT_PLAYTEST__; p.setPlayerPosition(220,320); p.damagePlayer(1); });
for (const [type,kind] of [['heartcap','heal'],['swiftcap','speed'],['guardcap','shield'],['edgecap','reach']]) {
  const placed=await page.evaluate((mushroomType)=>window.__MOSSLIGHT_PLAYTEST__.placeMushroom(mushroomType,230,320),type); const mushroom=placed.mushrooms.at(-1);
  await page.evaluate((id)=>window.__MOSSLIGHT_PLAYTEST__.triggerMushroom(id),mushroom.id); await page.waitForTimeout(80); after=await snap();
  if(kind==='heal') assert(after.player.hp>=5,'heal mushroom did not restore health');
  if(kind==='speed') assert(after.player.buffs.rush>0,'speed mushroom did not grant speed state');
  if(kind==='shield') assert(after.player.shieldCharges>0,'shield mushroom did not grant shield');
  if(kind==='reach') assert(after.player.buffs.edge>0,'reach mushroom did not grant reach state');
}

// 10. Poison is symmetric, and centralized hazard bookkeeping handles enemy and boss deaths/phases.
await cleanLab(4);
const gasFixture=await page.evaluate(() => { const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091; p.spawnTestEnemy('feller',320,320,'gas-target'); p.placeMushroom('venomcap',320,320); const m=G.state.mushrooms.at(-1); const e=G.state.enemies.find((enemy)=>enemy.id==='gas-target'); const hp=e.hp; p.triggerMushroom(m.id); return{hp,id:e.id}; });
await page.waitForTimeout(650); after=await snap(); const gasEnemy=after.enemies.find((enemy)=>enemy.id===gasFixture.id); assert(gasEnemy&&gasEnemy.hp<gasFixture.hp,`poison gas did not damage enemy: ${gasFixture.hp} -> ${gasEnemy?.hp}`);

await cleanLab(4); const enemyKillBefore=await snap(); const hazardEnemyId=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.spawnTestEnemy('feller',400,320,'hazard-kill')); await page.evaluate((id)=>window.__MOSSLIGHT_PLAYTEST__.applyHazardToEnemy(id,99),hazardEnemyId); after=await snap();
assert(after.stats.kills===enemyKillBefore.stats.kills+1,'hazard enemy kill did not increment kills');
assert(after.stats.hazardKills===enemyKillBefore.stats.hazardKills+1,'hazard enemy kill did not increment hazardKills');

await setRoom(10); before=await snap(); const bossMax=before.boss.maxHp; await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.applyHazardToBoss(20)); after=await snap();
assert(after.boss.phase>=2 && after.boss.hp<bossMax*.66,`hazard boss damage did not cross phase threshold: ${after.boss.hp}/${bossMax} P${after.boss.phase}`);
const bossKillBefore={kills:after.stats.kills,hazardKills:after.stats.hazardKills}; await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.applyHazardToBoss(999)); after=await snap();
assert(after.boss.dead,'hazard damage did not resolve boss death');
assert(after.stats.kills===bossKillBefore.kills+1,'hazard boss death did not increment kills');
assert(after.stats.hazardKills===bossKillBefore.hazardKills+1,'hazard boss death did not increment hazardKills');

// 11. Deep authored arenas stay deterministic and bounded; projectile performance caps remain intact.
const deepA=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.roomBlueprint(29));
const deepB=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.roomBlueprint(29));
assert(JSON.stringify(deepA)===JSON.stringify(deepB),'authored room 29 blueprint is not deterministic');
assert(deepA.title==='Open Cut'&&deepA.enemies.length<=9,'room 29 authored challenge contract drifted');
await setRoom(29); await page.waitForTimeout(650); const late=await snap();
assert(late.shots.length<=128 && late.pendingShots<=72,`projectile caps violated in late fixed arena: ${late.shots.length}/${late.pendingShots}`);
assert(late.fps>=42,`late fixed arena FPS below 42: ${late.fps.toFixed(1)}`);
await page.screenshot({path:path.join(outputDir,'v0111-open-cut.png'),fullPage:true});
await setRoom(30); await page.waitForTimeout(900); await page.screenshot({path:path.join(outputDir,'v0111-mulcher.png'),fullPage:true});

if(consoleErrors.length) failures.push(...consoleErrors.map((error)=>`console error: ${error}`));
const report={meta,tapDistance,queueProbe,groundTravel,mudTravel,groundDash,mudDash,deepA,late,failures,consoleErrors};
fs.writeFileSync(path.join(outputDir,'report-v0111.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.11.1 mechanics gauntlet failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.11.1 mechanics PASS: protected queue, four-sided/nonlinear reflection, 840/1040 return behavior, Crosscut/Long Return, shared terrain drag, ice fracture, evade safety, destructibles, field effects, symmetric poison, centralized hazard death/phase bookkeeping, authored room 29, projectile caps, and ${late.fps.toFixed(1)} FPS verified.`);