const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const baseUrl = process.env.ARCADE_AUDIT_URL || 'http://127.0.0.1:3000';
const outputDir = join(process.cwd(), 'artifacts', 'browser-smoke');

const GAMES = [
  {
    slug: 'stretchicorn',
    title: 'Stretchicorn',
    version: 'v0.21.1',
    runtimePath: '/game-runtimes/stretchicorn/index.html',
  },
  {
    slug: 'unirico',
    title: 'uniRico',
    version: 'v0.18.0',
    runtimePath: '/game-runtimes/unirico/index.html',
  },
];

const CATALOG_VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

function normalizePath(value) {
  return new URL(value, baseUrl).pathname;
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { baseUrl, passed: true, catalog: [], games: [], hiddenRoutes: [] };

  try {
    for (const viewport of CATALOG_VIEWPORTS) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await page.goto(`${baseUrl}/arcade`, { waitUntil: 'networkidle' });

      const hrefs = await page
        .locator('main section a[data-gesture-target]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')).filter(Boolean));
      const paths = hrefs.map(normalizePath);
      const expectedPaths = GAMES.map((game) => `/arcade/${game.slug}`);
      const text = await page.locator('main').innerText();
      const passed =
        JSON.stringify(paths) === JSON.stringify(expectedPaths) &&
        !/Sylvaria|mosslight/i.test(text) &&
        pageErrors.length === 0 &&
        consoleErrors.length === 0;

      report.passed = report.passed && passed;
      report.catalog.push({
        ...viewport,
        passed,
        paths,
        expectedPaths,
        pageErrors,
        consoleErrors,
      });

      await context.close();
    }

    for (const hiddenPath of ['/arcade/sylvaria', '/arcade/mosslight']) {
      const context = await browser.newContext();
      const response = await context.request.get(`${baseUrl}${hiddenPath}`);
      const passed = response.status() === 404;
      report.passed = report.passed && passed;
      report.hiddenRoutes.push({ path: hiddenPath, status: response.status(), passed });
      await context.close();
    }

    for (const game of GAMES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await page.goto(`${baseUrl}/arcade/${game.slug}`, { waitUntil: 'domcontentloaded' });
      const iframe = page.locator(`iframe[title="${game.title} game runtime"]`);
      await iframe.waitFor({ state: 'visible', timeout: 15_000 });

      const frame = page.frames().find((candidate) =>
        candidate.url().includes(game.runtimePath)
      );
      if (!frame) throw new Error(`Missing runtime frame for ${game.slug}`);

      await frame.waitForSelector('canvas', { state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(500);

      const frameTitle = await frame.title();
      const canvas = await frame.locator('canvas').evaluate((node) => ({
        width: node.width,
        height: node.height,
        clientWidth: node.clientWidth,
        clientHeight: node.clientHeight,
      }));

      await frame.locator('canvas').click({ position: { x: 8, y: 8 } });
      await page.locator('main[data-arcade-focus="true"]').waitFor({ timeout: 5_000 });
      await page.keyboard.press('Escape');
      await page.locator('main[data-arcade-focus="false"]').waitFor({ timeout: 5_000 });

      const passed =
        frameTitle.includes(game.version) &&
        canvas.width > 0 &&
        canvas.height > 0 &&
        canvas.clientWidth > 0 &&
        canvas.clientHeight > 0 &&
        pageErrors.length === 0 &&
        consoleErrors.length === 0;

      report.passed = report.passed && passed;
      report.games.push({
        ...game,
        passed,
        frameUrl: frame.url(),
        frameTitle,
        canvas,
        pageErrors,
        consoleErrors,
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(outputDir, 'arcade-production-audit.json'), JSON.stringify(report, null, 2));

  if (!report.passed) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log('Game Network production audit passed for Stretchicorn v0.21.1 and uniRico v0.18.0.');
})();
