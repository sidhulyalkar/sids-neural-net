import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_SHIFT_BROWSER_DIR || 'artifacts/sylvaria-sequoia-shift-hold';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  { name: 'chrome-stable', browserType: chromium, launchOptions: { channel: 'chrome' } },
  { name: 'chromium', browserType: chromium, launchOptions: {} },
  { name: 'firefox', browserType: firefox, launchOptions: {} },
  { name: 'webkit', browserType: webkit, launchOptions: {} },
];

const results = [];
let failed = false;

async function focusRuntime(page, frame) {
  await frame.locator('#c').click();
  await frame.locator('#c').focus();
  await page.waitForFunction(() => document.documentElement.classList.contains('game-runtime-focused'));
  const focused = await frame.evaluate(() => document.hasFocus() && document.activeElement?.id === 'c');
  if (!focused) throw new Error('Sylvaria canvas did not receive keyboard focus');
}

async function state(frame) {
  return frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
}

async function telemetry(frame) {
  return frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry());
}

async function resetSameSeed(frame) {
  await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.retry());
  await frame.page().waitForTimeout(90);
}

async function runShiftHoldContract(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/sylvaria-sequoia`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Sylvaria route returned ${response?.status() ?? 'no response'}`);

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/sylvaria-sequoia/'));
  if (!frame) throw new Error('Sylvaria iframe did not attach');
  await frame.locator('#c').waitFor({ state: 'visible' });
  await focusRuntime(page, frame);

  await page.keyboard.press('Space');
  await page.waitForTimeout(110);
  const started = await state(frame);
  if (started.mode !== 'playing') throw new Error(`Space did not start Sylvaria: ${JSON.stringify(started)}`);

  await resetSameSeed(frame);
  await focusRuntime(page, frame);

  const before = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    target: window.SYLVARIA_SEQUOIA_DEBUG.getSapTarget(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if (!before.target) throw new Error(`Authored start has no reachable amber target: ${JSON.stringify(before.state)}`);

  const requestsBefore = before.state.jumpInput?.nextRequestId ?? -1;
  const pressesBefore = before.state.inputGate?.sapPressCount ?? 0;
  const castsBefore = before.telemetry.counters.sapStickCasts || 0;

  // The entire new contract begins with Shift alone. No Space chord is involved.
  await page.keyboard.down('Shift');
  await page.waitForTimeout(45);
  const locked = await state(frame);
  if (!locked.sapStick?.active || !locked.sapStick?.held) {
    throw new Error(`Shift alone did not immediately acquire Sap Stick: ${JSON.stringify(locked.sapStick)}`);
  }
  if ((locked.inputGate?.sapPressCount ?? 0) !== pressesBefore + 1) {
    throw new Error(`Shift press was not counted exactly once: ${JSON.stringify(locked.inputGate)}`);
  }
  if ((locked.jumpInput?.nextRequestId ?? -1) !== requestsBefore) {
    throw new Error(`Shift-only Sap Stick leaked into jump authority: ${JSON.stringify(locked.jumpInput)}`);
  }

  // Space while tethered must be inert for jump authority. It must never become
  // a hidden Air Kick that fires on or after the eventual Shift release.
  await page.keyboard.press('Space');
  await page.waitForTimeout(38);
  const afterSpace = await state(frame);
  if (!afterSpace.sapStick?.active || (afterSpace.jumpInput?.nextRequestId ?? -1) !== requestsBefore) {
    throw new Error(`Space leaked through active Sap Stick: ${JSON.stringify(afterSpace)}`);
  }

  // Right then left while Shift remains down must provide observable steering
  // authority. Comparing opposite inputs is robust against the spring's own
  // radial motion because the direct steering impulse changes sign with the key.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(105);
  const steeredRight = await state(frame);
  await page.keyboard.up('ArrowRight');
  if (!steeredRight.sapStick?.active || !steeredRight.inputGate?.physicalDown?.includes('ArrowRight')) {
    throw new Error(`Right steering did not remain inside the held tether: ${JSON.stringify(steeredRight)}`);
  }

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(135);
  const steeredLeft = await state(frame);
  await page.keyboard.up('ArrowLeft');
  if (!steeredLeft.sapStick?.active || !steeredLeft.inputGate?.physicalDown?.includes('ArrowLeft')) {
    throw new Error(`Left steering did not remain inside the held tether: ${JSON.stringify(steeredLeft)}`);
  }
  if (steeredLeft.player.vx >= steeredRight.player.vx - 70) {
    throw new Error(`Opposite A/D steering lacked meaningful swing authority: right=${steeredRight.player.vx}, left=${steeredLeft.player.vx}`);
  }

  // Releasing the same Shift press is the vault command.
  await page.keyboard.up('Shift');
  await page.waitForTimeout(110);
  const vaulted = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if (vaulted.state.sapStick?.active || vaulted.state.sapStick?.held) {
    throw new Error(`Shift release left Sap Stick attached: ${JSON.stringify(vaulted.state.sapStick)}`);
  }
  if ((vaulted.telemetry.counters.sapStickCasts || 0) < castsBefore + 1 || (vaulted.telemetry.counters.sapStickVaults || 0) < 1) {
    throw new Error(`Shift lifecycle did not record cast + vault: ${JSON.stringify(vaulted.telemetry.counters)}`);
  }
  if ((vaulted.state.jumpInput?.nextRequestId ?? -1) !== requestsBefore || vaulted.state.airJumps !== 1 || vaulted.state.player.vy <= 0) {
    throw new Error(`Shift release did not preserve clean vault recovery: ${JSON.stringify(vaulted.state)}`);
  }

  // 0 is intentionally far from the movement cluster and retries the same seed.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  const beforeZero = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  await page.keyboard.press('0');
  await page.waitForTimeout(95);
  const afterZero = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  if (afterZero.state.seed !== beforeZero.state.seed || afterZero.state.mode !== 'playing') {
    throw new Error(`0 did not retry the current seed: before=${JSON.stringify(beforeZero.state)}, after=${JSON.stringify(afterZero.state)}`);
  }
  if (afterZero.telemetry.runSeconds > 0.18 || afterZero.state.combo !== 0 || Math.abs(afterZero.state.player.x - 480) > 45) {
    throw new Error(`0 reset did not restore a fresh run: ${JSON.stringify(afterZero)}`);
  }

  // R is deliberately harmless now. A quick movement beat followed by R should
  // continue the same run instead of teleporting Pip back to the start.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  const beforeR = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  await page.keyboard.press('r');
  await page.waitForTimeout(95);
  const afterR = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  if (afterR.state.seed !== beforeR.state.seed || afterR.telemetry.runSeconds <= beforeR.telemetry.runSeconds) {
    throw new Error(`R still behaves like a reset: before=${JSON.stringify(beforeR)}, after=${JSON.stringify(afterR)}`);
  }
  if (Math.abs(afterR.state.player.x - 480) + 12 < Math.abs(beforeR.state.player.x - 480)) {
    throw new Error(`R pulled Pip back toward the reset spawn: beforeX=${beforeR.state.player.x}, afterX=${afterR.state.player.x}`);
  }

  await page.screenshot({ path: path.join(outputDir, `${engineName}-shift-hold-sap-stick.png`), fullPage: true });
  return {
    engine: engineName,
    ok: true,
    target: before.target,
    locked,
    afterSpace,
    steeredRight,
    steeredLeft,
    vaulted,
    afterZero,
    afterR,
  };
}

for (const { name, browserType, launchOptions } of engines) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    const result = await runShiftHoldContract(page, name);
    if (errors.length) throw new Error(errors.join('\n'));
    results.push(result);
  } catch (error) {
    failed = true;
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (failed) process.exit(1);
