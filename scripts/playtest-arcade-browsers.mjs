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

for (const [name, browserType] of engines) {
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    const response = await page.goto(`${baseUrl}/arcade/mosslight`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`arcade route returned ${response?.status() ?? 'no response'}`);

    const iframe = page.locator('iframe[title="Mosslight game runtime"]');
    await iframe.waitFor({ state: 'visible' });
    const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/mosslight-v2/'));
    if (!frame) throw new Error('Mosslight iframe did not attach');

    await frame.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__), null, { timeout: 10_000 });
    await frame.locator('#title').waitFor({ state: 'visible' });
    await frame.locator('#start').waitFor({ state: 'visible' });

    const initial = await frame.evaluate(() => {
      const canvas = document.querySelector('#c');
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return { canvasReady: false };

      const points = [];
      for (let y = 40; y < canvas.height; y += 80) {
        for (let x = 40; x < canvas.width; x += 80) {
          const pixel = context.getImageData(x, y, 1, 1).data;
          points.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        }
      }

      const title = document.querySelector('#title');
      const start = document.querySelector('#start');
      const style = title ? getComputedStyle(title) : null;
      return {
        canvasReady: true,
        distinctCanvasSamples: new Set(points).size,
        titleDisplay: style?.display,
        titleVisibility: style?.visibility,
        titleOpacity: style?.opacity,
        startText: start?.textContent?.trim(),
        runtime: window.__MOSSLIGHT_PLAYTEST__.snapshot(),
      };
    });

    if (!initial.canvasReady) throw new Error('2D canvas context unavailable');
    if ((initial.distinctCanvasSamples ?? 0) < 8) {
      throw new Error(`canvas appears blank or under-rendered (${initial.distinctCanvasSamples} distinct samples)`);
    }
    if (!initial.startText?.toLowerCase().includes('dew garden')) throw new Error('start control did not render');

    await page.screenshot({ path: path.join(outputDir, `${name}-mosslight-title.png`), fullPage: true });

    await frame.locator('#start').click();
    await frame.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.snapshot().mode === 'playing');
    const before = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());

    await frame.locator('#c').click({ position: { x: 450, y: 320 } });
    await page.keyboard.down('d');
    await page.waitForTimeout(350);
    await page.keyboard.up('d');
    await page.waitForTimeout(100);

    const after = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
    if ((after.player?.x ?? 0) <= (before.player?.x ?? 0) + 8) {
      throw new Error(`keyboard input did not move Sprig (${before.player?.x} -> ${after.player?.x})`);
    }

    const playingPixels = await frame.evaluate(() => {
      const canvas = document.querySelector('#c');
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return 0;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4 * 256) {
        if (data[i] + data[i + 1] + data[i + 2] > 35 && data[i + 3] > 0) nonBlack += 1;
      }
      return nonBlack;
    });
    if (playingPixels < 100) throw new Error(`playing scene appears blank (${playingPixels} sampled lit pixels)`);

    await page.screenshot({ path: path.join(outputDir, `${name}-mosslight-playing.png`), fullPage: true });

    if (errors.length) throw new Error(errors.join('\n'));

    report.push({
      engine: name,
      ok: true,
      distinctCanvasSamples: initial.distinctCanvasSamples,
      movement: [before.player?.x, after.player?.x],
      fps: after.fps,
    });
  } catch (error) {
    failed = true;
    report.push({ engine: name, ok: false, error: error instanceof Error ? error.message : String(error), errors });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failed) process.exit(1);
