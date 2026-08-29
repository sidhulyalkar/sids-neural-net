const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_AUDIT_URL || 'http://127.0.0.1:3000/frontier/interaction-audit';
const CARD = '[data-frontier-fluid-card="frontier-phase8-browser-audit"]';
const LINK = '[data-frontier-audit-primary-link="true"]';
const VIDEO = '[data-frontier-audit-video="true"]';
const READING = '[data-frontier-expanded-reading="true"]';
const HIGHLIGHT = '[data-frontier-source-highlight]';
const NEIGHBORS = '[data-frontier-audit-neighbor]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

let lastDiagnostics = {};

function compactRect(value) {
  if (!value) return null;
  return {
    x: Number(value.x.toFixed(3)),
    y: Number(value.y.toFixed(3)),
    width: Number(value.width.toFixed(3)),
    height: Number(value.height.toFixed(3)),
  };
}

async function rect(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const value = node.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height };
  });
}

async function neighborGeometry(page) {
  return page.locator(NEIGHBORS).evaluateAll((nodes) => nodes.map((node) => {
    const value = node.getBoundingClientRect();
    return {
      id: node.getAttribute('data-frontier-audit-neighbor'),
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
    };
  }));
}

async function pointerPoint(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, `Expected ${selector} to have a bounding box`);
  return {
    x: box.x + Math.min(box.width * 0.5, Math.max(12, box.width - 12)),
    y: box.y + Math.min(box.height * 0.5, Math.max(10, box.height - 10)),
  };
}

async function pointerClickAt(page, point) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.up({ button: 'left' });
}

async function waitFrames(page, count = 2) {
  await page.evaluate((frames) => new Promise((resolve) => {
    let remaining = Math.max(1, frames);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), count);
}

async function waitForExpandedState(page, expanded) {
  await page.waitForFunction(
    ({ selector, value }) => document.querySelector(selector)?.getAttribute('data-fluid-expanded') === value,
    { selector: CARD, value: expanded ? 'true' : 'false' },
    { polling: 'raf', timeout: 1_500 },
  );
}

async function installMediaTelemetry(page) {
  await page.evaluate(({ cardSelector, videoSelector }) => {
    const card = document.querySelector(cardSelector);
    const video = document.querySelector(videoSelector);
    if (!(card instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) {
      throw new Error('Phase 8 audit fixture did not mount');
    }

    const state = {
      removedVideoCount: 0,
      videoIdentity: video,
    };
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
    window.__frontierPhase8MediaAudit = state;
  }, { cardSelector: CARD, videoSelector: VIDEO });
}

async function runInPlaceExpansionCase(page) {
  await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(CARD).waitFor({ state: 'visible' });
  await page.locator(LINK).waitFor({ state: 'visible' });
  await page.locator(VIDEO).waitFor({ state: 'attached' });

  const origin = await rect(page, CARD);
  const neighborBefore = await neighborGeometry(page);
  assert.equal(neighborBefore.length, 2, 'Expected two neighbor surfaces in the spatial audit fixture');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-phase8-collapsed.png'), fullPage: true });

  const hitPoint = await pointerPoint(page, LINK);
  await pointerClickAt(page, hitPoint);
  await waitForExpandedState(page, true);
  await page.locator(READING).waitFor({ state: 'visible' });
  await waitFrames(page, 3);

  const expanded = await rect(page, CARD);
  const neighborAfter = await neighborGeometry(page);
  const highlight = await page.locator(HIGHLIGHT).evaluate((node) => ({
    kind: node.getAttribute('data-frontier-source-highlight'),
    text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
  }));
  const ownAnimations = await page.locator(CARD).evaluate((node) => node.getAnimations().length);

  assert(Math.abs(expanded.x - origin.x) < 1, `Expansion moved card horizontally: ${origin.x} -> ${expanded.x}`);
  assert(Math.abs(expanded.width - origin.width) < 1, `Expansion changed card width: ${origin.width} -> ${expanded.width}`);
  assert(expanded.height > origin.height + 120, `Expanded reading plane did not grow downward enough: ${origin.height} -> ${expanded.height}`);
  assert.equal(ownAnimations, 0, 'Ordinary expansion must not run a board/card FLIP transform');
  assert(highlight.kind, 'Expanded reading plane must expose a source-highlight provenance kind');
  assert(highlight.text.length >= 80, `Expanded source highlight is too thin to be useful: ${highlight.text.length} chars`);

  for (const before of neighborBefore) {
    const after = neighborAfter.find((candidate) => candidate.id === before.id);
    assert(after, `Neighbor ${before.id} disappeared during expansion`);
    assert(Math.abs(after.x - before.x) < 1, `Neighbor ${before.id} changed horizontal position: ${before.x} -> ${after.x}`);
    assert(Math.abs(after.width - before.width) < 1, `Neighbor ${before.id} changed width: ${before.width} -> ${after.width}`);
  }

  // Once open, ordinary reading clicks stay in the expanded state. The user can
  // select/read/interact without a stray click collapsing the story underneath them.
  await page.waitForTimeout(320);
  const readingBox = await page.locator(HIGHLIGHT).boundingBox();
  assert(readingBox, 'Expanded source highlight must have a hit box');
  await pointerClickAt(page, {
    x: readingBox.x + Math.min(22, readingBox.width / 2),
    y: readingBox.y + Math.min(22, readingBox.height / 2),
  });
  await waitFrames(page, 2);
  assert.equal(await page.locator(CARD).getAttribute('data-fluid-expanded'), 'true', 'Reading click unexpectedly collapsed the card');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-phase8-expanded.png'), fullPage: true });

  const close = page.getByRole('button', { name: /Collapse Phase 8 fluid spatial interaction audit/i });
  await close.click();
  await waitForExpandedState(page, false);
  await waitFrames(page, 2);
  const collapsed = await rect(page, CARD);
  const neighborCollapsed = await neighborGeometry(page);

  assert(Math.abs(collapsed.x - origin.x) < 1, `Collapsed card x drifted: ${origin.x} -> ${collapsed.x}`);
  assert(Math.abs(collapsed.width - origin.width) < 1, `Collapsed card width drifted: ${origin.width} -> ${collapsed.width}`);
  assert(Math.abs(collapsed.height - origin.height) < 2, `Collapsed card height did not restore: ${origin.height} -> ${collapsed.height}`);
  for (const before of neighborBefore) {
    const after = neighborCollapsed.find((candidate) => candidate.id === before.id);
    assert(after, `Neighbor ${before.id} disappeared after collapse`);
    assert(Math.abs(after.x - before.x) < 1, `Neighbor ${before.id} x drifted after collapse`);
  }

  const result = {
    origin: compactRect(origin),
    expanded: compactRect(expanded),
    collapsed: compactRect(collapsed),
    highlightKind: highlight.kind,
    highlightCharacters: highlight.text.length,
    ownAnimationCount: ownAnimations,
    neighborsBefore: neighborBefore.map((value) => ({ ...value, ...compactRect(value) })),
    neighborsExpanded: neighborAfter.map((value) => ({ ...value, ...compactRect(value) })),
    neighborsCollapsed: neighborCollapsed.map((value) => ({ ...value, ...compactRect(value) })),
  };
  lastDiagnostics.inPlaceExpansion = result;
  return result;
}

async function runMediaContinuityCase(page) {
  await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(CARD).waitFor({ state: 'visible' });
  await page.locator(VIDEO).waitFor({ state: 'attached' });
  await installMediaTelemetry(page);

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
  const hitPoint = await pointerPoint(page, LINK);
  await pointerClickAt(page, hitPoint);
  await waitForExpandedState(page, true);
  await page.waitForTimeout(300);

  const continuity = await page.evaluate((selector) => {
    const state = window.__frontierPhase8MediaAudit;
    const video = document.querySelector(selector);
    if (!(video instanceof HTMLVideoElement) || !state) throw new Error('Missing media continuity telemetry');
    return {
      currentTime: video.currentTime,
      paused: video.paused,
      sameNode: state.videoIdentity === video,
      removedVideoCount: state.removedVideoCount,
    };
  }, VIDEO);

  assert.equal(continuity.sameNode, true, 'The exact HTMLVideoElement must survive inline expansion');
  assert.equal(continuity.removedVideoCount, 0, 'The video node must never leave the DOM during expansion');
  assert.equal(continuity.paused, false, 'Playback must remain active after expansion');
  assert(continuity.currentTime > before + 0.15, `Playback did not advance through expansion: ${before} -> ${continuity.currentTime}`);

  const result = {
    beforeCurrentTime: Number(before.toFixed(3)),
    afterCurrentTime: Number(continuity.currentTime.toFixed(3)),
    advancedBySeconds: Number((continuity.currentTime - before).toFixed(3)),
    sameNode: continuity.sameNode,
    removedVideoCount: continuity.removedVideoCount,
    pausedAfterExpansion: continuity.paused,
  };
  lastDiagnostics.mediaContinuity = result;
  return result;
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
    const inPlaceExpansion = await runInPlaceExpansionCase(page);
    const mediaContinuity = await runMediaContinuityCase(page);
    const result = { passed: true, auditUrl: AUDIT_URL, inPlaceExpansion, mediaContinuity };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-phase8-choreography.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER Phase 8 in-place choreography PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'frontier-phase8-choreography.json'),
    `${JSON.stringify({
      passed: false,
      auditUrl: AUDIT_URL,
      error: error instanceof Error ? error.stack : String(error),
      diagnostics: lastDiagnostics,
    }, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});