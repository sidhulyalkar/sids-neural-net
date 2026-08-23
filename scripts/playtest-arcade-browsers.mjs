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

const report = [];
let failed = false;

function canvasStats(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#c');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return { ready: false, distinct: 0, lit: 0, checksum: 0 };

    const samples = [];
    let lit = 0;
    let checksum = 0;
    for (let y = 24; y < canvas.height; y += 48) {
      for (let x = 24; x < canvas.width; x += 48) {
        const pixel = context.getImageData(x, y, 1, 1).data;
        samples.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        if (pixel[0] + pixel[1] + pixel[2] > 35 && pixel[3] > 0) lit += 1;
        checksum = (checksum + pixel[0] * 3 + pixel[1] * 5 + pixel[2] * 7 + pixel[3]) % 1_000_000_007;
      }
    }
    return { ready: true, distinct: new Set(samples).size, lit, checksum };
  });
}

async function assertPainted(frame, label, minimumDistinct = 8, minimumLit = 20) {
  const deadline = Date.now() + 5_000;
  let stats = await canvasStats(frame);
  while ((!stats.ready || stats.distinct < minimumDistinct || stats.lit < minimumLit) && Date.now() < deadline) {
    await frame.page().waitForTimeout(100);
    stats = await canvasStats(frame);
  }
  if (!stats.ready || stats.distinct < minimumDistinct || stats.lit < minimumLit) {
    throw new Error(`${label} canvas under-rendered after first-paint window: ${JSON.stringify(stats)}`);
  }
  return stats;
}

async function assertNativeBridge(frame, label) {
  await frame.waitForFunction(() => window.__SIDS_GAME_NETWORK_BRIDGE__ === true, null, { timeout: 5_000 });
  return `${label} native focus bridge ready`;
}

async function assertGameFocus(page, target, label) {
  await target.click();
  await page.waitForFunction(
    () => document.documentElement.classList.contains('game-runtime-focused'),
    null,
    { timeout: 5_000 }
  );

  const cursorState = await page.evaluate(() => ({
    focused: document.documentElement.classList.contains('game-runtime-focused'),
    cursorDisplay: document.querySelector('.neuron-cursor-overlay')
      ? getComputedStyle(document.querySelector('.neuron-cursor-overlay')).display
      : 'not-rendered',
  }));

  if (!cursorState.focused) throw new Error(`${label}: host did not enter game focus mode`);
  if (cursorState.cursorDisplay !== 'none' && cursorState.cursorDisplay !== 'not-rendered') {
    throw new Error(`${label}: neural cursor remained visible during game focus (${cursorState.cursorDisplay})`);
  }
}

async function assertCanvasKeyboardFocus(frame, label) {
  await frame.locator('#c').focus();
  const focus = await frame.evaluate(() => ({
    documentHasFocus: document.hasFocus(),
    activeElementId: document.activeElement?.id || null,
  }));
  if (!focus.documentHasFocus || focus.activeElementId !== 'c') {
    throw new Error(`${label}: canvas keyboard focus failed: ${JSON.stringify(focus)}`);
  }
}

async function testStretchicorn(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/stretchicorn`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Stretchicorn route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="Stretchicorn game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('Stretchicorn same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/stretchicorn/'));
  if (!frame) throw new Error('Stretchicorn iframe did not attach');

  const bridge = await assertNativeBridge(frame, 'Stretchicorn');
  await frame.locator('#c').waitFor({ state: 'visible' });
  const title = await frame.title();
  if (!title.includes('Stretchicorn v0.21.1')) throw new Error(`Stretchicorn runtime title is stale: ${title}`);

  const initial = await assertPainted(frame, 'Stretchicorn title');
  const initialMode = await frame.evaluate(() => eval('mode'));
  if (initialMode !== 0) throw new Error(`Stretchicorn expected title mode 0, got ${initialMode}`);

  await page.screenshot({ path: path.join(outputDir, `${engineName}-stretchicorn-title.png`), fullPage: true });
  await assertGameFocus(page, frame.locator('#c'), 'Stretchicorn');
  await assertCanvasKeyboardFocus(frame, 'Stretchicorn');
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  const playingMode = await frame.evaluate(() => eval('mode'));
  if (playingMode !== 1) throw new Error(`Stretchicorn did not enter gameplay after Space; mode=${playingMode}`);

  const playing = await assertPainted(frame, 'Stretchicorn playing');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-stretchicorn-playing.png`), fullPage: true });
  return { bridge, title, initial, playing, modes: [initialMode, playingMode] };
}

async function testUniRico(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/unirico`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`uniRico route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="uniRico game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('uniRico same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/unirico/'));
  if (!frame) throw new Error('uniRico iframe did not attach');

  const bridge = await assertNativeBridge(frame, 'uniRico');
  await frame.locator('#c').waitFor({ state: 'visible' });
  const initial = await assertPainted(frame, 'uniRico title', 4, 8);
  await assertGameFocus(page, frame.locator('#c'), 'uniRico');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-unirico.png`), fullPage: true });
  return { bridge, initial };
}

async function testSylvariaSequoia(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/sylvaria-sequoia`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Sylvaria: Sequoia route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="Sylvaria: Sequoia game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('Sylvaria: Sequoia same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/sylvaria-sequoia/'));
  if (!frame) throw new Error('Sylvaria: Sequoia iframe did not attach');

  const bridge = await assertNativeBridge(frame, 'Sylvaria: Sequoia');
  await frame.locator('#c').waitFor({ state: 'visible' });
  const title = await frame.title();
  if (!title.includes('Sylvaria: Sequoia v0.2.0')) throw new Error(`Sylvaria: Sequoia runtime title is stale: ${title}`);

  const initial = await assertPainted(frame, 'Sylvaria: Sequoia title', 8, 20);
  const contract = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG && ({
    version: window.SYLVARIA_SEQUOIA_DEBUG.version,
    fixedHz: window.SYLVARIA_SEQUOIA_DEBUG.fixedHz,
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    tuning: window.SYLVARIA_SEQUOIA_DEBUG.getTuning(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if (!contract) throw new Error('Sylvaria: Sequoia debug contract is unavailable');
  if (contract.version !== '0.2.0' || contract.fixedHz !== 120) {
    throw new Error(`Sylvaria: Sequoia deterministic contract is stale: ${JSON.stringify(contract)}`);
  }
  if (contract.state.mode !== 'title') throw new Error(`Sylvaria: Sequoia expected title mode, got ${contract.state.mode}`);
  if (contract.state.branchCount < 8 || contract.state.knotCount < 1) {
    throw new Error(`Sylvaria: Sequoia authored route failed to prime: ${JSON.stringify(contract.state)}`);
  }
  if (contract.tuning.combo.hyperThreshold !== 4 || contract.tuning.combo.ascentDecayScale >= 1) {
    throw new Error(`Sylvaria: Sequoia combo tuning is stale: ${JSON.stringify(contract.tuning.combo)}`);
  }
  for (const grammar of ['FLOW', 'CRUX', 'RECOVERY', 'SLINGSHOT']) {
    if (!contract.telemetry.routeStats[grammar]?.generated) {
      throw new Error(`Sylvaria: Sequoia did not generate ${grammar} telemetry: ${JSON.stringify(contract.telemetry.routeStats)}`);
    }
  }

  await page.screenshot({ path: path.join(outputDir, `${engineName}-sylvaria-sequoia-title.png`), fullPage: true });
  await assertGameFocus(page, frame.locator('#c'), 'Sylvaria: Sequoia');
  await assertCanvasKeyboardFocus(frame, 'Sylvaria: Sequoia');
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(280);
  await page.keyboard.up('ArrowRight');

  const moving = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  if (moving.mode !== 'playing') throw new Error(`Sylvaria: Sequoia did not enter gameplay: ${JSON.stringify(moving)}`);
  if (moving.player.vx <= 0) throw new Error(`Sylvaria: Sequoia horizontal acceleration did not respond: ${JSON.stringify(moving.player)}`);

  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const jumping = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  if (jumping.player.vy <= 0) throw new Error(`Sylvaria: Sequoia jump did not launch upward: ${JSON.stringify(jumping.player)}`);

  await page.waitForTimeout(300);
  const telemetry = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry());
  if (telemetry.runSeconds <= 0 || telemetry.counters.jumps < 1 || telemetry.movement.peakSpeed <= 0) {
    throw new Error(`Sylvaria: Sequoia telemetry did not accumulate: ${JSON.stringify(telemetry)}`);
  }

  const playing = await assertPainted(frame, 'Sylvaria: Sequoia playing', 8, 20);
  await page.screenshot({ path: path.join(outputDir, `${engineName}-sylvaria-sequoia-playing.png`), fullPage: true });
  return { bridge, title, initial, playing, contract, moving, jumping, telemetry };
}

for (const { name: engineName, browserType, launchOptions } of engines) {
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() < 400) return;
      const url = response.url();
      if (url.startsWith(baseUrl) && url.includes('/game-runtimes/')) {
        errors.push(`runtime response ${response.status()}: ${url}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      errors.push(`console: ${text}`);
    });

    const stretchicorn = await testStretchicorn(page, engineName);
    const unirico = await testUniRico(page, engineName);
    const sylvariaSequoia = await testSylvariaSequoia(page, engineName);

    if (errors.length) throw new Error(errors.join('\n'));
    report.push({ engine: engineName, ok: true, stretchicorn, unirico, sylvariaSequoia });
  } catch (error) {
    failed = true;
    report.push({
      engine: engineName,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      errors,
    });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failed) process.exit(1);
