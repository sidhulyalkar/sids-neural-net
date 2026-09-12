const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.FRONTIER_RESERVOIR_AUDIT_URL || 'http://127.0.0.1:3000';
const FRONTIER_URL = `${BASE_URL.replace(/\/$/, '')}/frontier`;
const DECK = '[data-frontier-section-deck="true"]';
const CARD = '[data-frontier-fluid-card]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function candidate() {
  return {
    id: 'reservoir-v21-durable-candidate',
    title: 'Durable reservoir candidate remains dormant until explicit discovery work',
    summary: 'The v21 newspaper keeps candidate-pool persistence without granting it passive page-growth authority.',
    url: 'https://github.com/example/frontier-v21-reservoir',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-09-02T16:00:00.000Z',
    lane: 'builder_signal',
    tags: ['frontier v21', 'reservoir'],
    baseScore: 0.86,
    importance: 0.76,
    novelty: 0.8,
    quality: 0.98,
    momentum: 0.58,
  };
}

async function seedReservoir(page) {
  const item = candidate();
  await page.evaluate(async (entry) => new Promise((resolve, reject) => {
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
      tx.objectStore('candidate_pool').put({
        key: entry.url.toLowerCase(),
        item: entry,
        discoveredAt: Date.now(),
        validationScore: 0.97,
        lastOfferedAt: 0,
        offerCount: 0,
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), item);
}

async function reservoirIds(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open('frontier-live-candidates-v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('candidate_pool', 'readonly');
      const getAll = tx.objectStore('candidate_pool').getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => resolve(getAll.result.map((row) => row.item?.id).filter(Boolean));
      tx.oncomplete = () => db.close();
    };
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let report;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    await context.addInitScript(() => {
      const workers = [];
      Object.defineProperty(window, '__frontierReservoirWorkers', { value: workers, configurable: false });
      const NativeWorker = window.Worker;
      window.Worker = new Proxy(NativeWorker, {
        construct(target, args, newTarget) {
          workers.push(String(args[0] || ''));
          return Reflect.construct(target, args, newTarget);
        },
      });
    });

    const page = await context.newPage();
    const requests = [];
    const pageErrors = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/frontier/feed') || url.includes('/api/frontier/forage')) requests.push(url);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await seedReservoir(page);
    const seeded = await reservoirIds(page);
    assert(seeded.includes('reservoir-v21-durable-candidate'), 'failed to seed durable reservoir fixture');

    const response = await page.goto(FRONTIER_URL, { waitUntil: 'domcontentloaded' });
    assert(response && response.ok(), `FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await page.waitForFunction(({ deck, card }) => {
      const root = document.querySelector(deck);
      const count = document.querySelectorAll(card).length;
      return Boolean(root) && count > 0 && count <= 10;
    }, { deck: DECK, card: CARD }, { timeout: 9000, polling: 'raf' });

    const initial = await page.evaluate(({ deck, card }) => {
      const root = document.querySelector(deck);
      return {
        mounted: document.querySelectorAll(card).length,
        total: Number(root?.getAttribute('data-frontier-total-items') || 0),
        pages: Number(root?.getAttribute('data-frontier-page-count') || 0),
        workers: window.__frontierReservoirWorkers.slice(),
      };
    }, { deck: DECK, card: CARD });

    await page.waitForTimeout(2800);
    if (initial.pages > 1) {
      await page.getByRole('button', { name: 'Next section' }).click();
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(900);

    const after = await page.evaluate(({ deck, card }) => {
      const root = document.querySelector(deck);
      return {
        mounted: document.querySelectorAll(card).length,
        total: Number(root?.getAttribute('data-frontier-total-items') || 0),
        pages: Number(root?.getAttribute('data-frontier-page-count') || 0),
        workers: window.__frontierReservoirWorkers.slice(),
      };
    }, { deck: DECK, card: CARD });
    const retained = await reservoirIds(page);

    assert(initial.mounted <= 10 && after.mounted <= 10, `newspaper mount budget exceeded: initial=${initial.mounted}, after=${after.mounted}`);
    assert.equal(after.total, initial.total, 'page turns/scrolling may not grow the passive edition');
    assert.deepEqual(requests, [], `passive v21 newspaper unexpectedly activated discovery APIs: ${requests.join(' | ')}`);
    assert(!after.workers.some((url) => /liveDaemonWorker/i.test(url)), `passive v21 newspaper started live daemon worker: ${after.workers.join(' | ')}`);
    assert(retained.includes('reservoir-v21-durable-candidate'), 'passive navigation must not consume durable reservoir candidates');
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);

    report = {
      passed: true,
      initial,
      after,
      requests,
      retained,
      invariant: 'reservoir persists but has zero passive append authority in v21 newspaper mode',
    };
    await context.close();
  } catch (error) {
    report = { passed: false, error: error instanceof Error ? error.stack || error.message : String(error) };
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'frontier-reservoir-browser-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
})();
