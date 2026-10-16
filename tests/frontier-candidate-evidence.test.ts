import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessFrontierCandidateEvidence,
  candidateEvidenceShadowAdjustment,
} from '../lib/frontier/candidateEvidence';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    url: `https://example.com/${id}`,
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'openalex',
    publishedAt: '2026-09-01T12:00:00.000Z',
    lane: 'ml_data',
    tags: [],
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.35,
    ...overrides,
  };
}

function allyshipPaper(): FrontierItem {
  return item('allyship-affect', {
    title: 'Allyship and Affect: Qualitative Investigations into Social Transformation',
    summary: 'A dissertation about feminist philosophy, political interests, social privilege, and transformation.',
    lane: 'broad_science',
    tags: ['space', 'feminist epistemology and gender studies', 'paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });
}

test('OpenAlex lane collision demotes rather than deletes when acquisition intent is unobserved', () => {
  const weak = allyshipPaper();
  const evidence = assessFrontierCandidateEvidence(weak);

  assert.equal(evidence.disposition, 'demote');
  assert.deepEqual(evidence.distinctLaneHits, ['space']);
  assert.deepEqual(evidence.discoveryQueryTerms, []);
  assert.ok(evidence.score < 0.6);
  assert.equal(candidateEvidenceShadowAdjustment(weak), -0.14);
  assert.match(evidence.reasons.join(' '), /cannot justify deletion/i);
});

test('OpenAlex may suppress a weak lane collision only when the actual discovery query is observed and unsupported', () => {
  const weak = allyshipPaper();
  const context = { discoveryQuery: 'machine learning data analysis causal inference' };
  const evidence = assessFrontierCandidateEvidence(weak, context);

  assert.equal(evidence.disposition, 'suppress');
  assert.ok(evidence.discoveryQueryTerms.includes('machine'));
  assert.deepEqual(evidence.discoveryQueryHits, []);
  assert.equal(candidateEvidenceShadowAdjustment(weak, context), -1);
});

test('OpenAlex generic statistics collision stays a demotion without query provenance', () => {
  const weak = item('desmos', {
    title: 'Shifting to Using Desmos or GeoGebra Graphing Calculators in High School Mathematics Classrooms',
    summary: 'A study of calculator adoption and mathematics teaching in high school classrooms.',
    lane: 'ml_data',
    tags: ['statistics', 'mathematics education and teaching techniques', 'paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });

  const evidence = assessFrontierCandidateEvidence(weak);
  assert.equal(evidence.disposition, 'demote');
  assert.deepEqual(evidence.distinctLaneHits, ['statistics']);
});

test('query evidence prevents hard suppression of a football paper even when its assigned lane is weak', () => {
  const paper = item('football-analysis', {
    title: 'Applied performance analysts in association football: A scoping review of roles, challenges, and opportunities',
    summary: 'This scoping review maps the work of applied performance analysts in association football.',
    lane: 'sports',
    tags: ['highlight', 'sport psychology and performance', 'paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });

  const evidence = assessFrontierCandidateEvidence(paper, {
    discoveryQuery: 'football soccer analytics tracking expected goals',
  });

  assert.equal(evidence.disposition, 'demote');
  assert.ok(evidence.discoveryQueryHits.includes('football'));
  assert.match(evidence.reasons.join(' '), /actual discovery query/i);
});

test('lane mismatch alone cannot hard-suppress valid exercise physiology', () => {
  const paper = item('cold-water', {
    title: 'The cold-water immersion recovery-adaptation paradox',
    summary: 'A review of acute parasympathetic and analgesic benefits and chronic hypertrophy attenuation in exercise recovery.',
    lane: 'builder_signal',
    tags: ['framework', 'exercise and physiological responses', 'paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });

  const evidence = assessFrontierCandidateEvidence(paper);
  assert.equal(evidence.disposition, 'demote');
  assert.deepEqual(evidence.distinctLaneHits, ['framework']);
});

test('known acquisition mismatch can suppress valid scholarship that does not answer that query', () => {
  const paper = item('cold-water-query-mismatch', {
    title: 'The cold-water immersion recovery-adaptation paradox',
    summary: 'A review of acute parasympathetic and analgesic benefits and chronic hypertrophy attenuation in exercise recovery.',
    lane: 'builder_signal',
    tags: ['framework', 'exercise and physiological responses', 'paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });

  const evidence = assessFrontierCandidateEvidence(paper, {
    discoveryQuery: 'artificial intelligence agents interpretability reasoning',
  });
  assert.equal(evidence.disposition, 'suppress');
  assert.deepEqual(evidence.discoveryQueryHits, []);
});

test('OpenAlex retains fresh zero-citation work with coherent independent semantic evidence', () => {
  const strong = item('soccer-gnn', {
    title: 'Predicting Soccer Match Outcomes with Heterogeneous Graph Neural Networks',
    summary: 'Predicting soccer outcomes requires machine learning models, large datasets, team statistics, and graph representations.',
    lane: 'ml_data',
    tags: ['machine learning', 'statistics', 'dataset', 'sports analytics and performance', 'paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });

  const evidence = assessFrontierCandidateEvidence(strong);
  assert.equal(evidence.disposition, 'retain');
  assert.ok(evidence.distinctLaneHits.length >= 2);
  assert.match(evidence.reasons.join(' '), /zero citations are neutral/i);
});

test('OpenAlex retains a niche neuroscience paper from one highly specific textual signal', () => {
  const strong = item('neural-decoding', {
    title: 'Neural Decoding of Motor Intent from Intracortical Population Activity',
    summary: 'A new decoder is evaluated on held-out motor behavior.',
    lane: 'neuro_frontier',
    tags: ['paper', 'research'],
    metrics: [{ label: 'citations', value: '0' }],
  });

  const evidence = assessFrontierCandidateEvidence(strong);
  assert.equal(evidence.disposition, 'retain');
  assert.ok(evidence.specificLaneHits.includes('neural decoding'));
});

test('GitHub demotes zero-evidence tutorial churn without suppressing it', () => {
  const weak = item('tweet-sentiment', {
    title: 'LukeSantossz/tweet-sentiment-analysis',
    summary: 'A Natural Language Processing project focused on Exploratory Data Analysis and sentiment classification of Twitter data using Machine Learning.',
    url: 'https://github.com/LukeSantossz/tweet-sentiment-analysis',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    lane: 'ml_data',
    tags: ['machine learning', 'data analysis', 'nlp', 'sentiment-analysis', 'python', 'ml data', 'code'],
    metrics: [
      { label: 'stars', value: '0' },
      { label: 'forks', value: '0' },
      { label: 'language', value: 'Python' },
    ],
  });

  const evidence = assessFrontierCandidateEvidence(weak);
  assert.equal(evidence.disposition, 'demote');
  assert.equal(evidence.stars, 0);
  assert.equal(evidence.forks, 0);
  assert.equal(candidateEvidenceShadowAdjustment(weak), -0.14);
});

test('GitHub protects a zero-star niche mechanistic-interpretability tool', () => {
  const strong = item('interp', {
    title: 'azrabano23/interp',
    summary: 'Ask your coding agent why a language model made a prediction with mechanistic interpretability, activation patching, SAE features, and steering.',
    url: 'https://github.com/azrabano23/interp',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    lane: 'ai_frontier',
    tags: ['agent', 'mechanistic interpretability', 'language model', 'llm', 'transformer', 'activation-patching', 'code'],
    metrics: [
      { label: 'stars', value: '0' },
      { label: 'forks', value: '0' },
    ],
  });

  const evidence = assessFrontierCandidateEvidence(strong);
  assert.equal(evidence.disposition, 'retain');
  assert.ok(evidence.specificLaneHits.includes('mechanistic interpretability'));
  assert.equal(candidateEvidenceShadowAdjustment(strong), 0);
});

test('GitHub protects zero-star neural-decoding projects with specific domain evidence', () => {
  const strong = item('genelens', {
    title: 'oykunefesoz/GeneLens',
    summary: 'A computational biology and neuroscience project for genomic analysis, mutation modeling, and computational neural decoding.',
    url: 'https://github.com/oykunefesoz/GeneLens',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    lane: 'neuro_frontier',
    tags: ['neuroscience', 'neural decoding', 'python', 'neuro frontier', 'code'],
    metrics: [
      { label: 'stars', value: '0' },
      { label: 'forks', value: '0' },
    ],
  });

  assert.equal(assessFrontierCandidateEvidence(strong).disposition, 'retain');
});

test('GitHub social corroboration can retain a semantically ordinary but established repository', () => {
  const established = item('popular-tool', {
    title: 'example/popular-data-tool',
    summary: 'A practical machine learning and data analysis utility for working with tabular datasets.',
    url: 'https://github.com/example/popular-data-tool',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    lane: 'ml_data',
    tags: ['machine learning', 'data analysis', 'dataset', 'python', 'code'],
    metrics: [
      { label: 'stars', value: '1,250' },
      { label: 'forks', value: '90' },
    ],
  });

  const evidence = assessFrontierCandidateEvidence(established);
  assert.equal(evidence.disposition, 'retain');
  assert.equal(evidence.stars, 1250);
  assert.equal(evidence.forks, 90);
});

test('candidate-evidence shadow v1 leaves unrelated source kinds untouched', () => {
  const arxiv = item('arxiv', {
    sourceKind: 'arxiv',
    source: 'arxiv.org',
    sourceLabel: 'arXiv',
    url: 'https://arxiv.org/abs/2608.12345',
    lane: 'ai_frontier',
  });

  const evidence = assessFrontierCandidateEvidence(arxiv);
  assert.equal(evidence.disposition, 'retain');
  assert.equal(evidence.score, 1);
  assert.equal(candidateEvidenceShadowAdjustment(arxiv), 0);
});
