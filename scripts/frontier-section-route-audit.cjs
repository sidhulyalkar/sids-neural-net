const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const FRONTIER_URL = process.env.FRONTIER_ROUTE_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const DECK = '[data-frontier-section-deck="true"]';
const CURRENT_CARD = '[data-frontier-page-role="current"] [data-frontier-fluid-card]';
const ALL_CARD = '[data-frontier-fluid-card]';
const INCOMING_PAGE = '[data-frontier-page-role="incoming"]';
const GPU_MEDIA_CANVAS = 'body > canvas[aria-hidden="true"][style*="z-index: 42"]';
const NATIVE_GPU_SURFACE = '[data-media-native-ready]';
const TURN_PRIORITY_IMAGE = 'img[data-frontier-turn-priority="high"]';
const MAX_USEFUL_PAINT_MS = 9_000;
const MAX_PREPARE_MS = 180;
const MAX_TURN_SETTLE_MS = 1_400;
const PASSIVE_QUIET_MS = 2_000;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function refreshItem(index) {
  return {
    id: `frontier-v22-refresh-${index}`,
    title: `Fresh predictive edition item ${index}`,
    summary: 'Deterministic explicit-refresh fixture for the bounded FRONTIER predictive page deck.',
    url: `https://refresh-${index}.example.invalid/item`,
    source: `refresh-${index}.example.invalid`,
    sourceLabel: `Refresh ${index}`,
    sourceKind: 'local',
    publishedAt: new Date().toISOString(),
    lane: ['ai_frontier', 'neuro_frontier', 'gaming', 'sports'][index % 4],
    tags: ['frontier-v22-audit'],
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
    Object.defineProperty(window, '__frontierV22Workers', { value: workers, configurable: false });
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
  return page.evaluate(({ deckSelector, currentCardSelector, allCardSelector, gpuCanvasSelector }) => {
    const deck = document.querySelector(deckSelector);
    const currentIds = Array.from(document.querySelectorAll(currentCardSelector))
      .map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    const gpuCanvas = document.querySelector(gpuCanvasSelector);
    const gpuStyle = gpuCanvas ? getComputedStyle(gpuCanvas) : null;
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
      readinessGate: deck?.getAttribute('data-frontier-readiness-gate') || '',
      performanceRoute: Boolean(document.querySelector('[data-frontier-performance-route="true"]')),
      ambientCanvases: document.querySelectorAll('canvas[data-frontier-audio-reactive="true"]').length,
      gpuMediaCanvasPresent: Boolean(gpuCanvas),
      gpuMediaCanvasVisibility: gpuStyle?.visibility ?? null,
      gpuMediaCanvasOpacity: gpuStyle?.opacity ?? null,
      workers: Array.isArray(window.__frontierV22Workers) ? window.__frontierV22Workers.slice() : [],
      bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2500),
    };
  }, {
    deckSelector: DECK,
    currentCardSelector: CURRENT_CARD,
    allCardSelector: ALL_CARD,
    gpuCanvasSelector: GPU_MEDIA_CANVAS,
  });
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

async function armTurnProbe(page) {
  await page.evaluate(({
    deckSelector,
    incomingSelector,
    allCardSelector,
    gpuCanvasSelector,
    nativeSurfaceSelector,
    turnPrioritySelector,
  }) => {
    const deck = document.querySelector(deckSelector);
    if (!deck) throw new Error('FRONTIER deck missing while arming turn probe');
    window.__frontierTurnProbe?.observer?.disconnect?.();
    if (window.__frontierTurnProbe?.rafId) cancelAnimationFrame(window.__frontierTurnProbe.rafId);
    window.__frontierTurnProbe?.layoutObserver?.disconnect?.();

    const startedAt = performance.now();
    const events = [];
    const frameGaps = [];
    const layoutShifts = [];
    let previousFrameAt = startedAt;
    let rafId = 0;
    let layoutObserver = null;

    const sample = () => {
      const phase = deck.getAttribute('data-frontier-turning') || '';
      const incoming = document.querySelector(incomingSelector);
      const gpuCanvas = document.querySelector(gpuCanvasSelector);
      const gpuStyle = gpuCanvas ? getComputedStyle(gpuCanvas) : null;
      const incomingNativeSurfaces = incoming
        ? Array.from(incoming.querySelectorAll(nativeSurfaceSelector))
        : [];
      const incomingReady = incomingNativeSurfaces
        .filter((surface) => surface.getAttribute('data-media-native-ready') === 'true').length;
      const incomingPriority = incoming
        ? incoming.querySelectorAll(turnPrioritySelector).length
        : 0;
      events.push({
        phase,
        atMs: performance.now() - startedAt,
        domCardCount: document.querySelectorAll(allCardSelector).length,
        incomingPresent: Boolean(incoming),
        incomingVisibility: incoming ? getComputedStyle(incoming).visibility : null,
        incomingNativeCount: incomingNativeSurfaces.length,
        incomingNativeReadyCount: incomingReady,
        incomingTurnPriorityCount: incomingPriority,
        gpuCanvasPresent: Boolean(gpuCanvas),
        gpuCanvasVisibility: gpuStyle?.visibility ?? null,
        gpuCanvasOpacity: gpuStyle?.opacity ?? null,
      });
    };

    const frame = (now) => {
      frameGaps.push(now - previousFrameAt);
      previousFrameAt = now;
      rafId = requestAnimationFrame(frame);
      if (window.__frontierTurnProbe) window.__frontierTurnProbe.rafId = rafId;
    };
    rafId = requestAnimationFrame(frame);

    if (typeof PerformanceObserver !== 'undefined'
      && Array.isArray(PerformanceObserver.supportedEntryTypes)
      && PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
      layoutObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          layoutShifts.push({
            atMs: entry.startTime - startedAt,
            value: entry.value,
            hadRecentInput: entry.hadRecentInput,
          });
        }
      });
      layoutObserver.observe({ type: 'layout-shift', buffered: false });
    }

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'attributes' && mutation.attributeName === 'data-frontier-turning')) sample();
    });
    observer.observe(deck, { attributes: true, attributeFilter: ['data-frontier-turning'] });
    window.__frontierTurnProbe = { startedAt, events, frameGaps, layoutShifts, observer, layoutObserver, rafId };
  }, {
    deckSelector: DECK,
    incomingSelector: INCOMING_PAGE,
    allCardSelector: ALL_CARD,
    gpuCanvasSelector: GPU_MEDIA_CANVAS,
    nativeSurfaceSelector: NATIVE_GPU_SURFACE,
    turnPrioritySelector: TURN_PRIORITY_IMAGE,
  });
}

async function readTurnProbe(page) {
  return page.evaluate(() => {
    const probe = window.__frontierTurnProbe;
    if (!probe) return { events: [], frameGaps: [], layoutShifts: [] };
    probe.observer?.disconnect?.();
    probe.layoutObserver?.disconnect?.();
    if (probe.rafId) cancelAnimationFrame(probe.rafId);
    return {
      events: Array.isArray(probe.events) ? probe.events.slice() : [],
      frameGaps: Array.isArray(probe.frameGaps) ? probe.frameGaps.slice() : [],
      layoutShifts: Array.isArray(probe.layoutShifts) ? probe.layoutShifts.slice() : [],
    };
  });
}

async function turnForward(page, beforeIds, maxCards) {
  await armTurnProbe(page);
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
  }, { deckSelector: DECK, currentCardSelector: CURRENT_CARD, prior: beforeIds, max: maxCards }, { polling: 'raf', timeout: MAX_TURN_SETTLE_MS });

  const totalMs = Date.now() - started;
  const probe = await readTurnProbe(page);
  const events = probe.events;
  const prepareEvent = events.find((event) => event.phase === 'prepare');
  const turnEvent = events.find((event) => event.phase === 'turn');
  const settledEvent = [...events].reverse().find((event) => event.phase === 'idle');

  assert(prepareEvent, 'page turn never exposed its prepare phase');
  assert(turnEvent, 'page turn never entered the compositor turn phase');
  assert(settledEvent, 'page turn never returned to idle');
  assert(prepareEvent.incomingPresent, 'incoming sheet was not mounted during prepare');
  assert.equal(prepareEvent.incomingVisibility, 'hidden', 'incoming sheet must be pre-laid-out but visually hidden during prepare');
  assert(turnEvent.incomingPresent, 'incoming sheet disappeared before compositor turn');
  assert(prepareEvent.atMs <= MAX_PREPARE_MS, `prepare phase began too late: ${prepareEvent.atMs.toFixed(1)}ms`);
  assert(turnEvent.atMs <= MAX_PREPARE_MS, `media readiness gate exceeded bounded prepare window: ${turnEvent.atMs.toFixed(1)}ms`);
  assert(turnEvent.domCardCount <= maxCards * 2, `turn mounted ${turnEvent.domCardCount} cards; two-sheet budget=${maxCards * 2}`);
  assert(totalMs <= MAX_TURN_SETTLE_MS, `page turn took ${totalMs}ms to settle`);

  for (const event of [prepareEvent, turnEvent]) {
    if (event.gpuCanvasPresent) {
      assert.equal(event.gpuCanvasVisibility, 'hidden', `fixed GPU media plane remained visible during ${event.phase}`);
      assert.equal(event.gpuCanvasOpacity, '0', `fixed GPU media plane retained opacity during ${event.phase}`);
    }
    if (event.incomingNativeCount > 0) {
      assert.equal(
        event.incomingTurnPriorityCount,
        event.incomingNativeCount,
        `incoming native turn media was not fully promoted during ${event.phase}`,
      );
    }
  }

  if (settledEvent.gpuCanvasPresent) {
    assert.notEqual(settledEvent.gpuCanvasVisibility, 'hidden', 'fixed GPU media plane did not resume after turn settle');
    assert.notEqual(settledEvent.gpuCanvasOpacity, '0', 'fixed GPU media plane remained transparent after turn settle');
  }

  const frameGaps = probe.frameGaps.filter((gap) => Number.isFinite(gap) && gap >= 0);
  const maxFrameGapMs = frameGaps.length ? Math.max(...frameGaps) : 0;
  const over32ms = frameGaps.filter((gap) => gap > 32).length;
  const over50ms = frameGaps.filter((gap) => gap > 50).length;
  const rawLayoutShift = probe.layoutShifts.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

  return {
    totalMs,
    prepareMs: prepareEvent.atMs,
    compositorStartMs: turnEvent.atMs,
    compositorSettleMs: settledEvent.atMs,
    incomingNativeAtPrepare: {
      total: prepareEvent.incomingNativeCount,
      ready: prepareEvent.incomingNativeReadyCount,
      highPriority: prepareEvent.incomingTurnPriorityCount,
    },
    incomingNativeAtTurn: {
      total: turnEvent.incomingNativeCount,
      ready: turnEvent.incomingNativeReadyCount,
      highPriority: turnEvent.incomingTurnPriorityCount,
    },
    gpuHandoff: {
      prepare: {
        present: prepareEvent.gpuCanvasPresent,
        visibility: prepareEvent.gpuCanvasVisibility,
        opacity: prepareEvent.gpuCanvasOpacity,
      },
      turn: {
        present: turnEvent.gpuCanvasPresent,
        visibility: turnEvent.gpuCanvasVisibility,
        opacity: turnEvent.gpuCanvasOpacity,
      },
      settled: {
        present: settledEvent.gpuCanvasPresent,
        visibility: settledEvent.gpuCanvasVisibility,
        opacity: settledEvent.gpuCanvasOpacity,
      },
    },
    frameTelemetry: {
      samples: frameGaps.length,
      maxFrameGapMs,
      over32ms,
      over50ms,
    },
    rawLayoutShift,
    layoutShifts: probe.layoutShifts,
    events,
  };
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
    assert.equal(first.turn, 'idle', `${label} first useful paint was not settled`);
    assert.equal(first.cache, 'memory+decoded-media', `${label} predictive page cache contract missing`);
    assert.equal(first.prefetch, 'next-prev-plus-one', `${label} predictive prefetch depth contract missing`);
    assert.equal(first.readinessGate, 'decode-or-96ms', `${label} readiness gate contract missing`);
    assert(usefulPaintMs <= MAX_USEFUL_PAINT_MS, `${label} useful paint exceeded ${MAX_USEFUL_PAINT_MS}ms: ${usefulPaintMs}ms`);
    assert.deepEqual(apiRequests, [], `${label} cold load unexpectedly called live feed APIs: ${apiRequests.join(' | ')}`);

    await page.waitForTimeout(PASSIVE_QUIET_MS);
    const quiet = await state(page);
    assert.deepEqual(apiRequests, [], `${label} passive runtime activated live discovery: ${apiRequests.join(' | ')}`);
    assert.equal(quiet.ambientCanvases, 0, `${label} ambient canvas should be absent on the performance route`);
    assert(!quiet.workers.some((url) => /liveDaemonWorker|semantic|rerank/i.test(url)), `${label} started a heavy feed worker: ${quiet.workers.join(' | ')}`);

    let turnMetrics = null;
    if (first.pageCount > 1) {
      turnMetrics = await turnForward(page, first.currentIds, maxCards);
      const after = await state(page);
      assert(after.currentCount <= maxCards, `${label} settled page turn exceeded current-card budget`);
      assert(after.domCardCount <= maxCards, `${label} incoming sheet was not released after turn settle`);
      assert.equal(after.totalItems, first.totalItems, `${label} page turn changed retained edition size`);
      assert.deepEqual(apiRequests, [], `${label} page turn triggered live data fetch: ${apiRequests.join(' | ')}`);
    }

    assert.deepEqual(pageErrors, [], `${label} emitted page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `${label} emitted console errors: ${consoleErrors.join(' | ')}`);
    return { usefulPaintMs, turnMetrics, first, quiet };
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
    await waitForSettledDeck(page, 10);
    await page.route('**/api/frontier/feed**', async (route) => {
      const url = new URL(route.request().url());
      refreshRequests.push(url.toString());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          items: Array.from({ length: 18 }, (_, index) => refreshItem(index + 1)),
          sources: [{ id: 'local', label: 'FRONTIER v22 refresh', ok: true, count: 18 }],
        }),
      });
    });
    await page.getByRole('button', { name: 'Full live refresh' }).click();
    await page.waitForFunction(({ deckSelector, currentCardSelector }) => {
      const deck = document.querySelector(deckSelector);
      return deck?.getAttribute('data-frontier-turning') === 'idle'
        && Array.from(document.querySelectorAll(currentCardSelector))
          .some((node) => (node.getAttribute('data-frontier-fluid-card') || '').startsWith('frontier-v22-refresh-'));
    }, { deckSelector: DECK, currentCardSelector: CURRENT_CARD }, { timeout: 4_000, polling: 'raf' });
    const refreshed = await state(page);
    assert.equal(refreshRequests.length, 1, `explicit refresh should issue one feed request, saw ${refreshRequests.length}`);
    const refreshUrl = new URL(refreshRequests[0]);
    assert.equal(refreshUrl.searchParams.get('fresh'), '1', 'explicit refresh must request fresh=1');
    assert(refreshUrl.searchParams.get('request'), 'explicit refresh must include cache-busting request identity');
    assert.equal(refreshed.totalItems, 18, 'explicit refresh should replace rather than append the edition');
    assert(refreshed.currentCount <= 10, `explicit refresh broke desktop page budget: ${refreshed.currentCount}`);
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
      desktop: await auditViewport(browser, { width: 1440, height: 1000 }, 10, 'desktop'),
      mobile: await auditViewport(browser, { width: 390, height: 844 }, 8, 'mobile'),
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
