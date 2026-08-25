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

async function assertUniRicoV019Contracts(frame) {
  const contract = await frame.evaluate(() => {
    const canvas = document.querySelector('#c');
    if (!canvas) throw new Error('uniRico canvas missing');

    const readState = () => eval('({ mode: F, touchMode: mo, touchPointer: tc, hasShot: B !== null, aim: $e.slice() })');
    const dispatchTouch = (type, x, y, pointerId) => {
      const [scale, offsetX, offsetY] = eval('tr()');
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent(type, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true,
        clientX: rect.left + offsetX + x * scale,
        clientY: rect.top + offsetY + y * scale,
      }));
    };

    eval('V = []; td = 0; $b(0);');
    const tutorialMode = eval('F');

    eval('V[0] = [1, 0, 0, 0]; td = 1; $b(0); B = null;');
    const originalCapture = canvas.setPointerCapture;
    canvas.setPointerCapture = () => {};

    let aimDown;
    let aimReleased;
    let fired;
    try {
      dispatchTouch('pointerdown', 90, 450, 71);
      aimDown = readState();
      dispatchTouch('pointerup', 90, 450, 71);
      aimReleased = readState();
      dispatchTouch('pointerdown', 870, 510, 72);
      fired = readState();
    } finally {
      if (originalCapture) canvas.setPointerCapture = originalCapture;
      else delete canvas.setPointerCapture;
    }

    return { tutorialMode, aimDown, aimReleased, fired };
  });

  if (contract.tutorialMode !== 7) {
    throw new Error(`uniRico v0.19.0 first-seen tutorial did not enter demo mode: ${JSON.stringify(contract)}`);
  }
  if (contract.aimDown.touchMode !== 1 || contract.aimDown.touchPointer !== 71 || contract.aimDown.hasShot) {
    throw new Error(`uniRico AIM touch contract failed: ${JSON.stringify(contract.aimDown)}`);
  }
  if (contract.aimReleased.touchPointer !== 0) {
    throw new Error(`uniRico AIM pointer did not release cleanly: ${JSON.stringify(contract.aimReleased)}`);
  }
  if (contract.aimReleased.hasShot) {
    throw new Error(`uniRico AIM release fired unexpectedly: ${JSON.stringify(contract.aimReleased)}`);
  }
  if (!contract.fired.hasShot) {
    throw new Error(`uniRico FIRE control did not launch the selected angle: ${JSON.stringify(contract.fired)}`);
  }

  return contract;
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
  if (!frame.url().includes('/game-runtimes/unirico/v0.19.0/index.html')) {
    throw new Error(`uniRico runtime URL is not release-versioned: ${frame.url()}`);
  }

  const bridge = await assertNativeBridge(frame, 'uniRico');
  await frame.locator('#c').waitFor({ state: 'visible' });
  const title = await frame.title();
  if (!title.includes('uniRico v0.19.0')) throw new Error(`uniRico runtime title is stale: ${title}`);

  const initial = await assertPainted(frame, 'uniRico title', 4, 8);
  await assertGameFocus(page, frame.locator('#c'), 'uniRico');
  const v019 = await assertUniRicoV019Contracts(frame);
  await page.screenshot({ path: path.join(outputDir, `${engineName}-unirico.png`), fullPage: true });
  return { bridge, title, runtimeUrl: frame.url(), initial, v019 };
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

    if (errors.length) throw new Error(errors.join('\n'));
    report.push({ engine: engineName, ok: true, stretchicorn, unirico });
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
