import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FRONTIER_LANE_MAP, createInitialProfile } from '../lib/frontier/config';
import { frontierRerankWindowSize } from '../lib/frontier/adaptiveSlate';
import { rankFrontierItems, selectDailyRun } from '../lib/frontier/scoring';
import { evaluateSlateCounterfactual } from '../lib/frontier/slateEvaluation';
import type { FrontierItem } from '../lib/frontier/types';

type Snapshot = {
  generatedAt?: string;
  items?: FrontierItem[];
};

type AuditFailure = {
  scope: 'canonical' | 'expanded';
  message: string;
};

function assertSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('FRONTIER snapshot must be an object');
  const snapshot = value as Snapshot;
  if (!Array.isArray(snapshot.items)) throw new Error('FRONTIER snapshot must contain an items array');
  return snapshot;
}

function validDate(value: string | undefined): Date {
  if (!value) return new Date('2026-01-01T00:00:00.000Z');
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date('2026-01-01T00:00:00.000Z');
}

function policyInterrupt(item: FrontierItem): boolean {
  return item.lane === 'must_know'
    || item.importance >= 0.82
    || item.sourceKind === 'sports_state'
    || Boolean(item.sportsState);
}

function validateSelection(
  scope: AuditFailure['scope'],
  ranked: FrontierItem[],
  selected: FrontierItem[],
  limit: number,
): AuditFailure[] {
  const failures: AuditFailure[] = [];
  const ids = selected.map((item) => item.id);
  if (new Set(ids).size !== ids.length) failures.push({ scope, message: 'selected slate contains duplicate IDs' });
  if (selected.length > limit) failures.push({ scope, message: `selected ${selected.length} cards for a ${limit}-card limit` });

  const rankById = new Map(ranked.map((item, index) => [item.id, index]));
  const rerankWindow = frontierRerankWindowSize(limit, ranked.length);
  for (const item of selected) {
    const rank = rankById.get(item.id);
    if (rank === undefined) {
      failures.push({ scope, message: `selected item ${item.id} does not exist in ranked input` });
      continue;
    }
    if (rank >= rerankWindow && !policyInterrupt(item)) {
      failures.push({
        scope,
        message: `ordinary item ${item.id} at rank ${rank + 1} escaped rerank window ${rerankWindow}`,
      });
    }
  }
  return failures;
}

function qualifiedRealmSupply(ranked: FrontierItem[], limit: number, realm: 'learn' | 'play'): boolean {
  const window = ranked.slice(0, frontierRerankWindowSize(limit, ranked.length));
  return window.some((item) => FRONTIER_LANE_MAP[item.lane].realm === realm);
}

async function main() {
  const inputPath = path.resolve(process.argv[2] ?? 'content/frontier/latest.json');
  const outputPath = path.resolve(
    process.env.FRONTIER_SLATE_AUDIT_OUTPUT ?? 'artifacts/frontier-slate/counterfactual.json',
  );
  const snapshot = assertSnapshot(JSON.parse(await readFile(inputPath, 'utf8')) as unknown);
  const now = validDate(snapshot.generatedAt);
  const profile = createInitialProfile();
  const ranked = rankFrontierItems(snapshot.items ?? [], profile, {}, now);

  const canonical = selectDailyRun(ranked, {}, 14, now);
  const expanded = selectDailyRun(ranked, {}, 48, now);
  const canonicalAudit = evaluateSlateCounterfactual(ranked, canonical, 14);
  const expandedAudit = evaluateSlateCounterfactual(ranked, expanded, 48);

  const failures: AuditFailure[] = [
    ...validateSelection('canonical', ranked, canonical, 14),
    ...validateSelection('expanded', ranked, expanded, 48),
  ];

  const canonicalIds = canonical.map((item) => item.id);
  const expandedPrefix = expanded.slice(0, canonical.length).map((item) => item.id);
  if (JSON.stringify(canonicalIds) !== JSON.stringify(expandedPrefix)) {
    failures.push({ scope: 'expanded', message: 'expanded browse does not preserve the canonical opening exactly' });
  }

  if (canonical.length >= 4) {
    for (const realm of ['learn', 'play'] as const) {
      if (
        qualifiedRealmSupply(ranked, 14, realm)
        && !canonical.some((item) => FRONTIER_LANE_MAP[item.lane].realm === realm)
      ) {
        failures.push({ scope: 'canonical', message: `qualified ${realm} supply exists but canonical slate omitted the realm` });
      }
    }
  }

  const warnings: string[] = [];
  if (canonicalAudit.rankUtilityRetention < 0.65) {
    warnings.push(`canonical rank utility retention is ${(canonicalAudit.rankUtilityRetention * 100).toFixed(1)}%`);
  }
  if (canonical.length < Math.min(14, ranked.length)) {
    warnings.push(`canonical slate intentionally stopped at ${canonical.length}/14 under quality/concentration constraints`);
  }
  if (expanded.length < Math.min(48, ranked.length)) {
    warnings.push(`expanded slate intentionally stopped at ${expanded.length}/48 under quality/concentration constraints`);
  }

  const report = {
    generatedAt: snapshot.generatedAt ?? null,
    evaluatedAt: now.toISOString(),
    inputPath: path.relative(process.cwd(), inputPath),
    reservoirItems: snapshot.items?.length ?? 0,
    admittedRankedItems: ranked.length,
    failures,
    warnings,
    canonical: {
      selectedIds: canonicalIds,
      rawTopIds: ranked.slice(0, 14).map((item) => item.id),
      metrics: canonicalAudit,
    },
    expanded: {
      selectedIds: expanded.map((item) => item.id),
      rawTopIds: ranked.slice(0, 48).map((item) => item.id),
      metrics: expandedAudit,
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    `FRONTIER slate audit: ${ranked.length} ranked, canonical ${canonical.length}/14, `
    + `overlap ${canonicalAudit.overlapCount}/${canonical.length}, rank retention `
    + `${(canonicalAudit.rankUtilityRetention * 100).toFixed(1)}%, source HHI delta `
    + `${canonicalAudit.sourceConcentrationImprovement.toFixed(3)}, family HHI delta `
    + `${canonicalAudit.familyConcentrationImprovement.toFixed(3)}.`,
  );
  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL [${failure.scope}]: ${failure.message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
