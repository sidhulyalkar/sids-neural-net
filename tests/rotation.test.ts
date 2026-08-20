import assert from 'node:assert/strict';
import test from 'node:test';
import { parseManifest } from '../lib/spotify/manifest';
import manifestData from '../content/music/top-tracks.json' with { type: 'json' };
import { sample, timelineFromTrack, type MusicTimeline } from '../components/perceptual-cortex/musicTimeline';
import { PlaybackClock } from '../components/perceptual-cortex/playbackClock';

const grid: MusicTimeline = { version: 1, durationMs: 200000, bpm: 120, downbeatMs: 0 };

test('parseManifest validates production timing fields and defaults optional metadata', () => {
  const manifest = parseManifest({
    generatedAt: '2026-07-16T00:00:00.000Z',
    tracks: [{
      spotifyId: 'abc',
      title: 'Song',
      artist: 'Artist',
      spotifyUrl: 'https://open.spotify.com/track/abc',
      bpm: 120,
      durationMs: 200000,
    }],
  });
  assert.equal(manifest.tracks.length, 1);
  assert.equal(manifest.tracks[0].album, '');
  assert.equal(manifest.tracks[0].popularity, 0);
  assert.equal(manifest.tracks[0].timingSource, 'curated-fallback');
});

test('parseManifest rejects duplicate IDs and malformed timing metadata', () => {
  const track = { spotifyId: 'abc', title: 'Song', artist: 'A', spotifyUrl: 'https://open.spotify.com/track/abc', bpm: 120, durationMs: 200000 };
  assert.throws(() => parseManifest({ generatedAt: 'x', tracks: [{ ...track }, { ...track }] }));
  assert.throws(() => parseManifest({ generatedAt: 'x', tracks: [{ ...track, bpm: 0 }] }));
});

test('production Rotation catalog contains 13–20 unique, fully timed tracks', () => {
  const manifest = parseManifest(manifestData);
  assert.ok(manifest.tracks.length >= 13 && manifest.tracks.length <= 20);
  assert.equal(new Set(manifest.tracks.map((track) => track.spotifyId)).size, manifest.tracks.length);
  for (const track of manifest.tracks) {
    assert.match(track.spotifyUrl, /^https:\/\/open\.spotify\.com\/track\//);
    assert.ok(track.bpm >= 40 && track.bpm <= 240);
    assert.ok(track.durationMs >= 120000);
  }
});

test('timelineFromTrack guarantees a structured fallback timeline', () => {
  const track = parseManifest({
    generatedAt: 'x',
    tracks: [{ spotifyId: 'abc', title: 'Song', artist: 'A', spotifyUrl: 'https://open.spotify.com/track/abc', bpm: 126, durationMs: 198000 }],
  }).tracks[0];
  const timeline = timelineFromTrack(track);
  assert.equal(timeline.bpm, 126);
  assert.equal(timeline.durationMs, 198000);
  assert.equal(timeline.sections?.length, 6);
  assert.equal(timeline.sections?.[0].startMs, 0);
});

test('sample is deterministic for a given position', () => {
  assert.deepEqual(sample(grid, 1234), sample(grid, 1234));
});

test('sample peaks onset on the downbeat and dips off-beat', () => {
  const beatMs = 60000 / 120;
  const onBeat = sample(grid, 4 * beatMs).onset;
  const offBeat = sample(grid, 4 * beatMs + beatMs / 2).onset;
  assert.ok(onBeat > 0.8, `expected strong onset on beat, got ${onBeat}`);
  assert.ok(offBeat < 0.2, `expected weak onset off beat, got ${offBeat}`);
});

test('sample returns all fields within [0,1]', () => {
  for (const pos of [0, 137, 5000, 250000]) {
    const features = sample(grid, pos, 1.4);
    for (const [key, value] of Object.entries(features)) {
      assert.ok(value >= 0 && value <= 1, `${key}=${value} out of range at pos ${pos}`);
    }
  }
});

test('intensity raises energy but stays clamped', () => {
  const beatMs = 60000 / 120;
  assert.ok(sample(grid, beatMs, 1.4).lowEnergy >= sample(grid, beatMs, 1.0).lowEnergy);
});

test('playback clock interpolates, pauses, seeks, and resets cleanly', () => {
  const clock = new PlaybackClock();
  clock.update(1000, false, 0);
  assert.equal(clock.positionMs(500), 1500);
  assert.equal(clock.isPlaying, true);
  clock.update(2000, true, 1000);
  assert.equal(clock.positionMs(1500), 2000);
  assert.equal(clock.isPlaying, false);
  clock.update(4000, false, 2000);
  assert.equal(clock.positionMs(2000), 4000);
  clock.reset(2500);
  assert.equal(clock.positionMs(3000), 0);
  assert.equal(clock.isPlaying, false);
});
