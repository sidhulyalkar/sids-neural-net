const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const url = process.env.FRONTIER_LONGITUDINAL_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const DEFAULT_TIMEOUT_MS = 12_000;

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

async function run() {
  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
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
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    let feedRequests = 0;
    await page.route('**/api/frontier/feed**', async (route) => {
      feedRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: '2026-08-31T12:00:00.000Z',
          items: [],
          sources: [{ id: 'rss', label: 'Longitudinal CI', ok: true, count: 0 }],
        }),
      });
    });
    await page.route('**/api/frontier/forage**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ generatedAt: '2026-08-31T12:00:00.000Z', items: [], sources: [] }),
      });
    });

    const hydrationRequest = page.waitForRequest((request) => request.url().includes('/api/frontier/feed'));
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    invariant(response && response.ok(), `FRONTIER route returned ${response?.status() ?? 'no response'}`);
    await hydrationRequest;
    invariant(feedRequests >= 1, 'FRONTIER client hydration never issued its feed request');

    const viewSelect = page.locator('select[aria-label="View"]');
    await viewSelect.waitFor();
    await viewSelect.selectOption('map');
    await page.getByRole('heading', { name: 'How your responses change' }).waitFor();

    const section = page.getByRole('region', { name: 'Longitudinal personal observation' });
    const text = ((await section.textContent()) ?? '').replace(/\s+/g, ' ').toLowerCase();
    invariant(text.includes('local only'), 'Longitudinal Cortex must identify its local-only privacy boundary');
    invariant(text.includes('self-report, not facial inference'), 'State labels must be explicitly described as self-report');
    invariant(text.includes('face-observable exposure'), 'v2 face-observable denominator semantics are missing from the UI');
    invariant(text.includes('detected-cue precision'), 'Detected-cue validation semantics are missing from the UI');
    invariant(text.includes('120d high-resolution retention'), 'Retention contract is missing from the UI');
    invariant(text.includes('face-observable empirical-bayes rate') && text.includes('95% credible interval'),
      'Bayesian v2 uncertainty semantics are missing from the UI');
    invariant(text.includes('descriptive, not causal'), 'Longitudinal rates must be framed as descriptive rather than causal');
    invariant(text.includes('target-attributed wall time') && text.includes('bounded local vision-callback time'),
      'The v2 measurement footnote must distinguish wall time from callback-observed time');

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
        return await new Promise((resolve, reject) => {
          const getAll = transaction.objectStore('checkins').getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => reject(getAll.error);
        });
      } finally {
        db.close();
      }
    });
    invariant(storedCheckins.length === 1, `Expected one persisted self-report check-in, found ${storedCheckins.length}`);
    invariant(storedCheckins[0].mood === 4 && storedCheckins[0].energy === 5 && storedCheckins[0].focus === 2,
      'IndexedDB check-in values did not match explicit user labels');

    await viewSelect.selectOption('today');
    const qcTrigger = page.getByRole('button', { name: 'Open Sensor QC' });
    await qcTrigger.waitFor();
    await qcTrigger.click();
    const qc = page.getByRole('complementary', { name: 'FRONTIER Sensor QC' });
    await qc.waitFor();
    const qcText = ((await qc.textContent()) ?? '').replace(/\s+/g, ' ').toLowerCase();
    invariant(qcText.includes('you declare the condition'), 'QC must make trial truth explicitly user-declared');
    invariant(qcText.includes('zero recommendation authority'), 'QC must state its non-authoritative boundary');
    invariant(qcText.includes('starting qc never requests camera permission'), 'QC must state that it never auto-starts camera access');
    invariant(qcText.includes('no content ids') && qcText.includes('no content ids') || qcText.includes('no content ids,'),
      'QC export must declare that content identifiers are excluded');

    await qc.getByRole('button', { name: 'Start QC' }).click();
    await qc.getByRole('button', { name: 'Begin trial' }).click();
    await page.waitForTimeout(450);
    await qc.getByRole('button', { name: 'End trial' }).click();
    await qc.getByText('Trial saved locally.', { exact: false }).waitFor();
    await qc.getByRole('button', { name: 'Stop session' }).click();
    await qc.getByText('QC session saved locally.', { exact: false }).waitFor();

    const qcArchive = await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-sensor-qc-v1') || 'null'));
    invariant(qcArchive?.schema === 'frontier-sensor-qc-v1', 'QC local archive schema is missing');
    invariant(qcArchive.sessions?.length === 1, `Expected one QC session, found ${qcArchive.sessions?.length ?? 0}`);
    invariant(qcArchive.sessions[0].trials?.length === 1, 'Expected one completed QC trial');
    const qcTrial = qcArchive.sessions[0].trials[0];
    invariant(qcTrial.label === 'neutral_reading', `Unexpected QC trial label ${qcTrial.label}`);
    invariant(qcTrial.durationMs >= 250, `QC foreground duration was unexpectedly short: ${qcTrial.durationMs}ms`);
    invariant(qcTrial.sensorSampledMs === 0, 'Camera-off QC trial must not invent callback-observed time');

    const qcDownloadPromise = page.waitForEvent('download', { timeout: DEFAULT_TIMEOUT_MS });
    await qc.getByRole('button', { name: 'Export aggregate JSON' }).click();
    const qcDownload = await qcDownloadPromise;
    const qcPath = await qcDownload.path();
    invariant(qcPath, 'Sensor QC export did not produce a local file');
    const qcReport = JSON.parse(fs.readFileSync(qcPath, 'utf8'));
    invariant(qcReport.schema === 'frontier-sensor-qc-v1', 'Sensor QC export schema mismatch');
    invariant(qcReport.privacy?.aggregateOnly === true, 'Sensor QC export is not marked aggregate-only');
    invariant(qcReport.privacy?.contentIdentifiersIncluded === false, 'Sensor QC export must exclude content identifiers');
    invariant(qcReport.privacy?.rawCameraDataIncluded === false, 'Sensor QC export must exclude raw camera data');
    const serializedQc = JSON.stringify(qcReport).toLowerCase();
    for (const forbidden of ['itemid', 'cardid', 'contentid', '"title":', '"url":', 'landmark', 'blendshape', 'embedding', 'biometrictemplate']) {
      invariant(!serializedQc.includes(forbidden), `Sensor QC export leaked forbidden field ${forbidden}`);
    }

    const cameraCalls = await page.evaluate(() => window.__frontierCameraCalls || 0);
    invariant(cameraCalls === 0, `Self-report/QC flow unexpectedly requested camera access ${cameraCalls} time(s)`);

    await viewSelect.selectOption('map');
    const dataMenu = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Data$/ }) });
    await dataMenu.locator('summary').click();
    const archiveDownloadPromise = page.waitForEvent('download', { timeout: DEFAULT_TIMEOUT_MS });
    await dataMenu.getByRole('button', { name: 'Export', exact: true }).click();
    const archiveDownload = await archiveDownloadPromise;
    const archivePath = await archiveDownload.path();
    invariant(archivePath, 'FRONTIER private archive download did not produce a local file');
    const exportedArchive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    invariant(exportedArchive.schema === 'frontier-local-archive-v1', 'Data → Export did not use the complete private archive schema');
    invariant(exportedArchive.longitudinal?.checkins?.length === 1, 'Private archive omitted the self-report check-in');

    fs.mkdirSync(path.join('artifacts', 'browser-smoke'), { recursive: true });
    await page.screenshot({ path: path.join('artifacts', 'browser-smoke', 'frontier-longitudinal-cortex.png'), fullPage: true });

    invariant(pageErrors.length === 0, `FRONTIER longitudinal/QC audit emitted page errors:\n${pageErrors.join('\n')}`);
    console.log(JSON.stringify({
      ok: true,
      feedRequests,
      checkins: storedCheckins.length,
      qcSessions: qcArchive.sessions.length,
      qcTrials: qcArchive.sessions[0].trials.length,
      cameraCalls,
      qcExportSchema: qcReport.schema,
      privateArchiveSchema: exportedArchive.schema,
      pageErrors,
    }, null, 2));
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
