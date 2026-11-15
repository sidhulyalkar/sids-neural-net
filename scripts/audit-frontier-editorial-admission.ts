import frontierSnapshot from '../content/frontier/latest.json';
import { assessFrontierEditorialAdmission } from '../lib/frontier/editorialAdmission';
import { cleanFrontierItem } from '../lib/frontier/editorialQuality';
import type { FrontierFeedResponse, FrontierItem } from '../lib/frontier/types';

const items = (frontierSnapshot as FrontierFeedResponse).items ?? [];
const byReason = new Map<string, number>();
const bySource = new Map<string, { input: number; admitted: number }>();
const excluded: Array<{ title: string; source: string; reason: string }> = [];
const qualified: FrontierItem[] = [];

for (const original of items) {
  const item = cleanFrontierItem(original);
  const admission = assessFrontierEditorialAdmission(item);
  byReason.set(admission.reason, (byReason.get(admission.reason) ?? 0) + 1);
  const bucket = bySource.get(item.sourceKind) ?? { input: 0, admitted: 0 };
  bucket.input += 1;
  if (admission.admitted) {
    bucket.admitted += 1;
    qualified.push(item);
  } else {
    excluded.push({ title: item.title, source: item.sourceKind, reason: admission.reason });
  }
  bySource.set(item.sourceKind, bucket);
}

console.log(JSON.stringify({
  inventory: items.length,
  qualified: qualified.length,
  excluded: excluded.length,
  admissionRate: items.length ? Number((qualified.length / items.length).toFixed(3)) : 0,
  byReason: Object.fromEntries([...byReason].sort()),
  bySource: Object.fromEntries([...bySource].sort()),
  topQualified: [...qualified].sort((a, b) => b.baseScore - a.baseScore).slice(0, 14)
    .map((item) => ({ title: item.title, source: item.sourceKind, lane: item.lane, score: Number(item.baseScore.toFixed(3)) })),
  firstExcluded: excluded.slice(0, 30),
}, null, 2));
