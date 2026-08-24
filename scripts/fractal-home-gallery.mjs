import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.FRACTAL_HOME_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.FRACTAL_HOME_GALLERY_DIR || 'artifacts/adaptive-fractal-home/gallery';
fs.mkdirSync(outputDir, { recursive: true });

const cases = [
  { morph: 'radial', width: 1920, height: 1080 },
  { morph: 'coral', width: 1920, height: 1080 },
  { morph: 'fan', width: 2560, height: 1080 },
  { morph: 'spiraloid', width: 1024, height: 1024 },
  { morph: 'halo', width: 390, height: 844 },
  { morph: 'echidna', width: 430, height: 932 },
  { morph: 'apical', width: 430, height: 932 },
  { morph: 'pixel-ghost', width: 800, height: 800 },
  { morph: 'echo-nest', width: 1440, height: 900 },
  { morph: 'echo-nest', width: 2560, height: 1080 },
];

const removedMorphologies = ['aurora', 'mycelial', 'tectonic'];
const browser = await chromium.launch({ headless: true });
const failures = [];
const reports = [];

async function waitForThemeRecorder(page, morph) {
  await page.waitForFunction(
    ({ expectedMorph, key }) => {
      const value = window.sessionStorage.getItem(key);
      if (!value) return false;
      try {
        return JSON.parse(value)?.morphology === expectedMorph;
      } catch {
        return false;
      }
    },
    { expectedMorph: morph, key: 'sid:fractal-theme:v1' }
  );
}

for (const testCase of cases) {
  const page = await browser.newPage({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const url = `${baseUrl}/?morph=${encodeURIComponent(testCase.morph)}&seed=gallery-v13-crisp-topology`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const root = page.locator('[data-fractal-morphology]');
  await root.waitFor({ state: 'visible' });
  await page.waitForFunction(
    (morph) => document.querySelector('[data-fractal-morphology]')?.getAttribute('data-fractal-morphology') === morph,
    testCase.morph
  );
  await waitForThemeRecorder(page, testCase.morph);

  const crispCanvas = page.locator('[data-fractal-crisp-topology="v13"]');
  await crispCanvas.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const rootNode = document.querySelector('[data-fractal-morphology]');
    return (
      rootNode?.getAttribute('data-primary-routing') === 'core-and-label-edge-v13' &&
      rootNode?.getAttribute('data-topology-repair') === 'snap-prune-v13' &&
      rootNode?.getAttribute('data-core-clearance') === 'circle-edge-v13' &&
      rootNode?.getAttribute('data-render-fidelity') === 'crisp-no-glow-v13'
    );
  });

  const actualMorph = await root.getAttribute('data-fractal-morphology');
  const primaryRouting = await root.getAttribute('data-primary-routing');
  const coreRouting = await root.getAttribute('data-core-routing');
  const topologyRepair = await root.getAttribute('data-topology-repair');
  const coreClearance = await root.getAttribute('data-core-clearance');
  const renderFidelity = await root.getAttribute('data-render-fidelity');
  const links = page.locator('[data-dendrite-destination]');
  const linkCount = await links.count();
  const protectedControls = page.locator('[data-navigation-clearance="protected"]');
  const protectedCount = await protectedControls.count();

  const boxes = [];
  for (let index = 0; index < linkCount; index += 1) {
    const link = links.nth(index);
    const box = await link.boundingBox();
    if (!box) continue;
    boxes.push(box);
    const inside =
      box.x >= -0.5 &&
      box.y >= -0.5 &&
      box.x + box.width <= testCase.width + 0.5 &&
      box.y + box.height <= testCase.height + 0.5;
    if (!inside) failures.push(`${testCase.morph}: destination ${index} escaped viewport`);
    if ((await link.getAttribute('data-navigation-clearance')) !== 'protected') {
      failures.push(`${testCase.morph}: destination ${index} missing protected clearance`);
    }
  }

  if (actualMorph !== testCase.morph) failures.push(`${testCase.morph}: rendered ${actualMorph}`);
  if (primaryRouting !== 'core-and-label-edge-v13') {
    failures.push(`${testCase.morph}: exact CORE/label edge routing missing`);
  }
  if (topologyRepair !== 'snap-prune-v13') {
    failures.push(`${testCase.morph}: topology snap/prune repair missing`);
  }
  if (coreClearance !== 'circle-edge-v13') {
    failures.push(`${testCase.morph}: circular CORE clearance missing`);
  }
  if (renderFidelity !== 'crisp-no-glow-v13') {
    failures.push(`${testCase.morph}: crisp no-glow renderer missing`);
  }
  if (coreRouting !== 'fixed-center-circle-v1') {
    failures.push(`${testCase.morph}: fixed center CORE routing missing`);
  }
  if (linkCount !== 8) failures.push(`${testCase.morph}: expected 8 destinations, got ${linkCount}`);
  if (protectedCount !== 9) failures.push(`${testCase.morph}: expected 9 protected controls, got ${protectedCount}`);
  if (pageErrors.length) failures.push(`${testCase.morph}: page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) failures.push(`${testCase.morph}: console errors: ${consoleErrors.join(' | ')}`);

  const baseCanvas = page.locator('[data-superseded-by-crisp-topology="v13"]');
  if ((await baseCanvas.count()) !== 1) {
    failures.push(`${testCase.morph}: legacy soft renderer was not superseded exactly once`);
  } else {
    const opacity = await baseCanvas.evaluate((element) => getComputedStyle(element).opacity);
    if (Number(opacity) > 0.001) failures.push(`${testCase.morph}: legacy renderer opacity remained ${opacity}`);
  }

  const core = page.locator('a[href="/about"][data-core-placement="fixed-center-circle-v1"][data-core-shape="circle"]');
  await core.waitFor({ state: 'visible' });
  const coreMask = page.locator('[data-core-clearance-mask="circle-edge-v13"]');
  await coreMask.waitFor({ state: 'visible' });
  const coreBox = await core.boundingBox();
  const coreMaskBox = await coreMask.boundingBox();
  let coreAnchorError = null;
  let coreDiameter = null;
  if (!coreBox || !coreMaskBox) {
    failures.push(`${testCase.morph}: fixed circular CORE or clearance mask missing`);
  } else {
    coreDiameter = (coreBox.width + coreBox.height) * 0.5;
    if (Math.abs(coreBox.width - coreBox.height) > 1.1) {
      failures.push(`${testCase.morph}: CORE is not circular (${coreBox.width.toFixed(1)}x${coreBox.height.toFixed(1)})`);
    }
    if (coreDiameter < 44 || coreDiameter > 58) {
      failures.push(`${testCase.morph}: CORE diameter ${coreDiameter.toFixed(1)}px outside compact design bounds`);
    }
    const coreCenterX = coreBox.x + coreBox.width * 0.5;
    const coreCenterY = coreBox.y + coreBox.height * 0.5;
    const maskCenterX = coreMaskBox.x + coreMaskBox.width * 0.5;
    const maskCenterY = coreMaskBox.y + coreMaskBox.height * 0.5;
    const maskDrift = Math.hypot(maskCenterX - coreCenterX, maskCenterY - coreCenterY);
    if (maskDrift > 1.2) failures.push(`${testCase.morph}: CORE clearance mask drifted ${maskDrift.toFixed(2)}px`);

    const anchorX = Number(await root.getAttribute('data-core-anchor-x'));
    const anchorY = Number(await root.getAttribute('data-core-anchor-y'));
    if (Number.isFinite(anchorX) && Number.isFinite(anchorY)) {
      coreAnchorError = Math.hypot(coreCenterX - anchorX, coreCenterY - anchorY);
      if (coreAnchorError > 2.5) {
        failures.push(`${testCase.morph}: CORE drifted ${coreAnchorError.toFixed(2)}px from tree center`);
      }
    } else {
      failures.push(`${testCase.morph}: CORE center metadata missing`);
    }
  }

  const minX = boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((box) => box.x + box.width)) : 0;
  const span = maxX - minX;
  if (testCase.width >= 1400 && span < testCase.width * 0.66) {
    failures.push(`${testCase.morph}: horizontal destination span only ${Math.round(span)}px`);
  }

  let echoNestLayout = null;
  if (testCase.morph === 'echo-nest') {
    const experience = page.locator('[data-fractal-experience="v3"]');
    await experience.waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelector('[data-fractal-experience="v3"]')?.getAttribute('data-echo-nest-layout') === 'fermat-core-centered-v2'
    );
    echoNestLayout = await experience.getAttribute('data-echo-nest-layout');
    if (echoNestLayout !== 'fermat-core-centered-v2') {
      failures.push(`${testCase.morph}: expected CORE-centered Fermat layout, got ${echoNestLayout}`);
    }
  }

  const filename = `${testCase.morph}-${testCase.width}x${testCase.height}.png`;
  await page.screenshot({ path: path.join(outputDir, filename) });
  reports.push({
    ...testCase,
    actualMorph,
    linkCount,
    protectedCount,
    primaryRouting,
    coreRouting,
    topologyRepair,
    coreClearance,
    renderFidelity,
    coreAnchorError,
    coreDiameter,
    echoNestLayout,
    horizontalDestinationSpan: span,
    filename,
  });
  await page.close();
}

for (const removedMorph of removedMorphologies) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/?morph=${removedMorph}&seed=removed-v13-crisp-topology`, { waitUntil: 'networkidle' });
  const root = page.locator('[data-fractal-morphology]');
  await root.waitFor({ state: 'visible' });
  if (removedMorph === 'tectonic') {
    await page.waitForFunction(
      () => document.querySelector('[data-fractal-morphology]')?.getAttribute('data-fractal-morphology') === 'echo-nest'
    );
  }
  const actualMorph = await root.getAttribute('data-fractal-morphology');
  if (!actualMorph || actualMorph === removedMorph) {
    failures.push(`${removedMorph}: removed morphology remained publicly renderable`);
  }
  reports.push({ morph: removedMorph, removed: true, actualMorph });
  await page.close();
}

const echoCases = [
  { morph: 'echo-nest', path: '/contact', width: 1440, height: 900, filename: 'theme-echo-contact-echo-nest.png', expectNoFrontier: true },
  { morph: 'fan', path: '/archive', width: 1440, height: 900, filename: 'theme-echo-archive-fan.png', expectNoFrontier: false },
];

for (const echoCase of echoCases) {
  const page = await browser.newPage({ viewport: { width: echoCase.width, height: echoCase.height }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?morph=${echoCase.morph}&seed=theme-echo-browser`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    (morph) => document.querySelector('[data-fractal-morphology]')?.getAttribute('data-fractal-morphology') === morph,
    echoCase.morph
  );
  await waitForThemeRecorder(page, echoCase.morph);
  await page.goto(`${baseUrl}${echoCase.path}`, { waitUntil: 'domcontentloaded' });

  const background = page.locator(
    `[data-fractal-theme-echo="background"][data-fractal-theme-morphology="${echoCase.morph}"]`
  );
  await background.waitFor({ state: 'visible' });
  const glyph = page.locator('[data-fractal-theme-echo="glyph"]');
  await glyph.waitFor({ state: 'visible' });

  if (echoCase.expectNoFrontier && (await page.locator('a[href="/frontier"]').count()) !== 0) {
    failures.push(`${echoCase.path}: redundant FRONTIER shortcut remained visible`);
  }
  if (pageErrors.length) failures.push(`${echoCase.path}: page errors: ${pageErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(outputDir, echoCase.filename) });
  reports.push({
    morph: echoCase.morph,
    path: echoCase.path,
    themeEcho: true,
    backgroundMorphology: await background.getAttribute('data-fractal-theme-morphology'),
    glyphCount: await glyph.count(),
    filename: echoCase.filename,
  });
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(outputDir, 'gallery-report.json'), `${JSON.stringify({ failures, reports }, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Captured ${cases.length} curated fractal fixtures, verified ${removedMorphologies.length} removals, and audited ${echoCases.length} themed subpages with exact CORE/label edge termination, topology repair, and crisp no-glow dendrites.`
);