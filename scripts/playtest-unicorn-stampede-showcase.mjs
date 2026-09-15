import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.ARCADE_BROWSER_DIR || 'artifacts/arcade-browser-matrix';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  { name: 'chrome-stable', browserType: chromium, launchOptions: { channel: 'chrome' } },
  { name: 'chromium', browserType: chromium, launchOptions: {} },
  { name: 'firefox', browserType: firefox, launchOptions: {} },
  { name: 'webkit', browserType: webkit, launchOptions: {} },
];

const results = [];
let failed = false;

for (const { name, browserType, launchOptions } of engines) {
  let browser;
  const errors = [];
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(`host pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() < 400) return;
      const url = response.url();
      if (url.startsWith(baseUrl) && url.includes('/game-runtimes/unicorn-stampede/')) {
        errors.push(`runtime response ${response.status()}: ${url}`);
      }
    });

    const response = await page.goto(`${baseUrl}/arcade/unicorn-stampede`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`cabinet route returned ${response?.status() ?? 'no response'}`);

    const iframe = page.locator('iframe[title="Unicorn Stampede game runtime"]');
    await iframe.waitFor({ state: 'visible' });
    if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('same-origin showcase runtime should not be sandboxed');

    const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/unicorn-stampede/index.html'));
    if (!frame) throw new Error('showcase iframe did not attach to live-main runtime');
    await frame.locator('#game').waitFor({ state: 'visible' });
    await frame.waitForFunction(() => window.__SIDS_GAME_NETWORK_BRIDGE__ === true, null, { timeout: 5_000 });
    await frame.waitForFunction(() => typeof state !== 'undefined' && state === 'title');

    const contract = await frame.evaluate(() => ({
      title: document.title,
      width: document.querySelector('#game')?.width,
      height: document.querySelector('#game')?.height,
      settings: typeof showcaseSettings === 'object',
      stats: typeof showcaseRunStats === 'object',
      worldMotion: typeof showcaseCloudtopMotion === 'function' && typeof showcaseWashwaterMotion === 'function',
      controller: typeof showcasePollGamepad === 'function',
      shell: Boolean(document.querySelector('#showcase-status') && document.querySelector('#showcase-fullscreen')),
      titleRenderer: typeof title === 'function',
      zone,
    }));

    if (!/Unicorn Stampede.*Showcase/i.test(contract.title)) throw new Error(`showcase title stale: ${contract.title}`);
    if (contract.width !== 1280 || contract.height !== 720) throw new Error(`native canvas changed: ${contract.width}x${contract.height}`);
    if (!contract.settings || !contract.stats || !contract.worldMotion || !contract.controller || !contract.shell || !contract.titleRenderer) {
      throw new Error(`showcase module contract failed: ${JSON.stringify(contract)}`);
    }

    const canvas = frame.locator('#game');
    await canvas.focus();
    const activeId = await frame.evaluate(() => document.activeElement?.id);
    if (activeId !== 'game') throw new Error(`canvas focus bridge failed: ${activeId}`);

    await canvas.dblclick({ position: { x: 640, y: 585 }, delay: 20 });
    const nextZone = await frame.evaluate(() => zone);
    if (nextZone !== (contract.zone + 1) % 3) throw new Error(`double-click changed world incorrectly: ${contract.zone} -> ${nextZone}`);

    await page.keyboard.press('Enter');
    await frame.waitForFunction(() => state === 'play');
    const beforeX = await frame.evaluate(() => unis[caps[0]]?.x ?? 0);
    await page.keyboard.down('d');
    await page.waitForTimeout(260);
    await page.keyboard.up('d');
    await page.waitForTimeout(80);
    const afterX = await frame.evaluate(() => unis[caps[0]]?.x ?? 0);
    if (!(afterX > beforeX)) throw new Error(`focused WASD did not move active unicorn: ${beforeX} -> ${afterX}`);

    await page.screenshot({ path: path.join(outputDir, `${name}-unicorn-stampede-showcase.png`), fullPage: true });
    if (errors.length) throw new Error(errors.join('\n'));
    results.push({ engine: name, ok: true, runtimeUrl: frame.url(), contract, movement: [beforeX, afterX] });
  } catch (error) {
    failed = true;
    results.push({ engine: name, ok: false, error: error instanceof Error ? error.message : String(error), errors });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'unicorn-stampede-showcase-report.json'), JSON.stringify(results, null, 2));
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.engine}`, result.ok ? result.runtimeUrl : result.error);
if (failed) process.exit(1);
