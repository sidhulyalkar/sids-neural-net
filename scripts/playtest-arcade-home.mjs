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
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', (error) => failures.push(`${viewport.name} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const cta = page.locator('a[data-dendrite-destination="games"]');

  if ((await cta.count()) !== 1) {
    failures.push(`${viewport.name}: expected exactly one homepage Game Network dendrite CTA`);
  } else {
    if (!(await cta.isVisible())) failures.push(`${viewport.name}: homepage Game Network dendrite CTA is not visible`);
    const href = await cta.getAttribute('href');
    if (href !== '/arcade') failures.push(`${viewport.name}: homepage Game Network CTA href is ${href}`);

    const box = await cta.boundingBox();
    if (!box) {
      failures.push(`${viewport.name}: homepage Game Network dendrite CTA has no rendered bounding box`);
    } else {
      const insideViewport =
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height;
      if (!insideViewport) failures.push(`${viewport.name}: homepage Game Network dendrite CTA is outside the viewport`);
    }

    const branchCount = await page.locator('[data-home-branch-count]').getAttribute('data-home-branch-count');
    if (branchCount !== '8') failures.push(`${viewport.name}: expected eight primary homepage dendrites, got ${branchCount}`);

    await page.screenshot({ path: path.join(outputDir, `home-${viewport.name}.png`) });
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

console.log('Homepage Game Network dendrite is visible, in-viewport, eight-way, and navigates correctly on desktop and mobile.');
