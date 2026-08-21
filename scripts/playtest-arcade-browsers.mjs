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
  // Programmatic focus is deliberate here. Clicking Sylvaria's canvas is a real
  // resonance cast, which would put the runtime on cooldown before keyboard tests.
  await frame.locator('#c').focus();
  const focus = await frame.evaluate(() => ({
    documentHasFocus: document.hasFocus(),
    activeElementId: document.activeElement?.id || null,
  }));
  if (!focus.documentHasFocus || focus.activeElementId !== 'c') {
    throw new Error(`${label}: canvas keyboard focus failed: ${JSON.stringify(focus)}`);
  }
}

async function testSylvaria(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/sylvaria`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Sylvaria route returned ${response?.status() ?? 'no response'}`);

  const iframe = page.locator('iframe[title="Sylvaria game runtime"]');
  await iframe.waitFor({ state: 'visible' });
  if ((await iframe.getAttribute('sandbox')) !== null) throw new Error('Sylvaria same-origin runtime should not be sandboxed');

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/mosslight-v2/'));
  if (!frame) throw new Error('Sylvaria iframe did not attach');

  const bridge = await assertNativeBridge(frame, 'Sylvaria');
  await frame.waitForFunction(() => Boolean(window.__MOSSLIGHT_PLAYTEST__) && Boolean(window.SylvariaVisualSystem) && Boolean(window.SylvariaRenderBudget), null, { timeout: 10_000 });
  await frame.waitForFunction(() => window.MosslightExpedition?.atlasCount === 1000, null, { timeout: 10_000 });
  const identity = await frame.evaluate(() => ({
    title: window.__MOSSLIGHT_PLAYTEST__.title,
    version: window.__MOSSLIGHT_PLAYTEST__.version,
    visualVersion: window.SylvariaVisualSystem.version,
    themes: Object.keys(window.SylvariaVisualSystem.themes),
    quality: window.SylvariaRenderBudget.snapshot(),
  }));
  if (identity.title !== 'Sylvaria' || identity.version !== '0.6.0' || identity.visualVersion !== '0.6.0') {
    throw new Error(`Sylvaria runtime identity mismatch: ${JSON.stringify(identity)}`);
  }
  for (const theme of ['forest','volcanic','reef','ice','celestial']) {
    if (!identity.themes.includes(theme)) throw new Error(`Sylvaria visual system missing ${theme} theme`);
  }
  if (!['performance','balanced','high'].includes(identity.quality.tier)) throw new Error(`Sylvaria invalid visual quality tier: ${identity.quality.tier}`);

  await frame.locator('#title').waitFor({ state: 'visible' });
  await frame.locator('#start').waitFor({ state: 'visible' });
  const initial = await assertPainted(frame, 'Sylvaria title');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-sylvaria-title.png`), fullPage: true });

  await assertGameFocus(page, frame.locator('#start'), 'Sylvaria');
  await frame.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.snapshot().mode === 'playing');
  await assertCanvasKeyboardFocus(frame, 'Sylvaria');

  const before = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  await page.keyboard.up('d');
  await page.waitForTimeout(120);
  const after = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());

  if ((after.player?.x ?? 0) <= (before.player?.x ?? 0) + 8) {
    throw new Error(`Sylvaria keyboard input failed (${before.player?.x} -> ${after.player?.x})`);
  }
  if (!after.visual?.theme || !after.visual?.quality?.tier) throw new Error('Sylvaria v0.6 snapshot lost visual telemetry');

  await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0));
  await assertCanvasKeyboardFocus(frame, 'Sylvaria arrow aim');
  const beforeArrow = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.press('Space');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(420);
  const afterArrow = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (afterArrow.stats.casts <= beforeArrow.stats.casts) {
    throw new Error('Sylvaria ArrowUp + ArrowRight + Space did not register a cast');
  }

  // Explicitly prove the v0.6 state machine on every browser engine. Completing
  // the puzzle may arm the gate, but it must remain closed until F fires it.
  await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1));
  const gateReady = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.completeRoom());
  if (!gateReady.portalReady || gateReady.portalOpen) {
    throw new Error(`Sylvaria gate should be READY but closed after puzzle completion: ${JSON.stringify({ phase: gateReady.portalPhase, ready: gateReady.portalReady, open: gateReady.portalOpen })}`);
  }
  await assertCanvasKeyboardFocus(frame, 'Sylvaria gate fire');
  await page.keyboard.press('f');
  await frame.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().portalOpen === true, null, { timeout: 3_000 });
  const gateOpen = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
  if (gateOpen.portalPhase !== 'open' || gateOpen.stats.portals < 1) {
    throw new Error(`Sylvaria portal shot failed: ${JSON.stringify({ phase: gateOpen.portalPhase, portals: gateOpen.stats.portals })}`);
  }

  const playing = await assertPainted(frame, 'Sylvaria extraction');
  await page.screenshot({ path: path.join(outputDir, `${engineName}-sylvaria-extraction.png`), fullPage: true });
  return {
    bridge,
    identity,
    atlasCount: await frame.evaluate(() => window.MosslightExpedition.atlasCount),
    initial,
    playing,
    movement: [before.player?.x, after.player?.x],
    arrowCastDelta: afterArrow.stats.casts - beforeArrow.stats.casts,
    portalPhase: gateOpen.portalPhase,
    portalShots: gateOpen.stats.portals,
    fps: after.fps,
    visual: after.visual,
  };
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
  return { bridge, initial, playing, modes: [initialMode, playingMode] };
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

    const sylvaria = await testSylvaria(page, engineName);
    const stretchicorn = await testStretchicorn(page, engineName);
    const unirico = await testUniRico(page, engineName);

    if (errors.length) throw new Error(errors.join('\n'));
    report.push({ engine: engineName, ok: true, sylvaria, stretchicorn, unirico });
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
