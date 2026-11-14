/* eslint-disable no-console */
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
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
  const chapters = page.getByRole('group', { name: 'Research chapters' });
  const sectionMap = page.getByRole('region', { name: 'Original publication outline' });
  assert.equal(await sectionMap.count(), 1, 'A source with actual section headings should render the publication map');
  assert.equal(await sectionMap.getByRole('link', { name: /1 Introduction/ }).count(), 1);
  await chapters.getByRole('button', { name: /Evidence/ }).click();
  await page.locator('[data-selected-source-chapter="results"]').waitFor();
  await page.getByRole('link', { name: /3 Results/ }).waitFor();
  assert.equal(new URL(await page.locator('[data-frontier-story] img').getAttribute('src'), TARGET).pathname,
    '/api/frontier/evidence-audit-image/b',
    'Choosing a real results section selects a source figure within that section');
  await chapters.getByRole('button', { name: /Methods/ }).click();
  await page.locator('[data-selected-source-chapter="methods"]').waitFor();
  await page.getByRole('link', { name: /2 Experiment Design/ }).waitFor();
  assert.equal(new URL(await page.locator('[data-frontier-story] img').getAttribute('src'), TARGET).pathname,
    '/api/frontier/evidence-audit-image/a',
    'Choosing source methods selects an associated source figure without generating new media');
  await chapters.getByRole('button', { name: /Limitations/ }).click();
  await page.locator('[data-selected-source-chapter="limitations"]').waitFor();
  await page.getByRole('heading', { name: 'No figure linked to this chapter' }).waitFor();
  assert.equal(await page.locator('[data-frontier-story] img').count(), 0,
    'An unillustrated chapter must not display a figure from another section');
  await page.getByRole('link', { name: 'Open original section' }).waitFor();
  await chapters.getByRole('button', { name: /Methods/ }).click();
  await page.locator('[data-frontier-story] img').waitFor();

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
  return { width, captionSwitch: true, originalSourceAnchors: true, sourceOutline: true, noOverflow: true };
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

function buildPrivateBundleFixture() {
  const id = 'qa-original-evidence';
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-reader-e2e-'));
  const publish = path.resolve('content/frontier/stories', id);
  if (fs.existsSync(publish)) throw new Error('Refusing to overwrite existing published story test identity');
  const fixturePng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOIq8v+DwAEzAJHvkJtgQAAAABJRU5ErkJggg==', 'base64');
  const assetRoot = path.join(work, 'reviewed');
  fs.mkdirSync(assetRoot);
  fs.writeFileSync(path.join(assetRoot, 'approved.png'), fixturePng);
  const caption = 'Figure 1: Synthetic demonstration of a source figure and its explanatory caption.';
  const approvalFile = path.join(work, 'approvals.json');
  fs.writeFileSync(approvalFile, JSON.stringify([{
    sourceUrl: 'https://arxiv.org/html/2611.17323v1#S1.F1',
    imageUrl: 'https://arxiv.org/html/2611.17323v1/x1.png',
    captionSha256: createHash('sha256').update(caption).digest('hex'),
    file: 'approved.png',
    rights: { display: 'permitted', license: 'Synthetic test fixture',
      attribution: 'CI-only synthetic diagram, not actual research' },
  }]));
  const bundle = path.join(work, 'bundle');
  const at = '2026-11-14T19:13:13.373Z';
  try {
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/frontier/build-arxiv-story.ts',
      '--paper-id', '2611.17323v1',
      '--item-id', id,
      '--html', 'tests/fixtures/frontier/arxiv-synthetic-structure.html',
      '--observed-at', at, '--built-at', at,
      '--out', bundle, '--approvals', approvalFile, '--asset-root', assetRoot,
    ], { encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(result.status, 0, 'Source bundle builder failed: ' + result.stderr);
    fs.mkdirSync(path.dirname(publish), { recursive: true });
    fs.cpSync(bundle, publish, { recursive: true, force: false, errorOnExist: true });
    return { id, publishedPath: publish, workDir: work,
      imageDigest: createHash('sha256').update(fixturePng).digest('hex'), bytes: fixturePng };
  } catch (error) {
    fs.rmSync(publish, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
    throw error;
  }
}

async function auditedPrivateBundle(browser, fixture) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const origin = new URL(TARGET).origin;
  try {
    const route = origin + '/frontier/story/' + fixture.id;
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, 'Reviewed private bundle must load through the opt-in story route');
    await page.locator('[data-frontier-story="verified"]').waitFor();
    await page.getByText(/Figure 1: Synthetic demonstration/).waitFor();
    const image = page.locator('[data-frontier-story] img');
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-frontier-story] img');
      return img && img.complete && img.naturalWidth > 0;
    });
    const imageSrc = new URL(await image.getAttribute('src'), origin);
    assert.equal(imageSrc.pathname,
      '/api/frontier/story-assets/' + fixture.id + '/' + fixture.imageDigest);
    const original = page.getByRole('link', { name: /Inspect at publisher/ });
    assert.equal(await original.getAttribute('href'), 'https://arxiv.org/html/2611.17323v1#S1.F1');
    const served = await page.request.get(imageSrc.href);
    assert.equal(served.status(), 200);
    assert.match(served.headers()['content-type'] || '', /^image\/png/);
    assert.deepEqual(await served.body(), fixture.bytes);
    const imagePath = path.join(fixture.publishedPath, 'assets', fixture.imageDigest + '.png');
    const tampered = Buffer.from(fixture.bytes);
    tampered[tampered.length - 1] ^= 1;
    fs.writeFileSync(imagePath, tampered);
    const tamperedReply = await page.request.get(imageSrc.href + '?tampered=1');
    assert.equal(tamperedReply.status(), 503, 'Hash-mismatched published asset must not be exposed');
    return { privateBundleLoaded: true, citationIntact: true, approvedBytesVerified: true,
      tamperedHashRefused: true };
  } finally {
    await page.close();
  }
}

async function privateStoryBoundaries(browser) {
  const page = await browser.newPage();
  const origin = new URL(TARGET).origin;
  const unknownStory = await page.goto(origin + '/frontier/story/not-a-published-article', {
    waitUntil: 'domcontentloaded',
  });
  // Next.js App Router can send HTTP 200 for a streamed notFound() boundary.
  // Check the actual security property: no verified evidence is rendered and
  // the streamed-not-found response is explicitly removed from search indices.
  assert([200, 404].includes(unknownStory?.status()),
    'Unknown story must return a normal not-found response or streamed boundary');
  assert.equal(await page.locator('[data-frontier-story="verified"]').count(), 0,
    'Unknown public story must never render approved story content');
  assert.equal(await page.locator('meta[name="robots"][content*="noindex"]').count() > 0, true,
    'Unknown story must have a noindex not-found response');
  const missingAsset = await page.request.get(origin + '/api/frontier/story-assets/not-a-published-article/' + 'a'.repeat(64));
  assert.equal(missingAsset.status(), 404, 'Private image gateway must not return unknown bytes');
  const traversal = await page.request.get(origin + '/api/frontier/story-assets/%2E%2E/' + 'b'.repeat(64));
  assert.notEqual(traversal.status(), 200, 'Encoded directory traversal must never expose an image');
  await page.close();
  return { unknownStory404: true, unknownAsset404: true, traversalRefused: true };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const fixture = buildPrivateBundleFixture();
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    results.push(await auditedPrivateBundle(browser, fixture));
    for (const [width, height] of [[1440, 1000], [390, 844], [320, 760]]) {
      results.push(await view(browser, width, height));
    }
    results.push(await missingAsset(browser));
    results.push(await privateStoryBoundaries(browser));
    console.log(JSON.stringify({ status: 'passed', results }));
  } finally {
    await browser.close();
    fs.rmSync(fixture.publishedPath, { recursive: true, force: true });
    fs.rmSync(fixture.workDir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
