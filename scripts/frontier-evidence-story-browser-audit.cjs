/* eslint-disable no-console */
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { chromium } = require('playwright');

const TARGET = process.env.FRONTIER_EVIDENCE_STORY_AUDIT_URL || 'http://127.0.0.1:3000/frontier/evidence-audit';
const OUT = 'artifacts/frontier/evidence-story';

async function view(browser, width, height) {
  const page = await browser.newPage({
    viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-frontier-story="verified"]').waitFor({ timeout: 12_000 });
  await page.getByRole('heading', { name: 'Synthetic evidence reader layout test' }).waitFor();
  assert.equal(await page.locator('[data-story-state="partial"]').count(), 1);
  assert.equal(await page.getByText(/NOT EXPERIMENTAL EVIDENCE/).count(), 1);
  assert.equal(await page.getByRole('img', { name: /synthetic visual test pattern/i }).count(), 1);
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-frontier-story] img');
    return image && image.complete && image.naturalWidth > 0;
  }, { timeout: 10_000 });
  const img = page.locator('[data-frontier-story] img');
  assert.equal(new URL(await img.getAttribute('src'), TARGET).pathname, '/api/frontier/evidence-audit-image/a');
  const source = page.getByRole('link', { name: /Inspect at publisher/ });
  assert.match(await source.getAttribute('href'), /#figure-one$/);
  assert.equal(await page.getByRole('button', { name: 'Next original figure' }).count(), 1);
  await page.getByRole('button', { name: 'Next original figure' }).click();
  await page.getByText(/Figure two: A second synthetic schematic/).waitFor();
  assert.equal(new URL(await page.locator('[data-frontier-story] img').getAttribute('src'), TARGET).pathname,
    '/api/frontier/evidence-audit-image/b');
  assert.match(await source.getAttribute('href'), /#figure-two$/);
  await page.getByRole('button', { name: 'Magnify original figure' }).click();
  assert.equal(await page.getByRole('button', { name: 'Fit original figure to stage' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Fit original figure to stage' }).click();
  await page.getByRole('button', { name: 'Previous original figure' }).click();
  await page.getByText(/Figure one: A source-shaped synthetic schematic/).waitFor();

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    titleSize: Number.parseFloat(getComputedStyle(document.querySelector('[data-frontier-story] h1')).fontSize),
    offenders: Array.from(document.querySelectorAll('[data-frontier-story] *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName.toLowerCase(),
          cls: typeof element.className === 'string' ? element.className.slice(0, 110) : '',
          left: Math.round(rect.left), right: Math.round(rect.right),
          scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        };
      })
      .filter((entry) => entry.left < -2 || entry.right > window.innerWidth + 2)
      .slice(0, 15),
  }));
  assert(geometry.scrollWidth <= geometry.viewport + 2, 'Unexpected horizontal overflow: ' + JSON.stringify(geometry));
  assert(geometry.titleSize <= 43, 'Oversized article title in reader');
  assert.deepEqual(errors, [], 'No client exceptions during interactive figure inspection');
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({ path: OUT + '/story-' + width + '.png', fullPage: true });

  await page.close();
  return { width, captionSwitch: true, originalSourceAnchors: true, noOverflow: true };
}

async function missingAsset(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/api/frontier/evidence-audit-image/b', async (route) => route.abort());
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Next original figure' }).click();
  await page.getByRole('status').filter({ hasText: 'Original figure unavailable' }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Inspect at publisher/ }).count(), 1);
  assert.match(await page.getByRole('link', { name: /Inspect at publisher/ }).getAttribute('href'), /#figure-two$/);
  await page.close();
  return { failedAsset: true, sourceStillAvailable: true };
}

async function privateStoryBoundaries(browser) {
  const page = await browser.newPage();
  const origin = new URL(TARGET).origin;
  const unknownStory = await page.request.get(origin + '/frontier/story/not-a-published-article');
  assert.equal(unknownStory.status(), 404, 'Unknown public story must not display a synthetic fallback');
  const missingAsset = await page.request.get(origin + '/api/frontier/story-assets/not-a-published-article/' + 'a'.repeat(64));
  assert.equal(missingAsset.status(), 404, 'Private image gateway must not return unknown bytes');
  const traversal = await page.request.get(origin + '/api/frontier/story-assets/%2E%2E/' + 'b'.repeat(64));
  assert.notEqual(traversal.status(), 200, 'Encoded directory traversal must never expose an image');
  await page.close();
  return { unknownStory404: true, unknownAsset404: true, traversalRefused: true };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const [width, height] of [[1440, 1000], [390, 844], [320, 760]]) {
      results.push(await view(browser, width, height));
    }
    results.push(await missingAsset(browser));
    results.push(await privateStoryBoundaries(browser));
    console.log(JSON.stringify({ status: 'passed', results }));
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
