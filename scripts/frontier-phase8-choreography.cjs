const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_AUDIT_URL || 'http://127.0.0.1:3000/frontier/interaction-audit';
const CARD = '[data-frontier-fluid-card="frontier-phase8-browser-audit"]';
const LINK = '[data-frontier-audit-primary-link="true"]';
const VIDEO = '[data-frontier-audit-video="true"]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function compactRect(value) {
  return {
    x: Number(value.x.toFixed(3)),
    y: Number(value.y.toFixed(3)),
    width: Number(value.width.toFixed(3)),
    height: Number(value.height.toFixed(3)),
  };
}

function rectDistance(a, b) {
  return Math.abs(a.x - b.x)
    + Math.abs(a.y - b.y)
    + Math.abs(a.width - b.width)
    + Math.abs(a.height - b.height);
}

async function rect(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const value = node.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height };
  });
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
    card.addEventListener('pointerup', (event) => state.releases.push(event.timeStamp), true);

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

async function motionSample(page) {
  return page.evaluate((selector) => {
    const node = document.querySelector(selector);
    if (!(node instanceof HTMLElement)) throw new Error('Phase 8 audit card disappeared');
    const visual = node.getBoundingClientRect();
    const animations = node.getAnimations();
    const primary = animations[0];
    return {
      expanded: node.dataset.fluidExpanded === 'true',
      animationCount: animations.length,
      animationCurrentTime: typeof primary?.currentTime === 'number' ? primary.currentTime : null,
      animationPlayState: primary?.playState ?? null,
      transform: getComputedStyle(node).transform,
      layout: { width: node.offsetWidth, height: node.offsetHeight },
      visual: { x: visual.x, y: visual.y, width: visual.width, height: visual.height },
    };
  }, CARD);
}

async function twoRafMotionSample(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return motionSample(page);
}

async function waitForExpandedState(page, expanded) {
  await page.waitForFunction(
    ({ selector, value }) => document.querySelector(selector)?.getAttribute('data-fluid-expanded') === value,
    { selector: CARD, value: expanded ? 'true' : 'false' },
    { polling: 'raf', timeout: 1_000 },
  );
}

async function waitForAnimationsToSettle(page) {
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

  // The hit coordinate is resolved exactly once, before the first release and
  // before any compositor motion. Both releases therefore exercise Chromium's
  // trusted PointerEvent clock rather than spending part of the 250 ms product
  // window on a second locator/bounding-box round trip.
  const hitPoint = await pointerPoint(page, LINK);
  await pointerClickAt(page, hitPoint);
  await waitForExpandedState(page, true);

  const firstReleaseTimes = await page.evaluate(() => window.__frontierPhase8Audit?.releases ?? []);
  assert.equal(firstReleaseTimes.length, 1, `Expected one first pointer release, got ${firstReleaseTimes.length}`);

  const mid = await twoRafMotionSample(page);
  assert.equal(mid.expanded, true, 'First pointer release must enter expanded state immediately');
  assert(mid.animationCount > 0, 'Expansion must have an active FLIP animation');
  assert(
    typeof mid.animationCurrentTime === 'number'
      && Number.isFinite(mid.animationCurrentTime)
      && mid.animationCurrentTime >= 0
      && mid.animationCurrentTime < 250,
    `Expected the expansion WAAPI clock inside the double-release window, saw ${mid.animationCurrentTime}`,
  );
  assert(
    mid.animationPlayState === 'running' || mid.animationPlayState === 'pending',
    `Expected an active expansion animation, saw ${mid.animationPlayState}`,
  );
  assert(mid.layout.width > origin.width + 100, `Expanded grid did not grow: ${mid.layout.width} vs ${origin.width}`);
  assert(
    mid.transform !== 'none' && mid.transform !== 'matrix(1, 0, 0, 1, 0, 0)',
    `Expansion must begin from a non-identity FLIP transform, saw ${mid.transform}`,
  );

  const interruptedVisual = await rect(page, CARD);
  const visibleTravel = rectDistance(origin, interruptedVisual);
  const popupPromise = page.waitForEvent('popup', { timeout: 2_000 })
    .then((popup) => ({ popup }))
    .catch((error) => ({ error }));

  await pointerClickAt(page, hitPoint);

  const releaseTimes = await page.evaluate(() => window.__frontierPhase8Audit?.releases ?? []);
  assert.equal(releaseTimes.length, 2, `Expected two trusted pointer releases, got ${releaseTimes.length}`);
  const releaseDeltaMs = releaseTimes[1] - releaseTimes[0];
  assert(
    releaseDeltaMs > 0 && releaseDeltaMs < 250,
    `Second Chromium PointerEvent release missed the 250 ms threshold: ${releaseDeltaMs}ms`,
  );

  await waitForExpandedState(page, false);
  const reverse = await motionSample(page);
  assert.equal(reverse.expanded, false, 'Second release must restore compact layout state synchronously');
  assert(
    Math.abs(reverse.layout.width - origin.width) < 1,
    `Compact layout width was not restored: ${reverse.layout.width} vs ${origin.width}`,
  );

  // A critically damped FLIP is intentionally almost stationary at t≈0. If
  // the second release lands before the visual rectangle has perceptibly left
  // the compact box, there is no meaningful inverse delta to animate and
  // useSpatialFlip correctly skips a redundant reverse WAAPI object. Once the
  // visual has actually travelled, either the reverse animation must be live or
  // Chromium must already have settled exactly back to the compact geometry.
  const reverseDistanceFromInterrupted = rectDistance(reverse.visual, interruptedVisual);
  const reverseDistanceFromOrigin = rectDistance(reverse.visual, origin);
  let reverseMode;
  if (visibleTravel <= 1) {
    assert(
      reverseDistanceFromOrigin <= 2,
      `Pre-travel interruption should remain visually compact, distance=${reverseDistanceFromOrigin}`,
    );
    reverseMode = 'pre-travel-noop';
  } else if (reverse.animationCount > 0) {
    assert(
      reverse.animationPlayState === 'running' || reverse.animationPlayState === 'pending',
      `Expected active reverse FLIP, saw ${reverse.animationPlayState}`,
    );
    assert(
      reverse.transform !== 'none' && reverse.transform !== 'matrix(1, 0, 0, 1, 0, 0)',
      `Reverse FLIP lost interrupted compositor geometry: ${reverse.transform}`,
    );
    assert(
      reverseDistanceFromInterrupted < Math.max(80, visibleTravel * 0.7),
      `Reverse FLIP jumped away from interruption geometry: ${reverseDistanceFromInterrupted}`,
    );
    reverseMode = 'animated';
  } else {
    assert(
      reverseDistanceFromOrigin <= 2,
      `If scheduler delay consumed the reverse animation, it must already be exactly compact: ${reverseDistanceFromOrigin}`,
    );
    reverseMode = 'settled-before-sample';
  }

  const popupResult = await popupPromise;
  if (popupResult.error) throw popupResult.error;
  const popup = popupResult.popup;
  await popup.waitForURL(/interaction-audit\?popup=1/, { timeout: 2_000 });

  await waitForAnimationsToSettle(page);
  const finalRect = await rect(page, CARD);
  assert(Math.abs(finalRect.width - origin.width) < 0.75, `Collapsed width drifted: ${finalRect.width} vs ${origin.width}`);
  assert(Math.abs(finalRect.height - origin.height) < 0.75, `Collapsed height drifted: ${finalRect.height} vs ${origin.height}`);
  await popup.close();

  return {
    origin: compactRect(origin),
    midFlightVisual: compactRect(mid.visual),
    interruptedVisual: compactRect(interruptedVisual),
    reverseVisual: compactRect(reverse.visual),
    expandedLayout: mid.layout,
    reverseLayout: reverse.layout,
    visibleTravel: Number(visibleTravel.toFixed(3)),
    reverseMode,
    releaseDeltaMs: Number(releaseDeltaMs.toFixed(3)),
    animationCurrentTimeMs: Number(mid.animationCurrentTime.toFixed(3)),
    animationPlayState: mid.animationPlayState,
    reverseAnimationCurrentTimeMs: typeof reverse.animationCurrentTime === 'number'
      ? Number(reverse.animationCurrentTime.toFixed(3))
      : null,
    reverseAnimationPlayState: reverse.animationPlayState,
    compositorTransform: mid.transform,
    reverseCompositorTransform: reverse.transform,
    collapsed: compactRect(finalRect),
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
  const hitPoint = await pointerPoint(page, LINK);
  await pointerClickAt(page, hitPoint);
  await waitForExpandedState(page, true);
  await waitForAnimationsToSettle(page);

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

  assert.equal(continuity.sameNode, true, 'The exact HTMLVideoElement must survive inline expansion');
  assert.equal(continuity.removedVideoCount, 0, 'The video node must never leave the DOM during FLIP');
  assert.equal(continuity.paused, false, 'Playback must remain active after expansion');
  assert(
    continuity.currentTime > before + 0.15,
    `Playback did not advance through the FLIP: ${before} -> ${continuity.currentTime}`,
  );

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
    const result = { passed: true, auditUrl: AUDIT_URL, interruption, mediaContinuity };
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
