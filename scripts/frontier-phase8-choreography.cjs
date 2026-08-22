const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_AUDIT_URL || 'http://127.0.0.1:3000/frontier/interaction-audit';
const CARD = '[data-frontier-fluid-card="frontier-phase8-browser-audit"]';
const LINK = '[data-frontier-audit-primary-link="true"]';
const VIDEO = '[data-frontier-audit-video="true"]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function compactRect(rect) {
  return {
    x: Number(rect.x.toFixed(3)),
    y: Number(rect.y.toFixed(3)),
    width: Number(rect.width.toFixed(3)),
    height: Number(rect.height.toFixed(3)),
  };
}

async function rect(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const value = node.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height };
  });
}

async function pointerClick(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, `Expected ${selector} to have a bounding box`);
  const x = box.x + Math.min(box.width * 0.5, Math.max(12, box.width - 12));
  const y = box.y + Math.min(box.height * 0.5, Math.max(10, box.height - 10));
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.up({ button: 'left' });
}

async function installTelemetry(page) {
  await page.evaluate(({ cardSelector, videoSelector }) => {
    const card = document.querySelector(cardSelector);
    const video = document.querySelector(videoSelector);
    if (!(card instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) {
      throw new Error('Phase 8 audit fixture did not mount');
    }

    const state = {
      releases: [],
      removedVideoCount: 0,
      videoIdentity: video,
      observer: undefined,
    };

    card.addEventListener('pointerup', (event) => {
      state.releases.push(event.timeStamp);
    }, true);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (removed === video || (removed instanceof Element && removed.contains(video))) {
            state.removedVideoCount += 1;
          }
        }
      }
    });
    observer.observe(card, { childList: true, subtree: true });
    state.observer = observer;
    window.__frontierPhase8Audit = state;
  }, { cardSelector: CARD, videoSelector: VIDEO });
}

async function midFlightSample(page) {
  return page.evaluate((selector) => new Promise((resolve) => {
    let frames = 0;
    const sample = () => {
      frames += 1;
      if (frames < 2) {
        requestAnimationFrame(sample);
        return;
      }
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error('Phase 8 audit card disappeared mid-flight');
      const value = node.getBoundingClientRect();
      resolve({
        expanded: node.dataset.fluidExpanded === 'true',
        animations: node.getAnimations().length,
        rect: { x: value.x, y: value.y, width: value.width, height: value.height },
      });
    };
    requestAnimationFrame(sample);
  }), CARD);
}

async function waitForAnimationToSettle(page, expanded) {
  await page.waitForFunction(
    ({ selector, expandedValue }) => document.querySelector(selector)?.getAttribute('data-fluid-expanded') === expandedValue,
    { selector: CARD, expandedValue: expanded ? 'true' : 'false' },
    { polling: 'raf', timeout: 1_000 },
  );

  const started = await page.evaluate((selector) => new Promise((resolve) => {
    requestAnimationFrame(() => {
      const node = document.querySelector(selector);
      resolve(node instanceof HTMLElement ? node.getAnimations().length : -1);
    });
  }), CARD);
  assert(started > 0, `Expected a FLIP animation after ${expanded ? 'expansion' : 'collapse'}, saw ${started}`);

  await page.waitForFunction(
    (selector) => {
      const node = document.querySelector(selector);
      return node instanceof HTMLElement && node.getAnimations().length === 0;
    },
    CARD,
    { polling: 'raf', timeout: 2_000 },
  );
}

async function runInterruptionCase(page) {
  await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(CARD).waitFor({ state: 'visible' });
  await page.locator(LINK).waitFor({ state: 'visible' });
  await page.locator(VIDEO).waitFor({ state: 'attached' });
  await installTelemetry(page);

  const origin = await rect(page, CARD);
  await pointerClick(page, LINK);
  const mid = await midFlightSample(page);

  assert.equal(mid.expanded, true, 'First pointer release must expand synchronously before the next paint');
  assert(mid.animations > 0, 'Kinetic FLIP must be active mid-flight');
  assert(
    mid.rect.width > origin.width + 0.5 || mid.rect.height > origin.height + 0.5,
    `Expected visible kinetic growth beyond origin ${JSON.stringify(origin)}, saw ${JSON.stringify(mid.rect)}`,
  );

  const popupPromise = page.waitForEvent('popup', { timeout: 2_000 });
  await pointerClick(page, LINK);
  const popup = await popupPromise;
  await popup.waitForURL(/interaction-audit\?popup=1/, { timeout: 2_000 });

  const releaseTimes = await page.evaluate(() => window.__frontierPhase8Audit?.releases ?? []);
  assert.equal(releaseTimes.length, 2, `Expected two qualified pointer releases, got ${releaseTimes.length}`);
  const releaseDeltaMs = releaseTimes[1] - releaseTimes[0];
  assert(releaseDeltaMs > 0 && releaseDeltaMs < 250, `Second release missed 250ms interruption threshold: ${releaseDeltaMs}ms`);

  await waitForAnimationToSettle(page, false);
  const finalRect = await rect(page, CARD);
  assert(Math.abs(finalRect.width - origin.width) < 0.75, `Collapsed width drifted: ${finalRect.width} vs ${origin.width}`);
  assert(Math.abs(finalRect.height - origin.height) < 0.75, `Collapsed height drifted: ${finalRect.height} vs ${origin.height}`);

  await popup.close();
  return {
    origin: compactRect(origin),
    midFlight: compactRect(mid.rect),
    collapsed: compactRect(finalRect),
    releaseDeltaMs: Number(releaseDeltaMs.toFixed(3)),
  };
}

async function runMediaContinuityCase(page) {
  await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(CARD).waitFor({ state: 'visible' });
  await page.locator(VIDEO).waitFor({ state: 'attached' });
  await installTelemetry(page);

  await page.waitForFunction(
    (selector) => {
      const video = document.querySelector(selector);
      return video instanceof HTMLVideoElement
        && video.dataset.frontierAuditMedia === 'playing'
        && !video.paused
        && video.currentTime > 0.5;
    },
    VIDEO,
    { polling: 'raf', timeout: 5_000 },
  );

  const before = await page.locator(VIDEO).evaluate((video) => video.currentTime);
  await pointerClick(page, LINK);
  await waitForAnimationToSettle(page, true);

  const continuity = await page.evaluate((selector) => {
    const state = window.__frontierPhase8Audit;
    const video = document.querySelector(selector);
    if (!(video instanceof HTMLVideoElement) || !state) throw new Error('Missing media continuity telemetry');
    return {
      currentTime: video.currentTime,
      paused: video.paused,
      sameNode: state.videoIdentity === video,
      removedVideoCount: state.removedVideoCount,
    };
  }, VIDEO);

  assert.equal(continuity.sameNode, true, 'The exact HTMLVideoElement must survive the inline expansion');
  assert.equal(continuity.removedVideoCount, 0, 'The video node must never leave the DOM during FLIP');
  assert.equal(continuity.paused, false, 'Playback must remain active after expansion');
  assert(
    continuity.currentTime > before + 0.15,
    `Playback did not advance through the 460ms FLIP: ${before} -> ${continuity.currentTime}`,
  );

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-phase8-expanded.png'), fullPage: true });

  return {
    beforeCurrentTime: Number(before.toFixed(3)),
    afterCurrentTime: Number(continuity.currentTime.toFixed(3)),
    advancedBySeconds: Number((continuity.currentTime - before).toFixed(3)),
    sameNode: continuity.sameNode,
    removedVideoCount: continuity.removedVideoCount,
    pausedAfterExpansion: continuity.paused,
  };
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);

  try {
    const interruption = await runInterruptionCase(page);
    const mediaContinuity = await runMediaContinuityCase(page);
    const result = {
      passed: true,
      auditUrl: AUDIT_URL,
      interruption,
      mediaContinuity,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-phase8-choreography.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER Phase 8 choreography PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'frontier-phase8-choreography.json'),
    `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
