import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error('Missing Spotify env vars. See .env.local.example.');
  process.exit(1);
}

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN! }),
  });
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
  external_urls?: { spotify?: string };
  images?: Array<{ url: string }>;
};

type SpotifyTrack = {
  id: string;
  name: string;
  popularity: number;
  duration_ms: number;
  external_urls: { spotify: string };
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
};

type SpotifyPlaylist = {
  id: string;
  name: string;
  public?: boolean | null;
  tracks?: { total?: number };
  external_urls?: { spotify?: string };
  images?: Array<{ url: string }>;
  owner?: { display_name?: string | null };
};

async function spotifyJson<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function optionalSpotifyJson<T>(token: string, path: string): Promise<T | undefined> {
  try {
    return await spotifyJson<T>(token, path);
  } catch (error) {
    console.warn(`Optional Spotify taste endpoint skipped: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function artistRecord(artist: SpotifyArtist, rank: number) {
  return {
    name: artist.name,
    genres: artist.genres ?? [],
    popularity: artist.popularity ?? 0,
    spotifyUrl: artist.external_urls?.spotify ?? `https://open.spotify.com/artist/${artist.id}`,
    imageUrl: artist.images?.[0]?.url ?? '',
    rank,
  };
}

/**
 * Discovery deliberately writes a candidate file instead of replacing the
 * production Rotation manifest. A public track is not promoted until BPM /
 * downbeat timing has been explicitly curated or analyzed.
 *
 * FRONTIER has a different requirement: artist / playlist names are safe taste
 * metadata, so they are written to taste-profile.json and can immediately steer
 * discovery queries without changing the music visualizer's curated beat grid.
 */
async function main() {
  const token = await accessToken();
  const [topTracksData, topArtistsData, followedData, playlistsData] = await Promise.all([
    spotifyJson<{ items: SpotifyTrack[] }>(token, '/me/top/tracks?limit=50&time_range=medium_term'),
    spotifyJson<{ items: SpotifyArtist[] }>(token, '/me/top/artists?limit=50&time_range=medium_term'),
    optionalSpotifyJson<{ artists?: { items?: SpotifyArtist[] } }>(token, '/me/following?type=artist&limit=50'),
    optionalSpotifyJson<{ items?: Array<SpotifyPlaylist | null> }>(token, '/me/playlists?limit=50'),
  ]);

  const candidates = topTracksData.items.map((item) => ({
    spotifyId: item.id,
    title: item.name,
    artist: item.artists.map((artist) => artist.name).join(', '),
    album: item.album.name,
    albumArtUrl: item.album.images[0]?.url ?? '',
    spotifyUrl: item.external_urls.spotify,
    popularity: item.popularity,
    durationMs: item.duration_ms,
    needsTimingCuration: true,
  }));

  const generatedAt = new Date().toISOString();
  const candidatePath = join(process.cwd(), 'content', 'music', 'top-tracks.candidates.json');
  await writeFile(candidatePath, `${JSON.stringify({ generatedAt, candidates }, null, 2)}\n`);

  const followedArtists = followedData?.artists?.items ?? [];
  const playlists = (playlistsData?.items ?? []).filter((playlist): playlist is SpotifyPlaylist => Boolean(playlist));
  const tasteProfile = {
    generatedAt,
    source: 'spotify',
    topArtists: topArtistsData.items.map((artist, index) => artistRecord(artist, index + 1)),
    followedArtists: followedArtists.map((artist, index) => artistRecord(artist, index + 1)),
    playlists: playlists.map((playlist) => ({
      name: playlist.name,
      public: playlist.public ?? null,
      trackCount: playlist.tracks?.total ?? 0,
      spotifyUrl: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`,
      imageUrl: playlist.images?.[0]?.url ?? '',
      owner: playlist.owner?.display_name ?? '',
    })),
    topTracks: topTracksData.items.map((item, index) => ({
      rank: index + 1,
      title: item.name,
      artists: item.artists.map((artist) => artist.name),
      popularity: item.popularity,
      spotifyUrl: item.external_urls.spotify,
    })),
  };

  const tastePath = join(process.cwd(), 'content', 'music', 'taste-profile.json');
  await writeFile(tastePath, `${JSON.stringify(tasteProfile, null, 2)}\n`);

  console.log(`Wrote ${candidates.length} discovery candidates to ${candidatePath}.`);
  console.log(`Wrote ${tasteProfile.topArtists.length} top artists, ${tasteProfile.followedArtists.length} followed artists, and ${tasteProfile.playlists.length} playlists to ${tastePath}.`);
  console.log('Production top-tracks.json was left untouched. Curate BPM/downbeat timing before promotion.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
