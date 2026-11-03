import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialProfile } from '../lib/frontier/config';
import {
  FRONTIER_EDITORIAL_PREFERENCES,
  frontierEditorialTasteSignals,
  frontierQualifiedExploration,
  frontierSameStoryHeadline,
} from '../lib/frontier/editorialTaste';
import {
  buildFrontierEditorialReviewRows,
  evaluateFrontierEditorialReview,
  frontierEditorialReviewFlags,
  sampleFrontierEditorialReview,
} from '../lib/frontier/editorialReview';
import { personalizedScore, frontierPersonalizedScoreBreakdown, sumFrontierPersonalizedScoreComponents } from '../lib/frontier/scoring';
import { selectAdaptiveDailyAllocation } from '../lib/frontier/adaptiveSlate';
import type { FrontierItem } from '../lib/frontier/types';

const when = new Date('2026-11-02T12:00:00Z');
function item(id: string, options: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id, title: 'A detailed original research analysis',
    summary: 'The authors evaluated several neural measurement methods using an experimental comparison. They document calibration uncertainty and explain the underlying mechanism and its limitations.',
    source: id + '.org', sourceLabel: id,
    url: 'https://' + id + '.org/article',
    sourceKind: 'rss', lane: 'broad_science',
    publishedAt: when.toISOString(), tags: [],
    importance: 0.65, novelty: 0.72, quality: 0.83, momentum: 0.65, baseScore: 0.68,
    ...options,
  };
}

test('owner editorial calibration exactly records the explicit six dislikes and 25% exploration target', () => {
  const prefs = FRONTIER_EDITORIAL_PREFERENCES;
  assert.equal(prefs.discoveryPriority, 'balanced');
  assert.equal(prefs.depth, 'conceptual');
  assert.equal(prefs.practicalRelevance, 'balanced');
  assert.equal(prefs.explorationTargetShare, 0.25);
  assert.deepEqual([...prefs.avoid], [
    'repetitive-stories', 'unsupported-hype', 'celebrity-gossip',
    'shallow-summaries', 'unverified-speculation', 'generic-ai-product-news',
  ]);
});

test('conceptual explanations outrank equally credible generic updates without overwriting topic learning', () => {
  const story = item('concept', {
    title: 'Understanding why neural population dynamics change with task demands',
  });
  const generic = item('plain', {
    title: 'New technical update available today',
    summary: 'The report describes a technical update with measurements, experimental comparisons, calibration uncertainty and links to supporting data from the authors.',
  });
  const a = frontierEditorialTasteSignals(story);
  const b = frontierEditorialTasteSignals(generic);
  assert.equal(a.conceptual, true);
  assert.equal(b.conceptual, false);
  assert(a.adjustment > b.adjustment);
  assert(personalizedScore(story, createInitialProfile(), undefined, when) >
    personalizedScore(generic, createInitialProfile(), undefined, when));
});

test('sensational and rumor-driven headlines are demoted, not asserted false', () => {
  const hype = item('hype', {
    title: 'Mind-blowing revolutionary AI chatbot app will change everything',
    summary: 'The incredible new AI assistant is the ultimate product for everyone. Start today and discover the future of artificial intelligence.',
  });
  const speculation = item('rumor', {
    title: 'Rumors: Celebrity dating drama could be about to break',
    summary: 'Several unconfirmed tabloid claims have circulated online and are attracting public attention, with speculation about a relationship involving famous entertainers.',
  });
  const a = frontierEditorialTasteSignals(hype);
  const b = frontierEditorialTasteSignals(speculation);
  assert(a.risks.includes('hype-without-specifics'));
  assert(a.risks.includes('generic-ai-product-announcement'));
  assert(b.risks.includes('speculative-wording'));
  assert(b.risks.includes('celebrity-gossip'));
  assert(a.adjustment < 0 && b.adjustment < 0);
  assert(a.adjustment >= -0.26 && b.adjustment >= -0.26);
  // Strong source reporting with a speculative term is not inherently unsupported.
  const substantiated = item('verified', {
    title: 'Reportedly a new technique was tested',
    summary: 'The authors published measurements, a reproducible dataset, experimental comparisons, reported limitations and a detailed benchmark for the new technique.',
  });
  assert(!frontierEditorialTasteSignals(substantiated).risks.includes('speculative-wording'));
});

test('qualified exploration cannot lift unsupported, generic, or weakly sourced novelties', () => {
  const qualified = item('unexpected', { novelty: 0.82, quality: 0.85 });
  assert(frontierQualifiedExploration(qualified, 0));
  assert(!frontierQualifiedExploration(qualified, 0.18), 'Familiar topics are not outside interests');
  assert(!frontierQualifiedExploration({ ...qualified, quality: 0.4 }, 0));
  assert(!frontierQualifiedExploration({ ...qualified, summary: 'AI!!' }, 0));
  assert(!frontierQualifiedExploration({ ...qualified, novelty: 0.4 }, 0));
  assert(!frontierQualifiedExploration(item('speculative', {
    novelty: 0.9, title: 'Rumors: new discovery is coming',
    summary: 'This is speculation about a new breakthrough that might be announced soon. No official data is available, but people keep discussing its exciting potential.',
  }), 0));
});

test('near-duplicate independent URLs share one slot, without confusing different studies', () => {
  const a = item('alpha', { title: 'Researchers reveal a new method for neural population decoding' });
  const b = item('beta', { title: 'Researchers reveal new method for neural population decoding' });
  const different = item('gamma', { title: 'Researchers discover robust cortical state transitions in mice' });
  assert(frontierSameStoryHeadline(a, b));
  assert(!frontierSameStoryHeadline(a, different));
  const selected = selectAdaptiveDailyAllocation([
    a, b, different,
    item('delta', { title: 'An unrelated computational geometry result' }),
    item('epsilon', { title: 'An ocean wildlife conservation report' }),
  ], 5);
  assert(!(selected.some((entry) => entry.id === a.id) && selected.some((entry) => entry.id === b.id)));
  assert.equal(new Set(selected.map((entry) => entry.id)).size, selected.length);
});

test('ranking breakdown exposes auditable editorial prior and preserves exact component sum', () => {
  const obj = item('audit');
  const breakdown = frontierPersonalizedScoreBreakdown(obj, createInitialProfile(), undefined, when);
  assert.equal(breakdown.components.editorialTaste, frontierEditorialTasteSignals(obj).adjustment);
  assert.equal(sumFrontierPersonalizedScoreComponents(breakdown.components), breakdown.rawScore);
  assert.equal(
    sumFrontierPersonalizedScoreComponents(breakdown.components, new Set(['editorialTaste'])),
    breakdown.rawScore - breakdown.components.editorialTaste,
  );
});

test('review kit records editorial risks and exploration exposure but never invents human labels', () => {
  const qualified = item('outside-domain', { title: 'How unusual marine organisms solve complex navigation' });
  const risky = item('risk', { title: 'Revolutionary AI chatbot app will change everything', summary:
    'The brand has announced its AI assistant is the ultimate app, available to everyone immediately, with amazing possibilities that will transform daily life.' });
  const rows = buildFrontierEditorialReviewRows(
    [qualified, risky], [risky.id, qualified.id], [qualified.id, risky.id]);
  assert(rows[0].qualifiedExploration);
  assert(rows[1].flags.includes('review-hype-without-specifics'));
  const report = evaluateFrontierEditorialReview(sampleFrontierEditorialReview(rows, 2), []);
  assert.equal(report.calibration.preferenceVersion, FRONTIER_EDITORIAL_PREFERENCES.version);
  assert.equal(report.calibration.explorationTargetShare, 0.25);
  assert.equal(report.metrics.conceptualInsightAt14.rate, null);
  assert.equal(report.metrics.avoidsNoiseAt14.rate, null);
  assert.equal(report.metrics.worthwhileExplorationAt14.rate, null);
  assert.equal(report.tasteReviewComplete, false);
  assert.equal(report.evidence, 'awaiting-human-labels');
  assert(frontierEditorialReviewFlags(risky).includes('review-generic-ai-product-announcement'));
});
