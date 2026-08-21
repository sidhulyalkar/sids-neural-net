import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');
const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_BROWSER_DIR || 'artifacts/sylvaria-browser-matrix';
fs.mkdirSync(outputDir, { recursive: true });
const engines = [
  { name: 'chrome-stable', browserType: chromium, launchOptions: { channel: 'chrome' } },
  { name: 'chromium', browserType: chromium, launchOptions: {} },
  { name: 'firefox', browserType: firefox, launchOptions: {} },
  { name: 'webkit', browserType: webkit, launchOptions: {} },
];
const report = [];
let failed = false;

async function canvasStats(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#c');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return { ready: false, lit: 0, distinct: 0 };
    const colors = new Set();
    let lit = 0;
    for (let y = 30; y < canvas.height; y += 60) {
      for (let x = 30; x < canvas.width; x += 60) {
        const pixel = context.getImageData(x, y, 1, 1).data;
        colors.add(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        if (pixel[0] + pixel[1] + pixel[2] > 30 && pixel[3] > 0) lit += 1;
      }
    }
    return { ready: true, lit, distinct: colors.size };
  });
}

for (const { name, browserType, launchOptions } of engines) {
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    const response = await page.goto(`${baseUrl}/arcade/sylvaria`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`route returned ${response?.status() ?? 'no response'}`);
    const iframe = page.locator('iframe[title="Sylvaria game runtime"]');
    await iframe.waitFor({ state: 'visible' });
    const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/mosslight-v2/'));
    if (!frame) throw new Error('Sylvaria runtime iframe did not attach');
    await frame.waitForFunction(() => window.__SIDS_GAME_NETWORK_BRIDGE__ === true && window.__MOSSLIGHT_PLAYTEST__?.version === '0.8.1' && window.SylvariaVisualSystem?.version === '0.8.1');
    const identity = await frame.evaluate(() => ({
      version: window.__MOSSLIGHT_PLAYTEST__.version,
      title: window.__MOSSLIGHT_PLAYTEST__.title,
      roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
      visual: window.__MOSSLIGHT_PLAYTEST__.snapshot().visual,
      layout: (() => {
        const rect = document.getElementById('c')?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height, ratio: rect.width / rect.height } : null;
      })(),
    }));
    if (identity.title !== 'Sylvaria' || identity.version !== '0.8.1') throw new Error(`identity mismatch ${JSON.stringify(identity)}`);
    if (identity.roomCount !== 10) throw new Error(`authored room count mismatch ${identity.roomCount}`);
    if (!identity.visual?.playfieldAspectSafe || !identity.visual?.immersiveControl || !identity.visual?.routeGeometry || !identity.visual?.lockedIntentTelegraphs) throw new Error(`visual contract incomplete ${JSON.stringify(identity.visual)}`);
    if (!identity.layout || Math.abs(identity.layout.ratio - 1.5) > .02) throw new Error(`playfield lost 3:2 ratio ${JSON.stringify(identity.layout)}`);

    const titleStats = await canvasStats(frame);
    await frame.locator('#start').click();
    await frame.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');
    await frame.locator('#c').focus();
    const before = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
    await page.keyboard.press('d');
    await page.waitForTimeout(25);
    await page.keyboard.press('s');
    await page.waitForTimeout(260);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(140);
    const after = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
    if ((after.player?.x ?? 0) <= (before.player?.x ?? 0) + 30) throw new Error(`east step failed ${before.player?.x} -> ${after.player?.x}`);
    if ((after.player?.y ?? 0) <= (before.player?.y ?? 0) + 30) throw new Error(`buffered south step failed ${before.player?.y} -> ${after.player?.y}`);
    if (after.stats.dashes < before.stats.dashes + 2) throw new Error(`buffered cardinal movement lost a step (${before.stats.dashes} -> ${after.stats.dashes})`);
    if (after.stats.cuts <= before.stats.cuts) throw new Error('ArrowUp did not register an independent machete cut');
    const playStats = await canvasStats(frame);
    if (!playStats.ready || playStats.distinct < 8 || playStats.lit < 20) throw new Error(`canvas under-rendered ${JSON.stringify(playStats)}`);
    await page.screenshot({ path: path.join(outputDir, `${name}-countercut-v081.png`), fullPage: true });
    report.push({ name, ok: true, identity, titleStats, playStats, movement: [before.player?.x, before.player?.y, after.player?.x, after.player?.y], dashes: after.stats.dashes - before.stats.dashes, cuts: after.stats.cuts - before.stats.cuts, fps: after.fps });
  } catch (error) {
    failed = true;
    report.push({ name, ok: false, error: error instanceof Error ? error.message : String(error), errors });
  } finally {
    await browser?.close();
  }
}
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
if (failed) {
  console.error('Sylvaria cross-browser matrix failed');
  for (const result of report.filter((entry) => !entry.ok)) console.error(` - ${result.name}: ${result.error}`);
  process.exit(1);
}
console.log(`Sylvaria Countercut v0.8.1 browser matrix PASS: ${report.map((entry) => entry.name).join(', ')}.`);
