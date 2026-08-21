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
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.MosslightExpedition));

const metadata = await page.evaluate(() => ({
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
  roomTitles: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
  expedition: window.MosslightExpedition.summary(),
}));

if (metadata.version !== '0.2.0') failures.push(`expected v0.2.0 playtest API, got ${metadata.version}`);
if (metadata.roomCount !== 10) failures.push(`expected 10 rooms, got ${metadata.roomCount}`);
if (metadata.expedition?.atlasCount !== 1000) failures.push(`expected 1000 Atlas scenes, got ${metadata.expedition?.atlasCount}`);
if (metadata.expedition?.runSize !== 10) failures.push(`expected 10-scene expedition, got ${metadata.expedition?.runSize}`);
const runWorlds = metadata.expedition?.worlds ?? [];
if (new Set(runWorlds.map((world) => world.index)).size !== 10) failures.push('expedition should contain 10 unique Atlas worlds');
if (JSON.stringify(runWorlds.map((world) => world.index)) !== JSON.stringify([1,2,3,4,5,6,7,8,9,10])) {
  failures.push(`playtest expedition should deterministically use worlds 001-010, got ${runWorlds.map((world) => world.index).join(',')}`);
}

// Production replay contract: two consecutive real expeditions must advance through
// the persistent without-replacement deck instead of reseeding or replaying worlds.
const replayPage = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
await replayPage.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?replay-contract=1`, { waitUntil: 'networkidle' });
await replayPage.evaluate(() => localStorage.removeItem('sid.mosslight.atlas-deck.v1'));
await replayPage.reload({ waitUntil: 'networkidle' });
await replayPage.waitForFunction(() => Boolean(window.MosslightExpedition));
const replayFirst = await replayPage.evaluate(() => window.MosslightExpedition.summary());
const replaySecond = await replayPage.evaluate(() => {
  window.MosslightExpedition.newRun();
  return window.MosslightExpedition.summary();
});
const firstIndices = replayFirst.worlds.map((world) => world.index);
const secondIndices = replaySecond.worlds.map((world) => world.index);
const overlap = firstIndices.filter((index) => secondIndices.includes(index));
if (new Set(firstIndices).size !== 10 || new Set(secondIndices).size !== 10) failures.push('real replay deck must produce 10 unique worlds per expedition');
if (overlap.length) failures.push(`consecutive expeditions repeated worlds before deck exhaustion: ${overlap.join(',')}`);
if (replayFirst.deck?.cursor !== 10 || replaySecond.deck?.cursor !== 20) {
  failures.push(`persistent Atlas deck should advance cursor 10 -> 20, got ${replayFirst.deck?.cursor} -> ${replaySecond.deck?.cursor}`);
}
await replayPage.close();

// Real movement smoke.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(1500);
const start = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(320);
await page.keyboard.up('d');
await page.waitForTimeout(80);
const moved = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((moved.player?.x ?? 0) - (start.player?.x ?? 0) < 18) failures.push('WASD movement smoke did not move Sprig far enough');

async function generatedAimProbe() {
  return page.evaluate(() => {
    const snapshot = window.__MOSSLIGHT_PLAYTEST__.snapshot();
    const room = window.MosslightContent.rooms[snapshot.roomIndex];
    const player = snapshot.player;
    const unfinished = room.targets.filter((target) => !target.done);
    const target = unfinished.reduce((best, candidate) => {
      const distance = Math.hypot(candidate.x - player.x, candidate.y - player.y);
      return !best || distance < best.distance ? { ...candidate, distance } : best;
    }, null);
    return target ? { player, target } : null;
  });
}

function arrowKeysForVector(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const octant = Math.round(angle / (Math.PI / 4));
  const normalized = ((octant % 8) + 8) % 8;
  return [
    ['ArrowRight'],
    ['ArrowRight', 'ArrowDown'],
    ['ArrowDown'],
    ['ArrowLeft', 'ArrowDown'],
    ['ArrowLeft'],
    ['ArrowLeft', 'ArrowUp'],
    ['ArrowUp'],
    ['ArrowRight', 'ArrowUp'],
  ][normalized];
}

// Mouse aim: point at the actual procedurally generated nearest relationship and
// require this input to add both a new cast and a new correct restoration action.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(100);
const beforeMouse = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const mouseProbe = await generatedAimProbe();
if (!mouseProbe) {
  failures.push('could not resolve generated mouse-aim target');
} else {
  await page.mouse.move(mouseProbe.target.x, mouseProbe.target.y);
  await page.mouse.click(mouseProbe.target.x, mouseProbe.target.y);
  await page.waitForTimeout(760);
}
const mouseCast = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (mouseCast.stats.casts <= beforeMouse.stats.casts) failures.push('pointer aim did not add a new cast');
if (mouseCast.stats.correct <= beforeMouse.stats.correct) failures.push('pointer aim did not add a new correct restoration step');

// Laptop keyboard aim: quantize the actual generated target vector to the nearest
// 8-way arrow direction, hold those arrows, and cast with Space. This proves the
// keyboard scheme stays useful even after Atlas geometry perturbs target positions.
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(100);
await page.locator('#c').focus();
const beforeKeyboard = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const keyboardProbe = await generatedAimProbe();
let keyboardKeys = [];
if (!keyboardProbe) {
  failures.push('could not resolve generated keyboard-aim target');
} else {
  keyboardKeys = arrowKeysForVector(
    keyboardProbe.target.x - keyboardProbe.player.x,
    keyboardProbe.target.y - keyboardProbe.player.y
  );
  for (const key of keyboardKeys) await page.keyboard.down(key);
  await page.keyboard.press('Space');
  for (const key of [...keyboardKeys].reverse()) await page.keyboard.up(key);
  await page.waitForTimeout(800);
}
const keyboardCast = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (keyboardCast.stats.casts <= beforeKeyboard.stats.casts) failures.push('arrow-key + Space aim did not add a new cast');
if (keyboardCast.stats.correct <= beforeKeyboard.stats.correct) failures.push(`8-way arrow aim (${keyboardKeys.join(' + ')}) did not add a new correct restoration step`);

const expectedInitialTools = ['rain', 'rain', 'mend', 'rain', 'wind', 'rain', 'rain', 'sun', 'rain', 'wind'];
const rooms = [];
for (let index = 0; index < metadata.roomCount; index += 1) {
  const before = await page.evaluate((roomIndex) => window.__MOSSLIGHT_PLAYTEST__.setRoom(roomIndex), index);
  const expectedTool = expectedInitialTools[index];
  if (before.selected !== expectedTool) failures.push(`${metadata.roomTitles[index]} should initially guide ${expectedTool}, got ${before.selected}`);

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
    atlasWorld: runWorlds[index],
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
  expedition: metadata.expedition,
  replayContract: {
    first: replayFirst,
    second: replaySecond,
    overlap,
  },
  interactionSmoke: {
    startX: start.player?.x,
    movedX: moved.player?.x,
    deltaX: (moved.player?.x ?? 0) - (start.player?.x ?? 0),
    mouse: {
      target: mouseProbe?.target ? { x: mouseProbe.target.x, y: mouseProbe.target.y, label: mouseProbe.target.label } : null,
      castsAdded: mouseCast.stats.casts - beforeMouse.stats.casts,
      correctActionsAdded: mouseCast.stats.correct - beforeMouse.stats.correct,
    },
    keyboard: {
      target: keyboardProbe?.target ? { x: keyboardProbe.target.x, y: keyboardProbe.target.y, label: keyboardProbe.target.label } : null,
      keys: keyboardKeys,
      castsAdded: keyboardCast.stats.casts - beforeKeyboard.stats.casts,
      correctActionsAdded: keyboardCast.stats.correct - beforeKeyboard.stats.correct,
    },
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

console.log(`Mosslight browser playtest PASS: 1,000-scene Atlas feed, disjoint repeat expeditions, ${rooms.length} unique rooms, generated-target mouse + 8-way arrow aim, movement, correct-cast smoke, ${finalSnapshot.fps.toFixed(1)} FPS.`);
