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

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?countercut-playtest=1`, { waitUntil: 'networkidle' });
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
}));
if (meta.title !== 'Sylvaria' || meta.version !== '0.8.2') failures.push(`runtime identity mismatch: ${JSON.stringify(meta)}`);
if (meta.visualVersion !== '0.8.2') failures.push(`visual version mismatch: ${meta.visualVersion}`);
if (meta.roomCount !== 10 || meta.rooms.length !== 10) failures.push(`expected ten authored rooms, got ${meta.roomCount}`);
if (!meta.rooms.includes('PAC-a-Saw Summit')) failures.push('boss room is missing from authored curriculum');
if (!meta.visual?.backdropCanvas || !meta.visual?.playfieldAspectSafe || !meta.visual?.routeGeometry || !meta.visual?.lockedIntentTelegraphs || !meta.visual?.resilientMoveQueue || !meta.visual?.projectilePatternReadability || !meta.visual?.evasiveEnemyCues || !meta.visual?.counterRouting) failures.push(`visual contract incomplete: ${JSON.stringify(meta.visual)}`);
for (const pattern of ['straight', 'zigzag', 'wave', 'spiral', 'swerve', 'wobble', 'return']) {
  if (!meta.projectilePatterns?.includes(pattern)) failures.push(`projectile pattern registry missing ${pattern}`);
}
for (const movement of ['backstep', 'blink-evade']) {
  if (!meta.movementPatterns?.includes(movement)) failures.push(`movement registry missing ${movement}`);
}

await page.screenshot({ path: path.join(outputDir, 'countercut-v082-title.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await page.locator('#c').focus();

const beforeTap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(170);
const afterTap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const tapDistance = (afterTap.player?.x ?? 0) - (beforeTap.player?.x ?? 0);
if (tapDistance < 38 || tapDistance > 62) failures.push(`single D step should be roughly 48px, got ${tapDistance.toFixed(1)}px`);
if (afterTap.stats.dashes !== beforeTap.stats.dashes + 1) failures.push(`single D press should create exactly one step-dash (${beforeTap.stats.dashes} -> ${afterTap.stats.dashes})`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.locator('#c').focus();
const beforeBuffer = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(25);
await page.keyboard.press('s');
await page.waitForTimeout(300);
const afterBuffer = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (afterBuffer.stats.dashes < beforeBuffer.stats.dashes + 2) failures.push(`persistent queued D -> S should resolve two committed steps, got ${afterBuffer.stats.dashes - beforeBuffer.stats.dashes}`);
if ((afterBuffer.player?.x ?? 0) <= (beforeBuffer.player?.x ?? 0) + 32) failures.push('queued first east step did not resolve');
if ((afterBuffer.player?.y ?? 0) <= (beforeBuffer.player?.y ?? 0) + 32) failures.push('queued south step did not resolve after first dash');
if (afterBuffer.player?.bufferedMove) failures.push(`movement queue should drain after execution, got ${afterBuffer.player.bufferedMove}`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.locator('#c').focus();
const beforeHold = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(560);
await page.keyboard.up('d');
await page.waitForTimeout(100);
const afterHold = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const holdDashDelta = afterHold.stats.dashes - beforeHold.stats.dashes;
if (holdDashDelta < 3) failures.push(`held D should repeat discrete step-dashes, got ${holdDashDelta}`);
if ((afterHold.player?.x ?? 0) <= (beforeHold.player?.x ?? 0) + 100) failures.push('held D did not produce meaningful eastward traversal');

await page.evaluate(() => { window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1); window.__MOSSLIGHT_PLAYTEST__.placeDeadwoodAhead('right', 34); });
await page.locator('#c').focus();
const beforeBlocked = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(100);
const blocked = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((blocked.player?.x ?? 0) - (beforeBlocked.player?.x ?? 0) > 12) failures.push(`deadwood should stop the dash lane, moved ${(blocked.player?.x ?? 0) - (beforeBlocked.player?.x ?? 0)}px`);
if (blocked.stats.blockedSteps <= beforeBlocked.stats.blockedSteps) failures.push('blocked step was not recorded');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(220);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(220);
const chopped = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (!chopped.debris.some((item) => item.dead)) failures.push('two right cuts should chop the deadwood blocking the lane');
await page.keyboard.press('d');
await page.waitForTimeout(170);
const clearedLane = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((clearedLane.player?.x ?? 0) <= (chopped.player?.x ?? 0) + 30) failures.push('dash lane did not open after deadwood was chopped');

const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const direction of ['up', 'down', 'left', 'right']) {
  await page.evaluate((dir) => {
    window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 2);
    window.__MOSSLIGHT_PLAYTEST__.spawnCounterShot(dir);
  }, direction);
  await page.locator('#c').focus();
  const before = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  await page.waitForTimeout(55);
  await page.keyboard.press(keyFor[direction]);
  await page.waitForTimeout(110);
  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (after.stats.counters <= before.stats.counters) failures.push(`${direction} machete cut failed to counter matching projectile`);
}

// Nonlinear trajectories remain counterable because the rule follows arrival side.
for (const pattern of ['zigzag', 'spiral', 'swerve', 'wobble']) {
  await page.evaluate((projectilePattern) => {
    window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 2);
    window.__MOSSLIGHT_PLAYTEST__.clearCombatants();
    window.__MOSSLIGHT_PLAYTEST__.firePattern(projectilePattern, 'right', 88);
  }, pattern);
  await page.locator('#c').focus();
  const before = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (before.shots[0]?.pattern !== pattern) failures.push(`${pattern} playtest projectile did not retain its hostile path family`);
  await page.waitForTimeout(35);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (after.stats.counters <= before.stats.counters) failures.push(`${pattern} projectile was not counterable by its actual arrival side`);
}

// Counter-routing arena: the original shooter is far right, but a second enemy sits in the chosen lane.
// A correct return should accelerate beyond hostile speeds, hit the cross-target first, and award Crosscut.
await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(1, 2);
  p.clearCombatants();
  p.setPlayerPosition(190, 320);
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
  if (friendlyReturn.pattern !== 'return') failures.push(`counter should normalize hostile motion into return path, got ${friendlyReturn.pattern}`);
  if (friendlyReturn.counterTargetId !== 'cross-target') failures.push(`counter assist should select the nearer enemy in the chosen lane, got ${friendlyReturn.counterTargetId}`);
}
await page.waitForTimeout(320);
const crosscut = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (crosscut.stats.crosscuts < 1) failures.push('reflected projectile did not award a Crosscut when it hit a different enemy than its shooter');
if (!crosscut.enemies.find((enemy) => enemy.id === 'cross-target')?.counterStagger) failures.push('returned shot should stagger an evasive cross-target');

// A distant original shooter should produce a Long Return bonus when no nearer target steals the lane.
await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(1, 2);
  p.clearCombatants();
  p.setPlayerPosition(175, 320);
  p.spawnTestEnemy('foreman', 790, 320, 'long-source');
  p.spawnCounterShot('right', 82, { ownerId: 'long-source', speed: 245 });
});
await page.locator('#c').focus();
await page.waitForTimeout(40);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(650);
const longReturn = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (longReturn.stats.longReturns < 1) failures.push('long-distance reflected hit did not award a Long Return');

// Perfect counters fire at the higher return speed and carry one penetration charge.
await page.evaluate(() => {
  const p = window.__MOSSLIGHT_PLAYTEST__;
  p.setRoom(1, 2);
  p.clearCombatants();
  p.setPlayerPosition(190, 320);
  p.spawnTestEnemy('foreman', 760, 320, 'perfect-source');
  p.spawnCounterShot('right', 68, { ownerId: 'perfect-source', speed: 180 });
});
await page.locator('#c').focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(20);
const perfectReturn = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const perfectShot = perfectReturn.shots.find((shot) => shot.friendly);
if (!perfectShot || perfectShot.speed < 1000) failures.push(`perfect return should exceed 1000px/s, got ${perfectShot?.speed ?? 'no shot'}`);
if (perfectShot && perfectShot.pierces !== 1) failures.push(`perfect return should begin with one penetration charge, got ${perfectShot.pierces}`);

// Evasive enemies must show the cue first and then meaningfully relocate.
for (const type of ['surveyor', 'foreman']) {
  const evadeStart = await page.evaluate((enemyType) => window.__MOSSLIGHT_PLAYTEST__.forceEvade(enemyType, 80), type);
  const startEnemy = evadeStart.enemies[0];
  if (!startEnemy?.evading || startEnemy.intent?.kind !== 'evade') failures.push(`${type} did not expose an evade destination cue before movement`);
  await page.waitForTimeout(330);
  const evadeEnd = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  const endEnemy = evadeEnd.enemies[0];
  if (!endEnemy || Math.hypot(endEnemy.x - startEnemy.x, endEnemy.y - startEnemy.y) < 38) failures.push(`${type} evade did not create meaningful separation`);
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(8, 9));
await page.locator('#c').focus();
const beforeOverlap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(35);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(230);
await page.keyboard.up('d');
const afterOverlap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (afterOverlap.stats.dashes <= beforeOverlap.stats.dashes) failures.push('dash+cut overlap did not register a dash');
if (afterOverlap.stats.cuts <= beforeOverlap.stats.cuts) failures.push('dash+cut overlap did not register an independent machete cut');

await page.evaluate(() => { window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1); window.__MOSSLIGHT_PLAYTEST__.damagePlayer(2); window.__MOSSLIGHT_PLAYTEST__.completeRoom(); });
const wounded = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (wounded.player?.hp !== 3) failures.push(`playtest damage setup expected 3 HP, got ${wounded.player?.hp}`);
const carried = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.advance());
if (carried.player?.hp !== 4) failures.push(`perfect grove should carry damage and heal one heartwood (expected 4, got ${carried.player?.hp})`);
if (carried.stats.fullGroves < 1) failures.push('perfect grove completion was not tracked');

const dashCurve = [];
for (const depth of [1, 5, 10, 14, 30]) {
  const snap = await page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 10, d), depth);
  dashCurve.push([depth, snap.player.dashDistance]);
}
for (let i = 1; i < dashCurve.length; i += 1) {
  if (dashCurve[i][1] < dashCurve[i - 1][1]) failures.push(`dash distance regressed: ${JSON.stringify(dashCurve)}`);
}
if (dashCurve.at(-1)[1] <= dashCurve[0][1]) failures.push(`deep rooms must lengthen dash distance: ${JSON.stringify(dashCurve)}`);

const deterministic = await page.evaluate(() => {
  const a = window.__MOSSLIGHT_PLAYTEST__.roomBlueprint(22);
  const b = window.__MOSSLIGHT_PLAYTEST__.roomBlueprint(22);
  return { same: JSON.stringify(a) === JSON.stringify(b), a, b };
});
if (!deterministic.same) failures.push('deep room blueprint must be deterministic for a given depth');

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(9, 10));
let boss = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (!boss.boss || boss.boss.dead || boss.boss.phase !== 1) failures.push(`room 10 must open with live PAC-a-Saw phase 1: ${JSON.stringify(boss.boss)}`);
await page.screenshot({ path: path.join(outputDir, 'pac-a-saw-v082-room10.png') });
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.forceBossPhase(2));
try {
  await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().boss?.vulnerable === true, null, { timeout: 1800 });
  boss = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (boss.boss?.state !== 'recover') failures.push(`boss vulnerability must be an explicit recover state, got ${boss.boss?.state}`);
} catch {
  failures.push('PAC-a-Saw phase 2 never exposed its punish/recovery window');
}

await page.locator('#c').focus();
await page.keyboard.press('p');
await page.waitForTimeout(60);
const paused = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (paused.mode !== 'paused') failures.push(`P should pause, got ${paused.mode}`);
await page.keyboard.press('p');
await page.waitForTimeout(60);
const resumed = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (resumed.mode !== 'playing') failures.push(`P should resume from pause, got ${resumed.mode}`);

const deep = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 22));
if (!deep.room?.title?.startsWith('Wild Sector')) failures.push(`post-10 room must use seeded procedural blueprint: ${deep.room?.title}`);
if ((deep.enemies?.length ?? 0) < 4) failures.push(`deep procedural room encounter too small: ${deep.enemies?.length}`);
if ((deep.trees?.filter((tree) => tree.alive).length ?? 0) < 7) failures.push('deep procedural room should contain a defendable grove');
await page.screenshot({ path: path.join(outputDir, 'wild-sector-022-v082.png') });

await page.waitForTimeout(900);
const final = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (final.shots.length > 128) failures.push(`projectile cap exceeded: ${final.shots.length}`);
if (final.pendingShots > 72) failures.push(`pending-shot cap exceeded: ${final.pendingShots}`);
if (final.fps < 42) failures.push(`runtime FPS too low: ${final.fps.toFixed(1)}`);
if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));

fs.writeFileSync(path.join(outputDir, 'report-v082.json'), JSON.stringify({ meta, tapDistance, holdDashDelta, dashCurve, deterministic, crosscut, longReturn, perfectReturn, final, failures }, null, 2));
await browser.close();
if (failures.length) {
  console.error(`Sylvaria Countercut v0.8.2 playtest failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Sylvaria Countercut v0.8.2 browser PASS: tap=${tapDistance.toFixed(1)}px, held steps=${holdDashDelta}, counters=4/4, persistent queue, route chopping, nonlinear counters, high-speed Crosscut + Long Return rewards, blink/backstep evasion, persistent heartwood, boss recovery, dash curve=${JSON.stringify(dashCurve)}, fps=${final.fps.toFixed(1)}.`);
