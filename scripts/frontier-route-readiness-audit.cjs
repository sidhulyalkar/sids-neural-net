const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const MAX_USEFUL_PAINT_MS = 9_000;
const MAX_LIVE_APPEND_MS = 12_000;
const SCREENSHOT_TIMEOUT_MS = 4_000;
const CARD = '[data-frontier-fluid-card]';
const LOADING = '[aria-label="Scanning live sources"]';
const INITIAL_BROWSE_CARDS = 48;
const LIVE_APPEND_CARDS = 16;
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function explicitTerminalState(text) {
  return /No unseen signals yet\.|No unseen signals in this slice\.|No unseen match\./i.test(text);
}

function auditItem(index) {
  // Route-readiness is a render/paint fixture, not a source-provenance fixture.
  // Keep every synthetic item inside a trusted direct/curated source contract so
  // the provenance gate does not correctly remove one before paint is measured.
  const sourceKinds = ['local', 'openalex', 'github', 'nasa'];
  const lanes = [
    'creative_tech',
    'ai_frontier',
    'methods',
    'builder_signal',
    'broad_science',
    'neuro_frontier',
    'ml_data',
    'wildcards',
    'gaming',
    'team_pulse',
    'sports',
    'world_soccer',
  ];
  const host = `frontier-audit-${index}.example.invalid`;
  return {
    id: `frontier-mobile-route-audit-${index}`,
    title: `Mobile feed paint audit ${index}`,
    summary: 'Deterministic local content proving that the real FRONTIER mobile feed paints readable cards and can extend a deep browse surface with fresh signals.',
    url: `https://${host}/item`,
    source: host,
    sourceLabel: `FRONTIER CI ${index}`,
    sourceKind: sourceKinds[(index - 1) % sourceKinds.length],
    publishedAt: '2026-08-22T00:00:00.000Z',
    lane: lanes[(index - 1) % lanes.length],
    tags: ['mobile-audit', 'deterministic', `fixture-${index}`],
    baseScore: Math.max(0.62, 1 - index * 0.003),
    importance: index === 1 ? 0.92 : 0.7,
    novelty: 0.82,
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
      documentHeight: (document.scrollingElement || document.documentElement).scrollHeight,
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

async function cardIds(page, limit) {
  return page.evaluate(({ selector, take }) => (
    Array.from(document.querySelectorAll(selector))
      .slice(0, take)
      .map((node) => node.getAttribute('data-frontier-fluid-card') || '')
  ), { selector: CARD, take: limit });
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
  let snapshotFeedFulfillments = 0;
  let freshFeedFulfillments = 0;
  let forageFulfillments = 0;
  let snapshotResponseSettled = false;
  let freshBeforeSnapshotSettled = false;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/frontier/')) {
      frontierRequests.push({ method: request.method(), url: request.url().slice(0, 700), at: Date.now() });
    }
  });

  const snapshotPayload = {
    generatedAt: '2026-08-22T00:00:00.000Z',
    items: Array.from({ length: 64 }, (_, index) => auditItem(index + 1)),
    sources: [{ id: 'local', label: 'FRONTIER CI snapshot', ok: true, count: 64 }],
  };
  const freshPayload = {
    generatedAt: '2026-08-22T00:01:00.000Z',
    items: Array.from({ length: LIVE_APPEND_CARDS }, (_, index) => auditItem(index + 65)),
    sources: [{ id: 'live-ci', label: 'FRONTIER CI fresh', ok: true, count: LIVE_APPEND_CARDS }],
  };

  await page.route('**/api/frontier/feed**', async (route) => {
    feedFulfillments += 1;
    const requestUrl = new URL(route.request().url());
    const fresh = requestUrl.searchParams.get('fresh') === '1';
    if (fresh) {
      freshFeedFulfillments += 1;
      if (!snapshotResponseSettled) freshBeforeSnapshotSettled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(freshPayload) });
      return;
    }

    snapshotFeedFulfillments += 1;
    // Give an incorrectly eager daemon enough time to reveal itself. The live
    // worker must remain dormant until this snapshot request has settled.
    await new Promise((resolve) => setTimeout(resolve, 220));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshotPayload) });
    snapshotResponseSettled = true;
  });
  await page.route('**/api/frontier/forage**', async (route) => {
    forageFulfillments += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ generatedAt: freshPayload.generatedAt, items: [], sources: [] }),
    });
  });

  const startedAt = Date.now();
  try {
    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `Mobile FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(
      ({ selector, expected }) => document.querySelectorAll(selector).length >= expected,
      { selector: CARD, expected: INITIAL_BROWSE_CARDS },
      { polling: 'raf', timeout: MAX_USEFUL_PAINT_MS },
    );

    const settledMs = Date.now() - startedAt;
    const initialState = await pageState(page);
    const initialPrefix = await cardIds(page, 14);
    assert.equal(initialState.viewport.width, 390, 'Mobile route audit must use the intended 390px viewport');
    assert(initialState.cardCount >= INITIAL_BROWSE_CARDS, `Expected ${INITIAL_BROWSE_CARDS} initial browse cards, saw ${initialState.cardCount}`);
    assert(snapshotFeedFulfillments >= 1, 'Mobile route audit never fulfilled the deterministic snapshot request');
    assert.equal(freshBeforeSnapshotSettled, false, 'Fresh live discovery raced the snapshot-backed first-paint request');
    assert.deepEqual(pageErrors, [], `Mobile FRONTIER emitted page errors: ${pageErrors.join(' | ')}`);
    assert(
      initialState.documentHeight >= initialState.viewport.height * 5,
      `Initial mobile browse is not deep enough: ${initialState.documentHeight}px for ${initialState.viewport.height}px viewport`,
    );

    const firstThree = initialState.cards.slice(0, 3);
    assert.equal(firstThree.length, 3, 'Mobile feed must expose three above-fold paint sentinels');
    assert.equal(new Set(firstThree.map((card) => card.id)).size, 3, 'Mobile paint sentinels must be distinct cards');
    for (const [position, card] of firstThree.entries()) {
      const fixtureIndex = Number.parseInt(card.id?.match(/(\d+)$/)?.[1] ?? '', 10);
      assert(Number.isInteger(fixtureIndex) && fixtureIndex >= 1 && fixtureIndex <= 64, `Mobile card ${position + 1} lost its fixture identity`);
      assert.equal(card.contentVisibility, 'visible', `Mobile card ${position + 1} may not be auto-skipped`);
      assert.notEqual(card.display, 'none', `Mobile card ${position + 1} is display:none`);
      assert.notEqual(card.visibility, 'hidden', `Mobile card ${position + 1} is hidden`);
      assert(Number(card.opacity) > 0.9, `Mobile card ${position + 1} lost opacity`);
      assert(card.rect.width >= 340, `Mobile card ${position + 1} is too narrow: ${card.rect.width}`);
      assert(card.rect.height >= 80, `Mobile card ${position + 1} has no readable height: ${card.rect.height}`);
      assert(card.text.includes(`Mobile feed paint audit ${fixtureIndex}`), `Mobile card ${position + 1} text did not match its rendered fixture ${fixtureIndex}`);
    }
    assert(
      firstThree[0].rect.y < initialState.viewport.height && firstThree[0].rect.y + firstThree[0].rect.height > 0,
      `First mobile card is not above fold: y=${firstThree[0].rect.y}, h=${firstThree[0].rect.height}`,
    );

    // The background worker must now issue a real fresh=1 request and the
    // bounded live primer must append the unseen batch without moving the
    // authoritative prefix already on screen.
    await page.waitForFunction(
      ({ selector, expected }) => document.querySelectorAll(selector).length >= expected,
      { selector: CARD, expected: INITIAL_BROWSE_CARDS + LIVE_APPEND_CARDS },
      { polling: 'raf', timeout: MAX_LIVE_APPEND_MS },
    );
    const liveState = await pageState(page);
    const livePrefix = await cardIds(page, 14);
    assert(freshFeedFulfillments >= 1, 'Post-paint live daemon never issued a fresh=1 feed request');
    assert.deepEqual(livePrefix, initialPrefix, 'Fresh live append reordered the canonical visible prefix');
    assert(
      liveState.cardCount >= INITIAL_BROWSE_CARDS + LIVE_APPEND_CARDS,
      `Expected live append to extend browse to ${INITIAL_BROWSE_CARDS + LIVE_APPEND_CARDS} cards, saw ${liveState.cardCount}`,
    );
    assert(
      liveState.documentHeight > initialState.documentHeight,
      `Fresh live append did not extend document height: initial=${initialState.documentHeight}, live=${liveState.documentHeight}`,
    );

    const screenshot = await captureDiagnosticScreenshot(page, 'frontier-mobile-deterministic.png', false);
    return {
      passed: true,
      settledMs,
      pageErrors,
      consoleErrors,
      screenshot,
      network: {
        feedFulfillments,
        snapshotFeedFulfillments,
        freshFeedFulfillments,
        forageFulfillments,
        freshBeforeSnapshotSettled,
        requests: frontierRequests,
      },
      initial: initialState,
      live: liveState,
      stablePrefix: initialPrefix,
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
      network: {
        feedFulfillments,
        snapshotFeedFulfillments,
        freshFeedFulfillments,
        forageFulfillments,
        freshBeforeSnapshotSettled,
        requests: frontierRequests,
      },
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
      maxLiveAppendMs: MAX_LIVE_APPEND_MS,
      screenshotTimeoutMs: SCREENSHOT_TIMEOUT_MS,
      initialBrowseCards: INITIAL_BROWSE_CARDS,
      liveAppendCards: LIVE_APPEND_CARDS,
      desktop,
      mobile,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-route-readiness.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    assert.equal(desktop.passed, true, `Cold desktop FRONTIER paint failed: ${desktop.error ?? 'unknown failure'}`);
    assert.equal(mobile.passed, true, `Deterministic mobile FRONTIER paint/live append failed: ${mobile.error ?? 'unknown failure'}`);
    console.log('FRONTIER route readiness PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
