import { z } from 'zod';

export const timeRangeSchema = z.enum(['short_term', 'medium_term', 'long_term']);
export type TimeRange = z.infer<typeof timeRangeSchema>;

export const spotifyArtistRefSchema = z.object({
  spotifyId: z.string().min(1),
  name: z.string().min(1),
  spotifyUrl: z.string().url(),
});

export const trackSchema = z.object({
  rank: z.number().int().positive(),
  spotifyId: z.string().regex(/^[A-Za-z0-9]+$/),
  title: z.string().min(1),
  artist: z.string().min(1),
  artists: z.array(spotifyArtistRefSchema).min(1),
  album: z.string().default(''),
  albumArtUrl: z.union([z.string().url(), z.literal('')]).default(''),
  spotifyUrl: z.string().url(),
  durationMs: z.number().int().positive().optional(),
  explicit: z.boolean().optional(),
  // Spotify removed popularity from Development Mode responses in 2026.
  // Keep it optional so Extended Quota responses remain forward compatible.
  popularity: z.number().int().min(0).max(100).optional(),
});

export const artistSchema = z.object({
  rank: z.number().int().positive(),
  spotifyId: z.string().regex(/^[A-Za-z0-9]+$/),
  name: z.string().min(1),
  spotifyUrl: z.string().url(),
  imageUrl: z.union([z.string().url(), z.literal('')]).default(''),
  // Genres are deprecated by Spotify and may disappear from Development Mode.
  genres: z.array(z.string()).default([]),
});

export const listeningSnapshotSchema = z.object({
  timeRange: timeRangeSchema,
  tracks: z.array(trackSchema).max(50),
  artists: z.array(artistSchema).max(50),
});

export const manifestSchema = z.object({
  version: z.literal(2),
  generatedAt: z.string().datetime(),
  source: z.literal('spotify-top-items'),
  isPlaceholder: z.boolean().default(false),
  snapshots: z.object({
    short_term: listeningSnapshotSchema,
    medium_term: listeningSnapshotSchema,
    long_term: listeningSnapshotSchema,
  }),
}).superRefine((manifest, ctx) => {
  for (const range of timeRangeSchema.options) {
    if (manifest.snapshots[range].timeRange !== range) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['snapshots', range, 'timeRange'],
        message: `snapshot key ${range} must match its timeRange`,
      });
    }
  }
});

export type SpotifyArtistRef = z.infer<typeof spotifyArtistRefSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Artist = z.infer<typeof artistSchema>;
export type ListeningSnapshot = z.infer<typeof listeningSnapshotSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(data: unknown): Manifest {
  return manifestSchema.parse(data);
}
