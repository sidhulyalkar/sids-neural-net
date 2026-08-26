import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');

const baseUrl = process.env.FRACTAL_HOME_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.FRACTAL_DENSITY_V17_DIR || 'artifacts/adaptive-fractal-home/density-v17';
fs.mkdirSync(outputDir, { recursive: true });

const cases = [
  { morphology: 'radial', name: 'radial-desktop', width: 1440, height: 900, minPaths: 150 },
  { morphology: 'radial', name: 'radial-short-landscape', width: 896, height: 414, minPaths: 210 },
  { morphology: 'coral', name: 'coral-desktop', width: 1440, height: 900, minPaths: 140 },
  { morphology: 'fan', name: 'fan-short-landscape', width: 812, height: 375, minPaths: 210 },
  { morphology: 'apical', name: 'apical-phone', width: 390, height: 844, minPaths: 150 },
  { morphology: 'spiraloid', name: 'spiraloid-ultrawide', width: 2560, height: 1080, minPaths: 150 },
];

const browser = await chromium.launch({ headless: true });
const reports = [];
const failures = [];

for (const fixture of cases) {
  const page = await browser.newPage({
    viewport: { width: fixture.width, height: fixture.height },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(
    `${baseUrl}/?morph=${fixture.morphology}&seed=density-v17-browser-audit`,
    { waitUntil: 'networkidle' }
  );

  await page.waitForFunction(
    ({ morphology, minPaths }) => {
      const root = document.querySelector('[data-fractal-morphology]');
      const count = Number(root?.getAttribute('data-fractal-interior-path-count') || 0);
      return (
        root?.getAttribute('data-fractal-morphology') === morphology &&
        root?.getAttribute('data-fractal-interior-density') === 'adaptive-canopy-v17' &&
        count >= minPaths &&
        document.querySelector('[data-fractal-interior-density="v17"]') instanceof HTMLCanvasElement
      );
    },
    { morphology: fixture.morphology, minPaths: fixture.minPaths }
  );
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('[data-fractal-morphology]');
    const canvas = document.querySelector('[data-fractal-interior-density="v17"]');
    const core = document.querySelector('[data-core-proxy="v13"]');
    if (!(canvas instanceof HTMLCanvasElement) || !(core instanceof HTMLElement)) {
      throw new Error('V17 density canvas or CORE proxy is missing');
    }
    const context = canvas.getContext('2d');
    if (!context) throw new Error('V17 density canvas has no 2D context');

    const canvasRect = canvas.getBoundingClientRect();
    const coreRect = core.getBoundingClientRect();
    const center = {
      x: coreRect.left + coreRect.width * 0.5 - canvasRect.left,
      y: coreRect.top + coreRect.height * 0.5 - canvasRect.top,
    };
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const dprX = canvas.width / Math.max(1, canvasRect.width);
    const dprY = canvas.height / Math.max(1, canvasRect.height);
    const sectorPixels = Array.from({ length: 8 }, () => 0);
    const quadrantPixels = Array.from({ length: 4 }, () => 0);
    let paintedPixels = 0;
    let nearCorePixels = 0;
    let middleFieldPixels = 0;

    const stride = 2;
    for (let py = 0; py < canvas.height; py += stride) {
      for (let px = 0; px < canvas.width; px += stride) {
        const alpha = image.data[(py * canvas.width + px) * 4 + 3];
        if (alpha < 10) continue;
        paintedPixels += 1;
        const x = px / dprX;
        const y = py / dprY;
        const dx = x - center.x;
        const dy = y - center.y;
        const radius = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
        const sector = Math.floor((angle / (Math.PI * 2)) * 8) % 8;
        sectorPixels[sector] += 1;
        const quadrant = dx >= 0 ? (dy >= 0 ? 0 : 3) : dy >= 0 ? 1 : 2;
        quadrantPixels[quadrant] += 1;
        if (radius >= 42 && radius <= Math.min(canvasRect.width, canvasRect.height) * 0.24) nearCorePixels += 1;
        if (
          radius > Math.min(canvasRect.width, canvasRect.height) * 0.24 &&
          radius <= Math.min(canvasRect.width, canvasRect.height) * 0.48
        ) {
          middleFieldPixels += 1;
        }
      }
    }

    return {
      pathCount: Number(root?.getAttribute('data-fractal-interior-path-count') || 0),
      densityMode: root?.getAttribute('data-fractal-interior-density'),
      paintedPixels,
      nearCorePixels,
      middleFieldPixels,
      sectorPixels,
      quadrantPixels,
      canvas: { width: canvasRect.width, height: canvasRect.height },
    };
  });

  const emptySectors = metrics.sectorPixels.filter((count) => count < 8).length;
  const emptyQuadrants = metrics.quadrantPixels.filter((count) => count < 20).length;
  if (metrics.pathCount < fixture.minPaths) failures.push(`${fixture.name}: only ${metrics.pathCount} density paths`);
  if (metrics.nearCorePixels < 25) failures.push(`${fixture.name}: interior near CORE remains visually empty`);
  if (metrics.middleFieldPixels < 70) failures.push(`${fixture.name}: middle field remains visually under-filled`);
  if (emptySectors > 0) failures.push(`${fixture.name}: ${emptySectors} angular sectors lack V17 pixels`);
  if (emptyQuadrants > 0) failures.push(`${fixture.name}: ${emptyQuadrants} quadrants lack V17 pixels`);
  if (pageErrors.length) failures.push(`${fixture.name}: page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) failures.push(`${fixture.name}: console errors: ${consoleErrors.join(' | ')}`);

  const screenshotPath = path.join(outputDir, `${fixture.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  reports.push({ ...fixture, ...metrics, pageErrors, consoleErrors, screenshotPath });
  await page.close();
}

await browser.close();

fs.writeFileSync(
  path.join(outputDir, 'report.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), reports, failures }, null, 2)
);

if (failures.length) {
  console.error('V17 fractal density audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`V17 fractal density audit passed for ${reports.length} responsive fixtures.`);
