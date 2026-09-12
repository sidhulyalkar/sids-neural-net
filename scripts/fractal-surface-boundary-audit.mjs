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
      const experience = document.querySelector('[data-fractal-experience="v3"]');
      return (
        root?.getAttribute('data-fractal-morphology') === morph &&
        root?.getAttribute('data-fractal-boundary-policy') === 'circular-navigation-clip-v17' &&
        root?.getAttribute('data-fractal-responsive-viewport') === expectedViewport &&
        root?.getAttribute('data-fractal-decorative-boundary') === 'navigation-circle-v17' &&
        surface?.getAttribute('data-fractal-decorative-boundary') === 'navigation-circle-v17' &&
        experience?.getAttribute('data-fractal-decorative-boundary') === 'navigation-circle-v17'
      );
    },
    { morph: testCase.morph, expectedViewport }
  );

  const audit = await page.evaluate(() => {
    const root = document.querySelector('[data-fractal-morphology]');
    const surface = document.querySelector('[data-fractal-surface-enhancer="v2"]');
    const experience = document.querySelector('[data-fractal-experience="v3"]');
    if (
      !(root instanceof HTMLElement) ||
      !(surface instanceof HTMLCanvasElement) ||
      !(experience instanceof HTMLCanvasElement)
    ) {
      return { error: 'missing root or decorative canvas' };
    }

    const canvases = [
      { name: 'surface', canvas: surface },
      { name: 'experience', canvas: experience },
    ];
    const rootRect = root.getBoundingClientRect();
    const radius = Number(root.dataset.fractalDecorativeClipRadius);
    const centerX = Number(root.dataset.coreAnchorX);
    const centerY = Number(root.dataset.coreAnchorY);
    if (![radius, centerX, centerY].every(Number.isFinite)) {
      return { error: 'non-finite root boundary metadata', radius, centerX, centerY };
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

    const canvasReports = canvases.map(({ name, canvas }) => {
      const canvasRadius = Number(canvas.dataset.fractalDecorativeClipRadius);
      const computed = getComputedStyle(canvas);
      const clipPath = computed.clipPath || computed.getPropertyValue('-webkit-clip-path');
      const opacity = Number(computed.opacity);
      const prior = canvases.map(({ canvas: peer }) => ({
        canvas: peer,
        pointerEvents: peer.style.pointerEvents,
        zIndex: peer.style.zIndex,
      }));
      for (const state of prior) {
        state.canvas.style.pointerEvents = 'none';
      }
      canvas.style.pointerEvents = 'auto';
      canvas.style.zIndex = '2147483647';
      const insideHit = document.elementFromPoint(inside.x, inside.y) === canvas;
      const outsideHit = document.elementFromPoint(outside.x, outside.y) === canvas;
      for (const state of prior) {
        state.canvas.style.pointerEvents = state.pointerEvents;
        state.canvas.style.zIndex = state.zIndex;
      }

      return {
        name,
        canvasRadius,
        clipPath,
        opacity,
        insideHit,
        outsideHit,
        boundary: canvas.dataset.fractalDecorativeBoundary,
        clipCenter: canvas.dataset.fractalDecorativeClipCenter,
      };
    });

    return {
      radius,
      centerX,
      centerY,
      rootBoundary: root.dataset.fractalDecorativeBoundary,
      rootPolicy: root.dataset.fractalBoundaryPolicy,
      viewport: root.dataset.fractalResponsiveViewport,
      canvases: canvasReports,
    };
  });

  const label = `${testCase.morph}-${testCase.width}x${testCase.height}`;
  if (audit.error) failures.push(`${label}: ${audit.error}`);
  if (audit.rootPolicy !== 'circular-navigation-clip-v17') failures.push(`${label}: wrong root boundary policy ${audit.rootPolicy}`);
  if (audit.rootBoundary !== 'navigation-circle-v17') failures.push(`${label}: root decorative boundary is ${audit.rootBoundary}`);
  if (audit.viewport !== expectedViewport) failures.push(`${label}: decorative viewport is ${audit.viewport}`);
  if (!(audit.radius > 1)) failures.push(`${label}: invalid root radius ${audit.radius}`);

  for (const canvas of audit.canvases || []) {
    if (canvas.boundary !== 'navigation-circle-v17') failures.push(`${label} ${canvas.name}: boundary is ${canvas.boundary}`);
    if (Math.abs(audit.radius - canvas.canvasRadius) > 0.51) {
      failures.push(`${label} ${canvas.name}: radius ${canvas.canvasRadius} does not match root radius ${audit.radius}`);
    }
    if (!canvas.clipPath || canvas.clipPath === 'none' || !canvas.clipPath.startsWith('circle(')) {
      failures.push(`${label} ${canvas.name}: CSS clip-path is not a circle (${canvas.clipPath})`);
    }
    if (canvas.opacity < 0.99) failures.push(`${label} ${canvas.name}: canvas remained hidden at opacity ${canvas.opacity}`);
    if (!canvas.insideHit) failures.push(`${label} ${canvas.name}: clip-path rejected a safely interior point`);
    if (canvas.outsideHit) failures.push(`${label} ${canvas.name}: clip-path accepts a point outside the navigation circle`);
  }
  if ((audit.canvases || []).length !== 2) failures.push(`${label}: expected two decorative canvases in boundary audit`);

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

console.log('All decorative homepage canvases are clipped to the responsive navigation circle.');
