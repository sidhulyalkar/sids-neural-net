const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const url = process.env.HOME_RADIAL_AUDIT_URL || 'http://127.0.0.1:3000/';
const outputDir = join(process.cwd(), 'artifacts', 'browser-smoke');

const VIEWPORTS = [
  { name: 'phone-compact', width: 360, height: 640 },
  { name: 'phone-tall', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ultrawide', width: 1920, height: 1080 },
];

const EXPECTED_DESTINATIONS = [
  'frontier',
  'games',
  'builds',
  'systems',
  'contact',
  'visuals',
  'research',
  'papers',
];

function rectsOverlap(a, b, padding = 2) {
  return !(
    a.right + padding <= b.left ||
    b.right + padding <= a.left ||
    a.bottom + padding <= b.top ||
    b.bottom + padding <= a.top
  );
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { url, passed: true, viewports: [] };

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-home-branch-count="8"]', { timeout: 10000 });
      await page.waitForSelector('[data-dendrite-destination="frontier"]', { timeout: 10000 });
      await page.waitForTimeout(200);

      const state = await page.evaluate((expected) => {
        const root = document.querySelector('[data-home-branch-count]');
        const nodes = [...document.querySelectorAll('[data-dendrite-destination]')];
        const title = [...document.querySelectorAll('h1')].find((node) =>
          node.textContent?.includes('SIDHARTH HULYALKAR')
        );
        const core = [...document.querySelectorAll('a[href="/about"]')].find((node) =>
          node.textContent?.trim().toLowerCase() === 'core'
        );

        const rectFor = (element) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        };

        return {
          branchCount: Number(root?.getAttribute('data-home-branch-count') || 0),
          destinations: nodes.map((node) => ({
            id: node.getAttribute('data-dendrite-destination'),
            href: node.getAttribute('href'),
            text: node.textContent?.trim() || '',
            rect: rectFor(node),
          })),
          titleRect: rectFor(title),
          coreRect: rectFor(core),
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          expected,
        };
      }, EXPECTED_DESTINATIONS);

      const ids = state.destinations.map((destination) => destination.id).filter(Boolean);
      const missing = EXPECTED_DESTINATIONS.filter((id) => !ids.includes(id));
      const extras = ids.filter((id) => !EXPECTED_DESTINATIONS.includes(id));
      const clipped = state.destinations.filter(({ rect }) =>
        !rect ||
        rect.left < -1 ||
        rect.top < -1 ||
        rect.right > viewport.width + 1 ||
        rect.bottom > viewport.height + 1
      );
      const overlapPairs = [];

      for (let i = 0; i < state.destinations.length; i += 1) {
        for (let j = i + 1; j < state.destinations.length; j += 1) {
          const a = state.destinations[i];
          const b = state.destinations[j];
          if (a.rect && b.rect && rectsOverlap(a.rect, b.rect, 3)) {
            overlapPairs.push([a.id, b.id]);
          }
        }
      }

      const titleCollisions = state.titleRect
        ? state.destinations
            .filter(({ rect }) => rect && rectsOverlap(rect, state.titleRect, 6))
            .map(({ id }) => id)
        : ['missing-title'];
      const coreCollisions = state.coreRect
        ? state.destinations
            .filter(({ rect }) => rect && rectsOverlap(rect, state.coreRect, 6))
            .map(({ id }) => id)
        : ['missing-core'];
      const overflowX = state.scrollWidth > state.innerWidth + 1;
      const overflowY = state.scrollHeight > state.innerHeight + 1;

      const passed =
        state.branchCount === 8 &&
        state.destinations.length === 8 &&
        missing.length === 0 &&
        extras.length === 0 &&
        clipped.length === 0 &&
        overlapPairs.length === 0 &&
        titleCollisions.length === 0 &&
        coreCollisions.length === 0 &&
        !overflowX &&
        !overflowY &&
        pageErrors.length === 0 &&
        consoleErrors.length === 0;

      report.passed = report.passed && passed;
      report.viewports.push({
        ...viewport,
        passed,
        branchCount: state.branchCount,
        destinationCount: state.destinations.length,
        missing,
        extras,
        clipped: clipped.map(({ id }) => id),
        overlapPairs,
        titleCollisions,
        coreCollisions,
        overflowX,
        overflowY,
        pageErrors,
        consoleErrors,
        destinations: state.destinations,
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(outputDir, 'home-radial-audit.json'), JSON.stringify(report, null, 2));

  if (!report.passed) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(
    `Eight-way homepage audit passed across ${report.viewports.length} viewport classes.`
  );
})();
