const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_SCROLL_AUDIT_URL || 'http://127.0.0.1:3000/frontier/mosaic-audit';
const ROOT = '[data-frontier-mosaic-audit="true"]';
const CARD = '[data-frontier-fluid-card]';
const EXPECTED_CARDS = 12;
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const RESULT_PATH = path.join(ARTIFACT_DIR, 'frontier-scroll-stability.json');

function rounded(value) {
  return Number(value.toFixed(3));
}

function roundObject(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, typeof value === 'number' ? rounded(value) : value]));
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
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function sweep(page) {
  return page.evaluate(async (selector) => {
    const twoFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const step = Math.max(240, Math.floor(window.innerHeight * 0.72));
    let maxDrift = 0;
    let samples = 0;
    let minDocumentHeight = document.documentElement.scrollHeight;
    let maxDocumentHeight = minDocumentHeight;

    const settleAt = async (requested) => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.max(0, Math.min(maxScroll, requested));
      window.scrollTo(0, target);
      await twoFrames();
      maxDrift = Math.max(maxDrift, Math.abs(window.scrollY - target));
      samples += 1;
      minDocumentHeight = Math.min(minDocumentHeight, document.documentElement.scrollHeight);
      maxDocumentHeight = Math.max(maxDocumentHeight, document.documentElement.scrollHeight);
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
      documentHeightRange: maxDocumentHeight - minDocumentHeight,
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
      // LayoutShift is supplemental. DOM geometry comparisons remain the gate.
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
    const gridItem = cards[0]?.closest('[data-frontier-visual-role]');
    const grid = gridItem?.parentElement;
    if (!(grid instanceof HTMLElement)) throw new Error('Missing deterministic masonry grid');

    const cardGeometry = cards.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const wrapper = node.closest('[data-frontier-visual-role]');
      return {
        id: node.getAttribute('data-frontier-fluid-card') || '',
        role: wrapper?.getAttribute('data-frontier-visual-role') || '',
        hasMedia: wrapper?.getAttribute('data-frontier-has-media') === 'true',
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
        lockedHeight: Number.parseFloat(node.getAttribute('data-frontier-geometry-height') || '0'),
        containIntrinsicSize: style.containIntrinsicSize,
        contentVisibility: style.contentVisibility,
        geometryState: node.getAttribute('data-frontier-geometry') || '',
      };
    });

    const media = cards
      .filter((node) => node.closest('[data-frontier-has-media="true"]'))
      .map((node) => {
        const target = node.querySelector('[role="img"], video, iframe, img');
        if (!(target instanceof HTMLElement)) {
          return {
            id: node.getAttribute('data-frontier-fluid-card') || '',
            missingTarget: true,
            width: 0,
            height: 0,
            aspect: 0,
            mediaState: null,
          };
        }
        const rect = target.getBoundingClientRect();
        return {
          id: node.getAttribute('data-frontier-fluid-card') || '',
          missingTarget: false,
          width: rect.width,
          height: rect.height,
          aspect: rect.width / Math.max(1, rect.height),
          mediaState: target.getAttribute('data-media-state'),
        };
      });

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      gridWidth: grid.getBoundingClientRect().width,
      overflowAnchor: getComputedStyle(grid).overflowAnchor,
      lockedCards: cards.filter((node) => node.getAttribute('data-frontier-geometry') === 'locked').length,
      cards: cardGeometry,
      media,
    };
  }, CARD);
}

function compareSnapshots(before, after) {
  const missingCards = [];
  const missingMedia = [];
  const afterById = new Map(after.cards.map((card) => [card.id, card]));
  let maxTopDelta = 0;
  let maxHeightDelta = 0;
  let maxWidthDelta = 0;
  let worstTopCard = '';
  let worstHeightCard = '';
  let worstWidthCard = '';

  for (const card of before.cards) {
    const next = afterById.get(card.id);
    if (!next) {
      missingCards.push(card.id);
      continue;
    }
    const topDelta = Math.abs(next.top - card.top);
    const heightDelta = Math.abs(next.height - card.height);
    const widthDelta = Math.abs(next.width - card.width);
    if (topDelta > maxTopDelta) { maxTopDelta = topDelta; worstTopCard = card.id; }
    if (heightDelta > maxHeightDelta) { maxHeightDelta = heightDelta; worstHeightCard = card.id; }
    if (widthDelta > maxWidthDelta) { maxWidthDelta = widthDelta; worstWidthCard = card.id; }
  }

  const afterMedia = new Map(after.media.map((entry) => [entry.id, entry]));
  let maxMediaHeightDelta = 0;
  let maxMediaAspectDelta = 0;
  let worstMediaHeightCard = '';
  let worstMediaAspectCard = '';
  for (const media of before.media) {
    const next = afterMedia.get(media.id);
    if (!next) {
      missingMedia.push(media.id);
      continue;
    }
    const heightDelta = Math.abs(next.height - media.height);
    const aspectDelta = Math.abs(next.aspect - media.aspect);
    if (heightDelta > maxMediaHeightDelta) { maxMediaHeightDelta = heightDelta; worstMediaHeightCard = media.id; }
    if (aspectDelta > maxMediaAspectDelta) { maxMediaAspectDelta = aspectDelta; worstMediaAspectCard = media.id; }
  }

  return {
    maxTopDelta,
    maxHeightDelta,
    maxWidthDelta,
    maxMediaHeightDelta,
    maxMediaAspectDelta,
    worstTopCard,
    worstHeightCard,
    worstWidthCard,
    worstMediaHeightCard,
    worstMediaAspectCard,
    missingCards,
    missingMedia,
  };
}

function validateViewport(name, before, after, repeat, shift, stability) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  check(before.lockedCards === EXPECTED_CARDS, `${name}: expected ${EXPECTED_CARDS} locked cards before repeat scrolling, saw ${before.lockedCards}`);
  check(after.lockedCards === EXPECTED_CARDS, `${name}: expected ${EXPECTED_CARDS} locked cards after reverse scrolling, saw ${after.lockedCards}`);
  check(before.overflowAnchor === 'none', `${name}: masonry overflow-anchor is ${before.overflowAnchor}, expected none`);
  check(before.media.length >= 8, `${name}: expected at least eight media boxes, saw ${before.media.length}`);
  check(before.media.every((entry) => !entry.missingTarget && entry.width > 10 && entry.height > 10), `${name}: one or more media cards did not reserve a concrete aspect box`);
  check(stability.missingCards.length === 0, `${name}: cards disappeared after bidirectional scroll: ${stability.missingCards.join(', ')}`);
  check(stability.missingMedia.length === 0, `${name}: media geometry disappeared after bidirectional scroll: ${stability.missingMedia.join(', ')}`);
  check(stability.maxTopDelta <= 1.25, `${name}: card document positions drifted ${rounded(stability.maxTopDelta)}px, worst=${stability.worstTopCard}`);
  check(stability.maxHeightDelta <= 1.25, `${name}: card heights drifted ${rounded(stability.maxHeightDelta)}px, worst=${stability.worstHeightCard}`);
  check(stability.maxWidthDelta <= 1.25, `${name}: card widths drifted ${rounded(stability.maxWidthDelta)}px, worst=${stability.worstWidthCard}`);
  check(stability.maxMediaHeightDelta <= 1.25, `${name}: media aspect boxes changed height by ${rounded(stability.maxMediaHeightDelta)}px, worst=${stability.worstMediaHeightCard}`);
  check(stability.maxMediaAspectDelta <= 0.01, `${name}: media aspect boxes changed ratio by ${rounded(stability.maxMediaAspectDelta)}, worst=${stability.worstMediaAspectCard}`);
  check(repeat.maxScrollDrift <= 2, `${name}: scroll position drifted ${rounded(repeat.maxScrollDrift)}px without an explicit scroll command`);
  check(repeat.documentHeightRange <= 2, `${name}: document height changed by ${rounded(repeat.documentHeightRange)}px during the post-warm sweep`);
  check(shift.score <= 0.01, `${name}: layout-shift score regressed to ${rounded(shift.score)}`);
  return failures;
}

async function runViewport(browser, name, viewport) {
  // A viewport owns a fresh browser context so desktop responsive state can
  // never contaminate the mobile proof and vice versa.
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6_000);

  try {
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
    const failures = validateViewport(name, before, after, repeat, shift, stability);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `frontier-scroll-stability-${name}${failures.length ? '-failure' : ''}.png`),
      fullPage: true,
    });

    return {
      passed: failures.length === 0,
      viewport,
      warm: roundObject(warm),
      repeat: roundObject(repeat),
      shift: { score: rounded(shift.score), entries: shift.entries },
      stability: roundObject(stability),
      failures,
      before,
      after,
    };
  } catch (error) {
    let forensic;
    try { forensic = await snapshot(page); } catch { forensic = undefined; }
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `frontier-scroll-stability-${name}-failure.png`), fullPage: true });
    } catch {}
    return {
      passed: false,
      viewport,
      error: error instanceof Error ? error.stack : String(error),
      forensic,
    };
  } finally {
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let result;
  try {
    const desktop = await runViewport(browser, 'desktop', { width: 1440, height: 1100 });
    const mobile = await runViewport(browser, 'mobile', { width: 390, height: 844 });
    result = {
      passed: desktop.passed && mobile.passed,
      auditUrl: AUDIT_URL,
      desktop,
      mobile,
    };
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    if (!result.passed) {
      const failures = [
        ...(desktop.failures || []),
        ...(mobile.failures || []),
        desktop.error,
        mobile.error,
      ].filter(Boolean);
      throw new Error(`FRONTIER deterministic scroll stability failed:\n${failures.join('\n')}`);
    }
    console.log('FRONTIER deterministic scroll stability PASS');
    console.log(JSON.stringify({
      passed: true,
      desktop: {
        stability: desktop.stability,
        shift: desktop.shift,
        repeat: desktop.repeat,
      },
      mobile: {
        stability: mobile.stability,
        shift: mobile.shift,
        repeat: mobile.repeat,
      },
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  // runViewport writes complete forensic data before this point. Preserve it.
  if (!fs.existsSync(RESULT_PATH)) {
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`);
  }
  console.error(error);
  process.exitCode = 1;
});
