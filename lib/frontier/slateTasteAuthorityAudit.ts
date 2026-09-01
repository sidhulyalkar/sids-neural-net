import {
  frontierEditorialFamily,
  selectAdaptiveDailyAllocation,
  type FrontierEditorialFamily,
} from './adaptiveSlate';
import type { FrontierItem } from './types';

export type FrontierSlateTasteFamilyDelta = {
  family: FrontierEditorialFamily;
  productionSelected: number;
  disabledSelected: number;
  delta: number;
};

export type FrontierSlateTasteAuthorityAudit = {
  schema: 'frontier-slate-taste-authority-v1';
  causalScope: 'whole-fixed-taste-slate-policy';
  candidates: number;
  limit: number;
  productionSelected: number;
  disabledSelected: number;
  sharedSelected: number;
  protectedByTaste: number;
  displacedWithoutTaste: number;
  changedMembership: number;
  selectionCountDelta: number;
  overlapRate: number;
  familyDeltas: FrontierSlateTasteFamilyDelta[];
};

const FAMILIES: FrontierEditorialFamily[] = [
  'consequential',
  'research',
  'builder',
  'sports',
  'culture',
  'leisure',
];

function familyCounts(items: FrontierItem[]): Record<FrontierEditorialFamily, number> {
  const counts = Object.fromEntries(FAMILIES.map((family) => [family, 0])) as Record<FrontierEditorialFamily, number>;
  for (const item of items) counts[frontierEditorialFamily(item)] += 1;
  return counts;
}

/**
 * Compare the production allocator with the same allocator after removing the
 * complete fixed-taste slate policy. The counterfactual disables the taste
 * utility term, generic-leisure penalty, generic-AI penalty and taste-keyed
 * generic-AI eligibility brake together. All non-taste composition rules remain
 * on, including learned rank order, the bounded rerank window, source/lane/family
 * caps, realm coverage, consequential interrupts and bounded sports utility.
 *
 * Item identities are used transiently for set equality and never returned.
 */
export function auditFrontierSlateTasteAuthority(
  ranked: FrontierItem[],
  limit: number,
): FrontierSlateTasteAuthorityAudit {
  const boundedLimit = Math.max(0, Math.floor(limit));
  const production = selectAdaptiveDailyAllocation(ranked, boundedLimit);
  const disabled = selectAdaptiveDailyAllocation(ranked, boundedLimit, { tastePolicy: 'disabled' });
  const productionIds = new Set(production.map((item) => item.id));
  const disabledIds = new Set(disabled.map((item) => item.id));
  const sharedSelected = production.reduce((count, item) => count + Number(disabledIds.has(item.id)), 0);
  const protectedByTaste = production.length - sharedSelected;
  const displacedWithoutTaste = disabled.reduce((count, item) => count + Number(!productionIds.has(item.id)), 0);
  const denominator = Math.max(production.length, disabled.length, 1);
  const productionFamilies = familyCounts(production);
  const disabledFamilies = familyCounts(disabled);

  return {
    schema: 'frontier-slate-taste-authority-v1',
    causalScope: 'whole-fixed-taste-slate-policy',
    candidates: ranked.length,
    limit: boundedLimit,
    productionSelected: production.length,
    disabledSelected: disabled.length,
    sharedSelected,
    protectedByTaste,
    displacedWithoutTaste,
    changedMembership: protectedByTaste + displacedWithoutTaste,
    selectionCountDelta: production.length - disabled.length,
    overlapRate: sharedSelected / denominator,
    familyDeltas: FAMILIES.map((family) => ({
      family,
      productionSelected: productionFamilies[family],
      disabledSelected: disabledFamilies[family],
      delta: productionFamilies[family] - disabledFamilies[family],
    })),
  };
}
