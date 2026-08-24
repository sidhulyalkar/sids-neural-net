import assert from 'node:assert/strict';
import test from 'node:test';
import { frontierRssMediaForUrl, frontierRssSourceMedia } from '../lib/frontier/media/rssSourceMedia';

test('RSS media:content image preserves source dimensions', () => {
  const xml = `
    <rss><channel><item>
      <title>Visual story</title>
      <link>https://example.com/story?utm_source=rss</link>
      <media:content url="https://cdn.example.com/hero.jpg" type="image/jpeg" width="1600" height="900" />
    </item></channel></rss>`;
  const media = frontierRssSourceMedia(xml);
  const visual = frontierRssMediaForUrl(media, 'https://example.com/story');
  assert.equal(visual?.type, 'image');
  assert.equal(visual?.url, 'https://cdn.example.com/hero.jpg');
  assert.equal(visual?.width, 1600);
  assert.equal(visual?.height, 900);
  assert.equal(visual?.aspectRatio, 'wide');
});

test('RSS media:thumbnail is accepted as authentic source media', () => {
  const xml = `
    <feed><entry>
      <title>Atom story</title>
      <link href="https://example.com/atom" />
      <media:thumbnail url="https://images.example.com/thumb.webp" width="1200" height="800" />
    </entry></feed>`;
  const visual = frontierRssMediaForUrl(frontierRssSourceMedia(xml), 'https://example.com/atom');
  assert.equal(visual?.type, 'image');
  assert.equal(visual?.url, 'https://images.example.com/thumb.webp');
  assert.equal(visual?.aspectRatio, 'landscape');
});

test('RSS video enclosure carries a real poster when the feed provides one', () => {
  const xml = `
    <rss><channel><item>
      <title>Match highlight</title>
      <link>https://example.com/highlight</link>
      <media:thumbnail url="https://images.example.com/poster.jpg" />
      <enclosure url="https://video.example.com/highlight.mp4" type="video/mp4" />
    </item></channel></rss>`;
  const visual = frontierRssMediaForUrl(frontierRssSourceMedia(xml), 'https://example.com/highlight');
  assert.equal(visual?.type, 'video');
  assert.equal(visual?.url, 'https://video.example.com/highlight.mp4');
  assert.equal(visual?.poster, 'https://images.example.com/poster.jpg');
});

test('embedded source image is used without executing or retaining source HTML', () => {
  const xml = `
    <rss><channel><item>
      <title>Embedded visual</title>
      <link>https://example.com/embedded</link>
      <description><![CDATA[<p>Hello</p><img src="https://images.example.com/source.png" onerror="alert(1)">]]></description>
    </item></channel></rss>`;
  const visual = frontierRssMediaForUrl(frontierRssSourceMedia(xml), 'https://example.com/embedded');
  assert.equal(visual?.type, 'image');
  assert.equal(visual?.url, 'https://images.example.com/source.png');
  assert.equal(Object.hasOwn(visual ?? {}, 'html'), false);
});

test('RSS entries with no source-carried media remain text-only', () => {
  const xml = `
    <rss><channel><item>
      <title>Text only</title>
      <link>https://example.com/text</link>
      <description>No image here.</description>
    </item></channel></rss>`;
  assert.equal(frontierRssMediaForUrl(frontierRssSourceMedia(xml), 'https://example.com/text'), undefined);
});
