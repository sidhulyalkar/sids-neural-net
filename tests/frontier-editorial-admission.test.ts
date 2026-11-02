import assert from 'node:assert/strict';
import test from 'node:test';
import frontierSnapshot from '../content/frontier/latest.json';
import {
  assessFrontierEditorialAdmission,
  isFrontierEditoriallyQualified,
} from '../lib/frontier/editorialAdmission';
import { cleanFrontierItem } from '../lib/frontier/editorialQuality';
import type { FrontierFeedResponse, FrontierItem } from '../lib/frontier/types';

const base: FrontierItem = {
  id: 'editorial-sample', title: 'A specific, interesting discovery',
  url: 'https://example.com/a-real-story', source: 'example.com',
  sourceLabel: 'Specialist source', sourceKind: 'rss', lane: 'neuro_frontier',
  summary: 'Researchers evaluated a reproducible decoder on recorded neural data, described its failure cases and baseline measures, and published a detailed discussion of the experimental limitations.',
  publishedAt: new Date().toISOString(), tags: ['neural decoding'],
  quality: 0.9, baseScore: 0.9, importance: 0.8, novelty: 0.6, momentum: 0.7,
};

test('promotional video description is cleaned before the substantive video is assessed', () => {
  const raw = {
    ...base, sourceKind: 'youtube' as const, title: 'The NBA tightened its rules…and it’s glorious',
    summary: 'Use our code for 10% off your next SeatGeek order: https://example.com/promo ' +
      'Sponsored by SeatGeek. Become a member: https://example.com/join ' +
      'This detailed film breakdown and scouting report explores the new NBA officiating emphasis ' +
      'on flopping, forceful offensive push-offs and two-handed screens using play-by-play video examples.',
  };
  assert.equal(isFrontierEditoriallyQualified(raw), true);
  const cleaned = cleanFrontierItem(raw);
  assert.match(cleaned.summary, /^This detailed film breakdown/);
  assert.doesNotMatch(cleaned.summary, /SeatGeek|example.com|Become a member/);
});

test('promotion-only descriptions cannot inherit a trusted creator quality score', () => {
  const item = {
    ...base, sourceKind: 'youtube' as const,
    summary: 'Sponsored by SeatGeek! Use our code for 10% off now. ' +
      'Become a member and subscribe to get bonus videos.',
    quality: 1, baseScore: 1,
  };
  assert.equal(isFrontierEditoriallyQualified(item), false);
});

test('link-only community candidates are excluded regardless of popularity', () => {
  for (const kind of ['hackernews', 'lobsters', 'reddit', 'social'] as const) {
    const item = { ...base, sourceKind: kind, summary: '', quality: 1, baseScore: 1 };
    assert.deepEqual(assessFrontierEditorialAdmission(item), {
      admitted: false, reason: 'missing-substance',
    });
  }
});

test('generic repository announcements are not evidence, even with large star counts', () => {
  const item = {
    ...base, sourceKind: 'github' as const, title: 'interesting/ai-project',
    summary: 'Recently active open-source project worth inspecting at the source.',
    metrics: [{ label: 'stars', value: '50,000' }],
  };
  assert.equal(assessFrontierEditorialAdmission(item).reason, 'generic-description');
  assert.equal(isFrontierEditoriallyQualified(item), false);
});

test('specific open-source release and scientific reports survive the evidence floor', () => {
  const code = { ...base, sourceKind: 'github' as const,
    title: 'napari · v0.10.0',
    summary: 'The release adds multi-dimensional image rendering improvements, fixes annotation interoperability and documents compatibility with the supported Qt runtime.',
  };
  assert.equal(isFrontierEditoriallyQualified(code), true);

  const paper = { ...base, sourceKind: 'openalex' as const,
    summary: 'The study tests whether decoder performance transfers between sessions and labs using held-out recordings. It compares three baselines, reports uncertainty and identifies artifacts as an open limitation.',
    metrics: [{ label: 'citations', value: '0' }],
  };
  assert.equal(isFrontierEditoriallyQualified(paper), true);
});

test('actual, sufficiently descriptive community analysis is not excluded by platform', () => {
  const item = { ...base, sourceKind: 'lobsters' as const,
    summary: 'The discussion compares Pratt parsing with precedence-climbing parsers, gives concrete examples of expression binding power, and links to a public implementation and benchmark.',
  };
  assert.equal(isFrontierEditoriallyQualified(item), true);
});

test('structured live sports utility is exempt from prose length requirements', () => {
  const item = { ...base, sourceKind: 'sports_state' as const,
    summary: 'Two live games',
    sportsState: { kind: 'scoreboard' as const, league: 'nba', leagueLabel: 'NBA', games: [] },
  };
  assert.equal(isFrontierEditoriallyQualified(item), true);
});

test('short game names survive when the underlying announcement is informative', () => {
  const item = { ...base, sourceKind: 'steam' as const, title: 'Silksong' };
  assert.equal(isFrontierEditoriallyQualified(item), true);
});

test('the checked-in snapshot has an informative, promotion-free admitted subset', () => {
  const raw = (frontierSnapshot as FrontierFeedResponse).items ?? [];
  const admitted = raw.map(cleanFrontierItem).filter(isFrontierEditoriallyQualified);
  assert.ok(admitted.length >= 20, 'quality floor must not destroy the real editorial inventory');
  assert.ok(admitted.length < raw.length, 'known empty/generic candidates must be excluded');
  for (const item of admitted) {
    assert.doesNotMatch(item.summary, /^(?:sponsored by|use our code|become a member)/i,
      item.title + ' leaked advertising into an admitted summary');
  }
});
