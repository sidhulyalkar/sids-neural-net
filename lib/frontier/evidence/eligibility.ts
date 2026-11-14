import {
  StoryManifestSchema,
  type StoryManifest,
  type EvidenceRecord,
  type StoryScene,
} from './schema';

/**
 * These are evidence permissions, NOT available React renderers. The V3
 * investigation surface must opt in only after a renderer has its own QA gate.
 */
export type SceneType = StoryScene['type'];
export type SceneOperation = StoryScene['operations'][number];

export type SceneEligibility = {
  type: SceneType;
  eligible: boolean;
  evidenceIds: string[];
  operations: SceneOperation[];
  reason: string;
};

const SCENE_ORDER: SceneType[] = [
  'editorial-reading', 'original-figure', 'figure-compare', 'benchmark-table',
  'verified-pipeline', 'event-timeline', 'source-video',
  'sports-state', 'geospatial-observations', 'time-aligned-signals',
];

const ACTIVITY_METRIC = /^(?:hf[-_ ]?)?(?:stars?|forks?|upvotes?|downvotes?|likes?|views?|comments?|citations?|followers?|subscribers?|downloads?|points?)$/i;

function eligibleEvidence(manifest: StoryManifest): EvidenceRecord[] {
  return manifest.evidence.filter((record) => record.status !== 'extracted-needs-review');
}

function groups<T extends EvidenceRecord>(
  records: T[],
  selector: (record: T) => string | null,
): T[][] {
  const byKey = new Map<string, T[]>();
  for (const record of records) {
    const key = selector(record);
    if (!key) continue;
    const bucket = byKey.get(key) ?? [];
    bucket.push(record);
    byKey.set(key, bucket);
  }
  return Array.from(byKey.values());
}

function choose<T extends EvidenceRecord>(records: T[], number = 12): string[] {
  return records.slice(0, number).map((record) => record.id);
}

function answer(
  type: SceneType,
  evidenceIds: string[],
  operations: SceneOperation[],
  missingReason: string,
): SceneEligibility {
  return evidenceIds.length
    ? { type, eligible: true, evidenceIds, operations, reason: 'Qualified source evidence available' }
    : { type, eligible: false, evidenceIds: [], operations: [], reason: missingReason };
}

function evaluate(manifest: StoryManifest): SceneEligibility[] {
  const evidence = eligibleEvidence(manifest);
  const figures = evidence.filter((record) => record.type === 'figure'
    && record.rights.display === 'permitted');
  const measurements = evidence.filter((record) => record.type === 'measurement'
    && !ACTIVITY_METRIC.test(record.metricKey) && !ACTIVITY_METRIC.test(record.metricLabel));
  const files = evidence.filter((record) => record.type === 'source-file'
    && record.commit === manifest.source.revision && Boolean(record.role));
  const pipelineEdges = evidence.filter((record) => record.type === 'pipeline-edge');
  const events = evidence.filter((record) => record.type === 'event');
  const signals = evidence.filter((record) => record.type === 'series');

  const figurePairs = groups(figures, (figure) =>
    figure.type === 'figure' && figure.comparisonGroup && figure.viewpointKey && figure.registration
      ? figure.comparisonGroup + ':' + figure.viewpointKey + ':' + figure.registration : null,
  ).find((pair) => pair.length >= 2 && pair.some((left) =>
    pair.some((right) => right.id !== left.id
      && ((left.type === 'figure' && right.type === 'figure'
        && left.condition && right.condition && left.condition !== right.condition)
      || (left.type === 'figure' && right.type === 'figure'
        && left.observedAt && right.observedAt && left.observedAt !== right.observedAt)))));

  const comparable = groups(measurements, (record) => record.type === 'measurement'
    && record.dataset && record.split && record.protocol && record.direction && record.comparisonGroup
    ? [record.metricKey, record.unit, record.dataset, record.split, record.protocol,
      record.direction, record.comparisonGroup].join('|') : null)
    .find((group) => group.length >= 2 && new Set(group.map((record) =>
      record.type === 'measurement' ? record.method.toLowerCase() : '')).size >= 2);

  const eligibleFileIds = new Set(files.map((file) => file.id));
  const graphEdges = pipelineEdges.filter((edge) =>
    edge.type === 'pipeline-edge' && edge.fromId !== edge.toId
    && eligibleFileIds.has(edge.fromId) && eligibleFileIds.has(edge.toId));
  const graphFileIds = new Set(graphEdges.flatMap((edge) =>
    edge.type === 'pipeline-edge' ? [edge.fromId, edge.toId] : []));
  const verifiedGraph = manifest.source.kind === 'repository' && graphEdges.length
    ? [...files.filter((file) => graphFileIds.has(file.id)), ...graphEdges] : [];

  const timedEvents = groups(events, (event) => event.type === 'event'
    ? event.eventGroup + ':' + (event.offsetSeconds !== undefined ? 'offset' : 'absolute') : null)
    .find((group) => group.length >= 2 && new Set(group.map((event) => event.type === 'event'
      ? String(event.offsetSeconds ?? event.occurredAt) : '')).size >= 2);

  const synced = groups(signals, (series) => series.type === 'series'
    ? [series.clockId, series.startAt, series.sampleRateHz, series.xUnit].join('|') : null)
    .find((group) => group.length >= 2 && new Set(group.map((record) =>
      record.type === 'series' ? record.channel.toLowerCase() : '')).size >= 2);

  const sourceVideos = evidence.filter((record) =>
    record.type === 'video' && record.rights.display !== 'unknown');
  const officialSports = manifest.source.kind === 'sports'
    ? evidence.filter((record) => record.type === 'sports-state') : [];
  const geo = manifest.source.kind === 'nature'
    ? evidence.filter((record) => record.type === 'geo-observation') : [];

  return [
    { type: 'editorial-reading', eligible: true, evidenceIds: [], operations: ['inspect'],
      reason: 'The original source is always the fallback' },
    answer('original-figure', choose(figures), ['inspect', 'switch'],
      'No display-permitted, source-anchored original figure'),
    answer('figure-compare', choose(figurePairs ?? []), ['inspect', 'compare'],
      'No publisher-paired, registered and comparable source figures'),
    answer('benchmark-table', choose(comparable ?? []), ['inspect', 'switch'],
      'No same-metric, unit, dataset, split, protocol and comparable methods'),
    answer('verified-pipeline', choose(verifiedGraph), ['inspect', 'highlight'],
      'No documented file-stage edges pinned to the source Git commit'),
    answer('event-timeline', choose(timedEvents ?? []), ['inspect', 'scrub'],
      'No two timecoded events in the same original event group'),
    answer('source-video', choose(sourceVideos), ['inspect'],
      'No source-hosted video with a resolved display/link policy'),
    answer('sports-state', choose(officialSports), ['inspect'],
      'No structured official sports-state evidence'),
    answer('geospatial-observations', choose(geo), ['inspect'],
      'No documented WGS84 observation coordinates'),
    answer('time-aligned-signals', choose(synced ?? []), ['inspect', 'scrub'],
      'No two source series with a validated shared clock, sample rate and start time'),
  ];
}

/** Returns the entire matrix, including reasons for abstention.
 * A valid manifest can still have zero renderable specialized scenes. */
export function evaluateStorySceneEligibility(input: unknown): SceneEligibility[] {
  const manifest = StoryManifestSchema.parse(input);
  const candidates = evaluate(manifest);
  // Registry order must stay stable as additional content adapters arrive.
  return SCENE_ORDER.map((type) => {
    const candidate = candidates.find((entry) => entry.type === type);
    if (!candidate) throw new Error('Missing evidence-scene registry entry: ' + type);
    return candidate;
  });
}

/**
 * Structural validation alone does not authorize a scene. Renderers must
 * accept this stricter verification path (or an equivalent signed server
 * contract), never raw user-supplied scene declarations.
 */
export function parseQualifiedStoryManifest(input: unknown): StoryManifest {
  const manifest = StoryManifestSchema.parse(input);
  const qualified = new Map(evaluate(manifest).map((scene) => [scene.type, scene]));
  for (const scene of manifest.scenes) {
    const gate = qualified.get(scene.type);
    if (!gate?.eligible) throw new Error('Scene lacks qualified evidence: ' + scene.type);
    const allowed = new Set(gate.evidenceIds);
    if (scene.evidenceIds.some((id) => !allowed.has(id))) {
      throw new Error('Scene references evidence outside its eligible group: ' + scene.id);
    }
    if (scene.type !== 'editorial-reading' && scene.evidenceIds.length < Math.min(2,
      ['benchmark-table', 'figure-compare', 'event-timeline', 'time-aligned-signals', 'verified-pipeline'].includes(scene.type)
        ? 2 : 1)) {
      throw new Error('Scene has insufficient qualifying records: ' + scene.id);
    }
    if (scene.operations.some((operation) => !gate.operations.includes(operation))) {
      throw new Error('Scene requests an unsupported operation: ' + scene.id);
    }
    if (scene.annotation === 'verified-derived'
      && scene.evidenceIds.some((id) => manifest.evidence.find((record) => record.id === id)?.status !== 'verified-derived')) {
      throw new Error('Publisher-reported evidence cannot be represented as independently verified: ' + scene.id);
    }
  }
  return manifest;
}
