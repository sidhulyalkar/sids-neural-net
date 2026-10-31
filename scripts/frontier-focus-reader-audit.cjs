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
    assert.equal(feedRequests.length, 0, 'Initial navigation must use server snapshot, not passive live discovery');

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
    assert.equal(await balloon.count(), 1, 'Exactly one interest balloon is mounted');
    assert.equal(await balloon.getAttribute('data-frontier-balloon'), 'idle');
    assert.equal(await page.locator('[aria-label="Source-grounded summary"]').count(), 1);
    assert((await page.locator('[aria-label="Source metrics"]').count()) <= 1,
      'No duplicate metric panel should be mounted');
    await rating.hover();
    await page.mouse.down();
    await page.waitForTimeout(650);
    assert.equal(await balloon.getAttribute('data-frontier-balloon'), 'inflating', 'Holding must inflate the balloon');
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
    assert.equal(await balloon.getAttribute('data-frontier-balloon'), 'rated', 'Balloon returns to saved state on release');
    if (width <= 390) {
      const geometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      }));
      assert(geometry.documentWidth <= geometry.viewportWidth + 2,
        'Mobile focus reader must not require sideways scrolling: ' + JSON.stringify(geometry));
    }

    const exact = page.locator('details').filter({ hasText: 'Set exact score' });
    await exact.locator('summary').click();
    await exact.locator('input[type="range"]').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await exact.getByRole('button', { name: 'Save' }).click();
    assert.match((await rating.textContent()) || '', /9\/10/, 'Slider fallback must save exact score');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('article h1').first().waitFor();
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Hold to rate"]')?.textContent?.includes('9/10'), undefined, { timeout: 4000 });
    assert.deepEqual(errors, [], 'No browser JavaScript exceptions allowed');
    return { width, height, firstPaintMs, initialApiRequests: 0, singleArticle: true, ratingPersisted: true };
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
  console.log('FRONTIER focus reader audit:', JSON.stringify(results));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
