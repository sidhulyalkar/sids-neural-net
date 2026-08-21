import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.ARCADE_BROWSER_DIR || 'artifacts/arcade-browser-matrix';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];

const report = [];
let failed = false;

function canvasStats(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#c');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return { ready: false, distinct: 0, lit: 0, checksum: 0 };

    const samples = [];
    let lit = 0;
    let checksum = 0;
    for (let y = 24; y < canvas.height; y += 48) {
      for (let x = 24; x < canvas.width; x += 48) {
        const pixel = context.getImageData(x, y, 1, 1).data;
        samples.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        if (pixel[0] + pixel[1] + pixel[2] > 35 && pixel[3] > 0) lit += 1;
        checksum = (checksum + pixel[0] * 3 + pixel[1] * 5 + pixel[2] * 7 + pixel[3]) % 1_000_000_007;
      }
    }
    return { ready: true, distinct: new Set(samples).size, lit, checksum };
  });
}

async function assertPainted(frame, label, minimumDistinct = 8, minimumLit = 20) {
  const stats = await canvasStats(frame);
  if (!stats.ready || stats.distinct < minimumDistinct || stats.lit < minimumLit) {
    throw new Error(`${label} canvas under-rendered: ${JSON.stringify(stats)}`);
  }
  return stats;
}

async function assertGameFocus(page, target, label) {
  await target.click();
  await page.waitForFunction(
    () => document.documentElement.classList.contains('game-runtime-focused'),
    null,
    { timeout: 5_000 }
  );

  const cursorState = await page.evaluate(() => ({
    focused: document.documentElement.classList.contains('game-runtime-focused'),
    cursorDisplay: document.querySelector('.neuron-cursor-overlay')
      ? getComputedStyle(document.querySelector('.neuron-cursor-overlay')).display
      : 'not-rendered',
  }));

  if (!cursorState.focused) throw new Error(`${label}: host did not enter game focus mode`);
  if (cursorState.cursorDisplay !== 'none' && cursorState.cursorDisplay !== 'not-rendered') {
    throw new Error(`${label}: neural cursor remained visible during game focus (${cursorState.cursorDisplay})`);
  }
}

async function assertCanvasKeyboardFocus(frame, label) {
  const canvas = frame.locator('#c');
  await canvas.click({ position: { x: 480, y: 320 } });
  const focus = await frame.evaluate(() => ({
    documentHasFocus: document.hasFocus(),
    activeElementId: document.activeElement?.id || null,
  }));
  if (!focus.documentHasFocus || focus.activeElementId !== 'c') {
    throw new Error(`${label}: canvas keyboard focus failed: ${JSON.stringify(focus)}`);
  }
}

async function testMosslight(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/mosslight`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Mosslight route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="Mosslight game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('Mosslight same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/mosslight-v2/'));
  if (!frame) throw new Error('Mosslight iframe did not attach');

  await frame.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__), null, { timeout: 10_000 });
  await frame.locator('#title').waitFor({ state: 'visible' });
  await frame.locator('#start').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);

  const initial = await assertPainted(frame, 'Mosslight title');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-mosslight-title.png`), fullPage: true });

  // Click the actual control inside the frame. This verifies the host's
  // document-level capture bridge, including Firefox's iframe focus model.
  await assertGameFocus(page, frame.locator('#start'), 'Mosslight');
  await frame.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.snapshot().mode === 'playing');
  await assertCanvasKeyboardFocus(frame, 'Mosslight');

  const before = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  await page.keyboard.up('d');
  await page.waitForTimeout(120);
  const after = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());

  if ((after.player?.x ?? 0) <= (before.player?.x ?? 0) + 8) {
    throw new Error(`Mosslight keyboard input failed (${before.player?.x} -> ${after.player?.x})`);
  }

  const playing = await assertPainted(frame, 'Mosslight playing');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-mosslight-playing.png`), fullPage: true });
  return { initial, playing, movement: [before.player?.x, after.player?.x], fps: after.fps };
}

async function testStretchicorn(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/stretchicorn`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Stretchicorn route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="Stretchicorn game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('Stretchicorn same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/stretchicorn/'));
  if (!frame) throw new Error('Stretchicorn iframe did not attach');

  await frame.locator('#c').waitFor({ state: 'visible' });
  await page.waitForTimeout(350);

  const initial = await assertPainted(frame, 'Stretchicorn title');
  const initialMode = await frame.evaluate(() => eval('mode'));
  if (initialMode !== 0) throw new Error(`Stretchicorn expected title mode 0, got ${initialMode}`);

  await page.screenshot({ path: path.join(outputDir, `${engineName}-stretchicorn-title.png`), fullPage: true });
  await assertGameFocus(page, frame.locator('#c'), 'Stretchicorn');
  await assertCanvasKeyboardFocus(frame, 'Stretchicorn');
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  const playingMode = await frame.evaluate(() => eval('mode'));
  if (playingMode !== 1) throw new Error(`Stretchicorn did not enter gameplay after Space; mode=${playingMode}`);

  const playing = await assertPainted(frame, 'Stretchicorn playing');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-stretchicorn-playing.png`), fullPage: true });
  return { initial, playing, modes: [initialMode, playingMode] };
}

async function testUniRico(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/unirico`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`uniRico route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="uniRico game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('uniRico same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/unirico/'));
  if (!frame) throw new Error('uniRico iframe did not attach');

  await frame.locator('#c').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  const initial = await assertPainted(frame, 'uniRico title', 4, 8);
  await assertGameFocus(page, frame.locator('#c'), 'uniRico');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-unirico.png`), fullPage: true });
  return { initial };
}

for (const [engineName, browserType] of engines) {
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    const mosslight = await testMosslight(page, engineName);
    const stretchicorn = await testStretchicorn(page, engineName);
    const unirico = await testUniRico(page, engineName);

    if (errors.length) throw new Error(errors.join('\n'));
    report.push({ engine: engineName, ok: true, mosslight, stretchicorn, unirico });
  } catch (error) {
    failed = true;
    report.push({
      engine: engineName,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      errors,
    });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failed) process.exit(1);
