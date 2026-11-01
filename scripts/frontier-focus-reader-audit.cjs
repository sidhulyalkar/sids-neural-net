const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const TARGET = process.env.FRONTIER_FOCUS_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const FIRST_PAINT_BUDGET_MS = 9000;

async function audit(width, height) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  const errors = [];
  const feedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/frontier/feed')) feedRequests.push(request.url());
  });
  // Freeze the optional background updater for first-paint and rating tests.
  // auditBackgroundLatest explicitly exercises the positive update path below.
  await page.route('**/api/frontier/feed?latest=1', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'X-Frontier-Live': 'snapshot-fallback' },
    body: JSON.stringify({ generatedAt: new Date().toISOString(), items: [], sources: [] }),
  }));
  const t0 = Date.now();
  try {
    const response = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: FIRST_PAINT_BUDGET_MS });
    assert(response?.ok(), 'Focused reader route must serve HTTP 200');
    await page.locator('section[aria-label="Frontier focused reader"]').waitFor({ timeout: FIRST_PAINT_BUDGET_MS });
    await page.locator('article h1').first().waitFor({ timeout: FIRST_PAINT_BUDGET_MS });
    const firstPaintMs = Date.now() - t0;
    assert(firstPaintMs <= FIRST_PAINT_BUDGET_MS, 'First readable story exceeded budget');
    const heading = await page.locator('article h1').first().textContent();
    assert(heading?.trim(), 'The first article must have a real title on initial navigation');
    assert.equal(await page.locator('article').count(), 1, 'Never mount a whole off-screen feed');
    assert((await page.locator('figure img').count()) <= 1, 'Figure tabs cannot mount every source image');
    assert((await page.locator('figure img').count()) <= 1, 'Only the current source image is mounted');
    assert.equal(await page.locator('canvas').count(), 0, 'Default reader must not initialize WebGL/canvas');
    const uncachedRequests = feedRequests.filter((url) => !url.includes('latest=1'));
    assert.equal(uncachedRequests.length, 0,
      'Initial navigation must use the server snapshot, never the expensive live-search graph');
    assert(feedRequests.filter((url) => url.includes('latest=1')).length <= 1,
      'An old snapshot may trigger at most one nonblocking cached-latest lookup');

    // Nav labels differ visually across sizes; use the stable accessible name.
    const nextButton = page.locator('[data-frontier-next="true"]');
    assert((await nextButton.textContent())?.trim() === 'Next', 'Snapshot should include multiple articles, got: ' + (await nextButton.textContent()));
    assert(await nextButton.isEnabled(), 'Daily edition should contain multiple navigable articles');
    await nextButton.click();
    await page.waitForFunction((prior) => document.querySelector('article h1')?.textContent !== prior, heading);
    assert.equal(await page.locator('article').count(), 1, 'Navigation must replace, not append, articles');
    const back = page.locator('[data-frontier-previous="true"]');
    await back.click();
    assert.equal(await page.locator('article h1').first().textContent(), heading);

    const rating = page.getByRole('button', { name: /Hold to rate interest/i });
    const balloon = page.locator('[data-frontier-balloon]');
    assert.equal(await balloon.count(), 1, 'Exactly one radial interest control is mounted');
    assert.equal(await page.locator('footer').count(), 0, 'Reader must not render a bulky bottom navigation footer');
    assert.equal(await page.getByText('A quiet space for what is new').count(), 0, 'Remove redundant brand tagline');
    assert.equal(await page.locator('article h1').count(), 1, 'Headline appears once, centered before the media');
    const navigationArea = page.locator('nav[aria-label="Article navigation"]');
    assert.equal(await navigationArea.count(), 1, 'Use an edge navigation overlay');
    const image = page.locator('figure img').first();
    if (await image.count()) {
      const sizing = await image.evaluate((el) => ({ fit: getComputedStyle(el).objectFit,
        naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight }));
      assert.equal(sizing.fit, 'contain', 'Never crop article photos to fill an arbitrary frame');
    }
    assert.equal(await balloon.getAttribute('data-frontier-balloon'), 'idle');
    assert.equal(await page.locator('[aria-label="Source-grounded summary"]').count(), 1);
    assert((await page.locator('[aria-label="Source metrics"]').count()) <= 1,
      'No duplicate metric panel should be mounted');
    await rating.hover();
    await page.mouse.down();
    await page.waitForTimeout(650);
    assert.equal(await balloon.getAttribute('data-frontier-balloon'), 'inflating', 'Holding must animate the radial interest meter');
    await page.mouse.up();
    await page.waitForFunction(() => {
      const text = document.querySelector('button[aria-label^="Hold to rate"]')?.textContent || '';
      return /[1-9]\/10/.test(text) || /10\/10/.test(text);
    }, null, { timeout: 5000 }).catch(async (error) => {
      const diagnostics = await page.evaluate(() => ({
        rating: document.querySelector('button[aria-label^="Hold to rate"]')?.textContent,
        status: document.querySelector('[role="status"]')?.textContent,
        active: document.activeElement?.tagName,
      }));
      throw new Error('Hold interaction did not save a score: ' + JSON.stringify(diagnostics) + '; ' + error.message);
    });
    assert.match((await rating.textContent()) || '', /\/10/, 'Explicit rating must persist in interface');
    assert.equal(await balloon.getAttribute('data-frontier-balloon'), 'rated', 'Radial interest meter returns to saved state on release');
    if (width <= 390) {
      const geometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      }));
      assert(geometry.documentWidth <= geometry.viewportWidth + 2,
        'Mobile focus reader must not require sideways scrolling: ' + JSON.stringify(geometry));
    }

    const exact = page.locator('details').filter({ hasText: 'Choose exact score' });
    await exact.locator('summary').click();
    await exact.locator('input[type="range"]').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await exact.getByRole('button', { name: 'Save' }).click();
    assert.match((await rating.textContent()) || '', /9\/10/, 'Slider fallback must save exact score');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('article h1').first().waitFor();
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Hold to rate"]')?.textContent?.includes('9/10'), undefined, { timeout: 4000 });
    await page.waitForTimeout(1_200);
    const candidateLookups = feedRequests.filter((url) => url.includes('candidates=1'));
    assert.equal(candidateLookups.length, 1,
      'Returning reader should load the wider public snapshot once, after first paint');
    const beforeRevision = await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state);
    const finalRating = page.locator('details').filter({ hasText: 'Choose exact score' });
    await finalRating.locator('summary').click();
    await finalRating.locator('input[type="range"]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await finalRating.getByRole('button', { name: 'Save' }).click();
    assert.match((await rating.textContent()) || '', /2\/10/, 'Rating revision must replace the previous value');
    const afterRevision = await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state);
    assert.equal(afterRevision.profile.meaningfulInteractions, beforeRevision.profile.meaningfulInteractions,
      'Revising a rating cannot add another learned interaction');
    assert.equal(afterRevision.game.xp, beforeRevision.game.xp,
      'Revising a rating cannot award the same item XP again');
    const updated = Object.values(afterRevision.history).find((entry) => entry.item.title === heading && entry.interestScore === 2);
    assert.equal(updated?.reaction, 'down', 'The numeric revision must replace the canonical coarse preference');
    assert.deepEqual(errors, [], 'No browser JavaScript exceptions allowed');
    return { width, height, firstPaintMs, initialUncachedRequests: 0,
      backgroundCachedRequests: feedRequests.filter((url) => url.includes('latest=1')).length,
      singleArticle: true, ratingPersisted: true, revisionReplacedVote: true, widerCandidateLookups: 1 };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function auditBackgroundLatest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 700 }, reducedMotion: 'reduce' });
  try {
    const base = new URL(TARGET);
    const snapshotResponse = await page.request.get(base.origin + '/api/frontier/feed');
    assert(snapshotResponse.ok(), 'Snapshot fixture must be available for cached edition test');
    const snapshot = await snapshotResponse.json();
    if (Date.now() - Date.parse(snapshot.generatedAt) <= 30 * 60_000) {
      return { skipped: true, reason: 'Snapshot is still fresh: background update correctly not required' };
    }
    assert(snapshot.items.length > 2, 'Needs at least three credible source fixtures');
    const updatedAt = new Date().toISOString();
    const newItem = {
      ...snapshot.items[0],
      id: 'frontier-cache-audit-new-article',
      title: 'Newly discovered article from verified source',
      publishedAt: updatedAt,
      url: 'https://github.com/allenai/olmo',
      sourceKind: 'github',
      source: 'github.com',
      sourceLabel: 'GitHub',
    };
    let hits = 0;
    await page.route('**/api/frontier/feed?latest=1', async (route) => {
      hits += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Frontier-Live': 'cached-latest' },
        body: JSON.stringify({
          generatedAt: updatedAt,
          items: [newItem, ...snapshot.items.slice(0, 30)],
          sources: snapshot.sources,
        }),
      });
    });
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
    await page.locator('article h1').waitFor();
    const initial = await page.locator('article h1').textContent();
    await page.locator('[data-frontier-next="true"]').click();
    await page.locator('[data-frontier-previous="true"]').click();
    await page.getByRole('button', { name: 'Open latest discovered articles' }).waitFor({ timeout: 8000 });
    assert.equal(await page.locator('article h1').textContent(), initial,
      'Background revalidation may not replace an article after interaction');
    assert.equal(hits, 1, 'At most one cache lookup per visit; no polling');
    await page.getByRole('button', { name: 'Open latest discovered articles' }).click();
    assert.equal(await page.locator('section[data-frontier-edition-at]').getAttribute('data-frontier-edition-at'), updatedAt,
      'Applying cached edition must update provenance timestamp');
    assert.equal(await page.locator('article').count(), 1, 'Cached edition must still mount one article');
    const viewport = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
    assert(viewport.documentWidth <= viewport.viewportWidth + 2,
      'Latest-ready controls must fit narrow mobile layout: ' + JSON.stringify(viewport));
    return { cachedLatestLookups: hits, preservesActiveArticle: true, appliesOnRequest: true };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function main() {
  const results = [];
  results.push(await audit(1440, 900));
  results.push(await audit(390, 844));
  results.push(await audit(320, 700));
  results.push(await auditBackgroundLatest());
  console.log('FRONTIER focus reader audit:', JSON.stringify(results));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
