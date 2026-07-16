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

import { sample, type MusicTimeline } from '../components/perceptual-cortex/musicTimeline';

const grid: MusicTimeline = { version: 1, durationMs: 200000, bpm: 120, downbeatMs: 0 };

test('sample is deterministic for a given position', () => {
  assert.deepEqual(sample(grid, 1234), sample(grid, 1234));
});

test('sample peaks onset on the downbeat and dips off-beat', () => {
  const beatMs = 60000 / 120; // 500ms
  const onBeat = sample(grid, 4 * beatMs).onset;
  const offBeat = sample(grid, 4 * beatMs + beatMs / 2).onset;
  assert.ok(onBeat > 0.8, `expected strong onset on beat, got ${onBeat}`);
  assert.ok(offBeat < 0.2, `expected weak onset off beat, got ${offBeat}`);
});

test('sample returns all fields within [0,1]', () => {
  for (const pos of [0, 137, 5000, 250000]) {
    const f = sample(grid, pos, 1.4);
    for (const [k, v] of Object.entries(f)) {
      assert.ok(v >= 0 && v <= 1, `${k}=${v} out of range at pos ${pos}`);
    }
  }
});

test('intensity raises energy but stays clamped', () => {
  const beatMs = 60000 / 120;
  assert.ok(sample(grid, beatMs, 1.4).lowEnergy >= sample(grid, beatMs, 1.0).lowEnergy);
});
