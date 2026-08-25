const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const MAX_USEFUL_PAINT_MS = 9_000;
const SCREENSHOT_TIMEOUT_MS = 4_000;
const CARD = '[data-frontier-fluid-card]';
const LOADING = '[aria-label="Scanning live sources"]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function explicitTerminalState(text) {
  return /No unseen signals yet\.|No unseen signals in this slice\.|No unseen match\./i.test(text);
}

function auditItem(index) {
  // Route-readiness is a render/paint fixture, not a source-provenance fixture.
  // Keep every synthetic item inside a trusted direct/curated source contract so
  // the provenance gate does not correctly remove one before paint is measured.
  const sourceKinds = ['local', 'openalex', 'github', 'nasa'];
  const host = `frontier-audit-${index}.example.invalid`;
  return {
    id: `frontier-mobile-route-audit-${index}`,
    title: `Mobile feed paint audit ${index}`,
    summary: 'Deterministic local content proving that the real FRONTIER mobile feed paints readable cards above the fold.',
    url: `https://${host}/item`,
    source: host,
    sourceLabel: `FRONTIER CI ${index}`,
    sourceKind: sourceKinds[index - 1],
    publishedAt: '2026-08-22T00:00:00.000Z',
    lane: index === 1 ? 'creative_tech' : index === 2 ? 'ai_frontier' : 'methods',
    tags: ['mobile-audit', 'deterministic', `fixture-${index}`],
    baseScore: 1 - index * 0.03,
    importance: 0.9,
    novelty: 0.9,
    quality: 1,
    momentum: 0.4,
    why: 'Deterministic CI fixture only.',
  };
}

async function pageState(page) {
  return page.evaluate(({ cardSelector, loadingSelector }) => {
    const board = document.querySelector('[data-vector-backend]');
    const cards = Array.from(document.querySelectorAll(cardSelector)).slice(0, 6);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      cardCount: document.querySelectorAll(cardSelector).length,
      loadingVisible: Boolean(document.querySelector(loadingSelector)),
      bodyText: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 4_000),
      headerStatus: Array.from(document.querySelectorAll('header span'))
        .map((node) => node.textContent?.trim() ?? '')
        .find((text) => ['scanning', 'partial', 'streaming', 'live'].includes(text)) ?? null,
      board: board ? {
        backend: board.getAttribute('data-vector-backend'),
        density: board.getAttribute('data-density'),
        expanded: board.getAttribute('data-fluid-expanded'),
        childCount: board.children.length,
        text: (board.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 1_200),
      } : null,
      cards: cards.map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          id: node.getAttribute('data-frontier-fluid-card'),
          text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 220),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          contentVisibility: style.contentVisibility,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
        };
      }),
      storage: {
        layout: localStorage.getItem('frontier-layout-mode'),
        feedCachePresent: Boolean(localStorage.getItem('frontier-live-feed-cache-v1')),
      },
    };
  }, { cardSelector: CARD, loadingSelector: LOADING });
}

/**
 * Screenshots are diagnostics, never render authority. Playwright may wait on
 * fonts, animation stabilization, compositor work, or a full-page capture long
 * after the DOM has already satisfied the useful-paint contract. Bound that
 * work separately and record any failure without converting healthy paint into
 * a false production regression. Dedicated screenshot/media audits remain
 * authoritative for visual qualification later in the workflow.
 */
async function captureDiagnosticScreenshot(page, filename, fullPage = false) {
  try {
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, filename),
      fullPage,
      animations: 'disabled',
      caret: 'hide',
      timeout: SCREENSHOT_TIMEOUT_MS,
    });
    return { ok: true, filename };
  } catch (error) {
    return {
      ok: false,
      filename,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function auditColdDesktop(browser) {
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
    const state = await pageState(page);
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

    const screenshot = await captureDiagnosticScreenshot(page, 'frontier-first-useful-paint.png', false);
    return {
      passed: true,
      settledMs,
      cardCount: state.cardCount,
      headerStatus: state.headerStatus,
      terminalState: state.cardCount > 0 ? 'cards' : 'explicit-empty',
      pageErrors,
      screenshot,
    };
  } finally {
    await context.close();
  }
}

async function auditDeterministicMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(MAX_USEFUL_PAINT_MS);
  const pageErrors = [];
  const consoleErrors = [];
  const frontierRequests = [];
  let feedFulfillments = 0;
  let forageFulfillments = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/frontier/')) {
      frontierRequests.push({ method: request.method(), url: request.url().slice(0, 700) });
    }
  });

  const payload = {
    generatedAt: '2026-08-22T00:00:00.000Z',
    items: [auditItem(1), auditItem(2), auditItem(3), auditItem(4)],
    sources: [{ id: 'local', label: 'FRONTIER CI', ok: true, count: 4 }],
  };

  await page.route('**/api/frontier/feed**', async (route) => {
    feedFulfillments += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.route('**/api/frontier/forage**', async (route) => {
    forageFulfillments += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ generatedAt: payload.generatedAt, items: [], sources: [] }),
    });
  });

  const startedAt = Date.now();
  try {
    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `Mobile FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length >= 4,
      CARD,
      { polling: 'raf', timeout: MAX_USEFUL_PAINT_MS },
    );

    const settledMs = Date.now() - startedAt;
    const state = await pageState(page);
    assert.equal(state.viewport.width, 390, 'Mobile route audit must use the intended 390px viewport');
    assert(state.cardCount >= 4, `Expected deterministic mobile cards, saw ${state.cardCount}`);
    assert(feedFulfillments >= 1, 'Mobile route audit never fulfilled the deterministic feed request');
    assert.deepEqual(pageErrors, [], `Mobile FRONTIER emitted page errors: ${pageErrors.join(' | ')}`);

    const firstThree = state.cards.slice(0, 3);
    assert.equal(firstThree.length, 3, 'Mobile feed must expose three above-fold paint sentinels');
    assert.equal(new Set(firstThree.map((card) => card.id)).size, 3, 'Mobile paint sentinels must be distinct cards');
    for (const [position, card] of firstThree.entries()) {
      const fixtureIndex = Number.parseInt(card.id?.match(/(\d+)$/)?.[1] ?? '', 10);
      assert(Number.isInteger(fixtureIndex) && fixtureIndex >= 1 && fixtureIndex <= 4, `Mobile card ${position + 1} lost its fixture identity`);
      assert.equal(card.contentVisibility, 'visible', `Mobile card ${position + 1} may not be auto-skipped`);
      assert.notEqual(card.display, 'none', `Mobile card ${position + 1} is display:none`);
      assert.notEqual(card.visibility, 'hidden', `Mobile card ${position + 1} is hidden`);
      assert(Number(card.opacity) > 0.9, `Mobile card ${position + 1} lost opacity`);
      assert(card.rect.width >= 340, `Mobile card ${position + 1} is too narrow: ${card.rect.width}`);
      assert(card.rect.height >= 80, `Mobile card ${position + 1} has no readable height: ${card.rect.height}`);
      assert(card.text.includes(`Mobile feed paint audit ${fixtureIndex}`), `Mobile card ${position + 1} text did not match its rendered fixture ${fixtureIndex}`);
    }
    assert(
      firstThree[0].rect.y < state.viewport.height && firstThree[0].rect.y + firstThree[0].rect.height > 0,
      `First mobile card is not above fold: y=${firstThree[0].rect.y}, h=${firstThree[0].rect.height}`,
    );

    const screenshot = await captureDiagnosticScreenshot(page, 'frontier-mobile-deterministic.png', false);
    return {
      passed: true,
      settledMs,
      pageErrors,
      consoleErrors,
      screenshot,
      network: { feedFulfillments, forageFulfillments, requests: frontierRequests },
      ...state,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    let diagnosticState = null;
    try {
      diagnosticState = await pageState(page);
    } catch (diagnosticError) {
      consoleErrors.push(`state diagnostic failure: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`);
    }
    const screenshot = await captureDiagnosticScreenshot(page, 'frontier-mobile-deterministic-failure.png', false);
    if (!screenshot.ok) consoleErrors.push(`screenshot diagnostic failure: ${screenshot.error}`);
    return {
      passed: false,
      elapsedMs,
      error: error instanceof Error ? error.stack : String(error),
      pageErrors,
      consoleErrors,
      screenshot,
      network: { feedFulfillments, forageFulfillments, requests: frontierRequests },
      diagnosticState,
    };
  } finally {
    await context.close();
  }
}

async function runAuditSafely(label, audit, browser) {
  try {
    return await audit(browser);
  } catch (error) {
    return {
      passed: false,
      error: error instanceof Error ? error.stack : String(error),
      label,
    };
  }
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let desktop;
  let mobile;
  try {
    desktop = await runAuditSafely('desktop', auditColdDesktop, browser);
    mobile = await runAuditSafely('mobile', auditDeterministicMobile, browser);
    const result = {
      passed: desktop.passed && mobile.passed,
      url: FRONTIER_URL,
      maxUsefulPaintMs: MAX_USEFUL_PAINT_MS,
      screenshotTimeoutMs: SCREENSHOT_TIMEOUT_MS,
      desktop,
      mobile,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-route-readiness.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    assert.equal(desktop.passed, true, `Cold desktop FRONTIER paint failed: ${desktop.error ?? 'unknown failure'}`);
    assert.equal(mobile.passed, true, `Deterministic mobile FRONTIER paint failed: ${mobile.error ?? 'unknown failure'}`);
    console.log('FRONTIER route readiness PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
