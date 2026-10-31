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
    assert((await page.locator('figure img').count()) <= 1, 'Only the current source image is mounted');
    assert.equal(await page.locator('canvas').count(), 0, 'Default reader must not initialize WebGL/canvas');
    assert.equal(feedRequests.length, 0, 'Initial navigation must use server snapshot, not passive live discovery');

    const next = page.getByRole('button', { name: 'Next article' });
    // Nav labels differ visually across sizes; use the stable accessible name.
    const nextButton = page.getByRole('button', { name: 'Next' });
    assert(await nextButton.isEnabled(), 'Daily edition should contain multiple navigable articles');
    await nextButton.click();
    await page.waitForFunction((prior) => document.querySelector('article h1')?.textContent !== prior, heading);
    assert.equal(await page.locator('article').count(), 1, 'Navigation must replace, not append, articles');
    const back = page.getByRole('button', { name: 'Previous article' });
    await back.click();
    assert.equal(await page.locator('article h1').first().textContent(), heading);

    const rating = page.getByRole('button', { name: /Hold to rate interest/i });
    await rating.hover();
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await page.getByRole('status').getByText(/Saved [0-9]+\/10/).waitFor({ timeout: 3000 });
    assert.match((await rating.textContent()) || '', /\/10/, 'Explicit rating must persist in interface');

    const exact = page.locator('details').filter({ hasText: 'Set exact score' });
    await exact.locator('summary').click();
    await exact.locator('input[type="range"]').fill('9');
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
  console.log('FRONTIER focus reader audit:', JSON.stringify(results));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
