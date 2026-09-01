import assert from 'node:assert/strict';
import test from 'node:test';
import type { FrontierDailyRunTasteAuthorityAudit } from '../lib/frontier/dailyRunTasteAuthorityAudit';
import { buildFrontierPreferenceAuthorityReport } from '../lib/frontier/preferenceAuthorityReport';
import type { FrontierRankAuthorityAudit } from '../lib/frontier/rankAuthorityAudit';
import type { FrontierSlateTasteAuthorityAudit } from '../lib/frontier/slateTasteAuthorityAudit';

function rankAudit(overrides: Partial<Record<'fixed-taste' | 'direct-preference-additive' | 'pair-connection-additive' | 'implicit-behavior' | 'session-intent' | 'exploration', number>> = {}): FrontierRankAuthorityAudit {
  const ids = [
    'fixed-taste',
    'direct-preference-additive',
    'pair-connection-additive',
    'implicit-behavior',
    'session-intent',
    'exploration',
  ] as const;
  return {
    schema: 'frontier-rank-authority-v1',
    candidates: 42,
    topK: 14,
    components: ids.map((component) => {
      const protectedTopK = overrides[component] ?? 0;
      return {
        component,
        candidates: 42,
        topK: 14,
        sharedTopK: 14 - protectedTopK,
        protectedTopK,
        displacedTopK: protectedTopK,
        overlapRate: (14 - protectedTopK) / 14,
        meanAbsoluteRankMovement: protectedTopK * 0.4,
        maxAbsoluteRankMovement: protectedTopK * 2,
        meanAbsoluteScoreContribution: protectedTopK * 0.01,
        maxAbsoluteScoreContribution: protectedTopK * 0.04,
      };
    }),
  };
}

function slateAudit(changed = false): FrontierSlateTasteAuthorityAudit {
  return {
    schema: 'frontier-slate-taste-authority-v1',
    causalScope: 'whole-fixed-taste-slate-policy',
    candidates: 42,
    limit: 14,
    productionSelected: 14,
    disabledSelected: 14,
    sharedSelected: changed ? 12 : 14,
    protectedByTaste: changed ? 2 : 0,
    displacedWithoutTaste: changed ? 2 : 0,
    changedMembership: changed ? 4 : 0,
    selectionCountDelta: 0,
    overlapRate: changed ? 12 / 14 : 1,
    familyDeltas: [],
  };
}

function dailyRunAudit(changed = false): FrontierDailyRunTasteAuthorityAudit {
  return {
    schema: 'frontier-daily-run-taste-authority-v1',
    causalScope: 'whole-fixed-taste-daily-run-policy',
    candidates: 64,
    limit: 48,
    canonicalLimit: 14,
    productionSelected: 48,
    disabledSelected: 48,
    productionCanonicalSelected: 14,
    disabledCanonicalSelected: 14,
    sharedSelected: changed ? 45 : 48,
    protectedByTaste: changed ? 3 : 0,
    displacedWithoutTaste: changed ? 3 : 0,
    changedMembership: changed ? 6 : 0,
    selectionCountDelta: 0,
    overlapRate: changed ? 45 / 48 : 1,
    familyDeltas: [],
  };
}

test('report preserves separate causal scopes and exposes no synthetic overall score', () => {
  const report = buildFrontierPreferenceAuthorityReport({
    server: {
      eligible: 330,
      cap: 320,
      retained: 320,
      sharedWithBaseScore: 319,
      tasteProtected: 1,
      tasteDisplaced: 1,
      overlapRate: 319 / 320,
    },
    rank: rankAudit({ 'direct-preference-additive': 3 }),
    slate: slateAudit(false),
  });

  assert.equal(report.server.scope, 'server-cap-membership');
  assert.equal(report.rank.scope, 'browser-rank-additive-at-observed-gates');
  assert.equal(report.slate.scope, 'slate-whole-fixed-taste-policy');
  assert.equal(report.rank.strongestComponent?.component, 'direct-preference-additive');
  assert.equal(report.activeFixedTasteBoundaries, 1);
  assert.deepEqual(report.signals, []);
  assert.equal('overallScore' in report, false);
  assert.equal('combinedOverlap' in report, false);
});

test('composite daily-run audit preserves the same separate slate report boundary', () => {
  const report = buildFrontierPreferenceAuthorityReport({
    rank: rankAudit({ 'session-intent': 1 }),
    slate: dailyRunAudit(true),
  });

  assert.equal(report.slate.observed, true);
  assert.equal(report.slate.audit?.causalScope, 'whole-fixed-taste-daily-run-policy');
  assert.equal(report.slate.audit?.limit, 48);
  assert.equal(report.activeFixedTasteBoundaries, 1);
  assert.deepEqual(report.signals, []);
});

test('fixed taste spanning multiple boundaries is flagged as a review signal, not causal redundancy', () => {
  const report = buildFrontierPreferenceAuthorityReport({
    server: {
      eligible: 330,
      cap: 320,
      retained: 320,
      sharedWithBaseScore: 318,
      tasteProtected: 2,
      tasteDisplaced: 2,
      overlapRate: 318 / 320,
    },
    rank: rankAudit({ 'fixed-taste': 1, 'direct-preference-additive': 2 }),
    slate: dailyRunAudit(true),
  });

  assert.equal(report.activeFixedTasteBoundaries, 3);
  assert.deepEqual(report.signals, ['fixed-taste-active-at-multiple-boundaries']);
  assert.equal(report.rank.fixedTaste?.protectedTopK, 1);
});

test('zero-effect rank audit remains observed without inventing a strongest component', () => {
  const report = buildFrontierPreferenceAuthorityReport({ rank: rankAudit() });
  assert.equal(report.rank.observed, true);
  assert.equal(report.rank.strongestComponent, null);
  assert.equal(report.rank.fixedTaste?.protectedTopK, 0);
});

test('unobserved boundaries remain explicitly unobserved instead of becoming zero-effect evidence', () => {
  const report = buildFrontierPreferenceAuthorityReport({ rank: rankAudit() });
  assert.equal(report.server.observed, false);
  assert.equal(report.server.audit, null);
  assert.equal(report.rank.observed, true);
  assert.equal(report.slate.observed, false);
  assert.equal(report.activeFixedTasteBoundaries, 0);
});

test('report output remains aggregate and contains no item identity surfaces', () => {
  const report = buildFrontierPreferenceAuthorityReport({
    rank: rankAudit({ 'pair-connection-additive': 2 }),
    slate: dailyRunAudit(true),
  });
  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ['itemid', 'title', 'summary', 'url', 'query', 'profile']) {
    assert.equal(serialized.includes(forbidden), false, `authority report leaked ${forbidden}`);
  }
});
