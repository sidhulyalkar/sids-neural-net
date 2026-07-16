import { z } from 'zod';

export const trackSchema = z.object({
  spotifyId: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().default(''),
  albumArtUrl: z.string().default(''),
  spotifyUrl: z.string().min(1),
  popularity: z.number().int().min(0).max(100).default(0),
  bpm: z.number().positive().optional(),
  downbeatMs: z.number().min(0).optional(),
});

export const manifestSchema = z.object({
  generatedAt: z.string(),
  tracks: z.array(trackSchema),
});

export type Track = z.infer<typeof trackSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(data: unknown): Manifest {
  return manifestSchema.parse(data);
}
