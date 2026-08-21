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
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

const runtimeUrl = `${baseUrl}/game-runtimes/mosslight-v2/index.html?playtest=1`;
await page.goto(runtimeUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.MosslightExpedition) && Boolean(window.MosslightDirector));

const metadata = await page.evaluate(() => ({
  version: window.__MOSSLIGHT_PLAYTEST__.version,
  title: window.__MOSSLIGHT_PLAYTEST__.title,
  roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
  roomTitles: window.__MOSSLIGHT_PLAYTEST__.roomTitles,
  expedition: window.MosslightExpedition.summary(),
  director: window.MosslightDirector.summary(),
  powerups: window.MosslightDirector.powerups.map((powerup) => powerup.id),
  patterns: window.MosslightDirector.movementPatterns,
}));

if (metadata.version !== '0.5.0') failures.push(`expected v0.5.0, got ${metadata.version}`);
if (metadata.title !== 'Sylvaria') failures.push(`expected Sylvaria runtime title, got ${metadata.title}`);
if (metadata.roomCount !== 10) failures.push(`expected 10 mechanic templates per loaded sector, got ${metadata.roomCount}`);
if (metadata.expedition?.atlasCount !== 1000) failures.push(`expected canonical 1000-scene Atlas, got ${metadata.expedition?.atlasCount}`);
if (new Set((metadata.expedition?.worlds || []).map((world) => world.index)).size !== 10) failures.push('loaded sector must contain 10 unique Atlas worlds');
if (new Set(metadata.director.map((room) => room.situation)).size < 4) failures.push('novelty director should expose at least four situation grammars in deterministic sector');
for (const id of ['rapid-bloom','giant-dew','prism-spores','river-echo','sunstep','moss-ward']) if (!metadata.powerups.includes(id)) failures.push(`missing world gift ${id}`);
for (const pattern of ['patrol','weave','orbit','swoop','stalk','dash','spiral']) if (!metadata.patterns.includes(pattern)) failures.push(`missing encounter grammar ${pattern}`);

await page.screenshot({ path: path.join(outputDir, 'sylvaria-menu.png') });
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
await page.locator('#c').focus();

const start = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.keyboard.down('d');
await page.waitForTimeout(360);
await page.keyboard.up('d');
await page.waitForTimeout(80);
const moved = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if ((moved.player?.x ?? 0) - (start.player?.x ?? 0) < 20) failures.push(`WASD movement too small: ${start.player?.x} -> ${moved.player?.x}`);

function arrowKeysForVector(dx, dy) {
  const octant = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return [
    ['ArrowRight'], ['ArrowRight','ArrowDown'], ['ArrowDown'], ['ArrowLeft','ArrowDown'],
    ['ArrowLeft'], ['ArrowLeft','ArrowUp'], ['ArrowUp'], ['ArrowRight','ArrowUp'],
  ][octant];
}

function nearestUnfinishedTarget(snapshot) {
  if (!snapshot?.player) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const target of snapshot.targets || []) {
    if (target.done) continue;
    const distance = Math.hypot(target.x - snapshot.player.x, target.y - snapshot.player.y);
    if (distance < bestDistance) { best = target; bestDistance = distance; }
  }
  return best;
}

async function waitForShotResolution(before, label, timeoutMs = 1800) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  while (Date.now() < deadline) {
    if (snapshot.stats.casts > before.stats.casts && snapshot.stats.correct > before.stats.correct) return snapshot;
    await page.waitForTimeout(40);
    snapshot = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  }
  failures.push(`${label} did not resolve a correct puzzle shot within ${timeoutMs}ms (casts ${before.stats.casts}->${snapshot.stats.casts}, correct ${before.stats.correct}->${snapshot.stats.correct})`);
  return snapshot;
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.waitForTimeout(120);
const pointerBefore = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const pointerTarget = nearestUnfinishedTarget(pointerBefore);
if (!pointerTarget) failures.push('room one must expose a puzzle target');
else {
  await page.mouse.move(pointerTarget.x, pointerTarget.y);
  await page.mouse.click(pointerTarget.x, pointerTarget.y);
  const pointerAfter = await waitForShotResolution(pointerBefore, 'mouse aim');
  if (pointerAfter.stats.casts <= pointerBefore.stats.casts) failures.push('mouse click did not fire Sprid portal gun');
  if (pointerAfter.stats.correct <= pointerBefore.stats.correct) failures.push('mouse aim did not advance a correct puzzle resonance');
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
await page.waitForTimeout(120);
const keyboardBefore = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const keyboardTarget = nearestUnfinishedTarget(keyboardBefore);
if (!keyboardTarget || !keyboardBefore.player) failures.push('keyboard aim needs target/player state');
else {
  const arrows = arrowKeysForVector(keyboardTarget.x - keyboardBefore.player.x, keyboardTarget.y - keyboardBefore.player.y);
  await page.locator('#c').focus();
  for (const key of arrows) await page.keyboard.down(key);
  await page.keyboard.press('Space');
  for (const key of [...arrows].reverse()) await page.keyboard.up(key);
  const keyboardAfter = await waitForShotResolution(keyboardBefore, `arrow aim + Space (${arrows.join(' + ')})`);
  if (keyboardAfter.stats.casts <= keyboardBefore.stats.casts) failures.push(`arrow aim + Space did not fire (${arrows.join(' + ')})`);
  if (keyboardAfter.stats.correct <= keyboardBefore.stats.correct) failures.push(`arrow aim + Space did not solve the nearest assisted puzzle step (${arrows.join(' + ')})`);
  if (keyboardAfter.aimSource !== 'keyboard') failures.push(`arrow aim lost keyboard authority: ${keyboardAfter.aimSource}`);
}

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
const gateBefore = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (gateBefore.portalOpen || gateBefore.portalReady) failures.push('world must start with a sealed gate');
const gateReady = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.completeRoom());
if (!gateReady.portalReady) failures.push(`solving room one should arm the portal shot, got phase=${gateReady.portalPhase}`);
if (gateReady.portalOpen) failures.push('solving puzzles must not automatically open the gate in v0.5');
if (gateReady.stones < gateReady.stoneQuota) failures.push(`gate armed without Mossglint quota: ${gateReady.stones}/${gateReady.stoneQuota}`);
await page.screenshot({ path: path.join(outputDir, 'gate-ready.png') });
await page.locator('#c').focus();
await page.keyboard.press('f');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().portalOpen === true, null, { timeout: 2500 });
const gateOpen = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (gateOpen.portalPhase !== 'open') failures.push(`F portal shot did not enter open extraction phase: ${gateOpen.portalPhase}`);
if (gateOpen.stats.portals < 1) failures.push('portal shot was not counted');
await page.screenshot({ path: path.join(outputDir, 'gate-open-extraction.png') });
const afterAdvance = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.advance());
if (afterAdvance.worldDepth !== 2 || afterAdvance.worldsCleared !== 1) failures.push(`portal transition should move only forward to depth 2, got depth=${afterAdvance.worldDepth}, cleared=${afterAdvance.worldsCleared}`);

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(9, 10));
const bossStart = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (!bossStart.boss || bossStart.boss.dead) failures.push('world 10 must spawn a live guardian');
if (bossStart.portalOpen || bossStart.portalReady) failures.push('guardian world gate must start sealed');
const bossDefeated = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.defeatBoss());
if (bossDefeated.portalOpen || bossDefeated.portalReady) failures.push('guardian defeat alone must not bypass unresolved arena puzzles');
if (!bossDefeated.boss?.dead) failures.push('guardian defeat helper did not defeat guardian');
const bossReady = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.completeRoom());
if (!bossReady.portalReady || bossReady.portalOpen) failures.push(`guardian world should arm but not auto-open after puzzles + boss + Mossglint, got ${bossReady.portalPhase}`);
if (bossReady.stones < bossReady.stoneQuota) failures.push('guardian room armed without enough Mossglint');
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.firePortal());
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().portalOpen === true, null, { timeout: 2500 });
const bossOpen = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.screenshot({ path: path.join(outputDir, 'guardian-extraction.png') });

await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(2, 3));
const early = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(2, 300));
const deep = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (deep.enemies.length <= early.enemies.length) failures.push(`depth 300 should have a larger encounter budget than depth 3 (${early.enemies.length} -> ${deep.enemies.length})`);
if (deep.worldDepth !== 300) failures.push('global run depth should not reset with the ten-room mechanic-template cycle');
await page.screenshot({ path: path.join(outputDir, 'deep-world-300.png') });

const replayPage = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
await replayPage.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?replay-contract=1`, { waitUntil: 'networkidle' });
await replayPage.evaluate(() => localStorage.removeItem('sid.mosslight.atlas-deck.v1'));
await replayPage.reload({ waitUntil: 'networkidle' });
await replayPage.waitForFunction(() => Boolean(window.MosslightExpedition));
const replayFirst = await replayPage.evaluate(() => window.MosslightExpedition.summary());
const replaySecond = await replayPage.evaluate(() => { window.MosslightExpedition.newRun(); return window.MosslightExpedition.summary(); });
const firstIndices = replayFirst.worlds.map((world) => world.index);
const secondIndices = replaySecond.worlds.map((world) => world.index);
const overlap = firstIndices.filter((index) => secondIndices.includes(index));
if (overlap.length) failures.push(`next real Atlas sector repeated unseen worlds early: ${overlap.join(',')}`);
if (replayFirst.deck?.cursor !== 10 || replaySecond.deck?.cursor !== 20) failures.push(`persistent deck should advance 10 -> 20, got ${replayFirst.deck?.cursor} -> ${replaySecond.deck?.cursor}`);
await replayPage.close();

await page.waitForTimeout(1200);
const final = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
if (final.fps < 42) failures.push(`runtime FPS too low: ${final.fps.toFixed(1)}`);
if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));

const report = {
  generatedAt: new Date().toISOString(), runtimeUrl, title: metadata.title, version: metadata.version,
  expedition: metadata.expedition, director: metadata.director,
  movement: { from: start.player, to: moved.player },
  aimContract: { pointerTarget, keyboardTarget },
  portalGate: { before: gateBefore, ready: gateReady, open: gateOpen, afterAdvance },
  guardian: { start: bossStart, defeated: bossDefeated, ready: bossReady, open: bossOpen },
  difficulty: { earlyEnemies: early.enemies.length, depth300Enemies: deep.enemies.length },
  replay: { firstIndices, secondIndices, overlap },
  finalFps: final.fps, consoleErrors, failures,
};
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();

if (failures.length) {
  console.error(`Sylvaria v0.5 browser playtest failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Sylvaria v0.5 PASS: explicit Mossglint gate shot, animated extraction portal, guardian lock, global difficulty, dual aim, persistent unseen Atlas sectors, and performance verified.');
