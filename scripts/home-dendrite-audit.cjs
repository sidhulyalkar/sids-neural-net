const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const url = process.env.HOME_DENDRITE_AUDIT_URL || 'http://127.0.0.1:3000/';
const outputDir = join(process.cwd(), 'artifacts', 'browser-smoke');

const VIEWPORTS = [
  { name: 'phone-compact', width: 360, height: 640 },
  { name: 'phone-tall', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ultrawide', width: 1920, height: 1080 },
];

const EXPECTED_BRANCH_LINKS = {
  projects: '/projects',
  publications: '/publications',
  work: '/case-studies',
  photography: '/photography',
  ideas: '/ideas',
  contact: '/contact',
};

const EXPECTED_PORTALS = {
  cyan: '/frontier',
  violet: '/arcade',
};

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
      await page.waitForSelector('[data-home-dendrite="original-six"]', { timeout: 10000 });
      await page.waitForSelector('[data-home-dendrite-label="projects"]', { timeout: 10000 });
      await page.waitForSelector('[data-home-portal="cyan"]', { timeout: 10000 });
      await page.waitForTimeout(250);

      const state = await page.evaluate(({ expectedBranchLinks, expectedPortals }) => {
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

        const root = document.querySelector('[data-home-dendrite="original-six"]');
        const canvas = document.querySelector('[data-home-dendrite-canvas]');
        const labels = [...document.querySelectorAll('[data-home-dendrite-label]')];
        const portals = [...document.querySelectorAll('[data-home-portal]')];
        const core = document.querySelector('[data-home-core]');
        const soma = document.querySelector('[data-home-soma]');
        const title = [...document.querySelectorAll('h1')].find((node) => node.textContent?.includes('SIDHARTH HULYALKAR'));

        return {
          rootRect: rectFor(root),
          canvasRect: rectFor(canvas),
          coreRect: rectFor(core),
          somaRect: rectFor(soma),
          titleRect: rectFor(title),
          labels: labels.map((node) => ({
            id: node.getAttribute('data-home-dendrite-label'),
            href: node.getAttribute('href'),
            text: node.textContent?.trim() || '',
            gestureTarget: node.hasAttribute('data-gesture-target'),
            rect: rectFor(node),
          })),
          portals: portals.map((node) => ({
            tone: node.getAttribute('data-home-portal'),
            href: node.getAttribute('href'),
            text: node.textContent?.replace(/\s+/g, ' ').trim() || '',
            ariaLabel: node.getAttribute('aria-label'),
            gestureTarget: node.hasAttribute('data-gesture-target'),
            rect: rectFor(node),
          })),
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          expectedBranchLinks,
          expectedPortals,
        };
      }, { expectedBranchLinks: EXPECTED_BRANCH_LINKS, expectedPortals: EXPECTED_PORTALS });

      const labelById = new Map(state.labels.map((entry) => [entry.id, entry]));
      const portalByTone = new Map(state.portals.map((entry) => [entry.tone, entry]));
      const missingLabels = Object.entries(EXPECTED_BRANCH_LINKS)
        .filter(([id, href]) => labelById.get(id)?.href !== href)
        .map(([id]) => id);
      const missingPortals = Object.entries(EXPECTED_PORTALS)
        .filter(([tone, href]) => portalByTone.get(tone)?.href !== href)
        .map(([tone]) => tone);

      const interactive = [...state.labels, ...state.portals];
      const clipped = interactive.filter(({ rect }) =>
        !rect ||
        rect.left < -1 ||
        rect.top < -1 ||
        rect.right > viewport.width + 1 ||
        rect.bottom > viewport.height + 1
      );
      const missingGestureTargets = interactive.filter((entry) => !entry.gestureTarget);
      const overlapPairs = [];
      for (let i = 0; i < interactive.length; i += 1) {
        for (let j = i + 1; j < interactive.length; j += 1) {
          const a = interactive[i];
          const b = interactive[j];
          if (a.rect && b.rect && rectsOverlap(a.rect, b.rect, 2)) {
            overlapPairs.push([
              a.id || `portal:${a.tone}`,
              b.id || `portal:${b.tone}`,
            ]);
          }
        }
      }

      const portalCoreCollisions = state.coreRect
        ? state.portals.filter(({ rect }) => rect && rectsOverlap(rect, state.coreRect, 4)).map(({ tone }) => tone)
        : ['missing-core'];
      const titleCollisions = state.titleRect
        ? interactive.filter(({ rect }) => rect && rectsOverlap(rect, state.titleRect, 4)).map((entry) => entry.id || `portal:${entry.tone}`)
        : ['missing-title'];

      const canvasCoversViewport = Boolean(
        state.canvasRect &&
        state.canvasRect.width >= viewport.width - 1 &&
        state.canvasRect.height >= viewport.height - 1
      );
      const rootCoversViewport = Boolean(
        state.rootRect &&
        state.rootRect.width >= viewport.width - 1 &&
        state.rootRect.height >= viewport.height - 1
      );
      const somaVisible = Boolean(
        state.somaRect &&
        state.somaRect.width > 0 &&
        state.somaRect.height > 0 &&
        state.somaRect.left >= -1 &&
        state.somaRect.right <= viewport.width + 1 &&
        state.somaRect.top >= -1 &&
        state.somaRect.bottom <= viewport.height + 1
      );
      const overflowX = state.scrollWidth > state.innerWidth + 1;
      const overflowY = state.scrollHeight > state.innerHeight + 1;

      const passed =
        state.labels.length === 6 &&
        state.portals.length === 2 &&
        missingLabels.length === 0 &&
        missingPortals.length === 0 &&
        clipped.length === 0 &&
        missingGestureTargets.length === 0 &&
        overlapPairs.length === 0 &&
        portalCoreCollisions.length === 0 &&
        titleCollisions.length === 0 &&
        canvasCoversViewport &&
        rootCoversViewport &&
        somaVisible &&
        !overflowX &&
        !overflowY &&
        pageErrors.length === 0 &&
        consoleErrors.length === 0;

      report.passed = report.passed && passed;
      report.viewports.push({
        ...viewport,
        passed,
        labelCount: state.labels.length,
        portalCount: state.portals.length,
        missingLabels,
        missingPortals,
        clipped: clipped.map((entry) => entry.id || `portal:${entry.tone}`),
        missingGestureTargets: missingGestureTargets.map((entry) => entry.id || `portal:${entry.tone}`),
        overlapPairs,
        portalCoreCollisions,
        titleCollisions,
        canvasCoversViewport,
        rootCoversViewport,
        somaVisible,
        overflowX,
        overflowY,
        pageErrors,
        consoleErrors,
        labels: state.labels,
        portals: state.portals,
      });

      await page.screenshot({
        path: join(outputDir, `home-dendrite-${viewport.name}.png`),
        fullPage: true,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(outputDir, 'home-dendrite-audit.json'), JSON.stringify(report, null, 2));

  if (!report.passed) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(`Original dendritic homepage audit passed across ${report.viewports.length} viewport classes.`);
})();
