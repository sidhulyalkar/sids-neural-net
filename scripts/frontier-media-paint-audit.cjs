const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_MEDIA_PAINT_AUDIT_URL || 'http://127.0.0.1:3000/frontier/mosaic-audit';
const CARD = '[data-frontier-fluid-card]';
const EXPECTED_CARDS = 12;
const EXPECTED_MEDIA = 8;
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const RESULT_PATH = path.join(ARTIFACT_DIR, 'frontier-media-paint-audit.json');

function rounded(value) {
  return Number(value.toFixed(3));
}

async function waitForStableGeometry(page) {
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
        return [rect.x, rect.y, rect.width, rect.height]
          .map((value) => Math.round(value * 4) / 4)
          .join(':');
      }).join('|');
      stableFrames = signature === previous ? stableFrames + 1 : 0;
      previous = signature;
      if (stableFrames >= 4) {
        resolve(frames);
        return;
      }
      if (frames > 180) {
        reject(new Error('Media-paint baseline geometry did not settle within 180 animation frames'));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { selector: CARD, expected: EXPECTED_CARDS });
}

async function waitForFixture(page) {
  await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelectorAll(selector).length === expected,
    { selector: CARD, expected: EXPECTED_CARDS },
    { polling: 'raf', timeout: 6_000 },
  );
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    if (document.fonts?.ready) await document.fonts.ready;
  });
  return waitForStableGeometry(page);
}

async function mediaCardIds(page) {
  return page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).flatMap((node) => {
    const presentation = node.querySelector('[data-frontier-has-media="true"]');
    const id = node.getAttribute('data-frontier-fluid-card');
    return presentation && id ? [id] : [];
  }), CARD);
}

async function cardRect(page, id) {
  return page.evaluate(({ selector, id }) => {
    const node = Array.from(document.querySelectorAll(selector)).find((candidate) => candidate.getAttribute('data-frontier-fluid-card') === id);
    if (!(node instanceof HTMLElement)) throw new Error(`Missing card ${id}`);
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
      mediaDeclared: Boolean(node.querySelector('[data-frontier-has-media="true"]')),
      unavailable: node.getAttribute('data-frontier-media-unavailable') === 'true',
    };
  }, { selector: CARD, id });
}

async function visitMediaCard(page, id) {
  const locator = page.locator(`${CARD}[data-frontier-fluid-card="${id}"]`);
  await locator.scrollIntoViewIfNeeded();
  await page.waitForFunction((id) => {
    const card = document.querySelector(`[data-frontier-fluid-card="${CSS.escape(id)}"]`);
    if (!(card instanceof HTMLElement)) return false;
    const surfaces = Array.from(card.querySelectorAll('[data-media-state]'));
    if (!surfaces.length) return false;
    return surfaces.some((surface) =>
      surface.getAttribute('data-media-native-ready') === 'true' ||
      surface.getAttribute('data-media-state') === 'ready' ||
      surface.getAttribute('data-media-state') === 'native'
    );
  }, id, { polling: 'raf', timeout: 4_000 });

  return page.evaluate((id) => {
    const card = document.querySelector(`[data-frontier-fluid-card="${CSS.escape(id)}"]`);
    if (!(card instanceof HTMLElement)) throw new Error(`Missing media card ${id}`);
    const surfaces = Array.from(card.querySelectorAll('[data-media-state]'));
    const round = (value) => Number(value.toFixed(3));
    return {
      id,
      surfaces: surfaces.map((surface) => ({
        state: surface.getAttribute('data-media-state'),
        nativeReady: surface.getAttribute('data-media-native-ready') === 'true',
        rect: (() => {
          const rect = surface.getBoundingClientRect();
          return { width: round(rect.width), height: round(rect.height) };
        })(),
      })),
    };
  }, id);
}

async function normalPaintProof(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'dark' });
  const page = await context.newPage();
  page.setDefaultTimeout(6_000);
  try {
    const settledAfterFrames = await waitForFixture(page);
    const ids = await mediaCardIds(page);
    assert.equal(ids.length, EXPECTED_MEDIA, `Expected ${EXPECTED_MEDIA} media cards, saw ${ids.length}`);
    const before = new Map();
    for (const id of ids) before.set(id, await cardRect(page, id));

    const visits = [];
    for (const id of ids) visits.push(await visitMediaCard(page, id));
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    let maxHeightDelta = 0;
    let maxWidthDelta = 0;
    let maxTopDelta = 0;
    for (const id of ids) {
      const prior = before.get(id);
      const after = await cardRect(page, id);
      assert.equal(after.mediaDeclared, true, `${id} lost its structural media role after viewport traversal`);
      maxHeightDelta = Math.max(maxHeightDelta, Math.abs(after.height - prior.height));
      maxWidthDelta = Math.max(maxWidthDelta, Math.abs(after.width - prior.width));
      maxTopDelta = Math.max(maxTopDelta, Math.abs(after.top - prior.top));
    }

    assert(maxHeightDelta <= 1.25, `Media card height changed by ${maxHeightDelta}px after actual paint traversal`);
    assert(maxWidthDelta <= 1.25, `Media card width changed by ${maxWidthDelta}px after actual paint traversal`);
    assert(maxTopDelta <= 1.25, `Media card document position changed by ${maxTopDelta}px after actual paint traversal`);
    assert(visits.every((visit) => visit.surfaces.some((surface) => surface.nativeReady || surface.state === 'ready' || surface.state === 'native')),
      'At least one visited media card never acquired a real pixel path');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-media-paint-normal.png'), fullPage: true });
    return {
      passed: true,
      settledAfterFrames,
      ids,
      visits,
      maxHeightDelta: rounded(maxHeightDelta),
      maxWidthDelta: rounded(maxWidthDelta),
      maxTopDelta: rounded(maxTopDelta),
    };
  } finally {
    await context.close();
  }
}

async function failureStabilityProof(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'dark' });
  const page = await context.newPage();
  page.setDefaultTimeout(7_000);
  const targetId = 'mosaic-outdoors';

  await page.route('**/visual-archive/thumbs/photo-004-thumb.webp', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.abort('failed');
  });

  try {
    const settledAfterFrames = await waitForFixture(page);
    const before = await cardRect(page, targetId);
    assert.equal(before.mediaDeclared, true, 'Failure fixture did not start as a structural media card');

    await page.waitForFunction((id) => {
      const card = document.querySelector(`[data-frontier-fluid-card="${CSS.escape(id)}"]`);
      return card?.getAttribute('data-frontier-media-unavailable') === 'true';
    }, targetId, { polling: 'raf', timeout: 6_000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const after = await cardRect(page, targetId);
    assert.equal(after.unavailable, true, 'Failed media did not expose the diagnostic state');
    assert.equal(after.mediaDeclared, true, 'Runtime failure structurally demoted the media card');
    assert(Math.abs(after.height - before.height) <= 1.25, `Failed media changed card height by ${Math.abs(after.height - before.height)}px`);
    assert(Math.abs(after.width - before.width) <= 1.25, `Failed media changed card width by ${Math.abs(after.width - before.width)}px`);
    assert(Math.abs(after.top - before.top) <= 1.25, `Failed media changed card position by ${Math.abs(after.top - before.top)}px`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-media-paint-failure-stable.png'), fullPage: true });
    return { passed: true, settledAfterFrames, targetId, before, after };
  } finally {
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const normal = await normalPaintProof(browser);
    const failure = await failureStabilityProof(browser);
    const result = { passed: normal.passed && failure.passed, auditUrl: AUDIT_URL, normal, failure };
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    console.log('FRONTIER actual media paint PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  if (!fs.existsSync(RESULT_PATH)) {
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`);
  }
  console.error(error);
  process.exitCode = 1;
});