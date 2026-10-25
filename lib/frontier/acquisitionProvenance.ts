import {
  FRONTIER_ACQUISITION_QUERY_KINDS,
  type FrontierAcquisitionProvenance,
  type FrontierAcquisitionQuery,
  type FrontierAcquisitionQueryKind,
} from './types';

export const FRONTIER_MAX_ACQUISITION_QUERIES = 8;
export const FRONTIER_MAX_ACQUISITION_QUERY_LENGTH = 2_048;

const QUERY_KINDS = new Set<string>(FRONTIER_ACQUISITION_QUERY_KINDS);

function canonicalQuery(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function canonicalObservation(
  value: FrontierAcquisitionQuery,
): FrontierAcquisitionQuery | null {
  if (!QUERY_KINDS.has(value.kind)) return null;
  const query = canonicalQuery(value.query);
  if (!query || query.length > FRONTIER_MAX_ACQUISITION_QUERY_LENGTH) return null;
  return { kind: value.kind, query };
}

/** Record one factual source query without assigning relevance or recommendation authority. */
export function frontierAcquisitionFromQuery(
  kind: FrontierAcquisitionQueryKind,
  query: string,
): FrontierAcquisitionProvenance | undefined {
  const observation = canonicalObservation({ kind, query });
  return observation ? { queries: [observation] } : undefined;
}

/**
 * Deterministically union factual acquisition observations. The bounded set is
 * deliberately small so a pathological source cannot inflate private archives.
 */
export function mergeFrontierAcquisition(
  ...values: Array<FrontierAcquisitionProvenance | undefined>
): FrontierAcquisitionProvenance | undefined {
  const unique = new Map<string, FrontierAcquisitionQuery>();
  for (const value of values) {
    for (const raw of value?.queries ?? []) {
      const observation = canonicalObservation(raw);
      if (!observation) continue;
      const key = `${observation.kind}\u0000${observation.query.toLocaleLowerCase('en-US')}`;
      if (!unique.has(key)) unique.set(key, observation);
    }
  }
  const queries = Array.from(unique.values())
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.query.localeCompare(b.query))
    .slice(0, FRONTIER_MAX_ACQUISITION_QUERIES);
  return queries.length ? { queries } : undefined;
}
