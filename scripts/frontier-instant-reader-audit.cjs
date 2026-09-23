const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const DECK = '[data-frontier-section-deck="true"]';
const CURRENT = '[data-frontier-page-role="current"]';
const CARD = CURRENT + ' [data-frontier-fluid-card]';
const MAX_USEFUL_PAINT_MS = 9000;
const PASSIVE_QUIET_MS = 2200;
const MAX_SWAP_SETTLE_MS = 700;
const MAX_P95_DOM_SWAP_MS = 180;
const MAX_TURN_LONG_TASK_MS = 80;

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function installProbe(context) {
  await context.addInitScript(() => {
    const workers = [];
    const longTasks = [];
    const layoutShifts = [];
    Object.defineProperty(window, '__frontierV26Probe', {
      value: { workers, longTasks, layoutShifts },
      configurable: false,
    });

    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        workers.push(String(args[0] || ''));
        return Reflect.construct(target, args, newTarget);
      },
    });

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) layoutShifts.push({ startTime: entry.startTime, value: entry.value });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });
}

async function state(page) {
  return page.evaluate(({ deckSelector, cardSelector, currentSelector }) => {
    const deck = document.querySelector(deckSelector);
    const current = document.querySelector(currentSelector);
    const cards = Array.from(document.querySelectorAll(cardSelector));
    const root = document.querySelector('[data-frontier-performance-route="true"]');
    const pageImages = current ? Array.from(current.querySelectorAll('img')) : [];
    const body = document.body;
    const doc = document.documentElement;
    const probe = window.__frontierV26Probe || { workers: [], longTasks: [], layoutShifts: [] };
    return {
      cards: cards.map((node) => node.getAttribute('data-frontier-fluid-card') || ''),
      cardCount: cards.length,
      domCardCount: document.querySelectorAll('[data-frontier-fluid-card]').length,
      pageCount: Number(deck?.getAttribute('data-frontier-page-count') || 0),
      totalItems: Number(deck?.getAttribute('data-frontier-total-items') || 0),
      livePlanes: Number(deck?.getAttribute('data-frontier-live-planes') || 0),
      transition: deck?.getAttribute('data-frontier-transition') || '',
      cache: deck?.getAttribute('data-frontier-page-cache') || '',
      prefetch: deck?.getAttribute('data-frontier-prefetch-depth') || '',
      mediaConcurrency: Number(deck?.getAttribute('data-frontier-media-concurrency') || 0),
      dataAuthority: root?.getAttribute('data-frontier-data-authority') || '',
      passiveDiscovery: root?.getAttribute('data-frontier-passive-discovery') || '',
      performanceRoute: Boolean(root),
      iframeCount: current?.querySelectorAll('iframe').length || 0,
      videoCount: current?.querySelectorAll('video').length || 0,
      canvasCount: document.querySelectorAll('canvas').length,
      imageCount: pageImages.length,
      eagerImages: pageImages.filter((image) => image.loading === 'eager').length,
      highPriorityImages: pageImages.filter((image) => image.fetchPriority === 'high').length,
      workers: probe.workers.slice(),
      longTasks: probe.longTasks.slice(),
      layoutShifts: probe.layoutShifts.slice(),
      scrollRange: Math.max(0, Math.max(doc.scrollHeight, body.scrollHeight) - doc.clientHeight),
      bodyOverflowY: getComputedStyle(body).overflowY,
      bodyText: (body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2000),
    };
  }, { deckSelector: DECK, cardSelector: CARD, currentSelector: CURRENT });
}

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
}

async function waitForDeck(page, maxCards) {
  await page.waitForFunction(({ deckSelector, cardSelector, max }) => {
    const deck = document.querySelector(deckSelector);
    const count = document.querySelectorAll(cardSelector).length;
    const terminal = /No unseen signals in this edition\.|No unseen match\./i.test(document.body?.innerText || '');
    return Boolean(deck) && ((count > 0 && count <= max) || terminal);
  }, { deckSelector: DECK, cardSelector: CARD, max: maxCards }, { polling: 'raf', timeout: MAX_USEFUL_PAINT_MS });
}

async function swap(page, direction, maxCards) {
  const before = await page.evaluate((selector) => (
    Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '')
  ), CARD);
  const beforePerf = await page.evaluate(() => performance.now());
  const started = Date.now();
  await page.getByRole('button', { name: direction === 'forward' ? 'Next section' : 'Previous section' }).click();
  await page.waitForFunction(({ selector, prior, max }) => {
    const ids = Array.from(document.querySelectorAll(selector))
      .map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    return ids.length > 0 && ids.length <= max && ids.join('|') !== prior.join('|');
  }, { selector: CARD, prior: before, max: maxCards }, { polling: 'raf', timeout: MAX_SWAP_SETTLE_MS });
  const domSwapMs = Date.now() - started;
  await page.waitForTimeout(260);
  const afterPerf = await page.evaluate(() => performance.now());
  const after = await state(page);
  const turnLongTasks = after.longTasks.filter((entry) => entry.startTime >= beforePerf && entry.startTime <= afterPerf);
  return {
    domSwapMs,
    maxLongTaskMs: turnLongTasks.reduce((max, entry) => Math.max(max, entry.duration), 0),
    after,
  };
}

async function auditViewport(browser, viewport, maxCards, label) {
  const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'no-preference' });
  await installProbe(context);
  const page = await context.newPage();
  const discoveryRequests = [];
  const accountRequests = [];
  const mediaRequests = [];
  const pageErrors = [];
  const consoleErrors = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/frontier/feed') || url.includes('/api/frontier/forage')) {
      discoveryRequests.push({ url, at: Date.now() });
    }
    if (
      url.includes('/api/auth/session')
      || url.includes('/api/frontier/memory')
      || url.includes('/api/frontier/google/import')
    ) {
      accountRequests.push({ url, at: Date.now() });
    }
    if (request.resourceType() === 'image' || url.includes('/api/frontier/media')) {
      mediaRequests.push({ url, at: Date.now() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });

  const started = Date.now();
  try {
    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `${label}: route returned ${response?.status() ?? 'no response'}`);
    await waitForDeck(page, maxCards);
    const usefulPaintMs = Date.now() - started;
    const first = await state(page);

    assert(first.performanceRoute, `${label}: performance route marker missing`);
    assert.equal(first.dataAuthority, 'server-snapshot', `${label}: first data must be server snapshot authority`);
    assert.equal(first.passiveDiscovery, 'off', `${label}: passive discovery must be disabled`);
    assert(first.cardCount > 0 && first.cardCount <= maxCards, `${label}: card budget exceeded: ${first.cardCount}/${maxCards}`);
    assert.equal(first.domCardCount, first.cardCount, `${label}: more than one React page is mounted`);
    assert.equal(first.livePlanes, 1, `${label}: live page plane count drifted`);
    assert.equal(first.transition, 'view-transition-single-plane', `${label}: compositor transition contract missing`);
    assert.equal(first.cache, 'decoded-media-12', `${label}: bounded decode cache contract missing`);
    assert.equal(first.prefetch, 'adjacent', `${label}: adjacent warm contract missing`);
    assert.equal(first.mediaConcurrency, 2, `${label}: media warm concurrency must remain 2`);
    assert(first.imageCount <= 2, `${label}: browse page rendered more than two media images: ${first.imageCount}`);
    assert.equal(first.iframeCount, 0, `${label}: browse page must not mount iframe media`);
    assert.equal(first.videoCount, 0, `${label}: browse page must not mount active video`);
    assert.equal(first.canvasCount, 0, `${label}: FRONTIER performance route must not mount ambient/GPU canvas`);
    assert(first.scrollRange <= 2, `${label}: finite reader created document scroll: ${first.scrollRange}px`);
    assert.equal(first.bodyOverflowY, 'hidden', `${label}: body overflow must remain locked`);
    assert(usefulPaintMs <= MAX_USEFUL_PAINT_MS, `${label}: useful paint exceeded ${MAX_USEFUL_PAINT_MS}ms: ${usefulPaintMs}`);
    assert.deepEqual(discoveryRequests, [], `${label}: cold load called discovery APIs`);
    assert.deepEqual(accountRequests, [], `${label}: cold load called account/cloud APIs`);

    await page.waitForTimeout(PASSIVE_QUIET_MS);
    const quiet = await state(page);
    assert.deepEqual(discoveryRequests, [], `${label}: passive runtime called discovery APIs`);
    assert.deepEqual(accountRequests, [], `${label}: passive runtime called account/cloud APIs`);
    assert(!quiet.workers.some((url) => /liveDaemonWorker|semantic|rerank/i.test(url)), `${label}: heavy worker started: ${quiet.workers.join(' | ')}`);

    const turnResults = [];
    if (first.pageCount > 1) {
      for (let index = 0; index < 8; index += 1) {
        const direction = index % 2 === 0 ? 'forward' : 'backward';
        const result = await swap(page, direction, maxCards);
        turnResults.push(result);
        assert(result.after.cardCount <= maxCards, `${label}: turn exceeded card budget`);
        assert.equal(result.after.domCardCount, result.after.cardCount, `${label}: turn mounted a second React page`);
        assert.equal(result.after.livePlanes, 1, `${label}: turn changed live page plane authority`);
        assert.equal(result.after.iframeCount, 0, `${label}: turn mounted iframe media`);
        assert.equal(result.after.videoCount, 0, `${label}: turn mounted active video`);
        assert.equal(result.after.canvasCount, 0, `${label}: turn mounted a GPU/ambient canvas`);
        assert(result.after.imageCount <= 2, `${label}: turn rendered too many media images`);
        assert(result.maxLongTaskMs <= MAX_TURN_LONG_TASK_MS, `${label}: turn long task ${result.maxLongTaskMs.toFixed(1)}ms exceeded ${MAX_TURN_LONG_TASK_MS}ms`);
      }
    }

    const swaps = turnResults.map((result) => result.domSwapMs);
    const p95DomSwapMs = percentile(swaps, 0.95);
    assert(p95DomSwapMs <= MAX_P95_DOM_SWAP_MS, `${label}: p95 DOM swap ${p95DomSwapMs}ms exceeded ${MAX_P95_DOM_SWAP_MS}ms`);
    assert.deepEqual(discoveryRequests, [], `${label}: page turns triggered discovery APIs`);
    assert.deepEqual(pageErrors, [], `${label}: page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `${label}: console errors: ${consoleErrors.join(' | ')}`);

    return {
      usefulPaintMs,
      p95DomSwapMs,
      swapSamples: swaps,
      maxTurnLongTaskMs: Math.max(0, ...turnResults.map((result) => result.maxLongTaskMs)),
      first,
      quiet,
      mediaRequestCount: mediaRequests.length,
      discoveryRequests,
      accountRequests,
    };
  } finally {
    await context.close();
  }
}

async function auditReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' });
  const page = await context.newPage();
  try {
    await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    await waitForDeck(page, 10);
    const before = await state(page);
    if (before.pageCount > 1) {
      const started = Date.now();
      await page.getByRole('button', { name: 'Next section' }).click();
      await page.waitForFunction(({ selector, prior }) => {
        const ids = Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
        return ids.join('|') !== prior.join('|');
      }, { selector: CARD, prior: before.cards }, { timeout: 500, polling: 'raf' });
      assert(Date.now() - started <= 180, 'reduced-motion page swap should be immediate');
    }
    return await state(page);
  } finally {
    await context.close();
  }
}

async function auditExplicitRefresh(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const requests = [];
  try {
    await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    await waitForDeck(page, 10);
    await page.route('**/api/frontier/feed**', async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.toString());
      const now = new Date().toISOString();
      const items = Array.from({ length: 18 }, (_, index) => ({
        id: `frontier-v26-refresh-${index + 1}`,
        title: `Fresh v26 item ${index + 1}`,
        summary: 'Explicit refresh fixture for the finite FRONTIER reader.',
        url: `https://refresh-${index + 1}.example.invalid/item`,
        source: `refresh-${index + 1}.example.invalid`,
        sourceLabel: 'FRONTIER CI',
        sourceKind: 'local',
        publishedAt: now,
        lane: ['ai_frontier', 'neuro_frontier', 'gaming', 'sports'][index % 4],
        tags: ['frontier-v26-audit'],
        baseScore: 0.92 - index * 0.004,
        importance: 0.78,
        novelty: 0.82,
        quality: 0.98,
        momentum: 0.5,
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: now,
          items,
          sources: [{ id: 'local', label: 'FRONTIER CI', ok: true, count: items.length }],
        }),
      });
    });

    await page.getByRole('button', { name: 'Full live refresh' }).click();
    await page.waitForFunction((selector) => (
      Array.from(document.querySelectorAll(selector))
        .some((node) => (node.getAttribute('data-frontier-fluid-card') || '').startsWith('frontier-v26-refresh-'))
    ), CARD, { timeout: 4000, polling: 'raf' });

    const refreshed = await state(page);
    assert.equal(requests.length, 1, `explicit refresh should issue one request, saw ${requests.length}`);
    const url = new URL(requests[0]);
    assert.equal(url.searchParams.get('fresh'), '1', 'explicit refresh must use fresh=1');
    assert(url.searchParams.get('request'), 'explicit refresh must include cache-busting identity');
    assert.equal(refreshed.totalItems, 18, 'explicit refresh should replace rather than append the edition');
    assert(refreshed.cardCount <= 10, 'explicit refresh broke page budget');
    return { requests, refreshed };
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
      desktop: await auditViewport(browser, { width: 1440, height: 900 }, 10, 'desktop'),
      ultrawide: await auditViewport(browser, { width: 2560, height: 1080 }, 10, 'ultrawide'),
      mobile: await auditViewport(browser, { width: 390, height: 844 }, 4, 'mobile'),
      reducedMotion: await auditReducedMotion(browser),
      refresh: await auditExplicitRefresh(browser),
      budgets: {
        desktopCards: 10,
        mobileCards: 4,
        mediaPerPage: 2,
        mediaConcurrency: 2,
        maxP95DomSwapMs: MAX_P95_DOM_SWAP_MS,
        maxTurnLongTaskMs: MAX_TURN_LONG_TASK_MS,
      },
    };
  } catch (error) {
    report = { passed: false, error: error instanceof Error ? error.stack || error.message : String(error) };
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'frontier-instant-reader-audit.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
})();
