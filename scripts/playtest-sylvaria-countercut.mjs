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

const snap = () => page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const focus = () => page.locator('#c').focus();
const reset = (depth = 1) => page.evaluate((d) => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom((d - 1) % 10, d);
  p.clearCombatants();
  return p.snapshot();
}, depth);

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
for (const flag of ['backdropCanvas', 'playfieldAspectSafe', 'routeGeometry', 'lockedIntentTelegraphs', 'resilientMoveQueue', 'projectilePatternReadability', 'evasiveEnemyCues', 'counterRouting', 'terrainReadability', 'symmetricTerrainRules', 'cachedTerrainLayer', 'destructibleFoliage', 'combatAnimationStates', 'proceduralSilhouettes']) if (!meta.visual?.[flag]) failures.push(`visual contract missing ${flag}`);
for (const pattern of ['straight', 'zigzag', 'wave', 'spiral', 'swerve', 'wobble', 'return']) if (!meta.projectilePatterns?.includes(pattern)) failures.push(`projectile pattern registry missing ${pattern}`);
for (const movement of ['backstep', 'blink-evade', 'terrain-drag', 'ice-glide', 'hazard-route']) if (!meta.movementPatterns?.includes(movement)) failures.push(`movement registry missing ${movement}`);
for (const terrain of ['ice', 'mud', 'sand', 'water', 'bramble', 'grass', 'shards']) if (!meta.terrainPatterns?.includes(terrain)) failures.push(`terrain registry missing ${terrain}`);

await page.screenshot({ path: path.join(outputDir, 'environmental-resonance-v090-title.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await focus();

// Clean-footing movement baseline.
const beforeTap = await snap();
await page.keyboard.press('d');
await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player?.dashing, null, { timeout: 600 });
const afterTap = await snap();
const tapDistance = (afterTap.player?.x ?? 0) - (beforeTap.player?.x ?? 0);
if (tapDistance < 38 || tapDistance > 62) failures.push(`single D step should remain roughly 48px on clean footing, got ${tapDistance.toFixed(1)}px`);
if (afterTap.stats.dashes !== beforeTap.stats.dashes + 1) failures.push(`single D press should create exactly one step-dash (${beforeTap.stats.dashes} -> ${afterTap.stats.dashes})`);

// Persistent queue regression gate. Crucially, wait for the second committed dash to finish,
// not merely for Sprid to cross an arbitrary mid-dash displacement threshold.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await focus();
const beforeBuffer = await snap();
await page.keyboard.press('d');
await page.waitForTimeout(25);
await page.keyboard.press('s');
const queueProbe = await snap();
if (queueProbe.player?.bufferedMove !== 's' && queueProbe.stats.dashes < beforeBuffer.stats.dashes + 2) failures.push(`south input did not enter persistent queue: ${JSON.stringify(queueProbe.player)}`);
await page.waitForFunction(({ dashes, y }) => {
  const s = window.__MOSSLIGHT_PLAYTEST__.snapshot();
  return s.stats.dashes >= dashes + 2 && !s.player?.dashing && !s.player?.bufferedMove && (s.player?.y ?? 0) > y + 32;
}, { dashes: beforeBuffer.stats.dashes, y: beforeBuffer.player?.y ?? 0 }, { timeout: 1400 });
const afterBuffer = await snap();
if ((afterBuffer.player?.x ?? 0) <= (beforeBuffer.player?.x ?? 0) + 32) failures.push('queued first east step did not resolve');
if ((afterBuffer.player?.y ?? 0) <= (beforeBuffer.player?.y ?? 0) + 32) failures.push('queued south step did not fully resolve after first dash');
if (afterBuffer.player?.bufferedMove) failures.push(`movement queue should drain after execution, got ${afterBuffer.player.bufferedMove}`);

// Held movement remains discrete and game-timed.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await focus();
const beforeHold = await snap();
await page.keyboard.down('d');
await page.waitForTimeout(580);
await page.keyboard.up('d');
await page.waitForTimeout(120);
const afterHold = await snap();
if (afterHold.stats.dashes - beforeHold.stats.dashes < 3) failures.push('held D should repeat discrete step-dashes');
if ((afterHold.player?.x ?? 0) <= (beforeHold.player?.x ?? 0) + 100) failures.push('held D did not produce meaningful eastward traversal');

// Deadwood still gates routes until two cuts open the lane.
await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.placeDeadwoodAhead('right', 34); });
await focus();
const beforeBlocked = await snap();
await page.keyboard.press('d');
await page.waitForTimeout(120);
const blocked = await snap();
if ((blocked.player?.x ?? 0) - (beforeBlocked.player?.x ?? 0) > 12) failures.push('deadwood should stop the dash lane');
if (blocked.stats.blockedSteps <= beforeBlocked.stats.blockedSteps) failures.push('blocked step was not recorded');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(220);
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(220);
const chopped = await snap();
if (!chopped.debris.some((item) => item.dead)) failures.push('two right cuts should chop deadwood');
await page.keyboard.press('d'); await page.waitForTimeout(190);
const clearedLane = await snap();
if ((clearedLane.player?.x ?? 0) <= (chopped.player?.x ?? 0) + 30) failures.push('dash lane did not open after deadwood was chopped');

// Four cardinal counters.
const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const direction of Object.keys(keyFor)) {
  await page.evaluate((dir) => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(1, 2); p.clearCombatants(); p.spawnCounterShot(dir); }, direction);
  await focus();
  const before = await snap();
  await page.waitForTimeout(55);
  await page.keyboard.press(keyFor[direction]);
  await page.waitForTimeout(110);
  const after = await snap();
  if (after.stats.counters <= before.stats.counters) failures.push(`${direction} machete cut failed to counter matching projectile`);
}

// Nonlinear bullets keep their pattern but remain counterable by actual arrival side.
for (const pattern of ['zigzag', 'spiral', 'swerve', 'wobble']) {
  await page.evaluate((projectilePattern) => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(1, 2); p.clearCombatants(); p.firePattern(projectilePattern, 'right', 88); }, pattern);
  await focus();
  const before = await snap();
  if (before.shots[0]?.pattern !== pattern) failures.push(`${pattern} projectile did not retain its hostile path family`);
  await page.waitForTimeout(35);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(90);
  const after = await snap();
  if (after.stats.counters <= before.stats.counters) failures.push(`${pattern} projectile was not counterable by arrival side`);
}

// Counter-routing prefers a nearer cross-target, accelerates, and staggers it.
await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(1, 2); p.clearCombatants(); p.setPlayerPosition(190, 320);
  p.spawnTestEnemy('foreman', 760, 320, 'source-foreman');
  p.spawnTestEnemy('surveyor', 505, 320, 'cross-target');
  p.spawnCounterShot('right', 82, { ownerId: 'source-foreman', speed: 245 });
});
await focus(); await page.waitForTimeout(40);
const beforeCrosscut = await snap();
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(35);
const returned = await snap();
const friendlyReturn = returned.shots.find((shot) => shot.friendly);
if (!friendlyReturn) failures.push('successful counter did not create a friendly return projectile');
else {
  if (friendlyReturn.speed < 800) failures.push(`normal return should exceed 800px/s, got ${friendlyReturn.speed.toFixed(1)}`);
  if (friendlyReturn.pattern !== 'return') failures.push(`counter should normalize hostile motion, got ${friendlyReturn.pattern}`);
  if (friendlyReturn.counterTargetId !== 'cross-target') failures.push(`return assist should select nearer cross-target, got ${friendlyReturn.counterTargetId}`);
}
await page.waitForTimeout(330);
const crosscut = await snap();
if (crosscut.stats.crosscuts < 1) failures.push('cross-target reflected hit did not award a Crosscut');
if (!crosscut.enemies.find((enemy) => enemy.id === 'cross-target')?.counterStagger) failures.push('returned shot should stagger an evasive cross-target');

// Long and perfect returns.
await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(1, 2); p.clearCombatants(); p.setPlayerPosition(175, 320); p.spawnTestEnemy('foreman', 790, 320, 'long-source'); p.spawnCounterShot('right', 82, { ownerId: 'long-source', speed: 245 }); });
await focus(); await page.waitForTimeout(40); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
if ((await snap()).stats.longReturns < 1) failures.push('long-distance reflected hit did not award a Long Return');

await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(1, 2); p.clearCombatants(); p.setPlayerPosition(190, 320); p.spawnTestEnemy('foreman', 760, 320, 'perfect-source'); p.spawnCounterShot('right', 68, { ownerId: 'perfect-source', speed: 180 }); });
await focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(20);
const perfectShot = (await snap()).shots.find((shot) => shot.friendly);
if (!perfectShot || perfectShot.speed < 1000) failures.push(`perfect return should exceed 1000px/s, got ${perfectShot?.speed ?? 'no shot'}`);
if (perfectShot && perfectShot.pierces !== 1) failures.push(`perfect return should begin with one penetration charge, got ${perfectShot.pierces}`);

// Safe-ground evasions still create meaningful separation.
for (const type of ['surveyor', 'foreman']) {
  const evadeStart = await page.evaluate((enemyType) => window.__MOSSLIGHT_PLAYTEST__.forceEvade(enemyType, 80), type);
  const startEnemy = evadeStart.enemies[0];
  if (!startEnemy?.evading || startEnemy.intent?.kind !== 'evade') failures.push(`${type} did not expose an evade destination cue`);
  await page.waitForTimeout(340);
  const endEnemy = (await snap()).enemies[0];
  if (!endEnemy || Math.hypot(endEnemy.x - startEnemy.x, endEnemy.y - startEnemy.y) < 38) failures.push(`${type} evade did not create meaningful separation`);
}

// Shared terrain physics: mud changes actual player commitment.
await reset(1);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setPlayerPosition(108, 320));
const groundStart = await snap();
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d'));
await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player?.dashing, null, { timeout: 600 });
const groundEnd = await snap();
const groundDash = (groundEnd.player?.x ?? 0) - (groundStart.player?.x ?? 0);

await reset(1);
await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setPlayerPosition(108, 320); p.placeTerrain('mud', 108, 320, 78); });
const mudStart = await snap();
if (mudStart.player?.surface !== 'mud') failures.push(`placed mud should register under Sprid, got ${mudStart.player?.surface}`);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.requestDash('d'));
await page.waitForFunction(() => !window.__MOSSLIGHT_PLAYTEST__.snapshot().player?.dashing, null, { timeout: 600 });
const mudEnd = await snap();
const mudDash = (mudEnd.player?.x ?? 0) - (mudStart.player?.x ?? 0);
if (!(mudDash < groundDash * .82)) failures.push(`mud should substantially shorten committed dash: ground ${groundDash.toFixed(1)} vs mud ${mudDash.toFixed(1)}`);

// The same mud slows an ordinary enemy's measured displacement.
async function setupFellerSurface(withMud) {
  return page.evaluate((mud) => {
    const p = window.__MOSSLIGHT_PLAYTEST__;
    p.setRoom(0, 1); p.clearCombatants(); p.setPlayerPosition(190, 320);
    const id = p.spawnTestEnemy('feller', 500, 320, 'terrain-feller');
    const candidates = [[500, 320], [560, 220], [560, 420], [650, 320], [420, 180]];
    let chosen = candidates[0];
    for (const [x, y] of candidates) {
      const s = p.setEnemyPosition(id, x, y);
      if (s.enemies.find((enemy) => enemy.id === id)?.surface === 'ground') { chosen = [x, y]; break; }
    }
    p.setEnemyPosition(id, chosen[0], chosen[1]);
    if (mud) p.placeTerrain('mud', chosen[0], chosen[1], 82);
    return { id, snap: p.snapshot() };
  }, withMud);
}
const groundEnemySetup = await setupFellerSurface(false);
const groundEnemyStart = groundEnemySetup.snap.enemies.find((enemy) => enemy.id === groundEnemySetup.id);
await page.waitForTimeout(620);
const groundEnemyEnd = (await snap()).enemies.find((enemy) => enemy.id === groundEnemySetup.id);
const groundEnemyTravel = groundEnemyEnd && groundEnemyStart ? Math.hypot(groundEnemyEnd.x - groundEnemyStart.x, groundEnemyEnd.y - groundEnemyStart.y) : 0;
const mudEnemySetup = await setupFellerSurface(true);
const mudEnemyStart = mudEnemySetup.snap.enemies.find((enemy) => enemy.id === mudEnemySetup.id);
if (mudEnemyStart?.surface !== 'mud') failures.push(`same mud should register under enemy, got ${mudEnemyStart?.surface}`);
await page.waitForTimeout(620);
const mudEnemyEnd = (await snap()).enemies.find((enemy) => enemy.id === mudEnemySetup.id);
const mudEnemyTravel = mudEnemyEnd && mudEnemyStart ? Math.hypot(mudEnemyEnd.x - mudEnemyStart.x, mudEnemyEnd.y - mudEnemyStart.y) : 0;
if (!(mudEnemyTravel < groundEnemyTravel * .78)) failures.push(`shared mud drag did not slow enemy enough: ground ${groundEnemyTravel.toFixed(2)} vs mud ${mudEnemyTravel.toFixed(2)}`);

// Broad mud pocket jams a Surveyor blink rather than allowing a hazard teleport.
const jammed = await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(6, 7); p.setPlayerPosition(190, 320); p.placeTerrain('mud', 270, 320, 130); return p.forceEvade('surveyor', 80); });
const jammedSurveyor = jammed.enemies[0];
if (!jammedSurveyor || jammedSurveyor.pattern !== 'recover' || jammedSurveyor.evading) failures.push(`mud pocket should jam Surveyor blink into recovery: ${JSON.stringify(jammedSurveyor)}`);
if (jammed.stats.terrainRoutes < 1) failures.push('jammed evade should count as a terrain route');

// Tall grass is real blade-reactive scenery.
const grassSetup = await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.clearCombatants(); const s = p.snapshot(); const blade = s.foliage.find((item) => !item.cut); if (!blade) return null; p.setPlayerPosition(blade.x - 44, blade.y); return { before: p.snapshot() }; });
if (!grassSetup) failures.push('authored room one did not generate cuttable tall grass');
else { await focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(90); if ((await snap()).stats.grassCut <= grassSetup.before.stats.grassCut) failures.push('machete cut did not remove generated tall grass'); }

// Brittle route walls are physical but open with two deliberate cuts.
const brittleSetup = await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(7, 8); p.clearCombatants(); const s = p.snapshot(); const barrier = s.brittle.find((item) => !item.dead); if (!barrier) return null; p.setPlayerPosition(barrier.x - 44, barrier.y); return { id: barrier.id, before: p.snapshot() }; });
if (!brittleSetup) failures.push('room eight did not generate a brittle route barrier');
else {
  await focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(220); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(130);
  const after = await snap();
  if (!after.brittle.find((item) => item.id === brittleSetup.id)?.dead) failures.push('two machete cuts did not open brittle route barrier');
  if (after.stats.brittleBroken <= brittleSetup.before.stats.brittleBroken) failures.push('brittle route opening was not recorded');
}

// A committed, perfect-window dash-cut can fracture ice into shards.
const iceSetup = await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(4, 5); p.clearCombatants();
  const ice = p.snapshot().terrain.find((patch) => patch.type === 'ice');
  if (!ice) return null;
  p.setPlayerPosition(ice.x - 34, ice.y); p.requestDash('d'); p.cut('right');
  return { id: ice.id, before: p.snapshot() };
});
if (!iceSetup) failures.push('room five did not generate an ice patch');
else {
  await page.waitForTimeout(80);
  const after = await snap();
  if (after.terrain.find((patch) => patch.id === iceSetup.id)?.type !== 'shards') failures.push('contextual dash-cut did not fracture ice into shards');
  if (after.stats.iceFractures <= iceSetup.before.stats.iceFractures) failures.push('ice fracture was not recorded');
}

// A reflected Crosscut can deliberately shove a target into brambles.
await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(6, 7); p.clearCombatants(); p.setPlayerPosition(190, 320);
  p.placeTerrain('bramble', 520, 320, 45);
  p.spawnTestEnemy('foreman', 780, 320, 'hazard-source');
  p.spawnTestEnemy('surveyor', 468, 320, 'hazard-target');
  p.spawnCounterShot('right', 82, { ownerId: 'hazard-source', speed: 245 });
});
await focus(); await page.waitForTimeout(40);
const beforeHazardRoute = await snap();
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(380);
const afterHazardRoute = await snap();
if (afterHazardRoute.stats.terrainRoutes <= beforeHazardRoute.stats.terrainRoutes) failures.push('reflected knockback did not award a TERRAIN ROUTE into brambles');
if (afterHazardRoute.stats.hazardHits <= beforeHazardRoute.stats.hazardHits) failures.push('bramble-routed enemy did not receive symmetric hazard effect');

// Independent dash + cut still works in the mixed-terrain fluency room.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(8, 9));
await focus();
const beforeOverlap = await snap();
await page.keyboard.down('d'); await page.waitForTimeout(35); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(240); await page.keyboard.up('d');
const afterOverlap = await snap();
if (afterOverlap.stats.dashes <= beforeOverlap.stats.dashes) failures.push('dash+cut overlap did not register a dash');
if (afterOverlap.stats.cuts <= beforeOverlap.stats.cuts) failures.push('dash+cut overlap did not register an independent cut');

// Persistent heartwood and Perfect Grove healing.
await page.evaluate(() => { const p = window.__MOSSLIGHT_PLAYTEST__; p.setRoom(0, 1); p.damagePlayer(2); p.completeRoom(); });
const wounded = await snap();
if (wounded.player?.hp !== 3) failures.push(`damage setup expected 3 HP, got ${wounded.player?.hp}`);
const carried = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.advance());
if (carried.player?.hp !== 4) failures.push(`Perfect Grove should heal one heartwood after carrying damage, got ${carried.player?.hp}`);
if (carried.stats.fullGroves < 1) failures.push('Perfect Grove completion was not tracked');

// Dash commitment and deterministic deep terrain both continue scaling.
const dashCurve = [];
for (const depth of [1, 5, 10, 14, 30]) {
  const s = await page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 10, d), depth);
  dashCurve.push([depth, s.player.dashDistance]);
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

// Boss punish window and pause toggle remain explicit.
const bossStart = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(9, 10));
if (bossStart.boss?.phase !== 1) failures.push(`boss should begin in phase 1, got ${bossStart.boss?.phase}`);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceBossPhase(2));
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().boss?.vulnerable === true, null, { timeout: 1800 });
if ((await snap()).boss?.state !== 'recover') failures.push('PAC-a-Saw did not expose recover window');
await focus(); await page.keyboard.press('p'); await page.waitForTimeout(40);
if ((await snap()).mode !== 'paused') failures.push('P did not pause runtime');
await page.keyboard.press('p'); await page.waitForTimeout(40);
if ((await snap()).mode !== 'playing') failures.push('P did not resume runtime');

await page.waitForTimeout(950);
const finalSnap = await snap();
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
console.log(`Sylvaria Environmental Resonance v0.9.0 playtest PASS: persistent queue + four-way Countercut + nonlinear returns + Crosscuts/Long Returns + shared mud drag + evade jamming + grass chopping + brittle routes + ice fracture + bramble Countercut routing + boss recovery + deterministic deep terrain + FPS ${finalSnap.fps.toFixed(1)}.`);
