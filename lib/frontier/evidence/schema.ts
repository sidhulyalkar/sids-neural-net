import { z } from 'zod';

/**
 * Public evidence contract, independent of the reader and discovery adapters.
 * Parsing a document here does NOT grant permission to fetch its URLs.
 * Every remote fetch still requires the server's DNS, redirect and MIME gates.
 */
const recordId = z.string().min(2).max(96).regex(/^[a-z][a-z0-9_-]+$/);
const sourceId = z.string().min(5).max(192).regex(/^[a-z][a-z0-9-]+:[A-Za-z0-9][A-Za-z0-9._@/:-]*$/);
const label = z.string().trim().min(1).max(200);
const timestamp = z.string().refine((value) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && !Number.isNaN(new Date(value).getTime()),
  'Expected a valid UTC ISO-8601 timestamp'
);

/** URL shape only. Trust and permissions are determined by the source adapter. */
export function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.')) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
      || host.endsWith('.internal') || host.endsWith('.home.arpa')
      || host.startsWith('[') || host.includes(':')) return false;
    // IP literals have no legitimate place in public publisher pointers.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || /^\d+(?:\.\d+){1,3}$/.test(host)) return false;
    return url.href.length <= 2048;
  } catch {
    return false;
  }
}
export const PublicSourceUrlSchema = z.string().url().max(2048)
  .refine(isPublicHttpsUrl, 'Must be a public HTTPS publisher/source URL');

export const EvidenceStatusSchema = z.enum([
  'publisher-reported', 'extracted-needs-review', 'verified-derived',
]);

export const SourceIdentitySchema = z.strictObject({
  id: sourceId,
  publisher: label,
  url: PublicSourceUrlSchema,
  kind: z.enum(['paper', 'repository', 'sports', 'video', 'nature', 'entertainment', 'article']),
  revision: z.string().trim().min(1).max(128),
  observedAt: timestamp,
});

export const EvidenceLocatorSchema = z.strictObject({
  sourceId,
  sourceUrl: PublicSourceUrlSchema,
  revision: z.string().trim().min(1).max(128),
  section: z.string().trim().min(1).max(160).optional(),
  page: z.number().int().min(1).max(100_000).optional(),
  figureId: z.string().trim().min(1).max(120).optional(),
  span: z.strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }).refine(({ start, end }) => end > start, 'Source span must have positive length').optional(),
});

export const AssetRightsSchema = z.strictObject({
  display: z.enum(['permitted', 'link-only', 'unknown']),
  license: z.string().trim().min(1).max(180).optional(),
  attribution: z.string().trim().min(1).max(260).optional(),
  rightsUrl: PublicSourceUrlSchema.optional(),
}).superRefine((rights, ctx) => {
  if (rights.display === 'permitted' && (!rights.attribution || (!rights.license && !rights.rightsUrl))) {
    ctx.addIssue({
      code: 'custom',
      message: 'Display permission requires attribution and a license or explicit rights source',
    });
  }
});

const common = {
  id: recordId,
  status: EvidenceStatusSchema,
  locator: EvidenceLocatorSchema,
};

const assetKey = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'Expected an immutable content hash');
const shortKey = z.string().min(2).max(120).regex(/^[a-z0-9][a-z0-9._:-]+$/i);

export const QuotationEvidenceSchema = z.strictObject({
  type: z.literal('quotation'),
  ...common,
  text: z.string().trim().min(1).max(1600),
});

export const FigureEvidenceSchema = z.strictObject({
  type: z.literal('figure'),
  ...common,
  assetKey,
  caption: z.string().trim().min(12).max(1200),
  alt: z.string().trim().min(8).max(360),
  rights: AssetRightsSchema,
  comparisonGroup: shortKey.optional(),
  viewpointKey: shortKey.optional(),
  condition: label.optional(),
  observedAt: timestamp.optional(),
  registration: z.enum(['publisher-paired', 'verified-registered']).optional(),
});

export const MeasurementEvidenceSchema = z.strictObject({
  type: z.literal('measurement'),
  ...common,
  metricKey: shortKey,
  metricLabel: label,
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(64),
  method: label,
  dataset: shortKey.optional(),
  split: shortKey.optional(),
  protocol: shortKey.optional(),
  comparisonGroup: shortKey.optional(),
  direction: z.enum(['higher', 'lower']).optional(),
});

export const SeriesEvidenceSchema = z.strictObject({
  type: z.literal('series'),
  ...common,
  assetKey,
  xUnit: z.string().trim().min(1).max(64),
  yUnit: z.string().trim().min(1).max(64),
  clockId: shortKey,
  channel: label,
  sampleCount: z.number().int().min(2).max(100_000_000),
  sampleRateHz: z.number().finite().positive().max(1_000_000),
  startAt: timestamp,
});

export const EventEvidenceSchema = z.strictObject({
  type: z.literal('event'),
  ...common,
  eventGroup: shortKey,
  label,
  eventType: shortKey,
  offsetSeconds: z.number().finite().nonnegative().max(86_400).optional(),
  occurredAt: timestamp.optional(),
}).refine((event) => event.offsetSeconds !== undefined || event.occurredAt !== undefined,
  'An event requires an observed time or verified media offset');

export const SourceFileEvidenceSchema = z.strictObject({
  type: z.literal('source-file'),
  ...common,
  path: z.string().trim().min(1).max(360)
    .refine((path) => !path.startsWith('/') && !path.includes('\\')
      && !path.split('/').includes('..') && !path.includes('\0'), 'Expected a safe relative file path'),
  commit: z.string().regex(/^[a-f0-9]{40}$/, 'Exact immutable Git commit SHA required'),
  role: z.enum(['input', 'transform', 'output']).optional(),
});

export const PipelineEdgeEvidenceSchema = z.strictObject({
  type: z.literal('pipeline-edge'),
  ...common,
  fromId: recordId,
  toId: recordId,
  relation: z.enum(['flows-into', 'depends-on']),
});

export const VideoEvidenceSchema = z.strictObject({
  type: z.literal('video'),
  ...common,
  sourceUrl: PublicSourceUrlSchema,
  durationSeconds: z.number().finite().positive().max(86_400).optional(),
  rights: AssetRightsSchema,
});

export const SportsStateEvidenceSchema = z.strictObject({
  type: z.literal('sports-state'),
  ...common,
  eventId: shortKey,
  league: label,
  statusLabel: label,
  observedAt: timestamp,
  competitors: z.array(z.strictObject({
    name: label,
    score: z.number().int().nonnegative().optional(),
  })).min(2).max(4),
});

export const GeoObservationEvidenceSchema = z.strictObject({
  type: z.literal('geo-observation'),
  ...common,
  observationId: shortKey,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  crs: z.literal('EPSG:4326'),
  observedAt: timestamp,
  accuracyMeters: z.number().finite().nonnegative().max(10_000_000).optional(),
});

export const EvidenceRecordSchema = z.discriminatedUnion('type', [
  QuotationEvidenceSchema, FigureEvidenceSchema, MeasurementEvidenceSchema,
  SeriesEvidenceSchema, EventEvidenceSchema, SourceFileEvidenceSchema, PipelineEdgeEvidenceSchema,
  VideoEvidenceSchema, SportsStateEvidenceSchema, GeoObservationEvidenceSchema,
]);

export const SceneTypeSchema = z.enum([
  'editorial-reading', 'original-figure', 'figure-compare', 'benchmark-table',
  'verified-pipeline', 'event-timeline', 'source-video', 'sports-state',
  'geospatial-observations', 'time-aligned-signals',
]);

const SceneOperationSchema = z.enum(['inspect', 'switch', 'scrub', 'highlight', 'compare']);
export const StorySceneSchema = z.strictObject({
  id: recordId,
  type: SceneTypeSchema,
  title: label,
  question: z.string().trim().min(8).max(360),
  evidenceIds: z.array(recordId).max(40),
  operations: z.array(SceneOperationSchema).max(5),
  accessibleSummary: z.string().trim().min(12).max(800),
  annotation: z.enum(['publisher-original', 'source-reported', 'verified-derived', 'editorial-explanation']),
});

export const StoryManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  itemId: z.string().trim().min(3).max(192),
  source: SourceIdentitySchema,
  extractorVersion: z.string().trim().min(1).max(96),
  compilerVersion: z.string().trim().min(1).max(96),
  builtAt: timestamp,
  state: z.enum(['basic', 'partial', 'rich']),
  evidence: z.array(EvidenceRecordSchema).max(160),
  scenes: z.array(StorySceneSchema).max(12),
}).superRefine((manifest, ctx) => {
  const ids = new Map<string, (typeof manifest.evidence)[number]>();
  for (const [index, evidence] of manifest.evidence.entries()) {
    if (ids.has(evidence.id)) {
      ctx.addIssue({ code: 'custom', path: ['evidence', index, 'id'], message: 'Duplicate evidence ID' });
    }
    ids.set(evidence.id, evidence);
    if (evidence.locator.sourceId !== manifest.source.id
      || evidence.locator.revision !== manifest.source.revision) {
      ctx.addIssue({
        code: 'custom', path: ['evidence', index, 'locator'],
        message: 'Evidence must refer to this exact source revision',
      });
    }
    // In V1, the locator must resolve on the canonical publisher host.
    // Future adapters can expose narrowly authorized cross-host origins,
    // but arbitrary citations to other domains are never inferred as proof.
    if (new URL(evidence.locator.sourceUrl).origin !== new URL(manifest.source.url).origin) {
      ctx.addIssue({
        code: 'custom', path: ['evidence', index, 'locator', 'sourceUrl'],
        message: 'Evidence locator must use the canonical source publisher origin',
      });
    }
  }
  const sceneIds = new Set<string>();
  for (const [index, scene] of manifest.scenes.entries()) {
    if (sceneIds.has(scene.id)) {
      ctx.addIssue({ code: 'custom', path: ['scenes', index, 'id'], message: 'Duplicate scene ID' });
    }
    sceneIds.add(scene.id);
    if (new Set(scene.evidenceIds).size !== scene.evidenceIds.length) {
      ctx.addIssue({ code: 'custom', path: ['scenes', index, 'evidenceIds'], message: 'Repeated evidence reference' });
    }
    for (const id of scene.evidenceIds) {
      if (!ids.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['scenes', index, 'evidenceIds'], message: 'Scene refers to missing evidence ID: ' + id });
      } else if (ids.get(id)?.status === 'extracted-needs-review') {
        ctx.addIssue({ code: 'custom', path: ['scenes', index, 'evidenceIds'], message: 'Unreviewed evidence cannot power a scene: ' + id });
      }
    }
  }
  if (manifest.state === 'basic' && manifest.scenes.some(scene => scene.type !== 'editorial-reading')) {
    ctx.addIssue({ code: 'custom', path: ['state'], message: 'Basic stories cannot advertise interactive evidence scenes' });
  }
});

export type SourceIdentity = z.infer<typeof SourceIdentitySchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type StoryScene = z.infer<typeof StorySceneSchema>;
export type StoryManifest = z.infer<typeof StoryManifestSchema>;

export function parseStoryManifest(value: unknown): StoryManifest {
  return StoryManifestSchema.parse(value);
}
