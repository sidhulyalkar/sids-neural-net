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

function auditItem(index) {
  return {
    id: `frontier-mobile-route-audit-${index}`,
    title: `Mobile feed paint audit ${index}`,
    summary: 'Deterministic local content proving that the real FRONTIER mobile feed paints readable cards above the fold.',
    url: `/frontier?mobile-audit=${index}`,
    source: 'FRONTIER CI',
    sourceLabel: 'FRONTIER CI',
    sourceKind: 'local',
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
    return {
      settledMs,
      cardCount: state.cardCount,
      headerStatus: state.headerStatus,
      terminalState: state.cardCount > 0 ? 'cards' : 'explicit-empty',
      pageErrors,
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
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const payload = {
    generatedAt: '2026-08-22T00:00:00.000Z',
    items: [auditItem(1), auditItem(2), auditItem(3), auditItem(4)],
    sources: [{ id: 'local', label: 'FRONTIER CI', ok: true, count: 4 }],
  };

  await page.route('**/api/frontier/feed**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.route('**/api/frontier/forage**', async (route) => {
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
    const state = await page.evaluate((selector) => {
      const cards = Array.from(document.querySelectorAll(selector)).slice(0, 4);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        cardCount: document.querySelectorAll(selector).length,
        cards: cards.map((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            contentVisibility: style.contentVisibility,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
          };
        }),
      };
    }, CARD);

    assert.equal(state.viewport.width, 390, 'Mobile route audit must use the intended 390px viewport');
    assert(state.cardCount >= 4, `Expected deterministic mobile cards, saw ${state.cardCount}`);
    assert.deepEqual(pageErrors, [], `Mobile FRONTIER emitted page errors: ${pageErrors.join(' | ')}`);

    const firstThree = state.cards.slice(0, 3);
    assert.equal(firstThree.length, 3, 'Mobile feed must expose three above-fold paint sentinels');
    for (const [index, card] of firstThree.entries()) {
      assert.equal(card.contentVisibility, 'visible', `Mobile card ${index + 1} may not be auto-skipped`);
      assert.notEqual(card.display, 'none', `Mobile card ${index + 1} is display:none`);
      assert.notEqual(card.visibility, 'hidden', `Mobile card ${index + 1} is hidden`);
      assert(Number(card.opacity) > 0.9, `Mobile card ${index + 1} lost opacity`);
      assert(card.rect.width >= 340, `Mobile card ${index + 1} is too narrow: ${card.rect.width}`);
      assert(card.rect.height >= 80, `Mobile card ${index + 1} has no readable height: ${card.rect.height}`);
      assert(card.text.includes(`Mobile feed paint audit ${index + 1}`), `Mobile card ${index + 1} text did not paint`);
    }
    assert(
      firstThree[0].rect.y < state.viewport.height && firstThree[0].rect.y + firstThree[0].rect.height > 0,
      `First mobile card is not above fold: y=${firstThree[0].rect.y}, h=${firstThree[0].rect.height}`,
    );

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-mobile-deterministic.png'), fullPage: false });
    return { settledMs, pageErrors, ...state };
  } finally {
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let desktop;
  let mobile;
  try {
    desktop = await auditColdDesktop(browser);
    mobile = await auditDeterministicMobile(browser);
    const result = {
      passed: true,
      url: FRONTIER_URL,
      maxUsefulPaintMs: MAX_USEFUL_PAINT_MS,
      desktop,
      mobile,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-route-readiness.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER route readiness PASS');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-route-readiness.json'),
      `${JSON.stringify({
        passed: false,
        url: FRONTIER_URL,
        maxUsefulPaintMs: MAX_USEFUL_PAINT_MS,
        error: error instanceof Error ? error.stack : String(error),
        desktop,
        mobile,
      }, null, 2)}\n`,
    );
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});