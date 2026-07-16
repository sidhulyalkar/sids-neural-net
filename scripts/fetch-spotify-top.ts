import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { manifestSchema, type Track } from '../lib/spotify/manifest';

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

const manifestPath = join(process.cwd(), 'content', 'music', 'top-tracks.json');

async function existingGrids(): Promise<Map<string, Pick<Track, 'bpm' | 'downbeatMs'>>> {
  try {
    const parsed = manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
    return new Map(parsed.tracks.map((t) => [t.spotifyId, { bpm: t.bpm, downbeatMs: t.downbeatMs }]));
  } catch {
    console.warn('Could not read existing manifest; prior bpm/downbeat grids will not be preserved.');
    return new Map();
  }
}

async function main() {
  const token = await accessToken();
  const grids = await existingGrids();
  const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Top tracks failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as {
    items: Array<{ id: string; name: string; popularity: number; external_urls: { spotify: string };
      artists: Array<{ name: string }>; album: { name: string; images: Array<{ url: string }> } }>;
  };

  const tracks: Track[] = data.items.map((item) => {
    const prior = grids.get(item.id);
    return {
      spotifyId: item.id,
      title: item.name,
      artist: item.artists.map((a) => a.name).join(', '),
      album: item.album.name,
      albumArtUrl: item.album.images[0]?.url ?? '',
      spotifyUrl: item.external_urls.spotify,
      popularity: item.popularity,
      ...(prior?.bpm ? { bpm: prior.bpm } : {}),
      ...(prior?.downbeatMs != null ? { downbeatMs: prior.downbeatMs } : {}),
    };
  });

  const manifest = manifestSchema.parse({ generatedAt: new Date().toISOString(), tracks });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const missing = tracks.filter((t) => t.bpm == null).map((t) => `${t.title} — ${t.artist}`);
  console.log(`Wrote ${tracks.length} tracks to content/music/top-tracks.json.`);
  if (missing.length) console.log(`\nNeed a beat-grid (run npm run music:grid -- <id> <bpm> <downbeatMs>):\n- ${missing.join('\n- ')}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
