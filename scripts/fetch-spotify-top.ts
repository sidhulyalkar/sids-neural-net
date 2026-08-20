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

/**
 * Discovery deliberately writes a candidate file instead of replacing the
 * production Rotation manifest. A public track is not promoted until BPM /
 * downbeat timing has been explicitly curated or analyzed.
 */
async function main() {
  const token = await accessToken();
  const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Top tracks failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as {
    items: Array<{
      id: string;
      name: string;
      popularity: number;
      duration_ms: number;
      external_urls: { spotify: string };
      artists: Array<{ name: string }>;
      album: { name: string; images: Array<{ url: string }> };
    }>;
  };

  const candidates = data.items.map((item) => ({
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

  const path = join(process.cwd(), 'content', 'music', 'top-tracks.candidates.json');
  await writeFile(path, JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
  console.log(`Wrote ${candidates.length} discovery candidates to ${path}.`);
  console.log('Production top-tracks.json was left untouched. Curate BPM/downbeat timing before promotion.');
}

main().catch((error) => { console.error(error); process.exit(1); });
