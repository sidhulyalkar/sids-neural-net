import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.SYLVARIA_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_VISUAL_DIR || 'artifacts/sylvaria-visual-qa';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
const failures = [];
const consoleErrors = [];
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?visual-qa=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.SylvariaVisualSystem) && Boolean(window.SylvariaRenderBudget) && Boolean(window.MosslightExpedition));
await page.evaluate(() => localStorage.removeItem('sid.mosslight.atlas-deck.v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.SylvariaVisualSystem));

const requiredThemes = ['forest', 'volcanic', 'reef', 'ice', 'celestial'];
const captures = {};
let inspectedWorlds = 0;

async function canvasStats() {
  return page.evaluate(() => {
    const canvas = document.getElementById('c');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return { distinct: 0, lit: 0, checksum: 0 };
    const colors = new Set();
    let lit = 0;
    let checksum = 0;
    for (let y = 24; y < canvas.height; y += 40) {
      for (let x = 24; x < canvas.width; x += 40) {
        const pixel = context.getImageData(x, y, 1, 1).data;
        colors.add(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        if (pixel[0] + pixel[1] + pixel[2] > 38 && pixel[3] > 0) lit += 1;
        checksum = (checksum + pixel[0] * 3 + pixel[1] * 5 + pixel[2] * 7 + pixel[3]) % 1_000_000_007;
      }
    }
    return { distinct: colors.size, lit, checksum };
  });
}

for (let batch = 0; batch < 100 && Object.keys(captures).length < requiredThemes.length; batch += 1) {
  const rooms = await page.evaluate(() => window.MosslightContent.rooms.map((room, index) => ({
    index,
    title: room.title,
    atlasIndex: room.atlas?.index,
    terrain: room.atlas?.terrain,
    theme: window.SylvariaVisualSystem.classifyTheme(room).id,
  })));
  inspectedWorlds += rooms.length;

  for (const room of rooms) {
    if (!requiredThemes.includes(room.theme) || captures[room.theme]) continue;
    const depth = batch * 10 + room.index + 1;
    await page.evaluate(({ index, depth }) => window.__MOSSLIGHT_PLAYTEST__.setRoom(index, depth), { index: room.index, depth });
    await page.waitForFunction((expected) => window.__MOSSLIGHT_PLAYTEST__.snapshot().visual?.theme === expected, room.theme, { timeout: 2_500 });
    await page.waitForTimeout(180);
    const stats = await canvasStats();
    if (stats.distinct < 14 || stats.lit < 28) {
      failures.push(`${room.theme} world under-rendered: ${JSON.stringify(stats)}`);
    }
    const visual = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().visual);
    const file = path.join(outputDir, `${room.theme}.png`);
    await page.screenshot({ path: file });
    captures[room.theme] = { ...room, depth, stats, visual, file: path.basename(file) };
  }

  if (Object.keys(captures).length < requiredThemes.length) {
    await page.evaluate(() => window.MosslightExpedition.newRun());
    await page.waitForTimeout(30);
  }
}

for (const theme of requiredThemes) {
  if (!captures[theme]) failures.push(`no actual ${theme} Atlas world found/rendered while scanning ${inspectedWorlds} worlds`);
}

await page.evaluate(() => window.SylvariaRenderBudget.setPreference('performance'));
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().visual?.quality?.tier === 'performance');
await page.waitForTimeout(120);
const performanceSnapshot = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.screenshot({ path: path.join(outputDir, 'performance-tier.png') });
if (performanceSnapshot.visual?.quality?.blurCap > 1) failures.push(`performance blur cap too high: ${performanceSnapshot.visual?.quality?.blurCap}`);
if (performanceSnapshot.visual?.motifCount > 1) failures.push(`performance motif budget too high: ${performanceSnapshot.visual?.motifCount}`);
await page.evaluate(() => window.SylvariaRenderBudget.setPreference('auto'));

if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));
const report = {
  generatedAt: new Date().toISOString(),
  inspectedWorlds,
  requiredThemes,
  captures,
  performance: performanceSnapshot.visual,
  consoleErrors,
  failures,
};
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();

if (failures.length) {
  console.error(`Sylvaria visual QA failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Sylvaria visual QA PASS: ${requiredThemes.join(', ')} rendered from real Atlas worlds with crisp adaptive-quality fixtures.`);
