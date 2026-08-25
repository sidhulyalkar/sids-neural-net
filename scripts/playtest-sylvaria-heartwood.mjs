import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_HEARTWOOD_BROWSER_DIR || 'artifacts/sylvaria-sequoia-heartwood';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  { name: 'chrome-stable', browserType: chromium, launchOptions: { channel: 'chrome' } },
  { name: 'chromium', browserType: chromium, launchOptions: {} },
  { name: 'firefox', browserType: firefox, launchOptions: {} },
  { name: 'webkit', browserType: webkit, launchOptions: {} },
];

const results = [];
let failed = false;

async function runtimeFrame(page) {
  const frame = page.frames().find((candidate) => candidate.url().includes('/game-runtimes/sylvaria-sequoia/'));
  if (!frame) throw new Error('Sylvaria iframe did not attach');
  await frame.locator('#c').waitFor({ state: 'visible' });
  return frame;
}

async function reloadWithStorage(page, values) {
  let frame = await runtimeFrame(page);
  await frame.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    }
  }, values);
  await page.reload({ waitUntil: 'networkidle' });
  return runtimeFrame(page);
}

async function start(page, frame) {
  await frame.locator('#c').click();
  await frame.locator('#c').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const mode = await frame.evaluate(() => window.SylvariaSequoia.state.mode);
  if (mode !== 'playing') throw new Error(`Sylvaria did not start: ${mode}`);
}

async function runContract(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/sylvaria-sequoia`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Sylvaria route returned ${response?.status() ?? 'no response'}`);

  let frame = await reloadWithStorage(page, {
    'sylvaria.sequoia.heartseedMask': null,
    'sylvaria.sequoia.crownAwakened': null,
  });
  await start(page, frame);

  const initial = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    return {
      quest: S.heartwoodQuest?.getState?.(),
      trials: S.canopyTrials?.getState?.(),
      render: S.heartwoodTrialsRender || null,
      progressHud: S.canopyProgressHud || null,
      grammars: window.SYLVARIA_SEQUOIA_DEBUG.getRouteGrammars(),
    };
  });

  if (!initial.quest || initial.quest.count !== 0 || initial.quest.total !== 5 || initial.quest.finalCrownFloor !== 250) {
    throw new Error(`Heartwood quest initial state invalid: ${JSON.stringify(initial.quest)}`);
  }
  if (!initial.quest.activeSeed || initial.quest.activeSeed.name !== 'ROOTLIGHT' || initial.quest.activeSeed.floor !== 22) {
    throw new Error(`ROOTLIGHT was not resolved into the authored world: ${JSON.stringify(initial.quest)}`);
  }
  for (const grammar of ['BREAKAWAY', 'PENDULUM', 'CONEFALL', 'THUNDERCROWN']) {
    if (!initial.grammars.includes(grammar)) throw new Error(`Missing canopy trial grammar ${grammar}: ${JSON.stringify(initial.grammars)}`);
  }
  if (initial.render?.version !== 'heartwood-trials-render-v1') {
    throw new Error(`Heartwood renderer unavailable: ${JSON.stringify(initial.render)}`);
  }
  if (initial.progressHud?.version !== 'minimal-crown-hud-v1' || initial.progressHud?.revision !== 'heartwood-objective-v2') {
    throw new Error(`Quest-first HUD contract unavailable: ${JSON.stringify(initial.progressHud)}`);
  }

  const pickup = await frame.evaluate(async () => {
    const S = window.SylvariaSequoia;
    const seed = S.heartwoodQuest.getState().activeSeed;
    S.player.airJumps = 0;
    S.player.saves = 0;
    S.player.x = seed.x;
    S.player.y = seed.y;
    S.player.px = seed.x;
    S.player.py = seed.y;
    await new Promise((resolve) => setTimeout(resolve, 55));
    return {
      quest: S.heartwoodQuest.getState(),
      airJumps: S.player.airJumps,
      saves: S.player.saves,
      storedMask: Number(localStorage.getItem('sylvaria.sequoia.heartseedMask') || 0),
      telemetry: S.getTelemetry().counters,
    };
  });
  if (pickup.quest.count !== 1 || pickup.storedMask !== 1 || pickup.airJumps !== 1 || pickup.saves < 1) {
    throw new Error(`Heartseed pickup did not bank + refill correctly: ${JSON.stringify(pickup)}`);
  }
  if ((pickup.telemetry.heartseeds || 0) < 1) throw new Error(`Heartseed telemetry missing: ${JSON.stringify(pickup.telemetry)}`);

  const trials = await frame.evaluate(async () => {
    const S = window.SylvariaSequoia;
    S.generateUntil(26000);
    S.player.highestFloor = 155;
    S.state.elapsed = 3.05;
    await new Promise((resolve) => setTimeout(resolve, 70));
    const before = S.canopyTrials.getState();
    const fragile = S.state.branches.find((branch) => branch._trialFragile);
    const swaying = S.state.knots.find((knot) => knot._trialSway);
    const swayX = swaying?.x ?? null;
    if (swaying) {
      S.state.elapsed += 0.55;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const swayAfter = swaying?.x ?? null;

    let breakResult = null;
    if (fragile) {
      const x = (fragile.x1 + fragile.x2) * 0.5;
      S.player.x = x;
      S.player.px = x;
      S.player.y = S.branchYAt(fragile, x) + S.state.PLAYER_R;
      S.player.py = S.player.y;
      S.player.vx = 0;
      S.player.vy = 0;
      S.player.grounded = fragile;
      await new Promise((resolve) => setTimeout(resolve, 40));
      const started = Boolean(fragile._trialBreaking);
      S.state.elapsed = Math.max(S.state.elapsed, fragile._trialBreakAt + 0.04);
      await new Promise((resolve) => setTimeout(resolve, 45));
      breakResult = { started, removed: !S.state.branches.includes(fragile) };
    }

    return {
      intensity: before.intensity,
      coneIntensity: before.coneIntensity,
      fragileActive: before.fragileActive,
      swayingKnots: before.swayingKnots,
      cones: before.cones.length,
      swayX,
      swayAfter,
      breakResult,
      counters: S.getTelemetry().counters,
    };
  });

  if (!(trials.intensity > 0.4 && trials.coneIntensity > 0)) {
    throw new Error(`Late-canopy trial intensity did not activate: ${JSON.stringify(trials)}`);
  }
  if (trials.fragileActive < 1 || trials.swayingKnots < 1) {
    throw new Error(`Late world lacks fragile branches or moving Sap anchors: ${JSON.stringify(trials)}`);
  }
  if (trials.swayX == null || trials.swayAfter == null || Math.abs(trials.swayAfter - trials.swayX) < 1) {
    throw new Error(`Pendulum Sap anchor did not move: ${JSON.stringify(trials)}`);
  }
  if (!trials.breakResult?.started || !trials.breakResult?.removed) {
    throw new Error(`Breakaway branch lifecycle failed: ${JSON.stringify(trials)}`);
  }
  if (trials.cones < 1) throw new Error(`Conefall hazard did not spawn: ${JSON.stringify(trials)}`);

  await page.screenshot({ path: path.join(outputDir, `${engineName}-heartwood-trials.png`), fullPage: true });

  frame = await reloadWithStorage(page, {
    'sylvaria.sequoia.heartseedMask': 31,
    'sylvaria.sequoia.crownAwakened': 0,
  });
  await start(page, frame);
  const crown = await frame.evaluate(async () => {
    const S = window.SylvariaSequoia;
    const before = S.heartwoodQuest.getState();
    S.player.highestFloor = 250;
    await new Promise((resolve) => setTimeout(resolve, 55));
    return {
      before,
      after: S.heartwoodQuest.getState(),
      stored: localStorage.getItem('sylvaria.sequoia.crownAwakened'),
      counters: S.getTelemetry().counters,
    };
  });
  if (!crown.before.readyForCrown || crown.before.count !== 5) {
    throw new Error(`Five Heartseeds did not unlock the Living Crown: ${JSON.stringify(crown)}`);
  }
  if (!crown.after.crownAwakened || crown.stored !== '1' || (crown.counters.crownAwakenings || 0) < 1) {
    throw new Error(`Living Crown completion did not persist: ${JSON.stringify(crown)}`);
  }

  await page.screenshot({ path: path.join(outputDir, `${engineName}-living-crown-awakened.png`), fullPage: true });
  return { engine: engineName, ok: true, initial, pickup, trials, crown };
}

for (const { name, browserType, launchOptions } of engines) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    const result = await runContract(page, name);
    if (errors.length) throw new Error(errors.join('\n'));
    results.push(result);
  } catch (error) {
    failed = true;
    results.push({ engine: name, ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
if (failed) process.exit(1);
