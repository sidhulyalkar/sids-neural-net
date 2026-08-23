import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_HOME_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.ARCADE_HOME_PLAYTEST_DIR || 'artifacts/arcade-home-playtest';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const viewport of [
  { name: 'mobile', width: 390, height: 844, minSpan: 0.62 },
  { name: 'desktop', width: 1440, height: 900, minSpan: 0.72 },
  { name: 'fullhd', width: 1920, height: 1080, minSpan: 0.76 },
  { name: 'ultrawide', width: 2560, height: 1080, minSpan: 0.78 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', (error) => failures.push(`${viewport.name} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.locator('[data-fractal-morphology]:not([data-fractal-morphology="measuring"])').waitFor();

  const destinations = page.locator('a[data-dendrite-destination]');
  if ((await destinations.count()) !== 8) {
    failures.push(`${viewport.name}: expected eight homepage dendrite destinations`);
  }

  const branchCount = await page.locator('[data-home-branch-count]').getAttribute('data-home-branch-count');
  if (branchCount !== '8') failures.push(`${viewport.name}: expected eight primary homepage dendrites, got ${branchCount}`);

  const boxes = [];
  for (let index = 0; index < (await destinations.count()); index += 1) {
    const destination = destinations.nth(index);
    if (!(await destination.isVisible())) {
      failures.push(`${viewport.name}: dendrite destination ${index} is not visible`);
      continue;
    }
    const box = await destination.boundingBox();
    if (!box) {
      failures.push(`${viewport.name}: dendrite destination ${index} has no rendered bounding box`);
      continue;
    }
    const insideViewport =
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width &&
      box.y + box.height <= viewport.height;
    if (!insideViewport) failures.push(`${viewport.name}: dendrite destination ${index} is outside the viewport`);
    boxes.push(box);
  }

  if (boxes.length === 8) {
    const left = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const span = right - left;
    if (span < viewport.width * viewport.minSpan) {
      failures.push(
        `${viewport.name}: dendrite destinations span only ${(span / viewport.width).toFixed(3)} of viewport width`
      );
    }
  }

  const cta = page.locator('a[data-dendrite-destination="games"]');
  if ((await cta.count()) !== 1) {
    failures.push(`${viewport.name}: expected exactly one homepage Game Network dendrite CTA`);
  } else {
    const href = await cta.getAttribute('href');
    if (href !== '/arcade') failures.push(`${viewport.name}: homepage Game Network CTA href is ${href}`);
  }

  const morphology = await page.locator('[data-fractal-morphology]').getAttribute('data-fractal-morphology');
  const fractalDimension = await page.locator('[data-fractal-dimension]').getAttribute('data-fractal-dimension');
  await page.screenshot({ path: path.join(outputDir, `home-${viewport.name}-${morphology || 'unknown'}.png`) });

  if (!fractalDimension || Number.isNaN(Number(fractalDimension))) {
    failures.push(`${viewport.name}: missing generated fractal dimension metadata`);
  }

  if ((await cta.count()) === 1) {
    await cta.click();
    await page.waitForURL('**/arcade');
    if (!page.url().endsWith('/arcade')) failures.push(`${viewport.name}: Game Network CTA did not navigate to /arcade`);
  }

  if (consoleErrors.length) failures.push(`${viewport.name}: console errors: ${consoleErrors.join(' | ')}`);
  await page.close();
}

await browser.close();

const report = { failures };
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Adaptive homepage dendrites are visible, bounded, wide-filling, eight-way, and route to Game Network.');
