import { z } from 'zod';

export const trackSchema = z.object({
  spotifyId: z.string().regex(/^[A-Za-z0-9]+$/),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().default(''),
  albumArtUrl: z.string().default(''),
  spotifyUrl: z.string().url(),
  popularity: z.number().int().min(0).max(100).default(0),
  bpm: z.number().min(40).max(240),
  downbeatMs: z.number().min(0).default(0),
  durationMs: z.number().int().positive(),
  timingSource: z.enum(['curated-fallback', 'analyzed']).default('curated-fallback'),
});

export const manifestSchema = z.object({
  generatedAt: z.string(),
  tracks: z.array(trackSchema).min(1),
});

export type Track = z.infer<typeof trackSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(data: unknown): Manifest {
  const manifest = manifestSchema.parse(data);
  const ids = new Set<string>();
  for (const track of manifest.tracks) {
    if (ids.has(track.spotifyId)) throw new Error(`Duplicate Spotify track id: ${track.spotifyId}`);
    ids.add(track.spotifyId);
  }
  return manifest;
}
