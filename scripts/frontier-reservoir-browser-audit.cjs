const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.FRONTIER_RESERVOIR_AUDIT_URL || 'http://127.0.0.1:3000';
const FRONTIER_URL = `${BASE_URL.replace(/\/$/, '')}/frontier`;
const CARD = '[data-frontier-fluid-card]';
const STABLE_PREFIX = 14;
const APPEND_CARDS = 16;
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const DAY_MS = 86_400_000;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function snapshotItem(index) {
  return {
    id: `reservoir-snapshot-${index}`,
    title: `Stable snapshot ${index}`,
    summary: 'Deterministic opening content for reservoir browser qualification.',
    url: `https://snapshot-${index}.example.invalid/item`,
    source: `snapshot-${index}.example.invalid`,
    sourceLabel: `Snapshot ${index}`,
    sourceKind: 'local',
    publishedAt: '2026-08-26T12:00:00.000Z',
    lane: ['creative_tech', 'ai_frontier', 'methods', 'builder_signal', 'broad_science', 'neuro_frontier'][index % 6],
    tags: ['reservoir-audit', `snapshot-${index}`],
    baseScore: 0.88 - (index % 20) * 0.004,
    importance: index === 1 ? 0.92 : 0.68,
    novelty: 0.7,
    quality: 0.96,
    momentum: 0.45,
  };
}

function reservoirItem(index, now) {
  const variants = [
    { sourceKind: 'huggingface', source: 'huggingface.co', sourceLabel: 'Hugging Face Papers', lane: 'ai_frontier', url: `https://huggingface.co/papers/reservoir-${index}`, tags: ['multimodal learning', 'world models'] },
    { sourceKind: 'github', source: 'github.com', sourceLabel: 'GitHub', lane: 'builder_signal', url: `https://github.com/example/reservoir-${index}`, tags: ['open source', 'scientific software'] },
    { sourceKind: 'arxiv', source: 'arxiv.org', sourceLabel: 'arXiv', lane: 'neuro_frontier', url: `https://arxiv.org/abs/2608.${String(index).padStart(5, '0')}`, tags: ['neuroai', 'representation learning'] },
    { sourceKind: 'huggingface', source: 'huggingface.co', sourceLabel: 'Hugging Face Papers', lane: 'methods', url: `https://huggingface.co/papers/method-${index}`, tags: ['mechanistic interpretability', 'causal probing'] },
    { sourceKind: 'github', source: 'github.com', sourceLabel: 'GitHub', lane: 'creative_tech', url: `https://github.com/example/webgpu-${index}`, tags: ['webgpu', 'game design'] },
    { sourceKind: 'arxiv', source: 'arxiv.org', sourceLabel: 'arXiv', lane: 'broad_science', url: `https://arxiv.org/abs/2608.${String(index + 30000).padStart(5, '0')}`, tags: ['computational imaging', 'astronomy'] },
    { sourceKind: 'github', source: 'github.com', sourceLabel: 'GitHub', lane: 'gaming', url: `https://github.com/example/game-${index}`, tags: ['gaming', 'game design'] },
    { sourceKind: 'github', source: 'github.com', sourceLabel: 'GitHub', lane: 'sports', url: `https://github.com/example/sports-${index}`, tags: ['sports analytics', 'player tracking'] },
  ];
  const variant = variants[index % variants.length];
  return {
    id: `reservoir-ci-${index}`,
    title: `Validated reservoir candidate ${index}`,
    summary: 'High-quality durable content retained for stable daily FRONTIER sampling.',
    ...variant,
    publishedAt: new Date(now - (index % 10) * 60 * 60_000).toISOString(),
    baseScore: 0.76 + (index % 7) * 0.012,
    importance: 0.68 + (index % 5) * 0.025,
    novelty: 0.66 + (index % 6) * 0.035,
    quality: 0.9 + (index % 4) * 0.02,
    momentum: 0.58 + (index % 4) * 0.035,
  };
}

function game2World(now) {
  return {
    id: 'reservoir-ci-game2world',
    title: 'Game2World Engine: Unlocking In-the-Wild Gameplay Videos for World Model Training',
    summary: 'Gameplay UI removal and paired video data for world-model training.',
    url: 'https://huggingface.co/papers/2608.24680',
    source: 'huggingface.co',
    sourceLabel: 'Hugging Face Papers',
    sourceKind: 'huggingface',
    publishedAt: new Date(now - DAY_MS).toISOString(),
    lane: 'ai_frontier',
    tags: ['video world models', 'gameplay video', 'multimodal learning', 'game design'],
    baseScore: 0.93,
    importance: 0.86,
    novelty: 0.9,
    quality: 0.99,
    momentum: 0.78,
  };
}

function staleSportsState(now) {
  return {
    id: 'reservoir-ci-stale-sports-state',
    title: 'Yesterday live score',
    summary: 'Intentionally stale sports-state fixture.',
    url: 'https://www.nfl.com/games/stale-audit',
    source: 'nfl.com',
    sourceLabel: 'NFL',
    sourceKind: 'sports_state',
    publishedAt: new Date(now - 30 * 60 * 60_000).toISOString(),
    lane: 'sports',
    tags: ['sports state'],
    baseScore: 0.95,
    importance: 0.9,
    novelty: 0.8,
    quality: 0.99,
    momentum: 0.9,
  };
}

function record(item, discoveredAt, validationScore = 0.92) {
  return {
    key: item.url.toLowerCase(),
    item,
    discoveredAt,
    validationScore,
    lastOfferedAt: 0,
    offerCount: 0,
  };
}

async function seedReservoir(page, records) {
  await page.evaluate(async (seedRecords) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('frontier-live-candidates-v1', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains('candidate_pool')
          ? request.transaction.objectStore('candidate_pool')
          : db.createObjectStore('candidate_pool', { keyPath: 'key' });
        if (!store.indexNames.contains('discoveredAt')) store.createIndex('discoveredAt', 'discoveredAt');
        if (!store.indexNames.contains('validationScore')) store.createIndex('validationScore', 'validationScore');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('candidate_pool', 'readwrite');
        const store = tx.objectStore('candidate_pool');
        store.clear();
        for (const candidate of seedRecords) store.put(candidate);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      };
    });
  }, records);
}

async function readReservoirIds(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open('frontier-live-candidates-v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('candidate_pool', 'readonly');
      const getAll = tx.objectStore('candidate_pool').getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => resolve(getAll.result.map((candidate) => candidate.item?.id).filter(Boolean));
      tx.oncomplete = () => db.close();
    };
  }));
}

async function captureBoundaryState(page) {
  return page.evaluate(({ selector }) => {
    const ids = Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    const snapshotIds = ids.filter((id) => id.startsWith('reservoir-snapshot-'));
    const reservoirIds = ids.filter((id) => id.startsWith('reservoir-ci-'));
    const firstReservoirIndex = ids.findIndex((id) => id.startsWith('reservoir-ci-'));
    const trace = window.__frontierReservoirTrace || { workers: [], posts: [], messages: [], errors: [] };
    return {
      count: ids.length,
      allIds: ids,
      snapshotCount: snapshotIds.length,
      snapshotIds,
      reservoirCount: reservoirIds.length,
      reservoirIds,
      firstReservoirIndex,
      documentHeight: (document.scrollingElement || document.documentElement).scrollHeight,
      trace,
      streamPulseText: Array.from(document.querySelectorAll('button, [role="button"]'))
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((value) => /new|signal|stream|reveal/i.test(value))
        .slice(0, 12),
    };
  }, { selector: CARD });
}

async function runFixture(browser, now, label) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const trace = { workers: [], posts: [], messages: [], errors: [] };
    Object.defineProperty(window, '__frontierReservoirTrace', { value: trace, configurable: false, writable: false });
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        const worker = Reflect.construct(target, args, newTarget);
        const workerIndex = trace.workers.push({ url: String(args[0] || '') }) - 1;
        const nativePostMessage = worker.postMessage.bind(worker);
        worker.postMessage = (message, ...rest) => {
          trace.posts.push({
            workerIndex,
            type: message?.type || typeof message,
            excludeCount: Array.isArray(message?.config?.excludeSignatures) ? message.config.excludeSignatures.length : undefined,
            reason: message?.reason,
          });
          return nativePostMessage(message, ...rest);
        };
        worker.addEventListener('message', (event) => {
          const data = event.data;
          trace.messages.push({
            workerIndex,
            type: data?.type || typeof data,
            itemCount: Array.isArray(data?.items) ? data.items.length : undefined,
            itemIds: Array.isArray(data?.items) ? data.items.slice(0, 20).map((item) => item?.id).filter(Boolean) : undefined,
            status: data?.status ? {
              leader: data.status.leader,
              polling: data.status.polling,
              consecutiveFailures: data.status.consecutiveFailures,
              consecutiveEmpty: data.status.consecutiveEmpty,
              mode: data.status.mode,
            } : undefined,
            message: data?.message,
          });
        });
        worker.addEventListener('error', (event) => {
          trace.errors.push({ workerIndex, message: event.message || 'worker error' });
        });
        return worker;
      },
    });
  });

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  let snapshotSettled = false;
  let freshBeforeSnapshot = false;
  let freshRequests = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });

  const snapshotPayload = {
    generatedAt: new Date(now).toISOString(),
    items: Array.from({ length: 64 }, (_, index) => snapshotItem(index + 1)),
    sources: [{ id: 'snapshot', label: 'Reservoir audit snapshot', ok: true, count: 64 }],
  };

  await page.route('**/api/frontier/feed**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('fresh') === '1') {
      freshRequests += 1;
      if (!snapshotSettled) freshBeforeSnapshot = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ generatedAt: new Date(now + 60_000).toISOString(), items: [], sources: [] }) });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 220));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshotPayload) });
    snapshotSettled = true;
  });
  await page.route('**/api/frontier/forage**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ generatedAt: new Date(now).toISOString(), items: [], sources: [] }) });
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const durable = [game2World(now), ...Array.from({ length: 159 }, (_, index) => reservoirItem(index + 1, now))];
  const stale = staleSportsState(now);
  await seedReservoir(page, [
    ...durable.map((entry, index) => record(entry, now - (index % 10) * 60 * 60_000, entry.id === 'reservoir-ci-game2world' ? 0.99 : 0.9)),
    record(stale, now - 30 * 60 * 60_000, 0.99),
  ]);

  await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(({ selector, stablePrefix }) => {
    const ids = Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
    return ids.length >= stablePrefix && ids.slice(0, stablePrefix).every((id) => id.startsWith('reservoir-snapshot-'));
  }, { selector: CARD, stablePrefix: STABLE_PREFIX }, { timeout: 9000, polling: 'raf' });
  const prefix = await page.evaluate(({ selector, take }) => Array.from(document.querySelectorAll(selector)).slice(0, take).map((node) => node.getAttribute('data-frontier-fluid-card')), { selector: CARD, take: STABLE_PREFIX });

  try {
    await page.waitForFunction(({ selector, expected }) => {
      const ids = Array.from(document.querySelectorAll(selector)).map((node) => node.getAttribute('data-frontier-fluid-card') || '');
      return ids.filter((id) => id.startsWith('reservoir-ci-') && id !== 'reservoir-ci-stale-sports-state').length >= expected;
    }, { selector: CARD, expected: APPEND_CARDS }, { timeout: 12000, polling: 'raf' });
  } catch (error) {
    const boundary = await captureBoundaryState(page);
    const retainedIds = await readReservoirIds(page);
    const diagnostic = {
      passed: false,
      label,
      phase: 'append-boundary',
      expectedReservoirCards: APPEND_CARDS,
      boundary,
      retainedCount: retainedIds.length,
      retainedSample: retainedIds.slice(0, 30),
      game2WorldRetained: retainedIds.includes('reservoir-ci-game2world'),
      staleSportsRetained: retainedIds.includes('reservoir-ci-stale-sports-state'),
      freshRequests,
      freshBeforeSnapshot,
      pageErrors,
      consoleErrors,
      error: error instanceof Error ? error.stack || error.message : String(error),
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, `frontier-reservoir-${label}-diagnostic.json`), JSON.stringify(diagnostic, null, 2));
    throw new Error(`${label}: reservoir append boundary timed out; visible=${boundary.reservoirCount}, worker messages=${boundary.trace.messages.length}, last=${JSON.stringify(boundary.trace.messages.slice(-4))}`);
  }

  const state = await captureBoundaryState(page);
  const retainedIds = await readReservoirIds(page);
  const finalPrefix = state.allIds.slice(0, STABLE_PREFIX);

  assert.deepEqual(finalPrefix, prefix, `${label}: reservoir replay moved the canonical opening prefix`);
  assert.equal(freshBeforeSnapshot, false, `${label}: background discovery raced snapshot first paint`);
  assert(state.snapshotCount >= STABLE_PREFIX, `${label}: snapshot did not establish a stable canonical prefix`);
  assert(state.reservoirCount >= APPEND_CARDS, `${label}: reservoir did not append ${APPEND_CARDS} candidates`);
  assert(state.reservoirIds.slice(0, APPEND_CARDS).every((id) => id.startsWith('reservoir-ci-')), `${label}: append was not sourced from the seeded durable reservoir`);
  assert(state.firstReservoirIndex >= STABLE_PREFIX, `${label}: durable replay entered ahead of the canonical snapshot prefix`);
  assert(!state.allIds.slice(state.firstReservoirIndex).some((id) => id.startsWith('reservoir-snapshot-')), `${label}: reservoir replay interleaved into the established snapshot instead of appending`);
  assert(!state.allIds.includes('reservoir-ci-stale-sports-state'), `${label}: stale sports state escaped into the visible river`);
  assert(retainedIds.includes('reservoir-ci-game2world'), `${label}: Game2World exemplar was removed from the durable shelf`);
  assert(!retainedIds.includes('reservoir-ci-stale-sports-state'), `${label}: stale sports state was not pruned from the durable shelf`);
  assert.deepEqual(pageErrors, [], `${label}: page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `${label}: console errors: ${consoleErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, `frontier-reservoir-${label}.png`), fullPage: false, animations: 'disabled' });
  const result = {
    label,
    cardCount: state.count,
    snapshotCount: state.snapshotCount,
    appended: state.reservoirIds.slice(0, APPEND_CARDS),
    stablePrefix: prefix,
    freshRequests,
    freshBeforeSnapshot,
    documentHeight: state.documentHeight,
    retainedCount: retainedIds.length,
    game2WorldRetained: retainedIds.includes('reservoir-ci-game2world'),
    game2WorldVisibleToday: state.allIds.includes('reservoir-ci-game2world'),
    staleSportsRetained: retainedIds.includes('reservoir-ci-stale-sports-state'),
    staleSportsVisible: state.allIds.includes('reservoir-ci-stale-sports-state'),
    workerTrace: state.trace,
    pageErrors,
    consoleErrors,
  };
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const now = Date.now();
  try {
    const first = await runFixture(browser, now, 'first');
    const second = await runFixture(browser, now, 'same-day-reload');
    assert.deepEqual(second.appended, first.appended, 'same-day seeded reservoir changed its replay order across reloads');
    const report = { passed: true, seededReservoirSize: 161, capacity: 2048, first, second };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'frontier-reservoir-browser-audit.json'), JSON.stringify(report, null, 2));
    console.log(`FRONTIER reservoir browser audit PASS: ${first.appended.length} stable daily candidates appended after ${first.snapshotCount} quality-qualified snapshot cards, Game2World retained, stale sports pruned.`);
  } catch (error) {
    const report = { passed: false, error: error instanceof Error ? error.stack || error.message : String(error) };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'frontier-reservoir-browser-audit.json'), JSON.stringify(report, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});