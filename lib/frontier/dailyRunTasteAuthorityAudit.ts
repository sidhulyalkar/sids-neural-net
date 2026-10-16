import {
  frontierEditorialFamily,
  selectAdaptiveDailyAllocation,
  type FrontierEditorialFamily,
  type FrontierSlateTastePolicy,
} from './adaptiveSlate';
import type { FrontierItem } from './types';

export const FRONTIER_CANONICAL_DAILY_RUN_SIZE = 14;

export type FrontierDailyRunTasteFamilyDelta = {
  family: FrontierEditorialFamily;
  productionSelected: number;
  disabledSelected: number;
  delta: number;
};

export type FrontierDailyRunTasteAuthorityAudit = {
  schema: 'frontier-daily-run-taste-authority-v1';
  causalScope: 'whole-fixed-taste-daily-run-policy';
  candidates: number;
  limit: number;
  canonicalLimit: number;
  productionSelected: number;
  disabledSelected: number;
  productionCanonicalSelected: number;
  disabledCanonicalSelected: number;
  sharedSelected: number;
  protectedByTaste: number;
  displacedWithoutTaste: number;
  changedMembership: number;
  selectionCountDelta: number;
  overlapRate: number;
  familyDeltas: FrontierDailyRunTasteFamilyDelta[];
};

const FAMILIES: FrontierEditorialFamily[] = [
  'consequential',
  'research',
  'builder',
  'sports',
  'culture',
  'leisure',
];

function boundedLimit(limit: number): number {
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
}

function selectDailyRunWithTastePolicy(
  ranked: FrontierItem[],
  limit: number,
  tastePolicy: FrontierSlateTastePolicy,
): { selected: FrontierItem[]; canonicalSelected: number } {
  const bounded = boundedLimit(limit);
  if (bounded <= FRONTIER_CANONICAL_DAILY_RUN_SIZE) {
    const selected = selectAdaptiveDailyAllocation(ranked, bounded, { tastePolicy });
    return { selected, canonicalSelected: selected.length };
  }

  const canonical = selectAdaptiveDailyAllocation(ranked, FRONTIER_CANONICAL_DAILY_RUN_SIZE, { tastePolicy });
  const expanded = selectAdaptiveDailyAllocation(ranked, bounded, { tastePolicy });
  const canonicalIds = new Set(canonical.map((item) => item.id));
  return {
    selected: [
      ...canonical,
      ...expanded.filter((item) => !canonicalIds.has(item.id)),
    ].slice(0, bounded),
    canonicalSelected: canonical.length,
  };
}

function familyCounts(items: FrontierItem[]): Record<FrontierEditorialFamily, number> {
  const counts = Object.fromEntries(FAMILIES.map((family) => [family, 0])) as Record<FrontierEditorialFamily, number>;
  for (const item of items) counts[frontierEditorialFamily(item)] += 1;
  return counts;
}

/**
 * Measures the whole fixed-taste policy on the production Today daily-run shape.
 * For limits above 14, FRONTIER first preserves the canonical 14-card allocation
 * and then fills toward the expanded limit from a second allocation. This audit
 * applies the same orchestration twice, once with production taste and once with
 * every fixed-taste allocator effect disabled.
 *
 * This diagnostic mirrors a tiny orchestration wrapper rather than changing the
 * production selector API. Regression tests require its production path to stay
 * membership-identical to `selectDailyRun()` so drift fails loudly.
 */
export function auditFrontierDailyRunTasteAuthority(
  ranked: FrontierItem[],
  limit: number,
): FrontierDailyRunTasteAuthorityAudit {
  const bounded = boundedLimit(limit);
  const production = selectDailyRunWithTastePolicy(ranked, bounded, 'production');
  const disabled = selectDailyRunWithTastePolicy(ranked, bounded, 'disabled');
  const productionIds = new Set(production.selected.map((item) => item.id));
  const disabledIds = new Set(disabled.selected.map((item) => item.id));
  const sharedSelected = production.selected.reduce(
    (count, item) => count + Number(disabledIds.has(item.id)),
    0,
  );
  const protectedByTaste = production.selected.length - sharedSelected;
  const displacedWithoutTaste = disabled.selected.reduce(
    (count, item) => count + Number(!productionIds.has(item.id)),
    0,
  );
  const denominator = Math.max(production.selected.length, disabled.selected.length, 1);
  const productionFamilies = familyCounts(production.selected);
  const disabledFamilies = familyCounts(disabled.selected);

  return {
    schema: 'frontier-daily-run-taste-authority-v1',
    causalScope: 'whole-fixed-taste-daily-run-policy',
    candidates: ranked.length,
    limit: bounded,
    canonicalLimit: Math.min(bounded, FRONTIER_CANONICAL_DAILY_RUN_SIZE),
    productionSelected: production.selected.length,
    disabledSelected: disabled.selected.length,
    productionCanonicalSelected: production.canonicalSelected,
    disabledCanonicalSelected: disabled.canonicalSelected,
    sharedSelected,
    protectedByTaste,
    displacedWithoutTaste,
    changedMembership: protectedByTaste + displacedWithoutTaste,
    selectionCountDelta: production.selected.length - disabled.selected.length,
    overlapRate: sharedSelected / denominator,
    familyDeltas: FAMILIES.map((family) => ({
      family,
      productionSelected: productionFamilies[family],
      disabledSelected: disabledFamilies[family],
      delta: productionFamilies[family] - disabledFamilies[family],
    })),
  };
}

/** Test-only production-side projection used to lock the mirrored orchestration. */
export function frontierDailyRunProductionProjection(
  ranked: FrontierItem[],
  limit: number,
): FrontierItem[] {
  return selectDailyRunWithTastePolicy(ranked, limit, 'production').selected;
}
