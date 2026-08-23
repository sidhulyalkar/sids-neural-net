const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const MAX_USEFUL_PAINT_MS = 9_000;
const CARD = '[data-frontier-fluid-card]';
const LOADING = '[aria-label="Scanning live sources"]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function explicitTerminalState(text) {
  return /No unseen signals yet\.|No unseen signals in this slice\.|No unseen match\./i.test(text);
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(MAX_USEFUL_PAINT_MS);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const startedAt = Date.now();
  try {
    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `FRONTIER route returned ${response?.status() ?? 'no response'}`);

    await page.waitForFunction(
      ({ cardSelector, loadingSelector }) => {
        const cardCount = document.querySelectorAll(cardSelector).length;
        const loading = document.querySelector(loadingSelector);
        const text = document.body?.innerText ?? '';
        const terminal = /No unseen signals yet\.|No unseen signals in this slice\.|No unseen match\./i.test(text);
        return !loading && (cardCount > 0 || terminal);
      },
      { cardSelector: CARD, loadingSelector: LOADING },
      { polling: 'raf', timeout: MAX_USEFUL_PAINT_MS },
    );

    const settledMs = Date.now() - startedAt;
    const state = await page.evaluate(({ cardSelector, loadingSelector }) => ({
      cardCount: document.querySelectorAll(cardSelector).length,
      loadingVisible: Boolean(document.querySelector(loadingSelector)),
      bodyText: (document.body?.innerText ?? '').slice(0, 3_000),
      headerStatus: Array.from(document.querySelectorAll('header span'))
        .map((node) => node.textContent?.trim() ?? '')
        .find((text) => ['scanning', 'partial', 'streaming', 'live'].includes(text)) ?? null,
    }), { cardSelector: CARD, loadingSelector: LOADING });

    assert.equal(state.loadingVisible, false, 'FRONTIER must leave the loading skeleton after its bounded request window');
    assert(
      state.cardCount > 0 || explicitTerminalState(state.bodyText),
      'FRONTIER must reach real cards or an explicit empty/degraded terminal state',
    );
    assert(
      settledMs <= MAX_USEFUL_PAINT_MS,
      `FRONTIER first useful paint exceeded ${MAX_USEFUL_PAINT_MS}ms: ${settledMs}ms`,
    );
    assert.deepEqual(pageErrors, [], `FRONTIER emitted page errors: ${pageErrors.join(' | ')}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-first-useful-paint.png'), fullPage: true });
    const result = {
      passed: true,
      url: FRONTIER_URL,
      maxUsefulPaintMs: MAX_USEFUL_PAINT_MS,
      settledMs,
      cardCount: state.cardCount,
      headerStatus: state.headerStatus,
      terminalState: state.cardCount > 0 ? 'cards' : 'explicit-empty',
      pageErrors,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-route-readiness.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER bounded first useful paint PASS');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    let diagnosticState = null;
    try {
      diagnosticState = await page.evaluate(({ cardSelector, loadingSelector }) => ({
        cardCount: document.querySelectorAll(cardSelector).length,
        loadingVisible: Boolean(document.querySelector(loadingSelector)),
        bodyText: (document.body?.innerText ?? '').slice(0, 3_000),
      }), { cardSelector: CARD, loadingSelector: LOADING });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-first-useful-paint-failure.png'), fullPage: true });
    } catch {
      // The route may have failed before a document existed. Preserve the
      // primary error rather than hiding it behind diagnostics.
    }
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-route-readiness.json'),
      `${JSON.stringify({
        passed: false,
        url: FRONTIER_URL,
        maxUsefulPaintMs: MAX_USEFUL_PAINT_MS,
        elapsedMs,
        error: error instanceof Error ? error.stack : String(error),
        pageErrors,
        diagnosticState,
      }, null, 2)}\n`,
    );
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});