const fs = require('node:fs');
const { chromium } = require('playwright');

const url = process.env.FRONTIER_SENSOR_QC_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const TIMEOUT_MS = 12_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
    page.setDefaultTimeout(TIMEOUT_MS);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.route('**/api/frontier/feed**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: '2026-08-31T12:00:00.000Z',
          items: [],
          sources: [{ id: 'rss', label: 'Sensor QC CI', ok: true, count: 0 }],
        }),
      });
    });
    await page.route('**/api/frontier/forage**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ generatedAt: '2026-08-31T12:00:00.000Z', items: [], sources: [] }) });
    });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    invariant(response && response.ok(), `FRONTIER returned ${response?.status() ?? 'no response'}`);

    const trigger = page.getByRole('button', { name: 'Open Sensor QC' });
    await trigger.waitFor();
    await trigger.click();
    const panel = page.getByRole('complementary', { name: 'FRONTIER Sensor QC' });
    await panel.waitFor();

    const copy = ((await panel.textContent()) ?? '').replace(/\s+/g, ' ').toLowerCase();
    invariant(copy.includes('you declare the condition'), 'QC must make condition labels explicitly user-declared');
    invariant(copy.includes('zero recommendation authority'), 'QC must state its non-authoritative boundary');
    invariant(copy.includes('starting qc never requests camera permission'), 'QC must state that camera access is separately opt-in');
    invariant(copy.includes('no content ids'), 'QC must state that content identifiers are excluded from export');

    await panel.getByRole('button', { name: 'Start QC' }).click();
    await panel.getByRole('button', { name: 'Begin trial' }).click();

    await page.evaluate(() => {
      const base = performance.now();
      const wall = Date.now();
      const eventName = 'frontier:face-only-vision-sample';
      window.dispatchEvent(new CustomEvent(eventName, { detail: { sampleAt: base, wallAt: wall, faceObservable: true } }));
      window.dispatchEvent(new CustomEvent(eventName, { detail: { sampleAt: base + 100, wallAt: wall + 100, faceObservable: true } }));
    });
    await page.waitForTimeout(350);

    await panel.getByRole('button', { name: 'End trial' }).click();
    await panel.getByText('Trial saved locally.', { exact: false }).waitFor();
    await panel.getByRole('button', { name: 'Stop session' }).click();
    await panel.getByText('QC session saved locally.', { exact: false }).waitFor();

    const archive = await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-sensor-qc-v1') || 'null'));
    invariant(archive?.schema === 'frontier-sensor-qc-v1', 'QC archive schema missing');
    invariant(archive.sessions?.length === 1, `Expected one QC session, found ${archive.sessions?.length ?? 0}`);
    invariant(archive.sessions[0].trials?.length === 1, 'Expected one QC trial');
    const trial = archive.sessions[0].trials[0];
    invariant(trial.label === 'neutral_reading', `Unexpected trial label ${trial.label}`);
    invariant(trial.durationMs >= 250, `Unexpected QC foreground duration ${trial.durationMs}ms`);
    invariant(trial.callbackSamples === 2, `Synthetic callback channel recorded ${trial.callbackSamples} samples instead of 2`);
    invariant(trial.sensorSampledMs === 100, `Expected 100ms bounded sampled time, got ${trial.sensorSampledMs}`);
    invariant(trial.faceObservableMs === 100, `Expected 100ms face-observable time, got ${trial.faceObservableMs}`);
    invariant(trial.targetAttributedMs === 0, 'Empty feed must not invent target attribution');
    invariant(trial.noTargetMs === 100, `Expected 100ms explicit no-target time, got ${trial.noTargetMs}`);

    const cameraCalls = await page.evaluate(() => window.__frontierCameraCalls || 0);
    invariant(cameraCalls === 0, `QC requested camera access ${cameraCalls} time(s)`);

    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export aggregate JSON' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    invariant(downloadPath, 'QC export did not create a local file');
    const report = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
    invariant(report.schema === 'frontier-sensor-qc-v1', 'QC export schema mismatch');
    invariant(report.privacy?.aggregateOnly === true, 'QC export is not aggregate-only');
    invariant(report.privacy?.contentIdentifiersIncluded === false, 'QC export says content identifiers are included');
    invariant(report.privacy?.rawCameraDataIncluded === false, 'QC export says raw camera data is included');
    const serialized = JSON.stringify(report).toLowerCase();
    for (const forbidden of ['"itemid":', '"cardid":', '"contentid":', '"title":', '"url":', 'landmark', 'blendshape', 'embedding', 'biometrictemplate']) {
      invariant(!serialized.includes(forbidden), `QC export leaked forbidden field ${forbidden}`);
    }

    invariant(pageErrors.length === 0, `Sensor QC audit emitted page errors:\n${pageErrors.join('\n')}`);
    console.log(JSON.stringify({
      ok: true,
      cameraCalls,
      sessions: archive.sessions.length,
      trials: archive.sessions[0].trials.length,
      callbackSamples: trial.callbackSamples,
      sensorSampledMs: trial.sensorSampledMs,
      faceObservableMs: trial.faceObservableMs,
      targetAttributedMs: trial.targetAttributedMs,
      exportSchema: report.schema,
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
