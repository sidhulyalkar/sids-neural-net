const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_MOSAIC_AUDIT_URL || 'http://127.0.0.1:3000/frontier/mosaic-audit';
const ROOT = '[data-frontier-mosaic-audit="true"]';
const CARD = '[data-frontier-fluid-card]';
const MEDIA = '[data-frontier-has-media="true"]';
const COMPACT = '[data-frontier-visual-role="compact"]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const EXPECTED_CARDS = 12;

function rounded(value) {
  return Number(value.toFixed(3));
}

function compactRect(rect) {
  return {
    x: rounded(rect.x),
    y: rounded(rect.y),
    width: rounded(rect.width),
    height: rounded(rect.height),
  };
}

async function waitForStableGeometry(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForFunction(
    ({ selector, count }) => document.querySelectorAll(selector).length === count,
    { selector: CARD, count: EXPECTED_CARDS },
    { polling: 'raf', timeout: 5_000 },
  );

  return page.evaluate(({ selector, expected }) => new Promise((resolve, reject) => {
    let previous = '';
    let stableFrames = 0;
    let frames = 0;
    const tick = () => {
      frames += 1;
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length !== expected) {
        if (frames > 180) reject(new Error(`Expected ${expected} cards, found ${nodes.length}`));
        else requestAnimationFrame(tick);
        return;
      }
      const signature = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 4) / 4).join(':');
      }).join('|');
      stableFrames = signature === previous ? stableFrames + 1 : 0;
      previous = signature;
      if (stableFrames >= 4) {
        resolve(frames);
        return;
      }
      if (frames > 180) {
        reject(new Error('Mosaic geometry did not settle within 180 animation frames'));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { selector: CARD, expected: EXPECTED_CARDS });
}

async function analyzeDesktop(page) {
  return page.evaluate(({ rootSelector, cardSelector, mediaSelector, compactSelector }) => {
    const root = document.querySelector(rootSelector);
    const cards = Array.from(document.querySelectorAll(cardSelector));
    if (!(root instanceof HTMLElement) || !cards.length) throw new Error('Missing mosaic fixture');
    const grid = cards[0]?.parentElement;
    if (!(grid instanceof HTMLElement)) throw new Error('Missing mosaic grid');

    const rects = cards.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.getAttribute('data-frontier-fluid-card') || '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });
    const overlapPairs = [];
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left];
        const b = rects[right];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > 0.75 && overlapY > 0.75) overlapPairs.push([a.id, b.id]);
      }
    }

    const minTop = Math.min(...rects.map((rect) => rect.y));
    const maxBottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    const gridRect = grid.getBoundingClientRect();
    const occupiedArea = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    const spanArea = Math.max(1, gridRect.width * (maxBottom - minTop));
    const utilization = Math.min(1, occupiedArea / spanArea);
    const gridStyle = getComputedStyle(grid);
    const roleCounts = {};
    for (const node of document.querySelectorAll('[data-frontier-visual-role]')) {
      const role = node.getAttribute('data-frontier-visual-role') || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }
    const compactNodes = Array.from(document.querySelectorAll(compactSelector));
    const compactSummaryClamps = compactNodes.map((node) => {
      const summary = node.querySelector('article p');
      return summary instanceof HTMLElement ? getComputedStyle(summary).webkitLineClamp : '';
    });
    const monotonicOrder = rects.every((rect, index) => index === 0 || rect.y >= rects[index - 1].y - 1);

    return {
      cardCount: cards.length,
      mediaCount: document.querySelectorAll(mediaSelector).length,
      compactCount: compactNodes.length,
      mediaRatio: document.querySelectorAll(mediaSelector).length / cards.length,
      utilization,
      overlapPairs,
      rowGap: Number.parseFloat(gridStyle.rowGap) || 0,
      columnGap: Number.parseFloat(gridStyle.columnGap) || 0,
      roleCounts,
      compactSummaryClamps,
      monotonicOrder,
      board: { x: gridRect.x, y: gridRect.y, width: gridRect.width, height: gridRect.height },
      cards: rects,
    };
  }, { rootSelector: ROOT, cardSelector: CARD, mediaSelector: MEDIA, compactSelector: COMPACT });
}

async function analyzeMobile(page) {
  return page.evaluate((cardSelector) => {
    const cards = Array.from(document.querySelectorAll(cardSelector));
    if (!cards.length) throw new Error('Missing mobile mosaic cards');
    const grid = cards[0]?.parentElement;
    if (!(grid instanceof HTMLElement)) throw new Error('Missing mobile grid');
    const gridRect = grid.getBoundingClientRect();
    const rects = cards.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, x: rect.x, y: rect.y };
    });
    const widthRatios = rects.map((rect) => rect.width / Math.max(1, gridRect.width));
    let overlaps = 0;
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left];
        const b = rects[right];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > 0.75 && overlapY > 0.75) overlaps += 1;
      }
    }
    return {
      cardCount: cards.length,
      minimumWidthRatio: Math.min(...widthRatios),
      maximumWidthRatio: Math.max(...widthRatios),
      overlaps,
      gridWidth: gridRect.width,
    };
  }, CARD);
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
  page.setDefaultTimeout(5_000);

  try {
    await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(ROOT).waitFor({ state: 'visible' });
    const desktopStableFrames = await waitForStableGeometry(page);
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('[data-frontier-has-media="true"] [role="img"][data-media-state]'))
        .filter((node) => node.getAttribute('data-media-state') !== 'loading').length >= 4,
      null,
      { polling: 'raf', timeout: 5_000 },
    ).catch(() => undefined);

    const desktop = await analyzeDesktop(page);
    assert.equal(desktop.cardCount, EXPECTED_CARDS, 'Populated fixture must keep all representative cards');
    assert(desktop.mediaCount >= 8, `Expected at least eight visual cards, saw ${desktop.mediaCount}`);
    assert(desktop.mediaRatio >= 0.6, `Media-forward ratio regressed: ${desktop.mediaRatio}`);
    assert(desktop.compactCount >= 3, `Expected compact text connective tissue, saw ${desktop.compactCount}`);
    assert.equal(desktop.overlapPairs.length, 0, `Mosaic cards overlap: ${JSON.stringify(desktop.overlapPairs)}`);
    assert(desktop.utilization >= 0.48, `Mosaic area utilization is too sparse: ${desktop.utilization}`);
    assert(desktop.rowGap <= 16, `Mosaic row gap is too large: ${desktop.rowGap}px`);
    assert(desktop.columnGap <= 18, `Mosaic column gap is too large: ${desktop.columnGap}px`);
    assert.equal(desktop.monotonicOrder, true, 'Visual placement must not backfill later-ranked cards above earlier cards');
    assert((desktop.roleCounts.wide || 0) >= 1, 'Expected at least one wide visual card');
    assert((desktop.roleCounts.visual || 0) >= 4, 'Expected multiple ordinary visual cards');
    assert((desktop.roleCounts.standard || 0) >= 1, 'Expected structured text evidence to retain a standard footprint');
    assert(desktop.compactSummaryClamps.every((value) => value === '2'), `Compact summaries must stay at two lines: ${desktop.compactSummaryClamps.join(',')}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'frontier-phase8-1-mosaic-desktop.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(ROOT).waitFor({ state: 'visible' });
    const mobileStableFrames = await waitForStableGeometry(page);
    const mobile = await analyzeMobile(page);
    assert.equal(mobile.cardCount, EXPECTED_CARDS, 'Mobile fixture lost cards');
    assert.equal(mobile.overlaps, 0, 'Mobile cards must never overlap');
    assert(mobile.minimumWidthRatio >= 0.97, `Mobile cards must collapse to one full-width column: ${mobile.minimumWidthRatio}`);
    assert(mobile.maximumWidthRatio <= 1.01, `Mobile cards escaped the grid width: ${mobile.maximumWidthRatio}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'frontier-phase8-1-mosaic-mobile.png'),
      fullPage: true,
    });

    const result = {
      passed: true,
      auditUrl: AUDIT_URL,
      desktop: {
        ...desktop,
        utilization: rounded(desktop.utilization),
        mediaRatio: rounded(desktop.mediaRatio),
        board: compactRect(desktop.board),
        cards: desktop.cards.map(compactRect),
        settledAfterFrames: desktopStableFrames,
      },
      mobile: {
        ...mobile,
        minimumWidthRatio: rounded(mobile.minimumWidthRatio),
        maximumWidthRatio: rounded(mobile.maximumWidthRatio),
        settledAfterFrames: mobileStableFrames,
      },
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-phase8-1-mosaic.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER Phase 8.1 media mosaic PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'frontier-phase8-1-mosaic.json'),
    `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
