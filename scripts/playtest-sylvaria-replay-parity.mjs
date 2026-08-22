import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import * as headlessNamespace from '../src/lib/sylvaria/headless.ts';

const headless = typeof headlessNamespace.simulateSylvariaReplay === 'function'
  ? headlessNamespace
  : headlessNamespace.default;
const simulateSylvariaReplay = headless?.simulateSylvariaReplay;
if (typeof simulateSylvariaReplay !== 'function') {
  throw new Error(`Sylvaria parity harness could not resolve simulateSylvariaReplay; exports=${Object.keys(headlessNamespace).join(',')}`);
}

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');
const baseUrl = process.env.SYLVARIA_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_REPLAY_PARITY_DIR || 'artifacts/sylvaria-replay-parity';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  { name: 'chrome-stable', type: chromium, options: { channel: 'chrome' } },
  { name: 'chromium', type: chromium, options: {} },
  { name: 'firefox', type: firefox, options: {} },
  { name: 'webkit', type: webkit, options: {} },
];
const report = [];
let failed = false;
const close = (a, b, tolerance = 0.06) => Math.abs(a - b) <= tolerance;

for (const spec of engines) {
  let browser;
  let browserResult = null;
  let node = null;
  try {
    browser = await spec.type.launch({ headless: true, ...spec.options });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?record-parity=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.version === '0.10.0');
    await page.evaluate(async () => { await import('/game-runtimes/mosslight-v2/v011/replay-v011.js'); });
    await page.waitForFunction(() => window.SylvariaReplay?.version === '0.11.0');
    await page.click('#start');
    await page.locator('#c').focus();

    await page.keyboard.press('d');
    await page.waitForTimeout(24);
    await page.keyboard.press('s');
    await page.waitForTimeout(170);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(95);
    await page.keyboard.press('a');
    await page.waitForTimeout(70);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(140);
    await page.keyboard.press('w');
    await page.waitForTimeout(110);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(360);

    browserResult = await page.evaluate(() => {
      window.Sylvaria091.state.mode = 'paused';
      return {
        replay: window.SylvariaReplay.snapshot(),
        game: window.__MOSSLIGHT_PLAYTEST__.snapshot(),
      };
    });
    if (browserResult.replay.eventCount < 9) throw new Error(`recorder captured too few inputs: ${browserResult.replay.eventCount}`);
    if (browserResult.replay.durationTicks < 40) throw new Error(`recorder captured too few ticks: ${browserResult.replay.durationTicks}`);

    node = simulateSylvariaReplay(browserResult.replay.events, browserResult.replay.durationTicks, { allowIncomplete: true });
    const b = browserResult.game;
    const mismatches = [];
    if (node.score !== Math.floor(b.score)) mismatches.push(`score ${b.score} != ${node.score}`);
    if (node.worldDepth !== b.worldDepth) mismatches.push(`worldDepth ${b.worldDepth} != ${node.worldDepth}`);
    for (const key of ['dashes', 'cuts', 'counters', 'perfectCounters', 'crosscuts', 'longReturns', 'grassCut', 'terrainRoutes', 'hazardKills']) {
      if (Number(node.stats[key] || 0) !== Number(b.stats[key] || 0)) mismatches.push(`${key} ${b.stats[key]} != ${node.stats[key]}`);
    }
    if (!node.player || !b.player) {
      mismatches.push('player missing');
    } else {
      if (!close(node.player.x, b.player.x)) mismatches.push(`player.x ${b.player.x} != ${node.player.x}`);
      if (!close(node.player.y, b.player.y)) mismatches.push(`player.y ${b.player.y} != ${node.player.y}`);
      if (node.player.hp !== b.player.hp) mismatches.push(`player.hp ${b.player.hp} != ${node.player.hp}`);
      if (!close(node.player.flow, b.player.flow, 0.001)) mismatches.push(`player.flow ${b.player.flow} != ${node.player.flow}`);
    }
    if (errors.length) mismatches.push(...errors.map((error) => `pageerror ${error}`));
    if (mismatches.length) throw new Error(mismatches.join('; '));

    report.push({
      name: spec.name,
      ok: true,
      durationTicks: browserResult.replay.durationTicks,
      eventCount: browserResult.replay.eventCount,
      inputBytes: browserResult.replay.inputBytes,
      score: node.score,
      worldDepth: node.worldDepth,
      stateHash: node.stateHash,
      browserPlayer: b.player,
      nodePlayer: node.player,
    });
  } catch (error) {
    failed = true;
    report.push({
      name: spec.name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      replay: browserResult?.replay ?? null,
      browserGame: browserResult?.game ?? null,
      node,
    });
  } finally {
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
if (failed) {
  console.error('Sylvaria v0.11 browser ↔ Node replay parity failed');
  for (const item of report.filter((entry) => !entry.ok)) console.error(` - ${item.name}: ${item.error}`);
  process.exit(1);
}
console.log(`Sylvaria v0.11 replay parity PASS: ${report.map((entry) => `${entry.name} ${entry.eventCount} events/${entry.durationTicks} ticks`).join(', ')} reproduced by the exact-source Node verifier.`);
