import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.FRACTAL_HOME_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.FRACTAL_SURFACE_BOUNDARY_DIR || 'artifacts/adaptive-fractal-home/surface-boundary';
fs.mkdirSync(outputDir, { recursive: true });

const cases = [
  { morph: 'echo-nest', width: 1440, height: 900 },
  { morph: 'echo-nest', width: 2560, height: 1080 },
  { morph: 'spiraloid', width: 1024, height: 1024 },
  { morph: 'spiraloid', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
const reports = [];

for (const testCase of cases) {
  const page = await browser.newPage({
    viewport: { width: testCase.width, height: testCase.height },
    deviceScaleFactor: 1,
  });
  const expectedViewport = `${testCase.width}x${testCase.height}`;
  const seed = `surface-boundary-v17-${testCase.width}x${testCase.height}`;
  await page.goto(`${baseUrl}/?morph=${testCase.morph}&seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    ({ morph, expectedViewport }) => {
      const root = document.querySelector('[data-fractal-morphology]');
      const surface = document.querySelector('[data-fractal-surface-enhancer="v2"]');
      return (
        root?.getAttribute('data-fractal-morphology') === morph &&
        root?.getAttribute('data-fractal-boundary-policy') === 'circular-navigation-clip-v17' &&
        root?.getAttribute('data-fractal-responsive-viewport') === expectedViewport &&
        surface?.getAttribute('data-fractal-surface-boundary') === 'navigation-circle-v17'
      );
    },
    { morph: testCase.morph, expectedViewport }
  );

  const audit = await page.evaluate(() => {
    const root = document.querySelector('[data-fractal-morphology]');
    const canvas = document.querySelector('[data-fractal-surface-enhancer="v2"]');
    if (!(root instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      return { error: 'missing root or surface enhancer canvas' };
    }

    const rootRect = root.getBoundingClientRect();
    const radius = Number(root.dataset.fractalDecorativeClipRadius);
    const centerX = Number(root.dataset.coreAnchorX);
    const centerY = Number(root.dataset.coreAnchorY);
    const surfaceRadius = Number(canvas.dataset.fractalSurfaceClipRadius);
    const computed = getComputedStyle(canvas);
    const clipPath = computed.clipPath || computed.getPropertyValue('-webkit-clip-path');
    const opacity = Number(computed.opacity);

    if (![radius, centerX, centerY, surfaceRadius].every(Number.isFinite)) {
      return { error: 'non-finite boundary metadata', radius, centerX, centerY, surfaceRadius, clipPath, opacity };
    }

    const absoluteCenterX = rootRect.left + centerX;
    const absoluteCenterY = rootRect.top + centerY;
    const angle = Math.PI / 4;
    const insideDistance = Math.max(8, radius * 0.55);
    const outsideDistance = radius + 18;
    const inside = {
      x: absoluteCenterX + Math.cos(angle) * insideDistance,
      y: absoluteCenterY + Math.sin(angle) * insideDistance,
    };
    const outside = {
      x: absoluteCenterX + Math.cos(angle) * outsideDistance,
      y: absoluteCenterY + Math.sin(angle) * outsideDistance,
    };

    const previousPointerEvents = canvas.style.pointerEvents;
    const previousZIndex = canvas.style.zIndex;
    canvas.style.pointerEvents = 'auto';
    canvas.style.zIndex = '2147483647';
    const insideHit = document.elementFromPoint(inside.x, inside.y) === canvas;
    const outsideHit = document.elementFromPoint(outside.x, outside.y) === canvas;
    canvas.style.pointerEvents = previousPointerEvents;
    canvas.style.zIndex = previousZIndex;

    return {
      radius,
      surfaceRadius,
      centerX,
      centerY,
      clipPath,
      opacity,
      insideHit,
      outsideHit,
      boundary: canvas.dataset.fractalSurfaceBoundary,
      rootPolicy: root.dataset.fractalBoundaryPolicy,
      viewport: root.dataset.fractalResponsiveViewport,
    };
  });

  const label = `${testCase.morph}-${testCase.width}x${testCase.height}`;
  if (audit.error) failures.push(`${label}: ${audit.error}`);
  if (audit.rootPolicy !== 'circular-navigation-clip-v17') failures.push(`${label}: wrong root boundary policy ${audit.rootPolicy}`);
  if (audit.boundary !== 'navigation-circle-v17') failures.push(`${label}: surface boundary is ${audit.boundary}`);
  if (audit.viewport !== expectedViewport) failures.push(`${label}: surface viewport is ${audit.viewport}`);
  if (!(audit.radius > 1) || Math.abs(audit.radius - audit.surfaceRadius) > 0.51) {
    failures.push(`${label}: surface radius ${audit.surfaceRadius} does not match root radius ${audit.radius}`);
  }
  if (!audit.clipPath || audit.clipPath === 'none' || !audit.clipPath.startsWith('circle(')) {
    failures.push(`${label}: CSS clip-path is not a circle (${audit.clipPath})`);
  }
  if (audit.opacity < 0.99) failures.push(`${label}: surface enhancer remained hidden at opacity ${audit.opacity}`);
  if (!audit.insideHit) failures.push(`${label}: clip-path rejected a point safely inside the navigation circle`);
  if (audit.outsideHit) failures.push(`${label}: clip-path still accepts a point outside the navigation circle`);

  await page.screenshot({ path: path.join(outputDir, `${label}.png`) });
  reports.push({ ...testCase, ...audit });
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(outputDir, 'surface-boundary-report.json'), `${JSON.stringify({ failures, reports }, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Surface enhancer is clipped to the responsive navigation circle across audited morphologies and viewports.');
