const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_SCROLL_AUDIT_URL || 'http://127.0.0.1:3000/frontier/mosaic-audit';
const ROOT = '[data-frontier-mosaic-audit="true"]';
const CARD = '[data-frontier-fluid-card]';
const EXPECTED_CARDS = 12;
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function rounded(value) {
  return Number(value.toFixed(3));
}

async function waitForFixture(page) {
  await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(ROOT).waitFor({ state: 'visible' });
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelectorAll(selector).length === expected,
    { selector: CARD, expected: EXPECTED_CARDS },
    { polling: 'raf', timeout: 5_000 },
  );
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

async function sweep(page) {
  return page.evaluate(async (selector) => {
    const twoFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const step = Math.max(240, Math.floor(window.innerHeight * 0.72));
    let maxDrift = 0;
    let samples = 0;

    const settleAt = async (requested) => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.max(0, Math.min(maxScroll, requested));
      window.scrollTo(0, target);
      await twoFrames();
      maxDrift = Math.max(maxDrift, Math.abs(window.scrollY - target));
      samples += 1;
    };

    let guard = 0;
    let maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y < maxScroll && guard < 96; y += step, guard += 1) {
      await settleAt(y);
      maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    await settleAt(maxScroll);

    guard = 0;
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = maxScroll; y > 0 && guard < 96; y -= step, guard += 1) await settleAt(y);
    await settleAt(0);
    await twoFrames();

    return {
      maxScrollDrift: maxDrift,
      samples,
      lockedCards: document.querySelectorAll(`${selector}[data-frontier-geometry="locked"]`).length,
      documentHeight: document.documentElement.scrollHeight,
    };
  }, CARD);
}

async function installShiftObserver(page) {
  await page.evaluate(() => {
    window.__frontierLayoutShiftScore = 0;
    window.__frontierLayoutShiftEntries = 0;
    window.__frontierLayoutObserver?.disconnect?.();
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__frontierLayoutShiftScore += entry.value || 0;
          window.__frontierLayoutShiftEntries += 1;
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      window.__frontierLayoutObserver = observer;
    } catch {
      // Older engines may not expose LayoutShift. Geometry comparisons remain authoritative.
    }
  });
}

async function readShiftObserver(page) {
  return page.evaluate(() => ({
    score: window.__frontierLayoutShiftScore || 0,
    entries: window.__frontierLayoutShiftEntries || 0,
  }));
}

async function snapshot(page) {
  return page.evaluate((selector) => {
    const cards = Array.from(document.querySelectorAll(selector));
    const grid = cards[0]?.parentElement;
    if (!(grid instanceof HTMLElement)) throw new Error('Missing deterministic masonry grid');

    const cardGeometry = cards.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        id: node.getAttribute('data-frontier-fluid-card') || '',
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
        lockedHeight: Number.parseFloat(node.getAttribute('data-frontier-geometry-height') || '0'),
        containIntrinsicSize: style.containIntrinsicSize,
        contentVisibility: style.contentVisibility,
      };
    });

    const media = cards
      .filter((node) => node.querySelector('[data-frontier-has-media="true"]'))
      .map((node) => {
        const target = node.querySelector('[role="img"], video, iframe, img');
        if (!(target instanceof HTMLElement)) return null;
        const rect = target.getBoundingClientRect();
        return {
          id: node.getAttribute('data-frontier-fluid-card') || '',
          width: rect.width,
          height: rect.height,
          aspect: rect.width / Math.max(1, rect.height),
          mediaState: target.getAttribute('data-media-state'),
        };
      })
      .filter(Boolean);

    return {
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      overflowAnchor: getComputedStyle(grid).overflowAnchor,
      lockedCards: cards.filter((node) => node.getAttribute('data-frontier-geometry') === 'locked').length,
      cards: cardGeometry,
      media,
    };
  }, CARD);
}

function compareSnapshots(before, after) {
  const afterById = new Map(after.cards.map((card) => [card.id, card]));
  let maxTopDelta = 0;
  let maxHeightDelta = 0;
  let maxWidthDelta = 0;
  for (const card of before.cards) {
    const next = afterById.get(card.id);
    assert(next, `Card disappeared after bidirectional scroll: ${card.id}`);
    maxTopDelta = Math.max(maxTopDelta, Math.abs(next.top - card.top));
    maxHeightDelta = Math.max(maxHeightDelta, Math.abs(next.height - card.height));
    maxWidthDelta = Math.max(maxWidthDelta, Math.abs(next.width - card.width));
  }

  const afterMedia = new Map(after.media.map((entry) => [entry.id, entry]));
  let maxMediaHeightDelta = 0;
  let maxMediaAspectDelta = 0;
  for (const media of before.media) {
    const next = afterMedia.get(media.id);
    assert(next, `Media geometry disappeared after bidirectional scroll: ${media.id}`);
    maxMediaHeightDelta = Math.max(maxMediaHeightDelta, Math.abs(next.height - media.height));
    maxMediaAspectDelta = Math.max(maxMediaAspectDelta, Math.abs(next.aspect - media.aspect));
  }

  return { maxTopDelta, maxHeightDelta, maxWidthDelta, maxMediaHeightDelta, maxMediaAspectDelta };
}

async function runViewport(page, name, viewport) {
  await page.setViewportSize(viewport);
  await waitForFixture(page);

  const warm = await sweep(page);
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelectorAll(`${selector}[data-frontier-geometry="locked"]`).length === expected,
    { selector: CARD, expected: EXPECTED_CARDS },
    { polling: 'raf', timeout: 5_000 },
  );
  const before = await snapshot(page);
  await installShiftObserver(page);
  const repeat = await sweep(page);
  const after = await snapshot(page);
  const shift = await readShiftObserver(page);
  const stability = compareSnapshots(before, after);

  assert.equal(before.lockedCards, EXPECTED_CARDS, `${name}: every card must own exact cached geometry before repeat scrolling`);
  assert.equal(after.lockedCards, EXPECTED_CARDS, `${name}: geometry locks must survive reverse scrolling`);
  assert.equal(before.overflowAnchor, 'none', `${name}: masonry must opt out of native scroll anchoring`);
  assert(before.media.length >= 8, `${name}: expected the media-forward fixture to retain at least eight media boxes`);
  assert(before.media.every((entry) => entry.width > 10 && entry.height > 10), `${name}: every media card must reserve a nonzero aspect box before texture readiness`);
  assert(stability.maxTopDelta <= 1.25, `${name}: card document positions drifted ${stability.maxTopDelta}px after reverse scroll`);
  assert(stability.maxHeightDelta <= 1.25, `${name}: card heights drifted ${stability.maxHeightDelta}px after reverse scroll`);
  assert(stability.maxWidthDelta <= 1.25, `${name}: card widths drifted ${stability.maxWidthDelta}px after reverse scroll`);
  assert(stability.maxMediaHeightDelta <= 1.25, `${name}: media aspect boxes changed height by ${stability.maxMediaHeightDelta}px`);
  assert(stability.maxMediaAspectDelta <= 0.01, `${name}: media aspect boxes changed ratio by ${stability.maxMediaAspectDelta}`);
  assert(repeat.maxScrollDrift <= 2, `${name}: browser scroll position drifted ${repeat.maxScrollDrift}px without an explicit scroll command`);
  assert(shift.score <= 0.01, `${name}: layout-shift score regressed to ${shift.score}`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `frontier-scroll-stability-${name}.png`),
    fullPage: true,
  });

  return {
    viewport,
    warm: {
      ...warm,
      maxScrollDrift: rounded(warm.maxScrollDrift),
    },
    repeat: {
      ...repeat,
      maxScrollDrift: rounded(repeat.maxScrollDrift),
    },
    shift: {
      score: rounded(shift.score),
      entries: shift.entries,
    },
    stability: Object.fromEntries(Object.entries(stability).map(([key, value]) => [key, rounded(value)])),
    lockedCards: after.lockedCards,
    mediaBoxes: after.media.length,
    overflowAnchor: after.overflowAnchor,
    documentHeight: after.documentHeight,
  };
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6_000);

  try {
    const desktop = await runViewport(page, 'desktop', { width: 1440, height: 1100 });
    const mobile = await runViewport(page, 'mobile', { width: 390, height: 844 });
    const result = { passed: true, auditUrl: AUDIT_URL, desktop, mobile };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-scroll-stability.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER deterministic scroll stability PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'frontier-scroll-stability.json'),
    `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
