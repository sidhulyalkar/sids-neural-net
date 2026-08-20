import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.MOSSLIGHT_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.MOSSLIGHT_PLAYTEST_DIR || 'artifacts/mosslight-playtest';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
const failures = [];
const consoleErrors = [];

page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

const runtimeUrl = `${baseUrl}/game-runtimes/mosslight-v2/index.html?playtest=1`;
await page.goto(runtimeUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__));

const metadata = await page.evaluate(() => ({
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
  roomTitles: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
}));

if (metadata.version !== '0.2.0') failures.push(`expected v0.2.0, got ${metadata.version}`);
if (metadata.roomCount !== 10) failures.push(`expected 10 rooms, got ${metadata.roomCount}`);

// Real input smoke: movement must feel responsive and a guided cast must actually restore a step.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(1500);
const start = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(320);
await page.keyboard.up('d');
await page.waitForTimeout(80);
const moved = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((moved.player?.x ?? 0) - (start.player?.x ?? 0) < 18) failures.push('WASD movement smoke did not move Sprig far enough');

// Aim at the first Dew Garden sprout and verify the Rain step is accepted, not merely fired.
await page.mouse.move(290, 210);
await page.mouse.click(290, 210);
await page.waitForTimeout(420);
const cast = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (cast.stats.casts < 1) failures.push('pointer cast smoke did not register a cast');
if (cast.stats.correct < 1) failures.push('guided pointer cast did not complete a correct restoration step');

const expectedInitialTools = ['rain', 'rain', 'mend', 'rain', 'wind', 'rain', 'rain', 'sun', 'rain', 'wind'];
const rooms = [];
for (let index = 0; index < metadata.roomCount; index += 1) {
  const before = await page.evaluate((roomIndex) => window.__MOSSLIGHT_PLAYTEST__.setRoom(roomIndex), index);
  const expectedTool = expectedInitialTools[index];
  if (before.selected !== expectedTool) failures.push(`${metadata.roomTitles[index]} should initially guide ${expectedTool}, got ${before.selected}`);

  // Wait until the short room title card is gone so the fixture audits the actual playfield.
  await page.waitForTimeout(1500);
  const stressedFile = `room-${String(index + 1).padStart(2, '0')}-stressed.png`;
  await page.screenshot({ path: path.join(outputDir, stressedFile) });

  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.completeRoom());
  await page.waitForTimeout(320);
  const restoredFile = `room-${String(index + 1).padStart(2, '0')}-restored.png`;
  await page.screenshot({ path: path.join(outputDir, restoredFile) });

  rooms.push({
    index: index + 1,
    title: metadata.roomTitles[index],
    stressedScreenshot: stressedFile,
    restoredScreenshot: restoredFile,
    stressedProgress: before.progress,
    restoredProgress: after.progress,
    selectedTool: before.selected,
    expectedInitialTool: expectedTool,
    fps: after.fps,
  });
}

const finalSnapshot = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (finalSnapshot.fps < 45) failures.push(`headless runtime FPS too low: ${finalSnapshot.fps.toFixed(1)}`);
if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));

const report = {
  generatedAt: new Date().toISOString(),
  runtimeUrl,
  version: metadata.version,
  difficulty: 'gentle',
  interactionSmoke: {
    startX: start.player?.x,
    movedX: moved.player?.x,
    deltaX: (moved.player?.x ?? 0) - (start.player?.x ?? 0),
    casts: cast.stats.casts,
    correctActions: cast.stats.correct,
  },
  rooms,
  finalFps: finalSnapshot.fps,
  consoleErrors,
  failures,
};
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

await browser.close();

if (failures.length) {
  console.error(`Mosslight browser playtest failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Mosslight browser playtest PASS: ${rooms.length} unobstructed stressed/restored room pairs, movement + correct-cast smoke, guided starting tools, ${finalSnapshot.fps.toFixed(1)} FPS.`);
