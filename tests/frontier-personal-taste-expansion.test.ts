import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRONTIER_DISCOVERY_SEEDS,
  FRONTIER_PERSONAL_TASTE_TOPICS,
  FRONTIER_TASTE_DISCOVERY_QUERIES,
  matchesPersonalTasteTopic,
  personalTasteRankingPrior,
} from '../lib/frontier/personalTaste';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, title: string, summary = ''): FrontierItem {
  return {
    id,
    title,
    summary,
    url: `https://${id}.example.com/story`,
    source: `${id}.example.com`,
    sourceLabel: 'Example',
    sourceKind: 'local',
    publishedAt: '2026-08-28T12:00:00.000Z',
    lane: 'sports',
    tags: [],
    baseScore: 0.68,
    importance: 0.62,
    novelty: 0.64,
    quality: 0.72,
    momentum: 0.55,
  };
}

test('disc golf, skate grind progression, and freestyle scootering are first-class taste orbits', () => {
  const discGolf = item('disc-golf', 'PDGA disc golf putting and driving form breakdown');
  const skate = item('skate', 'Street skating 50-50 grind and boardslide progression on a ledge');
  const scooter = item('scooter', 'Freestyle scooter rail tricks and park progression tutorial');

  assert.equal(matchesPersonalTasteTopic(discGolf, ['disc-golf']), true);
  assert.equal(matchesPersonalTasteTopic(skate, ['skate-progression']), true);
  assert.equal(matchesPersonalTasteTopic(scooter, ['freestyle-scooter']), true);
  assert.ok(personalTasteRankingPrior(discGolf) >= 0.1);
  assert.ok(personalTasteRankingPrior(skate) >= 0.1);
  assert.ok(personalTasteRankingPrior(scooter) >= 0.09);
});

test('ambiguous grind, rail, ledge, driver, and scooter-adjacent prose cannot manufacture hobby intent', () => {
  const dailyGrind = item('daily-grind', 'How founders survive the daily grind without burning out');
  const railway = item('rail-infrastructure', 'Rail infrastructure modernization reaches a major project milestone');
  const ledge = item('architecture', 'A stone ledge detail changes facade drainage performance');
  const driver = item('kernel-driver', 'Linux driver update improves GPU scheduling');
  const mobility = item('mobility', 'Shared electric scooter policy changes downtown transportation rules');

  for (const candidate of [dailyGrind, railway, ledge, driver, mobility]) {
    assert.equal(matchesPersonalTasteTopic(candidate, ['disc-golf', 'skate-progression', 'freestyle-scooter']), false);
  }

  const dangerousAliases = new Set(['grind', 'rail', 'ledge', 'driver', 'scooter']);
  const aliases = FRONTIER_PERSONAL_TASTE_TOPICS.flatMap((topic) => topic.aliases.map((alias) => alias.toLowerCase()));
  assert.equal(aliases.some((alias) => dangerousAliases.has(alias)), false);
});

test('new interests join the bounded rotating acquisition mesh without becoming fixed daily quotas', () => {
  assert.ok(FRONTIER_DISCOVERY_SEEDS.includes('disc golf'));
  assert.ok(FRONTIER_DISCOVERY_SEEDS.includes('skateboarding tricks'));
  assert.ok(FRONTIER_DISCOVERY_SEEDS.includes('freestyle scooter'));

  const queries = FRONTIER_TASTE_DISCOVERY_QUERIES.map((entry) => entry.query.toLowerCase());
  assert.ok(queries.some((query) => query.includes('disc golf')));
  assert.ok(queries.some((query) => query.includes('skateboarding')));
  assert.ok(queries.some((query) => query.includes('freestyle scooter')));

  // Acquisition remains rotation-based in personalTasteSources. The expanded
  // vocabulary must not move these hobbies into the four always-pinned queries.
  const pinned = FRONTIER_TASTE_DISCOVERY_QUERIES.slice(0, 4).map((entry) => entry.query.toLowerCase()).join(' ');
  assert.equal(pinned.includes('disc golf'), false);
  assert.equal(pinned.includes('skateboarding'), false);
  assert.equal(pinned.includes('freestyle scooter'), false);
});
