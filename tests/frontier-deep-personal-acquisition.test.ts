import assert from 'node:assert/strict';
import test from 'node:test';
import { sportsAnalyticsQueries } from '../lib/frontier/sportsAnalyticsSources';

test('request-time sports analytics keeps one rotating favorite-team search', () => {
  const queries = sportsAnalyticsQueries(false);
  const ids = queries.map((query) => query.id);
  assert.equal(ids.includes('nfl-analytics'), true);
  assert.equal(ids.includes('fantasy-football'), true);
  assert.equal(ids.includes('nfl-role-news'), true);
  assert.equal(ids.includes('sports-data-viz'), true);
  assert.equal(Number(ids.includes('nba-analytics')) + Number(ids.includes('soccer-analytics')), 1);
});

test('deep archive acquisition includes every pinned and favorite-team sports search', () => {
  const ids = new Set(sportsAnalyticsQueries(true).map((query) => query.id));
  for (const id of [
    'nfl-analytics',
    'fantasy-football',
    'nfl-role-news',
    'sports-data-viz',
    'nba-analytics',
    'soccer-analytics',
  ]) assert.equal(ids.has(id), true, `deep sports archive omitted ${id}`);
});
