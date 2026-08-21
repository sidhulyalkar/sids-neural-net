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
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.MosslightExpedition) && Boolean(window.MosslightDirector));

const metadata = await page.evaluate(() => ({
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
  roomTitles: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
  expedition: window.MosslightExpedition.summary(),
  director: window.MosslightDirector.summary(),
  powerups: window.MosslightDirector.powerups.map((powerup) => powerup.id),
  movementPatterns: window.MosslightDirector.movementPatterns,
}));

if (metadata.version !== '0.3.0') failures.push(`expected v0.3.0 playtest API, got ${metadata.version}`);
if (metadata.roomCount !== 10) failures.push(`expected 10 rooms, got ${metadata.roomCount}`);
if (metadata.expedition?.atlasCount !== 1000) failures.push(`expected 1000 Atlas scenes, got ${metadata.expedition?.atlasCount}`);
if (metadata.expedition?.runSize !== 10) failures.push(`expected 10-scene expedition, got ${metadata.expedition?.runSize}`);
const runWorlds = metadata.expedition?.worlds ?? [];
if (new Set(runWorlds.map((world) => world.index)).size !== 10) failures.push('expedition should contain 10 unique Atlas worlds');
if (JSON.stringify(runWorlds.map((world) => world.index)) !== JSON.stringify([1,2,3,4,5,6,7,8,9,10])) {
  failures.push(`playtest expedition should deterministically use worlds 001-010, got ${runWorlds.map((world) => world.index).join(',')}`);
}

const expectedPowerups = ['rapid-bloom', 'giant-dew', 'prism-spores', 'river-echo', 'sunstep', 'moss-ward'];
for (const powerup of expectedPowerups) {
  if (!metadata.powerups.includes(powerup)) failures.push(`director catalog missing ${powerup}`);
}
const expectedPatterns = ['patrol', 'weave', 'orbit', 'swoop', 'stalk', 'dash', 'spiral'];
for (const pattern of expectedPatterns) {
  if (!metadata.movementPatterns.includes(pattern)) failures.push(`director missing encounter movement grammar ${pattern}`);
}

if (metadata.director.length !== 10) failures.push(`director should enrich 10 rooms, got ${metadata.director.length}`);
metadata.director.forEach((room, index) => {
  if (room.level !== index + 1) failures.push(`room ${index + 1} expected threat ${index + 1}/10, got ${room.level}`);
  if (index === 0 && room.powerup !== null) failures.push('tutorial room should remain powerup-free');
  if (index > 0 && !room.powerup) failures.push(`room ${index + 1} should contain a world gift`);
});
const earlyEncounterCount = metadata.director.slice(0, 2).reduce((sum, room) => sum + room.encounterPatterns.length, 0);
const lateEncounterCount = metadata.director.slice(-3).reduce((sum, room) => sum + room.encounterPatterns.length, 0);
if (earlyEncounterCount !== 0) failures.push(`tutorial rooms should not spawn encounter agents, got ${earlyEncounterCount}`);
if (lateEncounterCount < 10) failures.push(`late expedition should combine many encounter agents, got ${lateEncounterCount}`);
if (!metadata.director.slice(3).some((room) => room.movingObstacles > 0)) failures.push('later rooms should introduce moving obstacle geometry');
if (new Set(metadata.director.map((room) => room.situation)).size < 4) failures.push('playtest expedition should expose multiple terrain situation grammars');

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

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(700);
const start = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(320);
await page.keyboard.up('d');
await page.waitForTimeout(80);
const moved = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((moved.player?.x ?? 0) - (start.player?.x ?? 0) < 18) failures.push('WASD movement smoke did not move Sprig far enough');

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

async function firstTargetSnapshot() {
  return page.evaluate(() => {
    const snapshot = window.__MOSSLIGHT_PLAYTEST__.snapshot();
    return { snapshot, target: snapshot.targets.find((target) => !target.done) };
  });
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(140);
let { snapshot: beforeMouse, target: mouseTarget } = await firstTargetSnapshot();
if (!mouseTarget) failures.push('room 1 should expose a restoration target for pointer test');
else {
  await page.mouse.move(mouseTarget.x, mouseTarget.y);
  await page.mouse.click(mouseTarget.x, mouseTarget.y);
  await page.waitForTimeout(520);
  const mouseCast = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (mouseCast.stats.casts <= beforeMouse.stats.casts) failures.push('pointer aim did not add a new cast');
  if (mouseCast.stats.correct <= beforeMouse.stats.correct) failures.push('pointer aim did not add a new correct restoration step');
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
await page.waitForTimeout(140);
const keyboardData = await firstTargetSnapshot();
const beforeKeyboard = keyboardData.snapshot;
const keyboardTarget = keyboardData.target;
let keyboardKeys = [];
let keyboardCast = beforeKeyboard;
if (!keyboardTarget || !beforeKeyboard.player) failures.push('room 1 should expose target/player data for keyboard aim test');
else {
  keyboardKeys = arrowKeysForVector(keyboardTarget.x - beforeKeyboard.player.x, keyboardTarget.y - beforeKeyboard.player.y);
  await page.locator('#c').focus();
  for (const key of keyboardKeys) await page.keyboard.down(key);
  await page.keyboard.press('Space');
  for (const key of [...keyboardKeys].reverse()) await page.keyboard.up(key);
  await page.waitForTimeout(560);
  keyboardCast = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (keyboardCast.stats.casts <= beforeKeyboard.stats.casts) failures.push('arrow-key + Space aim did not add a new cast');
  if (keyboardCast.stats.correct <= beforeKeyboard.stats.correct) failures.push(`arrow-key aim did not add a correct restoration step (${keyboardKeys.join(' + ')})`);
  if (keyboardCast.aimSource !== 'keyboard') failures.push(`arrow aim should remain keyboard-authoritative until pointer moves, got ${keyboardCast.aimSource}`);
}

const buildSnapshots = [];
for (const roomIndex of [1, 2, 3]) {
  await page.evaluate((index) => window.__MOSSLIGHT_PLAYTEST__.setRoom(index), roomIndex);
  const beforeGift = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (!beforeGift.powerup) {
    failures.push(`room ${roomIndex + 1} did not expose a world gift`);
    continue;
  }
  const afterGift = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.collectPowerup());
  if (!afterGift.powerup?.collected) failures.push(`room ${roomIndex + 1} world gift did not collect`);
  if (afterGift.stats.gifts <= beforeGift.stats.gifts) failures.push(`room ${roomIndex + 1} gift counter did not advance`);
  buildSnapshots.push({ roomIndex, powerup: afterGift.powerup?.id, relics: afterGift.relics });
}
if (buildSnapshots.length === 3) {
  const finalBuild = buildSnapshots.at(-1).relics;
  const changed = finalBuild.fireRate > 1 || finalBuild.projectileScale > 1 || finalBuild.spread > 1 || finalBuild.pierce > 0 || finalBuild.moveSpeed > 1 || finalBuild.dashRecharge > 1 || finalBuild.shield > 0;
  if (!changed) failures.push('collecting world gifts did not change the expedition build');
  if (finalBuild.collected.length < 3) failures.push(`expected at least 3 persistent collected gifts, got ${finalBuild.collected.length}`);
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(9));
const lateStart = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (lateStart.challenge?.level !== 10) failures.push(`final room should be threat 10/10, got ${lateStart.challenge?.level}`);
if (lateStart.encounters.length < 5) failures.push(`final room should combine 5 encounter agents, got ${lateStart.encounters.length}`);
await page.waitForTimeout(3400);
const lateActive = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (!lateActive.waves.length) failures.push('final room did not generate a telegraphed situation sweep');
const movedEncounter = lateStart.encounters.some((encounter, index) => {
  const after = lateActive.encounters[index];
  return after && Math.hypot(after.x - encounter.x, after.y - encounter.y) > 12;
});
if (!movedEncounter) failures.push('late-room wildlife encounter agents did not visibly move');

const expectedInitialTools = ['rain', 'rain', 'mend', 'rain', 'wind', 'rain', 'rain', 'sun', 'rain', 'wind'];
const roomReports = [];
for (let index = 0; index < metadata.roomCount; index += 1) {
  const before = await page.evaluate((roomIndex) => window.__MOSSLIGHT_PLAYTEST__.setRoom(roomIndex), index);
  const expectedTool = expectedInitialTools[index];
  if (before.selected !== expectedTool) failures.push(`${metadata.roomTitles[index]} should initially guide ${expectedTool}, got ${before.selected}`);

  await page.waitForTimeout(700);
  const stressedFile = `room-${String(index + 1).padStart(2, '0')}-stressed.png`;
  await page.screenshot({ path: path.join(outputDir, stressedFile) });

  const after = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.completeRoom());
  await page.waitForTimeout(240);
  const restoredFile = `room-${String(index + 1).padStart(2, '0')}-restored.png`;
  await page.screenshot({ path: path.join(outputDir, restoredFile) });

  roomReports.push({
    index: index + 1,
    title: metadata.roomTitles[index],
    atlasWorld: runWorlds[index],
    challenge: before.challenge,
    powerup: before.powerup?.id || null,
    encounterPatterns: before.encounters.map((encounter) => encounter.pattern),
    animalPatterns: before.targets.filter((target) => target.kind === 'animal').map((target) => target.movementPattern),
    movingObstacles: before.movingObstacles,
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
  director: metadata.director,
  replayContract: { first: replayFirst, second: replaySecond, overlap },
  interactionSmoke: {
    movement: { startX: start.player?.x, movedX: moved.player?.x, deltaX: (moved.player?.x ?? 0) - (start.player?.x ?? 0) },
    mouse: { target: mouseTarget, castsAdded: keyboardData ? undefined : undefined },
    keyboard: { target: keyboardTarget, keys: keyboardKeys, castsAdded: keyboardCast.stats.casts - beforeKeyboard.stats.casts, correctActionsAdded: keyboardCast.stats.correct - beforeKeyboard.stats.correct },
    buildSnapshots,
    lateRoom: { start: lateStart, active: lateActive },
  },
  rooms: roomReports,
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

console.log(`Mosslight browser playtest PASS: 1,000-scene Atlas feed, disjoint repeat expeditions, escalating 1→10 threat curve, persistent world gifts, custom wildlife/obstacle/situation movement, independent mouse + arrow-key aim, ${roomReports.length} rooms, ${finalSnapshot.fps.toFixed(1)} FPS.`);
