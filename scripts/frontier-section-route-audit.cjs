const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const DECK = '[data-frontier-section-deck="true"]';
const CARD = '[data-frontier-fluid-card]';
const MAX_DESKTOP_CARDS = 10;
const MAX_MOBILE_CARDS = 8;
const MAX_USEFUL_PAINT_MS = 9_000;
const PASSIVE_QUIET_MS = 2_600;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function refreshItem(index) {
  return {
    id: `frontier-v21-refresh-${index}`,
    title: `Fresh newspaper item ${index}`,
    summary: 'Deterministic explicit-refresh fixture for the bounded FRONTIER section deck.',
    url: `https://refresh-${index}.example.invalid/item`,
    source: `refresh-${index}.example.invalid`,
    sourceLabel: `Refresh ${index}`,
    sourceKind: 'local',
    publishedAt: '2026-09-02T18:00:00.000Z',
    lane: ['ai_frontier', 'neuro_frontier', 'gaming', 'sports'][index % 4],
    tags: ['frontier-v21-audit'],
    baseScore: 0.92 - index * 0.004,
    importance: 0.78,
    novelty: 0.82,
    quality: 0.98,
    momentum: 0.5,
  };
}

async function deckState(page) {
  return page.evaluate(({ deckSelector, cardSelector }) => {
    const deck = document.querySelector(deckSelector);
    const ids = Array.from(document.querySelectorAll(cardSelector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    return {
      exists: Boolean(deck),
      mountedAttribute: Number(deck?.getAttribute('data-frontier-mounted-cards') || 0),
      totalItems: Number(deck?.getAttribute('data-frontier-total-items') || 0),
      pageCount: Number(deck?.getAttribute('data-frontier-page-count') || 0),
      cardCount: ids.length,
      ids,
      currentRail: document.querySelector('[aria-current="page"]')?.textContent?.trim() || '',
      canvases: document.querySelectorAll('canvas').length,
      ambientCanvases: document.querySelectorAll('canvas[data-frontier-audio-reactive="true"]').length,
      loading: Boolean(document.querySelector('[aria-label="Scanning live sources"]')),
      bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2500),
      workers: Array.isArray(window.__frontierV21Workers) ? window.__frontierV21Workers.slice() : [],
    };
  }, { deckSelector: DECK, cardSelector: CARD });
}

async function installRuntimeProbe(context) {
  await context.addInitScript(() => {
    const workers = [];
    Object.defineProperty(window, '__frontierV21Workers', { value: workers, configurable: false });
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        workers.push(String(args[0] || ''));
        return Reflect.construct(target, args, newTarget);
      },
    });
  });
}

async function waitForDeck(page, maxCards) {
  await page.waitForFunction(({ deckSelector, cardSelector, max }) => {
    const deck = document.querySelector(deckSelector);
    if (!deck) return false;
    const count = document.querySelectorAll(cardSelector).length;
    const text = document.body?.innerText || '';
    const terminal = /No unseen signals in this edition\.|No unseen match\./i.test(text);
    return (count > 0 && count <= max) || terminal;
  }, { deckSelector: DECK, cardSelector: CARD, max: maxCards }, { polling: 'raf', timeout: MAX_USEFUL_PAINT_MS });
}

async function auditDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
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
    assert(response && response.ok(), `FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await waitForDeck(page, MAX_DESKTOP_CARDS);
    const settledMs = Date.now() - startedAt;
    const first = await deckState(page);

    assert.equal(first.loading, false, 'server snapshot must not leave a loading skeleton over usable cards');
    assert(first.cardCount > 0, 'desktop newspaper should paint real snapshot cards');
    assert(first.cardCount <= MAX_DESKTOP_CARDS, `desktop mounted ${first.cardCount} cards; budget is ${MAX_DESKTOP_CARDS}`);
    assert.equal(first.cardCount, first.mountedAttribute, 'mounted-card telemetry must match the real DOM');
    assert(first.totalItems >= first.cardCount, 'deck total candidate count may not be smaller than mounted cards');
    assert(settledMs <= MAX_USEFUL_PAINT_MS, `server-snapshot useful paint exceeded ${MAX_USEFUL_PAINT_MS}ms: ${settledMs}ms`);
    assert.deepEqual(apiRequests, [], `passive cold load unexpectedly called FRONTIER APIs: ${apiRequests.join(' | ')}`);

    await page.waitForTimeout(PASSIVE_QUIET_MS);
    const quiet = await deckState(page);
    assert.deepEqual(apiRequests, [], `passive newspaper runtime started background network work: ${apiRequests.join(' | ')}`);
    assert(!quiet.workers.some((url) => /liveDaemonWorker|semantic|rerank/i.test(url)), `passive newspaper started a heavy feed worker: ${quiet.workers.join(' | ')}`);
    assert(quiet.ambientCanvases <= 1, `expected at most one deferred ambient canvas, saw ${quiet.ambientCanvases}`);

    const visited = [first.ids];
    let maxMounted = first.cardCount;
    if (first.pageCount > 1) {
      const turns = Math.min(first.pageCount - 1, 5);
      for (let index = 0; index < turns; index += 1) {
        const before = await deckState(page);
        await page.getByRole('button', { name: 'Next section' }).click();
        await page.waitForFunction(({ selector, prior }) => {
          const ids = Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
          return ids.length > 0 && ids.join('|') !== prior.join('|');
        }, { selector: CARD, prior: before.ids }, { timeout: 2_500, polling: 'raf' });
        const after = await deckState(page);
        maxMounted = Math.max(maxMounted, after.cardCount);
        visited.push(after.ids);
        assert(after.cardCount <= MAX_DESKTOP_CARDS, `page turn mounted ${after.cardCount} desktop cards`);
        assert.equal(after.totalItems, first.totalItems, 'page navigation must not grow the retained edition');
      }
    }
    assert(maxMounted <= MAX_DESKTOP_CARDS, `desktop traversal exceeded mounted-card budget: ${maxMounted}`);
    assert.deepEqual(apiRequests, [], `page traversal unexpectedly activated live APIs: ${apiRequests.join(' | ')}`);

    const refreshRequests = [];
    await page.route('**/api/frontier/feed**', async (route) => {
      const url = new URL(route.request().url());
      refreshRequests.push(url.toString());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: '2026-09-02T18:01:00.000Z',
          items: Array.from({ length: 18 }, (_, index) => refreshItem(index + 1)),
          sources: [{ id: 'local', label: 'FRONTIER v21 refresh', ok: true, count: 18 }],
        }),
      });
    });
    await page.getByRole('button', { name: 'Full live refresh' }).click();
    await page.waitForFunction(({ selector }) => (
      Array.from(document.querySelectorAll(selector)).some((node) => (node.getAttribute('data-frontier-fluid-card') || '').startsWith('frontier-v21-refresh-'))
    ), { selector: CARD }, { timeout: 4_000, polling: 'raf' });
    const refreshed = await deckState(page);
    assert.equal(refreshRequests.length, 1, `explicit refresh should issue exactly one feed request, saw ${refreshRequests.length}`);
    const refreshUrl = new URL(refreshRequests[0]);
    assert.equal(refreshUrl.searchParams.get('fresh'), '1', 'explicit refresh must request fresh=1');
    assert(refreshUrl.searchParams.get('request'), 'explicit refresh must include a cache-busting request identity');
    assert(refreshed.cardCount <= MAX_DESKTOP_CARDS, `explicit refresh broke desktop mount budget: ${refreshed.cardCount}`);
    assert.equal(refreshed.totalItems, 18, 'explicit refresh should replace the edition rather than append an unbounded river');
    assert.deepEqual(pageErrors, [], `FRONTIER emitted page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `FRONTIER emitted console errors: ${consoleErrors.join(' | ')}`);

    return { settledMs, first, quiet, visitedPages: visited.length, maxMounted, refreshed, refreshRequests };
  } finally {
    await context.close();
  }
}

async function auditMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await installRuntimeProbe(context);
  const page = await context.newPage();
  const apiRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/frontier/feed') || url.includes('/api/frontier/forage')) apiRequests.push(url);
  });

  try {
    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `Mobile FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(({ deckSelector, cardSelector, max }) => {
      const deck = document.querySelector(deckSelector);
      const count = document.querySelectorAll(cardSelector).length;
      return Boolean(deck) && count > 0 && count <= max;
    }, { deckSelector: DECK, cardSelector: CARD, max: MAX_MOBILE_CARDS }, { timeout: MAX_USEFUL_PAINT_MS, polling: 'raf' });
    const first = await deckState(page);
    assert(first.cardCount <= MAX_MOBILE_CARDS, `mobile mounted ${first.cardCount} cards; budget is ${MAX_MOBILE_CARDS}`);
    assert.deepEqual(apiRequests, [], `mobile cold load unexpectedly called FRONTIER APIs: ${apiRequests.join(' | ')}`);

    if (first.pageCount > 1) {
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(({ selector, prior }) => {
        const ids = Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
        return ids.length > 0 && ids.join('|') !== prior.join('|');
      }, { selector: CARD, prior: first.ids }, { timeout: 2_500, polling: 'raf' });
      const second = await deckState(page);
      assert(second.cardCount <= MAX_MOBILE_CARDS, `mobile page turn mounted ${second.cardCount} cards`);
      assert.equal(second.totalItems, first.totalItems, 'mobile page turn must preserve bounded edition size');
    }

    return { first, apiRequests };
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
      desktop: await auditDesktop(browser),
      mobile: await auditMobile(browser),
    };
  } catch (error) {
    report = {
      passed: false,
      error: error instanceof Error ? error.stack || error.message : String(error),
    };
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'frontier-section-route-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
})();
