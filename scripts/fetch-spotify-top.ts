import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  manifestSchema,
  timeRangeSchema,
  type Artist,
  type ListeningSnapshot,
  type TimeRange,
  type Track,
} from '../lib/spotify/manifest';

const manifestPath = join(process.cwd(), 'content', 'music', 'top-tracks.json');
const envPath = join(process.cwd(), '.env.local');
const SPOTIFY_API = 'https://api.spotify.com/v1';

async function loadLocalEnv() {
  try {
    const text = await readFile(envPath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // CI and shell environments can provide credentials directly.
  }
}

async function accessToken(): Promise<string> {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    throw new Error('Missing Spotify credentials. Copy .env.local.example to .env.local or configure CI secrets.');
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN }),
  });
  if (!response.ok) throw new Error(`Spotify token refresh failed (${response.status}).`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error('Spotify token refresh returned no access token.');
  return payload.access_token;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${SPOTIFY_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) return (await response.json()) as T;

    if (response.status === 429 && attempt < 2) {
      const retryAfterSeconds = Number(response.headers.get('retry-after') ?? '1');
      const waitMs = Math.min(10_000, Math.max(1_000, retryAfterSeconds * 1_000));
      console.warn(`Spotify rate/quota response; retrying in ${waitMs / 1000}s.`);
      await sleep(waitMs);
      continue;
    }

    let detail = '';
    try {
      const payload = (await response.json()) as { error?: { message?: string }; reason?: string };
      detail = payload.reason ?? payload.error?.message ?? '';
    } catch {
      // Avoid logging response bodies that could contain unexpected information.
    }
    throw new Error(`Spotify request failed (${response.status})${detail ? `: ${detail}` : ''}.`);
  }
  throw new Error('Spotify request exhausted retries.');
}

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms?: number;
  explicit?: boolean;
  popularity?: number;
  external_urls: { spotify: string };
  artists: Array<{ id: string; name: string; external_urls: { spotify: string } }>;
  album: { name: string; images: Array<{ url: string }> };
};

type SpotifyArtist = {
  id: string;
  name: string;
  external_urls: { spotify: string };
  images?: Array<{ url: string }>;
  genres?: string[];
};

type SpotifyPage<T> = { items: T[] };

function mapTrack(item: SpotifyTrack, index: number): Track {
  return {
    rank: index + 1,
    spotifyId: item.id,
    title: item.name,
    artist: item.artists.map((artist) => artist.name).join(', '),
    artists: item.artists.map((artist) => ({
      spotifyId: artist.id,
      name: artist.name,
      spotifyUrl: artist.external_urls.spotify,
    })),
    album: item.album.name,
    albumArtUrl: item.album.images[0]?.url ?? '',
    spotifyUrl: item.external_urls.spotify,
    ...(item.duration_ms ? { durationMs: item.duration_ms } : {}),
    ...(typeof item.explicit === 'boolean' ? { explicit: item.explicit } : {}),
    ...(typeof item.popularity === 'number' ? { popularity: item.popularity } : {}),
  };
}

function mapArtist(item: SpotifyArtist, index: number): Artist {
  return {
    rank: index + 1,
    spotifyId: item.id,
    name: item.name,
    spotifyUrl: item.external_urls.spotify,
    imageUrl: item.images?.[0]?.url ?? '',
    genres: item.genres ?? [],
  };
}

async function fetchSnapshot(token: string, timeRange: TimeRange): Promise<ListeningSnapshot> {
  const query = new URLSearchParams({ time_range: timeRange, limit: '20' });
  // Six total requests per refresh keeps the personal showcase light on Development Mode quota.
  const tracks = await spotifyGet<SpotifyPage<SpotifyTrack>>(`/me/top/tracks?${query}`, token);
  const artists = await spotifyGet<SpotifyPage<SpotifyArtist>>(`/me/top/artists?${query}`, token);

  return {
    timeRange,
    tracks: tracks.items.map(mapTrack),
    artists: artists.items.map(mapArtist),
  };
}

async function main() {
  await loadLocalEnv();
  const token = await accessToken();
  const snapshots = {} as Record<TimeRange, ListeningSnapshot>;

  for (const range of timeRangeSchema.options) {
    console.log(`Fetching Spotify top items: ${range}…`);
    snapshots[range] = await fetchSnapshot(token, range);
  }

  const manifest = manifestSchema.parse({
    version: 2,
    generatedAt: new Date().toISOString(),
    source: 'spotify-top-items',
    isPlaceholder: false,
    snapshots,
  });

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Updated content/music/top-tracks.json with 3 listening windows × top 20 tracks/artists.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
