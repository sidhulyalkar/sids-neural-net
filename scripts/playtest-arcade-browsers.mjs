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
  if (!title.includes('Sylvaria: Sequoia v0.4.0')) throw new Error(`Sylvaria: Sequoia runtime title is stale: ${title}`);

  const initial = await assertPainted(frame, 'Sylvaria: Sequoia v0.4 title', 12, 24);
  const contract = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG && ({
    version: window.SYLVARIA_SEQUOIA_DEBUG.version,
    fixedHz: window.SYLVARIA_SEQUOIA_DEBUG.fixedHz,
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    tuning: window.SYLVARIA_SEQUOIA_DEBUG.getTuning(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
    phases: window.SYLVARIA_SEQUOIA_DEBUG.getPhases(),
    grammars: window.SYLVARIA_SEQUOIA_DEBUG.getRouteGrammars(),
  }));
  if (!contract) throw new Error('Sylvaria: Sequoia debug contract is unavailable');
  if (contract.version !== '0.4.0' || contract.fixedHz !== 120) {
    throw new Error(`Sylvaria: Sequoia deterministic contract is stale: ${JSON.stringify(contract)}`);
  }
  if (contract.state.mode !== 'title') throw new Error(`Sylvaria: Sequoia expected title mode, got ${contract.state.mode}`);
  if (contract.state.branchCount < 5 || contract.state.knotCount < 3 || contract.state.sapAnchorCount < 2 || contract.state.ringCount < 1) {
    throw new Error(`Sylvaria: Sequoia sparse authored route failed to prime: ${JSON.stringify(contract.state)}`);
  }
  if (contract.state.renderer?.version !== '0.4.0' || !/puzzle lattice/.test(contract.state.renderer?.barkModel || '')) {
    throw new Error(`Sylvaria: Sequoia canopy renderer contract is stale: ${JSON.stringify(contract.state.renderer)}`);
  }
  if (contract.state.airJumps !== 1 || contract.tuning.jump.airJumps !== 1) {
    throw new Error(`Sylvaria: Sequoia Air Kick contract is stale: ${JSON.stringify({ state: contract.state, jump: contract.tuning.jump })}`);
  }
  if (contract.tuning.sap.stickHoldSeconds !== 0.22 || contract.tuning.sap.stickRange !== 640) {
    throw new Error(`Sylvaria: Sequoia Sap Stick tuning is stale: ${JSON.stringify(contract.tuning.sap)}`);
  }
  for (const grammar of ['FLOW', 'RECOVERY', 'GROVE', 'SAPRUN', 'SLINGSHOT', 'CRUX']) {
    if (!contract.grammars.includes(grammar) || !contract.telemetry.routeStats[grammar]?.generated) {
      throw new Error(`Sylvaria: Sequoia did not prime ${grammar}: ${JSON.stringify({ grammars: contract.grammars, stats: contract.telemetry.routeStats })}`);
    }
  }
  const expectedPhases = ['ROOTWAYS', 'REDWOOD RUN', 'SAPWORK', 'HIGH CANOPY', 'CROWNLINE'];
  if (JSON.stringify(contract.phases.map((phase) => phase.name)) !== JSON.stringify(expectedPhases)) {
    throw new Error(`Sylvaria: Sequoia progression phases are stale: ${JSON.stringify(contract.phases)}`);
  }

  await page.screenshot({ path: path.join(outputDir, `${engineName}-sylvaria-sequoia-title.png`), fullPage: true });
  await assertGameFocus(page, frame.locator('#c'), 'Sylvaria: Sequoia');
  await assertCanvasKeyboardFocus(frame, 'Sylvaria: Sequoia');

  await page.keyboard.press('Space');
  await page.waitForTimeout(110);
  const started = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  if (started.mode !== 'playing') throw new Error(`Sylvaria: Sequoia did not enter gameplay on completed Space: ${JSON.stringify(started)}`);
  if (started.jumpInput?.nextRequestId !== 0 || started.jumpInput?.jumpRequestId !== 0 || started.jumpInput?.consumedJumpRequestId !== 0) {
    throw new Error(`Sylvaria: Sequoia title Space leaked into gameplay input: ${JSON.stringify(started)}`);
  }

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(220);
  await page.keyboard.up('ArrowRight');
  const moving = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  if (moving.player.vx <= 0) throw new Error(`Sylvaria: Sequoia horizontal acceleration did not respond: ${JSON.stringify(moving.player)}`);
  if (moving.jumpInput?.nextRequestId !== 0) {
    throw new Error(`Sylvaria: Sequoia generated a jump request without a gameplay jump press: ${JSON.stringify(moving)}`);
  }

  await page.keyboard.press('Space');
  await page.waitForTimeout(72);
  const firstJump = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  if (firstJump.player.vy <= 0 || firstJump.player.state === 'grounded') {
    throw new Error(`Sylvaria: Sequoia ground jump did not launch: ${JSON.stringify(firstJump.player)}`);
  }
  if (firstJump.airJumps !== 1) {
    throw new Error(`Sylvaria: Sequoia ground jump incorrectly consumed Air Kick: ${JSON.stringify(firstJump)}`);
  }
  if (firstJump.jumpInput?.nextRequestId !== 1 || firstJump.jumpInput?.consumedJumpRequestId !== 1) {
    throw new Error(`Sylvaria: Sequoia one Space did not map to exactly one consumed jump request: ${JSON.stringify(firstJump.jumpInput)}`);
  }

  const vyBeforeAirKick = firstJump.player.vy;
  await page.waitForTimeout(55);
  await page.keyboard.press('Space');
  await page.waitForTimeout(58);
  const airKick = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  if (airKick.airJumps !== 0 || airKick.jumpInput?.nextRequestId !== 2 || airKick.jumpInput?.consumedJumpRequestId !== 2) {
    throw new Error(`Sylvaria: Sequoia separate Air Kick press violated the jump contract: ${JSON.stringify(airKick)}`);
  }
  if (airKick.player.vy <= 0 || airKick.combo < 1) {
    throw new Error(`Sylvaria: Sequoia Air Kick failed to extend aerial flow: ${JSON.stringify(airKick)}`);
  }
  if (airKick.player.vy <= vyBeforeAirKick * 0.42) {
    throw new Error(`Sylvaria: Sequoia Air Kick lost too much upward energy: before=${vyBeforeAirKick}, after=${airKick.player.vy}`);
  }

  await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.retry());
  await page.waitForTimeout(130);
  await assertCanvasKeyboardFocus(frame, 'Sylvaria: Sequoia Sap Stick');
  const beforeStick = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    target: window.SYLVARIA_SEQUOIA_DEBUG.getSapTarget(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if (!beforeStick.target) throw new Error(`Sylvaria: Sequoia has no reachable Sap Stick target from authored start: ${JSON.stringify(beforeStick.state)}`);
  const requestsBeforeStick = beforeStick.state.jumpInput?.nextRequestId ?? -1;
  const chordsBeforeStick = beforeStick.state.inputGate?.sapChordCount ?? -1;

  await page.keyboard.down('Shift');
  await page.waitForTimeout(24);
  await page.keyboard.press('Space');
  await page.waitForTimeout(36);
  const stickLocked = await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
  await page.keyboard.up('Shift');

  if ((stickLocked.inputGate?.sapChordCount ?? 0) !== chordsBeforeStick + 1) {
    throw new Error(`Sylvaria: Sequoia Shift+Space did not register exactly one Sap Stick chord: ${JSON.stringify(stickLocked.inputGate)}`);
  }
  if ((stickLocked.jumpInput?.nextRequestId ?? -1) !== requestsBeforeStick) {
    throw new Error(`Sylvaria: Sequoia Sap Stick chord leaked into jump authority: before=${requestsBeforeStick}, after=${JSON.stringify(stickLocked.jumpInput)}`);
  }
  if (!stickLocked.sapStick?.active) {
    throw new Error(`Sylvaria: Sequoia Sap Stick did not enter its fixed tether beat: ${JSON.stringify(stickLocked)}`);
  }

  await page.waitForTimeout(255);
  const stickVaulted = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if (stickVaulted.state.sapStick?.active) {
    throw new Error(`Sylvaria: Sequoia Sap Stick failed to auto-vault after fixed tether: ${JSON.stringify(stickVaulted.state.sapStick)}`);
  }
  if ((stickVaulted.telemetry.counters.sapStickCasts || 0) < 1 || (stickVaulted.telemetry.counters.sapStickVaults || 0) < 1) {
    throw new Error(`Sylvaria: Sequoia Sap Stick telemetry did not record cast + vault: ${JSON.stringify(stickVaulted.telemetry.counters)}`);
  }
  if ((stickVaulted.state.jumpInput?.nextRequestId ?? -1) !== requestsBeforeStick) {
    throw new Error(`Sylvaria: Sequoia Sap Stick auto-vault generated a hidden jump request: ${JSON.stringify(stickVaulted.state.jumpInput)}`);
  }
  if (stickVaulted.state.airJumps !== 1 || stickVaulted.state.player.vy <= 0) {
    throw new Error(`Sylvaria: Sequoia Sap Stick vault failed to preserve recovery options: ${JSON.stringify(stickVaulted.state)}`);
  }

  const telemetry = stickVaulted.telemetry;
  if (telemetry.runSeconds <= 0 || telemetry.movement.peakSpeed <= 0 || (telemetry.counters.sapStickCasts || 0) < 1) {
    throw new Error(`Sylvaria: Sequoia v0.4 telemetry did not accumulate: ${JSON.stringify(telemetry)}`);
  }

  const playing = await assertPainted(frame, 'Sylvaria: Sequoia v0.4 playing', 12, 24);
  await page.screenshot({ path: path.join(outputDir, `${engineName}-sylvaria-sequoia-playing.png`), fullPage: true });
  return { bridge, title, initial, playing, contract, started, moving, firstJump, airKick, stickLocked, stickVaulted };
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