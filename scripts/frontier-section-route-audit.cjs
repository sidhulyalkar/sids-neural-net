const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const DECK = '[data-frontier-section-deck="true"]';
const CURRENT_CARD = '[data-frontier-page-role="current"] [data-frontier-fluid-card]';
const ALL_CARD = '[data-frontier-fluid-card]';
const MAX_USEFUL_PAINT_MS = 9_000;
const MAX_SWAP_SETTLE_MS = 700;
const PASSIVE_QUIET_MS = 2_000;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function refreshItem(index) {
  return {
    id: `frontier-v24-refresh-${index}`,
    title: `Fresh render-fast edition item ${index}`,
    summary: 'Deterministic explicit-refresh fixture for the bounded FRONTIER single-page runtime.',
    url: `https://refresh-${index}.example.invalid/item`,
    source: `refresh-${index}.example.invalid`,
    sourceLabel: `Refresh ${index}`,
    sourceKind: 'local',
    publishedAt: new Date().toISOString(),
    lane: ['ai_frontier', 'neuro_frontier', 'gaming', 'sports'][index % 4],
    tags: ['frontier-v24-audit'],
    baseScore: 0.92 - index * 0.004,
    importance: 0.78,
    novelty: 0.82,
    quality: 0.98,
    momentum: 0.5,
  };
}

async function installRuntimeProbe(context) {
  await context.addInitScript(() => {
    const workers = [];
    Object.defineProperty(window, '__frontierV24Workers', { value: workers, configurable: false });
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        workers.push(String(args[0] || ''));
        return Reflect.construct(target, args, newTarget);
      },
    });
  });
}

async function state(page) {
  return page.evaluate(({ deckSelector, currentCardSelector, allCardSelector }) => {
    const deck = document.querySelector(deckSelector);
    const currentIds = Array.from(document.querySelectorAll(currentCardSelector))
      .map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    const root = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0);
    const clientHeight = root?.clientHeight || window.innerHeight;
    return {
      exists: Boolean(deck),
      currentIds,
      currentCount: currentIds.length,
      domCardCount: document.querySelectorAll(allCardSelector).length,
      mountedAttribute: Number(deck?.getAttribute('data-frontier-mounted-cards') || 0),
      totalItems: Number(deck?.getAttribute('data-frontier-total-items') || 0),
      pageCount: Number(deck?.getAttribute('data-frontier-page-count') || 0),
      turn: deck?.getAttribute('data-frontier-turning') || '',
      cache: deck?.getAttribute('data-frontier-page-cache') || '',
      prefetch: deck?.getAttribute('data-frontier-prefetch-depth') || '',
      fastSwap: deck?.getAttribute('data-frontier-fast-swap') || '',
      performanceRoute: Boolean(document.querySelector('[data-frontier-performance-route="true"]')),
      ambientCanvases: document.querySelectorAll('canvas[data-frontier-audio-reactive="true"]').length,
      workers: Array.isArray(window.__frontierV24Workers) ? window.__frontierV24Workers.slice() : [],
      scrollRange: Math.max(0, scrollHeight - clientHeight),
      bodyOverflowY: getComputedStyle(body).overflowY,
      bodyText: (body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2500),
    };
  }, { deckSelector: DECK, currentCardSelector: CURRENT_CARD, allCardSelector: ALL_CARD });
}

async function waitForSettledDeck(page, maxCards) {
  await page.waitForFunction(({ deckSelector, currentCardSelector, max }) => {
    const deck = document.querySelector(deckSelector);
    const count = document.querySelectorAll(currentCardSelector).length;
    const terminal = /No unseen signals in this edition\.|No unseen match\./i.test(document.body?.innerText || '');
    return Boolean(deck)
      && deck.getAttribute('data-frontier-turning') === 'idle'
      && ((count > 0 && count <= max) || terminal);
  }, { deckSelector: DECK, currentCardSelector: CURRENT_CARD, max: maxCards }, { polling: 'raf', timeout: MAX_USEFUL_PAINT_MS });
}

async function swapForward(page, beforeIds, maxCards) {
  const started = Date.now();
  await page.getByRole('button', { name: 'Next section' }).click();
  await page.waitForFunction(({ deckSelector, currentCardSelector, prior, max }) => {
    const deck = document.querySelector(deckSelector);
    const ids = Array.from(document.querySelectorAll(currentCardSelector))
      .map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    return deck?.getAttribute('data-frontier-turning') === 'idle'
      && ids.length > 0
      && ids.length <= max
      && ids.join('|') !== prior.join('|');
  }, { deckSelector: DECK, currentCardSelector: CURRENT_CARD, prior: beforeIds, max: maxCards }, { polling: 'raf', timeout: MAX_SWAP_SETTLE_MS });
  return Date.now() - started;
}

async function auditViewport(browser, viewport, maxCards, label) {
  const context = await browser.newContext({ viewport, colorScheme: 'dark' });
  await installRuntimeProbe(context);
  const page = await context.newPage();
  const apiRequests = [];
  const pageErrors = [];
  const consoleErrors = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/frontier/feed') || url.includes('/api/frontier/forage')) apiRequests.push(url);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });

  const startedAt = Date.now();
  try {
    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `${label} FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await waitForSettledDeck(page, maxCards);
    const usefulPaintMs = Date.now() - startedAt;
    const first = await state(page);

    assert(first.performanceRoute, `${label} did not expose performance-isolated FRONTIER root`);
    assert(first.currentCount > 0, `${label} edition did not paint real cards`);
    assert(first.currentCount <= maxCards, `${label} current page mounted ${first.currentCount}; budget=${maxCards}`);
    assert.equal(first.currentCount, first.mountedAttribute, `${label} mounted-card telemetry drifted from current page`);
    assert.equal(first.domCardCount, first.currentCount, `${label} should mount exactly one page of cards`);
    assert.equal(first.turn, 'idle', `${label} first useful paint was not settled`);
    assert.equal(first.cache, 'decoded-media', `${label} decoded-media cache contract missing`);
    assert.equal(first.prefetch, 'adjacent', `${label} adjacent prefetch contract missing`);
    assert.equal(first.fastSwap, 'true', `${label} fast-swap runtime contract missing`);
    assert(first.scrollRange <= 2, `${label} daily deck still creates document scroll: ${first.scrollRange}px`);
    assert.equal(first.bodyOverflowY, 'hidden', `${label} body vertical overflow is not locked`);
    assert(usefulPaintMs <= MAX_USEFUL_PAINT_MS, `${label} useful paint exceeded ${MAX_USEFUL_PAINT_MS}ms: ${usefulPaintMs}ms`);
    assert.deepEqual(apiRequests, [], `${label} cold load unexpectedly called live feed APIs: ${apiRequests.join(' | ')}`);

    await page.waitForTimeout(PASSIVE_QUIET_MS);
    const quiet = await state(page);
    assert.deepEqual(apiRequests, [], `${label} passive runtime activated live discovery: ${apiRequests.join(' | ')}`);
    assert.equal(quiet.ambientCanvases, 0, `${label} ambient canvas should be absent on the performance route`);
    assert(!quiet.workers.some((url) => /liveDaemonWorker|semantic|rerank/i.test(url)), `${label} started a heavy feed worker: ${quiet.workers.join(' | ')}`);

    let swapMs = null;
    if (first.pageCount > 1) {
      swapMs = await swapForward(page, first.currentIds, maxCards);
      const after = await state(page);
      assert(after.currentCount <= maxCards, `${label} settled swap exceeded current-card budget`);
      assert.equal(after.domCardCount, after.currentCount, `${label} swap mounted more than one page`);
      assert.equal(after.totalItems, first.totalItems, `${label} page swap changed retained edition size`);
      assert(after.scrollRange <= 2, `${label} page swap introduced document scroll: ${after.scrollRange}px`);
      assert(swapMs <= MAX_SWAP_SETTLE_MS, `${label} page swap took ${swapMs}ms to settle`);
      assert.deepEqual(apiRequests, [], `${label} page swap triggered live data fetch: ${apiRequests.join(' | ')}`);
    }

    assert.deepEqual(pageErrors, [], `${label} emitted page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `${label} emitted console errors: ${consoleErrors.join(' | ')}`);
    return { usefulPaintMs, swapMs, first, quiet };
  } finally {
    await context.close();
  }
}

async function auditExplicitRefresh(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const refreshRequests = [];
  try {
    await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    await waitForSettledDeck(page, 6);
    await page.route('**/api/frontier/feed**', async (route) => {
      const url = new URL(route.request().url());
      refreshRequests.push(url.toString());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          items: Array.from({ length: 18 }, (_, index) => refreshItem(index + 1)),
          sources: [{ id: 'local', label: 'FRONTIER v24 refresh', ok: true, count: 18 }],
        }),
      });
    });
    await page.getByRole('button', { name: 'Full live refresh' }).click();
    await page.waitForFunction(({ deckSelector, currentCardSelector }) => {
      const deck = document.querySelector(deckSelector);
      return deck?.getAttribute('data-frontier-turning') === 'idle'
        && Array.from(document.querySelectorAll(currentCardSelector))
          .some((node) => (node.getAttribute('data-frontier-fluid-card') || '').startsWith('frontier-v24-refresh-'));
    }, { deckSelector: DECK, currentCardSelector: CURRENT_CARD }, { timeout: 4_000, polling: 'raf' });
    const refreshed = await state(page);
    assert.equal(refreshRequests.length, 1, `explicit refresh should issue one feed request, saw ${refreshRequests.length}`);
    const refreshUrl = new URL(refreshRequests[0]);
    assert.equal(refreshUrl.searchParams.get('fresh'), '1', 'explicit refresh must request fresh=1');
    assert(refreshUrl.searchParams.get('request'), 'explicit refresh must include cache-busting request identity');
    assert.equal(refreshed.totalItems, 18, 'explicit refresh should replace rather than append the edition');
    assert(refreshed.currentCount <= 6, `explicit refresh broke desktop page budget: ${refreshed.currentCount}`);
    assert.equal(refreshed.domCardCount, refreshed.currentCount, 'explicit refresh should still mount one page only');
    return { refreshed, refreshRequests };
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let report;
  try {
    report = {
      passed: true,
      desktop: await auditViewport(browser, { width: 1440, height: 1000 }, 6, 'desktop'),
      mobile: await auditViewport(browser, { width: 390, height: 844 }, 2, 'mobile'),
      refresh: await auditExplicitRefresh(browser),
    };
  } catch (error) {
    report = { passed: false, error: error instanceof Error ? error.stack || error.message : String(error) };
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'frontier-section-route-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
})();