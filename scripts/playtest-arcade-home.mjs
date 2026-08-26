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

const viewports = [
  { name: 'tiny-mobile', width: 320, height: 568, minSpan: 0.56 },
  { name: 'short-landscape', width: 812, height: 375, minSpan: 0.62 },
  { name: 'mobile', width: 390, height: 844, minSpan: 0.58 },
  { name: 'tablet', width: 768, height: 1024, minSpan: 0.64 },
  { name: 'desktop', width: 1440, height: 900, minSpan: 0.66 },
  { name: 'fullhd', width: 1920, height: 1080, minSpan: 0.7 },
  { name: 'ultrawide', width: 2560, height: 1080, minSpan: 0.72 },
  { name: 'wide-4k-class', width: 3440, height: 1440, minSpan: 0.72 },
];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', (error) => failures.push(`${viewport.name} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.locator('[data-fractal-morphology]:not([data-fractal-morphology="measuring"])').waitFor();
  await page.waitForFunction(
    (expected) =>
      document.querySelector('[data-fractal-morphology]')?.getAttribute('data-fractal-responsive-viewport') === expected,
    `${viewport.width}x${viewport.height}`
  );

  const root = page.locator('[data-fractal-morphology]');
  const destinations = page.locator('a[data-dendrite-destination]');
  if ((await destinations.count()) !== 8) {
    failures.push(`${viewport.name}: expected eight homepage dendrite destinations`);
  }

  const branchCount = await page.locator('[data-home-branch-count]').getAttribute('data-home-branch-count');
  if (branchCount !== '8') failures.push(`${viewport.name}: expected eight primary homepage dendrites, got ${branchCount}`);

  if ((await root.getAttribute('data-fractal-responsive-envelope')) !== 'v16') {
    failures.push(`${viewport.name}: responsive envelope v16 is not active`);
  }
  if ((await root.getAttribute('data-fractal-boundary-policy')) !== 'elliptic-radial-cap-v16') {
    failures.push(`${viewport.name}: responsive boundary policy is not active`);
  }

  const scaleX = Number(await root.getAttribute('data-fractal-field-scale-x'));
  const scaleY = Number(await root.getAttribute('data-fractal-field-scale-y'));
  if (!(scaleX >= 0.8 && scaleX <= 0.92)) failures.push(`${viewport.name}: invalid responsive X scale ${scaleX}`);
  if (!(scaleY >= 0.79 && scaleY <= 0.91)) failures.push(`${viewport.name}: invalid responsive Y scale ${scaleY}`);

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
    const reserve = viewport.width <= 360 ? 2 : 4;
    const insideViewport =
      box.x >= reserve &&
      box.y >= reserve &&
      box.x + box.width <= viewport.width - reserve &&
      box.y + box.height <= viewport.height - reserve;
    if (!insideViewport) failures.push(`${viewport.name}: dendrite destination ${index} is outside the viewport reserve`);
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

  const responsiveCanvas = page.locator('[data-fractal-responsive-canvas="v16"]');
  if ((await responsiveCanvas.count()) !== 1 || !(await responsiveCanvas.isVisible())) {
    failures.push(`${viewport.name}: responsive fractal canvas is missing`);
  }

  const cta = page.locator('a[data-dendrite-destination="games"]');
  if ((await cta.count()) !== 1) {
    failures.push(`${viewport.name}: expected exactly one homepage Game Network dendrite CTA`);
  } else {
    const href = await cta.getAttribute('href');
    if (href !== '/arcade') failures.push(`${viewport.name}: homepage Game Network CTA href is ${href}`);
  }

  const morphology = await root.getAttribute('data-fractal-morphology');
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

console.log('Adaptive homepage dendrites are responsive, boundary-safe, eight-way, and route to Game Network.');
