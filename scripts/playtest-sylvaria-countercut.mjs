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
const failures = [];
const consoleErrors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?environmental-resonance-playtest=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.SylvariaVisualSystem) && Boolean(window.SylvariaDisplayScale));

const meta = await page.evaluate(() => ({
  title: window.__MOSSLIGHT_PLAYTEST__.title,
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
  rooms: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
  visualVersion: window.SylvariaVisualSystem.version,
  visual: window.__MOSSLIGHT_PLAYTEST__.snapshot().visual,
  projectilePatterns: window.MosslightDirector?.projectilePatterns,
  movementPatterns: window.MosslightDirector?.movementPatterns,
  terrainPatterns: window.MosslightDirector?.terrainPatterns,
}));
if (meta.title !== 'Sylvaria' || meta.version !== '0.9.0') failures.push(`runtime identity mismatch: ${JSON.stringify(meta)}`);
if (meta.visualVersion !== '0.9.0') failures.push(`visual version mismatch: ${meta.visualVersion}`);
if (meta.roomCount !== 10 || meta.rooms.length !== 10) failures.push(`expected ten authored rooms, got ${meta.roomCount}`);
if (!meta.rooms.includes('PAC-a-Saw Summit')) failures.push('boss room is missing from authored curriculum');
for (const flag of ['backdropCanvas', 'playfieldAspectSafe', 'routeGeometry', 'lockedIntentTelegraphs', 'resilientMoveQueue', 'projectilePatternReadability', 'evasiveEnemyCues', 'counterRouting', 'terrainReadability', 'symmetricTerrainRules', 'cachedTerrainLayer', 'destructibleFoliage', 'combatAnimationStates', 'proceduralSilhouettes']) {
  if (!meta.visual?.[flag]) failures.push(`visual contract missing ${flag}: ${JSON.stringify(meta.visual)}`);
}
for (const pattern of ['straight', 'zigzag', 'wave', 'spiral', 'swerve', 'wobble', 'return']) if (!meta.projectilePatterns?.includes(pattern)) failures.push(`projectile pattern registry missing ${pattern}`);
for (const movement of ['backstep', 'blink-evade', 'terrain-drag', 'ice-glide', 'hazard-route']) if (!meta.movementPatterns?.includes(movement)) failures.push(`movement registry missing ${movement}`);
for (const terrain of ['ice', 'mud', 'sand', 'water', 'bramble', 'grass', 'shards']) if (!meta.terrainPatterns?.includes(terrain)) failures.push(`terrain registry missing ${terrain}`);

await page.screenshot({ path: path.join(outputDir, 'environmental-resonance-v090-title.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await page.locator('#c').focus();

const beforeTap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(190);
const afterTap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const tapDistance = (afterTap.player?.x ?? 0) - (beforeTap.player?.x ?? 0);
if (tapDistance < 38 || tapDistance > 62) failures.push(`single D step should remain roughly 48px on clean footing, got ${tapDistance.toFixed(1)}px`);
if (afterTap.stats.dashes !== beforeTap.stats.dashes + 1) failures.push(`single D press should create exactly one step-dash (${beforeTap.stats.dashes} -> ${afterTap.stats.dashes})`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.locator('#c').focus();
const beforeBuffer = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(25);
await page.keyboard.press('s');
await page.waitForFunction(({ dashes, y }) => { const s = window.__MOSSLIGHT_PLAYTEST__.snapshot(); return s.stats.dashes >= dashes + 2 && (s.player?.y ?? 0) > y + 30 && !s.player?.bufferedMove; }, { dashes: beforeBuffer.stats.dashes, y: beforeBuffer.player?.y ?? 0 }, { timeout: 1200 });
const afterBuffer = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((afterBuffer.player?.x ?? 0) <= (beforeBuffer.player?.x ?? 0) + 32) failures.push('queued first east step did not resolve');
if ((afterBuffer.player?.y ?? 0) <= (beforeBuffer.player?.y ?? 0) + 32) failures.push('queued south step did not resolve after first dash');
if (afterBuffer.player?.bufferedMove) failures.push(`movement queue should drain after execution, got ${afterBuffer.player.bufferedMove}`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.locator('#c').focus();
const beforeHold = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(580);
await page.keyboard.up('d');
await page.waitForTimeout(100);
const afterHold = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (afterHold.stats.dashes - beforeHold.stats.dashes < 3) failures.push('held D should repeat discrete step-dashes');
if ((afterHold.player?.x ?? 0) <= (beforeHold.player?.x ?? 0) + 100) failures.push('held D did not produce meaningful eastward traversal');

await page.evaluate(() => { window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1); window.__MOSSLIGHT_PLAYTEST__.placeDeadwoodAhead('right', 34); });
await page.locator('#c').focus();
const beforeBlocked = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(110);
const blocked = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((blocked.player?.x ?? 0) - (beforeBlocked.player?.x ?? 0) > 12) failures.push('deadwood should stop the dash lane');
if (blocked.stats.blockedSteps <= beforeBlocked.stats.blockedSteps) failures.push('blocked step was not recorded');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(220);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(220);
const chopped = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (!chopped.debris.some((item) => item.dead)) failures.push('two right cuts should chop deadwood');
await page.keyboard.press('d');
await page.waitForTimeout(180);
const clearedLane = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((clearedLane.player?.x ?? 0) <= (chopped.player?.x ?? 0) + 30) failures.push('dash lane did not open after deadwood was chopped');

const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const direction of ['up', 'down', 'left', 'right']) {
  await page.evaluate((dir) => { window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 2); window.__MOSSLIGHT_PLAYTEST__.clearCombatants(); window.__MOSSLIGHT_PLAYTEST__.spawnCounterShot(dir); }, direction);
  await page.locator('#c').focus();
  const before = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  await page.waitForTimeout(55);
  await page.keyboard.press(keyFor[direction]);
  await page.waitForTimeout(110);
  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (after.stats.counters <= before.stats.counters) failures.push(`${direction} machete cut failed to counter matching projectile`);
}

for (const pattern of ['zigzag', 'spiral', 'swerve', 'wobble']) {
  await page.evaluate((projectilePattern) => { window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 2); window.__MOSSLIGHT_PLAYTEST__.clearCombatants(); window.__MOSSLIGHT_PLAYTEST__.firePattern(projectilePattern, 'right', 88); }, pattern);
  await page.locator('#c').focus();
  const before = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (before.shots[0]?.pattern !== pattern) failures.push(`${pattern} projectile did not retain its hostile path family`);
  await page.waitForTimeout(35);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(90);
  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (after.stats.counters <= before.stats.counters) failures.push(`${pattern} projectile was not counterable by arrival side`);
}

await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(1, 2); p.clearCombatants(); p.setPlayerPosition(190, 320);
  p.spawnTestEnemy('foreman', 760, 320, 'source-foreman');
  p.spawnTestEnemy('surveyor', 505, 320, 'cross-target');
  p.spawnCounterShot('right', 82, { ownerId: 'source-foreman', speed: 245 });
});
await page.locator('#c').focus();
await page.waitForTimeout(40);
const beforeCrosscut = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(35);
const returned = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const friendlyReturn = returned.shots.find((shot) => shot.friendly);
if (!friendlyReturn) failures.push('successful counter did not create a friendly return projectile');
else {
  if (friendlyReturn.speed < 800) failures.push(`normal return should exceed 800px/s, got ${friendlyReturn.speed.toFixed(1)}`);
  if (friendlyReturn.pattern !== 'return') failures.push(`counter should normalize hostile motion, got ${friendlyReturn.pattern}`);
  if (friendlyReturn.counterTargetId !== 'cross-target') failures.push(`return assist should select nearer cross-target, got ${friendlyReturn.counterTargetId}`);
}
await page.waitForTimeout(330);
const crosscut = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (crosscut.stats.crosscuts < 1) failures.push('cross-target reflected hit did not award a Crosscut');
if (!crosscut.enemies.find((enemy) => enemy.id === 'cross-target')?.counterStagger) failures.push('returned shot should stagger an evasive cross-target');

await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(1, 2); p.clearCombatants(); p.setPlayerPosition(175, 320); p.spawnTestEnemy('foreman', 790, 320, 'long-source'); p.spawnCounterShot('right', 82, { ownerId: 'long-source', speed: 245 }); });
await page.locator('#c').focus(); await page.waitForTimeout(40); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
const longReturn = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (longReturn.stats.longReturns < 1) failures.push('long-distance reflected hit did not award a Long Return');

await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(1, 2); p.clearCombatants(); p.setPlayerPosition(190, 320); p.spawnTestEnemy('foreman', 760, 320, 'perfect-source'); p.spawnCounterShot('right', 68, { ownerId: 'perfect-source', speed: 180 }); });
await page.locator('#c').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(20);
const perfectReturn = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const perfectShot = perfectReturn.shots.find((shot) => shot.friendly);
if (!perfectShot || perfectShot.speed < 1000) failures.push(`perfect return should exceed 1000px/s, got ${perfectShot?.speed ?? 'no shot'}`);
if (perfectShot && perfectShot.pierces !== 1) failures.push(`perfect return should begin with one penetration charge, got ${perfectShot.pierces}`);

for (const type of ['surveyor', 'foreman']) {
  const evadeStart = await page.evaluate((enemyType) => window.__MOSSLIGHT_PLAYTEST__.forceEvade(enemyType, 80), type);
  const startEnemy = evadeStart.enemies[0];
  if (!startEnemy?.evading || startEnemy.intent?.kind !== 'evade') failures.push(`${type} did not expose an evade destination cue`);
  await page.waitForTimeout(340);
  const evadeEnd = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  const endEnemy = evadeEnd.enemies[0];
  if (!endEnemy || Math.hypot(endEnemy.x - startEnemy.x, endEnemy.y - startEnemy.y) < 38) failures.push(`${type} evade did not create meaningful separation`);
}

await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.forceEvade('feller', 400); p.clearCombatants(); p.setPlayerPosition(108, 320); });
const groundStart = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (groundStart.player?.surface !== 'ground') failures.push(`room-one spawn should be clean ground for baseline, got ${groundStart.player?.surface}`);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d'));
await page.waitForTimeout(220);
const groundEnd = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const groundDash = (groundEnd.player?.x ?? 0) - (groundStart.player?.x ?? 0);

await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.forceEvade('feller', 400); p.clearCombatants(); p.setPlayerPosition(108, 320); p.placeTerrain('mud', 108, 320, 78); });
const mudStart = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (mudStart.player?.surface !== 'mud') failures.push(`placed mud should register under Sprid, got ${mudStart.player?.surface}`);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d'));
await page.waitForTimeout(220);
const mudEnd = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const mudDash = (mudEnd.player?.x ?? 0) - (mudStart.player?.x ?? 0);
if (!(mudDash < groundDash * .82)) failures.push(`mud should substantially shorten committed dash: ground ${groundDash.toFixed(1)} vs mud ${mudDash.toFixed(1)}`);

async function setupFellerSurface(withMud) {
  return page.evaluate((mud) => {
    const p = window.__MOSSLIGHT_PLAYTEST__;
    p.setRoom(0, 1); p.setPlayerPosition(190, 320); const snap = p.forceEvade('feller', 300); const id = snap.enemies[0]?.id;
    const candidates = [[500, 320], [560, 220], [560, 420], [650, 320], [420, 180]];
    let chosen = candidates[0];
    for (const [x, y] of candidates) { const s = p.setEnemyPosition(id, x, y); if (s.enemies.find((enemy) => enemy.id === id)?.surface === 'ground') { chosen = [x, y]; break; } }
    p.setEnemyPosition(id, chosen[0], chosen[1]); if (mud) p.placeTerrain('mud', chosen[0], chosen[1], 82); return { id, chosen, snap: p.snapshot() };
  }, withMud);
}
const groundEnemySetup = await setupFellerSurface(false);
const groundEnemyStart = groundEnemySetup.snap.enemies.find((enemy) => enemy.id === groundEnemySetup.id);
if (groundEnemyStart?.surface !== 'ground') failures.push(`enemy ground baseline was not clean: ${groundEnemyStart?.surface}`);
await page.waitForTimeout(620);
const groundEnemyEnd = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const ge = groundEnemyEnd.enemies.find((enemy) => enemy.id === groundEnemySetup.id);
const groundEnemyTravel = ge && groundEnemyStart ? Math.hypot(ge.x - groundEnemyStart.x, ge.y - groundEnemyStart.y) : 0;

const mudEnemySetup = await setupFellerSurface(true);
const mudEnemyStart = mudEnemySetup.snap.enemies.find((enemy) => enemy.id === mudEnemySetup.id);
if (mudEnemyStart?.surface !== 'mud') failures.push(`same mud should register under enemy, got ${mudEnemyStart?.surface}`);
await page.waitForTimeout(620);
const mudEnemyEnd = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const me = mudEnemyEnd.enemies.find((enemy) => enemy.id === mudEnemySetup.id);
const mudEnemyTravel = me && mudEnemyStart ? Math.hypot(me.x - mudEnemyStart.x, me.y - mudEnemyStart.y) : 0;
if (!(mudEnemyTravel < groundEnemyTravel * .78)) failures.push(`shared mud drag did not slow enemy enough: ground ${groundEnemyTravel.toFixed(2)} vs mud ${mudEnemyTravel.toFixed(2)}`);

const jammed = await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(6, 7); p.setPlayerPosition(190, 320); p.placeTerrain('mud', 270, 320, 130); return p.forceEvade('surveyor', 80); });
const jammedSurveyor = jammed.enemies[0];
if (!jammedSurveyor || jammedSurveyor.pattern !== 'recover' || jammedSurveyor.evading) failures.push(`mud pocket should jam Surveyor blink into recovery: ${JSON.stringify(jammedSurveyor)}`);
if (jammed.stats.terrainRoutes < 1) failures.push('jammed evade should count as a terrain route');

const grassSetup = await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.clearCombatants(); const s = p.snapshot(); const blade = s.foliage.find((item) => !item.cut); if (!blade) return null; p.setPlayerPosition(blade.x - 44, blade.y); return { blade, before: p.snapshot() }; });
if (!grassSetup) failures.push('authored room one did not generate cuttable tall grass');
else {
  await page.locator('#c').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
  const afterGrass = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (afterGrass.stats.grassCut <= grassSetup.before.stats.grassCut) failures.push('machete cut did not remove generated tall grass');
}

const brittleSetup = await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(7, 8); p.clearCombatants(); const s = p.snapshot(); const barrier = s.brittle.find((item) => !item.dead); if (!barrier) return null; p.setPlayerPosition(barrier.x - 44, barrier.y); return { id: barrier.id, before: p.snapshot() }; });
if (!brittleSetup) failures.push('room eight did not generate a brittle route barrier');
else {
  await page.locator('#c').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(220); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120);
  const afterBrittle = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (!afterBrittle.brittle.find((item) => item.id === brittleSetup.id)?.dead) failures.push('two machete cuts did not open brittle route barrier');
  if (afterBrittle.stats.brittleBroken <= brittleSetup.before.stats.brittleBroken) failures.push('brittle route opening was not recorded');
}

const iceSetup = await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(4, 5); p.forceEvade('feller', 400); p.clearCombatants(); const s = p.snapshot(); const ice = s.terrain.find((patch) => patch.type === 'ice'); if (!ice) return null;
  p.setPlayerPosition(ice.x - 34, ice.y); p.requestDash('d'); p.cut('right'); return { id: ice.id, before: p.snapshot() };
});
if (!iceSetup) failures.push('room five did not generate an ice patch');
else {
  await page.waitForTimeout(70);
  const afterIce = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  const transformed = afterIce.terrain.find((patch) => patch.id === iceSetup.id);
  if (transformed?.type !== 'shards') failures.push(`contextual dash-cut did not fracture ice: ${JSON.stringify(transformed)}`);
  if (afterIce.stats.iceFractures <= iceSetup.before.stats.iceFractures) failures.push('ice fracture was not recorded');
}

await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(6, 7); p.forceEvade('feller', 400); p.clearCombatants(); p.setPlayerPosition(190, 320);
  p.placeTerrain('bramble', 520, 320, 45);
  p.spawnTestEnemy('foreman', 780, 320, 'hazard-source');
  p.spawnTestEnemy('surveyor', 468, 320, 'hazard-target');
  p.spawnCounterShot('right', 82, { ownerId: 'hazard-source', speed: 245 });
});
await page.locator('#c').focus(); await page.waitForTimeout(40);
const beforeHazardRoute = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(380);
const afterHazardRoute = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (afterHazardRoute.stats.terrainRoutes <= beforeHazardRoute.stats.terrainRoutes) failures.push('reflected knockback did not award a TERRAIN ROUTE into brambles');
if (afterHazardRoute.stats.hazardHits <= beforeHazardRoute.stats.hazardHits) failures.push('bramble-routed enemy did not receive symmetric hazard effect');

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(8, 9));
await page.locator('#c').focus();
const beforeOverlap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d'); await page.waitForTimeout(35); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(240); await page.keyboard.up('d');
const afterOverlap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (afterOverlap.stats.dashes <= beforeOverlap.stats.dashes) failures.push('dash+cut overlap did not register a dash');
if (afterOverlap.stats.cuts <= beforeOverlap.stats.cuts) failures.push('dash+cut overlap did not register an independent cut');

await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.damagePlayer(2); p.completeRoom(); });
const wounded = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (wounded.player?.hp !== 3) failures.push(`damage setup expected 3 HP, got ${wounded.player?.hp}`);
const carried = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.advance());
if (carried.player?.hp !== 4) failures.push(`Perfect Grove should heal one heartwood after carrying damage, got ${carried.player?.hp}`);
if (carried.stats.fullGroves < 1) failures.push('Perfect Grove completion was not tracked');

const dashCurve = [];
for (const depth of [1, 5, 10, 14, 30]) {
  const snap = await page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 10, d), depth);
  dashCurve.push([depth, snap.player.dashDistance]);
}
for (let i = 1; i < dashCurve.length; i += 1) if (dashCurve[i][1] < dashCurve[i - 1][1]) failures.push(`dash progression regressed: ${JSON.stringify(dashCurve)}`);
if (dashCurve.at(-1)?.[1] <= dashCurve[0][1]) failures.push(`deep-run dash should grow beyond room one: ${JSON.stringify(dashCurve)}`);

const deepBlueprints = await page.evaluate(() => [window.__MOSSLIGHT_PLAYTEST__.roomBlueprint(22), window.__MOSSLIGHT_PLAYTEST__.roomBlueprint(22)]);
if (JSON.stringify(deepBlueprints[0]) !== JSON.stringify(deepBlueprints[1])) failures.push('roomBlueprint(22) is not deterministic');
if (!Array.isArray(deepBlueprints[0]?.terrain) || deepBlueprints[0].terrain.length < 2) failures.push('deep room blueprint did not include bounded deterministic terrain mix');
const deep = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 22));
if (deep.enemies.length < 4) failures.push(`deep room should spawn at least four enemies, got ${deep.enemies.length}`);
if (deep.trees.length < 7) failures.push(`deep room should retain grove objectives, got ${deep.trees.length}`);
if (deep.terrain.length < 2) failures.push(`deep room should expose terrain patches, got ${deep.terrain.length}`);
if (deep.shots.length > 128 || deep.pendingShots > 72) failures.push('projectile caps exceeded in deep room setup');

const bossStart = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(9, 10));
if (bossStart.boss?.phase !== 1) failures.push(`boss should begin in phase 1, got ${bossStart.boss?.phase}`);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceBossPhase(2));
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().boss?.vulnerable === true, null, { timeout: 1800 });
const bossOpen = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (bossOpen.boss?.state !== 'recover') failures.push(`PAC-a-Saw did not expose recover window: ${bossOpen.boss?.state}`);

await page.locator('#c').focus(); await page.keyboard.press('p'); await page.waitForTimeout(40);
let paused = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (paused.mode !== 'paused') failures.push(`P did not pause runtime: ${paused.mode}`);
await page.keyboard.press('p'); await page.waitForTimeout(40);
paused = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (paused.mode !== 'playing') failures.push(`P did not resume runtime: ${paused.mode}`);

await page.waitForTimeout(950);
const finalSnap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (finalSnap.fps < 42) failures.push(`settled headless FPS below 42: ${finalSnap.fps.toFixed(1)}`);
if (finalSnap.shots.length > 128 || finalSnap.pendingShots > 72) failures.push(`projectile caps exceeded: ${finalSnap.shots.length}/${finalSnap.pendingShots}`);

await page.screenshot({ path: path.join(outputDir, 'environmental-resonance-v090-playtest.png') });
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ meta, groundDash, mudDash, groundEnemyTravel, mudEnemyTravel, dashCurve, final: finalSnap, failures, consoleErrors }, null, 2));
await browser.close();

if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));
if (failures.length) {
  console.error(`Sylvaria Environmental Resonance playtest failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Sylvaria Environmental Resonance v0.9.0 playtest PASS: queue + four-way Countercut + nonlinear returns + Crosscuts/Long Returns + shared mud drag + evade jamming + grass chopping + brittle routes + ice fracture + bramble Countercut routing + boss recovery + deterministic deep terrain + FPS ${finalSnap.fps.toFixed(1)}.`);
