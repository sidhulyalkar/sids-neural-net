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
  { morphology: 'radial', name: 'radial-desktop', width: 1440, height: 900, minPaths: 130 },
  { morphology: 'radial', name: 'radial-short-landscape', width: 896, height: 414, minPaths: 180 },
  { morphology: 'coral', name: 'coral-desktop', width: 1440, height: 900, minPaths: 120 },
  { morphology: 'fan', name: 'fan-short-landscape', width: 812, height: 375, minPaths: 180 },
  { morphology: 'apical', name: 'apical-phone', width: 390, height: 844, minPaths: 130 },
  { morphology: 'spiraloid', name: 'spiraloid-ultrawide', width: 2560, height: 1080, minPaths: 130 },
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

  // Readiness deliberately waits only for the actual requested morphology and
  // V17 canvas. Final density, measured-obstacle, and clearance conditions are
  // assertions below, not prerequisites here, so a failure produces useful
  // metrics and screenshots instead of an opaque waitForFunction timeout.
  await page.waitForFunction(
    (morphology) => {
      const root = document.querySelector('[data-fractal-morphology]');
      return (
        root?.getAttribute('data-fractal-morphology') === morphology &&
        document.querySelector('[data-fractal-interior-density="v17"]') instanceof HTMLCanvasElement
      );
    },
    fixture.morphology
  );
  await page.waitForTimeout(500);

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

    const alphaAt = (x, y) => {
      const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x * dprX)));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y * dprY)));
      return image.data[(py * canvas.width + px) * 4 + 3];
    };

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

    const priorityIds = new Set(['frontier', 'research', 'visuals']);
    const destinationClearance = Array.from(
      document.querySelectorAll('[data-dendrite-destination]')
    ).map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error('Destination is not an HTMLElement');
      const id = element.dataset.dendriteDestination || 'unknown';
      const box = element.getBoundingClientRect();
      const local = {
        left: box.left - canvasRect.left,
        top: box.top - canvasRect.top,
        right: box.right - canvasRect.left,
        bottom: box.bottom - canvasRect.top,
      };
      const priority = priorityIds.has(id);
      // Audit a strict subset of the generator's larger no-fly geometry. This
      // avoids false positives at the outer antialiased boundary while proving
      // that no V17 pixels can scratch the UI box or occupy its final approach.
      const haloX = priority ? 12 : 9;
      const haloY = priority ? 9 : 7;
      const halo = {
        left: local.left - haloX,
        top: local.top - haloY,
        right: local.right + haloX,
        bottom: local.bottom + haloY,
      };
      let haloPixels = 0;
      for (let y = Math.max(0, Math.floor(halo.top)); y <= Math.min(canvasRect.height - 1, Math.ceil(halo.bottom)); y += 1) {
        for (let x = Math.max(0, Math.floor(halo.left)); x <= Math.min(canvasRect.width - 1, Math.ceil(halo.right)); x += 1) {
          if (alphaAt(x, y) >= 8) haloPixels += 1;
        }
      }

      const boxCenter = {
        x: (local.left + local.right) * 0.5,
        y: (local.top + local.bottom) * 0.5,
      };
      const towardCore = { x: center.x - boxCenter.x, y: center.y - boxCenter.y };
      const directionLength = Math.max(1, Math.hypot(towardCore.x, towardCore.y));
      const inward = { x: towardCore.x / directionLength, y: towardCore.y / directionLength };
      const halfWidth = (halo.right - halo.left) * 0.5;
      const halfHeight = (halo.bottom - halo.top) * 0.5;
      const tx = Math.abs(inward.x) > 1e-6 ? halfWidth / Math.abs(inward.x) : Number.POSITIVE_INFINITY;
      const ty = Math.abs(inward.y) > 1e-6 ? halfHeight / Math.abs(inward.y) : Number.POSITIVE_INFINITY;
      const edgeDistance = Math.min(tx, ty);
      const corridorStart = {
        x: boxCenter.x + inward.x * (edgeDistance + 2),
        y: boxCenter.y + inward.y * (edgeDistance + 2),
      };
      const corridorLength = priority ? 54 : 42;
      const corridorHalfWidth = priority ? 10 : 8;
      const corridorEnd = {
        x: corridorStart.x + inward.x * corridorLength,
        y: corridorStart.y + inward.y * corridorLength,
      };
      const corridorMinX = Math.max(0, Math.floor(Math.min(corridorStart.x, corridorEnd.x) - corridorHalfWidth));
      const corridorMaxX = Math.min(canvasRect.width - 1, Math.ceil(Math.max(corridorStart.x, corridorEnd.x) + corridorHalfWidth));
      const corridorMinY = Math.max(0, Math.floor(Math.min(corridorStart.y, corridorEnd.y) - corridorHalfWidth));
      const corridorMaxY = Math.min(canvasRect.height - 1, Math.ceil(Math.max(corridorStart.y, corridorEnd.y) + corridorHalfWidth));
      const axis = { x: corridorEnd.x - corridorStart.x, y: corridorEnd.y - corridorStart.y };
      const axisLengthSquared = Math.max(1, axis.x * axis.x + axis.y * axis.y);
      let corridorPixels = 0;
      for (let y = corridorMinY; y <= corridorMaxY; y += 1) {
        for (let x = corridorMinX; x <= corridorMaxX; x += 1) {
          const projection = Math.max(
            0,
            Math.min(
              1,
              ((x - corridorStart.x) * axis.x + (y - corridorStart.y) * axis.y) / axisLengthSquared
            )
          );
          const nearest = {
            x: corridorStart.x + axis.x * projection,
            y: corridorStart.y + axis.y * projection,
          };
          if (Math.hypot(x - nearest.x, y - nearest.y) > corridorHalfWidth) continue;
          if (alphaAt(x, y) >= 8) corridorPixels += 1;
        }
      }

      return {
        id,
        haloPixels,
        corridorPixels,
        rect: local,
        halo,
        corridor: { start: corridorStart, end: corridorEnd, halfWidth: corridorHalfWidth },
      };
    });

    return {
      pathCount: Number(root?.getAttribute('data-fractal-interior-path-count') || 0),
      densityMode: root?.getAttribute('data-fractal-interior-density'),
      destinationClearanceMode: root?.getAttribute('data-fractal-destination-clearance'),
      obstacleCount: Number(root?.getAttribute('data-fractal-destination-obstacle-count') || 0),
      paintedPixels,
      nearCorePixels,
      middleFieldPixels,
      sectorPixels,
      quadrantPixels,
      destinationClearance,
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
  if (metrics.destinationClearanceMode !== 'hard-exclusion-v17') {
    failures.push(`${fixture.name}: destination clearance did not become authoritative`);
  }
  if (metrics.obstacleCount !== 8 || metrics.destinationClearance.length !== 8) {
    failures.push(`${fixture.name}: expected 8 measured destination obstacles`);
  }
  for (const clearance of metrics.destinationClearance) {
    if (clearance.haloPixels > 0) {
      failures.push(`${fixture.name}: ${clearance.id} label halo contains ${clearance.haloPixels} V17 pixels`);
    }
    if (clearance.corridorPixels > 0) {
      failures.push(`${fixture.name}: ${clearance.id} docking corridor contains ${clearance.corridorPixels} V17 pixels`);
    }
  }
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

console.log(`V17 fractal density audit passed for ${reports.length} responsive fixtures with hard label clearance.`);
