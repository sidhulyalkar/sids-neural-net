const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.FRONTIER_LONGITUDINAL_AUDIT_URL || 'http://127.0.0.1:3000/frontier';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function setRange(locator, value) {
  await locator.evaluate((element, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (!descriptor?.set) throw new Error('Native input value setter is unavailable');
    descriptor.set.call(element, String(nextValue));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.__frontierCameraCalls = 0;
    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices && typeof mediaDevices.getUserMedia === 'function') {
      const original = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (...args) => {
        window.__frontierCameraCalls += 1;
        return original(...args);
      };
    }
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  invariant(response && response.ok(), `FRONTIER route returned ${response?.status() ?? 'no response'}`);
  await page.locator('select[aria-label="View"]').selectOption('map');
  await page.getByRole('heading', { name: 'How your responses change' }).waitFor();

  const section = page.getByRole('region', { name: 'Longitudinal personal observation' });
  await section.waitFor();
  const text = await section.innerText();
  invariant(text.includes('local only'), 'Longitudinal Cortex must identify its local-only privacy boundary');
  invariant(text.includes('self-report, not facial inference'), 'State labels must be explicitly described as self-report');
  invariant(text.includes('Qualified camera exposure'), 'Qualified exposure denominator is missing from the UI');
  invariant(text.includes('120d high-resolution retention'), 'Retention contract is missing from the UI');

  const sliders = section.locator('input[type="range"]');
  invariant(await sliders.count() === 3, 'Expected mood, energy, and focus self-report controls');
  await setRange(sliders.nth(0), 4);
  await setRange(sliders.nth(1), 5);
  await setRange(sliders.nth(2), 2);
  await section.getByRole('button', { name: 'Save check-in' }).click();
  await section.getByText('Self-report saved locally.', { exact: false }).waitFor();

  const storedCheckins = await page.evaluate(async () => {
    const request = indexedDB.open('frontier-longitudinal-v1');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction('checkins', 'readonly');
      const result = await new Promise((resolve, reject) => {
        const getAll = transaction.objectStore('checkins').getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => reject(getAll.error);
      });
      return result;
    } finally {
      db.close();
    }
  });
  invariant(storedCheckins.length === 1, `Expected one persisted self-report check-in, found ${storedCheckins.length}`);
  invariant(storedCheckins[0].mood === 4 && storedCheckins[0].energy === 5 && storedCheckins[0].focus === 2,
    'IndexedDB check-in values did not match the explicit user labels');

  const cameraCalls = await page.evaluate(() => window.__frontierCameraCalls || 0);
  invariant(cameraCalls === 0, `Radar/self-report flow unexpectedly requested camera access ${cameraCalls} time(s)`);

  const schema = await page.evaluate(async () => {
    const request = indexedDB.open('frontier-longitudinal-v1');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return Array.from(db.objectStoreNames);
    } finally {
      db.close();
    }
  });
  for (const expected of ['exposures', 'reactions', 'interactions', 'checkins', 'rollups']) {
    invariant(schema.includes(expected), `Longitudinal IndexedDB is missing ${expected} object store`);
  }

  fs.mkdirSync(path.join('artifacts', 'browser-smoke'), { recursive: true });
  await page.screenshot({
    path: path.join('artifacts', 'browser-smoke', 'frontier-longitudinal-cortex.png'),
    fullPage: true,
  });

  invariant(pageErrors.length === 0, `Longitudinal Cortex emitted page errors:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log(JSON.stringify({
    ok: true,
    checkins: storedCheckins.length,
    cameraCalls,
    stores: schema,
    pageErrors,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
