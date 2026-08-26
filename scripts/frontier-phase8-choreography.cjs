const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_AUDIT_URL || 'http://127.0.0.1:3000/frontier/interaction-audit';
const CARD = '[data-frontier-fluid-card="frontier-phase8-browser-audit"]';
const LINK = '[data-frontier-audit-primary-link="true"]';
const VIDEO = '[data-frontier-audit-video="true"]';
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
      releaseTargets: [],
      releaseRects: [],
      removedVideoCount: 0,
      videoIdentity: video,
      observer: undefined,
    };

    card.addEventListener('pointerup', (event) => {
      state.releases.push(event.timeStamp);
      const target = event.target;
      state.releaseTargets.push(target instanceof Element
        ? `${target.tagName.toLowerCase()}${target.getAttribute('data-frontier-fluid-primary-link') === 'true' ? '[primary]' : ''}`
        : 'unknown');
      const value = card.getBoundingClientRect();
      state.releaseRects.push({
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
      });
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

async function releaseTelemetry(page) {
  return page.evaluate(() => {
    const state = window.__frontierPhase8Audit;
    return {
      times: state?.releases ?? [],
      targets: state?.releaseTargets ?? [],
      rects: state?.releaseRects ?? [],
    };
  });
}

async function motionSample(page) {
  return page.evaluate((selector) => {
    const node = document.querySelector(selector);
    if (!(node instanceof HTMLElement)) throw new Error('Phase 8 audit card disappeared');
    const visual = node.getBoundingClientRect();
    const animations = node.getAnimations();
    const primary = animations[0];
    let firstKeyframeMatrix = null;
    let firstKeyframeTransform = null;
    let firstKeyframeOrigin = null;

    if (primary?.effect instanceof KeyframeEffect) {
      const firstFrame = primary.effect.getKeyframes()[0];
      if (firstFrame) {
        firstKeyframeTransform = typeof firstFrame.transform === 'string' ? firstFrame.transform : null;
        firstKeyframeOrigin = typeof firstFrame.transformOrigin === 'string' ? firstFrame.transformOrigin : null;
        if (firstKeyframeTransform && firstKeyframeTransform !== 'none') {
          const matrix = new DOMMatrixReadOnly(firstKeyframeTransform);
          firstKeyframeMatrix = {
            a: matrix.a,
            b: matrix.b,
            c: matrix.c,
            d: matrix.d,
            e: matrix.e,
            f: matrix.f,
          };
        }
      }
    }

    return {
      expanded: node.dataset.fluidExpanded === 'true',
      animationCount: animations.length,
      animationCurrentTime: typeof primary?.currentTime === 'number' ? primary.currentTime : null,
      animationPlayState: primary?.playState ?? null,
      firstKeyframeMatrix,
      firstKeyframeTransform,
      firstKeyframeOrigin,
      transform: getComputedStyle(node).transform,
      transformOrigin: getComputedStyle(node).transformOrigin,
      layout: { width: node.offsetWidth, height: node.offsetHeight },
      visual: { x: visual.x, y: visual.y, width: visual.width, height: visual.height },
    };
  }, CARD);
}

function seededRectFromMatrix(layoutRect, matrix) {
  return {
    x: layoutRect.x + matrix.e,
    y: layoutRect.y + matrix.f,
    width: layoutRect.width * matrix.a,
    height: layoutRect.height * matrix.d,
  };
}

async function waitFrames(page, count = 1) {
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
  lastDiagnostics.interruption = { origin: compactRect(origin) };

  // Resolve the hit coordinate exactly once before any layout motion. Both
  // trusted releases use the same point, so the browser's own PointerEvent
  // timestamps, rather than locator IPC, define the 250 ms product window.
  const hitPoint = await pointerPoint(page, LINK);
  await pointerClickAt(page, hitPoint);
  await waitForExpandedState(page, true);

  const firstRelease = await releaseTelemetry(page);
  assert.equal(firstRelease.times.length, 1, `Expected one first pointer release, got ${firstRelease.times.length}`);
  assert.equal(firstRelease.rects.length, 1, 'First release must record its capture-phase card geometry');

  await waitFrames(page, 2);
  const mid = await motionSample(page);
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

  // This sample is informational. The authoritative interruption geometry is
  // captured by the card's capture-phase pointerup listener below, immediately
  // before React processes the second trusted release.
  const preSecondVisual = await rect(page, CARD);
  // The production link intentionally opens with noopener/noreferrer. That can
  // sever opener semantics, so Page's popup event is not an authoritative
  // observation point. The isolated BrowserContext still owns every new page
  // and therefore detects the navigation without weakening the product policy.
  const popupPromise = page.context().waitForEvent('page', { timeout: 2_000 })
    .then((popup) => ({ popup }))
    .catch((error) => ({ error }));

  await pointerClickAt(page, hitPoint);

  const releases = await releaseTelemetry(page);
  assert.equal(releases.times.length, 2, `Expected two trusted pointer releases, got ${releases.times.length}`);
  assert.equal(releases.rects.length, 2, `Expected two capture-phase release rectangles, got ${releases.rects.length}`);
  const releaseDeltaMs = releases.times[1] - releases.times[0];
  assert(
    releaseDeltaMs > 0 && releaseDeltaMs < 250,
    `Second Chromium PointerEvent release missed the 250 ms threshold: ${releaseDeltaMs}ms`,
  );

  const secondReleaseVisual = releases.rects[1];
  const visibleTravelAtRelease = rectDistance(origin, secondReleaseVisual);
  lastDiagnostics.interruption = {
    ...lastDiagnostics.interruption,
    hitPoint,
    releaseDeltaMs,
    releaseTargets: releases.targets,
    releaseRects: releases.rects.map(compactRect),
    preSecondVisual: compactRect(preSecondVisual),
    visibleTravelAtRelease,
    mid,
  };

  await waitForExpandedState(page, false);
  const reverse = await motionSample(page);
  assert.equal(reverse.expanded, false, 'Second release must restore compact layout state synchronously');
  assert(
    Math.abs(reverse.layout.width - origin.width) < 1,
    `Compact layout width was not restored: ${reverse.layout.width} vs ${origin.width}`,
  );

  const reverseDistanceFromOrigin = rectDistance(reverse.visual, origin);
  let reverseMode;
  let reverseSeedVisual = null;
  let reverseSeedDistance = null;

  if (visibleTravelAtRelease <= 1) {
    // A critically damped spring can still be essentially at the compact box
    // when release two lands. In that case a zero-delta reverse is correct.
    if (reverse.animationCount === 0) {
      assert(
        reverseDistanceFromOrigin <= 2,
        `Pre-travel interruption should remain visually compact, distance=${reverseDistanceFromOrigin}`,
      );
      reverseMode = 'pre-travel-noop';
    } else {
      reverseMode = 'pre-travel-animated';
    }
  } else if (reverse.animationCount > 0) {
    assert(
      reverse.animationPlayState === 'running' || reverse.animationPlayState === 'pending',
      `Expected active reverse FLIP, saw ${reverse.animationPlayState}`,
    );
    assert(reverse.firstKeyframeMatrix, 'Active reverse FLIP must expose its first compositor keyframe');
    assert(
      reverse.firstKeyframeOrigin === '0px 0px' || reverse.transformOrigin.startsWith('0px 0px'),
      `Reverse FLIP must stay top-left anchored, saw ${reverse.firstKeyframeOrigin || reverse.transformOrigin}`,
    );

    // The first reverse keyframe is immutable. Reconstruct the card rectangle
    // it encodes and compare it with the geometry observed in capture phase on
    // the same second pointerup. This proves interruption continuity without
    // assuming how many compositor frames Chromium advances before Playwright
    // can sample the running reverse animation.
    reverseSeedVisual = seededRectFromMatrix(origin, reverse.firstKeyframeMatrix);
    reverseSeedDistance = rectDistance(reverseSeedVisual, secondReleaseVisual);
    assert(
      reverseSeedDistance <= 2,
      `Reverse FLIP seed did not preserve trusted-release geometry: distance=${reverseSeedDistance}`,
    );
    reverseMode = 'animated-from-trusted-release';
  } else {
    assert(
      reverseDistanceFromOrigin <= 2,
      `If scheduler delay consumed the reverse animation, it must already be exactly compact: ${reverseDistanceFromOrigin}`,
    );
    reverseMode = 'settled-before-sample';
  }

  lastDiagnostics.interruption = {
    ...lastDiagnostics.interruption,
    reverse,
    reverseMode,
    reverseSeedVisual: compactRect(reverseSeedVisual),
    reverseSeedDistance,
  };

  const popupResult = await popupPromise;
  if (popupResult.error) throw popupResult.error;
  const popup = popupResult.popup;
  await popup.waitForURL(/interaction-audit\?popup=1/, { timeout: 2_000 });

  await waitForAnimationsToSettle(page);
  const finalRect = await rect(page, CARD);
  assert(Math.abs(finalRect.x - origin.x) < 0.75, `Collapsed x drifted: ${finalRect.x} vs ${origin.x}`);
  assert(Math.abs(finalRect.y - origin.y) < 0.75, `Collapsed y drifted: ${finalRect.y} vs ${origin.y}`);
  assert(Math.abs(finalRect.width - origin.width) < 0.75, `Collapsed width drifted: ${finalRect.width} vs ${origin.width}`);
  assert(Math.abs(finalRect.height - origin.height) < 0.75, `Collapsed height drifted: ${finalRect.height} vs ${origin.height}`);
  await popup.close();

  const result = {
    origin: compactRect(origin),
    firstReleaseVisual: compactRect(releases.rects[0]),
    midFlightVisual: compactRect(mid.visual),
    preSecondVisual: compactRect(preSecondVisual),
    trustedSecondReleaseVisual: compactRect(secondReleaseVisual),
    reverseVisual: compactRect(reverse.visual),
    reverseSeedVisual: compactRect(reverseSeedVisual),
    reverseSeedDistance: reverseSeedDistance === null ? null : Number(reverseSeedDistance.toFixed(3)),
    expandedLayout: mid.layout,
    reverseLayout: reverse.layout,
    visibleTravelAtRelease: Number(visibleTravelAtRelease.toFixed(3)),
    reverseMode,
    releaseDeltaMs: Number(releaseDeltaMs.toFixed(3)),
    releaseTargets: releases.targets,
    animationCurrentTimeMs: Number(mid.animationCurrentTime.toFixed(3)),
    animationPlayState: mid.animationPlayState,
    reverseAnimationCurrentTimeMs: typeof reverse.animationCurrentTime === 'number'
      ? Number(reverse.animationCurrentTime.toFixed(3))
      : null,
    reverseAnimationPlayState: reverse.animationPlayState,
    compositorTransform: mid.transform,
    reverseCompositorTransform: reverse.transform,
    reverseFirstKeyframeTransform: reverse.firstKeyframeTransform,
    collapsed: compactRect(finalRect),
  };
  lastDiagnostics.interruption = result;
  return result;
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