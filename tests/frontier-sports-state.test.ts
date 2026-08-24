import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDailyRun } from '../lib/frontier/scoring';
import { isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';
import {
  FRONTIER_SPORTS_LEAGUES,
  parseSportsHighlights,
  parseSportsScoreboard,
  parseSportsStandings,
} from '../lib/frontier/sportsStateSources';
import type { FrontierItem } from '../lib/frontier/types';

const nfl = FRONTIER_SPORTS_LEAGUES.find((league) => league.id === 'nfl');
assert.ok(nfl);
const NOW = Date.parse('2026-08-24T05:00:00.000Z');

const scoreboardFixture = {
  events: [
    {
      id: 'other-game',
      date: '2026-08-24T01:00:00.000Z',
      competitions: [{
        id: 'other-comp',
        date: '2026-08-24T01:00:00.000Z',
        status: { type: { state: 'post', completed: true, shortDetail: 'Final' } },
        competitors: [
          { id: 'ten', homeAway: 'home' as const, winner: true, score: '27', team: { id: 'ten', abbreviation: 'TEN', displayName: 'Tennessee Titans', shortDisplayName: 'Titans' } },
          { id: 'sea', homeAway: 'away' as const, winner: false, score: '20', team: { id: 'sea', abbreviation: 'SEA', displayName: 'Seattle Seahawks', shortDisplayName: 'Seahawks' } },
        ],
        highlights: [{
          id: 9001,
          headline: 'A source-hosted NFL highlight',
          description: 'The decisive play from the game.',
          thumbnail: 'https://a.espncdn.com/media/motion/2026/example.jpg',
          duration: 48,
          originalPublishDate: '2026-08-24T02:00:00.000Z',
          timeRestrictions: { expirationDate: '2026-09-01T00:00:00.000Z' },
          links: {
            source: {
              href: 'https://espnmedia-cdn.akamaized.net/example-sd.mp4',
              HD: { href: 'https://espnmedia-cdn.akamaized.net/example-hd.mp4' },
            },
            web: { self: { href: 'https://www.espn.com/video/clip/_/id/9001' } },
          },
        }],
      }],
    },
    {
      id: 'patriots-game',
      date: '2026-08-25T00:00:00.000Z',
      competitions: [{
        id: 'patriots-comp',
        date: '2026-08-25T00:00:00.000Z',
        status: { type: { state: 'pre', completed: false, shortDetail: 'Mon, 5:00 PM' } },
        competitors: [
          {
            id: 'ne',
            homeAway: 'home' as const,
            score: '0',
            team: { id: 'ne', abbreviation: 'NE', displayName: 'New England Patriots', shortDisplayName: 'Patriots' },
            records: [{ name: 'overall', summary: '1-1' }],
          },
          {
            id: 'nyg',
            homeAway: 'away' as const,
            score: '0',
            team: { id: 'nyg', abbreviation: 'NYG', displayName: 'New York Giants', shortDisplayName: 'Giants' },
            records: [{ name: 'overall', summary: '0-2' }],
          },
        ],
        highlights: [{
          id: 9002,
          headline: 'Patriots film-room clip',
          description: 'A Patriots preseason concept worth replaying.',
          thumbnail: 'https://a.espncdn.com/media/motion/2026/patriots.jpg',
          duration: 62,
          originalPublishDate: '2026-08-24T03:00:00.000Z',
          timeRestrictions: { expirationDate: '2026-09-01T00:00:00.000Z' },
          links: {
            source: { HD: { href: 'https://espnmedia-cdn.akamaized.net/patriots-hd.mp4' } },
            web: { self: { href: 'https://www.espn.com/video/clip/_/id/9002' } },
          },
        }],
      }],
    },
  ],
};

test('scoreboard prioritizes favorite-team state and stays searchable as sports utility', () => {
  const [item] = parseSportsScoreboard(scoreboardFixture, nfl!, NOW);
  assert.ok(item);
  assert.equal(item.sourceKind, 'sports_state');
  assert.equal(item.sportsState?.kind, 'scoreboard');
  assert.ok(item.tags.includes('scores'));
  assert.ok(item.tags.includes('schedule'));
  assert.ok(item.tags.includes('patriots'));
  assert.equal(isFrontierSourceAdmitted(item), true);
  if (item.sportsState?.kind !== 'scoreboard') assert.fail('Expected scoreboard state');
  assert.equal(item.sportsState.games[0].id, 'patriots-game');
  assert.ok(item.sportsState.games[0].competitors.some((team) => team.favorite));
});

test('NFL highlight parser emits direct source-hosted video and never a YouTube embed', () => {
  const highlights = parseSportsHighlights(scoreboardFixture, nfl!, NOW);
  assert.equal(highlights.length, 2);
  assert.equal(highlights[0].title, 'Patriots film-room clip');
  assert.equal(highlights[0].media?.type, 'video');
  assert.equal(highlights[0].media?.url, 'https://espnmedia-cdn.akamaized.net/patriots-hd.mp4');
  assert.notEqual(highlights[0].media?.type, 'youtube');
  assert.equal(highlights[0].sourceKind, 'sports_state');
  assert.ok(highlights[0].tags.includes('watchable'));
  assert.equal(isFrontierSourceAdmitted(highlights[0]), true);
});

test('expired sports highlights are removed before recommendation', () => {
  const expired = structuredClone(scoreboardFixture);
  expired.events[1].competitions[0].highlights![0].timeRestrictions = {
    expirationDate: '2026-08-23T00:00:00.000Z',
  };
  const highlights = parseSportsHighlights(expired, nfl!, NOW);
  assert.ok(highlights.every((item) => item.title !== 'Patriots film-room clip'));
});

test('nested standings retain favorite teams even outside the leading rows', () => {
  const payload = {
    children: [{
      children: [
        {
          standings: {
            entries: [
              { team: { id: 'buf', abbreviation: 'BUF', displayName: 'Buffalo Bills' }, stats: [{ name: 'rank', value: 1 }, { name: 'wins', displayValue: '2' }, { name: 'losses', displayValue: '0' }] },
              { team: { id: 'mia', abbreviation: 'MIA', displayName: 'Miami Dolphins' }, stats: [{ name: 'rank', value: 2 }, { name: 'wins', displayValue: '1' }, { name: 'losses', displayValue: '1' }] },
            ],
          },
        },
        {
          standings: {
            entries: [
              { team: { id: 'ne', abbreviation: 'NE', displayName: 'New England Patriots' }, stats: [{ name: 'rank', value: 9 }, { name: 'wins', displayValue: '1' }, { name: 'losses', displayValue: '1' }] },
            ],
          },
        },
      ],
    }],
  };
  const [item] = parseSportsStandings(payload, nfl!);
  assert.ok(item);
  assert.equal(item.sportsState?.kind, 'standings');
  assert.ok(item.tags.includes('standings'));
  assert.ok(item.tags.includes('table'));
  if (item.sportsState?.kind !== 'standings') assert.fail('Expected standings state');
  const patriots = item.sportsState.standings.find((row) => row.abbreviation === 'NE');
  assert.ok(patriots);
  assert.equal(patriots!.rank, 9);
  assert.equal(patriots!.record, '1-1');
  assert.equal(patriots!.favorite, true);
});

test('finite daily run reserves live sports state separately from deeper sports analysis', () => {
  const [sportsState] = parseSportsScoreboard(scoreboardFixture, nfl!, NOW);
  const analysis: FrontierItem = {
    id: 'nfl-analysis',
    title: 'NFL EPA and player tracking analysis',
    summary: 'A deeper analytical signal.',
    url: 'https://www.pro-football-reference.com/',
    source: 'pro-football-reference.com',
    sourceLabel: 'Pro Football Reference',
    sourceKind: 'rss',
    publishedAt: '2026-08-24T04:00:00.000Z',
    lane: 'sports',
    tags: ['nfl', 'sports analytics', 'epa', 'player tracking'],
    baseScore: 0.8,
    importance: 0.7,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.6,
  };
  const generic = Array.from({ length: 20 }, (_, index): FrontierItem => ({
    ...analysis,
    id: `generic-${index}`,
    title: `Generic signal ${index}`,
    url: `https://github.com/example/${index}`,
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    lane: 'builder_signal',
    tags: ['open source'],
    baseScore: 0.95 - index * 0.01,
  }));
  const daily = selectDailyRun([...generic, analysis, sportsState], {}, 8, new Date(NOW));
  assert.ok(daily.some((item) => item.id === sportsState.id));
  assert.ok(daily.some((item) => item.id === analysis.id));
});
