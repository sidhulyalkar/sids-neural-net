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
}));
if (meta.title !== 'Sylvaria' || meta.version !== '0.8.0') failures.push(`runtime identity mismatch: ${JSON.stringify(meta)}`);
if (meta.visualVersion !== '0.8.0') failures.push(`visual version mismatch: ${meta.visualVersion}`);
if (meta.roomCount !== 10 || meta.rooms.length !== 10) failures.push(`expected ten authored rooms, got ${meta.roomCount}`);
if (!meta.rooms.includes('PAC-a-Saw Summit')) failures.push('boss room is missing from authored curriculum');
if (!meta.visual?.backdropCanvas || !meta.visual?.playfieldAspectSafe) failures.push(`visual contract incomplete: ${JSON.stringify(meta.visual)}`);

await page.screenshot({ path: path.join(outputDir, 'countercut-title.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await page.locator('#c').focus();

const beforeTap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.press('d');
await page.waitForTimeout(150);
const afterTap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const tapDistance = (afterTap.player?.x ?? 0) - (beforeTap.player?.x ?? 0);
if (tapDistance < 38 || tapDistance > 62) failures.push(`single D step should be roughly 48px, got ${tapDistance.toFixed(1)}px`);
if (afterTap.stats.dashes !== beforeTap.stats.dashes + 1) failures.push(`single D press should create exactly one step-dash (${beforeTap.stats.dashes} -> ${afterTap.stats.dashes})`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.locator('#c').focus();
const beforeHold = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(560);
await page.keyboard.up('d');
await page.waitForTimeout(90);
const afterHold = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const holdDashDelta = afterHold.stats.dashes - beforeHold.stats.dashes;
if (holdDashDelta < 3) failures.push(`held D should repeat discrete step-dashes, got ${holdDashDelta}`);
if ((afterHold.player?.x ?? 0) <= (beforeHold.player?.x ?? 0) + 100) failures.push('held D did not produce meaningful eastward traversal');

const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const direction of ['up', 'down', 'left', 'right']) {
  await page.evaluate((dir) => {
    window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 2);
    window.__MOSSLIGHT_PLAYTEST__.spawnCounterShot(dir);
  }, direction);
  await page.locator('#c').focus();
  const before = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  await page.waitForTimeout(65);
  await page.keyboard.press(keyFor[direction]);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (after.stats.counters <= before.stats.counters) failures.push(`${direction} machete cut failed to counter matching projectile`);
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(8, 9));
await page.locator('#c').focus();
const beforeOverlap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(35);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(220);
await page.keyboard.up('d');
const afterOverlap = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (afterOverlap.stats.dashes <= beforeOverlap.stats.dashes) failures.push('dash+cut overlap did not register a dash');
if (afterOverlap.stats.cuts <= beforeOverlap.stats.cuts) failures.push('dash+cut overlap did not register an independent machete cut');

const dashCurve = [];
for (const depth of [1, 5, 10, 14, 30]) {
  const snap = await page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 10, d), depth);
  dashCurve.push([depth, snap.player.dashDistance]);
}
for (let i = 1; i < dashCurve.length; i += 1) {
  if (dashCurve[i][1] < dashCurve[i - 1][1]) failures.push(`dash distance regressed: ${JSON.stringify(dashCurve)}`);
}
if (dashCurve.at(-1)[1] <= dashCurve[0][1]) failures.push(`deep rooms must lengthen dash distance: ${JSON.stringify(dashCurve)}`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(9, 10));
const boss = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (!boss.boss || boss.boss.dead || boss.boss.phase !== 1) failures.push(`room 10 must open with live PAC-a-Saw phase 1: ${JSON.stringify(boss.boss)}`);
await page.screenshot({ path: path.join(outputDir, 'pac-a-saw-room10.png') });

const deep = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(1, 22));
if (!deep.room?.title?.startsWith('Wild Sector')) failures.push(`post-10 room must use seeded procedural blueprint: ${deep.room?.title}`);
if ((deep.enemies?.length ?? 0) < 4) failures.push(`deep procedural room encounter too small: ${deep.enemies?.length}`);
if ((deep.trees?.filter((tree) => tree.alive).length ?? 0) < 7) failures.push('deep procedural room should contain a defendable grove');
await page.screenshot({ path: path.join(outputDir, 'wild-sector-022.png') });

await page.waitForTimeout(900);
const final = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (final.fps < 42) failures.push(`runtime FPS too low: ${final.fps.toFixed(1)}`);
if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));

fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify({ meta, tapDistance, holdDashDelta, dashCurve, final, failures }, null, 2));
await browser.close();
if (failures.length) {
  console.error(`Sylvaria Countercut playtest failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Sylvaria Countercut browser PASS: tap=${tapDistance.toFixed(1)}px, held steps=${holdDashDelta}, counters=4/4, dash curve=${JSON.stringify(dashCurve)}, fps=${final.fps.toFixed(1)}.`);
