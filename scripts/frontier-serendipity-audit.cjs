const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const baseUrl = process.env.FRONTIER_SERENDIPITY_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const outputDir = join(process.cwd(), 'artifacts', 'browser-smoke');
const reportPath = join(outputDir, 'frontier-serendipity-audit.json');

function errorText(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function settleFrontier(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('select[aria-label="View"]').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(900);
}

async function auditDesktop(browser, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const result = {
    name: 'desktop',
    passed: false,
    signalDrift: false,
    rabbitHole: false,
    constellation: false,
    constellationNodes: 0,
    driftQuery: '',
    rabbitQuery: '',
    pageErrors: [],
    consoleErrors: [],
    error: null,
  };
  page.on('pageerror', (error) => result.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });

  try {
    await settleFrontier(page);

    const drift = page.locator('[data-frontier-signal-drift]');
    await drift.waitFor({ state: 'visible', timeout: 15_000 });
    await drift.click();
    await page.locator('select[aria-label="View"]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const select = document.querySelector('select[aria-label="View"]');
      return select && select.value === 'explore';
    });
    const driftChip = page.locator('[data-frontier-query-chip]');
    await driftChip.waitFor({ state: 'visible', timeout: 8_000 });
    result.driftQuery = (await driftChip.innerText()).trim();
    result.signalDrift = result.driftQuery.length > 0;
    await page.screenshot({ path: join(outputDir, 'frontier-serendipity-desktop.png'), fullPage: false });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const rabbit = page.locator('[data-frontier-rabbit-hole]').first();
    await rabbit.waitFor({ state: 'visible', timeout: 20_000 });
    await rabbit.click();
    await page.waitForFunction(() => {
      const select = document.querySelector('select[aria-label="View"]');
      return select && select.value === 'explore';
    });
    const rabbitChip = page.locator('[data-frontier-query-chip]');
    await rabbitChip.waitFor({ state: 'visible', timeout: 8_000 });
    result.rabbitQuery = (await rabbitChip.innerText()).trim();
    result.rabbitHole = result.rabbitQuery.length > 0;

    const view = page.locator('select[aria-label="View"]');
    await view.selectOption('map');
    const constellation = page.locator('[data-frontier-interest-constellation]');
    await constellation.waitFor({ state: 'visible', timeout: 10_000 });
    const nodes = constellation.locator('button[aria-label^="Explore "]');
    result.constellationNodes = await nodes.count();
    result.constellation = result.constellationNodes >= 4 && result.constellationNodes <= 6;
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(outputDir, 'frontier-radar-desktop.png'), fullPage: false });

    result.passed = result.signalDrift
      && result.rabbitHole
      && result.constellation
      && result.pageErrors.length === 0
      && result.consoleErrors.length === 0;
  } catch (error) {
    result.error = errorText(error);
  } finally {
    report.passed = report.passed && result.passed;
    report.results.push(result);
    await context.close();
  }
}

async function auditMobile(browser, report) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const result = {
    name: 'mobile',
    passed: false,
    constellationNodes: 0,
    horizontalOverflow: false,
    pageErrors: [],
    consoleErrors: [],
    error: null,
  };
  page.on('pageerror', (error) => result.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });

  try {
    await settleFrontier(page);
    await page.locator('select[aria-label="View"]').selectOption('map');
    const constellation = page.locator('[data-frontier-interest-constellation]');
    await constellation.waitFor({ state: 'visible', timeout: 10_000 });
    result.constellationNodes = await constellation.locator('button[aria-label^="Explore "]').count();
    result.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(outputDir, 'frontier-radar-mobile.png'), fullPage: false });
    result.passed = result.constellationNodes >= 4
      && result.constellationNodes <= 6
      && !result.horizontalOverflow
      && result.pageErrors.length === 0
      && result.consoleErrors.length === 0;
  } catch (error) {
    result.error = errorText(error);
  } finally {
    report.passed = report.passed && result.passed;
    report.results.push(result);
    await context.close();
  }
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const report = { baseUrl, passed: true, results: [], fatalError: null };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await auditDesktop(browser, report);
    await auditMobile(browser, report);
  } catch (error) {
    report.passed = false;
    report.fatalError = errorText(error);
  } finally {
    if (browser) await browser.close();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  if (!report.passed) {
    console.error('FRONTIER serendipity audit failed:');
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log('FRONTIER serendipity audit passed: Signal Drift, Rabbit Hole, and Taste Constellation are interactive and responsive.');
})();
