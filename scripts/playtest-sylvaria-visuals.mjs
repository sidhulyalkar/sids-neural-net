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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const failures = [];
const consoleErrors = [];
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?visual-qa=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.SylvariaVisualSystem) && Boolean(window.SylvariaRenderBudget) && Boolean(window.SylvariaDisplayScale) && Boolean(window.MosslightExpedition));
await page.evaluate(() => localStorage.removeItem('sid.mosslight.atlas-deck.v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && window.__MOSSLIGHT_PLAYTEST__.version === '0.7.0' && Boolean(window.SylvariaVisualSystem));

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
    const logicalWidth = Number(canvas.dataset.logicalWidth || 960);
    const logicalHeight = Number(canvas.dataset.logicalHeight || 640);
    const scale = canvas.width / logicalWidth;
    for (let y = 24; y < logicalHeight; y += 40) {
      for (let x = 24; x < logicalWidth; x += 40) {
        const pixel = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        colors.add(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        if (pixel[0] + pixel[1] + pixel[2] > 38 && pixel[3] > 0) lit += 1;
        checksum = (checksum + pixel[0] * 3 + pixel[1] * 5 + pixel[2] * 7 + pixel[3]) % 1_000_000_007;
      }
    }
    return { distinct: colors.size, lit, checksum };
  });
}

async function layoutStats() {
  return page.evaluate(() => {
    const canvas = document.getElementById('c');
    const backdrop = document.getElementById('sylWorldBackdrop');
    const overlay = document.getElementById('sylVisualOverlay');
    const canvasRect = canvas?.getBoundingClientRect();
    const backdropRect = backdrop?.getBoundingClientRect();
    const overlayRect = overlay?.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      canvas: canvasRect ? [canvasRect.x, canvasRect.y, canvasRect.width, canvasRect.height] : null,
      overlay: overlayRect ? [overlayRect.x, overlayRect.y, overlayRect.width, overlayRect.height] : null,
      backdrop: backdropRect ? [backdropRect.x, backdropRect.y, backdropRect.width, backdropRect.height] : null,
      backing: canvas ? [canvas.width, canvas.height] : null,
      display: window.SylvariaDisplayScale || null,
      visual: window.__MOSSLIGHT_PLAYTEST__?.snapshot().visual || null,
    };
  });
}

function validateLayout(stats, label) {
  if (!stats.canvas || !stats.overlay || !stats.backdrop) {
    failures.push(`${label}: missing immersion canvas plane: ${JSON.stringify(stats)}`);
    return;
  }
  const [, , cw, ch] = stats.canvas;
  const [, , ow, oh] = stats.overlay;
  const [, , bw, bh] = stats.backdrop;
  if (Math.abs(cw / ch - 1.5) > 0.012) failures.push(`${label}: gameplay playfield stretched: ${cw}x${ch}`);
  if (Math.abs(ow / oh - 1.5) > 0.012) failures.push(`${label}: visual overlay stretched: ${ow}x${oh}`);
  if (Math.abs(cw - ow) > 2 || Math.abs(ch - oh) > 2) failures.push(`${label}: gameplay/visual planes drifted apart: ${JSON.stringify({ canvas: stats.canvas, overlay: stats.overlay })}`);
  if (Math.abs(bw - stats.viewport[0]) > 2 || Math.abs(bh - stats.viewport[1]) > 2) failures.push(`${label}: full-device backdrop does not fill viewport: ${JSON.stringify(stats)}`);
  if (!stats.visual?.playfieldAspectSafe || !stats.visual?.backdropCanvas || !stats.visual?.immersiveControl) failures.push(`${label}: v0.7 immersion telemetry incomplete: ${JSON.stringify(stats.visual)}`);
}

for (let batch = 0; batch < 100 && Object.keys(captures).length < requiredThemes.length; batch += 1) {
  const rooms = await page.evaluate(() => window.MosslightContent.rooms.map((room, index) => ({
    index,
    title: room.title,
    atlasIndex: room.atlas?.index,
    collection: room.atlas?.collection,
    terrain: room.atlas?.terrain,
    atmosphere: room.atlas?.scene?.atmosphere,
    theme: window.SylvariaVisualSystem.classifyTheme(room).id,
  })));
  inspectedWorlds += rooms.length;

  for (const room of rooms) {
    if (!requiredThemes.includes(room.theme) || captures[room.theme]) continue;
    const depth = batch * 10 + room.index + 1;
    await page.evaluate(({ index, depth }) => window.__MOSSLIGHT_PLAYTEST__.setRoom(index, depth), { index: room.index, depth });
    await page.waitForFunction((expected) => window.__MOSSLIGHT_PLAYTEST__.snapshot().visual?.theme === expected, room.theme, { timeout: 2_500 });
    await page.waitForTimeout(220);
    const stats = await canvasStats();
    if (stats.distinct < 14 || stats.lit < 28) failures.push(`${room.theme} world under-rendered: ${JSON.stringify(stats)}`);
    const visual = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().visual);
    if (room.theme === 'celestial' && room.collection !== 'celestial') {
      failures.push(`celestial fixture must prove the canonical Atlas collection path, got ${room.collection}`);
    }
    const file = path.join(outputDir, `${room.theme}-widescreen.png`);
    await page.screenshot({ path: file });
    captures[room.theme] = { ...room, depth, stats, visual, file: path.basename(file) };
  }

  if (Object.keys(captures).length < requiredThemes.length) {
    await page.evaluate(() => window.MosslightExpedition.newRun());
    await page.waitForTimeout(35);
  }
}

for (const theme of requiredThemes) {
  if (!captures[theme]) failures.push(`no actual ${theme} Atlas world found/rendered while scanning ${inspectedWorlds} worlds`);
}

const viewportFixtures = [];
for (const fixture of [
  { name: 'native-3x2', width: 960, height: 640 },
  { name: 'widescreen', width: 1920, height: 1080 },
  { name: 'portrait', width: 390, height: 844 },
]) {
  await page.setViewportSize({ width: fixture.width, height: fixture.height });
  await page.waitForTimeout(180);
  const layout = await layoutStats();
  validateLayout(layout, fixture.name);
  await page.screenshot({ path: path.join(outputDir, `${fixture.name}.png`) });
  viewportFixtures.push({ ...fixture, layout });
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => window.SylvariaRenderBudget.setPreference('performance'));
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().visual?.quality?.tier === 'performance');
await page.waitForTimeout(160);
const performanceSnapshot = await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
await page.screenshot({ path: path.join(outputDir, 'performance-tier.png') });
if (performanceSnapshot.visual?.quality?.blurCap > 1) failures.push(`performance blur cap too high: ${performanceSnapshot.visual?.quality?.blurCap}`);
if (performanceSnapshot.visual?.backgroundParticles > 72) failures.push(`performance scene model exceeds particle contract: ${performanceSnapshot.visual?.backgroundParticles}`);
if (!performanceSnapshot.visual?.backdropCanvas || !performanceSnapshot.visual?.playfieldAspectSafe) failures.push('performance tier lost immersive canvas contract');
await page.evaluate(() => window.SylvariaRenderBudget.setPreference('auto'));

const retinaPage = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await retinaPage.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?retina-qa=1`, { waitUntil: 'networkidle' });
await retinaPage.waitForFunction(() => Boolean(window.SylvariaDisplayScale) && Boolean(window.__MOSSLIGHT_PLAYTEST__));
const retina = await retinaPage.evaluate(() => {
  const canvas = document.getElementById('c');
  const rect = canvas?.getBoundingClientRect();
  return {
    display: window.SylvariaDisplayScale,
    backing: canvas ? [canvas.width, canvas.height] : null,
    css: rect ? [rect.width, rect.height] : null,
  };
});
if (retina.display?.scale !== 2 || retina.backing?.[0] !== 1920 || retina.backing?.[1] !== 1280) {
  failures.push(`DPR2 sharpness contract failed: ${JSON.stringify(retina)}`);
}
if (!retina.css || Math.abs(retina.css[0] / retina.css[1] - 1.5) > 0.012) failures.push(`DPR2 CSS playfield stretched: ${JSON.stringify(retina)}`);
await retinaPage.screenshot({ path: path.join(outputDir, 'retina-2x.png') });
await retinaPage.close();

if (consoleErrors.length) failures.push(...consoleErrors.map((error) => `console error: ${error}`));
const report = {
  generatedAt: new Date().toISOString(),
  inspectedWorlds,
  requiredThemes,
  captures,
  viewportFixtures,
  retina,
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
console.log(`Sylvaria visual QA PASS: ${requiredThemes.join(', ')} rendered from real Atlas worlds across 3:2, widescreen, portrait, DPR2, and performance fixtures.`);
