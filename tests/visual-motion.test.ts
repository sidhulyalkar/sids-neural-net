import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { muxPlayerUrl, muxPosterUrl, visualMotion } from '../src/data/visualMotion';

type ManifestEntry = {
  id?: string;
  published?: boolean;
  mux?: { playbackId?: string };
  source?: { sha256?: string };
};

const manifestPath = path.join(process.cwd(), 'src/data/visualMotionManifest.json');

test('visual motion manifest is safe and internally unique', () => {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as ManifestEntry[];

  assert.equal(Array.isArray(manifest), true);
  assert.equal(raw.includes('MUX_TOKEN_SECRET'), false);
  assert.equal(raw.includes('storage.googleapis.com/video-storage'), false, 'signed upload URL leaked into manifest');

  const ids = new Set<string>();
  const hashes = new Set<string>();

  for (const entry of manifest) {
    assert.ok(entry.id, 'manifest entry missing id');
    assert.equal(ids.has(entry.id!), false, `duplicate motion id: ${entry.id}`);
    ids.add(entry.id!);

    if (entry.source?.sha256) {
      assert.equal(hashes.has(entry.source.sha256), false, `duplicate source hash: ${entry.source.sha256}`);
      hashes.add(entry.source.sha256);
    }

    if (entry.published) {
      assert.ok(entry.mux?.playbackId, `${entry.id}: published entry is missing a Mux playback ID`);
    }
  }

  assert.equal(visualMotion.length, manifest.filter((entry) => entry.published).length);
});

test('Mux presentation URLs are scoped to the expected hosts', () => {
  const player = new URL(muxPlayerUrl('abc123', 'Reef study', 'reef-study'));
  assert.equal(player.origin, 'https://player.mux.com');
  assert.equal(player.pathname, '/abc123');
  assert.equal(player.searchParams.get('metadata-video-id'), 'reef-study');

  const poster = new URL(muxPosterUrl('abc123', 12.5));
  assert.equal(poster.origin, 'https://image.mux.com');
  assert.equal(poster.pathname, '/abc123/thumbnail.webp');
  assert.equal(poster.searchParams.get('time'), '12.5');
});
