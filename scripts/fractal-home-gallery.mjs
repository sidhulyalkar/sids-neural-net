import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.FRACTAL_HOME_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.FRACTAL_HOME_GALLERY_DIR || 'artifacts/adaptive-fractal-home/gallery';
fs.mkdirSync(outputDir, { recursive: true });

const cases = [
  { morph: 'tectonic', width: 2560, height: 1080 },
  { morph: 'radial', width: 1920, height: 1080 },
  { morph: 'coral', width: 1920, height: 1080 },
  { morph: 'fan', width: 2560, height: 1080 },
  { morph: 'spiraloid', width: 1024, height: 1024 },
  { morph: 'halo', width: 390, height: 844 },
  { morph: 'echidna', width: 430, height: 932 },
  { morph: 'apical', width: 430, height: 932 },
  { morph: 'pixel-ghost', width: 800, height: 800 },
  { morph: 'echo-nest', width: 1440, height: 900 },
];

const removedMorphologies = ['aurora', 'mycelial'];
const browser = await chromium.launch({ headless: true });
const failures = [];
const reports = [];

for (const testCase of cases) {
  const page = await browser.newPage({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const url = `${baseUrl}/?morph=${encodeURIComponent(testCase.morph)}&seed=gallery-v4`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const root = page.locator('[data-fractal-morphology]');
  await root.waitFor({ state: 'visible' });
  await page.waitForFunction(
    (morph) => document.querySelector('[data-fractal-morphology]')?.getAttribute('data-fractal-morphology') === morph,
    testCase.morph
  );

  const actualMorph = await root.getAttribute('data-fractal-morphology');
  const links = page.locator('[data-dendrite-destination]');
  const linkCount = await links.count();
  const boxes = [];
  for (let index = 0; index < linkCount; index += 1) {
    const box = await links.nth(index).boundingBox();
    if (!box) continue;
    boxes.push(box);
    const inside =
      box.x >= -0.5 &&
      box.y >= -0.5 &&
      box.x + box.width <= testCase.width + 0.5 &&
      box.y + box.height <= testCase.height + 0.5;
    if (!inside) failures.push(`${testCase.morph}: destination ${index} escaped viewport`);
  }

  if (actualMorph !== testCase.morph) failures.push(`${testCase.morph}: rendered ${actualMorph}`);
  if (linkCount !== 8) failures.push(`${testCase.morph}: expected 8 destinations, got ${linkCount}`);
  if (pageErrors.length) failures.push(`${testCase.morph}: page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) failures.push(`${testCase.morph}: console errors: ${consoleErrors.join(' | ')}`);

  const minX = boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((box) => box.x + box.width)) : 0;
  const span = maxX - minX;
  if (testCase.width >= 1400 && span < testCase.width * 0.66) {
    failures.push(`${testCase.morph}: horizontal destination span only ${Math.round(span)}px`);
  }

  const filename = `${testCase.morph}-${testCase.width}x${testCase.height}.png`;
  await page.screenshot({ path: path.join(outputDir, filename) });
  reports.push({ ...testCase, actualMorph, linkCount, horizontalDestinationSpan: span, filename });
  await page.close();
}

for (const removedMorph of removedMorphologies) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/?morph=${removedMorph}&seed=removed-v4`, { waitUntil: 'networkidle' });
  const root = page.locator('[data-fractal-morphology]');
  await root.waitFor({ state: 'visible' });
  const actualMorph = await root.getAttribute('data-fractal-morphology');
  if (!actualMorph || actualMorph === removedMorph) {
    failures.push(`${removedMorph}: removed morphology remained publicly renderable`);
  }
  reports.push({ morph: removedMorph, removed: true, actualMorph });
  await page.close();
}

await browser.close();
fs.writeFileSync(
  path.join(outputDir, 'gallery-report.json'),
  `${JSON.stringify({ failures, reports }, null, 2)}\n`
);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Captured ${cases.length} curated fractal morphology fixtures and verified ${removedMorphologies.length} removals.`);
