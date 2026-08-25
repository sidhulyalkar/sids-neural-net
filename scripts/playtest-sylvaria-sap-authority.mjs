import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_SAP_AUTHORITY_BROWSER_DIR || 'artifacts/sylvaria-sequoia-sap-authority';
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

async function focus(page, frame) {
  await frame.locator('#c').click();
  await frame.locator('#c').focus();
  await page.waitForFunction(() => document.documentElement.classList.contains('game-runtime-focused'));
}

async function shiftTap(page, downMs = 14, upMs = 14) {
  await page.keyboard.down('Shift');
  await page.waitForTimeout(downMs);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(upMs);
}

async function runContract(page, engineName) {
  const response = await page.goto(`${baseUrl}/arcade/sylvaria-sequoia`, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`Sylvaria route returned ${response?.status() ?? 'no response'}`);
  const frame = await runtimeFrame(page);
  await focus(page, frame);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);

  const initial = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    S.generateUntil(18000);
    S.sapRhythm?.pruneSapAnchors?.();
    const authority = S.sapAuthority?.getState?.() || null;
    const routeBalance = S.sapRouteBalance || null;
    const anchors = S.state.knots.filter((knot) => knot.anchorKind === 'sap-stick').length;
    const branches = S.state.branches.length;
    return {
      debugVersion: window.SYLVARIA_SEQUOIA_DEBUG.version,
      authority,
      routeBalance,
      anchors,
      branches,
      density: branches ? anchors / branches : 99,
    };
  });

  if (initial.debugVersion !== '0.6.1') throw new Error(`v0.6.1 debug contract unavailable: ${JSON.stringify(initial)}`);
  if (initial.authority?.version !== 'nearest-sap-authority-v2' || !initial.authority.pressTimeAcquisition || initial.authority.bufferedAcquisitionSeconds !== 0) {
    throw new Error(`Nearest Sap authority unavailable: ${JSON.stringify(initial.authority)}`);
  }
  if (initial.authority.maxTetherSpeedGain !== 120) throw new Error(`Sap tether energy budget unavailable: ${JSON.stringify(initial.authority)}`);
  if (initial.density >= 0.36) throw new Error(`Generated Sap density is still too high: ${JSON.stringify(initial)}`);
  if (!initial.routeBalance || initial.routeBalance.densityProfile !== 'sparse-one-anchor-v3' || Object.values(initial.routeBalance.hasConsecutiveAirAnchors || {}).some(Boolean)) {
    throw new Error(`Production Sap route balance is stale: ${JSON.stringify(initial.routeBalance)}`);
  }

  const nearest = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    S.startRun(9173);
    S.player.grounded = null;
    S.player.groundedTime = 0;
    S.player.x = 480;
    S.player.px = 480;
    S.player.y = 210;
    S.player.py = 210;
    S.player.vx = 180;
    S.player.vy = 35;
    S.state.threatY = -10000;

    const far = { x: 292, y: 360, floor: 4, chunkId: 'test-far', chunkType: 'TEST', role: 'test', anchorKind: 'sap-stick', pulse: 0 };
    const near = { x: 560, y: 320, floor: 3, chunkId: 'test-near', chunkType: 'TEST', role: 'test', anchorKind: 'sap-stick', pulse: 0 };
    S.state.knots.splice(0, S.state.knots.length, far, near);

    const preview = S.sapStick.getTargetPreview?.();
    const before = { vx: S.player.vx, vy: S.player.vy };
    const attached = S.pressSapStick();
    const after = { vx: S.player.vx, vy: S.player.vy };
    const attachedKnot = S.player.sap?.knot || null;
    return {
      attached,
      preview: preview ? { chunkId: preview.chunkId, floor: preview.floor, x: preview.x, y: preview.y } : null,
      attachedKnot: attachedKnot ? { chunkId: attachedKnot.chunkId, floor: attachedKnot.floor, x: attachedKnot.x, y: attachedKnot.y } : null,
      before,
      after,
      authority: S.sapAuthority.getState(),
    };
  });

  if (!nearest.attached || nearest.preview?.chunkId !== 'test-near' || nearest.attachedKnot?.chunkId !== 'test-near') {
    throw new Error(`Sap did not choose the strict nearest eligible node: ${JSON.stringify(nearest)}`);
  }
  if (Math.abs(nearest.after.vx - nearest.before.vx) > 95.5 || Math.abs(nearest.after.vy - nearest.before.vy) > 120.5) {
    throw new Error(`Sap attach injected more than the bounded momentum nudge: ${JSON.stringify(nearest)}`);
  }
  if (nearest.authority.nodeUses !== 1 || nearest.authority.armed || nearest.authority.usedAnchors !== 1) {
    throw new Error(`First Sap use was not atomically spent: ${JSON.stringify(nearest.authority)}`);
  }

  // Hold and aggressively steer long enough that the old spring/pump model would
  // have produced a much larger speed. The hard authority must keep kinetic speed
  // inside the entry-speed budget while still allowing direction shaping.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(520);
  await page.keyboard.up('ArrowRight');
  const tethered = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    const authority = S.sapAuthority.getState();
    return {
      active: Boolean(S.player.sap?.stickMode),
      speed: Math.hypot(S.player.vx, S.player.vy),
      vx: S.player.vx,
      vy: S.player.vy,
      authority,
      counters: S.getTelemetry().counters,
    };
  });
  if (!tethered.active) throw new Error(`Sap released before held-energy test completed: ${JSON.stringify(tethered)}`);
  if (tethered.speed > tethered.authority.leaseSpeedCap + 2) {
    throw new Error(`Held Sap steering pumped past the kinetic-energy budget: ${JSON.stringify(tethered)}`);
  }
  if (tethered.authority.leaseSpeedCap > tethered.authority.leaseEntrySpeed + 120.5 && tethered.authority.leaseSpeedCap > 221) {
    throw new Error(`Tether speed cap exceeds the promised slight boost: ${JSON.stringify(tethered.authority)}`);
  }

  const release = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    const before = { vx: S.player.vx, vy: S.player.vy };
    const released = S.releaseSapStick('TEST_RELEASE');
    const after = { vx: S.player.vx, vy: S.player.vy };
    return { released, before, after, active: Boolean(S.player.sap?.stickMode), authority: S.sapAuthority.getState() };
  });
  if (!release.released || release.active) throw new Error(`Sap did not release cleanly: ${JSON.stringify(release)}`);
  if (Math.abs(release.after.vx - release.before.vx) > 105.5 || Math.abs(release.after.vy - release.before.vy) > 145.5) {
    throw new Error(`Sap release injected more than the bounded momentum nudge: ${JSON.stringify(release)}`);
  }
  if (Math.hypot(release.after.vx, release.after.vy) > release.authority.leaseSpeedCap + 67) {
    throw new Error(`Sap release exceeded the post-tether speed budget: ${JSON.stringify(release)}`);
  }

  for (let index = 0; index < 24; index += 1) await shiftTap(page);
  await page.waitForTimeout(90);
  const afterSpam = await frame.evaluate(() => ({
    mode: window.SylvariaSequoia.state.mode,
    authority: window.SylvariaSequoia.sapAuthority.getState(),
    counters: window.SylvariaSequoia.getTelemetry().counters,
  }));
  if (afterSpam.mode !== 'playing' || afterSpam.authority.nodeUses !== 1 || afterSpam.authority.armed || !afterSpam.authority.useInvariant) {
    throw new Error(`Rapid Shift taps bypassed the single-use Sap lease: ${JSON.stringify(afterSpam)}`);
  }
  if (afterSpam.authority.blockedPresses < 18 || (afterSpam.counters.sapAuthorityBlockedPresses || 0) < 18) {
    throw new Error(`Shift spam was not safely rejected at input authority: ${JSON.stringify(afterSpam)}`);
  }

  const landing = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    const spent = S.sapAuthority.getState().spentAtFloor;
    const branch = {
      x1: 330, x2: 630, y: S.player.y - 20, slope: 0, floor: Math.max(5, spent + 2),
      chunkId: 'test-log', chunkType: 'TEST', side: 'center', launch: false,
    };
    S.state.branches.push(branch);
    S.player.grounded = branch;
    S.player.groundedTime = 0;
    S.player.x = 480;
    S.player.px = 480;
    S.player.y = branch.y + S.state.PLAYER_R;
    S.player.py = S.player.y;
    S.player.vx = 0;
    S.player.vy = 0;
    return { floor: branch.floor, spent };
  });
  await page.waitForTimeout(120);
  const rearmed = await frame.evaluate(() => window.SylvariaSequoia.sapAuthority.getState());
  if (!rearmed.armed || rearmed.recharges !== 1 || rearmed.highestPhysicalFloor < landing.floor) {
    throw new Error(`A physically held higher log did not rearm Sap: ${JSON.stringify({ landing, rearmed })}`);
  }

  const second = await frame.evaluate(() => {
    const S = window.SylvariaSequoia;
    S.player.grounded = null;
    S.player.groundedTime = 0;
    S.player.vx = 210;
    S.player.vy = 40;
    const floorBase = S.sapAuthority.getState().highestPhysicalFloor;
    const far = { x: 300, y: S.player.y + 150, floor: floorBase + 3, chunkId: 'test-far-2', chunkType: 'TEST', role: 'test', anchorKind: 'sap-stick', pulse: 0 };
    const near = { x: S.player.x + 72, y: S.player.y + 105, floor: floorBase + 2, chunkId: 'test-near-2', chunkType: 'TEST', role: 'test', anchorKind: 'sap-stick', pulse: 0 };
    S.state.knots.splice(0, S.state.knots.length, far, near);
    const preview = S.sapStick.getTargetPreview?.();
    const attached = S.pressSapStick();
    return {
      attached,
      preview: preview?.chunkId || null,
      attachedId: S.player.sap?.knot?.chunkId || null,
      authority: S.sapAuthority.getState(),
    };
  });
  if (!second.attached || second.preview !== 'test-near-2' || second.attachedId !== 'test-near-2' || second.authority.nodeUses !== 2) {
    throw new Error(`Second cycle did not acquire the new nearest node: ${JSON.stringify(second)}`);
  }

  await page.screenshot({ path: path.join(outputDir, `${engineName}-nearest-sap-authority.png`), fullPage: true });
  return { engine: engineName, ok: true, initial, nearest, tethered, release, afterSpam, landing, rearmed, second };
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