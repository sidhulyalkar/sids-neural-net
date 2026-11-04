const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');

const TARGET = process.env.FRONTIER_FOCUS_AUDIT_URL || 'http://127.0.0.1:3000/frontier';
const FIRST_PAINT_BUDGET_MS = 9000;

async function audit(width, height) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  const errors = [];
  const feedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/frontier/feed')) feedRequests.push(request.url());
  });
  // Freeze the optional background updater for first-paint and rating tests.
  // auditBackgroundLatest explicitly exercises the positive update path below.
  await page.route('**/api/frontier/feed?latest=1', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'X-Frontier-Live': 'snapshot-fallback' },
    body: JSON.stringify({ generatedAt: new Date().toISOString(), items: [], sources: [] }),
  }));
  const t0 = Date.now();
  try {
    const response = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: FIRST_PAINT_BUDGET_MS });
    assert(response?.ok(), 'Focused reader route must serve HTTP 200');
    await page.locator('section[aria-label="Frontier focused reader"]').waitFor({ timeout: FIRST_PAINT_BUDGET_MS });
    await page.locator('article h1').first().waitFor({ timeout: FIRST_PAINT_BUDGET_MS });
    const firstPaintMs = Date.now() - t0;
    assert(firstPaintMs <= FIRST_PAINT_BUDGET_MS, 'First readable story exceeded budget');
    const heading = await page.locator('article h1').first().textContent();
    assert(heading?.trim(), 'The first article must have a real title on initial navigation');
    if (width <= 390) {
      const geometry = await page.evaluate(() => {
        const controls = document.querySelector('nav[aria-label="Article navigation"]');
        const story = document.querySelector('article [data-frontier-source-image]');
        const controlsRect = controls?.getBoundingClientRect();
        const storyRect = story?.getBoundingClientRect();
        return {
          controlsBottom: controlsRect?.bottom ?? null,
          contentTop: storyRect?.top ?? null,
          controlsWidth: controlsRect?.width ?? null,
          viewportWidth: innerWidth,
        };
      });
      assert(geometry.controlsBottom !== null && geometry.contentTop !== null
        && geometry.controlsBottom <= geometry.contentTop + 2,
        'Mobile navigation must not cover source-backed story content: ' + JSON.stringify(geometry));
      assert(geometry.controlsWidth <= geometry.viewportWidth,
        'Mobile controls may not overflow horizontally: ' + JSON.stringify(geometry));
    }
    // Wait for the actual media paint when possible; a screenshot of the
    // loading placeholder is not evidence of image rendering quality.
    if (await page.locator('figure img').count()) {
      await page.waitForFunction(() => {
        const img = document.querySelector('figure img');
        return !img || img.getAttribute('data-frontier-media-ready') === 'true';
      }, undefined, { timeout: 3500 }).catch(() => {});
    }
    // Capture the *real archived first story* in addition to the controlled
    // cross-format fixtures. This makes image sizing and textual hierarchy
    // reviewable without a hand-maintained or fabricated article.
    mkdirSync('artifacts/browser-smoke/frontier-first-story', { recursive: true });
    await page.screenshot({
      path: 'artifacts/browser-smoke/frontier-first-story/' + width + '-' + height + '.png',
      fullPage: true, animations: 'disabled',
    });
    assert.equal(await page.locator('article').count(), 1, 'Never mount a whole off-screen feed');
    assert((await page.locator('figure img').count()) <= 1, 'Figure tabs cannot mount every source image');
    assert((await page.locator('figure img').count()) <= 1, 'Only the current source image is mounted');
    assert.equal(await page.locator('canvas').count(), 0, 'Default reader must not initialize WebGL/canvas');
    const uncachedRequests = feedRequests.filter((url) => !url.includes('latest=1'));
    assert.equal(uncachedRequests.length, 0,
      'Initial navigation must use the server snapshot, never the expensive live-search graph');
    assert(feedRequests.filter((url) => url.includes('latest=1')).length <= 1,
      'An old snapshot may trigger at most one nonblocking cached-latest lookup');

    // Nav labels differ visually across sizes; use the stable accessible name.
    // Contents is only a navigational index: it never mounts a second article
    // or additional figure, and jumping deep in the edition preserves order.
    const contentsToggle = page.getByRole('button', { name: 'Browse edition' });
    await contentsToggle.click();
    assert.equal(await contentsToggle.getAttribute('aria-expanded'), 'true');
    const contents = page.locator('[data-frontier-contents-panel="true"]');
    assert.equal(await contents.count(), 1, 'Exactly one edition contents panel');
    assert.equal(await contents.getAttribute('aria-modal'), 'true',
      'Contents must expose a modal focus boundary to assistive technology');
    assert((await contents.locator('[data-frontier-contents-entry]').count()) >= 3,
      'Edition contents must include the available curated stories');
    const exploreLink = contents.getByRole('link', { name: /Explore the full frontier/i });
    await exploreLink.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Close edition contents', 'Keyboard focus must wrap within the contents modal');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await exploreLink.evaluate((element) => document.activeElement === element), true,
      'Reverse tab must wrap to the final navigable link');
    await contents.locator('[data-frontier-contents-entry="2"]').click();
    assert.equal(await contents.count(), 0, 'Contents closes after a direct jump');
    assert.notEqual(await page.locator('article h1').first().textContent(), heading,
      'Jumping to a story must change the focused article');
    await page.waitForFunction(() => document.activeElement === document.querySelector('article h1'),
      undefined, { timeout: 2500 });
    assert.equal(await page.locator('article').count(), 1, 'Contents must never mount hidden articles');
    assert((await page.locator('figure img').count()) <= 1, 'Contents cannot duplicate media');
    await contentsToggle.click();
    await page.locator('[data-frontier-contents-entry="0"]').click();
    assert.equal(await page.locator('article h1').first().textContent(), heading,
      'Return to opening story must retain original editorial order');
    await contentsToggle.click();
    await page.keyboard.press('Escape');
    assert.equal(await contents.count(), 0, 'Escape must close the contents modal');
    assert.equal(await contentsToggle.evaluate((element) => document.activeElement === element), true,
      'Escape should restore focus to the Contents toggle');

    const nextButton = page.locator('[data-frontier-next="true"]');
    assert((await nextButton.textContent())?.trim() === 'Next', 'Snapshot should include multiple articles, got: ' + (await nextButton.textContent()));
    assert(await nextButton.isEnabled(), 'Daily edition should contain multiple navigable articles');
    await nextButton.click();
    await page.waitForFunction((prior) => document.querySelector('article h1')?.textContent !== prior, heading);
    assert.equal(await page.locator('article').count(), 1, 'Navigation must replace, not append, articles');
    const back = page.locator('[data-frontier-previous="true"]');
    await back.click();
    assert.equal(await page.locator('article h1').first().textContent(), heading);

    const signal = page.locator('[data-frontier-signal]');
    const rating = page.getByRole('slider', { name: 'Rate how interesting this story is' });
    assert.equal(await signal.count(), 1, 'Exactly one signal constellation is mounted');
    assert.equal(await rating.count(), 1, 'One native accessible rating control, no extra precision popup');
    assert.equal(await page.locator('[data-frontier-balloon]').count(), 0, 'Old hold-to-charge orb is removed');
    assert.equal(await page.getByText('Choose exact score').count(), 0, 'Exact scoring must not be buried in details');
    assert.equal(await page.locator('footer').count(), 0, 'Reader must not render a bulky bottom navigation footer');
    assert.equal(await page.getByText('A quiet space for what is new').count(), 0);
    assert.equal(await page.locator('article h1').count(), 1);
    const navigationArea = page.locator('nav[aria-label="Article navigation"]');
    assert.equal(await navigationArea.count(), 1);
    const image = page.locator('figure img').first();
    if (await image.count()) {
      const sizing = await image.evaluate((el) => ({ fit: getComputedStyle(el).objectFit,
        naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight }));
      assert.equal(sizing.fit, 'contain', 'Never crop original source photos');
    }
    assert.equal(await signal.getAttribute('data-frontier-signal'), 'idle');
    assert.equal(await rating.getAttribute('min'), '1');
    assert.equal(await rating.getAttribute('max'), '10');
    assert.equal(await signal.locator('svg circle').count(), 20, 'Ten nodes with ten understated halos');
    assert.equal(await page.locator('[aria-label="Source-grounded summary"]').count(), 1);
    assert((await page.locator('[aria-label="Source metrics"]').count()) <= 1);

    // Exact pointer mapping follows the constellation's real rendered nodes,
    // not arbitrary native range thumb offsets. Verify both ends and a drag.
    await rating.scrollIntoViewIfNeeded();
    const rect = await rating.boundingBox();
    assert(rect && rect.width >= 190 && rect.height >= 44, 'Minimum comfortable touch area');
    const graph = await rating.evaluate((element) => {
      const area = element.parentElement.getBoundingClientRect();
      return { left: area.left, width: area.width, y: area.top + area.height / 2 };
    });
    const pointX = (score) => graph.left + graph.width * (20 + (score - 1) * 320 / 9) / 360;
    await page.mouse.click(pointX(1), graph.y);
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === '1');
    assert.equal(await rating.inputValue(), '1');
    await page.mouse.click(pointX(10), graph.y);
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === '10');
    assert.equal(await rating.inputValue(), '10');
    await page.mouse.move(pointX(1), graph.y);
    await page.mouse.down();
    await page.mouse.move(pointX(7), graph.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === '7');
    assert.equal(await rating.inputValue(), '7');
    assert.equal(await signal.locator('[data-frontier-active-tip="true"]').count(), 1,
      'Exactly the selected constellation point receives the active highlight');
    assert.equal(await signal.getAttribute('data-frontier-signal'), 'rated');
    assert.equal(await signal.getByText('1 · Not for me').count(), 1);
    assert.equal(await signal.getByText('10 · Fascinating').count(), 1);
    assert.equal(await signal.locator('[data-frontier-focus-mode]').getAttribute('data-frontier-focus-mode'), 'pointer',
      'Mouse input must not display the entire keyboard-focus frame');
    mkdirSync('artifacts/browser-smoke/frontier-signal-trail', { recursive: true });
    // Full-page capture from a scrolled viewport can falsely composite the
    // offscreen global skip-link over the headline. Capture from top instead.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'artifacts/browser-smoke/frontier-signal-trail/rated-7-' + width + '.png',
      fullPage: true, animations: 'disabled',
    });

    // Keyboard has direct access to every step on the same input.
    await rating.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await signal.locator('[data-frontier-focus-mode]').getAttribute('data-frontier-focus-mode'), 'keyboard',
      'Keyboard score adjustment keeps a visible, deliberate focus indicator');
    assert.equal(await rating.inputValue(), '9');
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === '9');
    assert.equal(await signal.locator('svg [data-active="true"]').count(), 9);

    if (width <= 390) {
      const geometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
      }));
      assert(geometry.documentWidth <= geometry.viewportWidth + 2,
        'Mobile focus reader must not require sideways scrolling: ' + JSON.stringify(geometry));
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('article h1').first().waitFor();
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === '9',
      undefined, { timeout: 4000 });
    await page.waitForTimeout(1_200);
    const candidateLookups = feedRequests.filter((url) => url.includes('candidates=1'));
    assert.equal(candidateLookups.length, 1,
      'Returning reader should load the wider public snapshot once, after first paint');
    const beforeRevision = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state);
    const revised = page.getByRole('slider', { name: 'Rate how interesting this story is' });
    await revised.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    assert.equal(await revised.inputValue(), '2');
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === '2');
    const afterRevision = await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state);
    assert.equal(afterRevision.profile.meaningfulInteractions, beforeRevision.profile.meaningfulInteractions,
      'Revising a rating cannot add another learned interaction');
    assert.equal(afterRevision.game.xp, beforeRevision.game.xp,
      'Revising a rating cannot award the same item XP again');
    const updated = Object.values(afterRevision.history).find((entry) => entry.item.title === heading && entry.interestScore === 2);
    assert.equal(updated?.reaction, 'down', 'The numeric revision must replace the canonical coarse preference');
    assert.deepEqual(errors, [], 'No browser JavaScript exceptions allowed');
    return { width, height, firstPaintMs, initialUncachedRequests: 0,
      backgroundCachedRequests: feedRequests.filter((url) => url.includes('latest=1')).length,
      singleArticle: true, ratingPersisted: true, revisionReplacedVote: true, widerCandidateLookups: 1 };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function auditBackgroundLatest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 700 }, reducedMotion: 'reduce' });
  try {
    const base = new URL(TARGET);
    const snapshotResponse = await page.request.get(base.origin + '/api/frontier/feed');
    assert(snapshotResponse.ok(), 'Snapshot fixture must be available for cached edition test');
    const snapshot = await snapshotResponse.json();
    if (Date.now() - Date.parse(snapshot.generatedAt) <= 30 * 60_000) {
      return { skipped: true, reason: 'Snapshot is still fresh: background update correctly not required' };
    }
    assert(snapshot.items.length > 2, 'Needs at least three credible source fixtures');
    const updatedAt = new Date().toISOString();
    const newItem = {
      ...snapshot.items[0],
      id: 'frontier-cache-audit-new-article',
      title: 'Newly discovered article from verified source',
      publishedAt: updatedAt,
      url: 'https://github.com/allenai/olmo',
      sourceKind: 'github',
      source: 'github.com',
      sourceLabel: 'GitHub',
    };
    let hits = 0;
    await page.route('**/api/frontier/feed?latest=1', async (route) => {
      hits += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Frontier-Live': 'cached-latest' },
        body: JSON.stringify({
          generatedAt: updatedAt,
          items: [newItem, ...snapshot.items.slice(0, 30)],
          sources: snapshot.sources,
        }),
      });
    });
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
    await page.locator('article h1').waitFor();
    const initial = await page.locator('article h1').textContent();
    // This is deliberately BEFORE any user action. A quietly reading person
    // must never see their article replaced just because the cache refreshed.
    await page.getByRole('button', { name: 'Open latest discovered articles' }).waitFor({ timeout: 8000 });
    assert.equal(await page.locator('article h1').textContent(), initial,
      'Background revalidation must not replace an untouched article');
    await page.locator('[data-frontier-next="true"]').click();
    await page.locator('[data-frontier-previous="true"]').click();
    assert.equal(await page.locator('article h1').textContent(), initial,
      'Background revalidation must not replace an article after interaction');
    assert.equal(hits, 1, 'At most one cache lookup per visit; no polling');
    await page.getByRole('button', { name: 'Open latest discovered articles' }).click();
    assert.equal(await page.locator('section[data-frontier-edition-at]').getAttribute('data-frontier-edition-at'), updatedAt,
      'Applying cached edition must update provenance timestamp');
    assert.equal(await page.locator('article').count(), 1, 'Cached edition must still mount one article');
    const viewport = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
    assert(viewport.documentWidth <= viewport.viewportWidth + 2,
      'Latest-ready controls must fit narrow mobile layout: ' + JSON.stringify(viewport));
    return { cachedLatestLookups: hits, preservesActiveArticle: true, appliesOnRequest: true };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function auditSourceOnlyPresentation() {
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const width of [1280, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      try {
        const base = new URL(TARGET);
        const response = await page.request.get(base.origin + '/api/frontier/feed');
        assert(response.ok(), 'Source-only fixture requires a valid snapshot');
        const snapshot = await response.json();
        assert(snapshot.items?.length, 'Source-only fixture requires a real publisher item');
        // Strip only the media from one real source record. This tests the
        // layout without creating fictitious reporting or source citations.
        const fixture = {
          ...snapshot.items[0],
          id: 'frontier-source-only-layout-audit',
          media: { type: 'none' },
          figures: [],
        };
        await page.route('**/api/frontier/feed?latest=1', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'X-Frontier-Live': 'cached-latest' },
            body: JSON.stringify({ generatedAt: new Date().toISOString(), items: [fixture], sources: [] }),
          });
        });
        await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Refresh live edition' }).click();
        const textFirst = page.locator('[data-frontier-source-image="false"]');
        await textFirst.waitFor({ timeout: 8000 });
        assert.equal(await page.locator('article').count(), 1);
        assert.equal(await page.locator('figure img').count(), 0);
        assert.equal(await textFirst.locator('figure').count(), 0,
          'Text-only stories must not mount a hidden decorative figure');
        assert.equal(await page.locator('article h1').count(), 1);
        const layout = await textFirst.evaluate((element) => {
          const title = document.querySelector('article h1').getBoundingClientRect();
          const lead = element.querySelector('section[aria-label="Source-grounded summary"]').getBoundingClientRect();
          const figure = element.querySelector('figure');
          return {
            hiddenCover: figure ? getComputedStyle(figure).display === 'none' : true,
            contentWidth: element.getBoundingClientRect().width,
            leadGap: Math.round(lead.top - title.bottom),
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
          };
        });
        assert(layout.hiddenCover, 'Missing source imagery must not reserve decorative space');
        assert(layout.leadGap < 130, 'Source synopsis must follow headline promptly: ' + JSON.stringify(layout));
        assert(layout.contentWidth <= 762, 'Source-only text should remain readable, not span the whole desktop');
        assert(layout.documentWidth <= layout.viewportWidth + 2,
          'Source-only layout must not overflow horizontally: ' + JSON.stringify(layout));
        results.push({ width, evidenceFirstWithoutArt: true, ...layout });
      } finally {
        await page.close();
      }
    }
    return results;
  } finally {
    await browser.close();
  }
}

async function auditFormatAwareEvidence() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 800 }, reducedMotion: 'reduce' });
  try {
    const base = new URL(TARGET);
    const snapshotResponse = await page.request.get(base.origin + '/api/frontier/feed');
    assert(snapshotResponse.ok(), 'Format audit needs a real snapshot');
    const snapshot = await snapshotResponse.json();
    assert(snapshot.items?.length > 0, 'Format audit needs at least one genuine source record');
    const original = snapshot.items[0];
    const researchSource = snapshot.items.find((item) =>
      item.sourceKind === 'openalex' && /(?:…|\.\.\.)\s*$/.test(item.summary || '')
    ) || snapshot.items.find((item) => item.sourceKind === 'openalex') || original;
    const researchAction = /(?:\.pdf|\/pdf)(?:[?#]|$)/i.test(researchSource.url)
      ? 'Read original PDF'
      : /^https:\/\/(?:www\.)?openalex\.org\//i.test(researchSource.url)
        ? 'Open research record' : 'Read original publication';
    const fixtures = [
      {
        id: 'frontier-format-audit-research', sourceKind: 'openalex', expected: 'research',
        summaryLabel: 'Abstract / source excerpt', action: researchAction,
        metrics: [{ label: 'citations', value: '0' }], activity: 'Citation activity',
        sportsState: undefined,
      },
      {
        id: 'frontier-format-audit-code', sourceKind: 'github', expected: 'repository',
        summaryLabel: 'Repository description', action: 'View repository',
        metrics: [{ label: 'stars', value: '180' }, { label: 'latency', value: '24 ms' }],
        activity: 'Repository activity', reported: 'Numbers reported by the source',
        sportsState: undefined,
      },
      {
        id: 'frontier-format-audit-video', sourceKind: 'youtube', expected: 'video',
        summaryLabel: 'Creator description', action: 'Watch original',
        metrics: [], sportsState: undefined,
      },
      {
        id: 'frontier-format-audit-sports', sourceKind: 'sports_state', expected: 'sports',
        summaryLabel: 'Source coverage', action: 'View score source',
        metrics: [{ label: 'live', value: '1' }],
        sportsState: {
          kind: 'scoreboard', league: 'nba', leagueLabel: 'NBA',
          games: [{ id: 'fixture-game', date: original.publishedAt, status: 'Halftime',
            live: true, completed: false, competitors: [
              { name: 'Home', shortName: 'Home', abbreviation: 'H', score: '44' },
              { name: 'Away', shortName: 'Away', abbreviation: 'A', score: '42' },
            ] }],
        },
      },
    ];
    let currentFixture = fixtures[0];
    await page.route('**/api/frontier/feed?latest=1', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'X-Frontier-Live': 'cached-latest' },
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          items: [{
            // Use a real archived record of each respective source type for
            // the screenshot. Only metrics/scores are controlled fixtures.
            ...(currentFixture.expected === 'research' ? researchSource
              : snapshot.items.find((item) => item.sourceKind === currentFixture.sourceKind) || original),
            id: currentFixture.id, sourceKind: currentFixture.sourceKind,
            metrics: currentFixture.metrics, sportsState: currentFixture.sportsState,
            media: { type: 'none' }, figures: [],
          }],
          sources: snapshot.sources,
        }),
      });
    });
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
    for (const fixture of fixtures) {
      currentFixture = fixture;
      await page.getByRole('button', { name: 'Refresh live edition' }).click();
      const article = page.locator('article[data-frontier-story-format="' + fixture.expected + '"]');
      await article.waitFor({ timeout: 8000 });
      assert.equal(await page.locator('article').count(), 1, 'Only one format-specific article is mounted');
      assert.equal(await page.locator('figure img').count(), 0, 'Media-free fixtures must not download invented imagery');
      assert.equal(await article.locator('figure').count(), 0,
        'Media-free and structured-score stories should not mount hidden image wrappers');
      assert.equal(await article.getByRole('heading', { name: fixture.summaryLabel }).count(), 1,
        'Each format must identify the true source text category');
      assert.equal(await article.getByRole('link', { name: fixture.action }).count(), 1,
        'Each format must show the right source action label');
      if (fixture.expected === 'research' && /(?:…|\.\.\.)\s*$/.test(researchSource.summary || '')) {
        assert.equal(await article.getByText('Source preview is incomplete.', { exact: false }).count(), 1,
          'Truncated source abstract must be visibly labeled, not presented as a complete finding');
      }
      if (fixture.sportsState) {
        assert.equal(await article.getByRole('region', { name: 'Source sports evidence' }).count(), 1,
          'Actual scores must be visible without expanding a detail panel');
        assert.match((await article.getByRole('region', { name: 'Source sports evidence' }).textContent()) || '',
          /44\s*:\s*42/);
      }
      if (fixture.activity || fixture.reported) {
        await article.locator('details').filter({ hasText: 'Data & references' }).locator('summary').click();
        if (fixture.activity) {
          assert.equal(await article.getByText(fixture.activity, { exact: true }).count(), 1);
          assert.equal(await article.locator('[data-frontier-metric-kind="activity"]').count(), 1);
        }
        if (fixture.reported) {
          assert.equal(await article.getByText(fixture.reported, { exact: true }).count(), 1);
          assert.equal(await article.locator('[data-frontier-metric-kind="reported"]').count(), 1);
        } else {
          assert.equal(await article.locator('[data-frontier-metric-kind="reported"]').count(), 0,
            'Citation counts and popularity must never be called research results');
        }
      }

      // Check actual rendered geometry across desktop and small phones, not
      // only semantic labels. Persist screenshots for visual PR review.
      for (const width of [1080, 390, 320]) {
        await page.setViewportSize({ width, height: width < 500 ? 780 : 800 });
        const geometry = await article.evaluate((element) => {
          const headline = element.querySelector('h1').getBoundingClientRect();
          const body = element.querySelector('[data-frontier-source-image]').getBoundingClientRect();
          const synopsis = element.querySelector('section[aria-label="Source-grounded summary"]').getBoundingClientRect();
          const scores = element.querySelector('section[aria-label="Source sports evidence"]');
          const figure = element.querySelector('figure');
          return {
            viewport: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyWidth: body.width,
            synopsisWidth: synopsis.width,
            synopsisAfterTitle: synopsis.top >= headline.top,
            hiddenNonSourceCover: figure ? getComputedStyle(figure).display === 'none' : true,
            sportsBeforeSummary: !scores || scores.getBoundingClientRect().bottom <= synopsis.top,
          };
        });
        assert(geometry.scrollWidth <= geometry.viewport + 2,
          fixture.expected + ' must not overflow at ' + width + 'px: ' + JSON.stringify(geometry));
        assert(geometry.bodyWidth <= geometry.viewport,
          fixture.expected + ' content exceeds viewport: ' + JSON.stringify(geometry));
        assert(geometry.synopsisAfterTitle,
          fixture.expected + ' synopsis must not overlap the headline');
        assert(geometry.sportsBeforeSummary,
          'Structured scores must appear before the article synopsis');
        assert(geometry.hiddenNonSourceCover,
          'A source-only or structured sports story should not show a decorative placeholder');
        mkdirSync('artifacts/browser-smoke/frontier-format-layout', { recursive: true });
        await page.screenshot({
          path: 'artifacts/browser-smoke/frontier-format-layout/' + fixture.expected + '-' + width + '.png',
          fullPage: true, animations: 'disabled',
        });
      }
      await page.setViewportSize({ width: 1080, height: 800 });
    }
    return { formatCases: fixtures.length, viewportWidths: [1080, 390, 320],
      screenshots: fixtures.length * 3, sourceAlignedLabels: true, separatedActivityMetrics: true };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function auditRealMobileTouchSignal() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true,
    isMobile: true, deviceScaleFactor: 2, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.route('**/api/frontier/feed?latest=1', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'X-Frontier-Live': 'snapshot-fallback' },
      body: JSON.stringify({ generatedAt: new Date().toISOString(), items: [], sources: [] }),
    }));
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: FIRST_PAINT_BUDGET_MS });
    const slider = page.getByRole('slider', { name: 'Rate how interesting this story is' });
    await slider.scrollIntoViewIfNeeded();
    const graph = await slider.evaluate((element) => {
      const area = element.parentElement.getBoundingClientRect();
      return { left: area.left, width: area.width, y: area.top + area.height / 2 };
    });
    for (const score of [1, 10, 4]) {
      const x = graph.left + graph.width * (20 + (score - 1) * 320 / 9) / 360;
      await page.touchscreen.tap(x, graph.y);
      await page.waitForFunction((expected) =>
        document.querySelector('[data-frontier-signal]')?.getAttribute('data-frontier-rating') === String(expected),
        score, { timeout: 3500 });
      assert.equal(await slider.inputValue(), String(score), 'Touch selection must match its displayed constellation point');
    }
    const bounds = await page.evaluate(() => ({
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    }));
    assert(bounds.scrollWidth <= bounds.viewport + 2, 'Touch rating must not cause horizontal overflow');
    assert.equal(await page.locator('[data-frontier-active-tip="true"]').count(), 1,
      'Touch selection preserves the single selected point');
    assert.equal(await page.locator('[data-frontier-focus-mode="pointer"]').count(), 1,
      'Actual phone touch input must not draw a keyboard-only frame');
    mkdirSync('artifacts/browser-smoke/frontier-signal-trail', { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'artifacts/browser-smoke/frontier-signal-trail/touch-rated-4-390.png',
      fullPage: true, animations: 'disabled',
    });
    return { realTouch: true, deviceWidth: 390, selected: [1, 10, 4], noOverflow: true };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const results = [];
  results.push(await audit(1440, 900));
  results.push(await audit(390, 844));
  results.push(await audit(320, 700));
  results.push(await auditRealMobileTouchSignal());
  results.push(await auditBackgroundLatest());
  results.push(await auditSourceOnlyPresentation());
  results.push(await auditFormatAwareEvidence());
  console.log('FRONTIER focus reader audit:', JSON.stringify(results));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
