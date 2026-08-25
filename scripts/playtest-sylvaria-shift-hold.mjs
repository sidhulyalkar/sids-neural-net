import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_SHIFT_BROWSER_DIR || 'artifacts/sylvaria-sequoia-shift-hold';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  { name: 'chrome-stable', browserType: chromium, launchOptions: { channel: 'chrome' } },
  { name: 'chromium', browserType: chromium, launchOptions: {} },
  { name: 'firefox', browserType: firefox, launchOptions: {} },
  { name: 'webkit', browserType: webkit, launchOptions: {} },
];

const results = [];
let failed = false;

async function focusRuntime(page, frame) {
  await frame.locator('#c').click();
  await frame.locator('#c').focus();
  await page.waitForFunction(() => document.documentElement.classList.contains('game-runtime-focused'));
  const focused = await frame.evaluate(() => document.hasFocus() && document.activeElement?.id === 'c');
  if (!focused) throw new Error('Sylvaria canvas did not receive keyboard focus');
}

async function state(frame) {
  return frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.getState());
}

async function resetSameSeed(frame) {
  await frame.evaluate(() => window.SYLVARIA_SEQUOIA_DEBUG.retry());
  await frame.page().waitForTimeout(90);
}

async function primeAuthoredSapTarget(frame) {
  return frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    S.generateUntil(9000);
    S.sapRhythm?.pruneSapAnchors?.();
    const knot = S.state.knots.find((item) => item.anchorKind === 'sap-stick');
    if (!knot) return null;
    S.player.sap = null;
    S.player.grounded = null;
    S.player.groundedTime = 0;
    S.player.coyote = 0;
    S.player.x = knot.x - 84;
    S.player.px = S.player.x;
    S.player.y = knot.y - 146;
    S.player.py = S.player.y;
    S.player.vx = 230;
    S.player.vy = 35;
    S.player.highestFloor = Math.max(0, knot.floor - 2);
    S.player.lastFloor = Math.max(0, knot.floor - 3);
    S.state.threatY = Math.min(S.state.threatY, S.player.y - 650);
    return {
      knot: { floor: knot.floor, x: knot.x, y: knot.y },
      target: S.sapStick.getTargetPreview?.() || null,
      rhythm: S.sapRhythm?.getState?.() || null,
    };
  });
}

async function runtimeContracts(frame) {
  return frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    const originalFloor = S.player.highestFloor;
    const intensities = {};
    for (const floor of [0, 45, 80, 130, 190]) {
      S.player.highestFloor = floor;
      intensities[floor] = S.canopyEscalation?.getState?.().intensity ?? null;
    }
    S.player.highestFloor = originalFloor;
    return {
      minimalHudGate: S.minimalHudGate || null,
      progressHud: S.canopyProgressHud || null,
      sapHud: S.sapStickControlHud || null,
      progress: S.canopyProgress?.getState?.() || null,
      heartwood: S.heartwoodQuest?.getState?.() || null,
      trials: S.canopyTrials?.getState?.() || null,
      escalation: S.canopyEscalation?.getState?.() || null,
      grammars: window.SYLVARIA_SEQUOIA_DEBUG.getRouteGrammars(),
      sap: S.sapStick?.getState?.() || null,
      sapRhythm: S.sapRhythm?.getState?.() || null,
      economy: S.canopyEconomy?.getState?.() || null,
      intensities,
    };
  });
}

function assertCrownTrailContracts(contract) {
  if (contract.minimalHudGate?.version !== 'reference-hud-suppression-v1' || !contract.minimalHudGate?.preservesUnderlyingScene) {
    throw new Error(`Minimal HUD gate contract unavailable: ${JSON.stringify(contract.minimalHudGate)}`);
  }
  if (contract.progressHud?.version !== 'minimal-crown-hud-v1' || !/fades out/.test(contract.progressHud?.titleBehavior || '')) {
    throw new Error(`Crown HUD/title-fade contract unavailable: ${JSON.stringify(contract.progressHud)}`);
  }
  if (contract.progressHud?.revision !== 'heartwood-objective-v2' || !/Heartseeds/.test(contract.progressHud?.primaryObjective || '')) {
    throw new Error(`Heartwood HUD objective unavailable: ${JSON.stringify(contract.progressHud)}`);
  }
  if (contract.sapHud?.version !== 'shift-hold-minimal-v2' || !/no persistent side panels/.test(contract.sapHud?.teaching || '')) {
    throw new Error(`Transient Sap HUD contract unavailable: ${JSON.stringify(contract.sapHud)}`);
  }
  if (!contract.progress || contract.progress.nextCrownFloor !== 25 || contract.progress.crownRemaining !== 25) {
    throw new Error(`Initial Crown Trail target is stale: ${JSON.stringify(contract.progress)}`);
  }
  if (!contract.heartwood || contract.heartwood.total !== 5 || contract.heartwood.finalCrownFloor !== 250) {
    throw new Error(`Heartwood objective is unavailable: ${JSON.stringify(contract.heartwood)}`);
  }
  for (const grammar of ['WINDLINE', 'SKYHOOK', 'CROWNWEAVE', 'BREAKAWAY', 'PENDULUM', 'CONEFALL', 'THUNDERCROWN']) {
    if (!contract.grammars.includes(grammar)) throw new Error(`Missing escalating canopy grammar ${grammar}: ${JSON.stringify(contract.grammars)}`);
  }
  const wind = contract.intensities;
  if (wind[0] !== 0 || wind[45] !== 0) throw new Error(`Wind invaded the teaching zone: ${JSON.stringify(wind)}`);
  if (!(wind[80] > 0.16 && wind[130] > wind[80] && wind[190] > wind[130])) {
    throw new Error(`Altitude wind does not escalate monotonically enough: ${JSON.stringify(wind)}`);
  }
  if (JSON.stringify(contract.sap?.cleanVaultWindow) !== JSON.stringify([0.16, 0.82]) || contract.sap?.cleanVaultMinHorizontal !== 330) {
    throw new Error(`Clean Sap mastery window is stale: ${JSON.stringify(contract.sap)}`);
  }
  if (!contract.sapRhythm?.ready || contract.sapRhythm?.minAnchorVerticalSpacing !== 205 || !contract.sapRhythm?.successfulUseInvariant) {
    throw new Error(`Branch-gated Sap rhythm unavailable: ${JSON.stringify(contract.sapRhythm)}`);
  }
  if (contract.economy?.currency !== 'CONE TOKENS' || contract.economy?.missions?.length !== 3) {
    throw new Error(`Canopy Contracts economy unavailable: ${JSON.stringify(contract.economy)}`);
  }
}

async function runShiftHoldContract(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/sylvaria-sequoia`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Sylvaria route returned ${response?.status() ?? 'no response'}`);

  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/sylvaria-sequoia/'));
  if (!frame) throw new Error('Sylvaria iframe did not attach');
  await frame.locator('#c').waitFor({ state: 'visible' });
  await focusRuntime(page, frame);

  await page.keyboard.press('Space');
  await page.waitForTimeout(110);
  const started = await state(frame);
  if (started.mode !== 'playing') throw new Error(`Space did not start Sylvaria: ${JSON.stringify(started)}`);

  const contracts = await runtimeContracts(frame);
  assertCrownTrailContracts(contracts);

  await page.waitForTimeout(1750);
  await page.screenshot({ path: path.join(outputDir, `${engineName}-minimal-crown-playfield.png`), fullPage: true });

  await resetSameSeed(frame);
  await focusRuntime(page, frame);
  const plainPrime = await primeAuthoredSapTarget(frame);
  if (!plainPrime?.target) throw new Error(`No sparse authored Sap target for anti-inflation test: ${JSON.stringify(plainPrime)}`);
  const plainBefore = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
    target: window.SylvariaSequoia.sapStick.getTargetPreview?.() || null,
  }));
  await page.keyboard.down('Shift');
  await page.waitForTimeout(92);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(80);
  const plainVault = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if ((plainVault.telemetry.counters.sapStickVaults || 0) < 1) {
    throw new Error(`Plain Sap vault did not complete: ${JSON.stringify(plainVault)}`);
  }
  if (plainVault.state.combo !== 0 || (plainVault.telemetry.counters.sapStickCleanVaults || 0) !== 0) {
    throw new Error(`Ordinary Sap vault still manufactured Flow: ${JSON.stringify(plainVault)}`);
  }
  if (plainVault.state.sapRhythm.ready || plainVault.state.sapRhythm.sapUses !== 1) {
    throw new Error(`Plain Sap vault did not spend the branch-gated charge: ${JSON.stringify(plainVault.state.sapRhythm)}`);
  }

  await resetSameSeed(frame);
  await focusRuntime(page, frame);
  const primed = await primeAuthoredSapTarget(frame);
  if (!primed?.target) throw new Error(`No sparse authored amber target: ${JSON.stringify(primed)}`);

  const before = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    target: window.SylvariaSequoia.sapStick.getTargetPreview?.() || null,
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));

  const requestsBefore = before.state.jumpInput?.nextRequestId ?? -1;
  const pressesBefore = before.state.inputGate?.sapPressCount ?? 0;
  const castsBefore = before.telemetry.counters.sapStickCasts || 0;

  await page.keyboard.down('Shift');
  await page.waitForTimeout(45);
  const locked = await state(frame);
  if (!locked.sapStick?.active || !locked.sapStick?.held) {
    throw new Error(`Shift alone did not immediately acquire Sap Stick: ${JSON.stringify(locked.sapStick)}`);
  }
  if ((locked.inputGate?.sapPressCount ?? 0) !== pressesBefore + 1) {
    throw new Error(`Shift press was not counted exactly once: ${JSON.stringify(locked.inputGate)}`);
  }
  if ((locked.jumpInput?.nextRequestId ?? -1) !== requestsBefore) {
    throw new Error(`Shift-only Sap Stick leaked into jump authority: ${JSON.stringify(locked.jumpInput)}`);
  }

  await page.keyboard.press('Space');
  await page.waitForTimeout(38);
  const afterSpace = await state(frame);
  if (!afterSpace.sapStick?.active || (afterSpace.jumpInput?.nextRequestId ?? -1) !== requestsBefore) {
    throw new Error(`Space leaked through active Sap Stick: ${JSON.stringify(afterSpace)}`);
  }

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(105);
  const steeredRight = await state(frame);
  await page.keyboard.up('ArrowRight');
  if (!steeredRight.sapStick?.active || !steeredRight.inputGate?.physicalDown?.includes('ArrowRight')) {
    throw new Error(`Right steering did not remain inside the held tether: ${JSON.stringify(steeredRight)}`);
  }

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(135);
  const steeredLeft = await state(frame);
  await page.keyboard.up('ArrowLeft');
  if (!steeredLeft.sapStick?.active || !steeredLeft.inputGate?.physicalDown?.includes('ArrowLeft')) {
    throw new Error(`Left steering did not remain inside the held tether: ${JSON.stringify(steeredLeft)}`);
  }
  if (steeredLeft.player.vx >= steeredRight.player.vx - 70) {
    throw new Error(`Opposite A/D steering lacked meaningful swing authority: right=${steeredRight.player.vx}, left=${steeredLeft.player.vx}`);
  }

  await page.keyboard.up('Shift');
  await page.waitForTimeout(110);
  const vaulted = await frame.evaluate(() => ({
    state: window.SYLVARIA_SEQUOIA_DEBUG.getState(),
    telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry(),
  }));
  if (vaulted.state.sapStick?.active || vaulted.state.sapStick?.held) {
    throw new Error(`Shift release left Sap Stick attached: ${JSON.stringify(vaulted.state.sapStick)}`);
  }
  if ((vaulted.telemetry.counters.sapStickCasts || 0) < castsBefore + 1 || (vaulted.telemetry.counters.sapStickVaults || 0) < 1) {
    throw new Error(`Shift lifecycle did not record cast + vault: ${JSON.stringify(vaulted.telemetry.counters)}`);
  }
  if ((vaulted.state.jumpInput?.nextRequestId ?? -1) !== requestsBefore || vaulted.state.airJumps !== 1 || vaulted.state.player.vy <= 0) {
    throw new Error(`Shift release did not preserve clean vault recovery: ${JSON.stringify(vaulted.state)}`);
  }
  if (vaulted.state.sapRhythm.ready || vaulted.state.sapRhythm.sapUses !== 1) {
    throw new Error(`Vault did not leave Sap spent pending a higher log: ${JSON.stringify(vaulted.state.sapRhythm)}`);
  }

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  const beforeZero = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  await page.keyboard.press('0');
  await page.waitForTimeout(95);
  const afterZero = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  if (afterZero.state.seed !== beforeZero.state.seed || afterZero.state.mode !== 'playing') {
    throw new Error(`0 did not retry the current seed: before=${JSON.stringify(beforeZero.state)}, after=${JSON.stringify(afterZero.state)}`);
  }
  if (afterZero.telemetry.runSeconds > 0.18 || afterZero.state.combo !== 0 || Math.abs(afterZero.state.player.x - 480) > 45 || !afterZero.state.sapRhythm.ready) {
    throw new Error(`0 reset did not restore a fresh run: ${JSON.stringify(afterZero)}`);
  }

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  const beforeR = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  await page.keyboard.press('r');
  await page.waitForTimeout(95);
  const afterR = await frame.evaluate(() => ({ state: window.SYLVARIA_SEQUOIA_DEBUG.getState(), telemetry: window.SYLVARIA_SEQUOIA_DEBUG.getTelemetry() }));
  if (afterR.state.seed !== beforeR.state.seed || afterR.telemetry.runSeconds <= beforeR.telemetry.runSeconds) {
    throw new Error(`R still behaves like a reset: before=${JSON.stringify(beforeR)}, after=${JSON.stringify(afterR)}`);
  }
  if (Math.abs(afterR.state.player.x - 480) + 12 < Math.abs(beforeR.state.player.x - 480)) {
    throw new Error(`R pulled Pip back toward the reset spawn: beforeX=${beforeR.state.player.x}, afterX=${afterR.state.player.x}`);
  }

  await page.screenshot({ path: path.join(outputDir, `${engineName}-shift-hold-sap-stick.png`), fullPage: true });
  return {
    engine: engineName,
    ok: true,
    contracts,
    plainPrime,
    plainBefore,
    plainVault,
    primed,
    target: before.target,
    locked,
    afterSpace,
    steeredRight,
    steeredLeft,
    vaulted,
    afterZero,
    afterR,
  };
}

for (const { name, browserType, launchOptions } of engines) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    const result = await runShiftHoldContract(page, name);
    if (errors.length) throw new Error(errors.join('\n'));
    results.push(result);
  } catch (error) {
    failed = true;
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (failed) process.exit(1);