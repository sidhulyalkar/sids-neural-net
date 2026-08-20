import type { Manifest, TimeRange, Track } from '@/lib/spotify/manifest';

export const timeRangeMeta: Record<TimeRange, { label: string; shortLabel: string; description: string }> = {
  short_term: {
    label: 'Last 4 weeks',
    shortLabel: '4 weeks',
    description: 'What is pulling you in right now.',
  },
  medium_term: {
    label: 'Last ~6 months',
    shortLabel: '6 months',
    description: 'The center of gravity of your recent rotation.',
  },
  long_term: {
    label: 'Last ~1 year',
    shortLabel: '1 year',
    description: 'The artists and tracks with staying power.',
  },
};

export function comparisonRange(range: TimeRange): TimeRange {
  if (range === 'short_term') return 'medium_term';
  if (range === 'medium_term') return 'long_term';
  return 'medium_term';
}

export function rankMovement(trackId: string, current: Track[], previous: Track[]): number | null {
  const currentTrack = current.find((track) => track.spotifyId === trackId);
  const previousTrack = previous.find((track) => track.spotifyId === trackId);
  if (!currentTrack || !previousTrack) return null;
  return previousTrack.rank - currentTrack.rank;
}

export function topItemOverlap(a: Track[], b: Track[], limit = 20): { count: number; ratio: number } {
  const left = new Set(a.slice(0, limit).map((track) => track.spotifyId));
  const right = new Set(b.slice(0, limit).map((track) => track.spotifyId));
  const count = [...left].filter((id) => right.has(id)).length;
  const denominator = Math.max(1, Math.min(limit, left.size, right.size));
  return { count, ratio: count / denominator };
}

export function coreTrackIds(manifest: Manifest, limit = 20): Set<string> {
  const windows = (['short_term', 'medium_term', 'long_term'] as const).map(
    (range) => new Set(manifest.snapshots[range].tracks.slice(0, limit).map((track) => track.spotifyId)),
  );
  return new Set([...windows[0]].filter((id) => windows[1].has(id) && windows[2].has(id)));
}

export function listeningSummary(manifest: Manifest, range: TimeRange) {
  const snapshot = manifest.snapshots[range];
  const previous = manifest.snapshots[comparisonRange(range)];
  const topTracks = snapshot.tracks.slice(0, 20);
  const previousTracks = previous.tracks.slice(0, 20);
  const overlap = topItemOverlap(topTracks, previousTracks);
  const previousIds = new Set(previousTracks.map((track) => track.spotifyId));
  const freshEntries = topTracks.filter((track) => !previousIds.has(track.spotifyId)).length;
  const uniquePrimaryArtists = new Set(
    topTracks.map((track) => track.artists[0]?.spotifyId ?? track.artist),
  ).size;

  return {
    overlap,
    freshEntries,
    uniquePrimaryArtists,
    coreTracks: coreTrackIds(manifest).size,
  };
}

export function formatMovement(value: number | null): { label: string; direction: 'up' | 'down' | 'flat' | 'new' } {
  if (value == null) return { label: 'NEW', direction: 'new' };
  if (value > 0) return { label: `↑ ${value}`, direction: 'up' };
  if (value < 0) return { label: `↓ ${Math.abs(value)}`, direction: 'down' };
  return { label: '•', direction: 'flat' };
}

export function formatGeneratedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}
