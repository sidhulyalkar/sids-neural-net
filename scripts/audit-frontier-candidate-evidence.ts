import frontierSnapshot from '../content/frontier/latest.json';
import { assessFrontierCandidateEvidence } from '../lib/frontier/candidateEvidence';
import type { FrontierFeedResponse, FrontierItem } from '../lib/frontier/types';

const snapshot = frontierSnapshot as FrontierFeedResponse;
const relevant = (snapshot.items ?? []).filter((item) => item.sourceKind === 'github' || item.sourceKind === 'openalex');

const rows = relevant.map((item) => ({
  item,
  evidence: assessFrontierCandidateEvidence(item),
}));

const byDisposition = rows.reduce<Record<string, number>>((counts, row) => {
  counts[row.evidence.disposition] = (counts[row.evidence.disposition] ?? 0) + 1;
  return counts;
}, {});

const bySource = rows.reduce<Record<string, Record<string, number>>>((counts, row) => {
  const source = row.item.sourceKind;
  const bucket = counts[source] ?? { retain: 0, demote: 0, suppress: 0 };
  bucket[row.evidence.disposition] = (bucket[row.evidence.disposition] ?? 0) + 1;
  counts[source] = bucket;
  return counts;
}, {});

const byLane = rows.reduce<Record<string, Record<string, number>>>((counts, row) => {
  const lane = row.item.lane;
  const bucket = counts[lane] ?? { retain: 0, demote: 0, suppress: 0 };
  bucket[row.evidence.disposition] = (bucket[row.evidence.disposition] ?? 0) + 1;
  counts[lane] = bucket;
  return counts;
}, {});

function compact(item: FrontierItem, evidence: ReturnType<typeof assessFrontierCandidateEvidence>) {
  return {
    id: item.id,
    sourceKind: item.sourceKind,
    lane: item.lane,
    title: item.title,
    baseScore: Number(item.baseScore.toFixed(4)),
    evidenceScore: Number(evidence.score.toFixed(4)),
    disposition: evidence.disposition,
    laneHits: evidence.distinctLaneHits,
    specificHits: evidence.specificLaneHits,
    stars: evidence.stars,
    forks: evidence.forks,
    reasons: evidence.reasons,
  };
}

const changed = rows
  .filter((row) => row.evidence.disposition !== 'retain')
  .sort((a, b) => b.item.baseScore - a.item.baseScore)
  .map((row) => compact(row.item, row.evidence));

const retainedZeroEvidenceGithub = rows
  .filter((row) => row.item.sourceKind === 'github')
  .filter((row) => (row.evidence.stars ?? 0) === 0 && (row.evidence.forks ?? 0) === 0)
  .filter((row) => row.evidence.disposition === 'retain')
  .sort((a, b) => b.item.baseScore - a.item.baseScore)
  .map((row) => compact(row.item, row.evidence));

const retainedZeroCitationOpenAlex = rows
  .filter((row) => row.item.sourceKind === 'openalex')
  .filter((row) => itemMetric(row.item, 'citations') === 0)
  .filter((row) => row.evidence.disposition === 'retain')
  .sort((a, b) => b.item.baseScore - a.item.baseScore)
  .map((row) => compact(row.item, row.evidence));

function itemMetric(item: FrontierItem, label: string): number | null {
  const metric = item.metrics?.find((entry) => entry.label.toLowerCase() === label.toLowerCase());
  if (!metric) return null;
  const parsed = Number(String(metric.value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const report = {
  schema: 'frontier-candidate-evidence-shadow-v1',
  snapshotGeneratedAt: snapshot.generatedAt,
  totalSnapshotItems: snapshot.items?.length ?? 0,
  evaluatedItems: rows.length,
  byDisposition,
  bySource,
  byLane,
  changed,
  protectedFreshGithub: retainedZeroEvidenceGithub,
  protectedFreshOpenAlex: retainedZeroCitationOpenAlex,
};

console.log(JSON.stringify(report, null, 2));
