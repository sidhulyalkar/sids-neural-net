import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInitialProfile } from '../lib/frontier/config';
import { FRONTIER_EDITORIAL_PREFERENCES } from '../lib/frontier/editorialTaste';
import { isFrontierEditoriallyQualified } from '../lib/frontier/editorialAdmission';
import { cleanFrontierItem, isFrontierEditoriallyUsable } from '../lib/frontier/editorialQuality';
import {
  buildFrontierEditorialReviewRows,
  evaluateFrontierEditorialReview,
  sampleFrontierEditorialReview,
  type FrontierEditorialReviewLabel,
} from '../lib/frontier/editorialReview';
import { rankFrontierItems, selectDailyRun } from '../lib/frontier/scoring';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import type { FrontierFeedResponse, FrontierItem } from '../lib/frontier/types';

function arg(name: string): string | undefined {
  const pair = process.argv.slice(2).find((part) => part.startsWith('--' + name + '='));
  return pair ? pair.slice(name.length + 3) : undefined;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return '"' + text.replaceAll('"', '""') + '"';
}

async function main() {
  const inputPath = path.resolve(arg('snapshot') ?? 'content/frontier/latest.json');
  const outputDir = path.resolve(arg('output') ?? 'artifacts/frontier-editorial-review');
  const maxSample = Number.parseInt(arg('sample') ?? '100', 10);
  if (!Number.isFinite(maxSample) || maxSample < 28 || maxSample > 1000) {
    throw new Error('--sample must be between 28 and 1000 so both top-14 editions remain reviewable');
  }

  const input = await readFile(inputPath, 'utf8');
  const sourceSha256 = createHash('sha256').update(input).digest('hex');
  const feed = JSON.parse(input) as FrontierFeedResponse;
  if (!Array.isArray(feed.items)) throw new Error('Snapshot must contain an items array');
  const at = new Date(feed.generatedAt);
  if (!Number.isFinite(at.getTime())) throw new Error('Snapshot has no valid generatedAt provenance');

  const rejectedPath = path.resolve(arg('rejected')
    ?? 'artifacts/frontier-editorial-review/rejected-candidates.json');
  let rejected: FrontierItem[] = [];
  let rejectionCapture: 'observed-from-discovery' | 'unavailable' = 'unavailable';
  try {
    const shadow = JSON.parse(await readFile(rejectedPath, 'utf8')) as {
      generatedAt?: string; items?: FrontierItem[];
    };
    if (!Array.isArray(shadow.items) || shadow.generatedAt !== feed.generatedAt) {
      throw new Error('Rejected review archive must match this snapshot generatedAt');
    }
    rejected = shadow.items;
    rejectionCapture = 'observed-from-discovery';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  // Rejected candidates are public source metadata held in a separate audit
  // artifact, NEVER in latest.json or /api/frontier/feed. Deduplicate them
  // against admitted candidates so the benchmark does not double-count.
  const seenIds = new Set(feed.items.map((item) => item.id));
  const seenUrls = new Set(feed.items.map((item) => item.url));
  const rejectedOnly = rejected.filter((item) => {
    if (seenIds.has(item.id) || seenUrls.has(item.url)) return false;
    seenIds.add(item.id);
    seenUrls.add(item.url);
    return true;
  });
  const allCandidates = [...feed.items, ...rejectedOnly];
  const observed = allCandidates.map(cleanFrontierItem).filter(isFrontierSourceAdmitted);
  const qualified = observed.filter((item) =>
    isFrontierEditoriallyUsable(item) && isFrontierEditoriallyQualified(item));

  // Control: the previous provider-ordered first-36 strategy, holding the
  // same source-trust filter. This is a strategy comparison, NOT proof of the
  // historical production reader's exact delivered slate.
  const baseline = selectDailyRun(observed.slice(0, 36), {}, 36, at);
  const ranked = rankFrontierItems(qualified, createInitialProfile(), {}, at);
  const selected = selectDailyRun(ranked, {}, 36, at);

  const baselineOrder = [
    ...baseline,
    ...observed.filter((item) => !baseline.some((candidate) => candidate.id === item.id)),
  ].map((item) => item.id);
  const newOrder = [
    ...selected,
    ...ranked.filter((item) => !selected.some((candidate) => candidate.id === item.id)),
  ].map((item) => item.id);
  const rows = buildFrontierEditorialReviewRows(allCandidates, baselineOrder, newOrder);
  const sample = sampleFrontierEditorialReview(rows, maxSample);

  const labelsPath = arg('labels');
  const providedLabels = labelsPath
    ? JSON.parse(await readFile(path.resolve(labelsPath), 'utf8')) as unknown
    : [];
  if (!Array.isArray(providedLabels)) throw new Error('Labels must be a JSON array');
  const labels = providedLabels as FrontierEditorialReviewLabel[];
  const report = evaluateFrontierEditorialReview(sample, labels);

  await mkdir(outputDir, { recursive: true });
  const metadata = {
    sourcePath: path.relative(process.cwd(), inputPath),
    sourceSha256,
    sourceGeneratedAt: feed.generatedAt,
    sampleSize: sample.length,
    totalCandidates: allCandidates.length,
    publicSnapshotCandidates: feed.items.length,
    rejectedAuditCandidates: rejectedOnly.length,
    rejectionCapture,
    trustedCandidates: observed.length,
    editorialQualifiedCandidates: qualified.length,
    baselineModel: 'provider-ordered trusted first 36: composition-only control',
    challengerModel: 'evidence-qualified full-corpus cold-start personalized rank then compose',
    humanSourceInspection: labelsPath ? 'user-provided-labels' : 'not-conducted',
    preferenceCalibration: FRONTIER_EDITORIAL_PREFERENCES,
  };
  const template = sample.map((row) => ({
    id: row.id, worthwhile: null, relevant: null, novel: null,
    sourceTraceable: null, claimsSupported: null,
    conceptualInsight: null, practicalUtility: null, avoidsNoise: null,
    unexpectedWorthwhile: null, notes: '',
  } satisfies FrontierEditorialReviewLabel));
  const headers = [
    'id', 'title', 'url', 'sourceKind', 'lane', 'summary', 'admitted', 'reason',
    'flags', 'baselineRank', 'qualifiedRank', 'baselineTop14', 'qualifiedTop14',
    'qualifiedExploration',
  ] as const;
  const csv = [
    headers.join(','),
    ...sample.map((row) => headers.map((field) => csvEscape(
      field === 'flags' ? row.flags.join(' | ') : row[field]
    )).join(',')),
  ].join('\n') + '\n';

  await Promise.all([
    writeFile(path.join(outputDir, 'sample.json'), JSON.stringify({ metadata, rows: sample }, null, 2) + '\n'),
    writeFile(path.join(outputDir, 'sample.csv'), csv),
    writeFile(path.join(outputDir, 'labels.template.json'), JSON.stringify(template, null, 2) + '\n'),
    writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ metadata, report }, null, 2) + '\n'),
  ]);
  console.log(JSON.stringify({
    snapshotSha256: sourceSha256,
    input: allCandidates.length,
    published: feed.items.length,
    rejectedReviewCandidates: rejectedOnly.length,
    rejectionCapture,
    trusted: observed.length,
    qualified: qualified.length,
    sampled: sample.length,
    toReview: sample.length - report.labeled,
    editorialTop14: report.qualifiedTop14Ids.length,
    humanEvidence: report.evidence,
    complete: report.reviewComplete,
    metrics: report.metrics,
    calibration: report.calibration,
    tasteReviewComplete: report.tasteReviewComplete,
    outputDir: path.relative(process.cwd(), outputDir),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
