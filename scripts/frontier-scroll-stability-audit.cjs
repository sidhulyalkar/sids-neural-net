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
  await page.waitForFunction(
    ({ rootSelector, cardSelector, expected }) => {
      const visibleRoots = Array.from(document.querySelectorAll(rootSelector)).filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      return visibleRoots.length === 1 && document.querySelectorAll(cardSelector).length === expected;
    },
    { rootSelector: ROOT, cardSelector: CARD, expected: EXPECTED_CARDS },
    { polling: 'raf', timeout: 5_000 },
  );
  await page.evaluate(async () => {
    // The public site intentionally uses smooth anchor navigation. A geometry
    // stress test needs requested scroll offsets to be synchronous so motion
    // toward a target is never misclassified as spontaneous layout drift.
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function waitForLockedGeometry(page) {
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelectorAll(`${selector}[data-frontier-geometry="locked"]`).length === expected,
    { selector: CARD, expected: EXPECTED_CARDS },
    { polling: 'raf', timeout: 5_000 },
  );

  return page.evaluate(({ selector, expected }) => new Promise((resolve, reject) => {
    let previous = '';
    let stableFrames = 0;
    let frames = 0;
    const tick = () => {
      frames += 1;
      const cards = Array.from(document.querySelectorAll(selector));
      if (cards.length !== expected || cards.some((node) => node.getAttribute('data-frontier-geometry') !== 'locked')) {
        stableFrames = 0;
        previous = '';
      } else {
        const scroller = document.scrollingElement || document.documentElement;
        const signature = [
          scroller.scrollHeight,
          ...cards.flatMap((node) => {
            const rect = node.getBoundingClientRect();
            return [rect.x, rect.y + window.scrollY, rect.width, rect.height].map((value) => Math.round(value * 4) / 4);
          }),
        ].join(':');
        stableFrames = signature === previous ? stableFrames + 1 : 0;
        previous = signature;
        if (stableFrames >= 4) {
          resolve(frames);
          return;
        }
      }
      if (frames > 180) {
        reject(new Error('Locked FRONTIER geometry did not settle within 180 animation frames'));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { selector: CARD, expected: EXPECTED_CARDS });
}

async function sweep(page) {
  return page.evaluate(async (selector) => {
    const twoFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const scroller = document.scrollingElement || document.documentElement;
    const step = Math.max(240, Math.floor(window.innerHeight * 0.72));
    const maxScrollFor = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    let maxDrift = 0;
    let samples = 0;
    let minDocumentHeight = scroller.scrollHeight;
    let maxDocumentHeight = minDocumentHeight;

    const settleAt = async (requested) => {
      const target = Math.max(0, Math.min(maxScrollFor(), requested));
      window.scrollTo({ top: target, left: 0, behavior: 'auto' });
      await twoFrames();
      maxDrift = Math.max(maxDrift, Math.abs(window.scrollY - target));
      samples += 1;
      minDocumentHeight = Math.min(minDocumentHeight, scroller.scrollHeight);
      maxDocumentHeight = Math.max(maxDocumentHeight, scroller.scrollHeight);
    };

    let guard = 0;
    let maxScroll = maxScrollFor();
    for (let y = 0; y < maxScroll && guard < 96; y += step, guard += 1) {
      await settleAt(y);
      maxScroll = maxScrollFor();
    }
    await settleAt(maxScroll);

    guard = 0;
    maxScroll = maxScrollFor();
    for (let y = maxScroll; y > 0 && guard < 96; y -= step, guard += 1) await settleAt(y);
    await settleAt(0);
    await twoFrames();

    return {
      maxScrollDrift: maxDrift,
      samples,
      lockedCards: document.querySelectorAll(`${selector}[data-frontier-geometry="locked"]`).length,
      documentHeight: scroller.scrollHeight,
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
      // Do not request historical buffered entries. The lock-in phase is a
      // pre-interaction measurement pass; this observer measures only layout
      // shifts caused after compact geometry is authoritative.
      observer.observe({ type: 'layout-shift' });
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
    const grid = cards[0]?.parentElement;
    if (!(grid instanceof HTMLElement)) throw new Error('Missing deterministic masonry grid');

    const presentationFor = (node) => {
      const candidate = node.querySelector('[data-frontier-visual-role]');
      return candidate instanceof HTMLElement ? candidate : null;
    };

    const cardGeometry = cards.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const presentation = presentationFor(node);
      return {
        id: node.getAttribute('data-frontier-fluid-card') || '',
        role: presentation?.getAttribute('data-frontier-visual-role') || '',
        hasMedia: presentation?.getAttribute('data-frontier-has-media') === 'true',
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
      .filter((node) => presentationFor(node)?.getAttribute('data-frontier-has-media') === 'true')
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
      documentHeight: (document.scrollingElement || document.documentElement).scrollHeight,
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

function validateViewport(name, before, after, warm, warmShift, repeat, repeatShift, stability) {
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
  check(warm.maxScrollDrift <= 2, `${name}: first post-lock sweep drifted ${rounded(warm.maxScrollDrift)}px from requested offsets`);
  check(warm.documentHeightRange <= 2, `${name}: document height changed by ${rounded(warm.documentHeightRange)}px during the first post-lock sweep`);
  check(warmShift.score <= 0.01, `${name}: first post-lock sweep layout-shift score regressed to ${rounded(warmShift.score)}`);
  check(repeat.maxScrollDrift <= 2, `${name}: repeat scroll position drifted ${rounded(repeat.maxScrollDrift)}px without an explicit scroll command`);
  check(repeat.documentHeightRange <= 2, `${name}: document height changed by ${rounded(repeat.documentHeightRange)}px during the repeat sweep`);
  check(repeatShift.score <= 0.01, `${name}: repeat sweep layout-shift score regressed to ${rounded(repeatShift.score)}`);
  return failures;
}

async function runViewport(browser, name, viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6_000);

  try {
    await waitForFixture(page);
    const lockStableFrames = await waitForLockedGeometry(page);

    await installShiftObserver(page);
    const warm = await sweep(page);
    const warmShift = await readShiftObserver(page);
    const before = await snapshot(page);

    await installShiftObserver(page);
    const repeat = await sweep(page);
    const repeatShift = await readShiftObserver(page);
    const after = await snapshot(page);
    const stability = compareSnapshots(before, after);
    const failures = validateViewport(name, before, after, warm, warmShift, repeat, repeatShift, stability);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `frontier-scroll-stability-${name}${failures.length ? '-failure' : ''}.png`),
      fullPage: true,
    });

    return {
      passed: failures.length === 0,
      viewport,
      lockStableFrames,
      warm: roundObject(warm),
      warmShift: { score: rounded(warmShift.score), entries: warmShift.entries },
      repeat: roundObject(repeat),
      repeatShift: { score: rounded(repeatShift.score), entries: repeatShift.entries },
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
        lockStableFrames: desktop.lockStableFrames,
        stability: desktop.stability,
        warmShift: desktop.warmShift,
        repeatShift: desktop.repeatShift,
        warm: desktop.warm,
        repeat: desktop.repeat,
      },
      mobile: {
        lockStableFrames: mobile.lockStableFrames,
        stability: mobile.stability,
        warmShift: mobile.warmShift,
        repeatShift: mobile.repeatShift,
        warm: mobile.warm,
        repeat: mobile.repeat,
      },
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  if (!fs.existsSync(RESULT_PATH)) {
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`);
  }
  console.error(error);
  process.exitCode = 1;
});
