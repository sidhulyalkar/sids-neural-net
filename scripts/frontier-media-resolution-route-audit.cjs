const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FEED_URL = process.env.FRONTIER_MEDIA_RESOLUTION_AUDIT_URL || 'http://127.0.0.1:3000/api/frontier/feed';
const ARTIFACT_DIR = path.resolve('artifacts/browser-smoke');
const RESULT_PATH = path.join(ARTIFACT_DIR, 'frontier-media-resolution.json');
const GUARDIAN_HOST = 'i.guim.co.uk';
const HD_TARGET = 2048;
const MIN_QUALITY = 88;

function masterWidth(url) {
  const match = url.pathname.match(/\/master\/(\d+)\.(?:jpe?g|png|webp)$/i);
  if (!match?.[1]) return undefined;
  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? width : undefined;
}

function writeResult(result) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
}

(async () => {
  const response = await fetch(FEED_URL, { cache: 'no-store' });
  assert.equal(response.ok, true, `FRONTIER feed returned ${response.status}`);
  const payload = await response.json();
  assert.ok(Array.isArray(payload.items), 'FRONTIER feed did not return an item array');

  const audited = [];
  for (const item of payload.items) {
    const media = item?.media;
    if (!media || media.type !== 'image' || typeof media.url !== 'string') continue;

    let original;
    try { original = new URL(media.url); } catch { continue; }
    if (original.hostname.toLowerCase() !== GUARDIAN_HOST) continue;

    const requestedWidth = Number(original.searchParams.get('width') || '0');
    if (!Number.isFinite(requestedWidth) || requestedWidth <= 0 || requestedWidth >= HD_TARGET) continue;

    const sourceWidth = masterWidth(original);
    const expectedWidth = Math.max(requestedWidth, Math.min(HD_TARGET, sourceWidth || HD_TARGET));
    if (expectedWidth <= requestedWidth) continue;

    assert.equal(typeof media.proxyUrl, 'string', `${item.id}: low-resolution Guardian media has no trusted proxy URL`);
    const proxy = new URL(media.proxyUrl, FEED_URL);
    assert.equal(proxy.pathname, '/api/frontier/media', `${item.id}: media proxy path changed unexpectedly`);
    const nestedRaw = proxy.searchParams.get('url');
    assert.ok(nestedRaw, `${item.id}: media proxy does not carry an upstream URL`);

    const nested = new URL(nestedRaw);
    const promotedWidth = Number(nested.searchParams.get('width') || '0');
    const promotedQuality = Number(nested.searchParams.get('quality') || '0');

    assert.equal(nested.hostname.toLowerCase(), GUARDIAN_HOST, `${item.id}: HD promotion changed publisher host`);
    assert.equal(nested.pathname, original.pathname, `${item.id}: HD promotion changed source image identity`);
    assert.equal(promotedWidth, expectedWidth, `${item.id}: expected ${expectedWidth}px Guardian source, got ${promotedWidth}px`);
    assert.ok(promotedQuality >= MIN_QUALITY, `${item.id}: promoted Guardian source quality ${promotedQuality} is below ${MIN_QUALITY}`);
    assert.ok(promotedWidth > requestedWidth, `${item.id}: proxy did not improve source resolution`);

    audited.push({
      id: item.id,
      title: item.title,
      originalWidth: requestedWidth,
      promotedWidth,
      masterWidth: sourceWidth,
      quality: promotedQuality,
      originalUrl: media.url,
      proxyUrl: media.proxyUrl,
      upstreamUrl: nested.toString(),
    });
  }

  const result = {
    passed: true,
    feedUrl: FEED_URL,
    generatedAt: payload.generatedAt,
    itemCount: payload.items.length,
    guardianLowResolutionCandidates: audited.length,
    audited,
  };
  writeResult(result);
  console.log(`FRONTIER production media resolution PASS · ${audited.length} Guardian low-resolution source(s) promoted to bounded ${HD_TARGET}px sources`);
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  const result = {
    passed: false,
    feedUrl: FEED_URL,
    error: error instanceof Error ? error.stack : String(error),
  };
  writeResult(result);
  console.error(error);
  process.exitCode = 1;
});
