import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!root) throw new Error('Set PLAYWRIGHT_MODULE_ROOT to the installed playwright package directory.');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const base = process.env.WORLD_BASE_URL || 'http://127.0.0.1:3000';
const output = process.env.WORLD_AUDIT_DIR || 'artifacts/world';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.WORLD_BROWSER_EXECUTABLE ? { executablePath: process.env.WORLD_BROWSER_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const results = [], errors = [];
let diagnostics;
async function screenshot(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`) }); }
async function waitForScene(page) {
  // A canvas element alone is insufficient evidence that the scene has rendered.
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.drawCalls) > 0);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await waitForScene(page); await screenshot(page, 'desktop-welcome');
  await page.getByRole('button', { name: 'Enter world', exact: true }).click();
  const before = await page.locator('canvas').getAttribute('data-player');
  await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
  await page.waitForFunction(old => document.querySelector('canvas')?.dataset.player !== old, before);
  results.push('Keyboard walking changes player position');
  for (const [name, prompt, title] of [
    ['01 Sequoia grove A little about me', 'A little about me', 'Hi, I’m Sid.'],
    ['02 Granite overlook Things I build', 'Things I build', 'Things I build.'],
    ['03 Strange grove Things I explore', 'Things I explore', 'Things I explore.'],
    ['04 Wild coast Life outside the screen', 'Life outside the screen', 'Outside the screen.'],
  ]) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: new RegExp(prompt) }).waitFor();
    await page.waitForTimeout(1800); // Allow the semantic camera transition to settle for visual review.
    await screenshot(page, `region-${name.slice(0, 2)}`);
    await page.getByRole('button', { name: new RegExp(prompt) }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    if (name.startsWith('02') || name.startsWith('03')) {
      const hrefs = await page.locator('dialog a[href^="/projects/"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert.equal(hrefs.length, 3);
      for (const href of hrefs) assert.equal((await page.request.get(`${base}${href}`)).status(), 200, href);
    }
    if (name.startsWith('04')) for (const memory of ['Higher ground', 'The last light', 'Along the coast']) {
      await page.getByRole('button', { name: new RegExp(memory) }).click();
      await page.getByRole('heading', { name: memory, exact: true }).waitFor();
      await page.waitForFunction(() => { const img = document.querySelector('dialog img'); return img?.complete && img.naturalWidth > 0; });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: new RegExp(prompt) }).click();
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
    results.push(`Landmark, discovery, and dismissal: ${name}`);
  }
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true); }
  await page.keyboard.press('Escape'); results.push('Menu keeps keyboard focus and supports Escape');
  diagnostics = await page.locator('canvas').evaluate(c => ({ ...c.dataset }));
  assert.ok(Number(diagnostics.drawCalls) < 100);
  assert.ok(Number(diagnostics.frameP50) > 0);
  assert.ok(Number(diagnostics.frameP95) >= Number(diagnostics.frameP50));
  assert.ok(Number(diagnostics.sampleFrames) > 0);
  assert.ok(Number(diagnostics.dpr) >= 0.75 && Number(diagnostics.dpr) <= 1.5);
  results.push('Bounded renderer diagnostics include active-frame percentiles');
  await page.locator('canvas').evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByText('The 3D world couldn’t open on this device.').waitFor();
  assert.equal(await page.getByRole('link', { name: 'View my work' }).count(), 1);
  results.push('Context loss preserves conventional navigation'); await page.close();

  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(base); await reduced.getByRole('button', { name: 'Open navigation menu' }).click();
  assert.equal(await reduced.locator('canvas').count(), 0);
  results.push('Reduced motion starts without WebGL'); await reduced.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base); await mobile.getByRole('button', { name: 'Open navigation menu' }).click();
  assert.equal(await mobile.locator('canvas').count(), 0); await screenshot(mobile, 'mobile-menu');
  await mobile.keyboard.press('Escape'); await screenshot(mobile, 'mobile-welcome');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.getByRole('button', { name: 'Enter world', exact: true }).click(); await waitForScene(mobile);
  await screenshot(mobile, 'mobile-world');
  const mobileBefore = await mobile.locator('canvas').getAttribute('data-player');
  await mobile.touchscreen.tap(195, 580);
  await mobile.waitForFunction(old => document.querySelector('canvas')?.dataset.player !== old, mobileBefore);
  results.push('Mobile opts into rendered 3D; touch walking works without overflow'); await mobile.close();
  const plain = await browser.newPage({ javaScriptEnabled: false }); await plain.goto(base);
  assert.ok(await plain.getByRole('navigation', { name: 'Browse without JavaScript' }).isVisible());
  results.push('No-JavaScript navigation is visible'); await plain.close();
  const atlas = await browser.newPage(); await atlas.goto(`${base}/atlas`);
  await atlas.locator('[data-home-branch-count="8"]').waitFor();
  results.push('Original eight-destination neural atlas remains available'); await atlas.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results, diagnostics, errors }, null, 2));
  console.log(JSON.stringify({ results, diagnostics, errors }, null, 2));
} finally { await browser.close(); }
