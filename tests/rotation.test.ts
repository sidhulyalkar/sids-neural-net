import assert from 'node:assert/strict';
import test from 'node:test';
import { parseManifest, type Manifest, type Track } from '../lib/spotify/manifest';
import {
  coreTrackIds,
  formatMovement,
  listeningSummary,
  rankMovement,
  topItemOverlap,
} from '../components/rotation/listeningStats';
import { sample, type MusicTimeline } from '../components/perceptual-cortex/musicTimeline';
import { PlaybackClock } from '../components/perceptual-cortex/playbackClock';

function track(id: string, rank: number, artistId = `artist-${id}`): Track {
  return {
    rank,
    spotifyId: id,
    title: `Song ${id}`,
    artist: `Artist ${artistId}`,
    artists: [{ spotifyId: artistId, name: `Artist ${artistId}`, spotifyUrl: `https://open.spotify.com/artist/${artistId}` }],
    album: 'Album',
    albumArtUrl: '',
    spotifyUrl: `https://open.spotify.com/track/${id}`,
  };
}

function manifestFixture(): Manifest {
  const shortTracks = [track('aaa', 1, 'artistA'), track('bbb', 2, 'artistB'), track('ccc', 3, 'artistC')];
  const mediumTracks = [track('bbb', 1, 'artistB'), track('aaa', 2, 'artistA'), track('ddd', 3, 'artistD')];
  const longTracks = [track('aaa', 1, 'artistA'), track('bbb', 2, 'artistB'), track('eee', 3, 'artistE')];
  const artist = (id: string, rank: number) => ({
    rank,
    spotifyId: id,
    name: id,
    spotifyUrl: `https://open.spotify.com/artist/${id}`,
    imageUrl: '',
    genres: [],
  });

  return parseManifest({
    version: 2,
    generatedAt: '2026-08-20T20:46:00.000Z',
    source: 'spotify-top-items',
    isPlaceholder: false,
    snapshots: {
      short_term: { timeRange: 'short_term', tracks: shortTracks, artists: [artist('artistA', 1)] },
      medium_term: { timeRange: 'medium_term', tracks: mediumTracks, artists: [artist('artistB', 1)] },
      long_term: { timeRange: 'long_term', tracks: longTracks, artists: [artist('artistA', 1)] },
    },
  });
}

test('parseManifest accepts the three required listening windows', () => {
  const manifest = manifestFixture();
  assert.equal(manifest.version, 2);
  assert.equal(manifest.snapshots.short_term.tracks[0].rank, 1);
});

test('parseManifest rejects a snapshot whose key and timeRange disagree', () => {
  const manifest = manifestFixture();
  assert.throws(() => parseManifest({
    ...manifest,
    snapshots: {
      ...manifest.snapshots,
      short_term: { ...manifest.snapshots.short_term, timeRange: 'long_term' },
    },
  }));
});

test('rankMovement reports positive movement when a track rises', () => {
  const current = [track('aaa', 1), track('bbb', 2)];
  const previous = [track('bbb', 1), track('aaa', 2)];
  assert.equal(rankMovement('aaa', current, previous), 1);
  assert.deepEqual(formatMovement(1), { label: '↑ 1', direction: 'up' });
  assert.deepEqual(formatMovement(null), { label: 'NEW', direction: 'new' });
});

test('topItemOverlap and coreTrackIds describe cross-window persistence', () => {
  const manifest = manifestFixture();
  assert.deepEqual(topItemOverlap(manifest.snapshots.short_term.tracks, manifest.snapshots.medium_term.tracks, 3), {
    count: 2,
    ratio: 2 / 3,
  });
  assert.deepEqual([...coreTrackIds(manifest, 3)].sort(), ['aaa', 'bbb']);
});

test('listeningSummary counts fresh entries and artist breadth', () => {
  const summary = listeningSummary(manifestFixture(), 'short_term');
  assert.equal(summary.freshEntries, 1);
  assert.equal(summary.uniquePrimaryArtists, 3);
  assert.equal(summary.coreTracks, 2);
});

const grid: MusicTimeline = { version: 1, durationMs: 200000, bpm: 120, downbeatMs: 0 };

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

test('playback clock interpolates while playing', () => {
  const clock = new PlaybackClock();
  clock.update(1000, false, 0);
  assert.equal(clock.positionMs(500), 1500);
  assert.equal(clock.isPlaying, true);
});

test('playback clock freezes while paused', () => {
  const clock = new PlaybackClock();
  clock.update(1000, true, 0);
  assert.equal(clock.positionMs(500), 1000);
  assert.equal(clock.isPlaying, false);
});

test('playback clock snaps to the reported position on update', () => {
  const clock = new PlaybackClock();
  clock.update(1000, false, 0);
  clock.update(2000, false, 1000);
  assert.equal(clock.positionMs(1000), 2000);
});
