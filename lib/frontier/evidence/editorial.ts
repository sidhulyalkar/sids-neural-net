import { z } from 'zod';
import { PublicSourceUrlSchema, type StoryManifest } from './schema';

/** Authored publisher-reported signals, never independently reproduced data.
 * Every signal resolves to a reviewed section in this immutable source revision. */
const Signal = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/),
  value: z.string().trim().min(1).max(22),
  label: z.string().trim().min(5).max(100),
  detail: z.string().trim().min(12).max(260),
  sourceUrl: PublicSourceUrlSchema,
});
const Insight = z.strictObject({
  label: z.string().trim().min(3).max(80),
  title: z.string().trim().min(10).max(150),
  detail: z.string().trim().min(20).max(360),
  sourceUrl: PublicSourceUrlSchema,
});
export const SourceEditorialSchema = z.strictObject({
  schemaVersion: z.literal(1),
  itemId: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,119}$/),
  source: z.strictObject({
    id: z.string().min(5).max(192),
    url: PublicSourceUrlSchema,
    revision: z.string().trim().min(1).max(128),
  }),
  title: z.string().trim().min(12).max(190),
  lead: z.string().trim().min(30).max(520),
  question: z.string().trim().min(15).max(220),
  signals: z.array(Signal).min(2).max(4),
  insight: Insight,
});
export type SourceEditorial = z.infer<typeof SourceEditorialSchema>;

export function parseSourceEditorial(input: unknown, manifest: StoryManifest): SourceEditorial {
  const editorial = SourceEditorialSchema.parse(input);
  if (editorial.itemId !== manifest.itemId
    || editorial.source.id !== manifest.source.id
    || editorial.source.url !== manifest.source.url
    || editorial.source.revision !== manifest.source.revision) {
    throw new Error('Editorial source identity must match the exact published revision');
  }
  const anchored = new Set(manifest.evidence
    .filter((record) => record.type === 'quotation'
      && record.role === 'section-heading' && record.status === 'publisher-reported')
    .map((record) => record.locator.sourceUrl));
  const ids = new Set<string>();
  for (const signal of editorial.signals) {
    if (ids.has(signal.id)) throw new Error('Repeated editorial research signal');
    ids.add(signal.id);
    if (!anchored.has(signal.sourceUrl)) {
      throw new Error('Publisher-reported claim must link to a verified source section');
    }
  }
  if (!anchored.has(editorial.insight.sourceUrl)) {
    throw new Error('Editorial research insight must link to a verified source section');
  }
  return editorial;
}
