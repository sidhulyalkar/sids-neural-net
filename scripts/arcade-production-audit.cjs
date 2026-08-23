const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const baseUrl = process.env.ARCADE_AUDIT_URL || 'http://127.0.0.1:3000';
const outputDir = join(process.cwd(), 'artifacts', 'browser-smoke');
const outputPath = join(outputDir, 'arcade-production-audit.json');

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

function messageText(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function persist(report) {
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const report = { baseUrl, passed: true, catalog: [], games: [], hiddenRoutes: [], fatalError: null };
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    for (const viewport of CATALOG_VIEWPORTS) {
      const result = {
        ...viewport,
        passed: false,
        paths: [],
        expectedPaths: GAMES.map((game) => `/arcade/${game.slug}`),
        pageErrors: [],
        consoleErrors: [],
        failedResponses: [],
        error: null,
      };
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on('pageerror', (error) => result.pageErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') result.consoleErrors.push(message.text());
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          result.failedResponses.push({ status: response.status(), url: response.url() });
        }
      });

      try {
        await page.goto(`${baseUrl}/arcade`, { waitUntil: 'networkidle' });
        const hrefs = await page
          .locator('main section a[data-gesture-target]')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')).filter(Boolean));
        result.paths = hrefs.map(normalizePath);
        const text = await page.locator('main').innerText();
        result.passed =
          JSON.stringify(result.paths) === JSON.stringify(result.expectedPaths) &&
          !/Sylvaria|mosslight/i.test(text) &&
          result.pageErrors.length === 0 &&
          result.consoleErrors.length === 0 &&
          result.failedResponses.length === 0;
      } catch (error) {
        result.error = messageText(error);
      } finally {
        report.passed = report.passed && result.passed;
        report.catalog.push(result);
        await context.close();
        persist(report);
      }
    }

    for (const hiddenPath of ['/arcade/sylvaria', '/arcade/mosslight']) {
      const context = await browser.newContext();
      const result = { path: hiddenPath, status: null, passed: false, error: null };
      try {
        const response = await context.request.get(`${baseUrl}${hiddenPath}`);
        result.status = response.status();
        result.passed = result.status === 404;
      } catch (error) {
        result.error = messageText(error);
      } finally {
        report.passed = report.passed && result.passed;
        report.hiddenRoutes.push(result);
        await context.close();
        persist(report);
      }
    }

    for (const game of GAMES) {
      const result = {
        ...game,
        passed: false,
        frameUrl: null,
        frameTitle: null,
        frameUrls: [],
        canvas: null,
        focusAfterPointer: null,
        focusAfterEscape: null,
        pageErrors: [],
        consoleErrors: [],
        failedResponses: [],
        error: null,
      };
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', (error) => result.pageErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') result.consoleErrors.push(message.text());
      });
      page.on('response', (response) => {
        const url = response.url();
        if (response.status() >= 400 && url.includes('/game-runtimes/')) {
          result.failedResponses.push({ status: response.status(), url });
        }
      });

      try {
        await page.goto(`${baseUrl}/arcade/${game.slug}`, { waitUntil: 'domcontentloaded' });
        const iframe = page.locator(`iframe[title="${game.title} game runtime"]`);
        await iframe.waitFor({ state: 'visible', timeout: 15_000 });
        await page.waitForTimeout(350);

        result.frameUrls = page.frames().map((candidate) => candidate.url());
        const frame = page.frames().find((candidate) => candidate.url().includes(game.runtimePath));
        if (!frame) throw new Error(`Missing runtime frame for ${game.slug}`);

        result.frameUrl = frame.url();
        await frame.waitForSelector('canvas', { state: 'visible', timeout: 15_000 });
        await page.waitForTimeout(700);
        result.frameTitle = await frame.title();
        result.canvas = await frame.locator('canvas').first().evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            width: node.width,
            height: node.height,
            clientWidth: node.clientWidth,
            clientHeight: node.clientHeight,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            display: getComputedStyle(node).display,
            visibility: getComputedStyle(node).visibility,
          };
        });

        // Dispatch a real pointer event on the runtime window. This tests the same bridge
        // event that a user click inside the iframe triggers without depending on whether
        // an upstream title/menu element currently overlays part of the canvas.
        await frame.evaluate(() => {
          window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
        });
        try {
          await page.locator('main[data-arcade-focus="true"]').waitFor({ timeout: 5_000 });
          result.focusAfterPointer = true;
        } catch {
          result.focusAfterPointer = false;
        }

        await frame.evaluate(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        try {
          await page.locator('main[data-arcade-focus="false"]').waitFor({ timeout: 5_000 });
          result.focusAfterEscape = true;
        } catch {
          result.focusAfterEscape = false;
        }

        result.passed =
          result.frameTitle.includes(game.version) &&
          result.canvas.width > 0 &&
          result.canvas.height > 0 &&
          result.canvas.clientWidth > 0 &&
          result.canvas.clientHeight > 0 &&
          result.focusAfterPointer === true &&
          result.focusAfterEscape === true &&
          result.pageErrors.length === 0 &&
          result.consoleErrors.length === 0 &&
          result.failedResponses.length === 0;
      } catch (error) {
        result.error = messageText(error);
      } finally {
        report.passed = report.passed && result.passed;
        report.games.push(result);
        await context.close();
        persist(report);
      }
    }
  } catch (error) {
    report.passed = false;
    report.fatalError = messageText(error);
  } finally {
    if (browser) await browser.close();
    persist(report);
  }

  if (!report.passed) {
    console.error('Game Network production audit failed:');
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log('Game Network production audit passed for Stretchicorn v0.21.1 and uniRico v0.18.0.');
})();
