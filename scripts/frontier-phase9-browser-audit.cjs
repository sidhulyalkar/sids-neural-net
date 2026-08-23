const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const AUDIT_URL = process.env.FRONTIER_PHASE9_AUDIT_URL || 'http://127.0.0.1:3000/frontier/interaction-audit';
const CARD = '[data-frontier-fluid-card="frontier-phase8-browser-audit"]';
const LINK = '[data-frontier-audit-primary-link="true"]';
const VIDEO = '[data-frontier-audit-video="true"]';
const MATH = '[data-frontier-scientific-artifact="math"]';
const CODE = '[data-frontier-scientific-artifact="code"]';
const SYNTHESIS = '[data-frontier-local-synthesis="opt-in"]';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');

function isLocalModelRequest(url) {
  return /(?:esm\.run\/\@mlc-ai\/web-llm|web-llm|Llama-3\.2-1B-Instruct|mlc-ai)/i.test(url);
}

async function pointerClick(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, `Expected ${selector} to have a bounding box`);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down({ button: 'left' });
  await page.mouse.up({ button: 'left' });
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    reducedMotion: 'no-preference',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);

  const modelRequests = [];
  page.on('request', (request) => {
    if (isLocalModelRequest(request.url())) modelRequests.push(request.url());
  });

  try {
    await page.goto(AUDIT_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(CARD).waitFor({ state: 'visible' });
    await page.locator(VIDEO).waitFor({ state: 'attached' });

    assert.equal(modelRequests.length, 0, 'Phase 9 must not fetch WebLLM/model assets on page load');
    await pointerClick(page, LINK);
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.getAttribute('data-fluid-expanded') === 'true',
      CARD,
      { polling: 'raf', timeout: 1_000 },
    );

    await page.locator(MATH).waitFor({ state: 'visible' });
    await page.locator(CODE).waitFor({ state: 'visible' });
    await page.locator(SYNTHESIS).waitFor({ state: 'visible' });

    const artifactState = await page.evaluate(({ mathSelector, codeSelector, synthesisSelector }) => {
      const math = document.querySelector(mathSelector);
      const code = document.querySelector(codeSelector);
      const synthesis = document.querySelector(synthesisSelector);
      return {
        mathTag: math?.querySelector('math')?.tagName.toLowerCase() ?? null,
        mathText: math?.textContent ?? '',
        codeText: code?.textContent ?? '',
        synthesisText: synthesis?.textContent ?? '',
        synthesisButtons: Array.from(synthesis?.querySelectorAll('button') ?? []).map((button) => button.textContent?.trim() ?? ''),
      };
    }, { mathSelector: MATH, codeSelector: CODE, synthesisSelector: SYNTHESIS });

    assert.equal(artifactState.mathTag, 'math', 'Scientific equation plane must render native MathML');
    assert.match(artifactState.mathText, /x\(t\)/, 'Math plane must preserve the grounded equation');
    assert.match(artifactState.codeText, /const next = state/, 'Code plane must preserve grounded source code');
    assert.match(artifactState.synthesisText, /presentation only/i, 'Local synthesis must be visibly labeled presentation-only');

    const synthesizeButtonPresent = artifactState.synthesisButtons.some((label) => /Synthesize locally/i.test(label));
    const unsupportedVisible = /WebGPU local inference is unavailable/i.test(artifactState.synthesisText);
    assert(
      synthesizeButtonPresent || unsupportedVisible,
      'Convergence node must either offer explicit local synthesis or expose graceful WebGPU unavailability',
    );

    // Give any accidental eager import/fetch enough time to appear. The worker is
    // required to remain nonexistent until the user explicitly presses the local
    // synthesis control.
    await page.waitForTimeout(350);
    assert.deepEqual(modelRequests, [], 'Expanding a convergence node must not fetch WebLLM or model weights');

    const audioState = await page.evaluate((videoSelector) => {
      const video = document.querySelector(videoSelector);
      const registry = window.__frontierAudioReactivity;
      return {
        playing: video instanceof HTMLVideoElement && !video.paused,
        hasSourceObject: video instanceof HTMLVideoElement && Boolean(video.srcObject),
        registryCreated: Boolean(registry),
        activeMatchesVideo: Boolean(registry && video instanceof HTMLVideoElement && registry.active?.element === video),
        fftSize: registry?.active?.analyser?.fftSize ?? null,
      };
    }, VIDEO);

    assert.equal(audioState.playing, true, 'Audit media must remain playing after Phase 9 expansion');
    assert.equal(audioState.hasSourceObject, true, 'Audit must exercise the safe MediaStream audio path');
    assert.equal(audioState.registryCreated, true, 'Expanded safe native media must initialize the audio-reactivity registry');
    assert.equal(audioState.activeMatchesVideo, true, 'Only the expanded playing media element should own reactive analysis');
    assert.equal(audioState.fftSize, 1024, 'Reactive audio analysis must use the bounded 1024 FFT contract');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'frontier-phase9-expanded.png'), fullPage: true });

    const result = {
      passed: true,
      auditUrl: AUDIT_URL,
      lazyModelRequests: modelRequests,
      artifacts: artifactState,
      audio: audioState,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'frontier-phase9-browser-audit.json'),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    console.log('FRONTIER Phase 9 browser audit PASS');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'frontier-phase9-browser-audit.json'),
    `${JSON.stringify({ passed: false, error: error instanceof Error ? error.stack : String(error) }, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
