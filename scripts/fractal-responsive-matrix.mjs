import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.FRACTAL_HOME_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.FRACTAL_RESPONSIVE_MATRIX_DIR || 'artifacts/adaptive-fractal-home/responsive-matrix';
fs.mkdirSync(outputDir, { recursive: true });

const morphologies = ['radial', 'coral', 'fan', 'apical', 'spiraloid', 'echo-nest'];
const viewports = [
  { name: 'tiny-phone', width: 320, height: 568, capture: true },
  { name: 'small-phone', width: 360, height: 640, capture: false },
  { name: 'phone', width: 390, height: 844, capture: true },
  { name: 'large-phone', width: 430, height: 932, capture: false },
  { name: 'short-landscape', width: 812, height: 375, capture: true },
  { name: 'large-short-landscape', width: 896, height: 414, capture: false },
  { name: 'portrait-tablet', width: 768, height: 1024, capture: false },
  { name: 'landscape-tablet', width: 1024, height: 768, capture: false },
  { name: 'small-laptop', width: 1280, height: 720, capture: false },
  { name: 'laptop', width: 1366, height: 768, capture: false },
  { name: 'desktop', width: 1440, height: 900, capture: true },
  { name: 'fullhd', width: 1920, height: 1080, capture: false },
  { name: 'ultrawide', width: 2560, height: 1080, capture: true },
  { name: 'wide-4k-class', width: 3440, height: 1440, capture: false },
];

function overlap(a, b, inset = 0) {
  const left = Math.max(a.x + inset, b.x + inset);
  const right = Math.min(a.x + a.width - inset, b.x + b.width - inset);
  const top = Math.max(a.y + inset, b.y + inset);
  const bottom = Math.min(a.y + a.height - inset, b.y + b.height - inset);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function center(box) {
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
}

const browser = await chromium.launch({ headless: true });
const failures = [];
const reports = [];

for (const morph of morphologies) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/?morph=${morph}&seed=responsive-v16-browser-matrix`, { waitUntil: 'networkidle' });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const expectedViewport = `${viewport.width}x${viewport.height}`;
    await page.waitForFunction(
      ({ expectedMorph, expectedViewport }) => {
        const root = document.querySelector('[data-fractal-morphology]');
        return (
          root?.getAttribute('data-fractal-morphology') === expectedMorph &&
          root?.getAttribute('data-fractal-responsive-envelope') === 'v16' &&
          root?.getAttribute('data-fractal-responsive-viewport') === expectedViewport
        );
      },
      { expectedMorph: morph, expectedViewport }
    );
    await page.waitForTimeout(50);

    const root = page.locator('[data-fractal-morphology]');
    const canvas = page.locator('[data-fractal-responsive-canvas="v16"]');
    const links = page.locator('[data-dendrite-destination]');
    const core = page.locator('[data-core-proxy="v13"]');
    const identity = page.locator('[data-home-identity-responsive="v16"]');

    if ((await canvas.count()) !== 1 || !(await canvas.isVisible())) {
      failures.push(`${morph} ${viewport.name}: responsive canvas missing`);
    }
    if ((await links.count()) !== 8) {
      failures.push(`${morph} ${viewport.name}: expected 8 destination controls, got ${await links.count()}`);
      continue;
    }

    const fieldScaleX = Number(await root.getAttribute('data-fractal-field-scale-x'));
    const fieldScaleY = Number(await root.getAttribute('data-fractal-field-scale-y'));
    const boundaryPolicy = await root.getAttribute('data-fractal-boundary-policy');
    const navigationDensity = await root.getAttribute('data-fractal-navigation-density');
    if (!(fieldScaleX >= 0.8 && fieldScaleX <= 0.92)) {
      failures.push(`${morph} ${viewport.name}: invalid fieldScaleX ${fieldScaleX}`);
    }
    if (!(fieldScaleY >= 0.79 && fieldScaleY <= 0.91)) {
      failures.push(`${morph} ${viewport.name}: invalid fieldScaleY ${fieldScaleY}`);
    }
    if (boundaryPolicy !== 'elliptic-radial-cap-v16') {
      failures.push(`${morph} ${viewport.name}: boundary policy is ${boundaryPolicy}`);
    }
    const shouldCompact = viewport.width < 720 || viewport.height < 620;
    if ((navigationDensity === 'compact-v16') !== shouldCompact) {
      failures.push(`${morph} ${viewport.name}: navigation density ${navigationDensity} does not match viewport`);
    }

    const boxes = [];
    for (let index = 0; index < 8; index += 1) {
      const link = links.nth(index);
      const box = await link.boundingBox();
      if (!box) {
        failures.push(`${morph} ${viewport.name}: destination ${index} has no box`);
        continue;
      }
      const edgeReserve = viewport.width <= 360 ? 3 : 5;
      if (
        box.x < edgeReserve ||
        box.y < edgeReserve ||
        box.x + box.width > viewport.width - edgeReserve ||
        box.y + box.height > viewport.height - edgeReserve
      ) {
        failures.push(`${morph} ${viewport.name}: destination ${index} escaped ${edgeReserve}px viewport reserve`);
      }
      boxes.push(box);
    }

    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        if (overlap(boxes[a], boxes[b], 1) > 1) {
          failures.push(`${morph} ${viewport.name}: destinations ${a} and ${b} overlap`);
        }
      }
    }

    const coreBox = await core.boundingBox();
    if (!coreBox) failures.push(`${morph} ${viewport.name}: CORE proxy missing`);
    else {
      for (let index = 0; index < boxes.length; index += 1) {
        if (overlap(coreBox, boxes[index], -4) > 1) {
          failures.push(`${morph} ${viewport.name}: destination ${index} collides with CORE`);
        }
      }
    }

    const identityBox = await identity.boundingBox();
    if (identityBox) {
      for (let index = 0; index < boxes.length; index += 1) {
        if (overlap(identityBox, boxes[index], 1) > 1) {
          failures.push(`${morph} ${viewport.name}: destination ${index} collides with identity lockup`);
        }
      }
    }

    const before = boxes.map(center);
    await page.waitForTimeout(160);
    const after = [];
    for (let index = 0; index < 8; index += 1) {
      const box = await links.nth(index).boundingBox();
      if (box) after.push(center(box));
    }
    if (before.length === after.length) {
      const maxDrift = Math.max(...before.map((point, index) => Math.hypot(point.x - after[index].x, point.y - after[index].y)));
      if (maxDrift > 0.85) failures.push(`${morph} ${viewport.name}: resize layout kept drifting (${maxDrift.toFixed(2)}px)`);
    }

    if (viewport.capture) {
      await page.screenshot({
        path: path.join(outputDir, `${morph}-${viewport.name}-${viewport.width}x${viewport.height}.png`),
      });
    }

    reports.push({
      morph,
      ...viewport,
      fieldScaleX,
      fieldScaleY,
      navigationDensity,
      coreCenter: coreBox ? center(coreBox) : null,
      linkCenters: boxes.map(center),
    });
  }

  if (pageErrors.length) failures.push(`${morph}: page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) failures.push(`${morph}: console errors: ${consoleErrors.join(' | ')}`);
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(outputDir, 'responsive-matrix-report.json'), `${JSON.stringify({ failures, reports }, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Responsive fractal matrix PASS: ${morphologies.length} morphologies × ${viewports.length} viewport states.`);
