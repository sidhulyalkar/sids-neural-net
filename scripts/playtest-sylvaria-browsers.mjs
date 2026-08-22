import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium, firefox, webkit } = requireFromPlaywright('playwright');

const baseUrl = process.env.ARCADE_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_BROWSER_DIR || 'artifacts/sylvaria-browser-matrix';
fs.mkdirSync(outputDir, { recursive: true });

const engines = [
  { name: 'chrome-stable', browserType: chromium, launchOptions: { channel: 'chrome' } },
  { name: 'chromium', browserType: chromium, launchOptions: {} },
  { name: 'firefox', browserType: firefox, launchOptions: {} },
  { name: 'webkit', browserType: webkit, launchOptions: {} },
];
const report = [];
let failed = false;

async function renderStats(frame) {
  return frame.evaluate(() => {
    const r = window.SylvariaPondRenderer?.snapshot?.();
    const canvas = document.querySelector('#pondCanvas');
    const gl = canvas?.getContext?.('webgl2');
    return {
      ...r,
      canvas: Boolean(canvas),
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      gl: Boolean(gl),
      renderer: gl ? String(gl.getParameter(gl.RENDERER) || 'unknown') : null,
      legacyOpacity: getComputedStyle(document.querySelector('#c')).opacity,
      kinetic: window.SylvariaKineticPresentation?.snapshot?.() || null,
    };
  });
}

async function waitFor(frame, fn, arg = null, timeout = 5000) {
  return frame.waitForFunction(fn, arg, { timeout });
}

async function dispatchKey(frame, type, key, code) {
  await frame.evaluate(
    ({ type, key, code }) => {
      const canvas = document.getElementById('c');
      canvas?.focus?.();
      const target = document.activeElement || canvas || document;
      target.dispatchEvent(
        new KeyboardEvent(type, {
          key,
          code,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { type, key, code },
  );
}

async function releaseQualificationKeys(frame) {
  for (const [key, code] of [
    [' ', 'Space'],
    ['w', 'KeyW'],
    ['a', 'KeyA'],
    ['s', 'KeyS'],
    ['d', 'KeyD'],
  ]) {
    await dispatchKey(frame, 'keyup', key, code).catch(() => {});
  }
}

for (const { name, browserType, launchOptions } of engines) {
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch({ headless: true, ...launchOptions });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    const response = await page.goto(`${baseUrl}/arcade/sylvaria`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`route returned ${response?.status() ?? 'no response'}`);

    const iframe = page.locator('iframe[title="Sylvaria game runtime"]');
    await iframe.waitFor({ state: 'visible' });
    const frame = page.frames().find((f) => f.url().includes('/game-runtimes/mosslight-v2/'));
    if (!frame) throw new Error('Sylvaria runtime iframe did not attach');

    try {
      await waitFor(
        frame,
        () =>
          window.__SIDS_GAME_NETWORK_BRIDGE__ === true &&
          window.__MOSSLIGHT_PLAYTEST__?.version === '0.13.0' &&
          window.SylvariaReplay?.version === '0.13.0' &&
          window.SylvariaKinetics?.version === '0.13.0' &&
          window.SylvariaKineticAI?.version === '0.13.0' &&
          window.SylvariaPondRenderer?.version === '0.12.0' &&
          window.SylvariaKineticPresentation?.version === '0.13.0',
        null,
        30000,
      );
    } catch (error) {
      const bootstrap = await frame
        .evaluate(() => ({
          playtest: window.__MOSSLIGHT_PLAYTEST__?.version || null,
          replay: window.SylvariaReplay?.version || null,
          kinetics: window.SylvariaKinetics?.version || null,
          ai: window.SylvariaKineticAI?.version || null,
          pond: window.SylvariaPondRenderer?.snapshot?.() || null,
          presentation: window.SylvariaKineticPresentation?.version || null,
          stage: window.__SYLVARIA_POND_BOOTSTRAP__ || null,
        }))
        .catch(() => null);
      throw new Error(`v0.13 bootstrap timeout: ${JSON.stringify(bootstrap)} · ${error.message}`);
    }

    // Force one presentation pass so the menu qualification does not depend on
    // browser-specific requestAnimationFrame scheduling in a headless iframe.
    await frame.evaluate(() => window.SylvariaPondRenderer?.render?.());
    await waitFor(frame, () => window.SylvariaPondRenderer?.snapshot?.().ready === true, null, 10000);

    const identity = await frame.evaluate(() => ({
      version: window.__MOSSLIGHT_PLAYTEST__.version,
      presentationVersion: window.__MOSSLIGHT_PLAYTEST__.presentationVersion,
      title: window.__MOSSLIGHT_PLAYTEST__.title,
      roomCount: window.__MOSSLIGHT_PLAYTEST__.roomCount,
      visual: window.__MOSSLIGHT_PLAYTEST__.snapshot().visual,
      replay: window.SylvariaReplay.snapshot(),
      kinetics: window.SylvariaKinetics.snapshot(),
      ai: window.SylvariaKineticAI.snapshot(),
      pond: window.SylvariaPondRenderer.snapshot(),
      fullscreen: Boolean(document.getElementById('immersiveBtn')),
      layout: (() => {
        const r = document.getElementById('c')?.getBoundingClientRect();
        return r ? { width: r.width, height: r.height, ratio: r.width / r.height } : null;
      })(),
      copy: {
        title: document.title,
        heading: document.querySelector('#title h1')?.textContent?.trim(),
        kicker: document.querySelector('#title .eyebrow')?.textContent?.trim(),
        lede: document.querySelector('#title .lede')?.textContent?.trim(),
      },
    }));

    if (
      identity.title !== 'Sylvaria' ||
      identity.version !== '0.13.0' ||
      identity.presentationVersion !== '0.13.0' ||
      identity.replay.schema !== 2
    ) {
      throw new Error(`identity mismatch ${JSON.stringify(identity)}`);
    }
    if (identity.roomCount !== 30) throw new Error(`authored room count mismatch ${identity.roomCount}`);
    for (const flag of [
      'expandedArenas',
      'minimalPresentation',
      'deterministicReplay',
      'frogPond',
      'webgl2Pond',
      'continuousGlide',
      'chargedOmniDash',
      'exponentialDash',
      'bufferedDash',
      'dashBladeCancel',
      'kineticTongueArc',
      'reactiveBladeParry',
      'proceduralBladeTrail',
      'selectiveHitStop',
      'tangentReflection',
      'predictiveArcEvasion',
      'expandedEnemyRoster',
      'currentStreams',
    ]) {
      if (!identity.visual?.[flag]) throw new Error(`visual/runtime contract missing ${flag}`);
    }
    if (identity.pond.mode !== 'webgl2' || !identity.pond.ready) {
      throw new Error(`WebGL2 pond renderer unavailable: ${JSON.stringify(identity.pond)}`);
    }
    if (!identity.fullscreen) throw new Error('fullscreen control missing');
    if (!identity.layout || Math.abs(identity.layout.ratio - 1.5) > 0.02) {
      throw new Error(`playfield lost 3:2 ratio ${JSON.stringify(identity.layout)}`);
    }
    if (
      identity.copy.title !== 'Sylvaria · Kinetic Pond' ||
      identity.copy.heading !== 'Sylvaria' ||
      !/v0\.13 · kinetic arc/i.test(identity.copy.kicker || '') ||
      !/opening edge/i.test(identity.copy.lede || '')
    ) {
      throw new Error(`Reactive Blade title copy mismatch ${JSON.stringify(identity.copy)}`);
    }

    const titleRender = await renderStats(frame);
    if (!titleRender.gl || titleRender.sprites < 5 || titleRender.lights < 1 || titleRender.legacyOpacity !== '0') {
      throw new Error(`title renderer underqualified ${JSON.stringify(titleRender)}`);
    }

    await frame.locator('#start').click();
    await waitFor(frame, () => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing', null, 5000);
    const authoredStart = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
    if (!authoredStart.enemies?.some((e) => e.kineticType === 'skimmer')) {
      throw new Error(`room 1 did not receive Skimmer pressure ${JSON.stringify(authoredStart.enemies)}`);
    }

    // Movement qualification happens in a deterministic, obstacle-free lane.
    // This isolates the input/kinetic contract from authored-room collisions and
    // prevents a perfectly valid short dash from ending before the assertion samples it.
    const before = await frame.evaluate(() => {
      const playtest = window.__MOSSLIGHT_PLAYTEST__;
      playtest.clearCombatants();
      playtest.labClearGeometry();
      playtest.setPlayerPosition(360, 320);
      window.Sylvaria091.state.roomClearTimer = -1000;
      document.getElementById('c')?.focus?.();
      return playtest.snapshot();
    });

    await dispatchKey(frame, 'keydown', 'd', 'KeyD');
    await waitFor(
      frame,
      ({ startX }) => {
        const game = window.__MOSSLIGHT_PLAYTEST__.snapshot();
        const kinetics = window.SylvariaKinetics.snapshot();
        return (game.player?.x ?? 0) > startX + 18 && (kinetics.velocity?.speed ?? 0) >= 90;
      },
      { startX: before.player?.x ?? 0 },
      2500,
    );
    const glide = await frame.evaluate(() => ({
      game: window.__MOSSLIGHT_PLAYTEST__.snapshot(),
      kinetics: window.SylvariaKinetics.snapshot(),
    }));
    if (glide.game.stats.dashes !== before.stats.dashes) {
      throw new Error(`held movement incorrectly counted as dash ${before.stats.dashes}->${glide.game.stats.dashes}`);
    }

    await dispatchKey(frame, 'keydown', 'w', 'KeyW');
    await waitFor(
      frame,
      () => {
        const velocity = window.SylvariaKinetics.snapshot().velocity;
        return Math.abs(velocity?.x ?? 0) >= 50 && Math.abs(velocity?.y ?? 0) >= 50;
      },
      null,
      2000,
    );
    const diagonal = await frame.evaluate(() => window.SylvariaKinetics.snapshot());

    await dispatchKey(frame, 'keydown', ' ', 'Space');
    await waitFor(
      frame,
      () => {
        const kinetics = window.SylvariaKinetics.snapshot();
        return kinetics.dashCharging && kinetics.dashCharge >= 0.25;
      },
      null,
      2000,
    );
    const charging = await frame.evaluate(() => window.SylvariaKinetics.snapshot());

    await dispatchKey(frame, 'keyup', ' ', 'Space');
    await waitFor(
      frame,
      (dashesBefore) => {
        const game = window.__MOSSLIGHT_PLAYTEST__.snapshot();
        const kinetics = window.SylvariaKinetics.snapshot();
        return game.stats.dashes > dashesBefore && kinetics.dashing && (kinetics.dash?.speed ?? 0) >= 400;
      },
      before.stats.dashes,
      1500,
    );
    const burst = await frame.evaluate(() => ({
      game: window.__MOSSLIGHT_PLAYTEST__.snapshot(),
      kinetics: window.SylvariaKinetics.snapshot(),
    }));
    if (burst.game.stats.dashes < before.stats.dashes + 1) throw new Error('charge release did not count one dash');
    if ((burst.kinetics.dash?.speed ?? 0) < 400) {
      throw new Error(`charged burst did not exceed glide speed ${JSON.stringify(burst.kinetics)}`);
    }

    await dispatchKey(frame, 'keyup', 'w', 'KeyW');
    await dispatchKey(frame, 'keyup', 'd', 'KeyD');

    const cutsBefore = burst.game.stats.cuts;
    await dispatchKey(frame, 'keydown', 'ArrowUp', 'ArrowUp');
    await dispatchKey(frame, 'keyup', 'ArrowUp', 'ArrowUp');
    await waitFor(
      frame,
      (cuts) =>
        window.__MOSSLIGHT_PLAYTEST__.snapshot().stats.cuts > cuts &&
        window.SylvariaKineticPresentation?.snapshot?.().renderedArcs > 0,
      cutsBefore,
      1200,
    );
    const arc = await frame.evaluate(() => ({
      game: window.__MOSSLIGHT_PLAYTEST__.snapshot(),
      kinetics: window.SylvariaKinetics.snapshot(),
      presentation: window.SylvariaKineticPresentation.snapshot(),
      slashes: window.Sylvaria091.state.slashes.map((s) => ({
        kind: s.kind,
        phase: s.phase,
        angle: s.angle,
        start: s.startAngle,
        end: s.endAngle,
        parryWindow: s.parryWindow,
      })),
    }));
    if (arc.game.stats.cuts <= cutsBefore) throw new Error('ArrowUp did not register tongue sweep');
    if (!arc.presentation.overlay) throw new Error('kinetic arc overlay missing');
    if (!arc.slashes.some((s) => s.kind === 'arc' && Math.abs((s.parryWindow || 0) - 5 / 120) < 1e-6)) {
      throw new Error(`five-tick parry window missing from live arc ${JSON.stringify(arc.slashes)}`);
    }

    // Restore the authored first pond before visual capture. Browser mechanics are
    // tested in the lab lane, while the screenshot still qualifies the real room.
    await frame.evaluate(() => {
      window.__MOSSLIGHT_PLAYTEST__.setRoom(0, 1);
      window.SylvariaPondRenderer?.render?.();
    });
    await waitFor(
      frame,
      () => {
        const render = window.SylvariaPondRenderer?.snapshot?.();
        return render?.ready === true && render.sprites >= 10 && render.lights >= 1;
      },
      null,
      2000,
    );
    const after = await frame.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
    const playRender = await renderStats(frame);
    if (!playRender.ready || playRender.mode !== 'webgl2' || playRender.sprites < 10 || playRender.lights < 1) {
      throw new Error(`pond renderer under-rendered ${JSON.stringify(playRender)}`);
    }

    await page.screenshot({ path: path.join(outputDir, `${name}-reactive-blade-v013.png`), fullPage: true });
    report.push({
      name,
      ok: true,
      identity,
      titleRender,
      playRender,
      glide: {
        dx: (glide.game.player?.x ?? 0) - (before.player?.x ?? 0),
        speed: glide.kinetics.velocity?.speed,
      },
      diagonal: diagonal.velocity,
      charging: { charge: charging.dashCharge },
      burst: {
        speed: burst.kinetics.dash?.speed ?? burst.kinetics.velocity?.speed,
        dash: burst.kinetics.dash,
        dashes: burst.game.stats.dashes - before.stats.dashes,
      },
      arc,
      finalFps: after.fps,
    });
  } catch (error) {
    failed = true;
    report.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      errors,
    });
  } finally {
    if (browser) {
      const pages = browser.contexts().flatMap((context) => context.pages());
      for (const page of pages) {
        const frame = page.frames().find((f) => f.url().includes('/game-runtimes/mosslight-v2/'));
        if (frame) await releaseQualificationKeys(frame).catch(() => {});
      }
    }
    await browser?.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
if (failed) {
  console.error('Sylvaria v0.13 Reactive Blade cross-browser matrix failed');
  for (const r of report.filter((x) => !x.ok)) console.error(` - ${r.name}: ${r.error}`);
  process.exit(1);
}
console.log(
  `Sylvaria v0.13 browser matrix PASS: ${report.map((r) => r.name).join(', ')}; WebGL2 pond, continuous glide, diagonal steering, exponential charged dash, five-tick Reactive Blade arc, and kinetic enemy roster verified.`,
);
