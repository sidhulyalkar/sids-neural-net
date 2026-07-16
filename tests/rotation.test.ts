import assert from 'node:assert/strict';
import test from 'node:test';
import { parseManifest } from '../lib/spotify/manifest';

test('parseManifest accepts a valid manifest and applies defaults', () => {
  const manifest = parseManifest({
    generatedAt: '2026-07-16T00:00:00.000Z',
    tracks: [{ spotifyId: 'abc', title: 'Song', artist: 'Artist', spotifyUrl: 'spotify:track:abc' }],
  });
  assert.equal(manifest.tracks.length, 1);
  assert.equal(manifest.tracks[0].album, '');
  assert.equal(manifest.tracks[0].popularity, 0);
});

test('parseManifest rejects a track missing a title', () => {
  assert.throws(() => parseManifest({ generatedAt: 'x', tracks: [{ spotifyId: 'abc', artist: 'A', spotifyUrl: 'u' }] }));
});
